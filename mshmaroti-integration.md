# Mshmaroti → Juzdani integration guide

How **Juzdani** (a separate personal-finance app) can read income from **Mshmaroti**'s
Supabase project **cleanly, read-only, and without coupling to Mshmaroti's internals**.

> **Status of this document**
> - Everything here was verified against the **live** Supabase project (`rqozlxefqyhwxxgfhviq`) via the REST API + the Mshmaroti source.
> - **No database changes have been made.** Section 5 only *proposes* view SQL — it is not applied. Run it yourself after you approve it.
> - Mshmaroti stays untouched: additive + read-only only.

Supabase project: `https://rqozlxefqyhwxxgfhviq.supabase.co`
Live migration state (verified against the live DB on 2026-09-20): **v2.0 → v2.5 all applied.** `shifts.break_minutes`, `shifts.travel` and `user_settings.rest_day_multiplier` all exist and are safe to reference. `user_settings.hourly_monthly_travel` still exists but is **deprecated and unread** — travel now lives on `shifts.travel`.

> **⚠️ v2.4 changed what `total` means for restaurant shifts.** It used to be `max(base, tips)`; it is now `base + tips` — tips are added on top of the wage instead of competing with it.
>
> **The optional backfill has NOT been run.** Shifts written before v2.4 still hold the old frozen value, so a month can mix both conventions. As of 2026-09-20 that is 3 `hourly` rows (2026-09-14, -16, -20) understating a combined ₪100. Identify them with `total <> base + tips` on `job_type = 'hourly'`. See §2.

---

## 1. Schema audit (real tables & columns)

All income lives in **one table: `public.shifts`** (one row per shift). Settings/params live in `public.user_settings`.

### `public.shifts` — columns relevant to income
| column | type | holds |
|---|---|---|
| `id` | `bigint` (bigserial) | PK |
| `user_id` | `uuid` (FK `auth.users.id`, on delete cascade) | row owner |
| `date` | `date` | **the calendar date the shift was worked** (the date to filter income on) |
| `job_type` | `text` CHECK in (`'wedding'`,`'hourly'`) | `'wedding'` = wedding hall, `'hourly'` = restaurant |
| `hours` | `numeric(5,2)` | paid hours |
| `base` | `numeric(10,2)` | pre-tip pay. Wedding = flat daily rate; restaurant = labor-law wage (see §2) |
| `tips` | `numeric(10,2)` | tips for that shift |
| `total` | `numeric(10,2)` | **canonical pay for the shift.** `base + tips` for both jobs since v2.4 (restaurant was `max(base, tips)` before). Excludes travel. |
| `rate_multiplier` | `numeric(5,2)` default 1.0 | per-shift override (restaurant only) |
| `expenses` | `numeric(10,2)` default 0 | out-of-pocket; **NOT** part of income/`total` |
| `start_time`,`end_time` | `text` `"HH:MM"` nullable | shift window (used for OT/rest-day math) |
| `created_at` | `timestamptz` default now() | insert timestamp (ordering only — **not** a financial date) |

Indexes: `(user_id, date desc)`, `(user_id, job_type)`. RLS enabled (see §4).
(There is also `notes text`. The `break_minutes` (v2.3) and `travel` (v2.4) columns exist only in the source migrations and are **absent live** — ignore them until those migrations are run.)

`travel` (v2.4), when present, is a per-shift travel reimbursement on restaurant shifts. It is **not** part of `total` — treat it as an expense reimbursement, not income, or you will double-count against a payslip.

### The three income sources → exact `table.column`
1. **Wedding-hall pay per month** → `public.shifts.total` where `job_type = 'wedding'`, summed per month of `date`. (`total` = flat base + tips.)
2. **Weekly total tips** (the feature you just added) → `public.shifts.tips` where `job_type = 'wedding'`, summed per Sunday-started week of `date`.
   - Found in source: `src/lib/calc.ts → weeklyWeddingTips()`, surfaced as a chip in `src/components/tiles/StatTiles.tsx` (Week tile). **It is wedding-hall tips only** — not restaurant tips.
