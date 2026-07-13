import { describe, it, expect } from 'vitest'
import { aggregate, filterByDateRange, jobSplit, pctDelta } from './calc'
import type { Shift } from '../types'

function s(partial: Partial<Shift>): Shift {
  return {
    date: '2025-06-10', jobType: 'hourly', hours: 6, base: 210, tips: 0, expenses: 0,
    total: 210, rateMultiplier: 1, createdAt: 0, ...partial,
  }
}

describe('aggregate', () => {
  it('sums totals/hours and derives effective rate + average', () => {
    const a = aggregate([
      s({ total: 300, hours: 5, base: 200, tips: 100 }),
      s({ total: 500, hours: 10, base: 350, tips: 150 }),
    ])
    expect(a.count).toBe(2)
    expect(a.total).toBe(800)
    expect(a.hours).toBe(15)
    expect(a.tips).toBe(250)
    expect(a.effectiveRate).toBeCloseTo(800 / 15, 4)
    expect(a.avgPerShift).toBeCloseTo(400, 4)
  })

  it('returns zeros (no divide-by-zero) for an empty set', () => {
    const a = aggregate([])
    expect(a.count).toBe(0)
    expect(a.effectiveRate).toBe(0)
    expect(a.avgPerShift).toBe(0)
  })
})

describe('filterByDateRange', () => {
  const shifts = [s({ date: '2025-05-31' }), s({ date: '2025-06-01' }), s({ date: '2025-06-30' }), s({ date: '2025-07-01' })]
  it('includes the month inclusive of both ends', () => {
    const inMonth = filterByDateRange(shifts, '2025-06-01', '2025-06-30')
    expect(inMonth.map((x) => x.date)).toEqual(['2025-06-01', '2025-06-30'])
  })
  it('is open-ended when no upper bound is given', () => {
    expect(filterByDateRange(shifts, '2025-06-30').map((x) => x.date)).toEqual(['2025-06-30', '2025-07-01'])
  })
})

describe('jobSplit', () => {
  it('splits totals by job and computes shares', () => {
    const split = jobSplit([
      s({ jobType: 'wedding', total: 300 }),
      s({ jobType: 'hourly', total: 100 }),
    ])
    expect(split.wedding.total).toBe(300)
    expect(split.hourly.total).toBe(100)
    expect(split.weddingShare).toBeCloseTo(0.75, 4)
    expect(split.hourlyShare).toBeCloseTo(0.25, 4)
  })
})

describe('pctDelta', () => {
  it('computes percentage change', () => {
    expect(pctDelta(120, 100)).toBeCloseTo(20, 4)
    expect(pctDelta(80, 100)).toBeCloseTo(-20, 4)
  })
  it('returns null when the previous period is zero (avoids Infinity)', () => {
    expect(pctDelta(100, 0)).toBeNull()
  })
})
