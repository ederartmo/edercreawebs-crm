-- Migration: track converted leads as won clients and keep relationship to client
-- Apply in Supabase SQL Editor.

do $$
begin
  if not exists (
    select 1
    from pg_enum e
    join pg_type t on t.oid = e.enumtypid
    where t.typname = 'crm_status'
      and e.enumlabel = 'cliente_ganado'
  ) then
    alter type public.crm_status add value 'cliente_ganado';
  end if;
end;
$$;

alter table public.leads
  add column if not exists converted_client_id uuid references public.clients(id) on delete set null,
  add column if not exists converted_at timestamptz;

create index if not exists idx_leads_converted_client_id
  on public.leads (converted_client_id);

create index if not exists idx_leads_converted_at
  on public.leads (converted_at);
