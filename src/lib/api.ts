import { supabase, type ShiftRow } from './supabase'
import type { Shift } from '../types'

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
    startTime: row.start_time ?? undefined,
    endTime: row.end_time ?? undefined,
    base: Number(row.base),
    tips: Number(row.tips),
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

// ====================================================================
// CRUD operations — same signatures as the old db.ts.
// total is computed app-side from base + tips before insert.
// ====================================================================

export async function addShift(input: Omit<Shift, 'id' | 'total' | 'createdAt'>): Promise<number> {
  const user_id = await requireUserId()
  // Total logic differs by job type:
  //   wedding: base + tips (both kept, paid same-day cash)
  //   hourly:  max(base, tips) per Israeli tip law — whichever is higher is what you receive
  const total = input.jobType === 'wedding'
    ? input.base + input.tips
    : Math.max(input.base, input.tips)
  const { data, error } = await supabase
    .from('shifts')
    .insert({
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
    })
    .select('id')
    .single()
  if (error) throw error
  return data.id
}

export async function updateShift(
  id: number,
  patch: Partial<Omit<Shift, 'id' | 'createdAt'>>,
): Promise<void> {
  // Need to recompute total if base or tips changed
  const updates: Record<string, unknown> = {}
  if (patch.date !== undefined) updates.date = patch.date
  if (patch.jobType !== undefined) updates.job_type = patch.jobType
  if (patch.hours !== undefined) updates.hours = patch.hours
  if (patch.startTime !== undefined) updates.start_time = patch.startTime ?? null
  if (patch.endTime !== undefined) updates.end_time = patch.endTime ?? null
  if (patch.base !== undefined) updates.base = patch.base
  if (patch.tips !== undefined) updates.tips = patch.tips
  if (patch.expenses !== undefined) updates.expenses = patch.expenses
  if (patch.rateMultiplier !== undefined) updates.rate_multiplier = patch.rateMultiplier
  if (patch.notes !== undefined) updates.notes = patch.notes ?? null

  // Recompute total when base, tips, or jobType changes
  if (patch.base !== undefined || patch.tips !== undefined || patch.jobType !== undefined) {
    const { data: existing, error: fetchErr } = await supabase
      .from('shifts')
      .select('base, tips, job_type')
      .eq('id', id)
      .single()
    if (fetchErr) throw fetchErr
    const newBase = patch.base ?? Number(existing.base)
    const newTips = patch.tips ?? Number(existing.tips)
    const newJobType = patch.jobType ?? existing.job_type
    updates.total = newJobType === 'wedding'
      ? newBase + newTips
      : Math.max(newBase, newTips)
  }

  const { error } = await supabase.from('shifts').update(updates).eq('id', id)
  if (error) throw error
}

export async function deleteShift(id: number): Promise<void> {
  const { error } = await supabase.from('shifts').delete().eq('id', id)
  if (error) throw error
}

export async function clearAll(): Promise<void> {
  const user_id = await requireUserId()
  const { error } = await supabase.from('shifts').delete().eq('user_id', user_id)
  if (error) throw error
}

export async function fetchAllShifts(): Promise<Shift[]> {
  const { data, error } = await supabase
    .from('shifts')
    .select('*')
    .order('date', { ascending: false })
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []).map(rowToShift)
}

export async function bulkImport(shifts: Shift[]): Promise<void> {
  const user_id = await requireUserId()
  // Clear existing first to match v1.x bulkImport semantics
  await clearAll()
  if (shifts.length === 0) return
  const rows = shifts.map((s) => ({
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
  }))
  // Chunk to stay under any payload limits (Supabase handles up to ~1MB easily)
  const CHUNK = 500
  for (let i = 0; i < rows.length; i += CHUNK) {
    const { error } = await supabase.from('shifts').insert(rows.slice(i, i + CHUNK))
    if (error) throw error
  }
}

// Silence unused-import warning — getUserId is kept for future synchronous needs
void getUserId
