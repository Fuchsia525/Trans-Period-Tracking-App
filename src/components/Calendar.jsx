import { useState, useEffect, useRef } from 'react'
import {
  format, startOfMonth, endOfMonth, eachDayOfInterval,
  isSameMonth, isToday, addMonths, subMonths,
  startOfWeek, endOfWeek,
} from 'date-fns'
import {
  getHRTEventsBetween, getDailyLogsBetween, getDailyLog,
  getEnabledSymptoms, logHRTEvent, deleteHRTEvent, saveDailyLog,
} from '../db/db'

const DAY_HEADERS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const TODAY_STR = format(new Date(), 'yyyy-MM-dd')

// ── Symptom inputs ─────────────────────────────────────────────
function BooleanInput({ value, onChange }) {
  const active = value === true
  return (
    <button
      className={`sym-bool${active ? ' sym-bool--active' : ''}`}
      onClick={() => onChange(active ? null : true)}
      type="button"
    >
      {active ? '✓ Yes' : 'No'}
    </button>
  )
}

function ScaleInput({ value, onChange }) {
  return (
    <div className="sym-scale">
      {[1, 2, 3, 4, 5].map(n => (
        <button
          key={n}
          type="button"
          className={`sym-scale-btn${value === n ? ' sym-scale-btn--active' : ''}`}
          onClick={() => onChange(value === n ? null : n)}
        >
          {n}
        </button>
      ))}
    </div>
  )
}

function TagsInput({ value, onChange }) {
  return (
    <input
      className="sym-tags-input"
      type="text"
      placeholder="Type notes..."
      value={value ?? ''}
      onChange={e => onChange(e.target.value || null)}
    />
  )
}

function SymptomRow({ symptom, value, onChange }) {
  return (
    <div className="sym-row">
      <span className="sym-name">{symptom.name}</span>
      <div className="sym-input">
        {symptom.inputType === 'boolean' && <BooleanInput value={value} onChange={onChange} />}
        {symptom.inputType === 'scale'   && <ScaleInput   value={value} onChange={onChange} />}
        {symptom.inputType === 'tags'    && <TagsInput    value={value} onChange={onChange} />}
      </div>
    </div>
  )
}

// ── Calendar screen ────────────────────────────────────────────
export default function Calendar() {
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [hrtDates, setHrtDates]         = useState(new Set())
  const [logDates, setLogDates]         = useState(new Set())
  const [selectedDay, setSelectedDay]   = useState(null)
  const [dayDetail, setDayDetail]       = useState(null)
  const [symptoms, setSymptoms]         = useState([])

  useEffect(() => {
    getEnabledSymptoms().then(setSymptoms)
  }, [])

  useEffect(() => {
    loadMonth(currentMonth)
  }, [currentMonth])

  async function loadMonth(month) {
    const start    = startOfWeek(startOfMonth(month), { weekStartsOn: 1 })
    const end      = endOfWeek(endOfMonth(month),     { weekStartsOn: 1 })
    const startStr = format(start, 'yyyy-MM-dd')
    const endStr   = format(end,   'yyyy-MM-dd')

    const [hrt, logs] = await Promise.all([
      getHRTEventsBetween(startStr, endStr),
      getDailyLogsBetween(startStr, endStr),
    ])

    setHrtDates(new Set(hrt.map(e => e.date)))
    setLogDates(new Set(
      logs
        .filter(l => Object.keys(l.symptoms || {}).some(k => l.symptoms[k] !== null && l.symptoms[k] !== undefined))
        .map(l => l.date)
    ))
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
      getHRTEventsBetween(dateStr, dateStr),
    ])
    setDayDetail({ date, log, hrt })
  }

  function prevMonth() { setCurrentMonth(m => subMonths(m, 1)) }
  function nextMonth() { setCurrentMonth(m => addMonths(m, 1)) }

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

      {/* Day-of-week headers + day cells */}
      <div className="cal-grid">
        {DAY_HEADERS.map(d => (
          <div key={d} className="cal-day-header">{d}</div>
        ))}

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
                !inMonth  && 'cal-day--other',
                todayFlag && 'cal-day--today',
                selected  && 'cal-day--selected',
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

      {/* Day detail / edit panel */}
      {dayDetail && (
        <DayDetail
          detail={dayDetail}
          symptoms={symptoms}
          onClose={() => { setSelectedDay(null); setDayDetail(null) }}
          onSaved={() => loadMonth(currentMonth)}
        />
      )}
    </div>
  )
}

