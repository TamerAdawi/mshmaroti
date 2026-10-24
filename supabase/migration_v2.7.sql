-- =====================================================================
-- Mshmaroti v2.7 — schema migration
-- Makes the app shareable between workers: each account records which
-- job(s) it has, and whether it has been through the first-time setup.
--
--   jobs        'wedding' | 'hourly' | 'both' — drives what the app shows
--   onboarded   false until the setup page is completed
--
-- Existing accounts are left exactly as they are: they get jobs = 'both'
-- (what the app has always assumed) and onboarded = true, so they never
-- see the setup page. Only accounts created after this runs start at
-- onboarded = false.
-- Safe to run multiple times.
-- =====================================================================

alter table public.user_settings
  add column if not exists jobs text not null default 'both'
    check (jobs in ('wedding', 'hourly', 'both'));

-- Added with default true so every existing row counts as already set up...
alter table public.user_settings
  add column if not exists onboarded boolean not null default true;
-- ...then flipped, so rows created from now on (new sign-ups) go through setup.
alter table public.user_settings
  alter column onboarded set default false;

comment on column public.user_settings.jobs is
  'Which job(s) this worker has: wedding (flat per event), hourly, or both. Drives which screens and fields the app shows.';
comment on column public.user_settings.onboarded is
  'False until the first-time setup page is completed. Existing accounts were set to true when this column was added.';
