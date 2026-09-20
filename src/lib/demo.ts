// ===================================================================
// Demo mode — a fully client-side, seeded, in-memory instance.
// Lets a stranger explore the whole app (and see the payroll engine
// working) without an account. No Supabase calls, nothing persisted.
// The seed pay is computed through the REAL payroll functions, so the
// numbers on screen genuinely add up.
// ===================================================================
import type { Shift } from '../types'
import { DEFAULT_SETTINGS, type Settings } from './settings'
import { calcShiftPay } from './payroll'
import { hoursBetween } from './utils'

const KEY = 'mshmaroti-demo'

let active = typeof sessionStorage !== 'undefined' && sessionStorage.getItem(KEY) === '1'

type Listener = () => void
const listeners = new Set<Listener>()
const emit = () => listeners.forEach((l) => l())
export function subscribeDemo(l: Listener): () => void {
  listeners.add(l)
  return () => listeners.delete(l)
}

export function isDemo(): boolean {
  return active
}

/** React-friendly snapshot subscription (useSyncExternalStore). */
export function demoSnapshot(): boolean {
  return active
}

// ---- in-memory store ----
const settings: Settings = { ...DEFAULT_SETTINGS, hourlyName: 'מסעדה' }
let shifts: Shift[] = []
let nextId = 1
let seeded = false

export function getDemoSettings(): Settings {
  return settings
}
export function setDemoSettings(next: Settings): void {
  Object.assign(settings, next)
  emit()
}
export function getDemoShifts(): Shift[] {
  return shifts
}

function sortShifts() {
  shifts.sort((a, b) => (a.date !== b.date ? (a.date < b.date ? 1 : -1) : b.createdAt - a.createdAt))
}

/** Tips are additive for both jobs; travel is a reimbursement and stays out of `total`. */
function computeTotal(input: Pick<Shift, 'base' | 'tips'>): number {
  return input.base + input.tips
}

export function addDemoShift(input: Omit<Shift, 'id' | 'total' | 'createdAt'>): number {
  const id = nextId++
  shifts = [{ ...input, id, total: computeTotal(input), createdAt: Date.now() + id }, ...shifts]
  sortShifts()
  emit()
  return id
}
export function updateDemoShift(id: number, patch: Partial<Shift>): void {
  shifts = shifts.map((s) => {
    if (s.id !== id) return s
    const merged = { ...s, ...patch }
    return { ...merged, total: computeTotal(merged) }
  })
  sortShifts()
  emit()
}
export function deleteDemoShift(id: number): void {
  shifts = shifts.filter((s) => s.id !== id)
  emit()
}
export function clearDemoShifts(): void {
  shifts = []
  emit()
}

// ---- seed: one realistic month across both jobs ----
const pad = (n: number) => String(n).padStart(2, '0')

/** Travel reimbursement seeded on each restaurant shift (bus fare, both ways). */
const DEMO_TRAVEL = 12

/** Build a shift with pay computed by the real payroll engine. */
function make(date: string, job: 'wedding' | 'hourly', start: string, end: string, tips: number, notes?: string): Shift {
  const hours = hoursBetween(start, end) ?? 0
  let base: number
  if (job === 'wedding') {
    base = settings.weddingRate
  } else {
    base = calcShiftPay(
      { date, jobType: 'hourly', hours, startTime: start, endTime: end, tips, rateMultiplier: 1 },
      settings.hourlyRate,
      settings,
    ).hourlyCalc
  }
  const total = base + tips
  const travel = job === 'hourly' ? DEMO_TRAVEL : 0
  const id = nextId++
  return { id, date, jobType: job, startTime: start, endTime: end, hours, base, tips, travel, expenses: 0, total, rateMultiplier: 1, notes, createdAt: id }
}

function seed(): void {
  const now = new Date()
  const y = now.getFullYear()
  const m = now.getMonth()
  const iso = (day: number) => `${y}-${pad(m + 1)}-${pad(day)}`
  const dow = (day: number) => new Date(y, m, day).getDay() // 0 Sun … 6 Sat
  const daysInMonth = new Date(y, m + 1, 0).getDate()
  const out: Shift[] = []
  let longDone = false

  for (let day = 1; day <= daysInMonth; day++) {
    const d = dow(day)
    // Restaurant weekday evenings (Sun/Tue/Wed) — 7h, some tips
    if (d === 0) out.push(make(iso(day), 'hourly', '16:00', '23:00', 0))
    if (d === 2) out.push(make(iso(day), 'hourly', '16:00', '23:00', 90))
    if (d === 3) {
      // one long overtime shift crossing midnight (15:00 → 02:00 = 11h → 8@100/2@125/1@150)
      if (!longDone) {
        out.push(make(iso(day), 'hourly', '15:00', '02:00', 120, 'ערב עמוס'))
        longDone = true
      } else {
        out.push(make(iso(day), 'hourly', '17:00', '23:00', 70))
      }
    }
    // Thursday wedding-hall event — flat rate + tips
    if (d === 4) out.push(make(iso(day), 'wedding', '18:00', '23:30', day % 2 === 0 ? 260 : 180, 'אירוע'))
    // Friday lunch — short restaurant shift
    if (d === 5) out.push(make(iso(day), 'hourly', '12:00', '17:00', 40))
    // Saturday night — Shabbat premium (19:00 → 03:00 falls in the rest-day window)
    if (d === 6) out.push(make(iso(day), 'hourly', '19:00', '03:00', 80, 'משמרת שבת'))
  }

  // Guarantee today has a shift so the "today" hero is never an empty state.
  const today = now.getDate()
  out.push(make(iso(today), 'hourly', '17:00', '23:30', 140, 'משמרת היום'))

  shifts = out
  sortShifts()
}

function ensureSeed(): void {
  if (seeded) return
  seed()
  seeded = true
}

export function enterDemo(): void {
  active = true
  try {
    sessionStorage.setItem(KEY, '1')
  } catch {
    /* ignore */
  }
  ensureSeed()
  emit()
}

export function exitDemo(): void {
  active = false
  try {
    sessionStorage.removeItem(KEY)
  } catch {
    /* ignore */
  }
  emit()
}

// If a demo session was already active (e.g. after a reload), seed immediately.
if (active) ensureSeed()
