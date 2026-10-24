import { useEffect, useState } from 'react'
import { fetchSettings, saveSettings, DEFAULT_SETTINGS, type Settings } from '../lib/settings'
import { supabase } from '../lib/supabase'
import { isDemo, getDemoSettings, setDemoSettings, subscribeDemo } from '../lib/demo'

/**
 * Reactive settings, backed by user_settings table.
 * Returns DEFAULT_SETTINGS during initial load (avoids flicker); the third
 * element turns true once the real settings have arrived, for anything that
 * must not decide on defaults (like whether to show the setup page).
 * Subscribes to realtime changes for cross-device sync.
 */
type Update = (next: Settings, opts?: { optimistic?: boolean }) => Promise<void>

export function useSettings(): [Settings, Update, boolean] {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    // Demo mode: read/write the in-memory seeded settings, no Supabase.
    if (isDemo()) {
      setSettings({ ...getDemoSettings() })
      setLoaded(true)
      return subscribeDemo(() => setSettings({ ...getDemoSettings() }))
    }

    let mounted = true

    const load = async () => {
      const s = await fetchSettings()
      if (mounted) {
        setSettings(s)
        setLoaded(true)
      }
    }
    void load()

    const channelName = `settings-changes-${Math.random().toString(36).slice(2)}`
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'user_settings' },
        () => void load(),
      )
      .subscribe()

    return () => {
      mounted = false
      void supabase.removeChannel(channel)
    }
  }, [])

  // Optimistic by default. Pass { optimistic: false } where the UI must not move
  // on until the save has actually landed (the setup page): there, a failed save
  // keeps the user on the page with an error instead of silently losing it.
  const update: Update = async (next, { optimistic = true } = {}) => {
    if (optimistic) setSettings(next)
    if (isDemo()) {
      setDemoSettings(next)
      setSettings(next)
      return
    }
    await saveSettings(next)
    if (!optimistic) setSettings(next)
  }

  return [settings, update, loaded]
}
