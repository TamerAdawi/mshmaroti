import { BarChart, Bar, ResponsiveContainer, XAxis, Tooltip } from 'recharts'
import { t } from '../../strings'
import { fmtIls, fmtDateShort } from '../../lib/utils'
import { trendDaily } from '../../lib/calc'
import type { Shift } from '../../types'
import { useSettings } from '../../hooks/useSettings'

export default function TrendTile({ shifts }: { shifts: Shift[] }) {
  const [settings] = useSettings()
  const data = trendDaily(shifts, 30)
  const hasData = data.some((d) => d.total > 0)

  return (
    <div className="tile p-5 relative overflow-hidden">
      <div className="absolute bottom-0 right-0 w-40 h-20 bg-indigo-soft rounded-full blur-3xl opacity-40 translate-y-8 pointer-events-none" />
      <div className="relative">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-sky-gradient flex items-center justify-center shadow-float">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 3v18h18M7 16l4-4 4 4 6-6" />
              </svg>
            </div>
            <span className="label">{t.tile.trend}</span>
          </div>
          {hasData && (
            <div className="flex items-center gap-2 text-[11px] text-body">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-sm" style={{ background: '#6366f1' }} />
                {settings.weddingName}
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-sm" style={{ background: '#fb7185' }} />
                {settings.hourlyName}
              </span>
            </div>
          )}
        </div>
        <div className="h-40 -mx-2">
          <ResponsiveContainer>
            <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 4 }}>
              <XAxis
                dataKey="date"
                tick={{ fill: '#8a8fa8', fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                interval={6}
                tickFormatter={(v: string) => fmtDateShort(v)}
                reversed
              />
              <Tooltip
                cursor={{ fill: 'rgba(99, 102, 241, 0.06)' }}
                contentStyle={{
                  background: '#ffffff',
                  border: '1px solid #e5e7f0',
                  borderRadius: 12,
                  fontSize: 12,
                  direction: 'rtl',
                  boxShadow: '0 8px 24px -8px rgba(15, 16, 32, 0.15)',
                }}
                labelStyle={{ color: '#8a8fa8' }}
                formatter={(value: number, name: string) => [fmtIls(value), name]}
                labelFormatter={(v: string) => fmtDateShort(v)}
              />
              <Bar dataKey="wedding" stackId="a" fill="#6366f1" name={settings.weddingName} />
              <Bar dataKey="hourly" stackId="a" fill="#fb7185" name={settings.hourlyName} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}
