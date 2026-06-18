export type Theme = 'light' | 'dark' | 'system'

const STORAGE_KEY = 'mshmaroti-theme'

/** The user's stored theme preference (defaults to 'system'). */
export function getTheme(): Theme {
  try {
    const t = localStorage.getItem(STORAGE_KEY)
    if (t === 'light' || t === 'dark' || t === 'system') return t
  } catch {
    /* localStorage may be unavailable */
  }
  return 'system'
}

/** Whether the given preference resolves to dark right now. */
export function resolveDark(theme: Theme): boolean {
  if (theme === 'dark') return true
  if (theme === 'light') return false
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

/** Toggle the `dark` class on <html> and keep the PWA theme-color in sync. */
export function applyTheme(theme: Theme): void {
  const dark = resolveDark(theme)
  document.documentElement.classList.toggle('dark', dark)
  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) meta.setAttribute('content', dark ? '#0b0c18' : '#fafbff')
}

/** Persist and apply a theme preference. */
export function setTheme(theme: Theme): void {
  try {
    localStorage.setItem(STORAGE_KEY, theme)
  } catch {
    /* ignore */
  }
  applyTheme(theme)
}
