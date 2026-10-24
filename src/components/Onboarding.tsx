import { useState } from 'react'
import { t } from '../strings'
import { cn } from '../lib/utils'
import { useAuth } from '../lib/auth'
import { DEFAULT_SETTINGS, type Jobs, type Settings } from '../lib/settings'
import Logo from './Logo'

interface Props {
  settings: Settings
  onSave: (next: Settings) => Promise<void>
}

/**
 * First-time setup, shown once after sign-up: which job(s) this worker has and
 * what each pays. Everything else (overtime, deductions, travel…) starts at the
 * defaults and can be changed later in Settings.
 */
export default function Onboarding({ settings, onSave }: Props) {
  const { signOut } = useAuth()
  const [jobs, setJobs] = useState<Jobs | null>(null)
  const [weddingRate, setWeddingRate] = useState('')
  const [hourlyRate, setHourlyRate] = useState('')
  const [weddingName, setWeddingName] = useState('')
  const [hourlyName, setHourlyName] = useState('')
  const [tried, setTried] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const wantsWedding = jobs === 'wedding' || jobs === 'both'
  const wantsHourly = jobs === 'hourly' || jobs === 'both'
  const wRate = Number(weddingRate)
  const hRate = Number(hourlyRate)
  const wOk = !wantsWedding || (Number.isFinite(wRate) && wRate > 0)
  const hOk = !wantsHourly || (Number.isFinite(hRate) && hRate > 0)

  const handleFinish = async () => {
    setTried(true)
    if (!jobs || !wOk || !hOk) return
    setSaving(true)
    setError(null)
    try {
      await onSave({
        ...settings,
        jobs,
        onboarded: true,
        // A job the worker doesn't have keeps its default rate and name, so
        // switching it on later in Settings starts from something sensible.
        weddingRate: wantsWedding ? wRate : settings.weddingRate,
        hourlyRate: wantsHourly ? hRate : settings.hourlyRate,
        weddingName: (wantsWedding && weddingName.trim()) || DEFAULT_SETTINGS.weddingName,
        hourlyName: (wantsHourly && hourlyName.trim()) || DEFAULT_SETTINGS.hourlyName,
      })
    } catch (err) {
      console.error('Onboarding save failed:', err)
      setError(t.onboarding.saveFailed)
      setSaving(false)
    }
  }

  return (
    <div className="min-h-dvh flex flex-col items-center justify-center px-4 py-10 safe-top">
      <div className="w-full max-w-md animate-fade-up">
        <div className="flex flex-col items-center text-center mb-6">
          <Logo className="w-14 h-14 shadow-glow mb-4" />
          <h1 className="font-display text-2xl font-bold text-gradient inline-block">{t.onboarding.title}</h1>
          <p className="text-sm text-muted mt-1.5">{t.onboarding.subtitle}</p>
        </div>

        <div className="tile p-5 space-y-5">
          <div>
            <div className="label mb-3">{t.onboarding.whichJob}</div>
            <div className="grid gap-2" role="radiogroup">
              <JobCard
                active={jobs === 'wedding'}
                onClick={() => setJobs('wedding')}
                title={t.onboarding.weddingTitle}
                sub={t.onboarding.weddingSub}
                color="indigo"
              />
              <JobCard
                active={jobs === 'hourly'}
                onClick={() => setJobs('hourly')}
                title={t.onboarding.hourlyTitle}
                sub={t.onboarding.hourlySub}
                color="coral"
              />
              <JobCard
                active={jobs === 'both'}
                onClick={() => setJobs('both')}
                title={t.onboarding.bothTitle}
                sub={t.onboarding.bothSub}
                color="violet"
              />
            </div>
          </div>

          {wantsWedding && (
            <section className="space-y-3 animate-fade-up">
              <div className="h-px bg-line" />
              <div className="text-sm font-bold text-indigo-deep">{t.onboarding.weddingSection}</div>
              <Field label={t.onboarding.weddingRate} error={tried && !wOk ? t.onboarding.rateRequired : null}>
                <input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="1"
                  placeholder="0"
                  value={weddingRate}
                  onChange={(e) => setWeddingRate(e.target.value)}
                  className="input-field tabular-nums"
                />
              </Field>
              <Field label={t.onboarding.jobName}>
                <input
                  type="text"
                  placeholder={t.onboarding.weddingNamePlaceholder}
                  value={weddingName}
                  onChange={(e) => setWeddingName(e.target.value)}
                  className="input-field"
                />
              </Field>
            </section>
          )}

          {wantsHourly && (
            <section className="space-y-3 animate-fade-up">
              <div className="h-px bg-line" />
              <div className="text-sm font-bold text-coral-deep">{t.onboarding.hourlySection}</div>
              <Field label={t.onboarding.hourlyRate} error={tried && !hOk ? t.onboarding.rateRequired : null}>
                <input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.5"
                  placeholder="0"
                  value={hourlyRate}
                  onChange={(e) => setHourlyRate(e.target.value)}
                  className="input-field tabular-nums"
                />
              </Field>
              <Field label={t.onboarding.jobName}>
                <input
                  type="text"
                  placeholder={t.onboarding.hourlyNamePlaceholder}
                  value={hourlyName}
                  onChange={(e) => setHourlyName(e.target.value)}
                  className="input-field"
                />
              </Field>
            </section>
          )}

          {error && <div className="text-sm text-neg">{error}</div>}

          <div className="space-y-2 pt-1">
            <button onClick={handleFinish} disabled={!jobs || saving} className="btn-primary w-full">
              {saving ? t.onboarding.saving : t.onboarding.finish}
            </button>
            {jobs && <div className="text-[11px] text-muted text-center">{t.onboarding.laterHint}</div>}
          </div>
        </div>

        <button
          onClick={() => void signOut()}
          className="block mx-auto mt-4 text-xs text-muted hover:text-ink transition"
        >
          {t.onboarding.wrongAccount} {t.auth.signOut}
        </button>
      </div>
    </div>
  )
}

function JobCard({
  active,
  onClick,
  title,
  sub,
  color,
}: {
  active: boolean
  onClick: () => void
  title: string
  sub: string
  color: 'indigo' | 'coral' | 'violet'
}) {
  const activeClass = {
    indigo: 'bg-indigo-soft border-indigo/40 text-indigo-deep',
    coral: 'bg-coral-soft border-coral/40 text-coral-deep',
    violet: 'bg-violet-soft border-violet/40 text-violet-deep',
  }[color]
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      onClick={onClick}
      className={cn(
        'rounded-xl p-3.5 text-right transition border-2 flex items-center justify-between gap-3',
        active ? activeClass : 'bg-surface border-line text-ink hover:border-mutedSoft',
      )}
    >
      <div>
        <div className="font-semibold">{title}</div>
        <div className={cn('text-[11px] mt-0.5', active ? 'opacity-80' : 'text-muted')}>{sub}</div>
      </div>
      <span
        className={cn(
          'w-5 h-5 rounded-full border-2 shrink-0 flex items-center justify-center',
          active ? 'border-current' : 'border-line',
        )}
      >
        {active && <span className="w-2.5 h-2.5 rounded-full bg-current" />}
      </span>
    </button>
  )
}

function Field({ label, error, children }: { label: string; error?: string | null; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="label mb-2">{label}</div>
      {children}
      {error && <div className="text-[11px] text-neg mt-1 px-1">{error}</div>}
    </label>
  )
}
