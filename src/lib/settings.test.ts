import { describe, it, expect, vi } from 'vitest'

// settings.ts imports the Supabase client, which refuses to load without env
// vars (as in CI). These tests never touch the network, so stub it out.
vi.mock('./supabase', () => ({ supabase: {} }))

import { hasJob, DEFAULT_SETTINGS } from './settings'

describe('hasJob', () => {
  it('a two-job worker has both', () => {
    expect(hasJob({ jobs: 'both' }, 'wedding')).toBe(true)
    expect(hasJob({ jobs: 'both' }, 'hourly')).toBe(true)
  })

  it('a single-job worker has only that job', () => {
    expect(hasJob({ jobs: 'wedding' }, 'wedding')).toBe(true)
    expect(hasJob({ jobs: 'wedding' }, 'hourly')).toBe(false)
    expect(hasJob({ jobs: 'hourly' }, 'hourly')).toBe(true)
    expect(hasJob({ jobs: 'hourly' }, 'wedding')).toBe(false)
  })
})

describe('DEFAULT_SETTINGS', () => {
  // Defaults are what a failed load or an older database falls back to; they must
  // describe the app's long-standing behaviour so nobody gets stuck on setup.
  it('falls back to both jobs, already set up', () => {
    expect(DEFAULT_SETTINGS.jobs).toBe('both')
    expect(DEFAULT_SETTINGS.onboarded).toBe(true)
  })
})
