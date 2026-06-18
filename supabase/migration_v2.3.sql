-- =====================================================================
-- Mshmaroti v2.3 — schema migration
-- Adds break_minutes column to shifts table (unpaid break for the hourly job).
-- Safe to run multiple times.
-- =====================================================================

alter table public.shifts
  add column if not exists break_minutes integer not null default 0 check (break_minutes >= 0);

comment on column public.shifts.break_minutes is
  'Unpaid break in minutes (hourly job). Deducted from the start→end span to get paid hours.';
