import { useEffect, useMemo, useState } from 'react'
import { addShift, updateShift } from '../lib/api'
import type { JobType, Shift } from '../types'
import { t } from '../strings'
import { cn, fmtIls, fmtHours, hoursBetween, todayIso } from '../lib/utils'
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
  const [breakInput, setBreakInput] = useState(editing && (editing.breakMinutes ?? 0) > 0 ? String(editing.breakMinutes) : '')
  const [multiplierInput, setMultiplierInput] = useState(
    editing?.rateMultiplier && editing.rateMultiplier !== 1.0 ? String(editing.rateMultiplier) : '1'
  )
  const [notes, setNotes] = useState(editing?.notes ?? '')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // Force time mode when hourly — required for accurate rest day window calc
  useEffect(() => {
    if (jobType === 'hourly' && mode === 'hours') setMode('time')
  }, [jobType, mode])

  // Unpaid break in minutes — only applies to the hourly job.
  const breakMinutes = useMemo(() => {
    if (jobType !== 'hourly') return 0
    const n = Number(breakInput)
    return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0
  }, [jobType, breakInput])

  const computedHours = useMemo(() => {
    if (mode === 'time') {
      const span = hoursBetween(startTime, endTime)
      if (span === null) return null
      const net = Math.round((span - breakMinutes / 60) * 100) / 100
      return net > 0 ? net : null
    }
    const n = Number(hoursInput)
    return Number.isFinite(n) && n > 0 ? n : null
  }, [mode, startTime, endTime, hoursInput, breakMinutes])

  const isOvernight = useMemo(() => {
    if (mode !== 'time') return false
    return startTime && endTime && endTime <= startTime
  }, [mode, startTime, endTime])

  const rateMultiplier = useMemo(() => {
    const n = Number(multiplierInput)
    return Number.isFinite(n) && n > 0 ? n : 1.0
  }, [multiplierInput])

  const tips = useMemo(() => {
    const n = Number(tipsInput)
    return Number.isFinite(n) && n >= 0 ? n : 0
  }, [tipsInput])

  const expenses = useMemo(() => {
    const n = Number(expensesInput)
    return Number.isFinite(n) && n >= 0 ? n : 0
  }, [expensesInput])

  /** Payroll breakdown for restaurant shifts (null for wedding). */
  const breakdown = useMemo(() => {
    if (jobType !== 'hourly' || !computedHours || computedHours <= 0) return null
    return calcShiftPay(
      {
        date,
        jobType: 'hourly',
        hours: computedHours,
        startTime: mode === 'time' ? startTime : undefined,
        endTime: mode === 'time' ? endTime : undefined,
        tips,
        rateMultiplier,
      },
      settings.hourlyRate,
      settings,
    )
  }, [jobType, computedHours, date, startTime, endTime, mode, tips, rateMultiplier, settings])

  // base = hourly_calc (what was earned from wages before tip comparison)
  // For wedding: base = weddingRate (flat)
  // For hourly: base = breakdown.hourlyCalc (what hourly math produced)
  const base = useMemo(() => {
    if (jobType === 'wedding') return settings.weddingRate
    return breakdown?.hourlyCalc ?? 0
  }, [jobType, breakdown, settings])

  // total = wedding: base+tips, hourly: max(base, tips) per Israeli tip law
  const total = useMemo(() => {
    if (jobType === 'wedding') return base + tips
    return breakdown?.gross ?? Math.max(base, tips)
  }, [jobType, base, tips, breakdown])

  useEffect(() => setError(null), [date, jobType, mode, startTime, endTime, hoursInput, tipsInput, expensesInput, multiplierInput, breakInput])

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
        breakMinutes: jobType === 'hourly' ? breakMinutes : 0,
        base,
        tips,
        expenses,
        rateMultiplier: jobType === 'hourly' ? rateMultiplier : 1.0,
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
              <ModeButton
                active={mode === 'hours'}
                onClick={() => jobType !== 'hourly' && setMode('hours')}
                label={t.form.modeHours}
                disabled={jobType === 'hourly'}
              />
            </div>
            {jobType === 'hourly' && (
              <div className="text-[11px] text-muted mt-1 px-1">
                מצב שעות זמין רק לאולם. במשרה שעתית נדרשת שעת התחלה וסיום לחישוב מדויק של יום מנוחה ושעות נוספות.
              </div>
            )}
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

          {jobType === 'hourly' && mode === 'time' && (
            <Field label={t.form.breakTime}>
              <input
                type="number"
                inputMode="numeric"
                step="5"
                min="0"
                placeholder={t.form.breakPlaceholder}
                value={breakInput}
                onChange={(e) => setBreakInput(e.target.value)}
                className="input-field tabular-nums"
              />
              <div className="text-[11px] text-muted mt-1 px-1">{t.form.breakHint}</div>
            </Field>
          )}

          {computedHours !== null && computedHours > 0 && mode === 'time' && (
            <div className="text-xs text-indigo-deep px-1 font-semibold">
              {t.form.computedHours.replace('{h}', String(computedHours))}
              {isOvernight && <span className="text-muted mr-2 font-normal">· {t.form.overnightHint}</span>}
              {breakMinutes > 0 && (
                <span className="text-muted mr-2 font-normal">· {t.form.breakDeducted.replace('{m}', String(breakMinutes))}</span>
              )}
            </div>
          )}

          <Field label={t.form.tips}>
            <input type="number" inputMode="decimal" step="1" min="0" placeholder={t.form.tipsPlaceholder} value={tipsInput} onChange={(e) => setTipsInput(e.target.value)} className="input-field tabular-nums" />
            {jobType === 'hourly' && tips > 0 && breakdown && (
              <div className="text-[11px] mt-1 px-1">
                {breakdown.tipsWon ? (
                  <span className="text-lime-deep font-semibold">✓ טיפים גבוהים יותר — יקבעו את השכר</span>
                ) : (
                  <span className="text-muted">השכר השעתי גבוה יותר — הוא יקבע (חוק הטיפים)</span>
                )}
              </div>
            )}
          </Field>

          <Field label={t.form.expenses}>
            <input type="number" inputMode="decimal" step="1" min="0" placeholder={t.form.expensesPlaceholder} value={expensesInput} onChange={(e) => setExpensesInput(e.target.value)} className="input-field tabular-nums" />
            <div className="text-[11px] text-muted mt-1 px-1">{t.form.expensesHint}</div>
          </Field>

          {jobType === 'hourly' && (
            <Field label="מכפיל שכר (אופציונלי)">
              <input
                type="number"
                inputMode="decimal"
                step="0.1"
                min="0.1"
                value={multiplierInput}
                onChange={(e) => setMultiplierInput(e.target.value)}
                className="input-field tabular-nums"
              />
              <div className="text-[11px] text-muted mt-1 px-1">
                ברירת מחדל 1.0. כשערך שונה — מבטל את חישוב יום מנוחה ושעות נוספות, ומכפיל ישירות בשכר השעתי.
              </div>
            </Field>
          )}

          <Field label={t.form.notes}>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={t.form.notesPlaceholder} rows={2} className="input-field resize-none" />
          </Field>

          {/* Pay breakdown widget */}
          {breakdown && (breakdown.restDayHours > 0 || breakdown.tierOt1Hours > 0 || breakdown.tierOt2Hours > 0 || breakdown.multiplierOverride || breakdown.tipsWon) && (
            <div className="rounded-xl bg-violet-soft/60 border border-violet/20 p-4 space-y-1.5">
              <div className="flex items-center gap-2 mb-1.5">
                <div className="w-7 h-7 rounded-lg bg-hero-gradient flex items-center justify-center shrink-0">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="9" />
                    <path d="M12 7v5l3 2" />
                  </svg>
                </div>
                <div className="text-xs font-semibold text-violet-deep">
                  {breakdown.multiplierOverride
                    ? `מכפיל ${rateMultiplier}× — ללא חישוב שעות נוספות`
                    : breakdown.restDayHours > 0
                      ? `${fmtHours(breakdown.restDayHours)} ביום מנוחה`
                      : 'פירוט שעות נוספות'}
                </div>
              </div>
              {!breakdown.multiplierOverride && breakdown.restDayHours > 0 && (
                <BreakdownRow
                  label={`${fmtHours(breakdown.restDayHours)} ביום מנוחה (×1.5+)`}
                  value={fmtIls(breakdown.restDayHours * settings.hourlyRate * 1.5)}
                  hint={`חלון: שבת 19:00 → ראשון 19:00`}
                />
              )}
              {!breakdown.multiplierOverride && breakdown.regularHours > 0 && (
                <BreakdownRow
                  label={`${fmtHours(breakdown.regularHours)} מחוץ ליום מנוחה`}
                  value={fmtIls(breakdown.regularHours * settings.hourlyRate * 1.0)}
                  hint="רגיל × 1.0"
                />
              )}
              {!breakdown.multiplierOverride && breakdown.tierOt1Hours > 0 && (
                <BreakdownRow
                  label={`${fmtHours(breakdown.tierOt1Hours)} שעות נוספות`}
                  value="במכפיל ×1.25"
                  hint="שעות 9-10"
                />
              )}
              {!breakdown.multiplierOverride && breakdown.tierOt2Hours > 0 && (
                <BreakdownRow
                  label={`${fmtHours(breakdown.tierOt2Hours)} שעות נוספות`}
                  value="במכפיל ×1.5"
                  hint="שעות 11+"
                />
              )}
              <div className="h-px bg-violet/15 my-1" />
              <BreakdownRow label="חישוב שעתי" value={fmtIls(breakdown.hourlyCalc)} hint="לפני השוואה עם טיפים" />
              {tips > 0 && breakdown.tipsWon && (
                <div className="text-xs text-lime-deep font-bold pt-1">
                  ★ טיפים גבוהים — השכר ייקבע לפי הטיפים
                </div>
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

function ModeButton({ active, onClick, label, disabled = false }: { active: boolean; onClick: () => void; label: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'flex-1 rounded-lg py-2 text-sm font-semibold transition',
        active ? 'bg-surface text-ink shadow-tile' : 'text-muted hover:text-body',
        disabled && 'opacity-40 cursor-not-allowed hover:text-muted',
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
