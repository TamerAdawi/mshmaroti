/**
 * Israeli labor law calculations for restaurant (hourly) job.
 * v2.2: rest day is a time window (default Sat 19:00 → Sun 19:00), not a whole day.
 * Per-shift rate multiplier overrides OT and rest day calcs when != 1.0.
 * Tips law: gross = max(hourly_calc, tips) per shift.
 */
import type { Shift } from '../types'
import type { Settings } from './settings'

// ===================================================================
// Per-shift breakdown
// ===================================================================

export interface ShiftPayBreakdown {
  /** Final gross paid for the shift (after multiplier OR OT+rest day, then max with tips). */
  gross: number
  /** What the hourly calc alone produced (before tips comparison). */
  hourlyCalc: number
  /** True if tips exceeded hourly_calc and "won" (gross = tips). */
  tipsWon: boolean
  /** True if rate multiplier override was applied (skips OT + rest day). */
  multiplierOverride: boolean
  /** Hours in rest day window (Sat 19:00 → Sun 19:00). */
  restDayHours: number
  /** Hours outside rest day window. */
  regularHours: number
  /** Hours at base tier (×1.0 outside, ×1.5 inside rest day). */
  tierRegularHours: number
  /** Hours at OT tier 1 (×1.25 outside, ×1.75 inside). */
  tierOt1Hours: number
  /** Hours at OT tier 2 (×1.5 outside, ×2.0 inside). */
  tierOt2Hours: number
}

/**
 * Compute restaurant shift gross.
 *
 * Logic order:
 *   1. If rateMultiplier != 1.0 → simple: hours × rate × multiplier (no OT, no rest day).
 *   2. Otherwise → compute rest day overlap by time, apply OT tiers per hour position.
 *   3. If shift has tips and tips > hourlyCalc → gross = tips (Israeli tip law).
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
    const tipsWon = tips > hourlyCalc
    return {
      gross: Math.max(hourlyCalc, tips),
      hourlyCalc,
      tipsWon,
      multiplierOverride: true,
      restDayHours: 0,
      regularHours: shift.hours,
      tierRegularHours: shift.hours,
      tierOt1Hours: 0,
      tierOt2Hours: 0,
    }
  }

  // === Branch 2: standard OT + rest day calc (requires time info) ===
  const restDayHours = (shift.startTime && shift.endTime)
    ? calcRestDayOverlap(shift.date, shift.startTime, shift.endTime)
    : 0
  const regularHours = shift.hours - restDayHours

  // Build chronological segments. We need to know which hours are at the start vs end of the shift.
  const segments = buildSegments(shift, restDayHours)

  // Walk hour-by-hour, tracking position for OT tiering
  const threshold = settings.dailyHoursThreshold
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
      // Apply rest day bonus (+0.5) if this segment is inside rest day window
      if (seg.isRestDay) tierMult += 0.5

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

  // === Branch 3: tips vs hourly law ===
  const tipsWon = tips > hourlyCalc
  const gross = Math.max(hourlyCalc, tips)

  return {
    gross,
    hourlyCalc,
    tipsWon,
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
    tipsWon: false,
    multiplierOverride: false,
    restDayHours: 0,
    regularHours: hours,
    tierRegularHours: hours,
    tierOt1Hours: 0,
    tierOt2Hours: 0,
  }
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
  let hourlyWages = 0, hourlyHours = 0, hourlyShifts = 0

  for (const s of shifts) {
    if (s.jobType === 'wedding') {
      weddingTotal += s.total
      weddingHours += s.hours
      weddingShifts += 1
    } else {
      // For hourly, total already reflects max(base, tips) per tip law
      hourlyWages += s.total
      hourlyHours += s.hours
      hourlyShifts += 1
    }
  }

  const hourlyTravel = hourlyShifts > 0 ? settings.hourlyMonthlyTravel : 0
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
