import { describe, it, expect } from 'vitest'
import { hoursBetween, parseTime, toIso, fromIso, buildMonthMatrix } from './utils'

describe('hoursBetween', () => {
  it('computes a normal daytime shift', () => {
    expect(hoursBetween('09:00', '17:00')).toBe(8)
  })

  it('handles a shift crossing midnight', () => {
    expect(hoursBetween('20:00', '02:30')).toBe(6.5)
    expect(hoursBetween('23:00', '00:00')).toBe(1)
    expect(hoursBetween('22:15', '06:45')).toBe(8.5)
  })

  it('treats equal start/end as a full 24h (documented edge)', () => {
    expect(hoursBetween('00:00', '00:00')).toBe(24)
  })

  it('returns null for invalid input', () => {
    expect(hoursBetween('25:00', '10:00')).toBeNull()
    expect(hoursBetween('abc', '10:00')).toBeNull()
    expect(hoursBetween('10:60', '11:00')).toBeNull()
  })
})

describe('parseTime', () => {
  it('parses HH:MM to minutes', () => {
    expect(parseTime('00:00')).toBe(0)
    expect(parseTime('08:30')).toBe(510)
    expect(parseTime('23:59')).toBe(1439)
  })
  it('rejects out-of-range values', () => {
    expect(parseTime('24:00')).toBeNull()
    expect(parseTime('12:60')).toBeNull()
  })
})

describe('toIso / fromIso', () => {
  it('round-trips a local date', () => {
    const iso = '2025-06-07'
    expect(toIso(fromIso(iso))).toBe(iso)
  })
  it('formats with zero-padding', () => {
    expect(toIso(new Date(2025, 0, 5))).toBe('2025-01-05')
  })
})

describe('buildMonthMatrix', () => {
  it('lays June 2025 out Sunday-first with padded weeks', () => {
    // June 2025: 1st is a Sunday, 30 days.
    const weeks = buildMonthMatrix(2025, 5)
    expect(weeks.every((w) => w.length === 7)).toBe(true)
    // First cell is the 1st (Sunday) — no leading blanks
    expect(weeks[0][0]?.day).toBe(1)
    // Total non-null cells == days in month
    const days = weeks.flat().filter(Boolean).length
    expect(days).toBe(30)
  })
})
