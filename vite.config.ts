import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// GitHub Pages deploys to /mshmaroti/ — change if your repo name differs.
// Set VITE_BASE=/ when building for a custom domain.
const base = process.env.VITE_BASE ?? '/mshmaroti/'

export default defineConfig({
  base,
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg'],
      manifest: {
        name: 'משמרותי',
        short_name: 'משמרותי',
        description: 'מעקב משמרות ותשר',
        dir: 'rtl',
        lang: 'he',
        theme_color: '#fafbff',
        background_color: '#fafbff',
        display: 'standalone',
        start_url: base,
        scope: base,
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Online-first: shell cache only, data lives in IndexedDB
        globPatterns: ['**/*.{js,css,html,svg,png,webmanifest}'],
        navigateFallback: `${base}index.html`,
      },
    }),
  ],
})
