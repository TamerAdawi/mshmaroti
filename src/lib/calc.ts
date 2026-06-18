import type { Shift } from '../types'
import { daysAgoIso, startOfMonthIso, endOfMonthIso, startOfWeekIso, todayIso } from './utils'

export interface Aggregate {
  total: number
  base: number
  tips: number
  hours: number
  count: number
  /** Effective ₪/hr including tips. 0 if hours == 0. */
  effectiveRate: number
  /** Average total per shift. 0 if count == 0. */
  avgPerShift: number
}

const EMPTY: Aggregate = {
  total: 0,
  base: 0,
  tips: 0,
  hours: 0,
  count: 0,
  effectiveRate: 0,
  avgPerShift: 0,
}

export function aggregate(shifts: Shift[]): Aggregate {
  if (shifts.length === 0) return EMPTY
  let total = 0,
    base = 0,
    tips = 0,
    hours = 0
  for (const s of shifts) {
    total += s.total
    base += s.base
    tips += s.tips
    hours += s.hours
  }
  return {
    total,
    base,
    tips,
    hours,
    count: shifts.length,
    effectiveRate: hours > 0 ? total / hours : 0,
    avgPerShift: total / shifts.length,
  }
}

export function filterByDateRange(shifts: Shift[], fromIso: string, toIsoEx?: string): Shift[] {
  if (!toIsoEx) return shifts.filter((s) => s.date >= fromIso)
  return shifts.filter((s) => s.date >= fromIso && s.date <= toIsoEx)
}

export function todayAgg(shifts: Shift[]): Aggregate {
  const today = todayIso()
  return aggregate(shifts.filter((s) => s.date === today))
}

export function weekAgg(shifts: Shift[]): Aggregate {
  return aggregate(filterByDateRange(shifts, startOfWeekIso()))
}

export function monthAgg(shifts: Shift[], offset = 0): Aggregate {
  return aggregate(filterByDateRange(shifts, startOfMonthIso(offset), endOfMonthIso(offset)))
}

export interface JobSplit {
  wedding: Aggregate
  hourly: Aggregate
  /** Share of total by job, 0..1 */
  weddingShare: number
  hourlyShare: number
}

export function jobSplit(shifts: Shift[]): JobSplit {
  const wedding = aggregate(shifts.filter((s) => s.jobType === 'wedding'))
  const hourly = aggregate(shifts.filter((s) => s.jobType === 'hourly'))
  const denom = wedding.total + hourly.total
  return {
    wedding,
    hourly,
    weddingShare: denom > 0 ? wedding.total / denom : 0,
    hourlyShare: denom > 0 ? hourly.total / denom : 0,
  }
}

export interface TrendPoint {
  date: string
  wedding: number
  hourly: number
  total: number
}

/** Last N days, zero-filled per day. */
export function trendDaily(shifts: Shift[], days = 30): TrendPoint[] {
  const map = new Map<string, TrendPoint>()
  for (let i = days - 1; i >= 0; i--) {
    const d = daysAgoIso(i)
    map.set(d, { date: d, wedding: 0, hourly: 0, total: 0 })
  }
  for (const s of shifts) {
    const p = map.get(s.date)
    if (!p) continue
    p[s.jobType] += s.total
    p.total += s.total
  }
  return Array.from(map.values())
}

export interface DayTotal {
  total: number
  count: number
}

/** Per-day totals for a month (keyed by ISO date). Used by the calendar heatmap. */
export function dailyTotalsForMonth(shifts: Shift[], offset = 0): Map<string, DayTotal> {
  const inMonth = filterByDateRange(shifts, startOfMonthIso(offset), endOfMonthIso(offset))
  const map = new Map<string, DayTotal>()
  for (const s of inMonth) {
    const cur = map.get(s.date) ?? { total: 0, count: 0 }
    cur.total += s.total
    cur.count += 1
    map.set(s.date, cur)
  }
  return map
}

/** Percent delta vs previous period. Returns null if prev is 0 (avoids Infinity). */
export function pctDelta(curr: number, prev: number): number | null {
  if (prev === 0) return null
  return ((curr - prev) / prev) * 100
}

/** Hours worked per job, for the current month. Used by HoursByJobTile chart. */
export interface HoursByJob {
  wedding: number
  hourly: number
  total: number
  monthLabel: string
}

export function monthlyHoursByJob(shifts: Shift[], offset = 0): HoursByJob {
  const inMonth = filterByDateRange(shifts, startOfMonthIso(offset), endOfMonthIso(offset))
  let wedding = 0
  let hourly = 0
  for (const s of inMonth) {
    if (s.jobType === 'wedding') wedding += s.hours
    else hourly += s.hours
  }
  // Month label in Hebrew like "אפריל"
  const d = new Date()
  d.setDate(1)
  d.setMonth(d.getMonth() + offset)
  const monthLabel = new Intl.DateTimeFormat('he-IL', { month: 'long' }).format(d)
  return { wedding, hourly, total: wedding + hourly, monthLabel }
}
