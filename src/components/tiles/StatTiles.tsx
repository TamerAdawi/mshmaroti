import { t } from '../../strings'
import { fmtIls, cn } from '../../lib/utils'
import { weekAgg, monthAgg, pctDelta } from '../../lib/calc'
import { useCountUp } from '../../hooks/useCountUp'
import type { Shift } from '../../types'

export function WeekTile({ shifts }: { shifts: Shift[] }) {
  const agg = weekAgg(shifts)
  const animatedTotal = useCountUp(agg.total)
  return (
    <div className="tile p-5 relative overflow-hidden">
      <div className="absolute top-0 right-0 w-24 h-24 bg-sky-soft rounded-full blur-2xl opacity-60 -translate-y-8 translate-x-8 pointer-events-none" />
      <div className="relative">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-8 h-8 rounded-lg bg-sky-gradient flex items-center justify-center shadow-float">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
              <path d="M8 2v4M16 2v4M3 10h18M5 6h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2z" />
            </svg>
          </div>
          <span className="label">{t.tile.week}</span>
        </div>
        <div className="num-display text-3xl text-ink mt-2">{fmtIls(animatedTotal)}</div>
        <div className="text-xs text-body mt-2 flex items-center gap-1 flex-wrap">
          <span>{agg.count} {agg.count === 1 ? t.tile.shift : t.tile.shifts}</span>
          {agg.effectiveRate > 0 && (
            <span className="chip chip-sky px-2 py-0.5 tabular-nums text-[10px]">
              {fmtIls(agg.effectiveRate)}{t.common.perHour}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

export function MonthTile({ shifts }: { shifts: Shift[] }) {
  const curr = monthAgg(shifts, 0)
  const prev = monthAgg(shifts, -1)
  const delta = pctDelta(curr.total, prev.total)
  const isPositive = delta !== null && delta >= 0
  const animatedTotal = useCountUp(curr.total)

  return (
    <div className="tile p-5 relative overflow-hidden">
      <div className={cn(
        "absolute top-0 right-0 w-24 h-24 rounded-full blur-2xl opacity-60 -translate-y-8 translate-x-8 pointer-events-none",
        isPositive ? "bg-lime-soft" : "bg-coral-soft"
      )} />
      <div className="relative">
        <div className="flex items-center gap-2 mb-2">
          <div className={cn(
            "w-8 h-8 rounded-lg flex items-center justify-center shadow-float",
            isPositive ? "bg-lime-gradient" : "bg-coral-gradient"
          )}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              {isPositive ? (
                <path d="M3 17l6-6 4 4 8-8M14 7h7v7" />
              ) : (
                <path d="M3 7l6 6 4-4 8 8M14 17h7v-7" />
              )}
            </svg>
          </div>
          <span className="label">{t.tile.month}</span>
        </div>
        <div className="num-display text-3xl text-ink mt-2">{fmtIls(animatedTotal)}</div>
        <div className="text-xs text-body mt-2 flex items-center gap-2 flex-wrap">
          <span>{curr.count} {curr.count === 1 ? t.tile.shift : t.tile.shifts}</span>
          {delta !== null && (
            <span className={cn(
              'chip px-2 py-0.5 tabular-nums text-[10px]',
              isPositive ? 'chip-lime' : 'chip-coral',
            )}>
              {isPositive ? '▲' : '▼'} {Math.abs(delta).toFixed(0)}%
            </span>
          )}
        </div>
        {prev.total > 0 && (
          <div className="text-[11px] text-muted mt-1">
            {t.tile.lastMonth}: {fmtIls(prev.total)}
          </div>
        )}
      </div>
    </div>
  )
}
