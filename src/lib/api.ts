import { supabase, type ShiftRow } from './supabase'
import type { Shift } from '../types'
import {
  isDemo,
  getDemoShifts,
  addDemoShift,
  updateDemoShift,
  deleteDemoShift,
  clearDemoShifts,
} from './demo'

// ====================================================================
// Mapping between snake_case DB rows and camelCase app types.
// Keeping the app's Shift type unchanged means no other components
// need to know we switched from Dexie to Postgres.
// ====================================================================

export function rowToShift(row: ShiftRow): Shift {
  return {
    id: row.id,
    date: row.date,
    jobType: row.job_type,
    hours: Number(row.hours),
    breakMinutes: row.break_minutes != null ? Number(row.break_minutes) : 0,
    startTime: row.start_time ?? undefined,
    endTime: row.end_time ?? undefined,
    base: Number(row.base),
    tips: Number(row.tips),
    travel: row.travel != null ? Number(row.travel) : 0,
    expenses: Number(row.expenses),
    total: Number(row.total),
    rateMultiplier: row.rate_multiplier != null ? Number(row.rate_multiplier) : 1.0,
    notes: row.notes ?? undefined,
    createdAt: new Date(row.created_at).getTime(),
  }
}

function getUserId(): string {
  const session = supabase.auth.getSession()
  // Synchronous access via the current cached session
  const data = (supabase.auth as unknown as { currentSession?: { user?: { id: string } } }).currentSession
  if (data?.user?.id) return data.user.id
  // Fallback — should rarely trigger since AuthGate blocks the app
  void session
  throw new Error('Not authenticated')
}

async function requireUserId(): Promise<string> {
  const { data, error } = await supabase.auth.getUser()
  if (error || !data.user) throw new Error('Not authenticated')
  return data.user.id
}

/**
 * Columns added by later migrations that a database may not have yet.
 * Writes degrade gracefully rather than failing outright when one is absent.
 */
const OPTIONAL_COLUMNS = ['break_minutes', 'travel'] as const

type WriteError = { code?: string; message?: string } | null

/**
 * If a write failed only because an optional column doesn't exist yet, drop that
 * column from the pending rows and return its name so the caller can retry.
 * 42703 = undefined_column (Postgres); PGRST204 = column missing from schema cache.
 * When the error names no column in particular, strip every optional one we sent —
 * losing an optional field beats losing the shift.
 */
function stripMissingColumn(error: WriteError, rows: Record<string, unknown>[]): string | null {
  if (!error) return null
  const sent = OPTIONAL_COLUMNS.filter((c) => rows.some((r) => c in r))
  if (sent.length === 0) return null

  const message = (error.message ?? '').toLowerCase()
  const named = sent.filter((c) => message.includes(c))
  const byCode = error.code === '42703' || error.code === 'PGRST204'
  if (!byCode && named.length === 0) return null

  // Prefer the column the error actually names; otherwise drop every optional
  // column we sent, since we can't tell which one the database is missing.
  const drop = named.length > 0 ? named : sent
  for (const r of rows) for (const c of drop) delete r[c]
  return drop.join(', ')
}

function warnDropped(columns: string): void {
  console.warn(
    `Column(s) ${columns} missing — saving without them. Run the supabase/migration_v2.*.sql files to enable these fields.`,
  )
}

// ====================================================================
// CRUD operations — same signatures as the old db.ts.
// total is computed app-side from base + tips before insert.
// ====================================================================

export async function addShift(input: Omit<Shift, 'id' | 'total' | 'createdAt'>): Promise<number> {
  if (isDemo()) return addDemoShift(input)
  const user_id = await requireUserId()
  // Tips are additive for both jobs: you keep the wage AND the tips.
  // Travel stays out of `total` — it is a reimbursement, not pay for hours worked.
  const total = input.base + input.tips
  const row: Record<string, unknown> = {
    user_id,
    date: input.date,
    job_type: input.jobType,
    hours: input.hours,
    start_time: input.startTime ?? null,
    end_time: input.endTime ?? null,
    base: input.base,
    tips: input.tips,
    expenses: input.expenses ?? 0,
    total,
    rate_multiplier: input.rateMultiplier ?? 1.0,
    notes: input.notes ?? null,
  }
  // Send the optional columns only when they carry a value — both default to 0 in
  // the schema, so omitting them costs nothing and saves a round trip on older DBs.
  if ((input.breakMinutes ?? 0) > 0) row.break_minutes = input.breakMinutes
  if ((input.travel ?? 0) > 0) row.travel = input.travel

  let res = await supabase.from('shifts').insert(row).select('id').single()
  for (let i = 0; i < OPTIONAL_COLUMNS.length; i++) {
    const dropped = stripMissingColumn(res.error, [row])
    if (!dropped) break
    warnDropped(dropped)
    res = await supabase.from('shifts').insert(row).select('id').single()
  }
  if (res.error) throw res.error
  return res.data.id
}

