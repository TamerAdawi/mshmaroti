import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['Assistant', 'system-ui', 'sans-serif'],
        sans: ['Assistant', 'system-ui', 'sans-serif'],
      },
      colors: {
        bg: '#fafbff',
        surface: '#ffffff',
        elevate: '#f4f5fb',
        line: '#e5e7f0',
        lineSoft: '#eef0f7',
        ink: '#0f1020',
        body: '#3d4258',
        muted: '#8a8fa8',
        mutedSoft: '#b8bdd0',
        indigo: {
          DEFAULT: '#6366f1',
          soft: '#eef0ff',
          deep: '#4338ca',
        },
        lime: {
          DEFAULT: '#84cc16',
          soft: '#f0fde3',
          deep: '#4d7c0f',
        },
        coral: {
          DEFAULT: '#fb7185',
          soft: '#fff1f2',
          deep: '#be123c',
        },
        sky: {
          DEFAULT: '#0ea5e9',
          soft: '#e0f2fe',
          deep: '#0369a1',
        },
        peach: {
          DEFAULT: '#fb923c',
          soft: '#fff7ed',
          deep: '#c2410c',
        },
        violet: {
          DEFAULT: '#a855f7',
          soft: '#faf5ff',
          deep: '#7e22ce',
        },
        pos: '#16a34a',
        neg: '#dc2626',
      },
      boxShadow: {
        tile: '0 1px 2px rgba(15, 16, 32, 0.04), 0 1px 0 rgba(255, 255, 255, 0.8) inset',
        tileHover: '0 8px 24px -8px rgba(99, 102, 241, 0.2), 0 2px 4px rgba(15, 16, 32, 0.05)',
        glow: '0 20px 40px -12px rgba(168, 85, 247, 0.3)',
        float: '0 10px 30px -10px rgba(99, 102, 241, 0.25)',
      },
      backgroundImage: {
        'hero-gradient': 'linear-gradient(135deg, #6366f1 0%, #a855f7 50%, #ec4899 100%)',
        'hero-soft': 'linear-gradient(135deg, #eef0ff 0%, #faf5ff 60%, #fff1f7 100%)',
        'lime-gradient': 'linear-gradient(135deg, #84cc16 0%, #22d3ee 100%)',
        'coral-gradient': 'linear-gradient(135deg, #fb923c 0%, #fb7185 100%)',
        'sky-gradient': 'linear-gradient(135deg, #0ea5e9 0%, #6366f1 100%)',
        'violet-gradient': 'linear-gradient(135deg, #a855f7 0%, #6366f1 100%)',
      },
    },
  },
  plugins: [],
} satisfies Config
