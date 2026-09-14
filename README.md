# Job Autopilot

Automated job search, tracking, and resume tailoring for Elizabeth McMillan.
Roles: Proposal Writer, Capture Manager, Compliance Manager, Contracts
Administrator, Business Development, and other GovCon/high-paying remote
roles. Remote only, $100k+ preferred, no entry-level.

## Stack

- Next.js App Router, deployed via GitHub → Vercel (no local builds — push to
  a branch/PR and let Vercel build it)
- Supabase (Postgres) for job/application storage
- Serper API for job search (targeted `site:` searches against ATS platforms:
  Greenhouse, Workday, iCIMS, Ashby, Lever, SmartRecruiters, USAJobs)
- Claude API (Anthropic) for resume tailoring

## How it works

1. **Dashboard** (`/`) — live counts, category breakdown, and the "Run
   Search Now" button that triggers `/api/discovery/run` (costs Serper
   credits — only run it when you actually want new results).
2. **Job Search** (`/queue`) — jobs found but not yet decided on. Generate a
   tailored resume (costs one Claude API call) or skip.
3. **Applications** (`/applications`) — the New / Applied / Interview / Offer
   / Rejected tracker. Edit/regenerate the resume, download it as a PDF
   (browser print, no server-side PDF library), take notes.

## Setup

Environment variables (`.env.local`, already configured on Vercel):
`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
`SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY`, `SERPER_API_KEY`.

Schema lives in `supabase/schema.sql` — run it once in the Supabase SQL
Editor for the project. It safely migrates any existing `discovered_jobs`/
`applications` rows (renaming the old tables to `*_legacy` instead of
dropping them) rather than wiping data.
