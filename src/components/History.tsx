import { useEffect, useMemo, useState } from 'react'
import type { JobType, Shift } from '../types'
import { useFilteredShifts } from '../hooks/useShifts'
import { deleteShift } from '../lib/api'
import { t } from '../strings'
import { cn, fmtDateShort, fmtHours, fmtIls, monthLabel, startOfMonthIso, endOfMonthIso } from '../lib/utils'
import { filterByDateRange } from '../lib/calc'
import { useSettings } from '../hooks/useSettings'
import MonthCalendar from './MonthCalendar'

type Filter = JobType | 'all'

export default function History({ onEdit }: { onEdit: (s: Shift) => void }) {
  const [filter, setFilter] = useState<Filter>('all')
  const [monthOffset, setMonthOffset] = useState(0)
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [settings] = useSettings()
  const all = useFilteredShifts(filter)

  // Clear day selection whenever the month or job filter changes.
  useEffect(() => setSelectedDate(null), [monthOffset, filter])

  const monthShifts = useMemo(() => {
    if (!all) return undefined
    return filterByDateRange(all, startOfMonthIso(monthOffset), endOfMonthIso(monthOffset))
  }, [all, monthOffset])

  const visible = useMemo(() => {
    if (!monthShifts) return undefined
    return selectedDate ? monthShifts.filter((s) => s.date === selectedDate) : monthShifts
  }, [monthShifts, selectedDate])

  const handleDelete = async (id: number) => {
    if (!confirm(t.history.confirmDelete)) return
    await deleteShift(id)
  }

  return (
    <div className="mx-auto max-w-2xl mt-2">
      <div className="flex items-center justify-between mb-4 px-1">
        <h2 className="font-display text-2xl font-bold text-gradient inline-block">{t.history.title}</h2>
        <div className="text-xs text-muted tabular-nums">{monthShifts?.length ?? 0} {t.tile.shifts}</div>
      </div>

      {/* Month picker */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => setMonthOffset((o) => o - 1)}
          aria-label={t.history.prevMonth}
          className="w-9 h-9 rounded-lg bg-elevate border border-line flex items-center justify-center text-body hover:text-ink transition active:scale-90"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 6l6 6-6 6" />
          </svg>
        </button>
        <div className="num-display text-base text-ink">{monthLabel(monthOffset)}</div>
        <button
          onClick={() => setMonthOffset((o) => Math.min(0, o + 1))}
          disabled={monthOffset >= 0}
          aria-label={t.history.nextMonth}
          className="w-9 h-9 rounded-lg bg-elevate border border-line flex items-center justify-center text-body hover:text-ink transition active:scale-90 disabled:opacity-40 disabled:hover:text-body"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 6l-6 6 6 6" />
          </svg>
        </button>
      </div>

      {/* Job filter */}
      <div className="flex gap-2 mb-4">
        <FilterChip active={filter === 'all'} onClick={() => setFilter('all')} label={t.history.filterAll} />
        <FilterChip active={filter === 'wedding'} onClick={() => setFilter('wedding')} label={settings.weddingName} />
        <FilterChip active={filter === 'hourly'} onClick={() => setFilter('hourly')} label={settings.hourlyName} />
      </div>

      {/* Calendar heatmap */}
      <MonthCalendar
        shifts={all ?? []}
        monthOffset={monthOffset}
        selectedDate={selectedDate}
        onSelectDate={setSelectedDate}
      />

      {selectedDate && (
        <button onClick={() => setSelectedDate(null)} className="chip chip-active mb-3 active:scale-95 transition">
          {fmtDateShort(selectedDate)} · {t.history.allDays} ✕
        </button>
      )}

      {!visible ? (
        <div className="tile p-6 animate-pulse h-40" />
      ) : visible.length === 0 ? (
        <div className="tile p-8 text-center text-muted">{t.history.empty}</div>
      ) : (
        <div className="tile divide-y divide-lineSoft">
          {visible.map((s) => {
            const jobName = s.jobType === 'wedding' ? settings.weddingName : settings.hourlyName
            const jobChipClass = s.jobType === 'wedding' ? 'chip-indigo' : 'chip-coral'
            return (
              <div key={s.id} className="flex items-center gap-3 p-4">
                <button onClick={() => onEdit(s)} className="flex-1 min-w-0 text-right transition active:scale-[0.99]">
                  <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                    <span className="text-sm text-muted tabular-nums shrink-0">{fmtDateShort(s.date)}</span>
                    <span className={cn('chip px-2 py-0.5 text-[10px]', jobChipClass)}>{jobName}</span>
                  </div>
                  <div className="text-xs text-body flex items-center gap-2 flex-wrap">
                    <span className="text-muted">
                      {s.startTime && s.endTime ? `${s.startTime} – ${s.endTime}` : ''} {fmtHours(s.hours)}
                      {(s.breakMinutes ?? 0) > 0 && ` · ${s.breakMinutes} ${t.form.breakUnit}`}
                    </span>
                    {s.tips > 0 && (
                      <span className="chip chip-lime px-1.5 py-0 text-[10px]">
                        {t.tile.tips} {fmtIls(s.tips)}
                      </span>
                    )}
                    {(s.expenses ?? 0) > 0 && (
                      <span className="chip chip-peach px-1.5 py-0 text-[10px]">
                        {t.tile.expenses} {fmtIls(s.expenses)}
                      </span>
                    )}
                  </div>
                  {s.notes && <div className="text-xs text-muted mt-1 italic truncate">{s.notes}</div>}
                </button>
                <div className="text-left shrink-0">
                  <div className="num-display text-lg text-ink tabular-nums">{fmtIls(s.total)}</div>
                  <button
                    onClick={() => s.id != null && handleDelete(s.id)}
                    className="text-[11px] text-muted hover:text-neg transition mt-1"
                    aria-label={t.history.delete}
                  >
                    {t.history.delete}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function FilterChip({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button onClick={onClick} className={cn('chip transition active:scale-95', active && 'chip-active')}>
      {label}
    </button>
  )
}
