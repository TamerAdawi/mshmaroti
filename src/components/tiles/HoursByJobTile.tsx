import { t } from '../../strings'
import { fmtHours, cn } from '../../lib/utils'
import { monthlyHoursByJob } from '../../lib/calc'
import type { Shift } from '../../types'
import { useSettings } from '../../hooks/useSettings'

export default function HoursByJobTile({ shifts }: { shifts: Shift[] }) {
  const [settings] = useSettings()
  const agg = monthlyHoursByJob(shifts, 0)
  const hasData = agg.total > 0

  const maxHours = Math.max(agg.wedding, agg.hourly, 1)

  return (
    <div className="tile p-5 relative overflow-hidden">
      <div className="absolute bottom-0 left-0 w-32 h-20 bg-lime-soft rounded-full blur-3xl opacity-40 translate-y-8 -translate-x-8 pointer-events-none" />
      <div className="relative">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-lime-gradient flex items-center justify-center shadow-float">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="9" />
                <path d="M12 7v5l3 2" />
              </svg>
            </div>
            <div>
              <div className="label">{t.tile.hoursByJob}</div>
              <div className="text-[11px] text-muted mt-0.5">
                {agg.monthLabel} · סה"כ {fmtHours(agg.total)}
              </div>
            </div>
          </div>
        </div>

        {hasData ? (
          <div className="space-y-3 mt-2">
            <HourBar
              name={settings.weddingName}
              hours={agg.wedding}
              maxHours={maxHours}
              color="indigo"
            />
            <HourBar
              name={settings.hourlyName}
              hours={agg.hourly}
              maxHours={maxHours}
              color="coral"
            />
          </div>
        ) : (
          <div className="py-6 text-sm text-muted">{t.tile.noShifts}</div>
        )}
      </div>
    </div>
  )
}

function HourBar({
  name,
  hours,
  maxHours,
  color,
}: {
  name: string
  hours: number
  maxHours: number
  color: 'indigo' | 'coral'
}) {
  const pct = maxHours > 0 ? (hours / maxHours) * 100 : 0
  const barClass = color === 'indigo'
    ? 'bg-gradient-to-r from-indigo to-violet'
    : 'bg-gradient-to-r from-coral to-peach'
  const labelClass = color === 'indigo' ? 'text-indigo-deep' : 'text-coral-deep'

  return (
    <div>
      <div className="flex items-baseline justify-between mb-1.5">
        <span className="text-sm text-body font-medium">{name}</span>
        <span className={cn('num-display tabular-nums text-sm', labelClass)}>
          {fmtHours(hours)}
        </span>
      </div>
      <div className="h-2.5 bg-elevate rounded-full overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all duration-500', barClass)}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}
