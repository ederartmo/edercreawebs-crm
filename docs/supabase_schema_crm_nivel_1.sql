create extension if not exists "pgcrypto";

create type public.app_role as enum ('admin', 'editor', 'viewer');
create type public.crm_status as enum (
  'lead_nuevo',
  'diagnostico',
  'cotizacion_enviada',
  'esperando_anticipo',
  'info_pendiente',
  'diseno',
  'diseno_enviado',
  'ajustes_diseno',
  'desarrollo',
  'revision_cliente',
  'segundo_pago_pendiente',
  'publicado',
  'entregado',
  'mantenimiento',
  'perdido'
);
create type public.lead_source as enum (
  'meta_ads',
  'instagram',
  'facebook',
  'referido',
  'whatsapp',
  'sitio_web',
  'otro'
);
create type public.project_type as enum (
  'landing_page',
  'sitio_web_informativo',
  'sitio_web_con_formulario',
  'sitio_web_con_agenda',
  'sitio_web_con_chatbot',
  'sitio_web_con_pagos',
  'sistema_con_login',
  'portal_de_clientes',
  'dashboard_administrativo',
  'automatizacion',
  'mantenimiento'
);
create type public.task_status as enum ('pending', 'in_progress', 'done', 'blocked');
create type public.payment_status as enum ('pending', 'paid', 'overdue', 'cancelled');
create type public.domain_status as enum ('pendiente', 'confirmado', 'comprado', 'conectado');
create type public.link_type as enum (
  'drive',
  'quote',
  'design',
  'test_site',
  'final_site',
  'repository',
  'hosting',
  'domain',
  'admin_panel',
  'other'
);
create type public.maintenance_status as enum ('active', 'paused', 'pending_payment', 'cancelled');

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null,
  email text not null unique,
  role public.app_role not null default 'admin',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  company text,
  phone text,
  email text,
  source public.lead_source not null default 'otro',
  business_type text,
  need_summary text,
  status public.crm_status not null default 'lead_nuevo',
  notes text,
  contacted_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  company text,
  email text,
  phone text,
  rfc text,
  address text,
  website text,
  social_links jsonb not null default '[]'::jsonb,
  notes text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete restrict,
  lead_id uuid references public.leads (id) on delete set null,
  title text not null,
  project_type public.project_type not null,
  status public.crm_status not null default 'lead_nuevo',
  total_price numeric(12, 2) not null default 0,
  deposit_amount numeric(12, 2) not null default 0,
  deposit_paid boolean not null default false,
  final_payment_amount numeric(12, 2) not null default 0,
  final_payment_paid boolean not null default false,
  domain_status public.domain_status not null default 'pendiente',
  drive_url text,
  quote_url text,
  test_url text,
  final_url text,
  start_date date,
  due_date date,
  next_action text not null,
  notes text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  -- Para pruebas, marcar deposit_paid = true antes de mover proyectos a diseño o desarrollo.
  constraint projects_status_requires_deposit check (
    not (
      status in ('diseno', 'diseno_enviado', 'ajustes_diseno', 'desarrollo')
      and deposit_paid = false
    )
  ),
  -- Para pruebas, marcar final_payment_paid = true antes de publicar o entregar.
  constraint projects_delivery_requires_final_payment check (
    not (
      status in ('publicado', 'entregado', 'mantenimiento')
      and final_payment_paid = false
    )
  )
);

