import { useState, useEffect, useRef } from 'react'
import {
  getEnabledSymptoms,
  getDailyLog,
  saveDailyLog,
  getHRTEventsBetween,
  logHRTEvent,
  deleteHRTEvent,
  toDateString,
} from '../db/db'

// ── Symptom inputs ─────────────────────────────────────────────

function BooleanInput({ value, onChange }) {
  const active = value === true
  return (
    <button
      type="button"
      className={`sym-bool${active ? ' sym-bool--active' : ''}`}
      onClick={() => onChange(active ? null : true)}
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
      placeholder="Type notes…"
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

// ── Bottom sheet ───────────────────────────────────────────────

function LogSheet({ symptoms, onClose }) {
  const todayStr = toDateString(new Date())
  const [date,          setDate]          = useState(todayStr)
  const [hrtLogged,     setHrtLogged]     = useState(false)
  const [symptomValues, setSymptomValues] = useState({})
  const [notes,         setNotes]         = useState('')
  const [saveState,     setSaveState]     = useState('idle') // idle | saving | saved
  const [showMore,      setShowMore]      = useState(false)
  const sheetRef  = useRef(null)
  const dragStart = useRef(null)

  // Load existing data when date changes
  useEffect(() => {
    async function loadDate() {
      const [log, hrt] = await Promise.all([
        getDailyLog(date),
        getHRTEventsBetween(date, date),
      ])
      setHrtLogged(hrt.length > 0)
      setSymptomValues(log?.symptoms || {})
      setNotes(log?.notes || '')
    }
    loadDate()
  }, [date])

  // Lock body scroll while sheet is open
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [])

  async function handleSave() {
    if (saveState !== 'idle') return
    setSaveState('saving')

    await saveDailyLog(date, symptomValues, notes)

    const existingHRT = await getHRTEventsBetween(date, date)
    if (hrtLogged && existingHRT.length === 0) {
      await logHRTEvent(new Date(date + 'T12:00:00'))
    } else if (!hrtLogged && existingHRT.length > 0) {
      for (const e of existingHRT) await deleteHRTEvent(e.id)
    }

    window.dispatchEvent(new CustomEvent('tfpt:log-saved', { detail: { date } }))
    setSaveState('saved')
    setTimeout(onClose, 700)
  }

  // Drag-to-dismiss: attached to the handle bar only
  function onHandlePointerDown(e) {
    dragStart.current = e.clientY
    sheetRef.current.style.transition = 'none'
    e.currentTarget.setPointerCapture(e.pointerId)
  }
  function onHandlePointerMove(e) {
    if (dragStart.current === null) return
    const dy = Math.max(0, e.clientY - dragStart.current)
    sheetRef.current.style.transform = `translateY(${dy}px)`
  }
  function onHandlePointerUp(e) {
    if (dragStart.current === null) return
    const dy = e.clientY - dragStart.current
    sheetRef.current.style.transition = ''
    sheetRef.current.style.transform  = ''
    if (dy > 80) onClose()
    dragStart.current = null
  }

  // dailyTracking undefined is treated as true (backward compat for existing users)
  const dailySyms = symptoms.filter(s => s.dailyTracking !== false)
  const moreSyms  = symptoms.filter(s => s.dailyTracking === false)

  function groupBy(list) {
    return list.reduce((acc, s) => {
      if (!acc[s.category]) acc[s.category] = []
      acc[s.category].push(s)
      return acc
    }, {})
  }

  function renderGroups(list) {
    return Object.entries(groupBy(list)).map(([category, catSymptoms]) => (
      <div key={category}>
        <div className="sym-group-label">{category}</div>
        <div className="sym-list">
          {catSymptoms.map(s => (
            <SymptomRow
              key={s.id}
              symptom={s}
              value={symptomValues[s.id] ?? null}
              onChange={val => setSymptomValues(prev => ({ ...prev, [s.id]: val }))}
            />
          ))}
        </div>
      </div>
    ))
  }

  return (
    <div className="sheet-backdrop" onPointerDown={onClose}>
      <div
        className="sheet"
        ref={sheetRef}
        onPointerDown={e => e.stopPropagation()}
      >
        {/* Drag handle */}
        <div
          className="sheet-handle"
          onPointerDown={onHandlePointerDown}
          onPointerMove={onHandlePointerMove}
          onPointerUp={onHandlePointerUp}
        >
          <div className="sheet-handle-bar" />
        </div>

        {/* Header */}
        <div className="sheet-header">
          <h2 className="sheet-title">Log entry</h2>
          <button className="sheet-close" onClick={onClose} type="button" aria-label="Close">✕</button>
        </div>

        <div className="sheet-body">
          {/* Date */}
          <div className="sheet-field">
            <label className="sheet-label">Date</label>
            <input
              className="settings-input"
              type="date"
              value={date}
              max={todayStr}
              onChange={e => setDate(e.target.value)}
            />
          </div>

          {/* HRT intake toggle */}
          <div className="sheet-hrt-row">
            <div className="sheet-hrt-text">
              <div className="sheet-hrt-title">HRT intake</div>
              <div className="sheet-hrt-hint">Did you take your HRT on this date?</div>
            </div>
            <button
              type="button"
              className={`onboard-toggle${hrtLogged ? ' onboard-toggle--on' : ''}`}
              onClick={() => setHrtLogged(v => !v)}
              aria-pressed={hrtLogged}
            >
              {hrtLogged ? 'Yes' : 'No'}
            </button>
          </div>

          {/* Primary symptoms (dailyTracking !== false) */}
          {dailySyms.length > 0 && (
            <div className="sheet-sym-section">
              {renderGroups(dailySyms)}
            </div>
          )}

          {/* More symptoms (dailyTracking === false) — collapsible */}
          {moreSyms.length > 0 && (
            <div className="sheet-sym-section" style={{ borderTop: 'none', paddingTop: 0 }}>
              <button
                type="button"
                className="sheet-more-toggle"
                onClick={() => setShowMore(v => !v)}
              >
                <span className="sheet-more-arrow">{showMore ? '▴' : '▾'}</span>
                {showMore ? 'Fewer symptoms' : `More symptoms (${moreSyms.length})`}
              </button>
              {showMore && (
                <div className="sheet-more-list">
                  {renderGroups(moreSyms)}
                </div>
              )}
            </div>
          )}

          {/* Notes */}
          <div className="sheet-field">
            <label className="sheet-label">Notes</label>
            <textarea
              className="notes-textarea sheet-notes"
              placeholder="How are you feeling? Anything to note…"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={3}
            />
          </div>

          {/* Save */}
          <button
            className={`btn btn--full sheet-save-btn${saveState === 'saved' ? ' btn--secondary' : ' btn--primary'}`}
            onClick={handleSave}
            disabled={saveState !== 'idle'}
          >
            {saveState === 'saved'  ? '✓ Saved'  :
             saveState === 'saving' ? 'Saving…'  : 'Save entry'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── FAB ────────────────────────────────────────────────────────

export default function LogFAB() {
  const [open,     setOpen]     = useState(false)
  const [symptoms, setSymptoms] = useState([])

  async function handleOpen() {
    const syms = await getEnabledSymptoms()
    setSymptoms(syms)
    setOpen(true)
  }

  return (
    <>
      <div className="fab-container" aria-hidden={open}>
        <button
          className="fab"
          onClick={handleOpen}
          aria-label="Log entry"
          type="button"
        >
          <span className="fab-plus">+</span>
        </button>
      </div>

      {open && (
        <LogSheet
          symptoms={symptoms}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  )
}
