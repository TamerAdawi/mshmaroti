import { useMemo, useState } from 'react'
import { useAllShifts } from '../hooks/useShifts'
import { useSettings } from '../hooks/useSettings'
import { t } from '../strings'
import { cn, fmtIls, fmtHours } from '../lib/utils'
import { filterByDateRange, aggregate } from '../lib/calc'
import { generateReport, type ReportOptions } from '../lib/pdfReport'
import { downloadBlob } from '../lib/export'

function monthOptions(): { offset: number; label: string; from: string; to: string }[] {
  const out: { offset: number; label: string; from: string; to: string }[] = []
  for (let i = 0; i < 12; i++) {
    const d = new Date()
    d.setDate(1)
    d.setMonth(d.getMonth() - i)
    const y = d.getFullYear()
    const m = d.getMonth()
    const first = new Date(y, m, 1)
    const last = new Date(y, m + 1, 0)
    const pad = (n: number) => String(n).padStart(2, '0')
    const from = `${first.getFullYear()}-${pad(first.getMonth() + 1)}-${pad(first.getDate())}`
    const to = `${last.getFullYear()}-${pad(last.getMonth() + 1)}-${pad(last.getDate())}`
    const label = new Intl.DateTimeFormat('he-IL', { month: 'long', year: 'numeric' }).format(first)
    out.push({ offset: -i, label, from, to })
  }
  return out
}

export default function Report() {
  const shifts = useAllShifts()
  const [settings] = useSettings()
  const [offset, setOffset] = useState(0)
  const [opts, setOpts] = useState<Omit<ReportOptions, 'monthOffset'>>({
    includeSummary: true,
    includeJobBreakdown: true,
    includeEffectiveRate: true,
    includeShifts: true,
    includeTips: true,
    includeExpenses: true,
    includeNotes: true,
  })
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const months = useMemo(() => monthOptions(), [])
  const selected = months.find((m) => m.offset === offset)!

  const preview = useMemo(() => {
    if (!shifts) return null
    const inMonth = filterByDateRange(shifts, selected.from, selected.to)
    return { agg: aggregate(inMonth), count: inMonth.length }
  }, [shifts, selected])

  const toggle = (key: keyof typeof opts) => setOpts((o) => ({ ...o, [key]: !o[key] }))

  const handleGenerate = async () => {
    if (!shifts) return
    setGenerating(true)
    setError(null)
    try {
      const blob = await generateReport(shifts, settings, { monthOffset: offset, ...opts })
      const filename = `mshmaroti-report-${selected.from.slice(0, 7)}.pdf`
      downloadBlob(blob, filename)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'שגיאה')
    } finally {
      setGenerating(false)
    }
  }

  const hasData = (preview?.count ?? 0) > 0

  return (
    <div className="mx-auto max-w-lg mt-2 space-y-4">
      <div className="px-1">
        <h2 className="font-display text-2xl font-bold text-gradient inline-block">{t.report.title}</h2>
        <p className="text-xs text-muted mt-1">{t.report.subtitle}</p>
      </div>

      {/* Month picker */}
      <section className="tile p-5">
        <div className="label mb-3">{t.report.pickMonth}</div>
        <div className="grid grid-cols-3 gap-2">
          {months.slice(0, 6).map((m) => (
            <button
              key={m.offset}
              onClick={() => setOffset(m.offset)}
              className={cn(
                'rounded-xl px-3 py-3 text-sm font-semibold transition border-2',
                m.offset === offset
                  ? 'bg-indigo-soft border-indigo/40 text-indigo-deep'
                  : 'bg-surface border-line text-body hover:border-mutedSoft',
              )}
            >
              {m.label}
            </button>
          ))}
        </div>
      </section>

      {/* Preview */}
      <section className="tile p-5">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-8 h-8 rounded-lg bg-hero-gradient flex items-center justify-center shadow-float">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" />
            </svg>
          </div>
          <div>
            <div className="text-sm font-bold text-ink">{selected.label}</div>
            <div className="text-[11px] text-muted">
              {hasData ? `${preview!.count} ${t.tile.shifts}` : t.report.noData}
            </div>
          </div>
        </div>
        {hasData && (
          <div className="grid grid-cols-3 gap-2 mt-3">
            <MiniStat label={t.report.totalGross} value={fmtIls(preview!.agg.total)} color="indigo" />
            <MiniStat label={t.report.totalHours} value={fmtHours(preview!.agg.hours)} color="violet" />
            <MiniStat label={t.report.avgPerHour} value={fmtIls(preview!.agg.effectiveRate)} color="coral" />
          </div>
        )}
      </section>

      {/* Include options */}
      <section className="tile p-5 space-y-2">
        <div className="label mb-2">{t.report.include}</div>
        <ToggleRow label={t.report.includeSummary} checked={opts.includeSummary} onChange={() => toggle('includeSummary')} />
        <ToggleRow label={t.report.includeJobBreakdown} checked={opts.includeJobBreakdown} onChange={() => toggle('includeJobBreakdown')} />
        <ToggleRow label={t.report.includeEffectiveRate} checked={opts.includeEffectiveRate} onChange={() => toggle('includeEffectiveRate')} />
        <ToggleRow label={t.report.includeShifts} checked={opts.includeShifts} onChange={() => toggle('includeShifts')} />
        {opts.includeShifts && (
          <div className="pr-4 border-r-2 border-line mr-1 space-y-2 mt-2">
            <ToggleRow small label={t.report.includeTips} checked={opts.includeTips} onChange={() => toggle('includeTips')} />
            <ToggleRow small label={t.report.includeExpenses} checked={opts.includeExpenses} onChange={() => toggle('includeExpenses')} />
            <ToggleRow small label={t.report.includeNotes} checked={opts.includeNotes} onChange={() => toggle('includeNotes')} />
          </div>
        )}
      </section>

      {error && <div className="text-sm text-neg px-1">{error}</div>}

      <button
        onClick={handleGenerate}
        disabled={!hasData || generating}
        className="btn-primary w-full flex items-center justify-center gap-2"
      >
        {generating ? (
          <>
            <Spinner />
            {t.report.generatingPdf}
          </>
        ) : (
          <>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
            </svg>
            {t.report.downloadPdf}
          </>
        )}
      </button>
    </div>
  )
}

function MiniStat({ label, value, color }: { label: string; value: string; color: 'indigo' | 'violet' | 'coral' }) {
  const colorClass = color === 'indigo' ? 'text-indigo-deep' : color === 'violet' ? 'text-violet-deep' : 'text-coral-deep'
  return (
    <div className="rounded-lg bg-elevate p-3 text-center">
      <div className="text-[10px] text-muted font-medium">{label}</div>
      <div className={cn('num-display tabular-nums text-sm mt-1', colorClass)}>{value}</div>
    </div>
  )
}

function ToggleRow({ label, checked, onChange, small = false }: { label: string; checked: boolean; onChange: () => void; small?: boolean }) {
  return (
    <label className={cn('flex items-center justify-between gap-3 cursor-pointer py-1.5', small && 'text-sm')}>
      <span className={cn(small ? 'text-body text-sm' : 'text-ink font-medium')}>{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={onChange}
        className={cn(
          'relative w-11 h-6 rounded-full transition shrink-0',
          checked ? 'bg-hero-gradient' : 'bg-elevate border border-line',
        )}
      >
        <span
          className={cn(
            'absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all',
            checked ? 'left-0.5' : 'right-0.5',
          )}
        />
      </button>
    </label>
  )
}

function Spinner() {
  return (
    <svg className="animate-spin" width="18" height="18" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.25" />
      <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  )
}
