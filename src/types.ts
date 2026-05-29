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
  /** Hours worked. Derived from start/end when both present; otherwise user-entered. */
  hours: number
  /** Base pay before tips (200 for wedding regardless of hours; hours*35 for hourly) */
  base: number
  /** Tips for the shift */
  tips: number
  /** Out-of-pocket expenses (food, transport, etc.) — tracked separately, not deducted from total */
  expenses: number
  /** base + tips — denormalized for fast sorting/filtering. Does NOT include expenses. */
  total: number
  notes?: string
  /** ms epoch — for stable ordering when multiple shifts share a date */
  createdAt: number
}
