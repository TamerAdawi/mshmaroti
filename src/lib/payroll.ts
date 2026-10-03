/**
 * Israeli labor law calculations for restaurant (hourly) job.
 * v2.2: rest day is a time window (default Sat 19:00 → Sun 19:00), not a whole day.
 * Per-shift rate multiplier overrides OT and rest day calcs when != 1.0.
 * Tips: added on top of the computed wage — gross = hourly_calc + tips per shift.
 * v2.5: the rest-day rate is a setting (restDayMultiplier, default 150%) rather
 * than a hardcoded +0.5, and stacks with the OT tiers the same way.
 */
import type { Shift } from '../types'
import type { Settings } from './settings'

// ===================================================================
// Per-shift breakdown
// ===================================================================

export interface ShiftPayBreakdown {
  /** Final gross paid for the shift: the wage (multiplier OR OT+rest day) plus tips. */
  gross: number
  /** What the hourly calc alone produced, before tips are added. */
  hourlyCalc: number
  /** Tips counted on top of the wage. */
  tips: number
  /** True if rate multiplier override was applied (skips OT + rest day). */
  multiplierOverride: boolean
  /** Hours in rest day window (Sat 19:00 → Sun 19:00). */
  restDayHours: number
  /** Hours outside rest day window. */
  regularHours: number
  // The tier buckets below count OT position only. Inside the rest-day window each
  // is paid restDayMultiplier higher — ×1.0/×1.25/×1.5 becomes ×1.5/×1.75/×2.0 at
  // the default 150%, and shifts with the setting.
  /** Hours at base tier (×1.0 before the rest-day premium). */
  tierRegularHours: number
  /** Hours at OT tier 1 (×1.25 before the rest-day premium). */
  tierOt1Hours: number
  /** Hours at OT tier 2 (×1.5 before the rest-day premium). */
  tierOt2Hours: number
}

/**
 * Compute restaurant shift gross.
 *
 * Logic order:
 *   1. If rateMultiplier != 1.0 → simple: hours × rate × multiplier (no OT, no rest day).
 *   2. Otherwise → compute rest day overlap by time, apply OT tiers per hour position.
 *   3. Tips are always added on top of the wage → gross = hourlyCalc + tips.
 *
 * For wedding shifts, this is a no-op (caller should use base directly).
 */
export function calcShiftPay(
  shift: Pick<Shift, 'date' | 'jobType' | 'hours' | 'startTime' | 'endTime' | 'tips' | 'rateMultiplier'>,
  hourlyRate: number,
  settings: Settings,
): ShiftPayBreakdown {
  const tips = shift.tips ?? 0
  const multiplier = shift.rateMultiplier ?? 1.0

  // Wedding: not applicable — return zeros
  if (shift.jobType !== 'hourly') {
    return zeroBreakdown(shift.hours)
  }

  // === Branch 1: manual multiplier override ===
  if (multiplier !== 1.0) {
    const hourlyCalc = shift.hours * hourlyRate * multiplier
    return {
      gross: hourlyCalc + tips,
      hourlyCalc,
      tips,
      multiplierOverride: true,
      restDayHours: 0,
      regularHours: shift.hours,
      tierRegularHours: shift.hours,
      tierOt1Hours: 0,
      tierOt2Hours: 0,
    }
  }

  // === Branch 2: standard OT + rest day calc (requires time info) ===
  // Overlap is measured against the full start→end span; an unpaid break can make
  // that span longer than the paid `hours`, so clamp to avoid negative regular hours.
  const restDayHours = (shift.startTime && shift.endTime)
    ? Math.min(calcRestDayOverlap(shift.date, shift.startTime, shift.endTime), shift.hours)
    : 0
  const regularHours = shift.hours - restDayHours

  // Build chronological segments. We need to know which hours are at the start vs end of the shift.
  const segments = buildSegments(shift, restDayHours)

  // Walk hour-by-hour, tracking position for OT tiering
  const threshold = settings.dailyHoursThreshold
  const restDayBonus = restDayBonusOf(settings)
  let hourlyCalc = 0
  let position = 0  // 0-indexed cumulative hours into the shift
  let tierRegular = 0, tierOt1 = 0, tierOt2 = 0

  for (const seg of segments) {
    let remaining = seg.hours
    while (remaining > 0.0001) {
      // Determine the OT tier of the current hour position
      let tierMult: number
      let nextBoundary: number
      if (position < threshold) {
        tierMult = 1.0
        nextBoundary = threshold
      } else if (position < threshold + 2) {
        tierMult = 1.25
        nextBoundary = threshold + 2
      } else {
        tierMult = 1.5
        nextBoundary = Infinity
      }
      // Apply the rest-day premium if this segment is inside the rest day window
      if (seg.isRestDay) tierMult += restDayBonus

      // How much of the segment falls in the current tier?
      const consume = Math.min(remaining, nextBoundary - position)

      hourlyCalc += consume * hourlyRate * tierMult

      // Track tier hours for the breakdown (using the base tier, not rest-day-bumped)
      if (position < threshold) tierRegular += consume
      else if (position < threshold + 2) tierOt1 += consume
      else tierOt2 += consume

      position += consume
      remaining -= consume
    }
  }

  // === Branch 3: tips are additive — they never replace the wage ===
  const gross = hourlyCalc + tips

  return {
    gross,
    hourlyCalc,
    tips,
    multiplierOverride: false,
    restDayHours,
    regularHours,
    tierRegularHours: tierRegular,
    tierOt1Hours: tierOt1,
    tierOt2Hours: tierOt2,
  }
}

