-- 永远的花园 · 上传宠物照片生成 3D 小像（Meshy）
-- 整份复制到 Supabase → SQL Editor → Run。可以重复执行，不会破坏已有数据。
-- 访客不能直接读写这些表，只能调用 pet3d_list() 查看已安放的小像。
-- 生成、限额、下载模型都由 Edge Function「pet3d」用服务端密钥完成。
-- 园主可在 Table Editor → pet3d_jobs 勾选 hidden，对所有人隐藏某只小像。

begin;

-- ---------- Tables ----------
create table if not exists public.pet3d_jobs (
  id               uuid        primary key,                 -- 浏览器生成，重试时同一个 id 不会重复扣额度
  device           text        not null,
  ip_hash          text        not null,
  spot             text        not null,
  status           text        not null default 'queued',
  progress         integer     not null default 0,
  meshy_task_id    text,
  credits_reserved integer     not null default 15,         -- 提交时先预留（meshy-6-lite + 2K 贴图 = 15）
  credits_used     integer     not null default 0,          -- 完成后改成 Meshy 实际扣费；失败则为 0
  error_code       text,
  name             text        not null,
  born             text,
  departed         text,
  story            text,
  rotation         integer     not null default 0,
  photo_path       text,
  model_path       text,
  thumb_path       text,
  hidden           boolean     not null default false,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

alter table public.pet3d_jobs drop constraint if exists pet3d_jobs_device_chk;
alter table public.pet3d_jobs add  constraint pet3d_jobs_device_chk check (device ~ '^[A-Za-z0-9_-]{8,64}$');
alter table public.pet3d_jobs drop constraint if exists pet3d_jobs_spot_chk;
alter table public.pet3d_jobs add  constraint pet3d_jobs_spot_chk check (spot ~ '^m([0-9]|[1-3][0-9]|4[0-6])$');
alter table public.pet3d_jobs drop constraint if exists pet3d_jobs_status_chk;
alter table public.pet3d_jobs add  constraint pet3d_jobs_status_chk check (status in ('queued','pending','in_progress','succeeded','failed','placed'));
alter table public.pet3d_jobs drop constraint if exists pet3d_jobs_name_chk;
alter table public.pet3d_jobs add  constraint pet3d_jobs_name_chk check (char_length(name) between 1 and 24);
alter table public.pet3d_jobs drop constraint if exists pet3d_jobs_story_chk;
alter table public.pet3d_jobs add  constraint pet3d_jobs_story_chk check (story is null or char_length(story) <= 2000);
alter table public.pet3d_jobs drop constraint if exists pet3d_jobs_rot_chk;
alter table public.pet3d_jobs add  constraint pet3d_jobs_rot_chk check (rotation between 0 and 359);
alter table public.pet3d_jobs drop constraint if exists pet3d_jobs_progress_chk;
alter table public.pet3d_jobs add  constraint pet3d_jobs_progress_chk check (progress between 0 and 100);
alter table public.pet3d_jobs drop constraint if exists pet3d_jobs_credits_chk;
alter table public.pet3d_jobs add  constraint pet3d_jobs_credits_chk check (credits_reserved >= 0 and credits_used >= 0);

create index if not exists pet3d_jobs_device_idx on public.pet3d_jobs (device, created_at desc);
create index if not exists pet3d_jobs_ip_idx     on public.pet3d_jobs (ip_hash, created_at desc);
create index if not exists pet3d_jobs_spot_idx   on public.pet3d_jobs (spot, status);
create index if not exists pet3d_jobs_time_idx   on public.pet3d_jobs (created_at desc);
create index if not exists pet3d_jobs_visible_idx on public.pet3d_jobs (status) where (not hidden and status = 'placed');

comment on table  public.pet3d_jobs is '访客上传宠物照片后生成的 3D 小像任务。勾选 hidden 可对所有人隐藏。';
comment on column public.pet3d_jobs.hidden is '园主勾选后，这只小像不再出现在花园里。';
comment on column public.pet3d_jobs.credits_used is 'Meshy 实际扣除的额度；失败为 0（对方会退回）。';

-- Lock the table: RLS on, no policies, no direct grants.
alter table public.pet3d_jobs enable row level security;
revoke all on table public.pet3d_jobs from public, anon, authenticated;

-- ---------- Public read: only placed, visible pets (no photos, no device / IP) ----------
create or replace function public.pet3d_list()
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',         j.id,
    'spot',       j.spot,
    'status',     j.status,
    'name',       j.name,
    'born',       j.born,
    'departed',   j.departed,
    'story',      j.story,
    'rotation',   j.rotation,
    'model_path', j.model_path,
    'thumb_path', j.thumb_path
  ) order by j.created_at), '[]'::jsonb)
  from public.pet3d_jobs j
  where j.status = 'placed' and not j.hidden and j.model_path is not null;
