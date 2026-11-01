-- State and local bid search. Separate from the job search: none of these tables are used by it.
-- Paste this whole file into Supabase > SQL Editor > New query > Run. Safe to run more than once.

create extension if not exists pgcrypto;

-- One row of bid search settings.
create table if not exists bid_settings (
  id int primary key default 1 check (id = 1),
  states text[] not null default '{"North Carolina","South Carolina","Georgia"}',
  bid_terms text not null default '"invitation for bid" OR "invitation to bid" OR "request for quote" OR "request for quotes" OR "request for bids"',
  recency text not null default 'm' check (recency in ('d', 'w', 'm', 'y', 'any')),
  results_per_query int not null default 20 check (results_per_query between 10 and 100),
  updated_at timestamptz not null default now()
);
insert into bid_settings (id) values (1) on conflict (id) do nothing;

-- The services to search for. Each runs combined with the bid terms and states above.
create table if not exists bid_queries (
  id uuid primary key default gen_random_uuid(),
  sort_order int not null default 0,
  label text not null,
  query text not null,
  enabled boolean not null default true,
  created_at timestamptz not null default now()
);

insert into bid_queries (sort_order, label, query, enabled)
select * from (values
  (1,  'Mowing and grounds',        'mowing OR "grounds maintenance" OR "lawn maintenance"', true),
  (2,  'Lot mowing and abatement',  '"nuisance abatement" OR "lot mowing" OR "overgrown lots"', true),
  (3,  'Janitorial',                'janitorial OR custodial', true),
  (4,  'Pressure washing',          '"pressure washing" OR "power washing"', true),
  (5,  'Window and gutter cleaning','"window cleaning" OR "gutter cleaning"', true),
  (6,  'Carpet and floor care',     '"carpet cleaning" OR "floor stripping" OR "floor care"', true),
  (7,  'Litter and right-of-way',   '"litter pickup" OR "litter removal" OR "right-of-way mowing"', true),
  (8,  'Junk and debris removal',   '"junk removal" OR "debris removal"', true),
  (9,  'Moving services',           '"moving services" OR "relocation services" OR "furniture moving"', true),
  (10, 'Board-up services',         '"board-up" OR "board up services" OR "securing vacant structures"', true),
  (11, 'Portable toilets',          '"portable toilet" OR "portable restroom"', true),
  (12, 'Fleet washing and sweeping','"fleet washing" OR "vehicle washing" OR "parking lot sweeping"', true),
  (13, 'Snow removal',              '"snow removal" OR "snow plowing"', false),
  (14, 'Pool maintenance',          '"pool maintenance" OR "pool cleaning"', false)
) as v(sort_order, label, query, enabled)
where not exists (select 1 from bid_queries);

-- Every bid search run, with per-query counts and every dropped result and its reason.
create table if not exists bid_runs (
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

-- Bids that passed the filters.
create table if not exists bids (
  id uuid primary key default gen_random_uuid(),
  url text not null unique,
  title text not null,
  agency text,
  state text,
  snippet text,
  query_label text,
  due_date date,
  due_text text,
  flags text[] not null default '{}',
  status text not null default 'new'
    check (status in ('new', 'bidding', 'submitted', 'won', 'lost', 'dismissed')),
  contractor_cost numeric,
  bid_price numeric,
  notes text,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  last_run_id uuid references bid_runs(id) on delete set null,
  submitted_at timestamptz,
  updated_at timestamptz not null default now()
);
create index if not exists bids_status_idx on bids (status);
create index if not exists bids_due_idx on bids (due_date);

alter table bid_settings enable row level security;
alter table bid_queries enable row level security;
alter table bid_runs enable row level security;
alter table bids enable row level security;
