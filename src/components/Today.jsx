import { useState, useEffect } from 'react'
import { format } from 'date-fns'
import {
  getHRTEventsBetween,
  getDailyLogsBetween,
  getHRTSchedule,
  getNextHRTDate,
  getSetting,
  toDateString,
} from '../db/db'

const TODAY = new Date()
const TODAY_STR = toDateString(TODAY)

function greeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

function dateDiffDays(aStr, bStr) {
  return Math.round(
    (new Date(aStr + 'T12:00:00') - new Date(bStr + 'T12:00:00')) / 86400000
  )
}

// ── Cycle arc (SVG hero) ───────────────────────────────────────
function CycleArc({ lastHRTDate, cycleDays }) {
  if (!lastHRTDate) {
    return (
      <div className="card today-arc-card">
        <div className="today-arc-empty">
          <span className="today-arc-empty-icon">✦</span>
          <p className="today-arc-empty-text">Log your first HRT dose to start tracking</p>
        </div>
      </div>
    )
  }

  const daysSince = Math.max(0, dateDiffDays(TODAY_STR, lastHRTDate))
  const total     = Math.max(1, Number(cycleDays) || 7)
  const progress  = Math.min(daysSince / total, 1)

  // Arc geometry: 270° arc from 135° to 45° (clockwise), opening at bottom
  const cx = 110, cy = 100, r = 82

  function polar(deg) {
    const rad = (deg * Math.PI) / 180
    return [+(cx + r * Math.cos(rad)).toFixed(2), +(cy + r * Math.sin(rad)).toFixed(2)]
  }

  const [sx, sy] = polar(135)
  const [ex, ey] = polar(45)                // 135 + 270 = 405 = 45
  const trackPath = `M ${sx} ${sy} A ${r} ${r} 0 1 1 ${ex} ${ey}`

  const dotDeg    = 135 + progress * 270
  const [dx, dy2] = polar(dotDeg)

  let progressPath = null
  if (daysSince > 0) {
    const span    = progress * 270
    const lg      = span > 180 ? 1 : 0
    progressPath  = `M ${sx} ${sy} A ${r} ${r} 0 ${lg} 1 ${dx} ${dy2}`
  }

  const dayLabel = `Day ${daysSince}`

  return (
    <div className="card today-arc-card">
      <svg viewBox="15 10 190 158" className="today-arc-svg" aria-label={`${dayLabel} since last HRT`}>
        <defs>
          <linearGradient id="arcGrad" x1="0%" y1="100%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#f0a96b" />
            <stop offset="100%" stopColor="#e8827a" />
          </linearGradient>
        </defs>

        {/* Track */}
        <path d={trackPath} fill="none" stroke="#2a2447" strokeWidth="10" strokeLinecap="round" />

        {/* Progress */}
        {progressPath && (
          <path d={progressPath} fill="none" stroke="url(#arcGrad)" strokeWidth="10" strokeLinecap="round" />
        )}

        {/* Dot */}
        <circle cx={dx} cy={dy2} r="11" fill="#e8827a" />
        <circle cx={dx} cy={dy2} r="5"  fill="#0e0b1e" />

        {/* Centre text */}
        <text x={cx} y={cy - 6}  textAnchor="middle" fill="#f0ebe0"
          fontFamily="Fraunces, Georgia, serif" fontSize="46" fontWeight="300" letterSpacing="-1">
          {daysSince}
        </text>
        <text x={cx} y={cy + 16} textAnchor="middle" fill="#6b6285"
          fontFamily="Outfit, system-ui, sans-serif" fontSize="12" letterSpacing="0.04em">
          since last HRT
        </text>
      </svg>
    </div>
  )
}

// ── Next HRT card ──────────────────────────────────────────────
function NextHRTCard({ nextDate, hasSchedule }) {
  if (!hasSchedule) {
    return (
      <div className="card today-next-card">
        <div className="section-title">Next HRT</div>
        <p className="today-next-empty">Set up your HRT schedule in Settings to see your next dose.</p>
      </div>
    )
  }

  const diff = nextDate ? dateDiffDays(nextDate, TODAY_STR) : null
  let label, cls
  if (diff === null)   { label = '—';                                                            cls = '' }
  else if (diff === 0) { label = 'Due today';                                                    cls = 'today-next--today' }
  else if (diff === 1) { label = 'Due tomorrow';                                                 cls = 'today-next--soon'  }
  else if (diff > 1)   { label = `Due in ${diff} days`;                                         cls = 'today-next--soon'  }
  else                 { label = `Overdue by ${Math.abs(diff)} day${Math.abs(diff) !== 1 ? 's' : ''}`; cls = 'today-next--overdue' }

  return (
    <div className={`card today-next-card ${cls}`}>
      <div className="section-title">Next HRT</div>
      <div className="today-next-label">{label}</div>
      {nextDate && (
        <div className="today-next-date">
          {format(new Date(nextDate + 'T12:00:00'), 'd MMM yyyy')}
        </div>
      )}
    </div>
  )
}

// ── Streak card ────────────────────────────────────────────────
function StreakCard({ streak }) {
  return (
    <div className="card today-streak-card">
      {streak === 0 ? (
        <span className="today-streak-empty">Start your streak today</span>
      ) : (
        <>
          <span className="today-streak-num">{streak}</span>
          <span className="today-streak-unit">day{streak !== 1 ? 's' : ''}<br />in a row</span>
        </>
      )}
    </div>
  )
}

