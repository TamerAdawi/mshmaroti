import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import { applyTheme, getTheme } from './lib/theme'

// Keep the runtime in sync with the saved preference (the inline script in
// index.html applies it pre-paint; this re-applies after hydration).
applyTheme(getTheme())

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
