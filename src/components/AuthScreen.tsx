import { useState } from 'react'
import { useAuth } from '../lib/auth'
import Logo from './Logo'
import { t } from '../strings'

type Mode = 'signin' | 'signup'

export default function AuthScreen() {
  const { signInWithPassword, signUpWithPassword, signInWithGoogle } = useAuth()
  const [mode, setMode] = useState<Mode>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async () => {
    setError(null)
    setInfo(null)
    if (!email.includes('@')) {
      setError(t.auth.invalidEmail)
      return
    }
    if (password.length < 6) {
      setError(t.auth.weakPassword)
      return
    }
    setSubmitting(true)
    try {
      if (mode === 'signin') {
        const { error } = await signInWithPassword(email, password)
        if (error) setError(error)
      } else {
        const { error } = await signUpWithPassword(email, password)
        if (error) {
          setError(error)
        } else {
          setInfo(t.auth.confirmEmail)
        }
      }
    } finally {
      setSubmitting(false)
    }
  }

  const handleGoogle = async () => {
    setError(null)
    const { error } = await signInWithGoogle()
    if (error) setError(error)
  }

  const switchMode = () => {
    setMode((m) => (m === 'signin' ? 'signup' : 'signin'))
    setError(null)
    setInfo(null)
  }

  return (
    <div className="min-h-dvh flex items-center justify-center px-5 py-10">
      <div className="w-full max-w-md">
        {/* Branding */}
        <div className="flex flex-col items-center mb-8">
          <Logo className="w-28 h-28 shadow-glow" />
          <p className="text-xs text-muted mt-3">{t.tagline}</p>
        </div>

        <div className="tile p-6">
          <h2 className="font-display text-2xl font-bold text-ink mb-1">
            {mode === 'signin' ? t.auth.signInTitle : t.auth.signUpTitle}
          </h2>
          <p className="text-sm text-muted mb-6">
            {mode === 'signin' ? t.auth.signInSubtitle : t.auth.signUpSubtitle}
          </p>

          {/* Google OAuth */}
          <button onClick={handleGoogle} className="btn-secondary w-full flex items-center justify-center gap-2 mb-5">
            <svg width="18" height="18" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            {t.auth.orContinueWith} {t.auth.google}
          </button>

          <div className="flex items-center gap-3 my-4">
            <div className="flex-1 h-px bg-line" />
            <span className="text-xs text-muted">או</span>
            <div className="flex-1 h-px bg-line" />
          </div>

          {/* Email + Password */}
          <Field label={t.auth.email}>
            <input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t.auth.emailPlaceholder}
              className="input-field"
            />
          </Field>

          <Field label={t.auth.password}>
            <input
              type="password"
              autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••"
              className="input-field"
              onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
            />
            {mode === 'signup' && <div className="text-[11px] text-muted mt-1 px-1">{t.auth.passwordHint}</div>}
          </Field>

          {error && (
            <div className="rounded-lg bg-coral-soft border border-coral/30 text-coral-deep text-sm px-3 py-2 mb-3 mt-2">
              {error}
            </div>
          )}
          {info && (
            <div className="rounded-lg bg-lime-soft border border-lime/30 text-lime-deep text-sm px-3 py-2 mb-3 mt-2">
              {info}
            </div>
          )}

          <button onClick={handleSubmit} disabled={submitting} className="btn-primary w-full mt-3">
            {submitting ? t.auth.loading : mode === 'signin' ? t.auth.signIn : t.auth.signUp}
          </button>

          <div className="text-center text-sm text-muted mt-5">
            {mode === 'signin' ? t.auth.noAccount : t.auth.haveAccount}{' '}
            <button onClick={switchMode} className="text-indigo-deep font-semibold hover:underline">
              {mode === 'signin' ? t.auth.switchToSignUp : t.auth.switchToSignIn}
            </button>
          </div>
        </div>

        <p className="text-[11px] text-muted text-center mt-5">
          {t.appName} · נבנה ע"י תאמר עדוי
        </p>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block mb-3">
      <div className="label mb-2">{label}</div>
      {children}
    </label>
  )
}
