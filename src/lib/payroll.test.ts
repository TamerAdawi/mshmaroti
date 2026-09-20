import { describe, it, expect } from 'vitest'
import {
  calcShiftPay,
  calcRestDayOverlap,
  calcMonthlyBreakdown,
  monthlyRestaurantTiers,
} from './payroll'
import type { Settings } from './settings'
import type { Shift } from '../types'

const RATE = 35

const S: Settings = {
  weddingRate: 200,
  hourlyRate: RATE,
  weddingName: 'אולם',
  hourlyName: 'מסעדה',
  weeklyHoursMax: 42,
  restDayOfWeek: 6,
  dailyHoursThreshold: 8,
  restDayMultiplier: 1.5,
  bituachRate: 0.0427,
  pensionRate: 0.06,
  pensionActive: true,
  incomeTaxRate: 0.05,
}

// June 2025: 1st is Sunday → 4th Wed, 6th Fri, 7th Sat.
const WED = '2025-06-04'
const FRI = '2025-06-06'
const SAT = '2025-06-07'

type ShiftInput = Parameters<typeof calcShiftPay>[0]
function hourly(partial: Partial<ShiftInput>): ShiftInput {
  return { date: WED, jobType: 'hourly', hours: 6, tips: 0, rateMultiplier: 1, ...partial }
}

describe('calcShiftPay — regular hours', () => {
  it('pays straight time below the daily threshold', () => {
    const b = calcShiftPay(hourly({ startTime: '16:00', endTime: '22:00', hours: 6 }), RATE, S)
    expect(b.hourlyCalc).toBeCloseTo(6 * 35, 4) // 210
    expect(b.gross).toBeCloseTo(210, 4)
    expect(b.restDayHours).toBe(0)
    expect(b.tierRegularHours).toBeCloseTo(6, 4)
    expect(b.tierOt1Hours).toBe(0)
    expect(b.tips).toBe(0)
  })

  it('pays exactly the 8h threshold as all straight time (no OT)', () => {
    const b = calcShiftPay(hourly({ startTime: '14:00', endTime: '22:00', hours: 8 }), RATE, S)
    expect(b.hourlyCalc).toBeCloseTo(8 * 35, 4) // 280
    expect(b.tierRegularHours).toBeCloseTo(8, 4)
    expect(b.tierOt1Hours).toBe(0)
  })
})

describe('calcShiftPay — overtime tiers (125% then 150%)', () => {
  it('applies 125% just past 8h', () => {
    // 8.5h → 8@100% + 0.5@125%
    const b = calcShiftPay(hourly({ hours: 8.5 }), RATE, S)
    expect(b.hourlyCalc).toBeCloseTo(8 * 35 + 0.5 * 35 * 1.25, 4) // 301.875
    expect(b.tierRegularHours).toBeCloseTo(8, 4)
    expect(b.tierOt1Hours).toBeCloseTo(0.5, 4)
  })

  it('applies 125% for hours 9-10 and 150% beyond 10 (11h shift)', () => {
    const b = calcShiftPay(hourly({ startTime: '15:00', endTime: '02:00', hours: 11 }), RATE, S)
    // 8@100 + 2@125 + 1@150 = 280 + 87.5 + 52.5 = 420
    expect(b.hourlyCalc).toBeCloseTo(420, 4)
    expect(b.tierRegularHours).toBeCloseTo(8, 4)
    expect(b.tierOt1Hours).toBeCloseTo(2, 4)
    expect(b.tierOt2Hours).toBeCloseTo(1, 4)
  })

  it('applies OT even for a direct-hours shift with no start/end time', () => {
    const b = calcShiftPay(hourly({ startTime: undefined, endTime: undefined, hours: 10 }), RATE, S)
    expect(b.hourlyCalc).toBeCloseTo(8 * 35 + 2 * 35 * 1.25, 4) // 367.5
    expect(b.restDayHours).toBe(0)
  })
})

