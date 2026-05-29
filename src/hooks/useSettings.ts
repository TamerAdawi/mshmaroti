import { useEffect, useState } from 'react'
import { fetchSettings, saveSettings, DEFAULT_SETTINGS, type Settings } from '../lib/settings'
import { supabase } from '../lib/supabase'

/**
 * Reactive settings, backed by user_settings table.
 * Returns DEFAULT_SETTINGS during initial load (avoids flicker).
 * Subscribes to realtime changes for cross-device sync.
 */
export function useSettings(): [Settings, (next: Settings) => Promise<void>] {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS)

  useEffect(() => {
    let mounted = true

    const load = async () => {
      const s = await fetchSettings()
      if (mounted) setSettings(s)
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

  const update = async (next: Settings) => {
    setSettings(next) // optimistic
    await saveSettings(next)
  }

  return [settings, update]
}