function zeroBreakdown(hours: number): ShiftPayBreakdown {
  return {
    gross: 0,
    hourlyCalc: 0,
    tips: 0,
    multiplierOverride: false,
    restDayHours: 0,
    regularHours: hours,
    tierRegularHours: hours,
    tierOt1Hours: 0,
    tierOt2Hours: 0,
  }
}

// ===================================================================
// Mandatory rest break (hourly job)
// Any hourly shift longer than 6 hours (start → end) carries an unpaid
// 30-minute rest break. It is a floor, not an addition: if a longer break
// was logged, that one stands. Shared by the shift form, the demo seed and
// the historical backfill so all three price a shift identically.
// ===================================================================

/** Shifts longer than this, start → end in hours, get the automatic rest break. */
export const REST_BREAK_AFTER_HOURS = 6
/** Unpaid rest break deducted from those shifts, in minutes. */
export const REST_BREAK_MINUTES = 30

/**
 * Unpaid break to deduct from an hourly shift: whatever was logged, but never
 * less than the automatic rest break once the shift runs past 6 hours.
 * A shift of exactly 6:00 gets no automatic break; 6:01 does.
 */
export function restBreakMinutes(spanHours: number, loggedMinutes = 0): number {
  const logged = Number.isFinite(loggedMinutes) && loggedMinutes > 0 ? Math.floor(loggedMinutes) : 0
  const auto = spanHours - REST_BREAK_AFTER_HOURS > 1e-9 ? REST_BREAK_MINUTES : 0
  return Math.max(logged, auto)
}

/** Paid hours for a start → end span after an unpaid break, rounded to 2 decimals like the form. */
export function paidHours(spanHours: number, breakMinutes: number): number {
  return Math.round((spanHours - breakMinutes / 60) * 100) / 100
}

// ===================================================================
// Rest day window math
// Rest day window: Saturday 19:00 → Sunday 19:00 (24 hours).
// We anchor the window to the Saturday of the week containing the shift,
// then compute the overlap with the actual shift time range.
// ===================================================================

const REST_DAY_START_DAY = 6 // Saturday
const REST_DAY_START_HOUR = 19 // 7 PM
const REST_DAY_LENGTH_HOURS = 24

/** Legal minimum rest-day rate, used when settings predate the editable one. */
export const DEFAULT_REST_DAY_MULTIPLIER = 1.5

/**
 * How much the rest-day premium adds to an hour's OT tier.
 * A rest-day hour pays `tier + bonus`, so at the default 150% the familiar
 * 1.5 / 1.75 / 2.0 ladder falls out of the 1.0 / 1.25 / 1.5 OT tiers.
 * Guarded so a missing or nonsensical setting can never reduce pay below the tier.
 */
export function restDayBonusOf(settings: Pick<Settings, 'restDayMultiplier'>): number {
  const m = settings.restDayMultiplier
  if (!Number.isFinite(m) || m < 1) return DEFAULT_REST_DAY_MULTIPLIER - 1
  return m - 1
}

/** Returns hours of the shift that fall inside the rest day window. */
export function calcRestDayOverlap(date: string, startTime: string, endTime: string): number {
  const { shiftStart, shiftEnd } = parseShiftRange(date, startTime, endTime)
  const restStart = nearestRestDayStart(shiftStart)
  const restEnd = new Date(restStart.getTime() + REST_DAY_LENGTH_HOURS * 3600 * 1000)

  const overlapStart = Math.max(shiftStart.getTime(), restStart.getTime())
  const overlapEnd = Math.min(shiftEnd.getTime(), restEnd.getTime())
  if (overlapEnd <= overlapStart) return 0
  return (overlapEnd - overlapStart) / 3600000
}