3. **Restaurant shifts & monthly pay** → rows where `job_type = 'hourly'`; per-shift pay is `public.shifts.total`, summed per month of `date`. (`total` already encodes the Israeli labor-law result — see §2.)

### `public.user_settings` (one row per user) — only needed if you compute restaurant **net**
`user_id uuid PK`, `wedding_rate numeric(10,2)` (flat wedding daily rate), `hourly_rate numeric(10,2)`,
`hourly_monthly_travel numeric(10,2)` (default 150), `bituach_rate numeric(7,6)` (default 0.0427),
`pension_rate numeric(7,6)` (default 0.06), `pension_active boolean`, `income_tax_rate numeric(7,6)` (default 0),
`rest_day_of_week int` (0=Sun), `daily_hours_threshold numeric(5,2)` (default 8), `weekly_hours_max numeric(5,2)`,
`rest_day_multiplier numeric(5,2)` (v2.5, default 1.5 — absent until that migration runs).
All confirmed present live.

---

## 2. Computation logic (how the numbers are really derived)

Key principle: **`shifts.total` is computed once, at shift-creation time, and frozen.** Mshmaroti never
recomputes historical pay when rates/settings change. So summing `total` gives the *real* figures
Mshmaroti recorded — not an approximation. (Source: `src/lib/api.ts addShift`/`updateShift`, `src/lib/payroll.ts`, `src/lib/calc.ts`.)

### Wedding-hall pay
- **Flat daily rate**, not hourly. At entry, `base = user_settings.wedding_rate` (default ₪200) regardless of hours or time of day. There is **no per-event/per-night variation** in the rate — every wedding shift's base is the flat rate in effect when it was created.
- `total = base + tips`.
- Monthly wedding pay = `SUM(total)` over `job_type='wedding'` in the month. (Mirrors `monthlyIncomeByJob().wedding` and `calcMonthlyBreakdown.weddingTotal`.)
- If you want the split: flat pay = `SUM(base)`, tips = `SUM(tips)`.

### Weekly tips
- `SUM(tips)` over `job_type='wedding'` shifts in the week.
- **Week starts on SUNDAY.** Source `startOfWeekIso()`: `day = getDay()` (0=Sun…6=Sat), then back up to Sunday. Week = Sunday→Saturday.
- The app shows only the *current* week; the data itself supports any week.

### Restaurant monthly pay (Israeli labor law)
Per shift, `calcShiftPay()` produces `base` (the wage, called `hourlyCalc`) and `total`:
- **If `rate_multiplier ≠ 1.0`** → simple override: `wage = hours × hourly_rate × rate_multiplier` (no OT, no rest-day).
- **Otherwise** → hour-by-hour tiers using `daily_hours_threshold` (default 8):
  - hours `≤ threshold`: ×1.0; next 2 h: ×1.25; beyond: ×1.5.
  - Hours that fall inside the **rest-day window** get **`rest_day_multiplier − 1`** added to their tier multiplier (v2.5; default `1.5`, so +0.5 and the familiar 150/175/200% ladder). The window is **Saturday 19:00 → Sunday 19:00** (24 h), computed by clock overlap with `start_time`/`end_time`. (Note: the per-shift code uses this fixed Sat-19:00 window; `user_settings.rest_day_of_week` exists but the shipped per-shift calc uses the Saturday window.)
  - Since the rate is a setting, **don't assume the 150/175/200 ladder** if you re-derive wages yourself — read `user_settings.rest_day_multiplier`, falling back to `1.5` when the column is absent. Summing `shifts.total` avoids the question entirely and is still the recommended route.
- **Tips (v2.4 onward):** `total = wage + tips` — tips are kept on top of the wage. `base = wage`.
  - **Before v2.4** the rule was `total = max(wage, tips)`. Rows written under the old rule keep that frozen value, so a month can mix both conventions. `total <> base + tips` on an `hourly` row identifies a pre-v2.4 row whose tips were swallowed.
