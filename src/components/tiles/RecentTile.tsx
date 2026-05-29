import { t } from '../../strings'
import { fmtIls, fmtDateShort, fmtHours, cn } from '../../lib/utils'
import type { Shift } from '../../types'
import { useSettings } from '../../hooks/useSettings'

export default function RecentTile({ shifts, onEdit }: { shifts: Shift[]; onEdit: (s: Shift) => void }) {
  const [settings] = useSettings()
  const recent = shifts.slice(0, 5)

  return (
    <div className="tile p-5">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-8 h-8 rounded-lg bg-coral-gradient flex items-center justify-center shadow-float">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8M3 3v5h5M12 7v5l4 2" />
          </svg>
        </div>
        <span className="label">{t.tile.recent}</span>
      </div>
      {recent.length === 0 ? (
        <div className="py-6 text-sm text-muted">{t.tile.noShifts}</div>
      ) : (
        <ul className="mt-2 divide-y divide-lineSoft">
          {recent.map((s) => {
            const jobName = s.jobType === 'wedding' ? settings.weddingName : settings.hourlyName
            const chipClass = s.jobType === 'wedding' ? 'chip-indigo' : 'chip-coral'
            return (
              <li key={s.id}>
                <button
                  onClick={() => onEdit(s)}
                  className="w-full flex items-center justify-between py-3 gap-3 text-right hover:bg-elevate/60 -mx-2 px-2 rounded-lg transition"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 text-sm mb-0.5">
                      <span className="text-muted tabular-nums shrink-0 text-xs">{fmtDateShort(s.date)}</span>
                      <span className={cn('chip text-[10px] px-2 py-0.5', chipClass)}>{jobName}</span>
                    </div>
                    <div className="text-[11px] text-muted flex items-center gap-2 flex-wrap">
                      <span>{fmtHours(s.hours)}</span>
                      {s.tips > 0 && (
                        <span className="chip chip-lime text-[10px] px-1.5 py-0">
                          {t.tile.tips} {fmtIls(s.tips)}
                        </span>
                      )}
                      {(s.expenses ?? 0) > 0 && (
                        <span className="chip chip-peach text-[10px] px-1.5 py-0">
                          {t.tile.expenses} {fmtIls(s.expenses)}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="num-display text-lg text-ink tabular-nums shrink-0">{fmtIls(s.total)}</div>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
