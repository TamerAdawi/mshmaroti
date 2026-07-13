import { defineConfig } from 'vitest/config'

// Dedicated config so tests don't load the PWA/build plugins.
// The payroll/calc/utils modules under test are pure (no DOM, no Supabase).
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
