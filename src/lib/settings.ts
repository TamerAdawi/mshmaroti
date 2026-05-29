import { supabase } from './supabase'

export interface Settings {
  // Names + rates (v2.0)
  weddingRate: number
  hourlyRate: number
  weddingName: string
  hourlyName: string

  // Restaurant calculation (v2.1)
  weeklyHoursMax: number          // 42 (Israeli private sector standard)
  restDayOfWeek: number           // 0=Sunday, 1=Monday, ..., 6=Saturday
  dailyHoursThreshold: number     // 8 (per Venaro contract)
  hourlyMonthlyTravel: number     // 150 ₪ monthly travel allowance
  bituachRate: number             // 0.0427 (4.27% for low income bracket)
  pensionRate: number             // 0.06 (6% employee portion per Venaro contract)
  pensionActive: boolean          // false until 6 months from start
  incomeTaxRate: number           // 0 (typically 0% for student income)
}

export const DEFAULT_SETTINGS: Settings = {
  weddingRate: 200,
  hourlyRate: 35,
  weddingName: 'אולם אירועים',
  hourlyName: 'שעתי',

  weeklyHoursMax: 42,
  restDayOfWeek: 0,           // Sunday — Tamer's contractually designated rest day
  dailyHoursThreshold: 8,
  hourlyMonthlyTravel: 150,
  bituachRate: 0.0427,
  pensionRate: 0.06,
  pensionActive: false,
  incomeTaxRate: 0,
}

async function requireUserId(): Promise<string> {
  const { data, error } = await supabase.auth.getUser()
  if (error || !data.user) throw new Error('Not authenticated')
  return data.user.id
}

/** Fetch settings from cloud. Returns defaults if no row exists yet. */
export async function fetchSettings(): Promise<Settings> {
  const { data, error } = await supabase
    .from('user_settings')
    .select('*')
    .maybeSingle()
  if (error) {
    console.error('Failed to load settings:', error)
    return { ...DEFAULT_SETTINGS }
  }
  if (!data) return { ...DEFAULT_SETTINGS }
  return {
    weddingRate: Number(data.wedding_rate),
    hourlyRate: Number(data.hourly_rate),
    weddingName: data.wedding_name,
    hourlyName: data.hourly_name,
    // v2.1 fields — use defaults if migration hasn't run yet
    weeklyHoursMax: data.weekly_hours_max != null ? Number(data.weekly_hours_max) : DEFAULT_SETTINGS.weeklyHoursMax,
    restDayOfWeek: data.rest_day_of_week ?? DEFAULT_SETTINGS.restDayOfWeek,
    dailyHoursThreshold: data.daily_hours_threshold != null ? Number(data.daily_hours_threshold) : DEFAULT_SETTINGS.dailyHoursThreshold,
    hourlyMonthlyTravel: data.hourly_monthly_travel != null ? Number(data.hourly_monthly_travel) : DEFAULT_SETTINGS.hourlyMonthlyTravel,
    bituachRate: data.bituach_rate != null ? Number(data.bituach_rate) : DEFAULT_SETTINGS.bituachRate,
    pensionRate: data.pension_rate != null ? Number(data.pension_rate) : DEFAULT_SETTINGS.pensionRate,
    pensionActive: data.pension_active ?? DEFAULT_SETTINGS.pensionActive,
    incomeTaxRate: data.income_tax_rate != null ? Number(data.income_tax_rate) : DEFAULT_SETTINGS.incomeTaxRate,
  }
}

/** Upsert settings to cloud. */
export async function saveSettings(s: Settings): Promise<void> {
  const user_id = await requireUserId()
  const { error } = await supabase.from('user_settings').upsert(
    {
      user_id,
      wedding_rate: s.weddingRate,
      hourly_rate: s.hourlyRate,
      wedding_name: s.weddingName,
      hourly_name: s.hourlyName,
      weekly_hours_max: s.weeklyHoursMax,
      rest_day_of_week: s.restDayOfWeek,
      daily_hours_threshold: s.dailyHoursThreshold,
      hourly_monthly_travel: s.hourlyMonthlyTravel,
      bituach_rate: s.bituachRate,
      pension_rate: s.pensionRate,
      pension_active: s.pensionActive,
      income_tax_rate: s.incomeTaxRate,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' },
  )
  if (error) throw error
}
