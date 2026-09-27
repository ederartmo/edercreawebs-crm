create or replace function public.ensure_whatsapp_handoff_task()
returns trigger
language plpgsql
as $$
declare
  contact_name text;
begin
  if new.human_required is true
     and new.human_reason = 'whatsapp_v1_ready_for_handoff' then

    select c.full_name
      into contact_name
      from public.contacts c
     where c.id = new.contact_id;

    insert into public.tasks (
      owner_id,
      lead_id,
      type,
      title,
      description,
      status,
      priority,
      due_at,
      automation_key,
      created_by_type,
      metadata
    )
    select
      new.owner_id,
      new.id,
      'seguimiento',
      '🔥 Atender ' || coalesce(nullif(contact_name, ''), 'nuevo lead de WhatsApp'),
      'Lead calificado por WhatsApp. Qué vende: '
        || coalesce(nullif(new.what_sells, ''), 'Pendiente')
        || '. Cómo vende: '
        || coalesce(nullif(new.how_sells, ''), 'Pendiente')
        || '.',
      'pending',
      'high',
      now(),
      'whatsapp-v1-human-handoff',
      'system',
      jsonb_build_object(
        'source', 'whatsapp_v1',
        'human_reason', new.human_reason
      )
    where not exists (
      select 1
        from public.tasks t
       where t.lead_id = new.id
         and t.automation_key = 'whatsapp-v1-human-handoff'
         and t.status <> 'cancelled'
    );
  end if;

  return new;
end;
$$;

drop trigger if exists trg_whatsapp_handoff_task on public.leads;

create trigger trg_whatsapp_handoff_task
after insert or update of human_required, human_reason, what_sells, how_sells
on public.leads
for each row
execute function public.ensure_whatsapp_handoff_task();

-- Backfill any lead that already completed the WhatsApp V1 handoff before
-- this migration was installed.
insert into public.tasks (
  owner_id,
  lead_id,
  type,
  title,
  description,
  status,
  priority,
  due_at,
  automation_key,
  created_by_type,
  metadata
)
select
  l.owner_id,
  l.id,
  'seguimiento',
  '🔥 Atender ' || coalesce(nullif(c.full_name, ''), 'nuevo lead de WhatsApp'),
  'Lead calificado por WhatsApp. Qué vende: '
    || coalesce(nullif(l.what_sells, ''), 'Pendiente')
    || '. Cómo vende: '
    || coalesce(nullif(l.how_sells, ''), 'Pendiente')
    || '.',
  'pending',
  'high',
  now(),
  'whatsapp-v1-human-handoff',
  'system',
  jsonb_build_object(
    'source', 'whatsapp_v1',
    'human_reason', l.human_reason,
    'backfilled', true
  )
from public.leads l
left join public.contacts c on c.id = l.contact_id
where l.human_required is true
  and l.human_reason = 'whatsapp_v1_ready_for_handoff'
  and not exists (
    select 1
      from public.tasks t
     where t.lead_id = l.id
       and t.automation_key = 'whatsapp-v1-human-handoff'
       and t.status <> 'cancelled'
  );
