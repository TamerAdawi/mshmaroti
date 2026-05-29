import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !anonKey) {
  throw new Error(
    'Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. Copy .env.example to .env.local and fill in your Supabase project values.',
  )
}

/** DB row types — mirror the SQL schema. */
export interface ShiftRow {
  id: number
  user_id: string
  date: string
  job_type: 'wedding' | 'hourly'
  hours: number
  start_time: string | null
  end_time: string | null
  base: number
  tips: number
  expenses: number
  total: number
  notes: string | null
  created_at: string
}

export interface UserSettingsRow {
  user_id: string
  wedding_rate: number
  hourly_rate: number
  wedding_name: string
  hourly_name: string
  updated_at: string
}

export const supabase = createClient(url, anonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
})
