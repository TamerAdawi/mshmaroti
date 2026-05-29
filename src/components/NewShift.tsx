import { useEffect, useMemo, useState } from 'react'
import { addShift, updateShift } from '../lib/api'
import type { JobType, Shift } from '../types'
import { t } from '../strings'
import { cn, fmtIls, hoursBetween, todayIso } from '../lib/utils'
import { useSettings } from '../hooks/useSettings'
import { calcShiftPay } from '../lib/payroll'

type Mode = 'time' | 'hours'

interface Props {
  editing: Shift | null
  onDone: () => void
  onCancel: () => void
}

export default function NewShift({ editing, onDone, onCancel }: Props) {
  const [settings] = useSettings()

  const [date, setDate] = useState(editing?.date ?? todayIso())
  const [jobType, setJobType] = useState<JobType>(editing?.jobType ?? 'wedding')
  const [mode, setMode] = useState<Mode>(editing?.startTime ? 'time' : editing ? 'hours' : 'time')
  const [startTime, setStartTime] = useState(editing?.startTime ?? '18:00')
  const [endTime, setEndTime] = useState(editing?.endTime ?? '00:00')
  const [hoursInput, setHoursInput] = useState(editing ? String(editing.hours) : '')
  const [tipsInput, setTipsInput] = useState(editing ? String(editing.tips) : '')
  const [expensesInput, setExpensesInput] = useState(editing && (editing.expenses ?? 0) > 0 ? String(editing.expenses) : '')
  const [notes, setNotes] = useState(editing?.notes ?? '')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const computedHours = useMemo(() => {
    if (mode === 'time') return hoursBetween(startTime, endTime)
    const n = Number(hoursInput)
    return Number.isFinite(n) && n > 0 ? n : null
  }, [mode, startTime, endTime, hoursInput])

  const isOvernight = useMemo(() => {
    if (mode !== 'time') return false
    return startTime && endTime && endTime <= startTime
  }, [mode, startTime, endTime])

  /** Payroll breakdown for restaurant shifts (null for wedding). */
  const breakdown = useMemo(() => {
    if (jobType !== 'hourly' || !computedHours || computedHours <= 0) return null
    return calcShiftPay(
      { date, jobType: 'hourly', hours: computedHours },
      settings.hourlyRate,
      settings,
    )
  }, [jobType, computedHours, date, settings])

  const base = useMemo(() => {
    if (jobType === 'wedding') return settings.weddingRate
    return breakdown?.gross ?? 0
  }, [jobType, breakdown, settings])

  const tips = useMemo(() => {
    const n = Number(tipsInput)
    return Number.isFinite(n) && n >= 0 ? n : 0
  }, [tipsInput])

  const expenses = useMemo(() => {
    const n = Number(expensesInput)
    return Number.isFinite(n) && n >= 0 ? n : 0
  }, [expensesInput])

  const total = base + tips

  useEffect(() => setError(null), [date, jobType, mode, startTime, endTime, hoursInput, tipsInput, expensesInput])

  const canSubmit = computedHours !== null && computedHours > 0 && !submitting

  const handleSubmit = async () => {
    if (!canSubmit) {
      if (computedHours === null || computedHours <= 0) {
        setError(mode === 'time' ? t.form.timeInvalid : t.form.hoursInvalid)
      }
      return
    }
    setSubmitting(true)
    try {
      const payload = {
        date,
        jobType,
        hours: computedHours!,
        base,
        tips,
        expenses,
        notes: notes.trim() || undefined,
        ...(mode === 'time' ? { startTime, endTime } : {}),
      }
      if (editing?.id != null) {
        await updateShift(editing.id, payload)
      } else {
        await addShift(payload)
      }
      onDone()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="mx-auto max-w-lg mt-2">
      <div className="tile p-5">
        <h2 className="font-display text-2xl font-bold mb-1 text-gradient inline-block">
          {editing ? t.form.edit : t.form.title}
        </h2>
        <div className="space-y-4 mt-5">
          <Field label={t.form.date}>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="input-field" />
          </Field>

          <Field label={t.form.jobType}>
            <div className="grid grid-cols-2 gap-2">
              <JobChip
                active={jobType === 'wedding'}
                onClick={() => setJobType('wedding')}
                name={settings.weddingName}
                sub={fmtIls(settings.weddingRate) + ' יומי'}
                color="indigo"
              />
              <JobChip
                active={jobType === 'hourly'}
                onClick={() => setJobType('hourly')}
                name={settings.hourlyName}
                sub={fmtIls(settings.hourlyRate) + ' / שעה'}
                color="coral"
              />
            </div>
          </Field>

          <Field label={t.form.inputMode}>
            <div className="flex gap-1 p-1 bg-elevate rounded-xl border border-line">
              <ModeButton active={mode === 'time'} onClick={() => setMode('time')} label={t.form.modeTime} />
              <ModeButton active={mode === 'hours'} onClick={() => setMode('hours')} label={t.form.modeHours} />
            </div>
          </Field>

          {mode === 'time' ? (
            <div className="grid grid-cols-2 gap-3">
              <Field label={t.form.startTime}>
                <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="input-field tabular-nums" />
              </Field>
              <Field label={t.form.endTime}>
                <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className="input-field tabular-nums" />
              </Field>
            </div>
          ) : (
            <Field label={t.form.hours}>
              <input type="number" inputMode="decimal" step="0.25" min="0" placeholder={t.form.hoursPlaceholder} value={hoursInput} onChange={(e) => setHoursInput(e.target.value)} className="input-field tabular-nums" />
            </Field>
          )}

          {computedHours !== null && computedHours > 0 && mode === 'time' && (
            <div className="text-xs text-indigo-deep px-1 font-semibold">
              {t.form.computedHours.replace('{h}', String(computedHours))}
              {isOvernight && <span className="text-muted mr-2 font-normal">· {t.form.overnightHint}</span>}
            </div>
          )}

          <Field label={t.form.tips}>
            <input type="number" inputMode="decimal" step="1" min="0" placeholder={t.form.tipsPlaceholder} value={tipsInput} onChange={(e) => setTipsInput(e.target.value)} className="input-field tabular-nums" />
            {jobType === 'hourly' && (
              <div className="text-[11px] text-muted mt-1 px-1">לא נכלל בחישוב הנטו (טיפים שעתי)</div>
            )}
          </Field>

          <Field label={t.form.expenses}>
            <input type="number" inputMode="decimal" step="1" min="0" placeholder={t.form.expensesPlaceholder} value={expensesInput} onChange={(e) => setExpensesInput(e.target.value)} className="input-field tabular-nums" />
            <div className="text-[11px] text-muted mt-1 px-1">{t.form.expensesHint}</div>
          </Field>

          <Field label={t.form.notes}>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={t.form.notesPlaceholder} rows={2} className="input-field resize-none" />
          </Field>

          {/* OT / rest-day breakdown for restaurant shifts */}
          {breakdown && (breakdown.isRestDay || breakdown.otTier1Hours > 0) && (
            <div className="rounded-xl bg-violet-soft/60 border border-violet/20 p-4 space-y-1.5">
              <div className="flex items-center gap-2 mb-1.5">
                <div className="w-7 h-7 rounded-lg bg-hero-gradient flex items-center justify-center shrink-0">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="9" />
                    <path d="M12 7v5l3 2" />
                  </svg>
                </div>
                <div className="text-xs font-semibold text-violet-deep">
                  {breakdown.isRestDay ? 'יום מנוחה ועוד' : 'פירוט שעות נוספות'}
                </div>
              </div>
              {breakdown.regularHours > 0 && (
                <BreakdownRow
                  label={`${breakdown.regularHours} ש' × ${breakdown.multipliers.regular}`}
                  value={fmtIls(breakdown.regularHours * settings.hourlyRate * breakdown.multipliers.regular)}
                  hint={breakdown.isRestDay ? 'יום מנוחה' : 'רגיל'}
                />
              )}
              {breakdown.otTier1Hours > 0 && (
                <BreakdownRow
                  label={`${breakdown.otTier1Hours} ש' × ${breakdown.multipliers.ot1}`}
                  value={fmtIls(breakdown.otTier1Hours * settings.hourlyRate * breakdown.multipliers.ot1)}
                  hint="שעות נוספות 125%"
                />
              )}
              {breakdown.otTier2Hours > 0 && (
                <BreakdownRow
                  label={`${breakdown.otTier2Hours} ש' × ${breakdown.multipliers.ot2}`}
                  value={fmtIls(breakdown.otTier2Hours * settings.hourlyRate * breakdown.multipliers.ot2)}
                  hint="שעות נוספות 150%"
                />
              )}
            </div>
          )}

          {/* Live totals — colorful */}
          <div className="rounded-xl bg-hero-soft border border-line/60 p-4 space-y-2">
            <Row label={t.form.basePreview} value={fmtIls(base)} color="text-indigo-deep" />
            <Row label={t.tile.tips} value={fmtIls(tips)} color="text-lime-deep" />
            {expenses > 0 && <Row label={t.tile.expenses} value={fmtIls(expenses)} color="text-peach-deep" />}
            <div className="h-px bg-line my-1" />
            <Row label={t.form.totalPreview} value={fmtIls(total)} strong />
          </div>

          {error && <div className="text-sm text-neg">{error}</div>}

          <div className="flex gap-2 pt-1">
            <button onClick={handleSubmit} disabled={!canSubmit} className="btn-primary flex-1">
              {editing ? t.form.update : t.form.save}
            </button>
            <button onClick={onCancel} className="btn-secondary">{t.form.cancel}</button>
          </div>
        </div>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="label mb-2">{label}</div>
      {children}
    </label>
  )
}

function JobChip({ active, onClick, name, sub, color }: { active: boolean; onClick: () => void; name: string; sub: string; color: 'indigo' | 'coral' }) {
  const activeClass = color === 'indigo'
    ? 'bg-indigo-soft border-indigo/40 text-indigo-deep'
    : 'bg-coral-soft border-coral/40 text-coral-deep'
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'rounded-xl p-3 text-right transition border-2',
        active ? activeClass : 'bg-surface border-line text-ink hover:border-mutedSoft',
      )}
    >
      <div className="font-semibold">{name}</div>
      <div className={cn('text-[11px] mt-0.5', active ? 'opacity-80' : 'text-muted')}>{sub}</div>
    </button>
  )
}

function ModeButton({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex-1 rounded-lg py-2 text-sm font-semibold transition',
        active ? 'bg-surface text-ink shadow-tile' : 'text-muted hover:text-body',
      )}
    >
      {label}
    </button>
  )
}

function Row({ label, value, strong = false, color }: { label: string; value: string; strong?: boolean; color?: string }) {
  return (
    <div className="flex justify-between items-baseline">
      <span className={cn('text-sm', strong ? 'text-ink font-semibold' : 'text-body')}>{label}</span>
      <span className={cn(
        'num-display tabular-nums',
        strong ? 'text-xl text-gradient' : cn('text-base', color ?? 'text-ink'),
      )}>
        {value}
      </span>
    </div>
  )
}

function BreakdownRow({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="flex justify-between items-baseline">
      <div className="flex flex-col">
        <span className="text-xs text-body font-medium">{label}</span>
        {hint && <span className="text-[10px] text-muted">{hint}</span>}
      </div>
      <span className="num-display tabular-nums text-sm text-violet-deep font-semibold">
        {value}
      </span>
    </div>
  )
}