describe('calcShiftPay — Shabbat (rest-day) premiums', () => {
  it('adds +0.5x for hours inside the Sat 19:00 → Sun 19:00 window', () => {
    // Sat 20:00 → Sun 02:00 = 6h, all inside the window → all at 150%
    const b = calcShiftPay(hourly({ date: SAT, startTime: '20:00', endTime: '02:00', hours: 6 }), RATE, S)
    expect(b.restDayHours).toBeCloseTo(6, 4)
    expect(b.regularHours).toBeCloseTo(0, 4)
    expect(b.hourlyCalc).toBeCloseTo(6 * 35 * 1.5, 4) // 315
  })

  it('stacks OT on top of Shabbat: 150% / 175% / 200% across a long Saturday shift', () => {
    // Sat 18:00 → Sun 05:00 = 11h. Overlap with window (Sat19→Sun19) = 10h.
    // 1h regular@100 + 7h rest@150 + 2h rest-OT1@175 + 1h rest-OT2@200
    const b = calcShiftPay(hourly({ date: SAT, startTime: '18:00', endTime: '05:00', hours: 11 }), RATE, S)
    expect(b.restDayHours).toBeCloseTo(10, 4)
    const expected = 1 * 35 * 1.0 + 7 * 35 * 1.5 + 2 * 35 * 1.75 + 1 * 35 * 2.0 // 595
    expect(b.hourlyCalc).toBeCloseTo(expected, 4)
    expect(b.hourlyCalc).toBeCloseTo(595, 4)
  })

  it('does NOT treat Friday night as rest day (window starts Sat 19:00)', () => {
    const b = calcShiftPay(hourly({ date: FRI, startTime: '20:00', endTime: '23:00', hours: 3 }), RATE, S)
    expect(b.restDayHours).toBe(0)
    expect(b.hourlyCalc).toBeCloseTo(3 * 35, 4)
  })
})

describe('calcShiftPay — configurable rest-day rate', () => {
  const at = (pct: number): Settings => ({ ...S, restDayMultiplier: pct / 100 })

  it('pays rest-day hours at the configured rate', () => {
    const b = calcShiftPay(hourly({ date: SAT, startTime: '20:00', endTime: '02:00', hours: 6 }), RATE, at(175))
    expect(b.hourlyCalc).toBeCloseTo(6 * 35 * 1.75, 4) // 367.5, not 315
  })

  it('stacks overtime on top of the configured rate', () => {
    // Same 11h Saturday shift as above, but at a 175% rest-day rate:
    // 1h@100 + 7h@175 + 2h@200 + 1h@225
    const b = calcShiftPay(hourly({ date: SAT, startTime: '18:00', endTime: '05:00', hours: 11 }), RATE, at(175))
    const expected = 1 * 35 * 1.0 + 7 * 35 * 1.75 + 2 * 35 * 2.0 + 1 * 35 * 2.25
    expect(b.hourlyCalc).toBeCloseTo(expected, 4)
  })

  it('leaves non-rest-day hours untouched', () => {
    const b = calcShiftPay(hourly({ date: WED, startTime: '15:00', endTime: '02:00', hours: 11 }), RATE, at(200))
    expect(b.hourlyCalc).toBeCloseTo(420, 4) // identical to the 150% case
  })

  it('never pays below the tier when the setting is missing or nonsensical', () => {
    const broken = { ...S, restDayMultiplier: 0.5 } as Settings
    const b = calcShiftPay(hourly({ date: SAT, startTime: '20:00', endTime: '02:00', hours: 6 }), RATE, broken)
    expect(b.hourlyCalc).toBeCloseTo(6 * 35 * 1.5, 4) // falls back to the legal 150%
  })
})

