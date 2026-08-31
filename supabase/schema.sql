-- Lokhit Newsroom database foundation
-- Run this migration in Supabase SQL Editor.

create extension if not exists pgcrypto;

do $$ begin
  create type public.user_role as enum ('admin', 'editor', 'reporter');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.news_status as enum ('draft', 'submitted', 'in_review', 'approved', 'rejected', 'published');
exception when duplicate_object then null; end $$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  email text,
  role public.user_role not null default 'reporter',
  avatar_url text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  slug text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.news (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text unique,
  excerpt text,
  content text not null default '',
  location text,
  category_id uuid references public.categories(id) on delete set null,
  featured_image_url text,
  status public.news_status not null default 'draft',
  author_id uuid references public.profiles(id) on delete set null,
  editor_id uuid references public.profiles(id) on delete set null,
  wordpress_post_id bigint,
  wordpress_url text,
  rejection_reason text,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.news_images (
  id uuid primary key default gen_random_uuid(),
  news_id uuid not null references public.news(id) on delete cascade,
  storage_path text not null,
  public_url text,
  alt_text text,
  is_featured boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists news_status_idx on public.news(status);
create index if not exists news_author_idx on public.news(author_id);
create index if not exists news_category_idx on public.news(category_id);
create index if not exists news_created_idx on public.news(created_at desc);

insert into public.categories (name, slug) values
  ('राजकारण', 'politics'),
  ('स्थानिक', 'local'),
  ('शिक्षण', 'education'),
  ('क्रीडा', 'sports'),
  ('मनोरंजन', 'entertainment'),
  ('महाराष्ट्र', 'maharashtra'),
  ('देश', 'india')
on conflict (slug) do nothing;

alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.news enable row level security;
alter table public.news_images enable row level security;

-- Helper: current user's role.
create or replace function public.current_user_role()
returns public.user_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

-- New users receive a profile. Default role is reporter.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', ''), new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

-- Profiles: users can read their own profile; admins/editors can read all profiles.
drop policy if exists "profiles_select_own_or_staff" on public.profiles;
create policy "profiles_select_own_or_staff" on public.profiles
for select to authenticated
using (id = auth.uid() or public.current_user_role() in ('admin', 'editor'));

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
for update to authenticated
using (id = auth.uid())
with check (id = auth.uid());

-- Categories are readable by authenticated users; staff can manage them.
drop policy if exists "categories_select_authenticated" on public.categories;
create policy "categories_select_authenticated" on public.categories
for select to authenticated using (true);

drop policy if exists "categories_manage_staff" on public.categories;
create policy "categories_manage_staff" on public.categories
for all to authenticated
using (public.current_user_role() in ('admin', 'editor'))
with check (public.current_user_role() in ('admin', 'editor'));

-- News visibility and workflow permissions.
drop policy if exists "news_select_staff_or_own" on public.news;
create policy "news_select_staff_or_own" on public.news
for select to authenticated
using (
  author_id = auth.uid()
  or public.current_user_role() in ('admin', 'editor')
);

drop policy if exists "news_insert_authenticated" on public.news;
create policy "news_insert_authenticated" on public.news
for insert to authenticated
with check (
  author_id = auth.uid()
  or public.current_user_role() in ('admin', 'editor')
);

drop policy if exists "news_update_own_draft_or_staff" on public.news;
create policy "news_update_own_draft_or_staff" on public.news
for update to authenticated
using (
  (author_id = auth.uid() and status in ('draft', 'rejected'))
  or public.current_user_role() in ('admin', 'editor')
)
with check (
  (author_id = auth.uid() and status in ('draft', 'submitted', 'rejected'))
  or public.current_user_role() in ('admin', 'editor')
);

drop policy if exists "news_delete_own_draft_or_admin" on public.news;
create policy "news_delete_own_draft_or_admin" on public.news
for delete to authenticated
using (
  (author_id = auth.uid() and status = 'draft')
  or public.current_user_role() = 'admin'
);

-- Images follow the news record's permissions.
drop policy if exists "news_images_select" on public.news_images;
create policy "news_images_select" on public.news_images
for select to authenticated
using (
  exists (
    select 1 from public.news n
    where n.id = news_id
      and (n.author_id = auth.uid() or public.current_user_role() in ('admin', 'editor'))
  )
);

drop policy if exists "news_images_manage" on public.news_images;
create policy "news_images_manage" on public.news_images
for all to authenticated
using (
  exists (
    select 1 from public.news n
    where n.id = news_id
      and (n.author_id = auth.uid() or public.current_user_role() in ('admin', 'editor'))
  )
)
with check (
  exists (
    select 1 from public.news n
    where n.id = news_id
      and (n.author_id = auth.uid() or public.current_user_role() in ('admin', 'editor'))
  )
);
