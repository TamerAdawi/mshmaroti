import { t } from '../../strings'
import { fmtIls, cn } from '../../lib/utils'
import { jobSplit } from '../../lib/calc'
import type { Shift } from '../../types'
import { useSettings } from '../../hooks/useSettings'

export default function EffectiveRateTile({ shifts }: { shifts: Shift[] }) {
  const [settings] = useSettings()
  const split = jobSplit(shifts)
  const wRate = split.wedding.effectiveRate
  const hRate = split.hourly.effectiveRate
  const bothHaveData = wRate > 0 && hRate > 0
  const winner: 'wedding' | 'hourly' | null = !bothHaveData
    ? null
    : wRate >= hRate
      ? 'wedding'
      : 'hourly'
  const diff = Math.abs(wRate - hRate)
  const maxRate = Math.max(wRate, hRate, 1)

  return (
    <div className="tile p-5 relative overflow-hidden">
      <div className="absolute top-0 left-0 w-32 h-32 bg-violet-soft rounded-full blur-3xl opacity-50 -translate-y-10 -translate-x-10 pointer-events-none" />
      <div className="relative">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-8 h-8 rounded-lg bg-hero-gradient flex items-center justify-center shadow-float">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
            </svg>
          </div>
          <div>
            <div className="label">{t.tile.effectiveRateTile}</div>
            <div className="text-[11px] text-muted mt-0.5">{t.tile.effectiveRateSubtitle}</div>
          </div>
        </div>

        {bothHaveData ? (
          <div className="mt-4 space-y-4">
            <RateBar
              name={settings.weddingName}
              rate={wRate}
              maxRate={maxRate}
              isWinner={winner === 'wedding'}
              color="indigo"
            />
            <RateBar
              name={settings.hourlyName}
              rate={hRate}
              maxRate={maxRate}
              isWinner={winner === 'hourly'}
              color="coral"
            />
            {winner && (
              <div className="rounded-xl bg-hero-soft border border-line p-3 mt-3 flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-hero-gradient flex items-center justify-center shrink-0 shadow-float">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M8 21h8M12 17v4M7 4h10l1 2h3v2a4 4 0 0 1-4 4M7 4v8a5 5 0 0 0 10 0V4M7 4H4v2a4 4 0 0 0 4 4" />
                  </svg>
                </div>
                <div className="text-sm text-body">
                  <span className="font-bold text-ink">
                    {winner === 'wedding' ? settings.weddingName : settings.hourlyName}
                  </span>{' '}
                  {t.tile.winner}
                  <span className="text-gradient font-bold"> {fmtIls(diff)}{t.common.perHour}</span>
                </div>
              </div>
            )}
          </div>
        ) : wRate > 0 || hRate > 0 ? (
          <div className="py-4 text-sm text-muted">
            צריך נתונים משתי העבודות להשוואה
          </div>
        ) : (
          <div className="py-6 text-sm text-muted">{t.tile.noShifts}</div>
        )}
      </div>
    </div>
  )
}

function RateBar({
  name,
  rate,
  maxRate,
  isWinner,
  color,
}: {
  name: string
  rate: number
  maxRate: number
  isWinner: boolean
  color: 'indigo' | 'coral'
}) {
  const pct = maxRate > 0 ? (rate / maxRate) * 100 : 0
  const barClass = color === 'indigo'
    ? 'bg-gradient-to-r from-indigo to-violet'
    : 'bg-gradient-to-r from-coral to-peach'

  return (
    <div>
      <div className="flex items-baseline justify-between mb-1.5">
        <div className="flex items-center gap-1.5">
          <span className="text-sm text-body font-medium">{name}</span>
          {isWinner && (
            <span className="chip chip-lime text-[10px] px-1.5 py-0 font-bold">
              ⬆ מנצח
            </span>
          )}
        </div>
        <span className={cn(
          'num-display tabular-nums text-lg',
          isWinner ? 'text-gradient' : color === 'indigo' ? 'text-indigo-deep' : 'text-coral-deep',
        )}>
          {fmtIls(rate)}<span className="text-xs font-normal text-muted">{t.common.perHour}</span>
        </span>
      </div>
      <div className="h-3 bg-elevate rounded-full overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all duration-500', barClass)}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}
