-- Manual repair + enrichment script
-- Goal:
-- 1) Repair missing relations so companies appear in frontend filters.
-- 2) Guarantee 10 companies per sector (category).
-- 3) Ensure each company has images, published job offers, services, and news.
--
-- Safe to run multiple times (idempotent).

begin;

-- 1) Resolve one valid owner user for seeded companies.
create temp table if not exists tmp_seed_owner (
  owner_id uuid
);
truncate tmp_seed_owner;    

insert into tmp_seed_owner (owner_id)
select coalesce(
  (select p.id from public.profiles p where p.role = 'super_admin' order by p.created_at asc limit 1),
  (select p.id from public.profiles p where p.role = 'entreprise' order by p.created_at asc limit 1),
  (select u.id from auth.users u order by u.created_at asc limit 1)
);

do $$
declare
  v_owner uuid;
begin
  select owner_id into v_owner from tmp_seed_owner limit 1;
  if v_owner is null then
    raise exception 'No auth user found. Create at least one auth user before running this script.';
  end if;
end
$$;

-- 2) Sector catalog used by seed + repair.
create temp table if not exists tmp_sectors (
  sector_slug text primary key,
  sector_name text not null,
  city text not null,
  logo_url text not null,
  cover_url text not null
);
truncate tmp_sectors;

insert into tmp_sectors (sector_slug, sector_name, city, logo_url, cover_url)
values
  ('technologie', 'Technologie', 'Casablanca',
    'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=400&q=80',
    'https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&w=1600&q=80'),
  ('sante', 'Sante', 'Rabat',
    'https://images.unsplash.com/photo-1576091160550-2173dba999ef?auto=format&fit=crop&w=400&q=80',
    'https://images.unsplash.com/photo-1538108149393-fbbd81895907?auto=format&fit=crop&w=1600&q=80'),
  ('education', 'Education', 'Rabat',
    'https://images.unsplash.com/photo-1523240795612-9a054b0db644?auto=format&fit=crop&w=400&q=80',
    'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=1600&q=80'),
  ('finance', 'Finance', 'Casablanca',
    'https://images.unsplash.com/photo-1556155092-490a1ba16284?auto=format&fit=crop&w=400&q=80',
    'https://images.unsplash.com/photo-1461749280684-dccba630e2f6?auto=format&fit=crop&w=1600&q=80'),
  ('commerce', 'Commerce', 'Casablanca',
    'https://images.unsplash.com/photo-1472851294608-062f824d29cc?auto=format&fit=crop&w=400&q=80',
    'https://images.unsplash.com/photo-1481437156560-3205f6a55735?auto=format&fit=crop&w=1600&q=80'),
  ('industrie', 'Industrie', 'Bouskoura',
    'https://images.unsplash.com/photo-1581093458791-9f3c3900df4b?auto=format&fit=crop&w=400&q=80',
    'https://images.unsplash.com/photo-1581092580497-e0d23cbdf1dc?auto=format&fit=crop&w=1600&q=80'),
  ('marketing', 'Marketing', 'Casablanca',
    'https://images.unsplash.com/photo-1552664730-d307ca884978?auto=format&fit=crop&w=400&q=80',
    'https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=1600&q=80');

-- 3) Ensure categories exist and active.
insert into public.categories (name, slug, is_active)
select s.sector_name, s.sector_slug, true
from tmp_sectors s
on conflict (slug) do update
set
  name = excluded.name,
  is_active = true,
  updated_at = timezone('utc', now());

-- 4) Map existing companies to a sector slug.
create temp table if not exists tmp_company_sector_map (
  company_id uuid,
  sector_slug text
);

-- table exists from prior execution in same session -> refresh content
truncate tmp_company_sector_map;
insert into tmp_company_sector_map (company_id, sector_slug)
select
  c.id as company_id,
  case
    when c.slug like 'technologie-%' then 'technologie'
    when c.slug like 'sante-%' then 'sante'
    when c.slug like 'education-%' then 'education'
    when c.slug like 'finance-%' then 'finance'
    when c.slug like 'commerce-%' then 'commerce'
    when c.slug like 'industrie-%' then 'industrie'
    when c.slug like 'marketing-%' then 'marketing'
    when lower(coalesce(c.sector, '')) ~ '(tech|digital|informat|software|it)' then 'technologie'
    when lower(coalesce(c.sector, '')) ~ '(sante|medical|clinique|health)' then 'sante'
    when lower(coalesce(c.sector, '')) ~ '(education|formation|ecole|academy|edu)' then 'education'
    when lower(coalesce(c.sector, '')) ~ '(finance|banque|assurance|fintech)' then 'finance'
    when lower(coalesce(c.sector, '')) ~ '(commerce|retail|ecommerce|distribution)' then 'commerce'
    when lower(coalesce(c.sector, '')) ~ '(industrie|industriel|manufact|factory|production)' then 'industrie'
    when lower(coalesce(c.sector, '')) ~ '(marketing|communication|media|branding)' then 'marketing'
    else null
  end as sector_slug
