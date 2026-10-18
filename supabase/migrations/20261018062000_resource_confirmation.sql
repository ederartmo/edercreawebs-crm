begin;
alter table public.resource_subscribers
  add column subscription_id uuid not null default gen_random_uuid(),
  add column confirmed_at timestamptz,
  add column confirmation_requested_at timestamptz,
  add column confirmation_email_sent_at timestamptz,
  add constraint resource_subscribers_subscription_id_key unique (subscription_id);

create function public.resource_prepare_confirmation(p_email text)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare s public.resource_subscribers%rowtype;
begin
  select * into s from public.resource_subscribers where email=p_email for update;
  if not found then raise exception 'subscription_unavailable'; end if;
  if s.unsubscribed_at is not null or s.confirmed_at is not null then
    return jsonb_build_object('send', false);
  end if;
  if s.confirmation_requested_at is null or s.confirmation_requested_at <= now()-interval '24 hours' then
    update public.resource_subscribers
      set confirmation_requested_at=date_trunc('second',now()), confirmation_email_sent_at=null
      where email=p_email returning * into s;
  end if;
  return jsonb_build_object('send',s.confirmation_email_sent_at is null,
    'id',s.subscription_id,'issued_at',s.confirmation_requested_at);
end $$;

create function public.resource_confirm_subscription(p_id uuid, p_issued_at timestamptz)
returns boolean language plpgsql security invoker set search_path = '' as $$
declare s public.resource_subscribers%rowtype;
begin
  select * into s from public.resource_subscribers where subscription_id=p_id for update;
  if not found or s.unsubscribed_at is not null or s.confirmation_requested_at is distinct from p_issued_at then return false; end if;
  if s.confirmed_at is not null then return true; end if;
  if p_issued_at < now()-interval '24 hours' or p_issued_at > now()+interval '1 minute' then return false; end if;
  update public.resource_subscribers set confirmed_at=now() where subscription_id=p_id;
  return true;
end $$;

revoke all on function public.resource_prepare_confirmation(text) from public,anon,authenticated;
revoke all on function public.resource_confirm_subscription(uuid,timestamptz) from public,anon,authenticated;
grant execute on function public.resource_prepare_confirmation(text) to service_role;
grant execute on function public.resource_confirm_subscription(uuid,timestamptz) to service_role;

comment on column public.resource_subscribers.confirmed_at is
  'Send future resource announcements only when confirmed_at is not null and unsubscribed_at is null. Existing subscribers are not auto-confirmed.';
commit;