function parseShiftRange(date: string, startTime: string, endTime: string): { shiftStart: Date; shiftEnd: Date } {
  const [sH, sM] = startTime.split(':').map(Number)
  const [eH, eM] = endTime.split(':').map(Number)
  const shiftStart = new Date(date + 'T00:00:00')
  shiftStart.setHours(sH, sM, 0, 0)
  const shiftEnd = new Date(date + 'T00:00:00')
  shiftEnd.setHours(eH, eM, 0, 0)
  if (shiftEnd <= shiftStart) {
    // Crosses midnight — end is next day
    shiftEnd.setDate(shiftEnd.getDate() + 1)
  }
  return { shiftStart, shiftEnd }
}

/** Returns the Saturday 19:00 closest to (and not far in the future of) the shift start. */
function nearestRestDayStart(shiftStart: Date): Date {
  // Find the Saturday of the same week as the shift
  const d = new Date(shiftStart)
  d.setHours(REST_DAY_START_HOUR, 0, 0, 0)
  const dow = d.getDay()
  // Move to Saturday of this week (or this Saturday if today is Saturday)
  const diffToSat = REST_DAY_START_DAY - dow
  d.setDate(d.getDate() + diffToSat)
  // If that put us AFTER the shift end window, try the previous Saturday
  // (covers Sunday shifts where "this week's Saturday" is actually tomorrow in our calc)
  // We want the Saturday that begins the rest day window covering THIS shift.
  // If d is AFTER shift start by more than 24 hours, go back one week.
  while (d.getTime() - shiftStart.getTime() > 24 * 3600 * 1000) {
    d.setDate(d.getDate() - 7)
  }
  // If shift start is AFTER d + 24h (i.e. shift is way after this rest day), advance
  while (shiftStart.getTime() - (d.getTime() + 24 * 3600 * 1000) > 0) {
    d.setDate(d.getDate() + 7)
  }
  return d
}

interface ShiftSegment {
  hours: number
  isRestDay: boolean
}

function buildSegments(
  shift: Pick<Shift, 'date' | 'startTime' | 'endTime' | 'hours'>,
  restDayHours: number,
): ShiftSegment[] {
  // If no rest day overlap or no time info, the whole shift is one segment
  if (restDayHours === 0 || !shift.startTime || !shift.endTime) {
    return [{ hours: shift.hours, isRestDay: false }]
  }
  if (restDayHours >= shift.hours - 0.0001) {
    return [{ hours: shift.hours, isRestDay: true }]
  }
  // Need to know the order: does the shift start in rest day or end in rest day?
  const { shiftStart } = parseShiftRange(shift.date, shift.startTime, shift.endTime)
  const restStart = nearestRestDayStart(shiftStart)
  const restEnd = new Date(restStart.getTime() + REST_DAY_LENGTH_HOURS * 3600 * 1000)

  const startsInRestDay = shiftStart >= restStart && shiftStart < restEnd

  if (startsInRestDay) {
    // Shift starts inside rest day, then exits → rest day hours come first
    return [
      { hours: restDayHours, isRestDay: true },
      { hours: shift.hours - restDayHours, isRestDay: false },
    ]
  } else {
    // Shift starts before rest day, then enters → regular hours come first
    return [
      { hours: shift.hours - restDayHours, isRestDay: false },
      { hours: restDayHours, isRestDay: true },
    ]
  }
}

// ===================================================================
// Monthly aggregation with deductions
// ===================================================================

export interface MonthlyBreakdown {
  weddingTotal: number
  weddingHours: number
  weddingShifts: number

  hourlyWages: number
  hourlyHours: number
  hourlyShifts: number
  /** Sum of the per-shift travel allowance across the month's hourly shifts. */
  hourlyTravel: number

  hourlyBituach: number
  hourlyPension: number
  hourlyTax: number

  hourlyNet: number
  totalGross: number
  totalNet: number
  totalHours: number
  totalShifts: number
}