describe('calcShiftPay — tips and multiplier override', () => {
  it('adds tips on top of the computed wage', () => {
    const b = calcShiftPay(hourly({ hours: 6, tips: 300 }), RATE, S)
    expect(b.hourlyCalc).toBeCloseTo(210, 4)
    expect(b.gross).toBeCloseTo(510, 4)
    expect(b.tips).toBeCloseTo(300, 4)
  })

  it('counts tips even when they are smaller than the wage', () => {
    // The case the old max() rule swallowed: 6h at 35 = 210 wage, 50 in tips.
    const b = calcShiftPay(hourly({ hours: 6, tips: 50 }), RATE, S)
    expect(b.hourlyCalc).toBeCloseTo(210, 4)
    expect(b.gross).toBeCloseTo(260, 4)
  })

  it('adds tips on top of an overtime + rest-day shift too', () => {
    // Sat 18:00 → Sun 05:00 = 595 in wages (see the Shabbat suite), plus 200 tips.
    const b = calcShiftPay(hourly({ date: SAT, startTime: '18:00', endTime: '05:00', hours: 11, tips: 200 }), RATE, S)
    expect(b.hourlyCalc).toBeCloseTo(595, 4)
    expect(b.gross).toBeCloseTo(795, 4)
  })

  it('rate multiplier overrides OT and rest-day entirely, and still keeps tips', () => {
    const b = calcShiftPay(hourly({ date: SAT, hours: 5, rateMultiplier: 1.5, tips: 40 }), RATE, S)
    expect(b.multiplierOverride).toBe(true)
    expect(b.restDayHours).toBe(0)
    expect(b.hourlyCalc).toBeCloseTo(5 * 35 * 1.5, 4) // 262.5
    expect(b.gross).toBeCloseTo(262.5 + 40, 4)
  })

  it('wedding shifts are a no-op for the hourly engine', () => {
    const b = calcShiftPay(hourly({ jobType: 'wedding', hours: 5 }), RATE, S)
    expect(b.gross).toBe(0)
    expect(b.hourlyCalc).toBe(0)
  })
})

describe('calcRestDayOverlap', () => {
  it('is 0 for a weekday shift', () => {
    expect(calcRestDayOverlap(WED, '16:00', '22:00')).toBe(0)
  })
  it('is 0 for Friday night (before the window opens)', () => {
    expect(calcRestDayOverlap(FRI, '20:00', '23:00')).toBe(0)
  })
  it('counts hours inside the Saturday window', () => {
    expect(calcRestDayOverlap(SAT, '20:00', '02:00')).toBeCloseTo(6, 4)
    expect(calcRestDayOverlap(SAT, '18:00', '05:00')).toBeCloseTo(10, 4)
  })
})

// ---- monthly aggregation ----
function s(partial: Partial<Shift>): Shift {
  return {
    date: WED, jobType: 'hourly', hours: 6, base: 210, tips: 0, expenses: 0,
    total: 210, rateMultiplier: 1, createdAt: 0, ...partial,
  }
}

describe('calcMonthlyBreakdown', () => {
  it('sums wages, adds per-shift travel, and subtracts mandatory deductions', () => {
    const shifts: Shift[] = [
      s({ total: 400, travel: 30 }),
      s({ total: 600, travel: 20 }),
      s({ jobType: 'wedding', base: 200, tips: 150, total: 350 }),
    ]
    const b = calcMonthlyBreakdown(shifts, S)
    expect(b.hourlyWages).toBeCloseTo(1000, 4)
    expect(b.weddingTotal).toBeCloseTo(350, 4)
    expect(b.hourlyTravel).toBeCloseTo(50, 4) // 30 + 20, summed from the shifts
    expect(b.hourlyBituach).toBeCloseTo(1000 * 0.0427, 4)
    expect(b.hourlyPension).toBeCloseTo(1000 * 0.06, 4)
    expect(b.hourlyTax).toBeCloseTo(1000 * 0.05, 4)
    // net = 1000 + 50 - 42.7 - 60 - 50 — travel is added untaxed
    expect(b.hourlyNet).toBeCloseTo(1000 + 50 - 42.7 - 60 - 50, 4)
    expect(b.totalNet).toBeCloseTo(350 + b.hourlyNet, 4)
  })

  it('reports no travel when no shift logged any', () => {
    const noPension: Settings = { ...S, pensionActive: false }
    const b = calcMonthlyBreakdown([s({ total: 500 })], noPension)
    expect(b.hourlyPension).toBe(0)
    expect(b.hourlyTravel).toBe(0)
  })

  it('ignores travel logged against a wedding shift', () => {
    const b = calcMonthlyBreakdown([s({ jobType: 'wedding', total: 350, travel: 99 })], S)
    expect(b.hourlyTravel).toBe(0)
    expect(b.totalGross).toBeCloseTo(350, 4)
  })
})