$$;

-- ---------- Atomic reserve (called only by the Edge Function with the service role) ----------
-- Errors as short codes: bad_request, bad_device, bad_spot, bad_name, has_link, too_long,
-- daily_limit (3 per device per UTC day), month_limit, spot_taken.
-- p_skip_daily: service-role only (anon has no EXECUTE). Skips the per-device daily cap;
-- the monthly credit cap always applies. There is no per-IP daily cap.
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

  -- One lock so two visitors cannot both slip under the monthly cap.
  perform pg_advisory_xact_lock(hashtext('pmg-pet3d-reserve'));

  -- A retried request (same id) just returns the existing row.
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

  -- Drop reservations that never reached Meshy (function crashed before the API call).
  update public.pet3d_jobs
     set status = 'failed', credits_reserved = 0, error_code = 'expired', updated_at = now()
   where status = 'queued' and meshy_task_id is null and created_at < now() - interval '10 minutes';

  -- 3 generations per device per UTC day (jobs that reserved credits or reached Meshy).
  -- No per-IP daily cap. p_skip_daily (service role only) skips this check, not the monthly cap.
  if not coalesce(p_skip_daily, false) then
    select count(*) into day_count
      from public.pet3d_jobs
     where device = p_device and created_at >= day0
       and (status <> 'failed' or meshy_task_id is not null);
    if day_count >= device_day_cap then
      raise exception 'daily_limit';
    end if;
  end if;

  -- Monthly cap: actual usage + still-reserved active jobs.
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

  -- One visible / in-flight model per pedestal.
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

revoke all on function public.pet3d_list() from public;
grant execute on function public.pet3d_list() to anon, authenticated;
-- CREATE FUNCTION also gets EXECUTE for anon/authenticated via Supabase default privileges.
-- REVOKE FROM PUBLIC alone is not enough — visitors could call reserve directly and skip the Edge Function.
-- Drop the old 8-argument signature so only the service-role 9-argument form remains.
drop function if exists public.pet3d_reserve(uuid, text, text, text, text, text, text, text);
revoke all on function public.pet3d_reserve(uuid, text, text, text, text, text, text, text, boolean) from public, anon, authenticated;
grant execute on function public.pet3d_reserve(uuid, text, text, text, text, text, text, text, boolean) to service_role;

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

-- ---------- Public storage bucket for finished models & thumbnails (photos stay private) ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'pet3d',
  'pet3d',
  true,
  20971520,
  array['model/gltf-binary','model/gltf+json','image/jpeg','image/png','image/webp','application/octet-stream']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

-- Recreate policies idempotently.
drop policy if exists "pet3d_public_read_models" on storage.objects;
drop policy if exists "pet3d_no_public_write" on storage.objects;
drop policy if exists "pet3d_no_public_update" on storage.objects;
drop policy if exists "pet3d_no_public_delete" on storage.objects;

-- Anyone may download models/ and thumbs/. Photos stay in photos/ with no read policy.
create policy "pet3d_public_read_models"
on storage.objects
for select
to public
using (
  bucket_id = 'pet3d'
  and split_part(name, '/', 1) in ('models', 'thumbs')
);

commit;

notify pgrst, 'reload schema';
