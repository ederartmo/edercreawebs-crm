-- LOCAL REVIEW ONLY. Reproduces the web_sessions/web_events state that already exists in the
-- active project (ycdosrsanutbhbgejwwg): columns, defaults, constraints, foreign keys, indexes,
-- triggers, RLS, grants and realtime publication, as verified against the real database.
-- This file is a reproducible source of truth for Git: it is NOT applied from this repo
-- (no db push, no db reset, no supabase_apply_migration here). Every statement is written to be
-- safely re-runnable against those pre-existing objects.
begin;

create table if not exists public.web_sessions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  token_hash text not null,
  -- Single source of truth for the public reference: PostgreSQL mints it (ECW- + 10 upper hex chars).
  reference_code text not null default ('ECW-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10))),
  intake_session_id uuid references public.intake_sessions(id) on delete set null,
  lead_id uuid references public.leads(id) on delete set null,
  conversation_id uuid references public.conversations(id) on delete set null,
  source text,
  entry_channel text,
  landing_path text,
  referrer text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_content text,
  utm_term text,
  fbp text,
  fbc text,
  consent_analytics boolean not null default false,
  consent_marketing boolean not null default false,
  status text not null default 'active',
  current_path text,
  current_stage text,
  last_event_name text,
  event_count integer not null default 0,
  started_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  ended_at timestamptz,
  converted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint web_sessions_token_hash_key unique (token_hash),
  constraint web_sessions_token_hash_check check (token_hash ~ '^[a-f0-9]{64}$'),
  constraint web_sessions_reference_code_key unique (reference_code),
  constraint web_sessions_status_check check (status in ('active', 'ended', 'converted')),
  constraint web_sessions_event_count_check check (event_count >= 0),
  -- Target of the composite foreign key from web_events.
  constraint web_sessions_id_owner_id_key unique (id, owner_id)
);

create table if not exists public.web_events (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  session_id uuid not null,
  event_id uuid not null,
  event_name text not null,
  stage text,
  path text,
  properties jsonb not null default '{}'::jsonb,
  source text not null,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint web_events_event_id_key unique (event_id),
  constraint web_events_event_name_check check (octet_length(event_name) <= 64),
  constraint web_events_properties_check check (jsonb_typeof(properties) = 'object' and octet_length(properties::text) <= 12000),
  constraint web_events_source_check check (source in ('client', 'server', 'system')),
  -- Owner-scoped session reference: deleting a session removes its events, and only for that owner.
  constraint web_events_session_id_owner_id_fkey foreign key (session_id, owner_id)
    references public.web_sessions(id, owner_id) on delete cascade
);

create index if not exists web_sessions_owner_last_seen_idx on public.web_sessions(owner_id, last_seen_at desc);
create index if not exists web_sessions_owner_started_idx on public.web_sessions(owner_id, started_at desc);
create index if not exists web_sessions_intake_session_idx on public.web_sessions(intake_session_id) where intake_session_id is not null;
create index if not exists web_sessions_lead_idx on public.web_sessions(lead_id) where lead_id is not null;
create index if not exists web_sessions_conversation_idx on public.web_sessions(conversation_id) where conversation_id is not null;
create index if not exists web_events_session_occurred_idx on public.web_events(session_id, occurred_at);
create index if not exists web_events_owner_occurred_idx on public.web_events(owner_id, occurred_at desc);
create index if not exists web_events_name_occurred_idx on public.web_events(event_name, occurred_at desc);

-- At most one session_started and one lead_created per session, whatever the writer or retries.
create unique index if not exists web_events_one_session_started_per_session_idx
  on public.web_events(session_id) where event_name = 'session_started';
create unique index if not exists web_events_one_lead_created_per_session_idx
  on public.web_events(session_id) where event_name = 'lead_created';

alter table public.web_sessions enable row level security;
alter table public.web_events enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'web_sessions' and policyname = 'owner_all') then
    create policy "owner_all" on public.web_sessions
      using (owner_id = auth.uid()) with check (owner_id = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'web_events' and policyname = 'owner_all') then
    create policy "owner_all" on public.web_events
      using (owner_id = auth.uid()) with check (owner_id = auth.uid());
  end if;
end $$;

-- anon: no access at all. authenticated: table privileges constrained by RLS. service_role: backend.
revoke all on public.web_sessions from public, anon, authenticated;
revoke all on public.web_events from public, anon, authenticated;
grant select, insert, update, delete on public.web_sessions, public.web_events to authenticated;
grant select, insert, update, delete on public.web_sessions, public.web_events to service_role;

drop trigger if exists web_sessions_updated_at on public.web_sessions;
create trigger web_sessions_updated_at before update on public.web_sessions
  for each row execute function public.set_updated_at();

-- INSERT web_events folds liveness/state back onto its session; lead_created and session_ended
-- additionally close the session. event_count is never maintained by application code.
create or replace function public.sync_web_session_from_event() returns trigger
  language plpgsql set search_path = '' as $$
begin
  update public.web_sessions set
    last_seen_at = greatest(last_seen_at, new.occurred_at),
    current_path = coalesce(new.path, current_path),
    current_stage = coalesce(new.stage, current_stage),
    last_event_name = new.event_name,
    event_count = event_count + 1,
    status = case
      when new.event_name = 'session_ended' then 'ended'
      when new.event_name = 'lead_created' then 'converted'
      else status end,
    converted_at = case
      when new.event_name = 'lead_created' and converted_at is null then new.occurred_at
      else converted_at end,
    ended_at = case
      when new.event_name = 'session_ended' then new.occurred_at
      else ended_at end
  where id = new.session_id;
  return new;
end;
$$;

drop trigger if exists trg_sync_web_session_from_event on public.web_events;
create trigger trg_sync_web_session_from_event after insert on public.web_events
  for each row execute function public.sync_web_session_from_event();

do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'web_sessions') then
    alter publication supabase_realtime add table public.web_sessions;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'web_events') then
    alter publication supabase_realtime add table public.web_events;
  end if;
end $$;

commit;

-- Conceptual rollback (run only as a separately approved operation):
-- begin;
-- drop trigger if exists trg_sync_web_session_from_event on public.web_events;
-- drop function if exists public.sync_web_session_from_event();
-- drop trigger if exists web_sessions_updated_at on public.web_sessions;
-- drop policy if exists owner_all on public.web_events;
-- drop policy if exists owner_all on public.web_sessions;
-- drop table if exists public.web_events;
-- drop table if exists public.web_sessions;
-- commit;
