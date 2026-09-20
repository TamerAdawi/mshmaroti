-- =====================================================================
-- Mshmaroti v2.5 — schema migration
-- Makes the rest-day rate editable: user_settings.rest_day_multiplier.
-- Until this runs, the app falls back to the legal 150% and warns in the
-- console when you save settings; nothing breaks.
-- Safe to run multiple times.
-- =====================================================================

alter table public.user_settings
  add column if not exists rest_day_multiplier numeric(5,2) not null default 1.5
    check (rest_day_multiplier >= 1);

comment on column public.user_settings.rest_day_multiplier is
  'Base rate paid inside the rest-day window, as a multiplier of hourly_rate. 1.5 = 150% (legal minimum). Overtime stacks on top: +0.25 then +0.5.';

-- Note: this changes future shifts only. Pay is frozen at write time, so shifts
-- already saved keep the rate they were computed with — see migration_v2.4.sql
-- for the same caveat around the tips change.