- **Monthly gross wages** = `SUM(total)` over `job_type='hourly'`. ← this is the recommended "expected" figure.
- **Monthly net** (shown in the Gross-vs-Net tile, `calcMonthlyBreakdown`):
  `net = gross + travel − gross×bituach_rate − (pension_active ? gross×pension_rate : 0) − gross×income_tax_rate`,
  where `travel = SUM(shifts.travel)` over the month's `hourly` rows.
  **As of v2.4 travel is per shift**, summed from `shifts.travel`; it used to be the flat monthly
  `user_settings.hourly_monthly_travel` (that column still exists but the app no longer reads it).
  **Net needs `user_settings` for the rates; gross and travel need only `shifts`.**

---

## 3. Date semantics

| Income | Filter on | The date means | Grouping |
|---|---|---|---|
| Wedding monthly | `shifts.date` | date the shift was **worked** | calendar month of `date` |
| Weekly tips | `shifts.date` | date the shift was **worked** | week of `date`, **week starts Sunday** (`week_start = date − dow(date)`) |
| Restaurant monthly | `shifts.date` | date the shift was **worked** | calendar month of `date` |

- There is **no payout/payday date** anywhere in Mshmaroti. "Monthly pay" = pay for shifts *worked* that month; it is **not** aligned to an employer's pay cycle. If Juzdani needs payout months, it must map work-month → payout-month itself.
- `created_at` is an insertion timestamp only — **never** filter income on it.
- Tips weeks are Sunday→Saturday (not ISO Monday weeks). In Postgres, `date_trunc('week', …)` is **Monday**-based — do **not** use it for tips; use `date − extract(dow from date)::int` for a Sunday start.

---

## 4. Auth & row scoping

- **Auth:** Supabase Auth (GoTrue). Mshmaroti supports **email/password** and **Google OAuth** (`src/lib/auth.tsx`, `AuthScreen.tsx`). Sessions persist; the client is the standard `@supabase/supabase-js` browser client (`src/lib/supabase.ts`) using the project URL + **anon public key**.
- **Scoping:** every row carries `user_id uuid = auth.users.id`. Both `shifts` and `user_settings` have **RLS enabled** with policies keyed to the JWT:
  - `shifts`: SELECT/INSERT/UPDATE/DELETE all `using (auth.uid() = user_id)`.
  - `user_settings`: SELECT/INSERT/UPDATE `using (auth.uid() = user_id)`.
- **For Juzdani:** reuse the **same Supabase URL + anon key + the same login** (same `auth.users`). When a user is signed in, `auth.uid()` is their id and **RLS auto-scopes every query to their own rows** — Juzdani does not need to (and should not) pass `user_id` manually; it's there if you want to select/return it. A user's rows are identified by `user_id = auth.uid()`.

---

## 5. Proposed stable read interface (VIEWS) — **SQL for your approval, not yet applied**

Three additive, read-only views. Juzdani reads these and never touches base tables, so Mshmaroti internals can change without breaking Juzdani.

**Two requirements baked into the SQL (both essential — see §6):**
1. `security_invoker = true` so the underlying `shifts` RLS applies to the *querying* user. Without it a view runs as its owner and **bypasses RLS, leaking every user's data**.
2. `grant select … to authenticated` so the logged-in PostgREST role can read it.

```sql
-- 1) Monthly wedding-hall pay (flat base + tips), per user
create or replace view public.v_wedding_pay_monthly
  with (security_invoker = true) as
select
  user_id,
  date_trunc('month', date)::date as month,   -- first day of the month
  sum(total)                      as amount    -- flat base + tips
from public.shifts
where job_type = 'wedding'
group by user_id, date_trunc('month', date);

grant select on public.v_wedding_pay_monthly to authenticated;

-- 2) Weekly wedding-hall tips, per user, weeks starting SUNDAY
create or replace view public.v_tips_weekly
  with (security_invoker = true) as
select
  user_id,
  (date - (extract(dow from date)::int))::date as week_start,  -- the Sunday of that week
  sum(tips)                                     as amount
from public.shifts
where job_type = 'wedding'
group by user_id, (date - (extract(dow from date)::int));

grant select on public.v_tips_weekly to authenticated;

-- 3) Monthly restaurant GROSS expected pay, per user
--    expected_amount = sum of per-shift labor-law totals (wage + tips as of v2.4).
--    Pre travel/deductions; feeds an expected-vs-actual payslip check later.
create or replace view public.v_restaurant_pay_monthly
  with (security_invoker = true) as
select
  user_id,
  date_trunc('month', date)::date as month,
  sum(total)                      as expected_amount
from public.shifts
where job_type = 'hourly'
group by user_id, date_trunc('month', date);

grant select on public.v_restaurant_pay_monthly to authenticated;

-- After running, if Juzdani gets PGRST205 (view not in schema cache):
notify pgrst, 'reload schema';
```

