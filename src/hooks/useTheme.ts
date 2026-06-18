import { useEffect, useState } from 'react'
import { getTheme, setTheme as persistTheme, applyTheme, type Theme } from '../lib/theme'

/**
 * Reactive theme preference. Returns the current preference and a setter.
 * Re-applies on OS scheme changes while the preference is 'system'.
 */
export function useTheme(): [Theme, (t: Theme) => void] {
  const [theme, setThemeState] = useState<Theme>(() => getTheme())

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => {
      if (getTheme() === 'system') applyTheme('system')
    }
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  const update = (t: Theme) => {
    persistTheme(t)
    setThemeState(t)
  }

  return [theme, update]
}
