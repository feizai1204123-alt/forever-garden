-- Privacy-friendly visit analytics for Forever Garden.
-- Anon may INSERT only (length/value checks + rate limit). No anon SELECT.
-- No IP addresses or personal data are stored.
-- Owner reads visit_stats_daily in the Supabase Table Editor.

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table if not exists public.page_visits (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  visitor_id text not null,
  is_new_visitor boolean not null default false,
  source text not null default 'direct',
  lang text,
  device text not null default 'desktop',
  page_path text,
  embedded boolean not null default false,
  event text not null default 'visit',
  constraint page_visits_visitor_id_check
    check (visitor_id ~ '^[A-Za-z0-9_-]{8,64}$'),
  constraint page_visits_event_check
    check (event = any (array['visit','game_loaded','upload_opened','ritual_done'])),
  constraint page_visits_source_check
    check (source = any (array['direct','xiaohongshu','tiktok','douyin','youtube','itch.io','reddit','x','facebook','producthunt','hn','other','test'])),
  constraint page_visits_device_check
    check (device = any (array['mobile','desktop'])),
  constraint page_visits_lang_check
    check (lang is null or lang = any (array['zh','en'])),
  constraint page_visits_path_check
    check (page_path is null or (char_length(page_path) <= 200 and page_path like '/%' and page_path !~ '[?#]'))
);

create index if not exists page_visits_created_idx
  on public.page_visits (created_at desc);
create index if not exists page_visits_day_source_idx
  on public.page_visits (created_at, source)
  where event = 'visit';
create index if not exists page_visits_visitor_time_idx
  on public.page_visits (visitor_id, created_at desc);

comment on table public.page_visits is
  '匿名访问记录：不含 IP 或个人信息。访客 id 是保存在对方浏览器里的随机编号。';
comment on column public.page_visits.visitor_id is
  'Random anonymous id from the visitor''s localStorage (not a person or IP).';
comment on column public.page_visits.source is
  'xiaohongshu / tiktok / douyin / youtube / itch.io / reddit / x / facebook / producthunt / hn / direct / other / test.';
comment on column public.page_visits.event is
  'visit (page open), game_loaded, upload_opened, ritual_done.';

alter table public.page_visits enable row level security;

revoke all on table public.page_visits from public, anon, authenticated;
revoke all on sequence public.page_visits_id_seq from public, anon, authenticated;
grant insert on table public.page_visits to anon, authenticated;
grant usage on sequence public.page_visits_id_seq to anon, authenticated;

create policy page_visits_anon_insert
  on public.page_visits
  for insert
  to anon, authenticated
  with check (
    visitor_id ~ '^[A-Za-z0-9_-]{8,64}$'
    and event = any (array['visit','game_loaded','upload_opened','ritual_done'])
    and source = any (array['direct','xiaohongshu','tiktok','douyin','youtube','itch.io','reddit','x','facebook','producthunt','hn','other','test'])
    and device = any (array['mobile','desktop'])
    and (lang is null or lang = any (array['zh','en']))
    and (page_path is null or (char_length(page_path) <= 200 and page_path like '/%' and page_path !~ '[?#]'))
  );

-- Force created_at to now() (clients cannot backdate) and cap bursts per visitor_id.
create or replace function private.page_visits_before_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.created_at := now();
  if (
    select count(*) from public.page_visits
    where visitor_id = new.visitor_id
      and created_at > now() - interval '10 minutes'
  ) >= 20 then
    raise exception 'slow_down' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

revoke all on function private.page_visits_before_insert() from public, anon, authenticated;

drop trigger if exists page_visits_before_insert on public.page_visits;
create trigger page_visits_before_insert
  before insert on public.page_visits
  for each row execute function private.page_visits_before_insert();

-- Daily totals by source, dates in Europe/London. Owner-only (security_invoker + no grants).
create or replace view public.visit_stats_daily
  with (security_invoker = true)
  as
  select
    (created_at at time zone 'Europe/London')::date as day,
    source,
    count(*) filter (where event = 'visit') as visits,
    count(distinct visitor_id) filter (where event = 'visit') as unique_visitors,
    count(*) filter (where event = 'visit' and is_new_visitor) as new_visitors,
    count(*) filter (where event = 'game_loaded') as game_loaded,
    count(*) filter (where event = 'upload_opened') as upload_opened,
    count(*) filter (where event = 'ritual_done') as ritual_done
  from public.page_visits
  group by 1, 2;

comment on view public.visit_stats_daily is
  '每日访问统计（欧洲/伦敦日期），按来源分行。在 Table Editor 打开即可查看。anon 无法读取。';

revoke all on table public.visit_stats_daily from public, anon, authenticated;
