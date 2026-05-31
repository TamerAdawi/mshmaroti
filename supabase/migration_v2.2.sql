-- =====================================================================
-- Mshmaroti v2.2 — schema migration
-- Adds rate_multiplier column to shifts table.
-- Safe to run multiple times.
-- =====================================================================

alter table public.shifts
  add column if not exists rate_multiplier numeric(5,2) not null default 1.0;

comment on column public.shifts.rate_multiplier is
  'Per-shift rate multiplier. When != 1.0, overrides OT and rest day calculations.';
