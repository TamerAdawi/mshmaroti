import { useEffect, useRef, useState } from 'react'
import { useSettings } from '../hooks/useSettings'
import { DEFAULT_SETTINGS } from '../lib/settings'
import { clearAll } from '../lib/api'
import { exportCsv, exportJson, downloadBlob, importJsonFile, makeFilename } from '../lib/export'
import { useAuth } from '../lib/auth'
import { t } from '../strings'
import { cn } from '../lib/utils'

export default function Settings() {
  const { user, signOut } = useAuth()
  const [settings, update] = useSettings()
  const [draft, setDraft] = useState(settings)
  const [toast, setToast] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  // Sync draft when async settings load
  useEffect(() => {
    setDraft(settings)
  }, [settings])

  const isDirty = JSON.stringify(draft) !== JSON.stringify(settings)

  const flash = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 2500)
  }

  const handleSave = async () => {
    await update(draft)
    flash(t.settings.settingsSaved)
  }

  const handleExportCsv = async () => downloadBlob(await exportCsv(), makeFilename('csv'))
  const handleExportJson = async () => downloadBlob(await exportJson(), makeFilename('json'))
  const handleImportClick = () => fileRef.current?.click()
  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    try {
      const res = await importJsonFile(f)
      flash(t.settings.imported.replace('{n}', String(res.imported)))
    } catch (err) {
      flash(err instanceof Error ? err.message : 'שגיאה')
    }
  }
  const handleClear = async () => {
    if (!confirm(t.settings.clearConfirm)) return
    await clearAll()
    flash('נמחק')
  }

  return (
    <div className="mx-auto max-w-lg mt-2 space-y-4">
      <h2 className="font-display text-2xl font-bold px-1 text-gradient inline-block">{t.settings.title}</h2>

      <section className="tile p-5 space-y-4">
        <div>
          <div className="label">{t.settings.rates}</div>
          <div className="text-xs text-muted mt-1">{t.settings.rateHint}</div>
        </div>

        <div className="space-y-3">
          <Field label={t.settings.weddingName}>
            <input type="text" value={draft.weddingName} onChange={(e) => setDraft({ ...draft, weddingName: e.target.value })} className="input-field" />
          </Field>
          <Field label={t.settings.weddingRate}>
            <input type="number" inputMode="decimal" min="0" value={draft.weddingRate} onChange={(e) => setDraft({ ...draft, weddingRate: Number(e.target.value) || 0 })} className="input-field tabular-nums" />
          </Field>
          <Field label={t.settings.hourlyName}>
            <input type="text" value={draft.hourlyName} onChange={(e) => setDraft({ ...draft, hourlyName: e.target.value })} className="input-field" />
          </Field>
          <Field label={t.settings.hourlyRate}>
            <input type="number" inputMode="decimal" min="0" value={draft.hourlyRate} onChange={(e) => setDraft({ ...draft, hourlyRate: Number(e.target.value) || 0 })} className="input-field tabular-nums" />
          </Field>
        </div>
      </section>

      {/* Payroll calculation parameters (v2.1) */}
      <section className="tile p-5 space-y-4">
        <div>
          <div className="label">תנאי עבודה — שעתי</div>
          <div className="text-xs text-muted mt-1">פרמטרים לחישוב שעות נוספות, יום מנוחה וניכויים</div>
        </div>

        <div className="space-y-3">
          <Field label="יום מנוחה שבועי">
            <select
              value={draft.restDayOfWeek}
              onChange={(e) => setDraft({ ...draft, restDayOfWeek: Number(e.target.value) })}
              className="input-field"
            >
              <option value={0}>ראשון</option>
              <option value={1}>שני</option>
              <option value={2}>שלישי</option>
              <option value={3}>רביעי</option>
              <option value={4}>חמישי</option>
              <option value={5}>שישי</option>
              <option value={6}>שבת</option>
            </select>
            <div className="text-[11px] text-muted mt-1 px-1">כל השעות ביום זה משולמות במכפיל ×1.5</div>
          </Field>

          <Field label="שעות יומיות עד שעות נוספות">
            <input type="number" inputMode="decimal" min="0" step="0.1" value={draft.dailyHoursThreshold} onChange={(e) => setDraft({ ...draft, dailyHoursThreshold: Number(e.target.value) || 8 })} className="input-field tabular-nums" />
            <div className="text-[11px] text-muted mt-1 px-1">לפי החוק: 8 שעות, מעבר לכך 125% ואז 150%</div>
          </Field>

          <Field label="נסיעות חודשי (₪)">
            <input type="number" inputMode="decimal" min="0" value={draft.hourlyMonthlyTravel} onChange={(e) => setDraft({ ...draft, hourlyMonthlyTravel: Number(e.target.value) || 0 })} className="input-field tabular-nums" />
            <div className="text-[11px] text-muted mt-1 px-1">סכום נוסף לחודש (פטור ממס)</div>
          </Field>

          <Field label="ביטוח לאומי + ביטוח בריאות (%)">
            <input type="number" inputMode="decimal" min="0" step="0.01" value={(draft.bituachRate * 100).toFixed(2)} onChange={(e) => setDraft({ ...draft, bituachRate: (Number(e.target.value) || 0) / 100 })} className="input-field tabular-nums" />
            <div className="text-[11px] text-muted mt-1 px-1">ברירת מחדל 4.27% (מדרגה מופחתת, עד 7,703 ₪/חודש)</div>
          </Field>

          <Field label="פנסיה — אחוז עובד (%)">
            <input type="number" inputMode="decimal" min="0" step="0.1" value={(draft.pensionRate * 100).toFixed(1)} onChange={(e) => setDraft({ ...draft, pensionRate: (Number(e.target.value) || 0) / 100 })} className="input-field tabular-nums" />
            <div className="text-[11px] text-muted mt-1 px-1">לפי החוזה: 6% (חדש: 5.5%)</div>
          </Field>

          <label className="flex items-center justify-between gap-3 cursor-pointer py-2">
            <div className="flex flex-col">
              <span className="text-ink font-medium text-sm">פנסיה פעילה</span>
              <span className="text-[11px] text-muted">להפעיל אחרי 6 חודשי עבודה</span>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={draft.pensionActive}
              onClick={() => setDraft({ ...draft, pensionActive: !draft.pensionActive })}
              className={cn(
                'relative w-11 h-6 rounded-full transition shrink-0',
                draft.pensionActive ? 'bg-hero-gradient' : 'bg-elevate border border-line',
              )}
            >
              <span
                className={cn(
                  'absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all',
                  draft.pensionActive ? 'left-0.5' : 'right-0.5',
                )}
              />
            </button>
          </label>

          <Field label="מס הכנסה (%)">
            <input type="number" inputMode="decimal" min="0" step="0.1" value={(draft.incomeTaxRate * 100).toFixed(1)} onChange={(e) => setDraft({ ...draft, incomeTaxRate: (Number(e.target.value) || 0) / 100 })} className="input-field tabular-nums" />
            <div className="text-[11px] text-muted mt-1 px-1">בד״כ 0% לסטודנט (נקודות זיכוי מכסות)</div>
          </Field>
        </div>

        <div className="flex gap-2 pt-1">
          <button disabled={!isDirty} onClick={handleSave} className="btn-primary flex-1">{t.settings.saveSettings}</button>
          {isDirty && <button onClick={() => setDraft(settings)} className="btn-secondary">{t.form.cancel}</button>}
        </div>
        <button onClick={() => setDraft(DEFAULT_SETTINGS)} className="text-xs text-muted hover:text-ink transition">
          איפוס לברירת מחדל
        </button>
      </section>

      <section className="tile p-5 space-y-3">
        <div className="label">{t.settings.data}</div>
        <button onClick={handleExportCsv} className="btn-secondary w-full">{t.settings.exportCsv}</button>
        <button onClick={handleExportJson} className="btn-secondary w-full">{t.settings.exportJson}</button>
        <button onClick={handleImportClick} className="btn-secondary w-full">{t.settings.importJson}</button>
        <input ref={fileRef} type="file" accept="application/json,.json" onChange={handleImportFile} className="hidden" />
        <button onClick={handleClear} className="btn-danger w-full">{t.settings.clearAll}</button>
      </section>

      <section className="tile p-5">
        <div className="label mb-3">{t.auth.signedInAs}</div>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-hero-gradient flex items-center justify-center shrink-0 shadow-float">
            <span className="font-bold text-white text-sm">
              {(user?.email?.[0] ?? '?').toUpperCase()}
            </span>
          </div>
          <div className="text-sm text-ink truncate flex-1 min-w-0">{user?.email ?? '—'}</div>
        </div>
        <button onClick={signOut} className="btn-secondary w-full">{t.auth.signOut}</button>
      </section>

      <section className="tile p-5">
        <div className="label mb-3">{t.settings.about}</div>
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-hero-gradient flex items-center justify-center shadow-float shrink-0">
            <span className="font-display font-bold text-white text-lg">ת</span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold text-ink">תאמר עדוי</div>
            <div className="text-xs text-muted">{t.appName} · גרסה 2.1.0</div>
          </div>
          <a
            href="https://www.linkedin.com/in/tamer-adawi-36a6a91a6/"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="LinkedIn"
            className="shrink-0 w-10 h-10 rounded-xl bg-sky-soft hover:bg-sky/20 text-sky-deep flex items-center justify-center transition"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M20.45 20.45h-3.56v-5.57c0-1.33-.02-3.04-1.85-3.04-1.86 0-2.14 1.45-2.14 2.95v5.66H9.34V9h3.42v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28zM5.34 7.43a2.06 2.06 0 0 1-2.06-2.07 2.06 2.06 0 1 1 2.06 2.07zm1.78 13.02H3.56V9h3.56v11.45zM22.22 0H1.77C.79 0 0 .77 0 1.72v20.56C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.72V1.72C24 .77 23.2 0 22.22 0z" />
            </svg>
          </a>
        </div>
      </section>

      {toast && (
        <div className={cn('fixed bottom-24 left-1/2 -translate-x-1/2 chip chip-active px-4 py-2 text-sm shadow-glow')}>
          {toast}
        </div>
      )}
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
