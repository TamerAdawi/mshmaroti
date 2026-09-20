-- =====================================================================
-- Mshmaroti v2.6 — schema migration
-- Travel becomes a checkbox on the shift form: the amount is configured
-- once in Settings, and ticking the box stores that amount on the shift.
-- Adds user_settings.travel_per_shift.
--
-- shifts.travel (v2.4) is unchanged and still holds the per-shift amount,
-- so changing this setting never rewrites shifts already saved.
-- Until this runs, the app falls back to its default and warns in the
-- console when you save settings; nothing breaks.
-- Safe to run multiple times.
-- =====================================================================

alter table public.user_settings
  add column if not exists travel_per_shift numeric(10,2) not null default 12
    check (travel_per_shift >= 0);

comment on column public.user_settings.travel_per_shift is
  'Standard travel reimbursement for one restaurant shift. Copied onto shifts.travel when the new-shift form''s travel checkbox is ticked.';
