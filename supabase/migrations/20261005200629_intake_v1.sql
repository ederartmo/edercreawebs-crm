-- LOCAL REVIEW ONLY. No enum changes, backfill, pricing or generation.
begin;
-- Web can finish with email only. A typed WhatsApp is not transport-verified yet.
alter table public.contacts alter column phone drop not null;
alter table public.leads add column intake jsonb not null default '{}'::jsonb
  check (jsonb_typeof(intake) = 'object' and octet_length(intake::text) <= 32000);

-- Staging only: linked answers move to their existing CRM columns and are cleared.
create table public.intake_sessions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id),
  token_hash text not null unique check (token_hash ~ '^[a-f0-9]{64}$'),
  continuation_hash text unique check (continuation_hash ~ '^[a-f0-9]{64}$'),
  continuation_expires_at timestamptz,
  lead_id uuid references public.leads(id),
  materialized_at timestamptz,
  continuation_claimed_phone text,
  answers jsonb not null default '{}' check (jsonb_typeof(answers) = 'object' and octet_length(answers::text) <= 24000),
  first_touch jsonb not null default '{}' check (jsonb_typeof(first_touch) = 'object' and octet_length(first_touch::text) <= 6000),
  intake_version integer not null default 1 check (intake_version = 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '30 days'
);
alter table public.intake_sessions enable row level security;
revoke all on public.intake_sessions from public, anon, authenticated;
grant select, insert, update, delete on public.intake_sessions to service_role;
create index intake_sessions_owner_created on public.intake_sessions(owner_id,created_at);

-- Coarse durable abuse ceiling across workers; edge/IP limits should complement it.
create function public.intake_create_session(p_owner uuid,p_hash text,p_attribution jsonb)
returns void language plpgsql security invoker set search_path = '' as $$
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_owner::text,7));
  if (select count(*) from public.intake_sessions where owner_id=p_owner and created_at>now()-interval '1 hour') >= 100 then
    raise exception 'intake_rate_limited';
  end if;
  insert into public.intake_sessions(owner_id,token_hash,first_touch) values(p_owner,p_hash,p_attribution);
end;
$$;
revoke all on function public.intake_create_session(uuid,text,jsonb) from public, anon, authenticated;
grant execute on function public.intake_create_session(uuid,text,jsonb) to service_role;

-- Internal service-only, invoker rights. Row locks serialize web/WA writes.
-- Fill-only: CRM values, including false booleans, always win.
create function public.intake_apply_lead(p_owner uuid, p_lead uuid, p_answers jsonb, p_attribution jsonb)
returns void language plpgsql security invoker set search_path = '' as $$
declare
  l public.leads%rowtype;
  b uuid;
  extras jsonb;
