-- Migration: add quotes and quote_items tables for persisted invoices
-- Apply manually in Supabase SQL Editor.

create table if not exists public.quotes (
  id uuid primary key default gen_random_uuid(),
  quote_number text not null,
  client_id uuid references public.clients (id) on delete set null,
  project_id uuid references public.projects (id) on delete set null,
  client_name text,
  issue_date date,
  status text not null default 'draft' check (status in ('draft', 'sent', 'approved', 'rejected')),
  subtotal numeric(12, 2) not null default 0,
  discount_amount numeric(12, 2) not null default 0,
  tax_rate numeric(5, 2) not null default 16,
  tax_amount numeric(12, 2) not null default 0,
  grand_total numeric(12, 2) not null default 0,
  notes text,
  payment_details jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.quote_items (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references public.quotes (id) on delete cascade,
  description text not null,
  details text,
  quantity numeric(10, 2) not null default 1,
  unit_price numeric(12, 2) not null default 0,
  total numeric(12, 2) not null default 0,
  sort_order integer not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_quotes_client_id on public.quotes (client_id);
create index if not exists idx_quotes_project_id on public.quotes (project_id);
create index if not exists idx_quotes_status on public.quotes (status);
create index if not exists idx_quote_items_quote_id on public.quote_items (quote_id);

create trigger set_quotes_updated_at
before update on public.quotes
for each row execute function public.set_updated_at();

create trigger set_quote_items_updated_at
before update on public.quote_items
for each row execute function public.set_updated_at();

alter table public.quotes enable row level security;
alter table public.quote_items enable row level security;

create policy "admins can manage quotes"
on public.quotes
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "admins can manage quote items"
on public.quote_items
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());
