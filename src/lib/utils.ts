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