begin
  select * into strict l from public.leads where id=p_lead and owner_id=p_owner for update;
  if jsonb_typeof(p_answers) <> 'object' or octet_length(p_answers::text)>24000
    or jsonb_typeof(p_attribution) <> 'object' or octet_length(p_attribution::text)>6000 then
    raise exception 'invalid_intake';
  end if;
  if p_answers ? 'budget_range' and p_answers->>'budget_range' not in ('menos_de_15k','15k_20k','20k_35k','35k_50k','50k_plus') then
    raise exception 'invalid_budget_range';
  end if;
  update public.contacts set
    full_name=coalesce(nullif(btrim(full_name),''),nullif(p_answers->>'name','')),
    email=coalesce(nullif(btrim(email),''),nullif(p_answers->>'email',''))
  where id=l.contact_id and owner_id=p_owner;
  -- Phone is transport identity and is never replaced by model/browser input.
  b := l.business_id;
  if b is null then
    select business_id into b from public.contacts where id=l.contact_id and owner_id=p_owner;
  end if;
  if b is null and (p_answers ?| array['business_name','instagram','facebook','tiktok','website','google_business']) then
    insert into public.businesses(owner_id) values(p_owner) returning id into b;
  end if;
  if b is not null then
    perform 1 from public.businesses where id=b and owner_id=p_owner for update;
    if not found then raise exception 'business_owner_mismatch'; end if;
    update public.businesses set
      name=coalesce(nullif(btrim(name),''),nullif(p_answers->>'business_name','')),
      instagram_url=coalesce(nullif(btrim(instagram_url),''),nullif(p_answers->>'instagram','')),
      facebook_url=coalesce(nullif(btrim(facebook_url),''),nullif(p_answers->>'facebook','')),
      tiktok_url=coalesce(nullif(btrim(tiktok_url),''),nullif(p_answers->>'tiktok','')),
      website=coalesce(nullif(btrim(website),''),nullif(p_answers->>'website','')),
      google_business_url=coalesce(nullif(btrim(google_business_url),''),nullif(p_answers->>'google_business',''))
    where id=b and owner_id=p_owner;
  end if;
  select coalesce(jsonb_object_agg(key,value),'{}'::jsonb) into extras
    from jsonb_each(p_answers)
    where key in ('customer_acquisition','budget_range','timing','no_digital_presence','other_reference','project_interest')
      and value <> 'null'::jsonb and value <> '""'::jsonb;
  if nullif(p_answers->>'whatsapp','') is not null and exists (
    select 1 from public.contacts where id=l.contact_id and owner_id=p_owner and phone is null
  ) then
    extras := extras || jsonb_build_object('whatsapp',p_answers->>'whatsapp');
  end if;
  update public.leads set
    business_id=b,
    what_sells=coalesce(nullif(btrim(what_sells),''),nullif(p_answers->>'what_sells','')),
    how_sells=coalesce(nullif(btrim(how_sells),''),nullif(p_answers->>'how_sells','')),
    currently_selling=coalesce(currently_selling,(p_answers->>'currently_selling')::boolean),
    main_problem=coalesce(nullif(btrim(main_problem),''),nullif(p_answers->>'main_problem','')),
    main_goal=coalesce(nullif(btrim(main_goal),''),nullif(p_answers->>'main_goal','')),
    source=coalesce(nullif(source,''),p_attribution->>'source'),
    intake=intake || jsonb_build_object(
      'intake_version',1,
      'answers',extras || coalesce(intake->'answers','{}'::jsonb),
      'provenance','user_provided',
      'last_referral',case when p_attribution ?| array['ctwa_clid','source_id']
        then p_attribution else coalesce(intake->'last_referral','{}'::jsonb) end,
      'first_touch',case when coalesce(intake->'first_touch','{}'::jsonb) <> '{}'::jsonb
        then intake->'first_touch' else p_attribution end)
  where id=p_lead and owner_id=p_owner;
end;
$$;
revoke all on function public.intake_apply_lead(uuid,uuid,jsonb,jsonb) from public, anon, authenticated;
grant execute on function public.intake_apply_lead(uuid,uuid,jsonb,jsonb) to service_role;

create function public.intake_save_session(p_owner uuid,p_hash text,p_answers jsonb)
returns void language plpgsql security invoker set search_path = '' as $$
declare s public.intake_sessions%rowtype;
begin
  select * into s from public.intake_sessions where owner_id=p_owner and token_hash=p_hash and expires_at>now() for update;
  if not found then raise exception 'session_unavailable'; end if;
  -- Repeated final submits acknowledge the completed session without editing CRM.
  if s.lead_id is not null and s.materialized_at is not null then return; end if;
  if s.lead_id is not null then raise exception 'session_unavailable'; end if;
  update public.intake_sessions set answers=p_answers || answers, updated_at=now()
    where id=s.id;
end;
$$;
revoke all on function public.intake_save_session(uuid,text,jsonb) from public, anon, authenticated;
grant execute on function public.intake_save_session(uuid,text,jsonb) to service_role;

-- Transport must verify Meta signature before invoking. No lookup/merge by typed phone alone.
create function public.intake_claim_session(p_owner uuid,p_hash text,p_lead uuid,p_phone text)
returns boolean language plpgsql security invoker set search_path = '' as $$
declare s public.intake_sessions%rowtype;
begin
  select * into s from public.intake_sessions where owner_id=p_owner and continuation_hash=p_hash
    and continuation_expires_at>now() and expires_at>now() and lead_id is null for update;
  if not found or s.answers->>'whatsapp' is distinct from p_phone then return false; end if;
  perform 1 from public.leads l join public.contacts c on c.id=l.contact_id and c.owner_id=l.owner_id
    where l.id=p_lead and l.owner_id=p_owner and c.phone=p_phone;
  if not found then return false; end if;
  perform public.intake_apply_lead(p_owner,p_lead,s.answers,s.first_touch);
  update public.intake_sessions set lead_id=p_lead, answers='{}', first_touch='{}',
    continuation_hash=null, continuation_expires_at=null,updated_at=now() where id=s.id;
  return true;
