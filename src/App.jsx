import { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, NavLink, useLocation } from 'react-router-dom'
import { seedSymptomsIfEmpty, getSetting, setSetting, getHRTSchedule, getNextHRTDate } from './db/db'
import { TutorialContext } from './context'
import Today from './components/Today'
import Calendar from './components/Calendar'
import Patterns from './components/Patterns'
import Settings from './components/Settings'
import Onboarding from './components/Onboarding'
import Tutorial from './components/Tutorial'
import LogFAB from './components/LogFAB'

function TodayIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" /><line x1="12" y1="7" x2="12" y2="12" /><line x1="12" y1="12" x2="15" y2="15" />
    </svg>
  )
}
function CalendarIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="3" /><line x1="3" y1="9" x2="21" y2="9" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="16" y1="2" x2="16" y2="6" />
    </svg>
  )
}
function PatternsIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 17 7 11 11 14 15 8 21 15" /><line x1="3" y1="20" x2="21" y2="20" />
    </svg>
  )
}
function SettingsIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v2M12 20v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M2 12h2M20 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
    </svg>
  )
}

const NAV = [
  { to: '/',         label: 'Today',    Icon: TodayIcon    },
  { to: '/calendar', label: 'Calendar', Icon: CalendarIcon },
  { to: '/patterns', label: 'Patterns', Icon: PatternsIcon },
  { to: '/settings', label: 'Settings', Icon: SettingsIcon },
]

const TITLES = { '/': 'Today', '/calendar': 'Calendar', '/patterns': 'Patterns', '/settings': 'Settings' }

function Header() {
  const { pathname } = useLocation()
  return (
    <header className="app-header">
      <span className="header-wordmark">TFPT</span>
      <h1 className="header-title">{TITLES[pathname] ?? 'TFPT'}</h1>
    </header>
  )
}

function BottomNav() {
  return (
    <nav className="bottom-nav">
      {NAV.map(({ to, label, Icon }) => (
        <NavLink key={to} to={to} end={to === '/'} className={({ isActive }) => `nav-item${isActive ? ' nav-item--active' : ''}`}>
          <span className="nav-icon"><Icon /></span>
          <span className="nav-label">{label}</span>
        </NavLink>
      ))}
    </nav>
  )
}

async function maybeNotify() {
  try {
    const enabled = await getSetting('notificationsEnabled')
    if (!enabled || !('Notification' in window) || Notification.permission !== 'granted') return

    const today = new Date().toISOString().slice(0, 10)
    const alreadySent = await getSetting('hrtNotifSentDate')
    if (alreadySent === today) return

    const schedule = await getHRTSchedule()
    const nextDate = getNextHRTDate(schedule)
    if (nextDate !== today) return

    new Notification('HRT due today', {
      body: "Your HRT is scheduled for today. Take care of yourself 💜",
      icon: '/favicon.ico',
    })
    await setSetting('hrtNotifSentDate', today)
  } catch {
    // Notifications are best-effort
  }
}

function AppShell() {
  const [ready,        setReady]        = useState(false)
  const [onboarded,    setOnboarded]    = useState(false)
  const [showTutorial, setShowTutorial] = useState(false)

  useEffect(() => {
    async function init() {
      await seedSymptomsIfEmpty()
      const done = await getSetting('onboardingComplete')
      setOnboarded(!!done)
      setReady(true)
      if (done) maybeNotify()
    }
    init()
  }, [])

  if (!ready) return <div className="loading-screen"><div className="loading-dot" /></div>

  if (!onboarded) {
    return (
      <Onboarding
        onComplete={(startTutorial) => {
          setOnboarded(true)
          if (startTutorial) setShowTutorial(true)
          maybeNotify()
        }}
      />
    )
  }

  return (
    <TutorialContext.Provider value={{ openTutorial: () => setShowTutorial(true) }}>
      <div className="app-layout">
        <Header />
        <main className="app-main">
          <Routes>
            <Route path="/"         element={<Today />}    />
            <Route path="/calendar" element={<Calendar />} />
            <Route path="/patterns" element={<Patterns />} />
            <Route path="/settings" element={<Settings />} />
          </Routes>
        </main>
        <BottomNav />
      </div>
      {showTutorial && <Tutorial onClose={() => setShowTutorial(false)} />}
      <LogFAB />
    </TutorialContext.Provider>
  )
}

export default function App() {
  return <BrowserRouter><AppShell /></BrowserRouter>
}
