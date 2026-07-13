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
  hourlyMonthlyTravel: 150,
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
    expect(b.tipsWon).toBe(false)
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

describe('calcShiftPay — tip law and multiplier override', () => {
  it('pays the higher of computed wage vs tips (tips win)', () => {
    const b = calcShiftPay(hourly({ hours: 6, tips: 300 }), RATE, S)
    expect(b.hourlyCalc).toBeCloseTo(210, 4)
    expect(b.gross).toBeCloseTo(300, 4)
    expect(b.tipsWon).toBe(true)
  })

  it('rate multiplier overrides OT and rest-day entirely', () => {
    const b = calcShiftPay(hourly({ date: SAT, hours: 5, rateMultiplier: 1.5 }), RATE, S)
    expect(b.multiplierOverride).toBe(true)
    expect(b.restDayHours).toBe(0)
    expect(b.hourlyCalc).toBeCloseTo(5 * 35 * 1.5, 4) // 262.5
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
  it('sums wages, adds travel, and subtracts mandatory deductions', () => {
    const shifts: Shift[] = [
      s({ total: 400 }),
      s({ total: 600 }),
      s({ jobType: 'wedding', base: 200, tips: 150, total: 350 }),
    ]
    const b = calcMonthlyBreakdown(shifts, S)
    expect(b.hourlyWages).toBeCloseTo(1000, 4)
    expect(b.weddingTotal).toBeCloseTo(350, 4)
    expect(b.hourlyTravel).toBeCloseTo(150, 4)
    expect(b.hourlyBituach).toBeCloseTo(1000 * 0.0427, 4)
    expect(b.hourlyPension).toBeCloseTo(1000 * 0.06, 4)
    expect(b.hourlyTax).toBeCloseTo(1000 * 0.05, 4)
    // net = 1000 + 150 - 42.7 - 60 - 50
    expect(b.hourlyNet).toBeCloseTo(1000 + 150 - 42.7 - 60 - 50, 4)
    expect(b.totalNet).toBeCloseTo(350 + b.hourlyNet, 4)
  })

  it('omits travel and pension when appropriate', () => {
    const noPension: Settings = { ...S, pensionActive: false }
    const b = calcMonthlyBreakdown([s({ total: 500 })], noPension)
    expect(b.hourlyPension).toBe(0)
    expect(b.hourlyTravel).toBeCloseTo(150, 4) // travel present when there are hourly shifts
  })
})

describe('monthlyRestaurantTiers', () => {
  it('buckets hours by effective multiplier across a month', () => {
    const shifts: Shift[] = [
      s({ date: WED, startTime: '15:00', endTime: '02:00', hours: 11 }), // 8@100 2@125 1@150
      s({ date: SAT, startTime: '18:00', endTime: '05:00', hours: 11 }), // 1@100 7@150 2@175 1@200
      s({ date: '2025-06-11', startTime: '17:00', endTime: '23:00', hours: 6, rateMultiplier: 1.5 }), // override
      s({ jobType: 'wedding', hours: 5 }), // ignored
    ]
    const tiers = monthlyRestaurantTiers(shifts, S)
    expect(tiers.shifts).toBe(3)
    expect(tiers.days).toBe(3)
    expect(tiers.totalHours).toBeCloseTo(28, 4)
    expect(tiers.h100).toBeCloseTo(9, 4) // 8 + 1
    expect(tiers.h125).toBeCloseTo(2, 4)
    expect(tiers.h150).toBeCloseTo(8, 4) // 1 + 7
    expect(tiers.h175).toBeCloseTo(2, 4)
    expect(tiers.h200).toBeCloseTo(1, 4)
    expect(tiers.overrideHours).toBeCloseTo(6, 4)
    // buckets + override should equal total hours
    const sum = tiers.h100 + tiers.h125 + tiers.h150 + tiers.h175 + tiers.h200 + tiers.overrideHours
    expect(sum).toBeCloseTo(tiers.totalHours, 4)
  })
})