export async function updateShift(
  id: number,
  patch: Partial<Omit<Shift, 'id' | 'createdAt'>>,
): Promise<void> {
  if (isDemo()) {
    updateDemoShift(id, patch)
    return
  }
  // Need to recompute total if base or tips changed
  const updates: Record<string, unknown> = {}
  if (patch.date !== undefined) updates.date = patch.date
  if (patch.jobType !== undefined) updates.job_type = patch.jobType
  if (patch.hours !== undefined) updates.hours = patch.hours
  // Written even when 0 — an edit has to be able to clear a break or a travel
  // allowance. The retry below drops them if the DB lacks the columns.
  if (patch.breakMinutes !== undefined) updates.break_minutes = patch.breakMinutes
  if (patch.travel !== undefined) updates.travel = patch.travel
  if (patch.startTime !== undefined) updates.start_time = patch.startTime ?? null
  if (patch.endTime !== undefined) updates.end_time = patch.endTime ?? null
  if (patch.base !== undefined) updates.base = patch.base
  if (patch.tips !== undefined) updates.tips = patch.tips
  if (patch.expenses !== undefined) updates.expenses = patch.expenses
  if (patch.rateMultiplier !== undefined) updates.rate_multiplier = patch.rateMultiplier
  if (patch.notes !== undefined) updates.notes = patch.notes ?? null

  // Recompute total when base or tips changes — total is base + tips for both jobs.
  if (patch.base !== undefined || patch.tips !== undefined) {
    const { data: existing, error: fetchErr } = await supabase
      .from('shifts')
      .select('base, tips')
      .eq('id', id)
      .single()
    if (fetchErr) throw fetchErr
    const newBase = patch.base ?? Number(existing.base)
    const newTips = patch.tips ?? Number(existing.tips)
    updates.total = newBase + newTips
  }

  let res = await supabase.from('shifts').update(updates).eq('id', id)
  for (let i = 0; i < OPTIONAL_COLUMNS.length; i++) {
    const dropped = stripMissingColumn(res.error, [updates])
    if (!dropped) break
    warnDropped(dropped)
    res = await supabase.from('shifts').update(updates).eq('id', id)
  }
  if (res.error) throw res.error
}

export async function deleteShift(id: number): Promise<void> {
  if (isDemo()) {
    deleteDemoShift(id)
    return
  }
  const { error } = await supabase.from('shifts').delete().eq('id', id)
  if (error) throw error
}

export async function clearAll(): Promise<void> {
  if (isDemo()) {
    clearDemoShifts()
    return
  }
  const user_id = await requireUserId()
  const { error } = await supabase.from('shifts').delete().eq('user_id', user_id)
  if (error) throw error
}

export async function fetchAllShifts(): Promise<Shift[]> {
  if (isDemo()) return [...getDemoShifts()]
  const { data, error } = await supabase
    .from('shifts')
    .select('*')
    .order('date', { ascending: false })
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []).map(rowToShift)
}

export async function bulkImport(shifts: Shift[]): Promise<void> {
  if (isDemo()) {
    clearDemoShifts()
    for (const s of shifts) addDemoShift(s)
    return
  }
  const user_id = await requireUserId()
  // Clear existing first to match v1.x bulkImport semantics
  await clearAll()
  if (shifts.length === 0) return
  const rows = shifts.map((s) => {
    const row: Record<string, unknown> = {
      user_id,
      date: s.date,
      job_type: s.jobType,
      hours: s.hours,
      start_time: s.startTime ?? null,
      end_time: s.endTime ?? null,
      base: s.base,
      tips: s.tips,
      expenses: s.expenses ?? 0,
      total: s.total,
      rate_multiplier: s.rateMultiplier ?? 1.0,
      notes: s.notes ?? null,
    }
    if ((s.breakMinutes ?? 0) > 0) row.break_minutes = s.breakMinutes
    if ((s.travel ?? 0) > 0) row.travel = s.travel
    return row
  })
  // Chunk to stay under any payload limits (Supabase handles up to ~1MB easily)
  const CHUNK = 500
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK)
    let res = await supabase.from('shifts').insert(chunk)
    for (let attempt = 0; attempt < OPTIONAL_COLUMNS.length; attempt++) {
      const dropped = stripMissingColumn(res.error, chunk)
      if (!dropped) break
      warnDropped(dropped)
      res = await supabase.from('shifts').insert(chunk)
    }
    if (res.error) throw res.error
  }
}

// Silence unused-import warning — getUserId is kept for future synchronous needs
void getUserId
