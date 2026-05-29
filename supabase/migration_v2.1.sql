-- =====================================================================
-- Mshmaroti v2.1 — schema migration for restaurant calculation
-- Adds columns to user_settings for OT, rest day, travel, pension, tax.
-- Run this once in Supabase SQL Editor against an existing v2.0 project.
-- =====================================================================

alter table public.user_settings
  add column if not exists weekly_hours_max numeric(5,2) not null default 42,
  add column if not exists rest_day_of_week int not null default 0, -- 0=Sun, 1=Mon, ..., 6=Sat
  add column if not exists daily_hours_threshold numeric(5,2) not null default 8,
  add column if not exists hourly_monthly_travel numeric(10,2) not null default 150,
  add column if not exists bituach_rate numeric(7,6) not null default 0.0427,
  add column if not exists pension_rate numeric(7,6) not null default 0.06,
  add column if not exists pension_active boolean not null default false,
  add column if not exists income_tax_rate numeric(7,6) not null default 0;

-- Add helpful comments
comment on column public.user_settings.weekly_hours_max is
  'Hours per week above which OT applies (Israeli private sector default: 42).';
comment on column public.user_settings.rest_day_of_week is
  '0=Sunday, 1=Monday, ..., 6=Saturday. Hours on this day get the rest-day multiplier.';
comment on column public.user_settings.daily_hours_threshold is
  'Hours per day above which OT applies (default: 8). Set to 7 for night shifts if desired.';