end;
$$;
revoke all on function public.intake_claim_session(uuid,text,uuid,text) from public, anon, authenticated;
grant execute on function public.intake_claim_session(uuid,text,uuid,text) to service_role;

-- Atomic handoff + conversation pause + idempotent task. No status assignment at all.
create function public.intake_handoff(p_owner uuid,p_lead uuid,p_conversation uuid,p_summary text)
returns void language plpgsql security invoker set search_path = '' as $$
begin
  perform 1 from public.leads where id=p_lead and owner_id=p_owner for update;
  if not found then raise exception 'lead_unavailable'; end if;
  if p_conversation is not null then
    update public.conversations set bot_paused=true,updated_at=now()
      where id=p_conversation and lead_id=p_lead and owner_id=p_owner;
    if not found then raise exception 'conversation_unavailable'; end if;
  end if;
  update public.leads set human_required=true,human_reason='intake_v1_ready_for_quote',bot_mode='paused',
    intake=intake || jsonb_build_object('ready_for_quote',true,'readiness_evaluated_at',now()),
    conversation_summary=left(p_summary,16000) where id=p_lead and owner_id=p_owner;
  insert into public.tasks(owner_id,lead_id,type,title,description,priority,due_at,automation_key,metadata)
    select p_owner,p_lead,'seguimiento','Revisar proyecto y preparar cotización',left(p_summary,16000),'high',
      now(),'intake-v1-ready-for-quote','{"source":"intake_v1"}'::jsonb
    where not exists(select 1 from public.tasks where lead_id=p_lead and automation_key='intake-v1-ready-for-quote' and status<>'cancelled');
end;
$$;
revoke all on function public.intake_handoff(uuid,uuid,uuid,text) from public, anon, authenticated;
grant execute on function public.intake_handoff(uuid,uuid,uuid,text) to service_role;

-- Called ONLY after the server's pure evaluator returns ready. Compare the exact
-- evaluated snapshot under lock, so stale evaluations cannot materialize new data.
create function public.intake_materialize_session(p_owner uuid,p_hash text,p_expected_answers jsonb,p_summary text)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare s public.intake_sessions%rowtype; c uuid; l uuid;
begin
  select * into s from public.intake_sessions where owner_id=p_owner and token_hash=p_hash and expires_at>now() for update;
  if not found then raise exception 'session_unavailable'; end if;
  if s.lead_id is not null then return s.lead_id; end if;
  if s.answers is distinct from p_expected_answers then return null; end if;
  -- Never match a pre-existing contact by unverified browser phone/email.
  insert into public.contacts(owner_id,full_name,email,preferred_channel)
    values(p_owner,s.answers->>'name',s.answers->>'email','web') returning id into c;
  insert into public.leads(owner_id,contact_id,source,intake)
    values(p_owner,c,s.first_touch->>'source',jsonb_build_object('entry_channel','web','submitted_contact_id',c)) returning id into l;
  perform public.intake_apply_lead(p_owner,l,s.answers,s.first_touch);
  perform public.intake_handoff(p_owner,l,null,p_summary);
  update public.intake_sessions set lead_id=l,materialized_at=now(),answers='{}',first_touch='{}',updated_at=now() where id=s.id;
  return l;
end;
$$;
revoke all on function public.intake_materialize_session(uuid,text,jsonb,text) from public, anon, authenticated;
grant execute on function public.intake_materialize_session(uuid,text,jsonb,text) to service_role;

create function public.intake_issue_continuation(p_owner uuid,p_hash text,p_code_hash text)
returns void language plpgsql security invoker set search_path = '' as $$
declare s public.intake_sessions%rowtype;
begin
  select * into s from public.intake_sessions where owner_id=p_owner and token_hash=p_hash and expires_at>now() for update;
  if not found then raise exception 'session_unavailable'; end if;
  if s.lead_id is null and nullif(s.answers->>'whatsapp','') is null then raise exception 'continuation_requires_phone'; end if;
  -- A session may grant continuity to its own web-created lead, never CRM reads/edits.
  if s.lead_id is not null and s.materialized_at is null then raise exception 'session_unavailable'; end if;
  update public.intake_sessions set continuation_hash=p_code_hash,continuation_expires_at=now()+interval '1 day',
    continuation_claimed_phone=null where id=s.id;
