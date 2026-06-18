/** Concatenate class names, skipping falsy values. */
export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(' ')
}

/** Format a number as ILS with Hebrew locale. */
export function fmtIls(n: number, opts: { withSign?: boolean; decimals?: number } = {}): string {
  const { withSign = false, decimals = 0 } = opts
  const sign = withSign && n > 0 ? '+' : ''
  return (
    sign +
    new Intl.NumberFormat('he-IL', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(n) +
    ' ₪'
  )
}

/** Format hours like "6.5 ש'" */
export function fmtHours(h: number): string {
  const rounded = Math.round(h * 10) / 10
  return `${rounded} ש׳`
}

/** Today as YYYY-MM-DD in local timezone. */
export function todayIso(): string {
  const d = new Date()
  return toIso(d)
}

export function toIso(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function fromIso(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}

/** Return ISO string for N days ago (at local midnight). */
export function daysAgoIso(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return toIso(d)
}

/** Format a Hebrew short date like "17 באפר׳" */
export function fmtDateShort(iso: string): string {
  const d = fromIso(iso)
  return new Intl.DateTimeFormat('he-IL', { day: 'numeric', month: 'short' }).format(d)
}

/** Format a full weekday + date, e.g. "יום ה׳, 17 באפריל" */
export function fmtDateFull(iso: string): string {
  const d = fromIso(iso)
  return new Intl.DateTimeFormat('he-IL', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(d)
}

/** First day of current month as ISO. */
export function startOfMonthIso(offset = 0): string {
  const d = new Date()
  d.setDate(1)
  d.setMonth(d.getMonth() + offset)
  return toIso(d)
}

/** Last day of month (given offset) as ISO. */
export function endOfMonthIso(offset = 0): string {
  const d = new Date()
  d.setDate(1)
  d.setMonth(d.getMonth() + offset + 1)
  d.setDate(0)
  return toIso(d)
}

/** Year + 0-indexed month for a month `offset` from the current month. */
export function monthFromOffset(offset = 0): { year: number; month: number } {
  const d = new Date()
  d.setDate(1)
  d.setMonth(d.getMonth() + offset)
  return { year: d.getFullYear(), month: d.getMonth() }
}

/** Hebrew month + year label, e.g. "אפריל 2026", for a month offset. */
export function monthLabel(offset = 0): string {
  const { year, month } = monthFromOffset(offset)
  return new Intl.DateTimeFormat('he-IL', { month: 'long', year: 'numeric' }).format(
    new Date(year, month, 1),
  )
}

export interface CalendarCell {
  iso: string
  day: number
}

/**
 * Weeks of a month as a grid, Sunday-first to match the Israeli week.
 * Leading/trailing blanks are null so every week has 7 cells.
 */
export function buildMonthMatrix(year: number, month: number): (CalendarCell | null)[][] {
  const startDow = new Date(year, month, 1).getDay() // 0 = Sunday
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const cells: (CalendarCell | null)[] = []
  for (let i = 0; i < startDow; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ iso: toIso(new Date(year, month, d)), day: d })
  }
  while (cells.length % 7 !== 0) cells.push(null)
  const weeks: (CalendarCell | null)[][] = []
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7))
  return weeks
}

/** Start of current week (Sunday-based, Israeli week). */
export function startOfWeekIso(): string {
  const d = new Date()
  const day = d.getDay() // 0 = Sunday
  d.setDate(d.getDate() - day)
  return toIso(d)
}

/** Parse "HH:MM" into minutes since midnight. Returns null if invalid. */
export function parseTime(hhmm: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim())
  if (!m) return null
  const h = Number(m[1])
  const min = Number(m[2])
  if (h < 0 || h > 23 || min < 0 || min > 59) return null
  return h * 60 + min
}

/**
 * Hours between two "HH:MM" strings. Handles overnight:
 * if end <= start, it's assumed the shift ended the next day.
 * e.g. hoursBetween("20:00", "02:30") === 6.5
 * Returns null if either input is invalid.
 */
export function hoursBetween(start: string, end: string): number | null {
  const s = parseTime(start)
  const e = parseTime(end)
  if (s === null || e === null) return null
  let diff = e - s
  if (diff <= 0) diff += 24 * 60 // overnight
  return Math.round((diff / 60) * 100) / 100 // 2-decimal precision
}
