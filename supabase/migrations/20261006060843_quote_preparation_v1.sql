-- LOCAL REVIEW ONLY. Additive quote-preparation fields; no backfill or pricing sync.
begin;

alter table public.quotes
  add column project_type text,
  add column solution_proposed text,
  add column deliverables text[] not null default '{}',
  add column manual_project_price_cents bigint,
  add column delivery_timeline text,
  add column payment_terms text,
  add column maintenance_mode text,
  add column maintenance_details text,
  add column maintenance_price_cents bigint,
  add column proposal_notes text;

alter table public.quotes
  add constraint quotes_manual_project_price_cents_nonnegative
    check (manual_project_price_cents is null or manual_project_price_cents >= 0),
  add constraint quotes_maintenance_mode_allowed
    check (maintenance_mode is null or maintenance_mode in ('none', 'optional', 'included')),
  add constraint quotes_maintenance_price_cents_nonnegative
    check (maintenance_price_cents is null or maintenance_price_cents >= 0);

commit;

-- Conceptual rollback (run only as a separately approved operation):
-- begin;
-- alter table public.quotes
--   drop constraint quotes_manual_project_price_cents_nonnegative,
--   drop constraint quotes_maintenance_mode_allowed,
--   drop constraint quotes_maintenance_price_cents_nonnegative,
--   drop column project_type,
--   drop column solution_proposed,
--   drop column deliverables,
--   drop column manual_project_price_cents,
--   drop column delivery_timeline,
--   drop column payment_terms,
--   drop column maintenance_mode,
--   drop column maintenance_details,
--   drop column maintenance_price_cents,
--   drop column proposal_notes;
-- commit;
