import { useState, useEffect } from 'react'
import {
  format, startOfMonth, endOfMonth, eachDayOfInterval,
  getDay, isSameMonth, isToday, addMonths, subMonths,
  startOfWeek, endOfWeek,
} from 'date-fns'
import { getHRTEventsBetween, getDailyLogsBetween, getDailyLog, getHRTEventsBetween as getHRT } from '../db/db'

const DAY_HEADERS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export default function Calendar() {
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [hrtDates, setHrtDates]         = useState(new Set())
  const [logDates, setLogDates]         = useState(new Set())
  const [selectedDay, setSelectedDay]   = useState(null)
  const [dayDetail, setDayDetail]       = useState(null)
  const [loading, setLoading]           = useState(true)

  useEffect(() => {
    loadMonth(currentMonth)
  }, [currentMonth])

  async function loadMonth(month) {
    setLoading(true)
    const start = startOfWeek(startOfMonth(month), { weekStartsOn: 1 })
    const end   = endOfWeek(endOfMonth(month),     { weekStartsOn: 1 })
    const startStr = format(start, 'yyyy-MM-dd')
    const endStr   = format(end,   'yyyy-MM-dd')

    const [hrt, logs] = await Promise.all([
      getHRTEventsBetween(startStr, endStr),
      getDailyLogsBetween(startStr, endStr),
    ])

    setHrtDates(new Set(hrt.map(e => e.date)))
    setLogDates(new Set(logs.filter(l => Object.keys(l.symptoms || {}).some(k => l.symptoms[k] !== null && l.symptoms[k] !== undefined)).map(l => l.date)))
    setLoading(false)
  }

  async function handleDayTap(date) {
    const dateStr = format(date, 'yyyy-MM-dd')
    if (selectedDay === dateStr) {
      setSelectedDay(null)
      setDayDetail(null)
      return
    }
    setSelectedDay(dateStr)
    const [log, hrt] = await Promise.all([
      getDailyLog(dateStr),
      getHRT(dateStr, dateStr),
    ])
    setDayDetail({ date, log, hrt })
  }

  function prevMonth() { setCurrentMonth(m => subMonths(m, 1)) }
  function nextMonth() { setCurrentMonth(m => addMonths(m, 1)) }

  // Build the grid: full weeks from Mon–Sun covering the month
  const gridStart = startOfWeek(startOfMonth(currentMonth), { weekStartsOn: 1 })
  const gridEnd   = endOfWeek(endOfMonth(currentMonth),     { weekStartsOn: 1 })
  const days      = eachDayOfInterval({ start: gridStart, end: gridEnd })

  return (
    <div className="calendar-screen">
      {/* Month navigation */}
      <div className="cal-nav">
        <button className="cal-nav-btn" onClick={prevMonth}>‹</button>
        <span className="cal-nav-title">{format(currentMonth, 'MMMM yyyy')}</span>
        <button className="cal-nav-btn" onClick={nextMonth}>›</button>
      </div>

      {/* Legend */}
      <div className="cal-legend">
        <span className="cal-legend-item"><span className="cal-dot cal-dot--hrt" /> HRT</span>
        <span className="cal-legend-item"><span className="cal-dot cal-dot--log" /> Symptoms logged</span>
      </div>

      {/* Day-of-week headers */}
      <div className="cal-grid">
        {DAY_HEADERS.map(d => (
          <div key={d} className="cal-day-header">{d}</div>
        ))}

        {/* Day cells */}
        {days.map(day => {
          const dateStr   = format(day, 'yyyy-MM-dd')
          const inMonth   = isSameMonth(day, currentMonth)
          const todayFlag = isToday(day)
          const hasHRT    = hrtDates.has(dateStr)
          const hasLog    = logDates.has(dateStr)
          const selected  = selectedDay === dateStr

          return (
            <button
              key={dateStr}
              className={[
                'cal-day',
                !inMonth   && 'cal-day--other',
                todayFlag  && 'cal-day--today',
                selected   && 'cal-day--selected',
              ].filter(Boolean).join(' ')}
              onClick={() => inMonth && handleDayTap(day)}
            >
              <span className="cal-day-num">{format(day, 'd')}</span>
              <div className="cal-dots">
                {hasHRT && <span className="cal-dot cal-dot--hrt" />}
                {hasLog && <span className="cal-dot cal-dot--log" />}
              </div>
            </button>
          )
        })}
      </div>

      {/* Day detail panel */}
      {dayDetail && (
        <DayDetail
          detail={dayDetail}
          onClose={() => { setSelectedDay(null); setDayDetail(null) }}
        />
      )}
    </div>
  )
}

// ── Day detail bottom panel ────────────────────────────────────
function DayDetail({ detail, onClose }) {
  const { date, log, hrt } = detail
  const symptoms = log?.symptoms ?? {}
  const hasAnySymptom = Object.values(symptoms).some(v => v !== null && v !== undefined)

  return (
    <div className="day-detail-backdrop" onClick={onClose}>
      <div className="day-detail-panel" onClick={e => e.stopPropagation()}>
        <div className="day-detail-header">
          <span className="day-detail-date">{format(date, 'EEEE d MMMM')}</span>
          <button className="day-detail-close" onClick={onClose}>✕</button>
        </div>

        {/* HRT */}
        {hrt.length > 0 && (
          <div className="day-detail-section">
            {hrt.map(e => (
              <span key={e.id} className="hrt-pill">
                ✦ HRT {format(new Date(e.timestamp), 'HH:mm')}
              </span>
            ))}
          </div>
        )}

        {/* Symptoms */}
        {hasAnySymptom ? (
          <div className="day-detail-section">
            <div className="day-detail-sym-list">
              {Object.entries(symptoms)
                .filter(([, v]) => v !== null && v !== undefined)
                .map(([id, value]) => (
                  <div key={id} className="day-detail-sym-row">
                    <span className="day-detail-sym-name">{id.replace(/-/g, ' ')}</span>
                    <span className="day-detail-sym-val">
                      {typeof value === 'boolean' || value === true ? '✓' : value}
                    </span>
                  </div>
                ))}
            </div>
          </div>
        ) : (
          <p className="day-detail-empty">No symptoms logged this day.</p>
        )}

        {/* Notes */}
        {log?.notes && (
          <div className="day-detail-section">
            <p className="day-detail-notes">{log.notes}</p>
          </div>
        )}

        {!hrt.length && !hasAnySymptom && !log?.notes && (
          <p className="day-detail-empty">Nothing logged for this day.</p>
        )}
      </div>
    </div>
  )
}
