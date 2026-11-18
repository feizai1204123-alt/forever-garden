-- 永远的花园 · shared rituals (flowers / candles / messages)
-- Paste the whole file into Supabase → SQL Editor → Run. Safe to run more than once.
-- Visitors (anon / publishable key) can ONLY call ritual_summary() and ritual_add();
-- they can't read or write the table directly. The owner hides a message by ticking
-- "hidden" on that row in Table Editor → rituals.

begin;

-- ---------- Tables ----------
create table if not exists public.rituals (
  id          bigint generated always as identity primary key,
  client_id   uuid        not null unique,            -- set by the browser; makes retries idempotent
  spot        text        not null,
  kind        text        not null,
  text        text,
  device      text        not null,
  ip_hash     text        not null,
  created_at  timestamptz not null default now(),
  hidden      boolean     not null default false     -- owner ticks this to hide a message
);
alter table public.rituals drop constraint if exists rituals_spot_chk;
alter table public.rituals add  constraint rituals_spot_chk check (spot ~ '^(m([0-9]|[1-3][0-9]|4[0-6])|statue)$');
alter table public.rituals drop constraint if exists rituals_kind_chk;
alter table public.rituals add  constraint rituals_kind_chk check (kind in ('flower','candle','message'));
alter table public.rituals drop constraint if exists rituals_text_chk;
alter table public.rituals add  constraint rituals_text_chk check ((kind = 'message' and char_length(text) between 1 and 200) or (kind <> 'message' and text is null));
create index if not exists rituals_spot_idx   on public.rituals (spot, kind, created_at desc);
create index if not exists rituals_ip_idx     on public.rituals (ip_hash, created_at desc);
create index if not exists rituals_device_idx on public.rituals (device, created_at desc);
create index if not exists rituals_time_idx   on public.rituals (created_at desc);
comment on column public.rituals.hidden is 'Tick to hide this message from everyone (owner moderation).';

-- Words that get a message rejected (lower-case; matched as substrings after removing spaces/symbols).
create table if not exists public.ritual_badwords (word text primary key);
insert into public.ritual_badwords (word) values
  ('傻逼'),('煞笔'),('傻b'),('操你'),('草你'),('肏'),('日你'),('你妈的'),('他妈的'),('尼玛'),('妈逼'),
  ('去死'),('死全家'),('贱人'),('婊子'),('畜生'),('滚蛋'),('脑残'),('智障'),('废物'),('垃圾人'),('杂种'),('狗日'),
  ('鸡巴'),('屌'),('骚货'),('约炮'),('裸聊'),('色情'),('赌博'),('博彩'),('代孕'),('办证'),('贷款'),('刷单'),('兼职'),
  ('加微'),('加v'),('wechat'),('微信号'),('qq号'),('telegram'),('tg群'),
  ('fuck'),('shit'),('bitch'),('cunt'),('nigger'),('nigga'),('faggot'),('asshole'),('pussy'),('porn'),('casino'),('viagra')
on conflict do nothing;

-- Lock both tables: RLS on, no policies, no direct grants → anon/authenticated can't touch them.
alter table public.rituals         enable row level security;
alter table public.ritual_badwords enable row level security;
revoke all on table public.rituals, public.ritual_badwords from public, anon, authenticated;
revoke all on sequence public.rituals_id_seq from public, anon, authenticated;

-- ---------- Read: per-spot totals + latest 100 visible messages ----------
-- Returns {"m3":{"flowers":2,"candles":1,"messages":[{"id":"<uuid>","text":"…","at":"…"}]}, …}
create or replace function public.ritual_summary(p_spot text default null)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with spots as (
    select distinct spot from public.rituals
    where p_spot is null or spot = p_spot
  )
  select coalesce(jsonb_object_agg(s.spot, jsonb_build_object(
    'flowers',  least(9999, (select count(*) from public.rituals r where r.spot = s.spot and r.kind = 'flower')),
    'candles',  least(9999, (select count(*) from public.rituals r where r.spot = s.spot and r.kind = 'candle')),
    'messages', coalesce((
       select jsonb_agg(jsonb_build_object('id', m.client_id, 'text', m.text, 'at', to_char(m.created_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')) order by m.created_at)
       from (select client_id, text, created_at from public.rituals r
             where r.spot = s.spot and r.kind = 'message' and not r.hidden
             order by r.created_at desc limit 100) m), '[]'::jsonb)
  )), '{}'::jsonb)
  from spots s;
$$;

-- ---------- Write: validated, rate-limited insert ----------
-- Errors are raised as short codes the page translates: bad_spot, bad_kind, bad_device, empty, too_long,
-- has_link, bad_words, slow_down, daily_limit, spot_limit, busy.
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
  if p_spot is null or p_spot !~ '^(m([0-9]|[1-3][0-9]|4[0-6])|statue)$' then raise exception 'bad_spot'; end if;
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
revoke all on function public.ritual_summary(text) from public;
revoke all on function public.ritual_add(uuid, text, text, text, text) from public;
grant execute on function public.ritual_summary(text) to anon, authenticated;
grant execute on function public.ritual_add(uuid, text, text, text, text) to anon, authenticated;

commit;

-- Make the API see the new functions right away.
notify pgrst, 'reload schema';
