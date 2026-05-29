/**
 * Israeli labor law calculations for restaurant (hourly) job.
 * Based on חוק שעות עבודה ומנוחה and Venaro contract specifics.
 *
 * NOT applied to wedding job — that's flat cash, no deductions.
 */
import type { Shift } from '../types'
import type { Settings } from './settings'

// ===================================================================
// OT tier calculation — DAILY level
// ===================================================================

export interface ShiftPayBreakdown {
  /** Total gross for this shift, after all multipliers. */
  gross: number
  /** Hours at regular rate (×1.0 or ×1.5 on rest day). */
  regularHours: number
  /** Hours at first OT tier (×1.25 or ×1.75 on rest day). */
  otTier1Hours: number
  /** Hours at second OT tier (×1.5 or ×2.0 on rest day). */
  otTier2Hours: number
  /** True if this shift was on the configured rest day. */
  isRestDay: boolean
  /** Effective multipliers used (varies by rest day status). */
  multipliers: { regular: number; ot1: number; ot2: number }
}

/**
 * Compute restaurant shift gross based on Israeli labor law.
 *
 * Rules:
 *   - Hours 1..threshold:                 ×1.00 (regular)
 *   - Hours threshold+1..threshold+2:    ×1.25 (OT tier 1)
 *   - Hours threshold+3..:                ×1.50 (OT tier 2)
 *   - On rest day, all multipliers +0.50 (stacking, per case law)
 *
 * Hours are passed as a decimal (e.g. 8.5h). No rounding.
 *
 * @param shift The shift to calculate
 * @param hourlyRate Base hourly rate (e.g. 35 ₪/hr)
 * @param settings User settings (threshold, rest day, etc.)
 */
export function calcShiftPay(
  shift: Pick<Shift, 'date' | 'jobType' | 'hours'>,
  hourlyRate: number,
  settings: Settings,
): ShiftPayBreakdown {
  // Wedding shifts don't use this — they're flat. Caller should not invoke this.
  // But return zero breakdown defensively.
  if (shift.jobType !== 'hourly') {
    return {
      gross: 0,
      regularHours: shift.hours,
      otTier1Hours: 0,
      otTier2Hours: 0,
      isRestDay: false,
      multipliers: { regular: 1, ot1: 1.25, ot2: 1.5 },
    }
  }

  const isRestDay = getDayOfWeek(shift.date) === settings.restDayOfWeek
  const threshold = settings.dailyHoursThreshold

  // Israeli law (case law from בית הדין הארצי, ע"ע 38313-03-18):
  // Rest day stacking is additive on the multiplier portion:
  //   regular rate (1.0) + rest day bump (0.5) = 1.5
  //   regular rate + rest day + OT1 (0.25) = 1.75
  //   regular rate + rest day + OT2 (0.5) = 2.0
  const regularMult = isRestDay ? 1.5 : 1.0
  const ot1Mult = isRestDay ? 1.75 : 1.25
  const ot2Mult = isRestDay ? 2.0 : 1.5

  let remaining = shift.hours
  let gross = 0
  let regularHours = 0
  let otTier1Hours = 0
  let otTier2Hours = 0

  // Tier 1: regular hours up to threshold (default 8)
  const regAvailable = Math.min(remaining, threshold)
  if (regAvailable > 0) {
    regularHours = regAvailable
    gross += regAvailable * hourlyRate * regularMult
    remaining -= regAvailable
  }

  // Tier 2: first 2 OT hours at ×1.25 (or ×1.75 on rest day)
  const ot1Available = Math.min(remaining, 2)
  if (ot1Available > 0) {
    otTier1Hours = ot1Available
    gross += ot1Available * hourlyRate * ot1Mult
    remaining -= ot1Available
  }

  // Tier 3: all remaining OT at ×1.50 (or ×2.0 on rest day)
  if (remaining > 0) {
    otTier2Hours = remaining
    gross += remaining * hourlyRate * ot2Mult
  }

  return {
    gross,
    regularHours,
    otTier1Hours,
    otTier2Hours,
    isRestDay,
    multipliers: { regular: regularMult, ot1: ot1Mult, ot2: ot2Mult },
  }
}

// ===================================================================
// Monthly aggregates with deductions
// ===================================================================

export interface MonthlyBreakdown {
  weddingTotal: number           // wedding cash, no deductions
  weddingHours: number
  weddingShifts: number

  hourlyWages: number            // sum of all restaurant shift gross
  hourlyHours: number
  hourlyShifts: number
  hourlyTravel: number           // monthly flat נסיעות (added once)

