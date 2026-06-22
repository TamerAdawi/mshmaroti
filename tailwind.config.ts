import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        display: ['Rubik', 'Assistant', 'system-ui', 'sans-serif'],
        sans: ['Assistant', 'system-ui', 'sans-serif'],
      },
      colors: {
        // Neutral tokens are CSS variables (RGB triplets) so they flip in dark mode.
        bg: 'rgb(var(--c-bg) / <alpha-value>)',
        surface: 'rgb(var(--c-surface) / <alpha-value>)',
        elevate: 'rgb(var(--c-elevate) / <alpha-value>)',
        line: 'rgb(var(--c-line) / <alpha-value>)',
        lineSoft: 'rgb(var(--c-line-soft) / <alpha-value>)',
        ink: 'rgb(var(--c-ink) / <alpha-value>)',
        body: 'rgb(var(--c-body) / <alpha-value>)',
        muted: 'rgb(var(--c-muted) / <alpha-value>)',
        mutedSoft: 'rgb(var(--c-muted-soft) / <alpha-value>)',
        // Earthy palette: olive #606c38, dark green #283618, cream #fefae0,
        // tan #dda15e, burnt orange #bc6c25. Accent families mapped onto these hues.
        indigo: {
          DEFAULT: '#606c38', // primary / wedding hall (olive)
          soft: '#e9edd6',
          deep: '#283618',
        },
        lime: {
          DEFAULT: '#6f7d33', // positive / tips (green)
          soft: '#eaeed6',
          deep: '#3d4a1c',
        },
        coral: {
          DEFAULT: '#bc6c25', // restaurant / danger (burnt orange)
          soft: '#f6e4d2',
          deep: '#8a4d18',
        },
        sky: {
          DEFAULT: '#b9823a', // info / week (bronze)
          soft: '#f4e6cf',
          deep: '#855b22',
        },
        peach: {
          DEFAULT: '#dda15e', // warm / expenses (tan)
          soft: '#faedd8',
          deep: '#b07a34',
        },
        violet: {
          DEFAULT: '#a85f2a', // misc accent (warm brown-orange)
          soft: '#f3e2d2',
          deep: '#7a3f12',
        },
        pos: '#606c38',
        neg: '#bc4a1e',
      },
      boxShadow: {
        tile: '0 1px 2px rgba(40, 54, 24, 0.05), 0 1px 0 rgba(255, 255, 255, 0.8) inset',
        tileHover: '0 8px 24px -8px rgba(96, 108, 56, 0.22), 0 2px 4px rgba(40, 54, 24, 0.06)',
        glow: '0 20px 40px -12px rgba(188, 108, 37, 0.3)',
        float: '0 10px 30px -10px rgba(96, 108, 56, 0.28)',
      },
      backgroundImage: {
        'hero-gradient': 'linear-gradient(135deg, #606c38 0%, #dda15e 55%, #bc6c25 100%)',
        'hero-soft': 'linear-gradient(135deg, #eef0dd 0%, #faedd8 60%, #f6e4d2 100%)',
        'lime-gradient': 'linear-gradient(135deg, #606c38 0%, #8a9a4a 100%)',
        'coral-gradient': 'linear-gradient(135deg, #dda15e 0%, #bc6c25 100%)',
        'sky-gradient': 'linear-gradient(135deg, #b9823a 0%, #606c38 100%)',
        'violet-gradient': 'linear-gradient(135deg, #bc6c25 0%, #606c38 100%)',
      },
    },
  },
  plugins: [],
} satisfies Config
