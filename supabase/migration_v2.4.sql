-- =====================================================================
-- Mshmaroti v2.4 — schema migration
--   1. Adds shifts.travel — the travel allowance is now logged per shift
--      instead of as one monthly figure in user_settings.
--   2. Tips become additive for the hourly job: total = base + tips,
--      replacing the old max(base, tips). See the OPTIONAL backfill below.
-- Steps 1 and 2 are safe to run multiple times.
-- =====================================================================

-- ---------- 1. per-shift travel ----------
alter table public.shifts
  add column if not exists travel numeric(10,2) not null default 0 check (travel >= 0);

comment on column public.shifts.travel is
  'Travel allowance for this shift (hourly job). Reimbursement — added to net, not taxed, and NOT part of total.';

-- user_settings.hourly_monthly_travel is no longer read by the app. The column is
-- left in place so older backups and clients keep working; drop it yourself if you
-- want it gone:
--   alter table public.user_settings drop column if exists hourly_monthly_travel;
comment on column public.user_settings.hourly_monthly_travel is
  'DEPRECATED as of v2.4 — travel is logged per shift in shifts.travel. No longer read by the app.';


-- =====================================================================
-- 2. OPTIONAL BACKFILL — rewrites historical pay. Read before running.
-- =====================================================================
-- Pay in Mshmaroti is frozen at write time, so shifts saved before v2.4 still
-- hold a total computed with the old rule: total = max(base, tips). Under the
-- new rule those shifts are under-counted by exactly the tips that lost.
--
-- This UPDATE restates every hourly shift as base + tips. It CANNOT be undone,
-- and it will change the figures in past monthly reports and PDFs.
-- Take a backup first (Settings → export JSON, or a Supabase snapshot).
--
-- To see what would change before committing to it:
--
--   select id, date, base, tips, total as total_now, base + tips as total_after
--   from public.shifts
--   where job_type = 'hourly' and total <> base + tips
--   order by date;
--
-- Then, when you are ready, uncomment and run:
--
--   update public.shifts
--      set total = base + tips
--    where job_type = 'hourly'
--      and total <> base + tips;
--
-- (Wedding shifts already used base + tips and need no backfill.)
