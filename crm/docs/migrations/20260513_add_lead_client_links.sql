-- Migration: Add lead_links and client_links for context URLs
-- Apply in Supabase SQL Editor.

create table if not exists public.lead_links (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads (id) on delete cascade,
  label text not null,
  url text not null,
  type text not null default 'other',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists lead_links_lead_id_idx on public.lead_links (lead_id);

create table if not exists public.client_links (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  label text not null,
  url text not null,
  type text not null default 'other',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists client_links_client_id_idx on public.client_links (client_id);

drop trigger if exists set_lead_links_updated_at on public.lead_links;
create trigger set_lead_links_updated_at
before update on public.lead_links
for each row execute function public.set_updated_at();

drop trigger if exists set_client_links_updated_at on public.client_links;
create trigger set_client_links_updated_at
before update on public.client_links
for each row execute function public.set_updated_at();

alter table public.lead_links enable row level security;
alter table public.client_links enable row level security;

drop policy if exists "admins can manage lead links" on public.lead_links;
create policy "admins can manage lead links"
on public.lead_links
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "admins can manage client links" on public.client_links;
create policy "admins can manage client links"
on public.client_links
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());
