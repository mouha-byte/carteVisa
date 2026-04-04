-- carteVisite: Supabase schema (backend-first)
-- Run this in the Supabase SQL Editor.

begin;

create extension if not exists pgcrypto;
create extension if not exists citext;

-- Enums
do $$
begin
  if not exists (select 1 from pg_type where typname = 'user_role') then
    create type public.user_role as enum ('visitor', 'entreprise', 'super_admin');
  end if;

  if not exists (select 1 from pg_type where typname = 'company_status') then
    create type public.company_status as enum ('pending', 'active', 'inactive', 'rejected');
  end if;

  if not exists (select 1 from pg_type where typname = 'job_status') then
    create type public.job_status as enum ('draft', 'published', 'closed');
  end if;

  if not exists (select 1 from pg_type where typname = 'application_status') then
    create type public.application_status as enum ('pending', 'shortlisted', 'rejected', 'hired');
  end if;

  if not exists (select 1 from pg_type where typname = 'request_status') then
    create type public.request_status as enum ('new', 'in_progress', 'closed');
  end if;

  if not exists (select 1 from pg_type where typname = 'email_status') then
    create type public.email_status as enum ('queued', 'sent', 'failed');
  end if;

  if not exists (select 1 from pg_type where typname = 'ad_slot') then
    create type public.ad_slot as enum ('primary', 'secondary');
  end if;

  if not exists (select 1 from pg_type where typname = 'ad_media_type') then
    create type public.ad_media_type as enum ('image', 'video');
  end if;
end
$$;

-- Core tables
create table if not exists public.companies (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete restrict,
  name text not null,
  slug text not null unique,
  sector text,
  description text,
  address text,
  city text,
  country text,
  phone text,
  email citext,
  website_url text,
  logo_url text,
  cover_url text,
  status public.company_status not null default 'pending',
  is_featured boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role public.user_role not null default 'visitor',
  company_id uuid references public.companies(id) on delete set null,
  full_name text,
  phone text,
  avatar_url text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint categories_name_unique unique (name)
);

create table if not exists public.company_categories (
  company_id uuid not null references public.companies(id) on delete cascade,
  category_id uuid not null references public.categories(id) on delete restrict,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (company_id, category_id)
);

create table if not exists public.job_offers (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  title text not null,
  description text not null,
  contract_type text,
  location_city text,
  salary_min numeric,
  salary_max numeric,
  is_remote boolean not null default false,
  status public.job_status not null default 'draft',
  published_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint salary_range_check check (
    salary_min is null or salary_max is null or salary_min <= salary_max
  )
);

