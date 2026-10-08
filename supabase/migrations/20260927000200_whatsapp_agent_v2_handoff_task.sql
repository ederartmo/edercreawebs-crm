create or replace function public.ensure_whatsapp_handoff_task()
returns trigger
language plpgsql
as $$
declare
  contact_name text;
  task_automation_key text;
  task_source text;
begin
  if new.human_required is true
     and new.human_reason in (
       'whatsapp_v1_ready_for_handoff',
       'whatsapp_agent_v2_ready_for_handoff'
     ) then

    select c.full_name
      into contact_name
      from public.contacts c
     where c.id = new.contact_id;

    task_automation_key := case
      when new.human_reason = 'whatsapp_agent_v2_ready_for_handoff'
        then 'whatsapp-agent-v2-human-handoff'
      else 'whatsapp-v1-human-handoff'
    end;

    task_source := case
      when new.human_reason = 'whatsapp_agent_v2_ready_for_handoff'
        then 'whatsapp_agent_v2'
      else 'whatsapp_v1'
    end;

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
      'Lead preparado por WhatsApp. Negocio/adquisición: '
        || coalesce(nullif(new.what_sells, ''), 'Pendiente')
        || '. Proceso comercial: '
        || coalesce(nullif(new.how_sells, ''), 'Pendiente')
        || '.',
      'pending',
      'high',
      now(),
      task_automation_key,
      'system',
      jsonb_build_object(
        'source', task_source,
        'human_reason', new.human_reason
      )
    where not exists (
      select 1
        from public.tasks t
       where t.lead_id = new.id
         and t.automation_key = task_automation_key
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
