import { useState } from 'react'
import { t } from './strings'
import { cn } from './lib/utils'
import { AuthProvider, useAuth } from './lib/auth'
import AuthScreen from './components/AuthScreen'
import Dashboard from './components/Dashboard'
import NewShift from './components/NewShift'
import History from './components/History'
import Report from './components/Report'
import Settings from './components/Settings'
import type { Shift } from './types'

type Tab = 'dashboard' | 'new' | 'history' | 'report' | 'settings'

export default function App() {
  return (
    <AuthProvider>
      <AuthGate />
    </AuthProvider>
  )
}

function AuthGate() {
  const { session, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-dvh flex items-center justify-center">
        <div className="w-12 h-12 rounded-full bg-hero-gradient flex items-center justify-center shadow-glow animate-pulse">
          <span className="font-display font-extrabold text-white text-2xl">מ</span>
        </div>
      </div>
    )
  }

  if (!session) return <AuthScreen />

  return <AppShell />
}

function AppShell() {
  const [tab, setTab] = useState<Tab>('dashboard')
  const [editing, setEditing] = useState<Shift | null>(null)

  const goTo = (next: Tab) => {
    setEditing(null)
    setTab(next)
  }

  const onEdit = (shift: Shift) => {
    setEditing(shift)
    setTab('new')
  }

  return (
    <div className="min-h-dvh flex flex-col safe-top">
      <header className="px-5 pt-4 pb-3">
        <div className="flex items-baseline justify-between">
          <h1 className="font-display text-3xl font-extrabold text-gradient">{t.appName}</h1>
          <span className="label">{t.tagline}</span>
        </div>
      </header>

      <main className="flex-1 px-4 pb-32 overflow-x-hidden">
        {tab === 'dashboard' && <Dashboard onNew={() => goTo('new')} onEdit={onEdit} />}
        {tab === 'new' && (
          <NewShift editing={editing} onDone={() => goTo('dashboard')} onCancel={() => goTo('dashboard')} />
        )}
        {tab === 'history' && <History onEdit={onEdit} />}
        {tab === 'report' && <Report />}
        {tab === 'settings' && <Settings />}
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-40 bg-surface/90 backdrop-blur-xl border-t border-line safe-bottom" role="tablist">
        <div className="mx-auto max-w-2xl grid grid-cols-5 px-2 pt-2">
          <TabButton active={tab === 'dashboard'} onClick={() => goTo('dashboard')} label={t.nav.dashboard} icon="bento" />
          <TabButton active={tab === 'new'} onClick={() => goTo('new')} label={t.nav.new} icon="plus" />
          <TabButton active={tab === 'history'} onClick={() => goTo('history')} label={t.nav.history} icon="list" />
          <TabButton active={tab === 'report'} onClick={() => goTo('report')} label={t.nav.report} icon="doc" />
          <TabButton active={tab === 'settings'} onClick={() => goTo('settings')} label={t.nav.settings} icon="gear" />
        </div>
      </nav>
    </div>
  )
}

function TabButton({ active, onClick, label, icon }: { active: boolean; onClick: () => void; label: string; icon: 'bento' | 'plus' | 'list' | 'doc' | 'gear' }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex flex-col items-center gap-1 py-2 px-1 rounded-lg transition',
        active ? 'text-indigo-deep' : 'text-muted hover:text-body',
      )}
      role="tab"
      aria-selected={active}
    >
      <Icon name={icon} />
      <span className="text-[11px] font-semibold">{label}</span>
    </button>
  )
}

function Icon({ name }: { name: 'bento' | 'plus' | 'list' | 'doc' | 'gear' }) {
  const common = { width: 22, height: 22, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }
  switch (name) {
    case 'bento':
      return (
        <svg {...common}>
          <rect x="3" y="3" width="8" height="8" rx="1.5" />
          <rect x="13" y="3" width="8" height="5" rx="1.5" />
          <rect x="13" y="10" width="8" height="11" rx="1.5" />
          <rect x="3" y="13" width="8" height="8" rx="1.5" />
        </svg>
      )
    case 'plus':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 8v8M8 12h8" />
        </svg>
      )
    case 'list':
      return (
        <svg {...common}>
          <path d="M4 6h16M4 12h16M4 18h10" />
        </svg>
      )
    case 'doc':
      return (
        <svg {...common}>
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <path d="M14 2v6h6M16 13H8M16 17H8" />
        </svg>
      )
    case 'gear':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3h.1a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5h.1a1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8v.1a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" />
        </svg>
      )
  }
}
