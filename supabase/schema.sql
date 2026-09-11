-- ============================================================
-- JOB AUTOPILOT — DATABASE SCHEMA
-- ============================================================

-- Master profile (one row = Elizabeth)
create table if not exists master_profile (
  id uuid primary key default gen_random_uuid(),
  full_name text not null default 'Elizabeth H. McMillan',
  email text not null default 'elimcmillan@myyahoo.com',
  phone text not null default '(910) 479-4839',
  location text not null default 'Fayetteville, NC',
  cover_letter_tone text not null default 'conversational-direct',
  salary_min integer not null default 60000,
  remote_only boolean not null default true,
  no_commission_only boolean not null default true,
  daily_target integer not null default 50,
  daily_target_production integer not null default 100,
  is_testing_phase boolean not null default true,
  category_floor integer not null default 5,
  category_cap_pct integer not null default 60,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Profile sections (one row per job category)
create table if not exists profile_sections (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references master_profile(id) on delete cascade,
  category text not null check (category in ('sales', 'govcon', 'datacenter')),
  summary text,
  skills text[] default '{}',
  keywords text[] default '{}',
  target_roles text[] default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(profile_id, category)
);

-- Work history entries
create table if not exists work_history (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references master_profile(id) on delete cascade,
  company text not null,
  title text not null,
  start_date text,
  end_date text,
  is_current boolean default false,
  is_remote boolean default false,
  location text,
  bullets text[] default '{}',
  categories text[] default '{}',
  sort_order integer default 0,
  created_at timestamptz default now()
);

-- Certifications
create table if not exists certifications (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references master_profile(id) on delete cascade,
  name text not null,
  issuer text,
  year text,
  in_progress boolean default false
);

-- Education
create table if not exists education (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references master_profile(id) on delete cascade,
  institution text not null,
  degree text,
  field text,
  year text,
  in_progress boolean default false
);

-- Discovered jobs (raw from web search)
create table if not exists discovered_jobs (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  company text not null,
  url text not null unique,
  description text,
  category text check (category in ('sales', 'govcon', 'datacenter')),
  role_type text,
  is_remote boolean,
  salary_min integer,
  salary_max integer,
  salary_raw text,
  is_commission_only boolean default false,
  fit_score integer default 0,
  fit_notes text,
  status text not null default 'pending_review' check (status in (
    'pending_review', 'approved', 'rejected', 'applying', 'applied', 'archived'
  )),
  application_form_type text,
  discovered_at timestamptz default now(),
  reviewed_at timestamptz,
  applied_at timestamptz
);

-- Applications
create table if not exists applications (
  id uuid primary key default gen_random_uuid(),
  job_id uuid references discovered_jobs(id) on delete cascade,
  resume_text text,
  cover_letter text,
  status text not null default 'draft' check (status in (
    'draft', 'ready', 'filled', 'submitted', 'rejected', 'interviewing', 'offer', 'closed', 'unavailable'
  )),
  form_filled_at timestamptz,
  submitted_at timestamptz,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Daily stats
create table if not exists daily_stats (
  id uuid primary key default gen_random_uuid(),
  date date not null unique default current_date,
  discovered integer default 0,
  approved integer default 0,
  rejected integer default 0,
  applied integer default 0,
  sales_applied integer default 0,
  govcon_applied integer default 0,
  datacenter_applied integer default 0,
  target integer default 50
);

-- Auto-update updated_at
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger master_profile_updated_at before update on master_profile
  for each row execute function update_updated_at();
create trigger profile_sections_updated_at before update on profile_sections
  for each row execute function update_updated_at();
create trigger applications_updated_at before update on applications
  for each row execute function update_updated_at();

-- Indexes
create index if not exists idx_jobs_status on discovered_jobs(status);
create index if not exists idx_jobs_category on discovered_jobs(category);
create index if not exists idx_jobs_discovered_at on discovered_jobs(discovered_at desc);
create index if not exists idx_applications_job on applications(job_id);
create index if not exists idx_daily_stats_date on daily_stats(date desc);
