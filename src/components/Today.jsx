import { useState, useEffect, useRef } from 'react'
import { format } from 'date-fns'
import {
  logHRTEvent,
  getHRTEventsBetween,
  getDailyLog,
  saveDailyLog,
  getEnabledSymptoms,
  deleteHRTEvent,
} from '../db/db'

const TODAY = new Date()
const TODAY_STR = format(TODAY, 'yyyy-MM-dd')

// ── Symptom input: boolean toggle ──────────────────────────────
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

// ── Symptom input: 1–5 scale ───────────────────────────────────
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

// ── Symptom input: free text tags ──────────────────────────────
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

// ── Single symptom row ─────────────────────────────────────────
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

// ── Main Today screen ──────────────────────────────────────────
export default function Today() {
  const [symptoms, setSymptoms]           = useState([])
  const [hrtEvents, setHrtEvents]         = useState([])
  const [symptomValues, setSymptomValues] = useState({})
  const [notes, setNotes]                 = useState('')
  const [loading, setLoading]             = useState(true)
  const [saveStatus, setSaveStatus]       = useState('idle') // idle | saving | saved
  const saveTimer = useRef(null)

  useEffect(() => {
    async function load() {
      const [syms, log, hrt] = await Promise.all([
        getEnabledSymptoms(),
        getDailyLog(TODAY_STR),
        getHRTEventsBetween(TODAY_STR, TODAY_STR),
      ])
      setSymptoms(syms)
      setHrtEvents(hrt)
      if (log) {
        setSymptomValues(log.symptoms || {})
        setNotes(log.notes || '')
      }
      setLoading(false)
    }
    load()
  }, [])

  function scheduleAutoSave(values, currentNotes) {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    setSaveStatus('saving')
    saveTimer.current = setTimeout(async () => {
      await saveDailyLog(TODAY_STR, values, currentNotes)
      setSaveStatus('saved')
      setTimeout(() => setSaveStatus('idle'), 2000)
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
    await logHRTEvent(TODAY)
    const updated = await getHRTEventsBetween(TODAY_STR, TODAY_STR)
    setHrtEvents(updated)
  }

  async function handleUndoHRT(id) {
    await deleteHRTEvent(id)
    const updated = await getHRTEventsBetween(TODAY_STR, TODAY_STR)
    setHrtEvents(updated)
  }

  // Group symptoms by category
  const grouped = symptoms.reduce((acc, s) => {
    if (!acc[s.category]) acc[s.category] = []
    acc[s.category].push(s)
    return acc
  }, {})

  if (loading) {
    return <div className="loading-screen"><div className="loading-dot" /></div>
  }

  return (
    <div className="today-screen">
      {/* Date header */}
      <div className="today-date">
        <span className="today-date__weekday">{format(TODAY, 'EEEE')}</span>
        <span className="today-date__full">{format(TODAY, 'd MMMM yyyy')}</span>
      </div>

      {/* HRT Card */}
      <div className="card hrt-card">
        <div className="section-title">HRT intake</div>
        {hrtEvents.length === 0 ? (
          <button className="btn btn--hrt btn--full" onClick={handleLogHRT}>
            <span className="hrt-icon">✦</span>
            Log HRT intake
          </button>
        ) : (
          <div className="hrt-logged">
            {hrtEvents.map(e => (
              <div key={e.id} className="hrt-logged-row">
                <span className="hrt-pill">✦ Logged {format(new Date(e.timestamp), 'HH:mm')}</span>
                <button className="btn-undo" onClick={() => handleUndoHRT(e.id)}>undo</button>
              </div>
            ))}
            <button className="btn btn--secondary btn--full" style={{ marginTop: 12 }} onClick={handleLogHRT}>
              + Log again
            </button>
          </div>
        )}
      </div>

      {/* Symptom cards, one per category */}
      {Object.entries(grouped).map(([category, catSymptoms]) => (
        <div key={category} className="card">
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
      <div className="card">
        <div className="section-title">Notes</div>
        <textarea
          className="notes-textarea"
          placeholder="How are you feeling? Anything to note..."
          value={notes}
          onChange={handleNotesChange}
          rows={4}
        />
      </div>

      {/* Auto-save indicator */}
      {saveStatus !== 'idle' && (
        <div className={`save-status save-status--${saveStatus}`}>
          {saveStatus === 'saving' ? 'Saving…' : '✓ Saved'}
        </div>
      )}

      {/* Bottom padding so last card clears the nav bar */}
      <div style={{ height: 8 }} />
    </div>
  )
}