end;
$$;
revoke all on function public.intake_issue_continuation(uuid,text,text) from public, anon, authenticated;
grant execute on function public.intake_issue_continuation(uuid,text,text) to service_role;

-- Resolve BEFORE webhook get-or-create. Both finalization and continuity lock the
-- same session first, including partial sessions, avoiding a cross-channel race.
create function public.intake_resolve_continuation(p_owner uuid,p_hash text,p_phone text)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare
  s public.intake_sessions%rowtype; l public.leads%rowtype;
  c public.contacts%rowtype; previous_contact public.contacts%rowtype;
  expected_phone text;
begin
  if p_phone is null or p_phone !~ '^[1-9][0-9]{7,14}$' then return null; end if;
  select * into s from public.intake_sessions where owner_id=p_owner and continuation_hash=p_hash
    and continuation_expires_at>now() and expires_at>now() for update;
  if not found then return null; end if;
  if s.continuation_claimed_phone is not null and s.continuation_claimed_phone<>p_phone then return null; end if;
  if s.lead_id is not null then
    select * into strict l from public.leads where id=s.lead_id and owner_id=p_owner for update;
    select * into strict previous_contact from public.contacts where id=l.contact_id and owner_id=p_owner;
    expected_phone := coalesce(previous_contact.phone,l.intake->'answers'->>'whatsapp');
    -- Email-only web: capability + signed sender establishes the first WA identity.
    if expected_phone is not null and expected_phone<>p_phone then return null; end if;
    if expected_phone is null and s.materialized_at is null then return null; end if;
  elsif s.answers->>'whatsapp' is distinct from p_phone then return null;
  end if;
  -- Serializes our own transport claims; UNIQUE also arbitrates legacy webhook inserts.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_owner::text||p_phone,8));
  if s.lead_id is not null and previous_contact.phone is null then
    begin
      update public.contacts set phone=p_phone where id=previous_contact.id and owner_id=p_owner;
      c := previous_contact;
      c.phone := p_phone;
    exception when unique_violation then
      select * into strict c from public.contacts where owner_id=p_owner and phone=p_phone;
      -- Verified phone owns this identity. Preserve existing facts; retain the
      -- original web contact for human reconciliation rather than deleting CRM data.
      update public.leads set contact_id=c.id where id=l.id and owner_id=p_owner;
      update public.contacts set full_name=coalesce(nullif(btrim(full_name),''),previous_contact.full_name),
        email=coalesce(nullif(btrim(email),''),previous_contact.email) where id=c.id and owner_id=p_owner;
    end;
  else
    insert into public.contacts(owner_id,phone,preferred_channel) values(p_owner,p_phone,'whatsapp')
      on conflict(owner_id,phone) do nothing;
    select * into strict c from public.contacts where owner_id=p_owner and phone=p_phone;
  end if;
  if s.lead_id is null then
    select * into l from public.leads where owner_id=p_owner and contact_id=c.id
      and status not in ('entregado','perdido') order by created_at desc limit 1 for update;
    if not found then
      insert into public.leads(owner_id,contact_id,source) values(p_owner,c.id,'whatsapp_cloud') returning * into l;
    end if;
    perform public.intake_apply_lead(p_owner,l.id,s.answers,s.first_touch);
    update public.intake_sessions set lead_id=l.id,answers='{}',first_touch='{}' where id=s.id;
  end if;
  update public.leads set intake=jsonb_set(intake,'{answers}',coalesce(intake->'answers','{}')-'whatsapp')
    || jsonb_build_object('last_channel','whatsapp','whatsapp_verified_at',now()) where id=l.id and owner_id=p_owner;
  update public.intake_sessions set continuation_claimed_phone=p_phone,updated_at=now() where id=s.id;
  -- Same sender may replay until expiry for retry safety; another sender cannot claim.
  return l.id;
end;
$$;
revoke all on function public.intake_resolve_continuation(uuid,text,text) from public, anon, authenticated;
grant execute on function public.intake_resolve_continuation(uuid,text,text) to service_role;
commit;
