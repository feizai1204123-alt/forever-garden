-- 永远的花园 · 补丁（可重复执行）：每台设备每天 3 次；取消按网络（IP）的每日限制；园主可跳过每日次数；
-- 纪念位扩展到 m0–m99（新建不再接受三号位 m2）；献花等仪式同步放宽；增加占用位查询。
-- 整份复制到 Supabase → SQL Editor → Run。若已经跑过较早的 pet3d-limits 补丁，再跑这一份即可，不用分开做。
-- 每月 300 额度的上限不变。园主跳过每日次数的开关由云函数校验后传入，访客无法直接调用。
-- 朝向（rotation）原本就有，安放后由云函数按设备校验后更新，本补丁不必改表。

begin;

-- Wrong admin-code attempts (service role only). 5 failures / 10 minutes / IP hash → slow_down.
create table if not exists public.pet3d_admin_fails (
  id         bigint generated always as identity primary key,
  ip_hash    text        not null,
  created_at timestamptz not null default now()
);
create index if not exists pet3d_admin_fails_ip_idx on public.pet3d_admin_fails (ip_hash, created_at desc);
alter table public.pet3d_admin_fails enable row level security;
revoke all on table public.pet3d_admin_fails from public, anon, authenticated;

create or replace function public.pet3d_admin_attempt(p_ip_hash text, p_ok boolean default false)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  fails integer;
begin
  if p_ip_hash is null or p_ip_hash !~ '^[a-f0-9]{32,64}$' then raise exception 'bad_request'; end if;
  delete from public.pet3d_admin_fails where created_at < now() - interval '15 minutes';
  if not coalesce(p_ok, false) then
    insert into public.pet3d_admin_fails (ip_hash) values (p_ip_hash);
  end if;
  select count(*) into fails
    from public.pet3d_admin_fails
   where ip_hash = p_ip_hash and created_at > now() - interval '10 minutes';
  if fails >= 5 then
    raise exception 'slow_down';
  end if;
  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.pet3d_admin_attempt(text, boolean) from public, anon, authenticated;
grant execute on function public.pet3d_admin_attempt(text, boolean) to service_role;

-- Replace reserve: 3 / device / day, no IP daily cap, optional p_skip_daily (monthly cap always applies).
drop function if exists public.pet3d_reserve(uuid, text, text, text, text, text, text, text);
drop function if exists public.pet3d_reserve(uuid, text, text, text, text, text, text, text, boolean);