// ── Editable day detail bottom panel ──────────────────────────
function DayDetail({ detail, symptoms, onClose, onSaved }) {
  const { date } = detail
  const dateStr = format(date, 'yyyy-MM-dd')

  const [hrtEvents, setHrtEvents]         = useState(detail.hrt || [])
  const [symptomValues, setSymptomValues] = useState(detail.log?.symptoms || {})
  const [notes, setNotes]                 = useState(detail.log?.notes || '')
  const [saveStatus, setSaveStatus]       = useState('idle')
  const [hrtLogging, setHrtLogging]       = useState(false)
  const saveTimer = useRef(null)

  function scheduleAutoSave(values, currentNotes) {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    setSaveStatus('saving')
    saveTimer.current = setTimeout(async () => {
      await saveDailyLog(dateStr, values, currentNotes)
      setSaveStatus('saved')
      setTimeout(() => setSaveStatus('idle'), 2000)
      onSaved?.()
    }, 800)
  }

  function handleSymptomChange(id, value) {
    const updated = { ...symptomValues, [id]: value }
    setSymptomValues(updated)
    scheduleAutoSave(updated, notes)
  }

  function handleNotesChange(e) {
    setNotes(e.target.value)
    scheduleAutoSave(symptomValues, e.target.value)
  }

  async function handleLogHRT() {
    setHrtLogging(true)
    await logHRTEvent(date)
    const updated = await getHRTEventsBetween(dateStr, dateStr)
    setHrtEvents(updated)
    setHrtLogging(false)
    onSaved?.()
  }

  async function handleUndoHRT(id) {
    await deleteHRTEvent(id)
    const updated = await getHRTEventsBetween(dateStr, dateStr)
    setHrtEvents(updated)
    onSaved?.()
  }

  const grouped = symptoms.reduce((acc, s) => {
    if (!acc[s.category]) acc[s.category] = []
    acc[s.category].push(s)
    return acc
  }, {})

  return (
    <div className="day-detail-backdrop" onClick={onClose}>
      <div className="day-detail-panel" onClick={e => e.stopPropagation()}>

        <div className="day-detail-header">
          <span className="day-detail-date">{format(date, 'EEEE d MMMM')}</span>
          <button className="day-detail-close" onClick={onClose}>✕</button>
        </div>

        {/* HRT */}
        <div className="day-detail-section">
          <div className="section-title">HRT intake</div>
          {hrtEvents.length === 0 ? (
            <button className="btn btn--hrt btn--full" onClick={handleLogHRT} disabled={hrtLogging}>
              <span className="hrt-icon">✦</span>
              {hrtLogging ? 'Logging…' : 'Log HRT intake'}
            </button>
          ) : (
            <div>
              {hrtEvents.map(e => (
                <div key={e.id} className="hrt-logged-row">
                  <span className="hrt-pill">
                    ✦ {dateStr === TODAY_STR
                        ? `Logged ${format(new Date(e.timestamp), 'HH:mm')}`
                        : 'HRT logged'}
                  </span>
                  <button className="btn-undo" onClick={() => handleUndoHRT(e.id)}>undo</button>
                </div>
              ))}
              <button
                className="btn btn--secondary btn--full"
                style={{ marginTop: 8 }}
                onClick={handleLogHRT}
                disabled={hrtLogging}
              >
                + Log again
              </button>
            </div>
          )}
        </div>

        {/* Symptoms by category */}
        {Object.entries(grouped).map(([category, catSymptoms]) => (
          <div key={category} className="day-detail-section">
            <div className="section-title">{category}</div>
            <div className="sym-list">
              {catSymptoms.map(s => (
                <SymptomRow
                  key={s.id}
                  symptom={s}
                  value={symptomValues[s.id] ?? null}
                  onChange={val => handleSymptomChange(s.id, val)}
                />
              ))}
            </div>
          </div>
        ))}

        {/* Notes */}
        <div className="day-detail-section">
          <div className="section-title">Notes</div>
          <textarea
            className="notes-textarea"
            placeholder="How were you feeling? Anything to note…"
            value={notes}
            onChange={handleNotesChange}
            rows={3}
          />
        </div>

        {/* Inline save status */}
        {saveStatus !== 'idle' && (
          <div className={`save-status save-status--panel save-status--${saveStatus}`}>
            {saveStatus === 'saving' ? 'Saving…' : '✓ Saved'}
          </div>
        )}

      </div>
    </div>
  )
}
