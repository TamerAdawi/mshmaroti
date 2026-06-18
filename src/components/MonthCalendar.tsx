import { useMemo } from 'react'
import type { Shift } from '../types'
import { dailyTotalsForMonth } from '../lib/calc'
import { buildMonthMatrix, monthFromOffset, todayIso, fmtIls, cn } from '../lib/utils'
import { t } from '../strings'

interface Props {
  shifts: Shift[]
  monthOffset: number
  selectedDate: string | null
  onSelectDate: (iso: string | null) => void
}

/** Bucket a day's earnings (0..max) into a heatmap background + text class. */
function heatClass(total: number, max: number): string {
  if (total <= 0) return 'bg-elevate text-mutedSoft'
  const r = max > 0 ? total / max : 0
  if (r <= 0.25) return 'bg-indigo-soft text-indigo-deep'
  if (r <= 0.5) return 'bg-indigo/30 text-indigo-deep'
  if (r <= 0.75) return 'bg-indigo/60 text-white'
  return 'bg-indigo-deep text-white'
}

export default function MonthCalendar({ shifts, monthOffset, selectedDate, onSelectDate }: Props) {
  const { year, month } = monthFromOffset(monthOffset)
  const weeks = useMemo(() => buildMonthMatrix(year, month), [year, month])
  const totals = useMemo(() => dailyTotalsForMonth(shifts, monthOffset), [shifts, monthOffset])
  const max = useMemo(() => {
    let m = 0
    for (const { total } of totals.values()) if (total > m) m = total
    return m
  }, [totals])

  const today = todayIso()

  return (
    <div className="tile p-4 mb-4">
      <div className="grid grid-cols-7 gap-1 mb-1">
        {t.history.weekdaysShort.map((d, i) => (
          <div key={i} className="text-center text-[11px] font-semibold text-muted py-1">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {weeks.flat().map((cell, i) => {
          if (!cell) return <div key={`b${i}`} className="aspect-square" />
          const day = totals.get(cell.iso)
          const total = day?.total ?? 0
          const isToday = cell.iso === today
          const isSelected = cell.iso === selectedDate
          return (
            <button
              key={cell.iso}
              onClick={() => onSelectDate(isSelected ? null : cell.iso)}
              title={total > 0 ? fmtIls(total) : undefined}
              className={cn(
                'aspect-square rounded-lg flex flex-col items-center justify-center transition active:scale-90',
                heatClass(total, max),
                isToday && !isSelected && 'ring-1 ring-indigo/50',
                isSelected && 'ring-2 ring-violet ring-offset-1 ring-offset-surface',
              )}
            >
              <span className="text-xs font-semibold tabular-nums leading-none">{cell.day}</span>
              {day && (
                <span className="w-1 h-1 rounded-full bg-current opacity-70 mt-1" />
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