  hourlyBituach: number          // Bituach Leumi deduction
  hourlyPension: number          // pension deduction
  hourlyTax: number              // income tax deduction

  hourlyNet: number              // wages + travel − bituach − pension − tax
  totalGross: number             // wedding + hourly_wages + travel
  totalNet: number               // wedding + hourly_net
  totalHours: number
  totalShifts: number
}

/**
 * Aggregate a set of shifts for a month with full deduction calculations.
 * The travel allowance is added only if there's at least 1 restaurant shift.
 */
export function calcMonthlyBreakdown(
  shifts: Shift[],
  settings: Settings,
): MonthlyBreakdown {
  let weddingTotal = 0,
    weddingHours = 0,
    weddingShifts = 0
  let hourlyWages = 0,
    hourlyHours = 0,
    hourlyShifts = 0

  for (const s of shifts) {
    if (s.jobType === 'wedding') {
      weddingTotal += s.total
      weddingHours += s.hours
      weddingShifts += 1
    } else {
      // Use the stored .base as the gross wage (calculated by NewShift form)
      hourlyWages += s.base
      hourlyHours += s.hours
      hourlyShifts += 1
    }
  }

  const hourlyTravel = hourlyShifts > 0 ? settings.hourlyMonthlyTravel : 0

  // Bituach Leumi applies to wages, not travel (travel is tax-exempt up to legal cap)
  const hourlyBituach = hourlyWages * settings.bituachRate
  const hourlyPension = settings.pensionActive ? hourlyWages * settings.pensionRate : 0
  const hourlyTax = hourlyWages * settings.incomeTaxRate

  const hourlyNet = hourlyWages + hourlyTravel - hourlyBituach - hourlyPension - hourlyTax
  const totalGross = weddingTotal + hourlyWages + hourlyTravel
  const totalNet = weddingTotal + hourlyNet

  return {
    weddingTotal,
    weddingHours,
    weddingShifts,
    hourlyWages,
    hourlyHours,
    hourlyShifts,
    hourlyTravel,
    hourlyBituach,
    hourlyPension,
    hourlyTax,
    hourlyNet,
    totalGross,
    totalNet,
    totalHours: weddingHours + hourlyHours,
    totalShifts: weddingShifts + hourlyShifts,
  }
}

// ===================================================================
// Weekly OT awareness (informational, for the dashboard tile)
// ===================================================================

export interface WeeklyOTSummary {
  totalRegularHours: number
  weeklyOTHours: number
  weeksAnalyzed: number
}

/**
 * Analyze restaurant shifts for weekly OT — hours above 42/week
 * AFTER daily OT has already been counted.
 * This is an informational metric; it doesn't currently feed back into the
 * shift base (Israeli payroll is typically reconciled at month-end anyway).
 */
export function calcWeeklyOT(shifts: Shift[], settings: Settings): WeeklyOTSummary {
  const weekly = new Map<string, { regular: number; ot: number }>()
  for (const s of shifts) {
    if (s.jobType !== 'hourly') continue
    const weekKey = isoWeekKey(s.date)
    const entry = weekly.get(weekKey) ?? { regular: 0, ot: 0 }
    // Approximation: hours up to threshold are "regular", rest are daily OT
    const reg = Math.min(s.hours, settings.dailyHoursThreshold)
    const ot = s.hours - reg
    entry.regular += reg
    entry.ot += ot
    weekly.set(weekKey, entry)
  }
  let totalRegular = 0
  let weeklyOT = 0
  for (const { regular } of weekly.values()) {
    totalRegular += regular
    if (regular > settings.weeklyHoursMax) {
      weeklyOT += regular - settings.weeklyHoursMax
    }
  }
  return {
    totalRegularHours: totalRegular,
    weeklyOTHours: weeklyOT,
    weeksAnalyzed: weekly.size,
  }
}

// ===================================================================
// Helpers
// ===================================================================

/** 0 = Sunday, 1 = Monday, ..., 6 = Saturday */
function getDayOfWeek(iso: string): number {
  return new Date(iso + 'T00:00:00').getDay()
}

/** "2026-W21" — ISO week of the year. */
function isoWeekKey(iso: string): string {
  const d = new Date(iso + 'T00:00:00')
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() + 4 - (d.getDay() || 7))
  const yearStart = new Date(d.getFullYear(), 0, 1)
  const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
  return `${d.getFullYear()}-W${String(weekNo).padStart(2, '0')}`
}
