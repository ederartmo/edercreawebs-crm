-- PATCH V1 DESPUÉS DEL ESQUEMA INICIAL
-- 1) Hace que la vista respete las políticas RLS de sus tablas.
-- 2) Concede a usuarios autenticados permisos SQL, que siguen limitados por RLS.

alter view public.crm_inbox set (security_invoker = true);

grant usage on schema public to authenticated;

grant select, insert, update, delete on table
  public.businesses,
  public.contacts,
  public.leads,
  public.conversations,
  public.messages,
  public.assets,
  public.tasks,
  public.visual_proposals,
  public.visual_proposal_sections,
  public.quotes,
  public.quote_items,
  public.payments,
  public.meetings,
  public.lead_status_history,
  public.automation_runs,
  public.crm_settings
to authenticated;

grant select on public.crm_inbox to authenticated;

-- Comprobación rápida
select
  c.relname as objeto,
  c.reloptions as opciones
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname = 'crm_inbox';
