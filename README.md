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

   Add one new one:
   - `ALLOWED_EMAIL`: the email you created in step 2. Only that account can use the app.

## How it works

- **Search** (Jobs page > Run search): every query that is on runs at once. Each result goes through the filters in `src/lib/filters.ts` (not a single posting, active clearance, not remote, salary below your minimum). No salary listed counts as passing. The run records how many results each query returned and every dropped result with its reason, so a zero is always explained.
- **Resume** (open a job > Copy for Claude): the tool reads the full posting and copies one prompt with the posting, your profile from `src/lib/profile.ts`, and every resume rule. A new Claude chat opens; paste and send, and Claude writes the resume plus a Word file named for the job. This runs on your Claude subscription, so the tool makes no Anthropic API calls.
- **Tracking**: paste the finished resume into the job's box and save. The job moves to Ready to apply, you can print it as a PDF, and Mark applied when you submit.

## Files

- `src/lib/search.ts`: Serper search and saving
- `src/lib/filters.ts`: all filter rules
- `src/lib/resume.ts`: posting fetch, the Copy for Claude prompt, rule checks
- `src/lib/profile.ts`: your contact info, work history, certifications, skills, and per-category focus
- `supabase/schema.sql`: database