create or replace function public.pet3d_reserve(
  p_id      uuid,
  p_device  text,
  p_ip_hash text,
  p_spot    text,
  p_name    text,
  p_born    text,
  p_departed text,
  p_story   text,
  p_skip_daily boolean default false
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  n     text;
  t     text;
  rec   public.pet3d_jobs%rowtype;
  used  integer;
  day0  timestamptz := date_trunc('day', now() at time zone 'utc') at time zone 'utc';
  mon0  timestamptz := date_trunc('month', now() at time zone 'utc') at time zone 'utc';
  reserve integer := 15;
  month_cap integer := 300;
  device_day_cap integer := 3;
  day_count integer;
begin
  if p_id is null then raise exception 'bad_request'; end if;

  perform pg_advisory_xact_lock(hashtext('pmg-pet3d-reserve'));

  select * into rec from public.pet3d_jobs where id = p_id;
  if found then
    return jsonb_build_object('ok', true, 'duplicate', true, 'job', to_jsonb(rec));
  end if;

  if p_device is null or p_device !~ '^[A-Za-z0-9_-]{8,64}$' then raise exception 'bad_device'; end if;
  if p_spot is null or p_spot !~ '^m([0-9]|[1-9][0-9])$' or p_spot = 'm2' then raise exception 'bad_spot'; end if;
  if p_ip_hash is null or p_ip_hash !~ '^[a-f0-9]{32,64}$' then raise exception 'bad_request'; end if;

  n := btrim(coalesce(p_name, ''));
  if n = '' or char_length(n) > 24 then raise exception 'bad_name'; end if;
  if n ~* '(https?://|www\.|[a-z0-9-]+\.(com|net|org|cn|top|xyz|io|me|cc|vip|shop|site|app|link|ly)\y)' then
    raise exception 'has_link';
  end if;

  t := nullif(regexp_replace(btrim(coalesce(p_story, '')), '\s+', ' ', 'g'), '');
  if t is not null then
    if char_length(t) > 2000 then raise exception 'too_long'; end if;
    if t ~* '(https?://|www\.|[a-z0-9-]+\.(com|net|org|cn|top|xyz|io|me|cc|vip|shop|site|app|link|ly)\y)'
    or t ~ '[0-9０-９]{7,}' then
      raise exception 'has_link';
    end if;
  end if;

  update public.pet3d_jobs
     set status = 'failed', credits_reserved = 0, error_code = 'expired', updated_at = now()
   where status = 'queued' and meshy_task_id is null and created_at < now() - interval '10 minutes';

  if not coalesce(p_skip_daily, false) then
    select count(*) into day_count
      from public.pet3d_jobs
     where device = p_device and created_at >= day0
       and (status <> 'failed' or meshy_task_id is not null);
    if day_count >= device_day_cap then
      raise exception 'daily_limit';
    end if;
  end if;

  select coalesce(sum(case
           when status in ('queued','pending','in_progress') then greatest(credits_reserved, credits_used)
           else credits_used
         end), 0)
    into used
    from public.pet3d_jobs
   where created_at >= mon0
     and (status <> 'failed' or credits_used > 0);

  if used + reserve > month_cap then
    raise exception 'month_limit';
  end if;

  if exists (
    select 1 from public.pet3d_jobs
     where spot = p_spot and status in ('queued','pending','in_progress','succeeded','placed')
  ) then
    raise exception 'spot_taken';
  end if;

  insert into public.pet3d_jobs (id, device, ip_hash, spot, status, name, born, departed, story, credits_reserved)
  values (p_id, p_device, p_ip_hash, p_spot, 'queued', n,
          nullif(btrim(coalesce(p_born, '')), ''),
          nullif(btrim(coalesce(p_departed, '')), ''),
          t, reserve)
  returning * into rec;

  return jsonb_build_object('ok', true, 'duplicate', false, 'job', to_jsonb(rec));
end;
$$;

revoke all on function public.pet3d_reserve(uuid, text, text, text, text, text, text, text, boolean) from public, anon, authenticated;
grant execute on function public.pet3d_reserve(uuid, text, text, text, text, text, text, text, boolean) to service_role;


-- Widen allowed figurine spots (m0–m99). Keep existing m2 (Kate) valid on the table,
-- but pet3d_reserve above refuses new jobs on m2.
alter table public.pet3d_jobs drop constraint if exists pet3d_jobs_spot_chk;
alter table public.pet3d_jobs add constraint pet3d_jobs_spot_chk check (spot ~ '^m([0-9]|[1-9][0-9])$');

create or replace function public.pet3d_occupied()
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(jsonb_agg(j.spot order by j.spot), '[]'::jsonb)
  from public.pet3d_jobs j
  where j.status in ('queued','pending','in_progress','succeeded','placed');
$$;
revoke all on function public.pet3d_occupied() from public, anon, authenticated;
grant execute on function public.pet3d_occupied() to service_role;

-- Flowers / candles / messages may use the new pedestals (m2 still allowed).
alter table public.rituals drop constraint if exists rituals_spot_chk;
alter table public.rituals add constraint rituals_spot_chk check (spot ~ '^(m([0-9]|[1-9][0-9])|statue)$');

create or replace function public.ritual_add(p_client_id uuid, p_spot text, p_kind text, p_device text, p_text text default null)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  hdr   json;
  ip    text;
  iph   text;
  t     text;
  flat  text;
begin
  if p_client_id is null then raise exception 'bad_request'; end if;
  -- A retried request (same client_id) just returns the current state.
  if exists (select 1 from public.rituals where client_id = p_client_id) then
    return jsonb_build_object('ok', true, 'duplicate', true, 'entry', coalesce(public.ritual_summary(p_spot) -> p_spot, '{}'::jsonb));
  end if;
  if p_spot is null or p_spot !~ '^(m([0-9]|[1-9][0-9])|statue)$' then raise exception 'bad_spot'; end if;
  if p_kind is null or p_kind not in ('flower','candle','message') then raise exception 'bad_kind'; end if;
  if p_device is null or p_device !~ '^[A-Za-z0-9_-]{8,64}$' then raise exception 'bad_device'; end if;

  begin hdr := current_setting('request.headers', true)::json; exception when others then hdr := null; end;
  ip  := coalesce(nullif(hdr ->> 'cf-connecting-ip', ''), nullif(trim(split_part(coalesce(hdr ->> 'x-forwarded-for', ''), ',', 1)), ''), nullif(hdr ->> 'x-real-ip', ''), 'unknown');
  iph := md5('pmg-garden:' || ip);

  -- Rate limits (per IP and per device; plus a global safety valve).
  if (select count(*) from public.rituals where ip_hash = iph and created_at > now() - interval '1 minute') >= 30
  or (select count(*) from public.rituals where device = p_device and created_at > now() - interval '1 minute') >= 30 then
    raise exception 'slow_down';
  end if;
  if (select count(*) from public.rituals where ip_hash = iph and created_at > now() - interval '1 day') >= 300
  or (select count(*) from public.rituals where device = p_device and created_at > now() - interval '1 day') >= 300 then
    raise exception 'daily_limit';
  end if;
  if (select count(*) from public.rituals where created_at > now() - interval '1 hour') >= 3000 then
    raise exception 'busy';
  end if;

  if p_kind = 'message' then
    t := regexp_replace(btrim(coalesce(p_text, '')), '\s+', ' ', 'g');
    if t = '' then raise exception 'empty'; end if;
    if char_length(t) > 200 then raise exception 'too_long'; end if;
    -- Links / contact details (common spam).
    if t ~* '(https?://|www\.|[a-z0-9-]+\.(com|net|org|cn|top|xyz|io|me|cc|vip|shop|site|app|link|ly)\y|t\.me/|@[a-z0-9_]{4,})'
    or t ~ '[0-9０-９]{7,}' then
      raise exception 'has_link';
    end if;
    flat := lower(regexp_replace(t, '[[:space:][:punct:]·，。！？、~～*＊_-]+', '', 'g'));
    if exists (select 1 from public.ritual_badwords b where strpos(flat, b.word) > 0) then raise exception 'bad_words'; end if;
    if (select count(*) from public.rituals where device = p_device and spot = p_spot and kind = 'message' and created_at > now() - interval '1 day') >= 10 then
      raise exception 'spot_limit';
    end if;
  else
    t := null;
  end if;

  insert into public.rituals (client_id, spot, kind, text, device, ip_hash)
  values (p_client_id, p_spot, p_kind, t, p_device, iph)
  on conflict (client_id) do nothing;

  return jsonb_build_object('ok', true, 'entry', coalesce(public.ritual_summary(p_spot) -> p_spot, '{}'::jsonb));
end;
$$;

-- ---------- Grants: anon may only execute these two functions ----------

revoke all on function public.ritual_add(uuid, text, text, text, text) from public;
grant execute on function public.ritual_add(uuid, text, text, text, text) to anon, authenticated;


commit;

notify pgrst, 'reload schema';
