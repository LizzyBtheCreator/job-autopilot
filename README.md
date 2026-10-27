# Job Autopilot v3

Searches Google (through Serper) for remote jobs that match your queries, filters them, and writes a tailored resume for each one with Claude. Deploys from GitHub to Vercel. Nothing runs locally.

## One-time setup

1. **Database.** In Supabase, open SQL Editor > New query, paste all of `supabase/schema.sql`, and press Run. It creates four new tables (`app_settings`, `search_queries`, `search_runs`, `jobs`) and loads your 12 queries. Old tables are left alone.
2. **Your login.** In Supabase, open Authentication > Users > Add user > Create new user. Enter your email and a password, and tick "Auto Confirm User".
3. **Turn off public sign-ups.** Authentication > Sign In / Providers > uncheck "Allow new users to sign up".
4. **Vercel environment variables** (Project > Settings > Environment Variables). These should already exist:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `SERPER_API_KEY`
   - `ANTHROPIC_API_KEY`

   Add one new one:
   - `ALLOWED_EMAIL`: the email you created in step 2. Only that account can use the app.

## How it works

- **Search** (Jobs page > Run search): every query that is on runs at once. Each result goes through the filters in `src/lib/filters.ts` (not a single posting, state/local government, active clearance, not remote, salary below your minimum). No salary listed counts as passing. The run records how many results each query returned and every dropped result with its reason, so a zero is always explained.
- **Resume** (Generate resume on a job): fetches the full posting, has Claude Haiku pull out the employer's exact language, then has Claude Sonnet write the resume using only the facts in `src/lib/profile.ts`. After writing, code replaces any em dash and checks for filler phrases, an education section, and the locked role order. The full posting is checked against the filters again and anything found is shown as a warning on the job.
- **Review** (Settings): with review on, resumes wait in Needs review until you approve them. With it off they go straight to Ready to apply. Either way you apply yourself from the posting link.

## Files

- `src/lib/search.ts`: Serper search and saving
- `src/lib/filters.ts`: all filter rules
- `src/lib/resume.ts`: posting fetch, Haiku extraction, Sonnet writing, rule checks
- `src/lib/profile.ts`: your contact info, work history, certifications, skills, and per-category focus
- `supabase/schema.sql`: database