describe('monthlyRestaurantTiers', () => {
  /** Total hours reported at a given effective multiplier. */
  const at = (tiers: { tiers: { mult: number; hours: number }[] }, mult: number) =>
    tiers.tiers.filter((b) => Math.abs(b.mult - mult) < 1e-6).reduce((n, b) => n + b.hours, 0)

  const month: Shift[] = [
    s({ date: WED, startTime: '15:00', endTime: '02:00', hours: 11 }), // 8@100 2@125 1@150
    s({ date: SAT, startTime: '18:00', endTime: '05:00', hours: 11 }), // 1@100 7@150 2@175 1@200
    s({ date: '2025-06-11', startTime: '17:00', endTime: '23:00', hours: 6, rateMultiplier: 1.5 }), // override
    s({ jobType: 'wedding', hours: 5 }), // ignored
  ]

  it('buckets hours by effective multiplier across a month', () => {
    const tiers = monthlyRestaurantTiers(month, S)
    expect(tiers.shifts).toBe(3)
    expect(tiers.days).toBe(3)
    expect(tiers.totalHours).toBeCloseTo(28, 4)
    expect(at(tiers, 1.0)).toBeCloseTo(9, 4) // 8 + 1
    expect(at(tiers, 1.25)).toBeCloseTo(2, 4)
    expect(at(tiers, 1.5)).toBeCloseTo(8, 4) // 1 OT2 + 7 rest-day base
    expect(at(tiers, 1.75)).toBeCloseTo(2, 4)
    expect(at(tiers, 2.0)).toBeCloseTo(1, 4)
    expect(tiers.overrideHours).toBeCloseTo(6, 4)
    // buckets + override should equal total hours
    const sum = tiers.tiers.reduce((n, b) => n + b.hours, 0) + tiers.overrideHours
    expect(sum).toBeCloseTo(tiers.totalHours, 4)
  })

  it('keeps rest-day and overtime hours apart even at the same rate', () => {
    const tiers = monthlyRestaurantTiers(month, S)
    // At the default 150% both the OT-tier-2 hour and the rest-day base hours pay
    // 150%, but they are different kinds of hour and get their own rows.
    const at150 = tiers.tiers.filter((b) => Math.abs(b.mult - 1.5) < 1e-6)
    expect(at150).toHaveLength(2)
    expect(at150.find((b) => !b.restDay)?.hours).toBeCloseTo(1, 4)
    expect(at150.find((b) => b.restDay)?.hours).toBeCloseTo(7, 4)
  })

  it('follows the configured rest-day rate', () => {
    const tiers = monthlyRestaurantTiers(month, { ...S, restDayMultiplier: 1.75 })
    // The Saturday shift's rest-day hours move up a rung: 175 / 200 / 225.
    expect(at(tiers, 1.75)).toBeCloseTo(7, 4)
    expect(at(tiers, 2.0)).toBeCloseTo(2, 4)
    expect(at(tiers, 2.25)).toBeCloseTo(1, 4)
    // Weekday hours are unaffected.
    expect(at(tiers, 1.0)).toBeCloseTo(9, 4)
    expect(at(tiers, 1.25)).toBeCloseTo(2, 4)
    expect(at(tiers, 1.5)).toBeCloseTo(1, 4) // only the weekday OT-tier-2 hour now
    const sum = tiers.tiers.reduce((n, b) => n + b.hours, 0) + tiers.overrideHours
    expect(sum).toBeCloseTo(tiers.totalHours, 4)
  })

  it('returns buckets sorted ascending by rate', () => {
    const tiers = monthlyRestaurantTiers(month, S)
    const mults = tiers.tiers.map((b) => b.mult)
    expect(mults).toEqual([...mults].sort((a, b) => a - b))
  })
})