from public.companies c;

-- 5) Normalize existing companies so they become visible in frontend.
update public.companies c
set
  status = 'active',
  sector = coalesce(c.sector, s.sector_name),
  city = coalesce(c.city, s.city),
  country = coalesce(c.country, 'Morocco'),
  description = coalesce(c.description, 'Entreprise active dans le secteur ' || s.sector_name || '.'),
  website_url = coalesce(c.website_url, 'https://' || c.slug || '.cartevisite.pro'),
  logo_url = coalesce(c.logo_url, s.logo_url),
  cover_url = coalesce(c.cover_url, s.cover_url)
from tmp_company_sector_map m
join tmp_sectors s on s.sector_slug = m.sector_slug
where c.id = m.company_id
  and m.sector_slug is not null;

-- 6) Repair missing company <-> category relations for existing companies.
insert into public.company_categories (company_id, category_id)
select distinct c.id, cat.id
from public.companies c
join tmp_company_sector_map m on m.company_id = c.id
join public.categories cat on cat.slug = m.sector_slug
where m.sector_slug is not null
on conflict (company_id, category_id) do nothing;

-- 7) Seed deterministic 10 companies per sector.
insert into public.companies (
  owner_user_id,
  name,
  slug,
  sector,
  description,
  address,
  city,
  country,
  phone,
  email,
  website_url,
  logo_url,
  cover_url,
  status,
  is_featured
)
select
  o.owner_id,
  initcap(s.sector_slug) || ' Entreprise ' || lpad(g.n::text, 2, '0') as name,
  s.sector_slug || '-entreprise-' || lpad(g.n::text, 2, '0') as slug,
  s.sector_name as sector,
  'Entreprise de reference en ' || s.sector_name || ' avec vitrine complete (jobs, services, news).' as description,
  'Zone business ' || g.n || ', ' || s.city as address,
  s.city,
  'Morocco',
  '+2126' || lpad((100000 + g.n)::text, 6, '0') as phone,
  s.sector_slug || '.entreprise.' || lpad(g.n::text, 2, '0') || '@cartevisite.pro' as email,
  'https://' || s.sector_slug || '-entreprise-' || lpad(g.n::text, 2, '0') || '.cartevisite.pro' as website_url,
  (
    array[
      'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=400&q=80',
      'https://images.unsplash.com/photo-1576091160550-2173dba999ef?auto=format&fit=crop&w=400&q=80',
      'https://images.unsplash.com/photo-1523240795612-9a054b0db644?auto=format&fit=crop&w=400&q=80',
      'https://images.unsplash.com/photo-1556155092-490a1ba16284?auto=format&fit=crop&w=400&q=80',
      'https://images.unsplash.com/photo-1472851294608-062f824d29cc?auto=format&fit=crop&w=400&q=80',
      'https://images.unsplash.com/photo-1581093458791-9f3c3900df4b?auto=format&fit=crop&w=400&q=80',
      'https://images.unsplash.com/photo-1552664730-d307ca884978?auto=format&fit=crop&w=400&q=80',
      'https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&w=400&q=80',
      'https://images.unsplash.com/photo-1520607162513-77705c0f0d4a?auto=format&fit=crop&w=400&q=80',
      'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?auto=format&fit=crop&w=400&q=80'
    ]
  )[img.image_idx] as logo_url,
  (
    array[
      'https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&w=1600&q=80',
      'https://images.unsplash.com/photo-1538108149393-fbbd81895907?auto=format&fit=crop&w=1600&q=80',
      'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=1600&q=80',
      'https://images.unsplash.com/photo-1461749280684-dccba630e2f6?auto=format&fit=crop&w=1600&q=80',
      'https://images.unsplash.com/photo-1481437156560-3205f6a55735?auto=format&fit=crop&w=1600&q=80',
      'https://images.unsplash.com/photo-1581092580497-e0d23cbdf1dc?auto=format&fit=crop&w=1600&q=80',
      'https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=1600&q=80',
      'https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=1600&q=80',
      'https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=1600&q=80',
      'https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=1600&q=80'
    ]
  )[img.image_idx] as cover_url,
  'active',
  case when g.n <= 2 then true else false end
from tmp_sectors s
cross join generate_series(1, 10) as g(n)
cross join lateral (
  select (1 + mod((g.n - 1) + mod(abs(hashtext(s.sector_slug)::bigint), 10), 10))::int as image_idx
) img
cross join tmp_seed_owner o
on conflict (slug) do update
set
  sector = excluded.sector,
  city = excluded.city,
  country = excluded.country,
  status = 'active',
  logo_url = excluded.logo_url,
  cover_url = excluded.cover_url,
  description = coalesce(public.companies.description, excluded.description),
  website_url = coalesce(public.companies.website_url, excluded.website_url),
  updated_at = timezone('utc', now());

