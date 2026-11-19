-- 永远的花园 · 补丁：每台设备每天 3 次；取消按网络（IP）的每日限制；园主可跳过每日次数
-- 整份复制到 Supabase → SQL Editor → Run。可以重复执行。
-- 每月 300 额度的上限不变。园主跳过每日次数的开关由云函数校验后传入，访客无法直接调用。

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
  if p_spot is null or p_spot !~ '^m([0-9]|[1-3][0-9]|4[0-6])$' then raise exception 'bad_spot'; end if;
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

commit;

notify pgrst, 'reload schema';
