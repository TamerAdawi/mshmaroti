import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts'
import { t } from '../../strings'
import { fmtIls } from '../../lib/utils'
import { jobSplit } from '../../lib/calc'
import type { Shift } from '../../types'
import { useSettings } from '../../hooks/useSettings'

const WEDDING_COLOR = '#6366f1' // indigo
const HOURLY_COLOR = '#fb7185' // coral

export default function SplitTile({ shifts }: { shifts: Shift[] }) {
  const split = jobSplit(shifts)
  const [settings] = useSettings()
  const hasData = split.wedding.total + split.hourly.total > 0

  const data = [
    { name: settings.weddingName, value: split.wedding.total, color: WEDDING_COLOR },
    { name: settings.hourlyName, value: split.hourly.total, color: HOURLY_COLOR },
  ]

  return (
    <div className="tile p-5 relative overflow-hidden">
      <div className="absolute top-0 left-0 w-32 h-32 bg-violet-soft rounded-full blur-3xl opacity-50 -translate-y-12 -translate-x-8 pointer-events-none" />
      <div className="relative">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-8 h-8 rounded-lg bg-violet-gradient flex items-center justify-center shadow-float">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
              <path d="M21.21 15.89A10 10 0 1 1 8 2.83M22 12A10 10 0 0 0 12 2v10z" />
            </svg>
          </div>
          <span className="label">{t.tile.split}</span>
        </div>
        {hasData ? (
          <div className="flex items-center gap-4 mt-3">
            <div className="w-24 h-24 shrink-0">
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={data} dataKey="value" innerRadius={28} outerRadius={44} startAngle={90} endAngle={450} stroke="none" isAnimationActive={false}>
                    {data.map((d) => (
                      <Cell key={d.name} fill={d.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex-1 min-w-0">
              <Row color={WEDDING_COLOR} name={settings.weddingName} value={split.wedding.total} share={split.weddingShare} />
              <Row color={HOURLY_COLOR} name={settings.hourlyName} value={split.hourly.total} share={split.hourlyShare} />
            </div>
          </div>
        ) : (
          <div className="py-6 text-sm text-muted">{t.tile.noShifts}</div>
        )}
      </div>
    </div>
  )
}

function Row({ color, name, value, share }: { color: string; name: string; value: number; share: number }) {
  return (
    <div className="flex items-center justify-between gap-2 py-1.5">
      <div className="flex items-center gap-2 min-w-0">
        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: color }} />
        <span className="text-sm text-body truncate">{name}</span>
      </div>
      <div className="text-xs text-muted tabular-nums shrink-0">
        <span className="text-ink font-semibold">{fmtIls(value)}</span>
        <span className="mx-1.5 opacity-40">·</span>
        {(share * 100).toFixed(0)}%
      </div>
    </div>
  )
}
