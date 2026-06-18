import type { Shift } from '../types'
import { bulkImport, fetchAllShifts } from './api'

const CSV_HEADERS = ['id', 'date', 'jobType', 'hours', 'breakMinutes', 'startTime', 'endTime', 'base', 'tips', 'expenses', 'total', 'notes', 'createdAt']

function csvEscape(v: unknown): string {
  const s = v == null ? '' : String(v)
  if (s.includes('"') || s.includes(',') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

export async function exportCsv(): Promise<Blob> {
  const shifts = (await fetchAllShifts()).slice().reverse() // export oldest-first for CSV
  const rows = [CSV_HEADERS.join(',')]
  for (const s of shifts) {
    rows.push(
      [s.id, s.date, s.jobType, s.hours, s.breakMinutes ?? 0, s.startTime ?? '', s.endTime ?? '', s.base, s.tips, s.expenses ?? 0, s.total, s.notes ?? '', s.createdAt]
        .map(csvEscape)
        .join(','),
    )
  }
  const content = '\uFEFF' + rows.join('\n')
  return new Blob([content], { type: 'text/csv;charset=utf-8' })
}

export async function exportJson(): Promise<Blob> {
  const shifts = (await fetchAllShifts()).slice().reverse()
  const payload = {
    app: 'mshmaroti',
    version: 1,
    exportedAt: new Date().toISOString(),
    shifts,
  }
  return new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export interface ImportResult {
  imported: number
}

function isShift(x: unknown): x is Shift {
  if (!x || typeof x !== 'object') return false
  const s = x as Record<string, unknown>
  return (
    typeof s.date === 'string' &&
    (s.jobType === 'wedding' || s.jobType === 'hourly') &&
    typeof s.hours === 'number' &&
    typeof s.base === 'number' &&
    typeof s.tips === 'number' &&
    typeof s.total === 'number' &&
    typeof s.createdAt === 'number'
  )
}

export async function importJsonFile(file: File): Promise<ImportResult> {
  const text = await file.text()
  const parsed = JSON.parse(text)
  if (parsed?.app !== 'mshmaroti') {
    throw new Error('קובץ לא תואם — לא נראה כגיבוי של משמרותי')
  }
  const raw: unknown = parsed.shifts
  if (!Array.isArray(raw)) throw new Error('קובץ פגום')
  // Backfill expenses=0 for older backups
  const valid: Shift[] = raw
    .filter(isShift)
    .map((s) => ({ ...s, id: undefined, expenses: typeof s.expenses === 'number' ? s.expenses : 0 }))
  if (valid.length === 0) throw new Error('אין משמרות תקינות בקובץ')
  await bulkImport(valid)
  return { imported: valid.length }
}

export function makeFilename(ext: string): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `mshmaroti-${y}${m}${day}.${ext}`
}
