export type JobType = 'wedding' | 'hourly'

export interface Shift {
  id?: number
  /** ISO date string, YYYY-MM-DD */
  date: string
  jobType: JobType
  /** Shift start time, "HH:MM" 24h. Optional — if absent, hours was entered directly. */
  startTime?: string
  /** Shift end time, "HH:MM" 24h. Handles overnight (e.g. 20:00 → 02:00). */
  endTime?: string
  /** Hours worked (paid). For hourly time-mode shifts this is the start→end span minus the break. */
  hours: number
  /** Unpaid break in minutes (hourly job). Deducted from the start→end span to get paid hours. */
  breakMinutes?: number
  /** Base pay before tips (200 for wedding regardless of hours; hours*35 for hourly) */
  base: number
  /** Tips for the shift */
  tips: number
  /** Out-of-pocket expenses (food, transport, etc.) — tracked separately, not deducted from total */
  expenses: number
  /** base + tips for wedding, max(base, tips) for hourly — denormalized for fast sorting/filtering. */
  total: number
  /** Optional per-shift rate multiplier (default 1.0). When != 1.0, overrides OT and rest day calcs. */
  rateMultiplier?: number
  notes?: string
  /** ms epoch — for stable ordering when multiple shifts share a date */
  createdAt: number
}
