-- Job Autopilot v3 schema.
-- Paste this whole file into Supabase > SQL Editor > New query > Run.
-- Safe to run more than once. It does not touch any tables from the old version.

create extension if not exists pgcrypto;

-- One row of app-wide settings.
create table if not exists app_settings (
  id int primary key default 1 check (id = 1),
  review_required boolean not null default true,
  min_salary int not null default 80000,
  recency text not null default 'm' check (recency in ('d', 'w', 'm', 'y', 'any')),
  results_per_query int not null default 20 check (results_per_query between 10 and 100),
  updated_at timestamptz not null default now()
);
insert into app_settings (id) values (1) on conflict (id) do nothing;

-- The search queries, stored as data so they can be edited from the Settings page.
create table if not exists search_queries (
  id uuid primary key default gen_random_uuid(),
  sort_order int not null default 0,
  label text not null,
  category text not null,
  query text not null,
  enabled boolean not null default true,
  created_at timestamptz not null default now()
);

insert into search_queries (sort_order, label, category, query)
select * from (values
  (1,  'Proposals & Capture 1', 'proposals',     '"proposal manager" OR "capture manager" OR "proposal director" OR "bid manager" remote job'),
  (2,  'Proposals & Capture 2', 'proposals',     '"senior capture manager" OR "director of capture" OR "VP proposals" remote federal job'),
  (3,  'Contracts & Procurement', 'contracts',   '"contracts manager" OR "contract administrator" OR "contract specialist" OR "procurement manager" remote job'),
  (4,  'Compliance', 'compliance',               '"compliance manager" OR "compliance director" OR "compliance program manager" remote job'),
  (5,  'Grants', 'grants',                       '"grants manager" OR "grants administrator" OR "grant compliance" OR "federal grants manager" remote job'),
  (6,  'Program Management', 'program_ops',      '"program manager" OR "program director" OR "PMO director" remote federal government job'),
  (7,  'Business Development', 'business_dev',   '"business development director" OR "VP of business development" OR "director of business development" remote job'),
  (8,  'Consulting', 'consulting',               '"senior consultant" OR "principal consultant" OR "managing consultant" remote federal job'),
  (9,  'Government / Public Sector', 'public_sector', '"community development director" OR "economic development director" OR "workforce development director" remote job'),
  (10, 'DEI / HR Compliance 1', 'dei_hr',        '"chief diversity officer" OR "VP of DEI" OR "director of DEI" OR "director of diversity" OR "chief people officer" remote job'),
  (11, 'DEI / HR Compliance 2', 'dei_hr',        '"DEI manager" OR "diversity equity inclusion manager" OR "HR compliance manager" OR "employee relations manager" OR "EEO officer" remote job'),
  (12, 'DEI / HR Compliance 3', 'dei_hr',        '"people operations" OR "VP HR compliance" OR "director employee relations" OR "labor compliance manager" remote job')
) as v(sort_order, label, category, query)
where not exists (select 1 from search_queries);

-- Every search run, with per-query counts and every dropped result and its reason.
create table if not exists search_runs (
  id uuid primary key default gen_random_uuid(),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  total_returned int not null default 0,
  total_new int not null default 0,
  total_seen_before int not null default 0,
  total_dropped int not null default 0,
  per_query jsonb not null default '[]'::jsonb,
  dropped jsonb not null default '[]'::jsonb,
  error text
);

-- Jobs that passed the filters.
create table if not exists jobs (
  id uuid primary key default gen_random_uuid(),
  url text not null unique,
  title text not null,
  company text,
  snippet text,
  category text not null,
  query_label text,
  salary_text text,
  salary_min int,
  salary_max int,
  status text not null default 'new'
    check (status in ('new', 'generating', 'needs_review', 'ready', 'applied', 'dismissed', 'error')),
  flags text[] not null default '{}',
  description text,
  requirements jsonb,
  resume text,
  error text,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  last_run_id uuid references search_runs(id) on delete set null,
  generated_at timestamptz,
  applied_at timestamptz,
  updated_at timestamptz not null default now()
);
create index if not exists jobs_status_idx on jobs (status);
create index if not exists jobs_last_seen_idx on jobs (last_seen_at desc);

-- Lock everything down. The app only reads and writes with the service role key
-- on the server, after checking that you are signed in.
alter table app_settings enable row level security;
alter table search_queries enable row level security;
alter table search_runs enable row level security;
alter table jobs enable row level security;