create table if not exists public.project_tasks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  title text not null,
  description text,
  status public.task_status not null default 'pending',
  sort_order integer not null default 0,
  due_date date,
  completed_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.project_notes (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  note text not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  concept text not null,
  amount numeric(12, 2) not null default 0,
  status public.payment_status not null default 'pending',
  due_date date,
  paid_at timestamptz,
  payment_method text,
  notes text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.project_links (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  label text not null,
  url text not null,
  type public.link_type not null default 'other',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

-- La tabla de mantenimiento puede existir desde el schema, pero la UI no es prioridad en la Fase 1.
create table if not exists public.maintenance_contracts (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  plan_name text not null,
  monthly_amount numeric(12, 2) not null default 0,
  charge_day smallint,
  status public.maintenance_status not null default 'active',
  last_update_at timestamptz,
  next_action text not null,
  notes text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create trigger set_profiles_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create trigger set_leads_updated_at
before update on public.leads
for each row execute function public.set_updated_at();

create trigger set_clients_updated_at
before update on public.clients
for each row execute function public.set_updated_at();

create trigger set_projects_updated_at
before update on public.projects
for each row execute function public.set_updated_at();

create trigger set_project_tasks_updated_at
before update on public.project_tasks
for each row execute function public.set_updated_at();

create trigger set_project_notes_updated_at
before update on public.project_notes
for each row execute function public.set_updated_at();

create trigger set_payments_updated_at
before update on public.payments
for each row execute function public.set_updated_at();

create trigger set_project_links_updated_at
before update on public.project_links
for each row execute function public.set_updated_at();

create trigger set_maintenance_contracts_updated_at
before update on public.maintenance_contracts
for each row execute function public.set_updated_at();

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'admin'
  );
$$;

alter table public.profiles enable row level security;
alter table public.leads enable row level security;
alter table public.clients enable row level security;
alter table public.projects enable row level security;
alter table public.project_tasks enable row level security;
alter table public.project_notes enable row level security;
alter table public.payments enable row level security;
alter table public.project_links enable row level security;
alter table public.maintenance_contracts enable row level security;

-- Nivel 1 asume operación interna. Antes de producción se debe asegurar el alta del primer admin
-- desde Supabase Auth + service role o desde el dashboard, porque estas policies ya nacen endurecidas.
create policy "admins can manage profiles"
on public.profiles
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "admins can manage leads"
on public.leads
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "admins can manage clients"
on public.clients
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "admins can manage projects"
on public.projects
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "admins can manage project tasks"
on public.project_tasks
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "admins can manage project notes"
on public.project_notes
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "admins can manage payments"
on public.payments
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "admins can manage project links"
on public.project_links
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "admins can manage maintenance contracts"
on public.maintenance_contracts
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

create or replace function public.seed_project_tasks(p_project_id uuid)
returns void
language sql
as $$
  -- project_tasks.status ya nace en 'pending', así que el checklist automático queda listo
  -- para uso inmediato sin necesidad de fijar estado manualmente.
  insert into public.project_tasks (project_id, title, sort_order)
  values
    (p_project_id, 'Responder lead', 10),
    (p_project_id, 'Identificar qué vende', 20),
    (p_project_id, 'Identificar qué espera', 30),
    (p_project_id, 'Identificar herramienta necesaria', 40),
    (p_project_id, 'Pedir referencias', 50),
    (p_project_id, 'Crear carpeta Drive', 60),
    (p_project_id, 'Crear documento de info base', 70),
    (p_project_id, 'Pedir fotos/videos/contenido', 80),
    (p_project_id, 'Preparar cotización', 90),
    (p_project_id, 'Enviar propuesta', 100),
    (p_project_id, 'Solicitar anticipo 50%', 110),
    (p_project_id, 'Confirmar anticipo', 120),
    (p_project_id, 'Confirmar dominio', 130),
    (p_project_id, 'Comprar dominio', 140),
    (p_project_id, 'Contratar hosting', 150),
    (p_project_id, 'Definir fechas', 160),
    (p_project_id, 'Analizar conversación y referencias', 170),
    (p_project_id, 'Generar resumen estratégico', 180),
    (p_project_id, 'Crear propuesta de diseño', 190),
    (p_project_id, 'Enviar diseño', 200),
    (p_project_id, 'Aprobar diseño', 210),
    (p_project_id, 'Desarrollar sitio/sistema', 220),
    (p_project_id, 'Probar responsive', 230),
    (p_project_id, 'Probar formularios', 240),
    (p_project_id, 'Enviar versión de revisión', 250),
    (p_project_id, 'Aplicar ajustes', 260),
    (p_project_id, 'Solicitar segundo pago', 270),
    (p_project_id, 'Confirmar segundo pago', 280),
    (p_project_id, 'Publicar', 290),
    (p_project_id, 'Entregar accesos', 300),
    (p_project_id, 'Ofrecer mantenimiento', 310),
    (p_project_id, 'Cerrar proyecto', 320);
$$;

create or replace function public.handle_project_created()
returns trigger
language plpgsql
as $$
begin
  perform public.seed_project_tasks(new.id);
  return new;
end;
$$;

create trigger seed_tasks_after_project_insert
after insert on public.projects
for each row execute function public.handle_project_created();

insert into public.leads (id, name, company, phone, email, source, business_type, need_summary, status, notes)
values (
  '10000000-0000-0000-0000-000000000001',
  'Mariana López',
  'CLTS Technologies',
  '+52 5550000001',
  'mariana@clts.mx',
  'instagram',
  'Tecnología',
  'Sitio web corporativo con formulario',
  'cotizacion_enviada',
  'Lead semilla para probar el flujo inicial.'
)
on conflict (id) do nothing;

insert into public.clients (id, name, company, email, phone, website, notes)
values (
  '20000000-0000-0000-0000-000000000001',
  'Samuel Pérez',
  'Samuel Studio',
  'samuel@studio.mx',
  '+52 5550000002',
  'https://samuelstudio.mx',
  'Cliente semilla para validar dashboards y listados.'
)
on conflict (id) do nothing;

insert into public.projects (
  id,
  client_id,
  lead_id,
  title,
  project_type,
  status,
  total_price,
  deposit_amount,
  deposit_paid,
  final_payment_amount,
  final_payment_paid,
  domain_status,
  quote_url,
  test_url,
  start_date,
  due_date,
  next_action,
  notes
)
values (
  '30000000-0000-0000-0000-000000000001',
  '20000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000001',
  'Sitio corporativo Samuel Studio',
  'sitio_web_informativo',
  'esperando_anticipo',
  10000.00,
  5000.00,
  false,
  5000.00,
  false,
  'confirmado',
  'https://drive.google.com/example-cotizacion',
  'https://preview.example.com/samuel-studio',
  current_date,
  current_date + 21,
  'Confirmar anticipo',
  'Proyecto semilla para validar estados, pagos y próximas acciones.'
)
on conflict (id) do nothing;

insert into public.project_notes (id, project_id, note)
values (
  '40000000-0000-0000-0000-000000000001',
  '30000000-0000-0000-0000-000000000001',
  'Cliente quiere una referencia visual similar a una landing limpia y moderna.'
)
on conflict (id) do nothing;

insert into public.payments (id, project_id, concept, amount, status, due_date, notes)
values (
  '50000000-0000-0000-0000-000000000001',
  '30000000-0000-0000-0000-000000000001',
  'Anticipo 50%',
  5000.00,
  'pending',
  current_date + 3,
  'Pago pendiente para desbloquear diseño y desarrollo.'
)
on conflict (id) do nothing;

insert into public.project_links (id, project_id, label, url, type)
values (
  '60000000-0000-0000-0000-000000000001',
  '30000000-0000-0000-0000-000000000001',
  'Carpeta Drive',
  'https://drive.google.com/example-proyecto',
  'drive'
)
on conflict (id) do nothing;