export function calcMonthlyBreakdown(
  shifts: Shift[],
  settings: Settings,
): MonthlyBreakdown {
  let weddingTotal = 0, weddingHours = 0, weddingShifts = 0
  let hourlyWages = 0, hourlyHours = 0, hourlyShifts = 0, hourlyTravel = 0

  for (const s of shifts) {
    if (s.jobType === 'wedding') {
      weddingTotal += s.total
      weddingHours += s.hours
      weddingShifts += 1
    } else {
      // For hourly, total already includes tips (wage + tips)
      hourlyWages += s.total
      hourlyHours += s.hours
      hourlyShifts += 1
      // Travel is logged per shift and stays outside the taxable wage base.
      hourlyTravel += s.travel ?? 0
    }
  }

  const hourlyBituach = hourlyWages * settings.bituachRate
  const hourlyPension = settings.pensionActive ? hourlyWages * settings.pensionRate : 0
  const hourlyTax = hourlyWages * settings.incomeTaxRate

  const hourlyNet = hourlyWages + hourlyTravel - hourlyBituach - hourlyPension - hourlyTax
  const totalGross = weddingTotal + hourlyWages + hourlyTravel
  const totalNet = weddingTotal + hourlyNet

  return {
    weddingTotal, weddingHours, weddingShifts,
    hourlyWages, hourlyHours, hourlyShifts, hourlyTravel,
    hourlyBituach, hourlyPension, hourlyTax,
    hourlyNet, totalGross, totalNet,
    totalHours: weddingHours + hourlyHours,
    totalShifts: weddingShifts + hourlyShifts,
  }
}

// ===================================================================
// Restaurant hours by effective multiplier (for the report)
// Buckets each paid hour by the rate it was actually paid at, mirroring
// calcShiftPay's tiering (OT tiers + the rest-day premium). Which buckets
// appear depends on the OT threshold and restDayMultiplier, so they are
// computed rather than fixed: at the default 150% they come out as the
// familiar 100 / 125 / 150 / 175 / 200%. Shifts with a manual
// rate_multiplier are reported separately.
// This is additive — it does not change calcShiftPay.
// ===================================================================

export interface TierBucket {
  /** Effective multiplier for these hours — 1.25 means they were paid at 125%. */
  mult: number
  hours: number
  /** True when these hours fell inside the rest-day window. */
  restDay: boolean
}

export interface RestaurantTierHours {
  days: number          // distinct restaurant shift-dates
  shifts: number
  totalHours: number
  /** Hours grouped by what they actually paid, ascending by multiplier. */
  tiers: TierBucket[]
  overrideHours: number // hours on shifts with a manual rate_multiplier
  overrides: { mult: number; hours: number }[]
}

export function monthlyRestaurantTiers(shifts: Shift[], settings: Settings): RestaurantTierHours {
  const hourly = shifts.filter((s) => s.jobType === 'hourly')
  const days = new Set(hourly.map((s) => s.date)).size
  const threshold = settings.dailyHoursThreshold
  const restDayBonus = restDayBonusOf(settings)
  let totalHours = 0
  let overrideHours = 0
  const overrideMap = new Map<number, number>()
  // Keyed by multiplier + whether it was a rest-day hour, so the report can say
  // "150% rest day" and "150% overtime" apart even when they pay the same.
  const tierMap = new Map<string, TierBucket>()
  const addTier = (mult: number, restDay: boolean, hours: number) => {
    // Round the key so floating-point noise can't split one rate into two rows.
    const rounded = Math.round(mult * 10000) / 10000
    const key = `${rounded}|${restDay}`
    const bucket = tierMap.get(key)
    if (bucket) bucket.hours += hours
    else tierMap.set(key, { mult: rounded, hours, restDay })
  }

  for (const s of hourly) {
    totalHours += s.hours
    const mult = s.rateMultiplier ?? 1.0
    if (mult !== 1.0) {
      overrideHours += s.hours
      overrideMap.set(mult, (overrideMap.get(mult) ?? 0) + s.hours)
      continue
    }
    const restDayHours = (s.startTime && s.endTime)
      ? Math.min(calcRestDayOverlap(s.date, s.startTime, s.endTime), s.hours)
      : 0
    const segments = buildSegments(s, restDayHours)
    let position = 0
    for (const seg of segments) {
      let remaining = seg.hours
      while (remaining > 0.0001) {
        let baseMult: number
        let nextBoundary: number
        if (position < threshold) {
          baseMult = 1.0
          nextBoundary = threshold
        } else if (position < threshold + 2) {
          baseMult = 1.25
          nextBoundary = threshold + 2
        } else {
          baseMult = 1.5
          nextBoundary = Infinity
        }
        const eff = baseMult + (seg.isRestDay ? restDayBonus : 0)
        const consume = Math.min(remaining, nextBoundary - position)
        addTier(eff, seg.isRestDay, consume)
        position += consume
        remaining -= consume
      }
    }
  }

  return {
    days,
    shifts: hourly.length,
    totalHours,
    // Ascending by rate; rest-day hours last within the same rate.
    tiers: [...tierMap.values()].sort(
      (a, b) => a.mult - b.mult || Number(a.restDay) - Number(b.restDay),
    ),
    overrideHours,
    overrides: [...overrideMap.entries()].map(([mult, hours]) => ({ mult, hours })),
  }
}
