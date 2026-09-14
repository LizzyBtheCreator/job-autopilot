-- ============================================================
-- JOB AUTOPILOT — DATABASE SCHEMA (clean rebuild)
-- ============================================================
-- This file is idempotent-ish (uses IF NOT EXISTS / DO NOTHING) but the
-- rename-old-tables step only makes sense to run ONCE, on the live DB that
-- still has the pre-rebuild `discovered_jobs` / `applications` tables.
--
-- HOW TO RUN THIS:
-- Paste this whole file into the Supabase SQL Editor (project uwcaidmvlllruooidzsb)
-- and run it once. It preserves every live (non-rejected) job and every
-- application row by renaming the old tables to *_legacy instead of dropping
-- them — nothing is deleted. You can drop the *_legacy tables yourself later
-- once you've confirmed the new Queue/Applications pages look right.

-- ── STEP 1: Archive the old tables (skip if they don't exist) ──────────────
do $$
begin
  if exists (select from information_schema.tables where table_name = 'discovered_jobs') then
    alter table discovered_jobs rename to discovered_jobs_legacy;
  end if;
  if exists (select from information_schema.tables where table_name = 'applications') then
    alter table applications rename to applications_legacy;
  end if;
end $$;

-- Old tables we no longer use — profile content now lives in code
-- (src/lib/resume-profile.ts) since it changes rarely and doesn't need a
-- CRUD UI. Not dropped, just no longer referenced by the app.
-- (master_profile, profile_sections, work_history, certifications,
--  education, daily_stats are left alone if they exist — harmless to keep.)

-- ── STEP 2: New discovered_jobs ─────────────────────────────────────────────
create table if not exists discovered_jobs (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  company text not null,
  url text not null unique,
  description text,
  is_remote boolean,
  salary_min integer,
  salary_max integer,
  salary_raw text,
  role_category text not null default 'govcon_other' check (role_category in (
    'proposal_writer', 'capture_manager', 'compliance_manager',
    'contracts_administrator', 'business_development', 'govcon_other', 'general_remote'
  )),
  is_entry_level boolean not null default false,
  industry_tags text[] default '{}',
  source_platform text,
  fit_score integer default 0,
  fit_notes text,
  status text not null default 'new' check (status in ('new', 'reviewed', 'rejected', 'applied')),
  discovered_at timestamptz default now(),
  reviewed_at timestamptz,
  applied_at timestamptz
);

create index if not exists idx_jobs_status on discovered_jobs(status);
create index if not exists idx_jobs_role_category on discovered_jobs(role_category);
create index if not exists idx_jobs_discovered_at on discovered_jobs(discovered_at desc);

-- ── STEP 3: New applications ────────────────────────────────────────────────
create table if not exists applications (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null unique references discovered_jobs(id) on delete cascade,
  resume_text text,
  status text not null default 'New' check (status in ('New', 'Applied', 'Interview', 'Offer', 'Rejected')),
  applied_at timestamptz,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_applications_job on applications(job_id);
create index if not exists idx_applications_status on applications(status);

create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists applications_updated_at on applications;
create trigger applications_updated_at before update on applications
  for each row execute function update_updated_at();

-- ── STEP 4: Migrate live rows from the legacy tables ────────────────────────
-- Carries forward everything that wasn't already rejected. Category mapping
-- is best-effort (the legacy app only searched proposal/capture titles under
-- a single 'govcon' category, so everything maps to 'govcon_other' — you can
-- manually re-tag individual jobs in the new Queue page afterward).
do $$
begin
  if exists (select from information_schema.tables where table_name = 'discovered_jobs_legacy') then
    insert into discovered_jobs (
      id, title, company, url, description, is_remote,
      salary_min, salary_max, salary_raw, role_category,
      fit_score, fit_notes, status, discovered_at, reviewed_at, applied_at
    )
    select
      id, title, company, url, description, is_remote,
      salary_min, salary_max, salary_raw, 'govcon_other',
      fit_score, fit_notes,
      case status
        when 'pending_review' then 'new'
        when 'approved' then 'reviewed'
        when 'applying' then 'reviewed'
        when 'applied' then 'applied'
        else 'rejected'
      end,
      discovered_at, reviewed_at, applied_at
    from discovered_jobs_legacy
    where status <> 'rejected'
    on conflict (url) do nothing;
  end if;
end $$;

do $$
begin
  if exists (select from information_schema.tables where table_name = 'applications_legacy') then
    insert into applications (job_id, resume_text, status, applied_at, notes, created_at, updated_at)
    select
      a.job_id, a.resume_text,
      case a.status
        when 'draft' then 'New'
        when 'ready' then 'New'
        when 'filled' then 'New'
        when 'submitted' then 'Applied'
        when 'interviewing' then 'Interview'
        when 'offer' then 'Offer'
        else 'Rejected'
      end,
      a.submitted_at, a.notes, a.created_at, a.updated_at
    from applications_legacy a
    -- only rows whose job actually survived the migration above
    where exists (select 1 from discovered_jobs j where j.id = a.job_id)
    on conflict (job_id) do nothing;
  end if;
end $$;