-- 8) Ensure seeded companies have category relations.
insert into public.company_categories (company_id, category_id)
select c.id, cat.id
from public.companies c
join tmp_sectors s on c.slug like s.sector_slug || '-entreprise-%'
join public.categories cat on cat.slug = s.sector_slug
on conflict (company_id, category_id) do nothing;

-- 9) Build target scope = active companies linked to one of managed sectors.
create temp table if not exists tmp_target_companies (
  id uuid,
  owner_user_id uuid,
  slug text,
  sector text,
  city text,
  sector_slug text,
  cover_url text
);

truncate tmp_target_companies;
insert into tmp_target_companies (id, owner_user_id, slug, sector, city, sector_slug, cover_url)
select distinct
  c.id,
  c.owner_user_id,
  c.slug,
  coalesce(c.sector, s.sector_name) as sector,
  coalesce(c.city, s.city) as city,
  s.sector_slug,
  coalesce(c.cover_url, s.cover_url) as cover_url
from public.companies c
join public.company_categories cc on cc.company_id = c.id
join public.categories cat on cat.id = cc.category_id
join tmp_sectors s on s.sector_slug = cat.slug
where c.status = 'active';

-- 10) Ensure 2 published offers per company in target scope.
insert into public.job_offers (
  company_id,
  title,
  description,
  contract_type,
  location_city,
  is_remote,
  status,
  published_at,
  created_by
)
select
  tc.id,
  jt.title,
  jt.description,
  jt.contract_type,
  tc.city,
  jt.is_remote,
  'published',
  timezone('utc', now()) - (jt.idx * interval '2 days'),
  tc.owner_user_id
from tmp_target_companies tc
cross join (values (1), (2)) as t(idx)
cross join lateral (
  select
    case
      when t.idx = 1 then 'Responsable ' || tc.sector
      else 'Charge Commercial ' || tc.sector
    end as title,
    case
      when t.idx = 1 then 'Pilotage des operations, coordination equipe et execution des objectifs business.'
      else 'Developpement portefeuille clients, partenariats et croissance commerciale.'
    end as description,
    case
      when t.idx = 1 then 'CDI'
      else 'CDD'
    end as contract_type,
    case
      when t.idx = 2 then true
      else false
    end as is_remote,
    t.idx
) jt
where not exists (
  select 1
  from public.job_offers jo
  where jo.company_id = tc.id
    and jo.title = jt.title
);

-- 11) Ensure at least one active service per company.
insert into public.company_services (
  company_id,
  title,
  description,
  price_label,
  is_active
)
select
  tc.id,
  'Service premium ' || tc.sector,
  'Accompagnement complet: strategie, execution et suivi de performance.',
  'A partir de 1500 MAD',
  true
from tmp_target_companies tc
where not exists (
  select 1
  from public.company_services cs
  where cs.company_id = tc.id
);

-- 12) Ensure at least one published news per company.
insert into public.company_news (
  company_id,
  title,
  content,
  image_url,
  is_published,
  published_at
)
select
  tc.id,
  'Nouveautes ' || to_char(timezone('utc', now()), 'YYYY-MM') || ' - ' || tc.sector,
  'Annonce officielle: nouvelles offres, nouveaux services et renforcement de la presence digitale.',
  tc.cover_url,
  true,
  timezone('utc', now())
from tmp_target_companies tc
where not exists (
  select 1
  from public.company_news cn
  where cn.company_id = tc.id
);

commit;

-- Verification query (run after script):
-- Shows counts per sector and confirms relation completeness.
select
  cat.slug as secteur,
  count(distinct c.id) as entreprises,
  count(distinct jo.company_id) as entreprises_avec_offres,
  count(distinct c.id) filter (where c.logo_url is not null and c.cover_url is not null) as entreprises_avec_images,
  count(distinct cs.company_id) as entreprises_avec_services,
  count(distinct cn.company_id) as entreprises_avec_news
from public.categories cat
left join public.company_categories cc on cc.category_id = cat.id
left join public.companies c on c.id = cc.company_id and c.status = 'active'
left join public.job_offers jo on jo.company_id = c.id and jo.status = 'published'
left join public.company_services cs on cs.company_id = c.id and cs.is_active = true
left join public.company_news cn on cn.company_id = c.id and cn.is_published = true
where cat.slug in ('technologie', 'sante', 'education', 'finance', 'commerce', 'industrie', 'marketing')
group by cat.slug
order by cat.slug;
