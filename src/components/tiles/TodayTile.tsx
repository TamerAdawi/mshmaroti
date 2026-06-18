import { t } from '../../strings'
import { fmtIls, fmtHours, fmtDateFull, todayIso } from '../../lib/utils'
import { todayAgg } from '../../lib/calc'
import { useCountUp } from '../../hooks/useCountUp'
import type { Shift } from '../../types'

export default function TodayTile({ shifts }: { shifts: Shift[] }) {
  const agg = todayAgg(shifts)
  const hasShifts = agg.count > 0
  const animatedTotal = useCountUp(agg.total)
  // Sum expenses from today's shifts
  const todayExpenses = shifts
    .filter((s) => s.date === todayIso())
    .reduce((sum, s) => sum + (s.expenses ?? 0), 0)

  return (
    <div className="tile-hero p-6 md:p-7 relative">
      <div className="relative z-10 flex items-start justify-between mb-4">
        <span className="text-xs font-bold uppercase tracking-wider text-white/80">{t.tile.today}</span>
        <span className="text-xs text-white/70">{fmtDateFull(todayIso())}</span>
      </div>

      {hasShifts ? (
        <div className="relative z-10">
          <div className="num-display text-5xl md:text-6xl text-white mb-1 drop-shadow-sm animate-pop-in">
            {fmtIls(animatedTotal)}
          </div>
          <div className="flex flex-wrap gap-2 mt-4">
            <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold bg-white/20 backdrop-blur-sm text-white">
              <span className="w-1.5 h-1.5 rounded-full bg-white" />
              {t.tile.base} {fmtIls(agg.base)}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold bg-white/20 backdrop-blur-sm text-white">
              <span className="w-1.5 h-1.5 rounded-full bg-white" />
              {t.tile.tips} {fmtIls(agg.tips)}
            </span>
            {todayExpenses > 0 && (
              <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold bg-white/10 backdrop-blur-sm text-white/90">
                <span className="w-1.5 h-1.5 rounded-full bg-white/60" />
                {t.tile.expenses} {fmtIls(todayExpenses)}
              </span>
            )}
            <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold bg-white/10 backdrop-blur-sm text-white/90">
              {agg.count} {agg.count === 1 ? t.tile.shift : t.tile.shifts}
              {agg.hours > 0 && <> · {fmtHours(agg.hours)}</>}
            </span>
          </div>
        </div>
      ) : (
        <div className="relative z-10 py-4">
          <div className="num-display text-5xl md:text-6xl text-white/40 mb-2">—</div>
          <p className="text-sm text-white/80">{t.tile.noShiftsToday}</p>
        </div>
      )}
    </div>
  )
}
