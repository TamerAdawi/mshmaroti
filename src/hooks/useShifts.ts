import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { fetchAllShifts } from '../lib/api'
import type { JobType, Shift } from '../types'

/**
 * All shifts for the current user, newest first.
 * Subscribes to realtime changes so any insert/update/delete refreshes the list.
 * Returns undefined while loading.
 */
export function useAllShifts(): Shift[] | undefined {
  const [shifts, setShifts] = useState<Shift[] | undefined>(undefined)

  useEffect(() => {
    let mounted = true
    let timeoutId: ReturnType<typeof setTimeout> | null = null

    const refresh = async () => {
      try {
        const all = await fetchAllShifts()
        if (mounted) setShifts(all)
      } catch (err) {
        console.error('Failed to fetch shifts:', err)
        if (mounted) setShifts([])
      }
    }

    void refresh()

    // Realtime: any change to a shift row for any user triggers a refetch.
    // RLS still ensures we only get our own rows back.
   const channelName = `shifts-changes-${Math.random().toString(36).slice(2)}`
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'shifts' },
        () => {
          // Debounce: many rapid changes only trigger one refetch
          if (timeoutId) clearTimeout(timeoutId)
          timeoutId = setTimeout(() => void refresh(), 100)
        },
      )
      .subscribe()

    return () => {
      mounted = false
      if (timeoutId) clearTimeout(timeoutId)
      void supabase.removeChannel(channel)
    }
  }, [])

  return shifts
}

/** Recent shifts — derived from useAllShifts */
export function useRecentShifts(limit = 5): Shift[] | undefined {
  const all = useAllShifts()
  return useMemo(() => (all ? all.slice(0, limit) : undefined), [all, limit])
}

/** Filtered by job — derived from useAllShifts */
export function useFilteredShifts(filter: JobType | 'all'): Shift[] | undefined {
  const all = useAllShifts()
  return useMemo(() => {
    if (!all) return undefined
    if (filter === 'all') return all
    return all.filter((s) => s.jobType === filter)
  }, [all, filter])
}