// ── Recent logs card ───────────────────────────────────────────
function RecentLogsCard({ entries }) {
  if (entries.length === 0) {
    return (
      <div className="card today-recent-card">
        <div className="section-title">Recent entries</div>
        <p className="today-empty-hint">Nothing logged yet — tap + to start.</p>
      </div>
    )
  }

  return (
    <div className="card today-recent-card">
      <div className="section-title">Recent entries</div>
      <div className="today-recent-list">
        {entries.map(e => (
          <div key={e.date} className="today-recent-row">
            <span className="today-recent-date">
              {e.daysAgo === 0 ? 'Today'
                : e.daysAgo === 1 ? 'Yesterday'
                : format(new Date(e.date + 'T12:00:00'), 'd MMM')}
            </span>
            <div className="today-recent-tags">
              {e.hasHRT && <span className="today-recent-tag today-recent-tag--hrt">✦ HRT</span>}
              {e.symCount > 0 && (
                <span className="today-recent-tag today-recent-tag--sym">
                  {e.symCount} symptom{e.symCount !== 1 ? 's' : ''}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Main Today dashboard ───────────────────────────────────────
export default function Today() {
  const [loading,       setLoading]       = useState(true)
  const [userName,      setUserName]      = useState('')
  const [lastHRTDate,   setLastHRTDate]   = useState(null)
  const [cycleDays,     setCycleDays]     = useState(7)
  const [nextHRTDate,   setNextHRTDate]   = useState(null)
  const [hasSchedule,   setHasSchedule]   = useState(false)
  const [recentEntries, setRecentEntries] = useState([])
  const [streak,        setStreak]        = useState(0)

  async function load() {
    const ninetyAgo    = new Date(TODAY)
    ninetyAgo.setDate(ninetyAgo.getDate() - 90)
    const ninetyAgoStr = toDateString(ninetyAgo)

    const [name, schedule, hrtEvents, logs] = await Promise.all([
      getSetting('userName'),
      getHRTSchedule(),
      getHRTEventsBetween(ninetyAgoStr, TODAY_STR),
      getDailyLogsBetween(ninetyAgoStr, TODAY_STR),
    ])

    setUserName(name ?? '')

    // Most-recent HRT date (prefer logged event, fall back to schedule)
    const hrtDates = hrtEvents.map(e => e.date)
    if (schedule?.lastIntakeDate) hrtDates.push(schedule.lastIntakeDate)
    const lastHRT = hrtDates.length > 0 ? [...hrtDates].sort().at(-1) : null
    setLastHRTDate(lastHRT)

    // Schedule
    if (schedule) {
      const days = schedule.frequencyUnit === 'weeks'
        ? Number(schedule.frequencyValue) * 7
        : Number(schedule.frequencyValue)
      setCycleDays(days)
      setHasSchedule(true)
      setNextHRTDate(getNextHRTDate(schedule))
    }

    // Build a set of "active dates" (any log entry or HRT event)
    const hrtDateSet = new Set(hrtEvents.map(e => e.date))
    const logByDate  = Object.fromEntries(logs.map(l => [l.date, l]))

    const activeDates = new Set()
    for (const e of hrtEvents) activeDates.add(e.date)
    for (const l of logs) {
      const hasSym = Object.values(l.symptoms || {}).some(v => v !== null && v !== undefined)
      if (hasSym || l.notes?.trim()) activeDates.add(l.date)
    }

    // Recent entries — last 3 active dates
    const sorted = [...activeDates].sort().reverse()
    setRecentEntries(
      sorted.slice(0, 3).map(date => ({
        date,
        daysAgo:  dateDiffDays(TODAY_STR, date),
        hasHRT:   hrtDateSet.has(date),
        symCount: Object.values(logByDate[date]?.symptoms || {})
          .filter(v => v !== null && v !== undefined).length,
      }))
    )

    // Streak — consecutive days back from today with any entry
    let s = 0
    const check = new Date(TODAY_STR + 'T12:00:00')
    while (activeDates.has(toDateString(check))) {
      s++
      check.setDate(check.getDate() - 1)
    }
    setStreak(s)

    setLoading(false)
  }

  useEffect(() => {
    load()
    const handler = () => load()
    window.addEventListener('tfpt:log-saved', handler)
    return () => window.removeEventListener('tfpt:log-saved', handler)
  }, [])

  if (loading) return <div className="loading-screen"><div className="loading-dot" /></div>

  const name = userName ? `, ${userName}` : ''

  return (
    <div className="today-screen">
      {/* Greeting */}
      <div className="today-greeting">
        <span className="today-greeting__hi">{greeting()}{name}</span>
        <div className="today-date">
          <span className="today-date__weekday">{format(TODAY, 'EEEE')}</span>
          <span className="today-date__full">{format(TODAY, 'd MMMM yyyy')}</span>
        </div>
      </div>

      {/* Hero: cycle arc */}
      <CycleArc lastHRTDate={lastHRTDate} cycleDays={cycleDays} />

      {/* Two-up: next HRT + streak */}
      <div className="today-two-col">
        <NextHRTCard nextDate={nextHRTDate} hasSchedule={hasSchedule} />
        <StreakCard streak={streak} />
      </div>

      {/* Recent entries */}
      <RecentLogsCard entries={recentEntries} />

      <div style={{ height: 8 }} />
    </div>
  )
}