**Notes**
- These are **views only**. No base table/column/function/policy is touched. Safe under the hard constraint.
- `expected_amount` is **gross** (shift-derived, robust, no dependency on `user_settings`). If you later want **net**, add a *separate* optional view that joins `user_settings` and applies the §2 net formula — leave this one as the gross baseline.
- Empty result for a month/week simply means no rows (no zero-filled rows). Juzdani should treat "missing" as 0.
- `security_invoker` requires Postgres 15+ (Supabase is 15+ — fine).

---

## 6. RLS check (can Juzdani's client read these via the anon key?)

Verified live (anon key, no session → `[]`, i.e. readable but RLS returns no rows; with a logged-in session the same query returns that user's rows — which is exactly how Mshmaroti itself reads today):

- ✅ `public.shifts` — RLS on, SELECT works for authenticated; scoped by `auth.uid() = user_id`.
- ✅ `public.user_settings` — same.
- ✅ The proposed views will be readable by an authenticated user **provided** the two requirements in §5 are kept.

**Flags / things that would block reads:**
- ❌ **Omitting `security_invoker = true`** → the view bypasses RLS and exposes **all** users' aggregates. Must keep it. (Also the safest correctness guarantee — each user only ever sees their own totals.)
- ❌ **Forgetting `grant select … to authenticated`** → `permission denied for view` / 401 from PostgREST.
- ⚠️ **Schema cache:** after `create view`, PostgREST may briefly 404 (`PGRST205`) until it reloads. Supabase usually auto-reloads on DDL; otherwise run `notify pgrst, 'reload schema';`.
- ℹ️ **anon (logged-out) reads return empty**, not an error (`auth.uid()` is null → no rows match). Expected; Juzdani must be signed in.
- ℹ️ Don't reference `shifts.break_minutes` or `shifts.travel` from Juzdani until migrations v2.3 / v2.4 have been run — they're not in the live DB (would 400 with `42703`).

---

## For Juzdani's CLAUDE.md

Same backend, same login: `VITE_SUPABASE_URL = https://rqozlxefqyhwxxgfhviq.supabase.co`, and the **same anon public key** as Mshmaroti (`VITE_SUPABASE_ANON_KEY`). Sign in with the same Supabase Auth user; RLS scopes everything to `auth.uid()` automatically.

The three income reads (drop into the `[FILL IN]` blanks). **Preferred = the views from §5** (run that SQL first); a raw-table fallback is given in case the views aren't created yet.

| Juzdani needs | Read from (view) | Columns | Raw-table fallback |
|---|---|---|---|
| **Wedding pay, monthly** | `public.v_wedding_pay_monthly` | `month` (date, 1st of month), `amount` (₪), `user_id` | `select date_trunc('month',date)::date m, sum(total) from shifts where job_type='wedding' group by 1` |
| **Tips, weekly** | `public.v_tips_weekly` | `week_start` (date, **Sunday**), `amount` (₪), `user_id` | `select (date-extract(dow from date)::int)::date w, sum(tips) from shifts where job_type='wedding' group by 1` |
| **Restaurant pay, monthly (expected/gross)** | `public.v_restaurant_pay_monthly` | `month` (date, 1st of month), `expected_amount` (₪), `user_id` | `select date_trunc('month',date)::date m, sum(total) from shifts where job_type='hourly' group by 1` |

Example client read (supabase-js, user already signed in — RLS scopes to them):
```ts
const { data } = await supabase
  .from('v_wedding_pay_monthly')
  .select('month, amount')
  .order('month', { ascending: false })
```

Semantics to remember in Juzdani: amounts are by **shift work-date** (no payout date); weeks are **Sunday-start**; "no row" = ₪0; restaurant `expected_amount` is **gross** (add the §2 deductions with `user_settings` only if you need net).
