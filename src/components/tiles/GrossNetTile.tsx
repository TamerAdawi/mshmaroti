import { useMemo } from 'react'
import type { Shift } from '../../types'
import { useSettings } from '../../hooks/useSettings'
import { calcMonthlyBreakdown } from '../../lib/payroll'
import { filterByDateRange } from '../../lib/calc'
import { startOfMonthIso, todayIso, fmtIls, cn } from '../../lib/utils'

export default function GrossNetTile({ shifts }: { shifts: Shift[] }) {
  const [settings] = useSettings()

  const monthShifts = useMemo(
    () => filterByDateRange(shifts, startOfMonthIso(), todayIso()),
    [shifts],
  )

  const b = useMemo(() => calcMonthlyBreakdown(monthShifts, settings), [monthShifts, settings])

  const hasWedding = b.weddingShifts > 0
  const hasHourly = b.hourlyShifts > 0
  const isEmpty = !hasWedding && !hasHourly

  return (
    <div className="tile p-5 relative overflow-hidden">
      <div className="absolute top-0 right-0 w-32 h-32 bg-violet-soft rounded-full blur-3xl opacity-50 -translate-y-10 translate-x-10 pointer-events-none" />
      <div className="relative">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-8 h-8 rounded-lg bg-hero-gradient flex items-center justify-center shadow-float">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 3v18h18" />
              <path d="M7 17l4-4 4 2 6-8" />
            </svg>
          </div>
          <div>
            <div className="label">ברוטו מול נטו</div>
            <div className="text-[11px] text-muted mt-0.5">פירוט מלא של החודש</div>
          </div>
        </div>

        {isEmpty ? (
          <div className="py-6 text-sm text-muted">אין משמרות החודש</div>
        ) : (
          <div className="space-y-3 mt-4">
            {/* Wedding hall — cash, no deductions */}
            {hasWedding && (
              <SectionBlock
                title={settings.weddingName}
                badge="מזומן"
                badgeColor="lime"
              >
                <Line label="סה״כ" value={fmtIls(b.weddingTotal)} bold positive />
                <div className="text-[10px] text-muted mt-1">ללא ניכויים — מה שהוכנס זה מה שיוצא</div>
              </SectionBlock>
            )}

            {/* Restaurant — wages + travel − deductions */}
            {hasHourly && (
              <SectionBlock
                title={settings.hourlyName}
                badge="עם ניכויים"
                badgeColor="coral"
              >
                <Line label="שכר ברוטו" value={fmtIls(b.hourlyWages)} />
                {b.hourlyTravel > 0 && (
                  <Line label="+ נסיעות" value={`+${fmtIls(b.hourlyTravel)}`} positive />
                )}
                {b.hourlyBituach > 0 && (
                  <Line label="− ביטוח לאומי" value={`−${fmtIls(b.hourlyBituach)}`} negative subline={`${(settings.bituachRate * 100).toFixed(2)}%`} />
                )}
                {b.hourlyPension > 0 && (
                  <Line label="− פנסיה" value={`−${fmtIls(b.hourlyPension)}`} negative subline={`${(settings.pensionRate * 100).toFixed(1)}%`} />
                )}
                {b.hourlyTax > 0 && (
                  <Line label="− מס הכנסה" value={`−${fmtIls(b.hourlyTax)}`} negative subline={`${(settings.incomeTaxRate * 100).toFixed(1)}%`} />
                )}
                <div className="h-px bg-line my-1.5" />
                <Line label="שכר נטו" value={fmtIls(b.hourlyNet)} bold positive />
              </SectionBlock>
            )}

            {/* Combined total */}
            {hasWedding && hasHourly && (
              <div className="rounded-xl bg-hero-gradient p-4 text-white shadow-glow">
                <div className="flex justify-between items-baseline">
                  <div>
                    <div className="text-[11px] opacity-85 font-medium">סה״כ נטו</div>
                    <div className="text-[10px] opacity-70 mt-0.5">אולם + שעתי</div>
                  </div>
                  <div className="num-display tabular-nums text-2xl font-bold">{fmtIls(b.totalNet)}</div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function SectionBlock({
  title,
  badge,
  badgeColor,
  children,
}: {
  title: string
  badge: string
  badgeColor: 'lime' | 'coral'
  children: React.ReactNode
}) {
  return (
    <div className="rounded-xl bg-elevate/60 border border-line p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm font-bold text-ink">{title}</div>
        <span className={cn(
          'chip text-[10px] px-1.5 py-0',
          badgeColor === 'lime' ? 'chip-lime' : 'chip-coral',
        )}>
          {badge}
        </span>
      </div>
      <div className="space-y-1">{children}</div>
    </div>
  )
}

function Line({
  label,
  value,
  subline,
  bold = false,
  positive = false,
  negative = false,
}: {
  label: string
  value: string
  subline?: string
  bold?: boolean
  positive?: boolean
  negative?: boolean
}) {
  return (
    <div className="flex justify-between items-baseline">
      <div className="flex flex-col">
        <span className={cn('text-xs', bold ? 'text-ink font-semibold' : 'text-body')}>{label}</span>
        {subline && <span className="text-[10px] text-muted">{subline}</span>}
      </div>
      <span className={cn(
        'num-display tabular-nums',
        bold ? 'text-base font-bold' : 'text-sm',
        bold && positive ? 'text-gradient' : positive ? 'text-lime-deep' : negative ? 'text-coral-deep' : 'text-ink',
      )}>
        {value}
      </span>
    </div>
  )
}
