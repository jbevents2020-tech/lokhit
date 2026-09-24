-- Additive migration: no existing news/profile data or policies are removed.
begin;

-- Existing own-profile policy permits all columns. Notification audience decisions
-- require roles/activation to remain controlled by the server-side admin API.
create function public.guard_push_identity() returns trigger
language plpgsql set search_path = '' as $$
begin
  if current_user = 'authenticated' then
    if tg_table_name = 'profiles' then
      if new.role is distinct from old.role or new.is_active is distinct from old.is_active then
        raise exception 'Role and activation changes require the admin API';
      end if;
    else
      if tg_op = 'UPDATE' and new.author_id is distinct from old.author_id then
        raise exception 'Original news author cannot change';
      end if;
      if tg_op = 'INSERT' and public.current_user_role() = 'reporter'
        and new.status not in ('draft','submitted') then
        raise exception 'Reporters may only create drafts or submissions';
      end if;
    end if;
  end if;
  return new;
end $$;
create trigger push_profile_identity_guard before update on public.profiles
for each row execute function public.guard_push_identity();
create trigger push_author_identity_guard before insert or update on public.news
for each row execute function public.guard_push_identity();

create table public.device_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  installation_id uuid not null unique,
  fcm_token text not null unique check (length(fcm_token) between 20 and 4096),
  updated_at timestamptz not null default now()
);
alter table public.device_tokens enable row level security;
revoke all on public.device_tokens from anon, authenticated;
grant all on public.device_tokens to service_role;

-- Clients never read tokens, supply user ids, or reassign another user's device.
-- On account change the client must unregister/delete its FCM token first.
create function public.register_push_device(p_installation_id uuid, p_token text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or not exists (
    select 1 from public.profiles where id = auth.uid() and is_active
  ) then raise exception 'Active authentication required'; end if;
  if exists (select 1 from public.device_tokens where
    (installation_id = p_installation_id or fcm_token = p_token) and user_id <> auth.uid()
  ) then raise exception 'Device must be unregistered before changing accounts'; end if;
  insert into public.device_tokens(user_id, installation_id, fcm_token)
  values (auth.uid(), p_installation_id, p_token)
  on conflict (installation_id) do update set fcm_token = excluded.fcm_token, updated_at = now()
  where public.device_tokens.user_id = auth.uid();
end $$;
create function public.unregister_push_device(p_installation_id uuid)
returns void language sql security definer set search_path = '' as $$
  delete from public.device_tokens where installation_id = p_installation_id and user_id = auth.uid();
$$;
revoke all on function public.register_push_device(uuid,text), public.unregister_push_device(uuid) from public, anon;
grant execute on function public.register_push_device(uuid,text), public.unregister_push_device(uuid) to authenticated;

-- One durable delivery per event and device. SKIP LOCKED leases prevent concurrent sends.
create table public.push_deliveries (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null,
  news_id uuid not null references public.news(id) on delete cascade,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  device_id uuid not null references public.device_tokens(id) on delete cascade,
  audience text not null check (audience in ('staff','admin','author')),
  headline text not null,
  context text not null,
  news_status text not null,
  created_at timestamptz not null default now(),
  available_at timestamptz not null default now(),
  attempts integer not null default 0,
  lease_id uuid,
  completed_at timestamptz,
  last_error text,
  unique (event_id, device_id)
);
alter table public.push_deliveries enable row level security;
revoke all on public.push_deliveries from anon, authenticated;
grant all on public.push_deliveries to service_role;
create index push_deliveries_pending on public.push_deliveries(available_at) where completed_at is null;

create function public.enqueue_news_push() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := auth.uid();
  actor_role text;
  changed boolean;
  target_audience text;
  event uuid := gen_random_uuid();
begin
  select role::text into actor_role from public.profiles where id = actor and is_active;
  -- Service-role publishers have no user JWT: classify submission by the author.
  if actor is null then
    select role::text into actor_role from public.profiles where id = new.author_id and is_active;
  end if;
  changed := tg_op = 'INSERT';
  if tg_op = 'UPDATE' then changed := old.status is distinct from new.status; end if;
  if changed and new.status = 'submitted' then
    target_audience := case when actor_role = 'editor' then 'admin' else 'staff' end;
  elsif changed and new.status in ('approved','rejected','published') then
    target_audience := 'author';
  elsif tg_op = 'UPDATE' and actor_role = 'editor' and new.status in ('submitted','in_review','approved') then
    if row(old.title,old.content,old.excerpt,old.status) is distinct from row(new.title,new.content,new.excerpt,new.status) then
      target_audience := 'admin';
    end if;
  end if;
  if target_audience is null then return new; end if;
  insert into public.push_deliveries(event_id,news_id,recipient_id,device_id,audience,headline,context,news_status)
  select event,new.id,p.id,d.id,target_audience,left(new.title,160),
    coalesce(actor_role,'Newsroom') || ' · ' || new.status::text,new.status::text
  from public.profiles p join public.device_tokens d on d.user_id = p.id
  where p.is_active and d.updated_at > now() - interval '60 days'
    and (target_audience = 'author' and p.id = new.author_id
      or target_audience = 'staff' and p.role in ('editor','admin') and p.id is distinct from actor
      or target_audience = 'admin' and p.role = 'admin' and p.id is distinct from actor);
  -- Editor approval both informs the author and hands off to Admin for publishing.
  if changed and new.status = 'approved' and actor_role = 'editor' then
    insert into public.push_deliveries(event_id,news_id,recipient_id,device_id,audience,headline,context,news_status)
    select event,new.id,p.id,d.id,'admin',left(new.title,160),'editor · approved',new.status::text
    from public.profiles p join public.device_tokens d on d.user_id = p.id
    where p.is_active and p.role = 'admin' and p.id is distinct from actor
      and d.updated_at > now() - interval '60 days'
    on conflict (event_id,device_id) do nothing;
  end if;
  return new;
end $$;
revoke all on function public.enqueue_news_push() from public, anon, authenticated;
create trigger news_push_after_write after insert or update on public.news
for each row execute function public.enqueue_news_push();

create function public.claim_push_deliveries() returns setof public.push_deliveries
language sql security definer set search_path = '' as $$
  update public.push_deliveries d set lease_id = gen_random_uuid(),
    available_at = now() + interval '5 minutes', attempts = attempts + 1
  where d.id in (
    select id from public.push_deliveries
    where completed_at is null and available_at <= now() and attempts < 8
    order by available_at for update skip locked limit 20
  ) returning d.*;
$$;
revoke all on function public.claim_push_deliveries() from public, anon, authenticated;
grant execute on function public.claim_push_deliveries() to service_role;
commit;