create table if not exists public.applications (
  id uuid primary key default gen_random_uuid(),
  job_offer_id uuid not null references public.job_offers(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  candidate_name text not null,
  candidate_email citext not null,
  candidate_phone text,
  cover_letter text,
  cv_path text not null,
  cv_file_name text,
  status public.application_status not null default 'pending',
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.company_services (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  title text not null,
  description text,
  price_label text,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.company_news (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  title text not null,
  content text not null,
  image_url text,
  is_published boolean not null default true,
  published_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.contact_messages (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  email citext not null,
  phone text,
  message text not null,
  is_handled boolean not null default false,
  handled_by uuid references auth.users(id) on delete set null,
  handled_at timestamptz,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.website_creation_requests (
  id uuid primary key default gen_random_uuid(),
  company_name text not null,
  sector text,
  contact_name text not null,
  email citext not null,
  phone text,
  needs text not null,
  status public.request_status not null default 'new',
  admin_notes text,
  handled_by uuid references auth.users(id) on delete set null,
  handled_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.ad_campaigns (
  id uuid primary key default gen_random_uuid(),
  slot public.ad_slot not null,
  media_type public.ad_media_type not null,
  media_url text not null,
  target_url text,
  starts_at timestamptz,
  ends_at timestamptz,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.platform_settings (
  id bigint generated by default as identity primary key,
  youtube_channel_url text,
  contact_email citext,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.email_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null,
  recipient_email citext not null,
  status public.email_status not null default 'queued',
  provider_message_id text,
  payload jsonb not null default '{}'::jsonb,
  error_message text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

-- Indexes
create index if not exists idx_profiles_role on public.profiles(role);
create index if not exists idx_profiles_company_id on public.profiles(company_id);

create index if not exists idx_companies_status on public.companies(status);
create index if not exists idx_companies_owner_user_id on public.companies(owner_user_id);
create index if not exists idx_companies_city on public.companies(city);
create index if not exists idx_companies_search
  on public.companies
  using gin (to_tsvector('simple', coalesce(name, '') || ' ' || coalesce(sector, '') || ' ' || coalesce(city, '')));

create index if not exists idx_job_offers_company_id on public.job_offers(company_id);
create index if not exists idx_job_offers_status on public.job_offers(status);
create index if not exists idx_job_offers_location_city on public.job_offers(location_city);
create index if not exists idx_job_offers_search
  on public.job_offers
  using gin (to_tsvector('simple', coalesce(title, '') || ' ' || coalesce(description, '') || ' ' || coalesce(location_city, '')));

create index if not exists idx_applications_job_offer_id on public.applications(job_offer_id);
create index if not exists idx_applications_company_id on public.applications(company_id);
create index if not exists idx_applications_status on public.applications(status);
create index if not exists idx_applications_candidate_email on public.applications(candidate_email);

create index if not exists idx_company_services_company_id on public.company_services(company_id);
create index if not exists idx_company_news_company_id on public.company_news(company_id);
create index if not exists idx_contact_messages_created_at on public.contact_messages(created_at desc);
create index if not exists idx_website_creation_requests_status on public.website_creation_requests(status);
create index if not exists idx_ad_campaigns_slot_active on public.ad_campaigns(slot, is_active);
create index if not exists idx_email_events_status on public.email_events(status);

-- Generic updated_at trigger
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists trg_companies_set_updated_at on public.companies;
create trigger trg_companies_set_updated_at
before update on public.companies
for each row execute function public.set_updated_at();

drop trigger if exists trg_profiles_set_updated_at on public.profiles;
create trigger trg_profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists trg_categories_set_updated_at on public.categories;
create trigger trg_categories_set_updated_at
before update on public.categories
for each row execute function public.set_updated_at();

drop trigger if exists trg_job_offers_set_updated_at on public.job_offers;
create trigger trg_job_offers_set_updated_at
before update on public.job_offers
for each row execute function public.set_updated_at();

drop trigger if exists trg_applications_set_updated_at on public.applications;
create trigger trg_applications_set_updated_at
before update on public.applications
for each row execute function public.set_updated_at();

drop trigger if exists trg_company_services_set_updated_at on public.company_services;
create trigger trg_company_services_set_updated_at
before update on public.company_services
for each row execute function public.set_updated_at();

drop trigger if exists trg_company_news_set_updated_at on public.company_news;
create trigger trg_company_news_set_updated_at
before update on public.company_news
for each row execute function public.set_updated_at();

drop trigger if exists trg_website_creation_requests_set_updated_at on public.website_creation_requests;
create trigger trg_website_creation_requests_set_updated_at
before update on public.website_creation_requests
for each row execute function public.set_updated_at();

drop trigger if exists trg_ad_campaigns_set_updated_at on public.ad_campaigns;
create trigger trg_ad_campaigns_set_updated_at
before update on public.ad_campaigns
for each row execute function public.set_updated_at();

drop trigger if exists trg_platform_settings_set_updated_at on public.platform_settings;
create trigger trg_platform_settings_set_updated_at
before update on public.platform_settings
for each row execute function public.set_updated_at();

drop trigger if exists trg_email_events_set_updated_at on public.email_events;
create trigger trg_email_events_set_updated_at
before update on public.email_events
for each row execute function public.set_updated_at();

-- Auth helper functions
create or replace function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'super_admin'
  );
$$;

create or replace function public.current_company_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select p.company_id
  from public.profiles p
  where p.id = auth.uid()
  limit 1;
$$;

revoke all on function public.is_super_admin() from public;
grant execute on function public.is_super_admin() to anon, authenticated;

revoke all on function public.current_company_id() from public;
grant execute on function public.current_company_id() to anon, authenticated;

-- Guard sensitive profile fields for non-admin users
create or replace function public.guard_profile_sensitive_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    return new;
  end if;

  if public.is_super_admin() then
    return new;
  end if;

  if old.id <> auth.uid() then
    raise exception 'You can update only your own profile';
  end if;

  new.role := old.role;
  new.company_id := old.company_id;
  return new;
end;
$$;

drop trigger if exists trg_profiles_guard_sensitive_fields on public.profiles;
create trigger trg_profiles_guard_sensitive_fields
before update on public.profiles
for each row execute function public.guard_profile_sensitive_fields();

-- Auto-create profile when a new auth user signs up
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    'visitor'
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_auth_user();

-- RLS
alter table public.companies enable row level security;
alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.company_categories enable row level security;
alter table public.job_offers enable row level security;
alter table public.applications enable row level security;
alter table public.company_services enable row level security;
alter table public.company_news enable row level security;
alter table public.contact_messages enable row level security;
alter table public.website_creation_requests enable row level security;
alter table public.ad_campaigns enable row level security;
alter table public.platform_settings enable row level security;
alter table public.email_events enable row level security;

-- profiles
drop policy if exists profiles_select_self_or_admin on public.profiles;
create policy profiles_select_self_or_admin
on public.profiles
for select
using (id = auth.uid() or public.is_super_admin());

drop policy if exists profiles_insert_self_or_admin on public.profiles;
create policy profiles_insert_self_or_admin
on public.profiles
for insert
with check (id = auth.uid() or public.is_super_admin());

drop policy if exists profiles_update_self_or_admin on public.profiles;
create policy profiles_update_self_or_admin
on public.profiles
for update
using (id = auth.uid() or public.is_super_admin())
with check (id = auth.uid() or public.is_super_admin());

drop policy if exists profiles_delete_admin_only on public.profiles;
create policy profiles_delete_admin_only
on public.profiles
for delete
using (public.is_super_admin());

-- companies
drop policy if exists companies_select_public_or_owner_or_admin on public.companies;
create policy companies_select_public_or_owner_or_admin
on public.companies
for select
using (
  status = 'active'
  or owner_user_id = auth.uid()
  or public.is_super_admin()
  or exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.company_id = companies.id
  )
);

drop policy if exists companies_insert_owner_or_admin on public.companies;
create policy companies_insert_owner_or_admin
on public.companies
for insert
with check (owner_user_id = auth.uid() or public.is_super_admin());

drop policy if exists companies_update_owner_or_admin on public.companies;
create policy companies_update_owner_or_admin
on public.companies
for update
using (
  owner_user_id = auth.uid()
  or public.is_super_admin()
  or exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.company_id = companies.id
  )
)
with check (
  owner_user_id = auth.uid()
  or public.is_super_admin()
  or exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.company_id = companies.id
  )
);

drop policy if exists companies_delete_owner_or_admin on public.companies;
create policy companies_delete_owner_or_admin
on public.companies
for delete
using (owner_user_id = auth.uid() or public.is_super_admin());

-- categories
drop policy if exists categories_select_active_or_admin on public.categories;
create policy categories_select_active_or_admin
on public.categories
for select
using (is_active = true or public.is_super_admin());

drop policy if exists categories_write_admin_only on public.categories;
create policy categories_write_admin_only
on public.categories
for all
using (public.is_super_admin())
with check (public.is_super_admin());

-- company_categories
drop policy if exists company_categories_select_visible_company on public.company_categories;
create policy company_categories_select_visible_company
on public.company_categories
for select
using (
  exists (
    select 1
    from public.companies c
    where c.id = company_categories.company_id
      and (
        c.status = 'active'
        or c.owner_user_id = auth.uid()
        or public.is_super_admin()
      )
  )
);

drop policy if exists company_categories_write_owner_or_admin on public.company_categories;
create policy company_categories_write_owner_or_admin
on public.company_categories
for all
using (
  public.is_super_admin()
  or exists (
    select 1
    from public.companies c
    where c.id = company_categories.company_id
      and c.owner_user_id = auth.uid()
  )
)
with check (
  public.is_super_admin()
  or exists (
    select 1
    from public.companies c
    where c.id = company_categories.company_id
      and c.owner_user_id = auth.uid()
  )
);

-- job_offers
drop policy if exists job_offers_select_published_or_owner_or_admin on public.job_offers;
create policy job_offers_select_published_or_owner_or_admin
on public.job_offers
for select
using (
  status = 'published'
  or public.is_super_admin()
  or exists (
    select 1
    from public.companies c
    where c.id = job_offers.company_id
      and (
        c.owner_user_id = auth.uid()
        or exists (
          select 1
          from public.profiles p
          where p.id = auth.uid()
            and p.company_id = c.id
        )
      )
  )
);

drop policy if exists job_offers_insert_owner_or_admin on public.job_offers;
create policy job_offers_insert_owner_or_admin
on public.job_offers
for insert
with check (
  public.is_super_admin()
  or exists (
    select 1
    from public.companies c
    where c.id = job_offers.company_id
      and (
        c.owner_user_id = auth.uid()
        or exists (
          select 1
          from public.profiles p
          where p.id = auth.uid()
            and p.company_id = c.id
        )
      )
  )
);

drop policy if exists job_offers_update_owner_or_admin on public.job_offers;
create policy job_offers_update_owner_or_admin
on public.job_offers
for update
using (
  public.is_super_admin()
  or exists (
    select 1
    from public.companies c
    where c.id = job_offers.company_id
      and (
        c.owner_user_id = auth.uid()
        or exists (
          select 1
          from public.profiles p
          where p.id = auth.uid()
            and p.company_id = c.id
        )
      )
  )
)
with check (
  public.is_super_admin()
  or exists (
    select 1
    from public.companies c
    where c.id = job_offers.company_id
      and (
        c.owner_user_id = auth.uid()
        or exists (
          select 1
          from public.profiles p
          where p.id = auth.uid()
            and p.company_id = c.id
        )
      )
  )
);

drop policy if exists job_offers_delete_owner_or_admin on public.job_offers;
create policy job_offers_delete_owner_or_admin
on public.job_offers
for delete
using (
  public.is_super_admin()
  or exists (
    select 1
    from public.companies c
    where c.id = job_offers.company_id
      and c.owner_user_id = auth.uid()
  )
);

-- applications
drop policy if exists applications_select_company_or_admin on public.applications;
create policy applications_select_company_or_admin
on public.applications
for select
using (
  public.is_super_admin()
  or exists (
    select 1
    from public.companies c
    where c.id = applications.company_id
      and (
        c.owner_user_id = auth.uid()
        or exists (
          select 1
          from public.profiles p
          where p.id = auth.uid()
            and p.company_id = c.id
        )
      )
  )
);

drop policy if exists applications_insert_public on public.applications;
create policy applications_insert_public
on public.applications
for insert
to anon, authenticated
with check (
  exists (
    select 1
    from public.job_offers j
    where j.id = applications.job_offer_id
      and j.company_id = applications.company_id
      and j.status = 'published'
  )
);

drop policy if exists applications_update_company_or_admin on public.applications;
create policy applications_update_company_or_admin
on public.applications
for update
to authenticated
using (
  public.is_super_admin()
  or exists (
    select 1
    from public.companies c
    where c.id = applications.company_id
      and (
        c.owner_user_id = auth.uid()
        or exists (
          select 1
          from public.profiles p
          where p.id = auth.uid()
            and p.company_id = c.id
        )
      )
  )
)
with check (
  public.is_super_admin()
  or exists (
    select 1
    from public.companies c
    where c.id = applications.company_id
      and (
        c.owner_user_id = auth.uid()
        or exists (
          select 1
          from public.profiles p
          where p.id = auth.uid()
            and p.company_id = c.id
        )
      )
  )
);

drop policy if exists applications_delete_admin_only on public.applications;
create policy applications_delete_admin_only
on public.applications
for delete
using (public.is_super_admin());

-- company_services
drop policy if exists company_services_select_public_or_owner_or_admin on public.company_services;
create policy company_services_select_public_or_owner_or_admin
on public.company_services
for select
using (
  public.is_super_admin()
  or exists (
    select 1
    from public.companies c
    where c.id = company_services.company_id
      and (
        c.status = 'active'
        or c.owner_user_id = auth.uid()
      )
  )
);

drop policy if exists company_services_write_owner_or_admin on public.company_services;
create policy company_services_write_owner_or_admin
on public.company_services
for all
using (
  public.is_super_admin()
  or exists (
    select 1
    from public.companies c
    where c.id = company_services.company_id
      and c.owner_user_id = auth.uid()
  )
)
with check (
  public.is_super_admin()
  or exists (
    select 1
    from public.companies c
    where c.id = company_services.company_id
      and c.owner_user_id = auth.uid()
  )
);

-- company_news
drop policy if exists company_news_select_public_or_owner_or_admin on public.company_news;
create policy company_news_select_public_or_owner_or_admin
on public.company_news
for select
using (
  public.is_super_admin()
  or exists (
    select 1
    from public.companies c
    where c.id = company_news.company_id
      and (
        (company_news.is_published = true and c.status = 'active')
        or c.owner_user_id = auth.uid()
      )
  )
);

drop policy if exists company_news_write_owner_or_admin on public.company_news;
create policy company_news_write_owner_or_admin
on public.company_news
for all
using (
  public.is_super_admin()
  or exists (
    select 1
    from public.companies c
    where c.id = company_news.company_id
      and c.owner_user_id = auth.uid()
  )
)
with check (
  public.is_super_admin()
  or exists (
    select 1
    from public.companies c
    where c.id = company_news.company_id
      and c.owner_user_id = auth.uid()
  )
);

-- contact_messages
drop policy if exists contact_messages_insert_public on public.contact_messages;
create policy contact_messages_insert_public
on public.contact_messages
for insert
to anon, authenticated
with check (true);

drop policy if exists contact_messages_admin_read on public.contact_messages;
create policy contact_messages_admin_read
on public.contact_messages
for select
using (public.is_super_admin());

drop policy if exists contact_messages_admin_update on public.contact_messages;
create policy contact_messages_admin_update
on public.contact_messages
for update
using (public.is_super_admin())
with check (public.is_super_admin());

-- website_creation_requests
drop policy if exists website_requests_insert_public on public.website_creation_requests;
create policy website_requests_insert_public
on public.website_creation_requests
for insert
to anon, authenticated
with check (true);

drop policy if exists website_requests_admin_read on public.website_creation_requests;
create policy website_requests_admin_read
on public.website_creation_requests
for select
using (public.is_super_admin());

drop policy if exists website_requests_admin_update on public.website_creation_requests;
create policy website_requests_admin_update
on public.website_creation_requests
for update
using (public.is_super_admin())
with check (public.is_super_admin());

-- ad_campaigns
drop policy if exists ad_campaigns_select_active_or_admin on public.ad_campaigns;
create policy ad_campaigns_select_active_or_admin
on public.ad_campaigns
for select
using (
  public.is_super_admin()
  or (
    is_active = true
    and (starts_at is null or starts_at <= timezone('utc', now()))
    and (ends_at is null or ends_at >= timezone('utc', now()))
  )
);

drop policy if exists ad_campaigns_write_admin_only on public.ad_campaigns;
create policy ad_campaigns_write_admin_only
on public.ad_campaigns
for all
using (public.is_super_admin())
with check (public.is_super_admin());

-- platform_settings
drop policy if exists platform_settings_select_all on public.platform_settings;
create policy platform_settings_select_all
on public.platform_settings
for select
using (true);

drop policy if exists platform_settings_write_admin_only on public.platform_settings;
create policy platform_settings_write_admin_only
on public.platform_settings
for all
using (public.is_super_admin())
with check (public.is_super_admin());

-- email_events
drop policy if exists email_events_admin_read on public.email_events;
create policy email_events_admin_read
on public.email_events
for select
using (public.is_super_admin());

drop policy if exists email_events_admin_write on public.email_events;
create policy email_events_admin_write
on public.email_events
for all
using (public.is_super_admin())
with check (public.is_super_admin());

-- Storage buckets
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'candidate-cv',
  'candidate-cv',
  false,
  8388608,
  array[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'company-media',
  'company-media',
  true,
  10485760,
  array[
    'image/png',
    'image/jpeg',
    'image/webp',
    'video/mp4'
  ]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Storage policies
drop policy if exists company_media_public_read on storage.objects;
create policy company_media_public_read
on storage.objects
for select
using (bucket_id = 'company-media');

drop policy if exists company_media_insert_owner_or_admin on storage.objects;
create policy company_media_insert_owner_or_admin
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'company-media'
  and (
    public.is_super_admin()
    or (
      split_part(name, '/', 1) = 'company'
      and split_part(name, '/', 2) = coalesce(public.current_company_id()::text, '')
    )
  )
);

drop policy if exists company_media_update_owner_or_admin on storage.objects;
create policy company_media_update_owner_or_admin
on storage.objects
for update
to authenticated
using (
  bucket_id = 'company-media'
  and (
    public.is_super_admin()
    or (
      split_part(name, '/', 1) = 'company'
      and split_part(name, '/', 2) = coalesce(public.current_company_id()::text, '')
    )
  )
)
with check (
  bucket_id = 'company-media'
  and (
    public.is_super_admin()
    or (
      split_part(name, '/', 1) = 'company'
      and split_part(name, '/', 2) = coalesce(public.current_company_id()::text, '')
    )
  )
);

drop policy if exists company_media_delete_owner_or_admin on storage.objects;
create policy company_media_delete_owner_or_admin
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'company-media'
  and (
    public.is_super_admin()
    or (
      split_part(name, '/', 1) = 'company'
      and split_part(name, '/', 2) = coalesce(public.current_company_id()::text, '')
    )
  )
);

drop policy if exists candidate_cv_select_company_or_admin on storage.objects;
create policy candidate_cv_select_company_or_admin
on storage.objects
for select
to authenticated
using (
  bucket_id = 'candidate-cv'
  and (
    public.is_super_admin()
    or split_part(name, '/', 2) = coalesce(public.current_company_id()::text, '')
  )
);

-- Minimal seed data
insert into public.categories (name, slug)
values
  ('Technologie', 'technologie'),
  ('Sante', 'sante'),
  ('Education', 'education'),
  ('Finance', 'finance'),
  ('Commerce', 'commerce')
on conflict (slug) do nothing;

insert into public.platform_settings (id, youtube_channel_url, contact_email)
values (1, 'https://youtube.com/@your-channel', 'contact@cartevisite.com')
on conflict (id) do nothing;

commit;

-- After creating your first admin user in Supabase Auth,
-- run this once with the real user UUID:
-- update public.profiles
-- set role = 'super_admin'
-- where id = 'REPLACE_WITH_AUTH_USER_UUID';
