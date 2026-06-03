import { useState, useEffect, useContext } from 'react'
import {
  getAllSymptoms, saveSymptom, deleteSymptom,
  getSetting, setSetting,
  exportData, importData,
  getHRTSchedule, setHRTSchedule,
  DEFAULT_SYMPTOM_IDS,
} from '../db/db'
import { TutorialContext } from '../context'

const DELIVERY_METHODS = ['Injectable EV', 'Injectable EC', 'Patch', 'Gel', 'Oral', 'Sublingual', 'Other']
const DOSAGE_UNITS     = ['mg', 'mcg', 'ml', 'g']
const INPUT_TYPES = [
  { value: 'boolean', label: 'Yes / No' },
  { value: 'scale',   label: 'Scale 1–5' },
  { value: 'tags',    label: 'Text note' },
]
const CATEGORIES = ['Mood & emotional', 'Physical', 'Energy & cognition', 'Custom']

// ── Single editable symptom row ────────────────────────────────
function SymptomRow({ symptom, onUpdate, onDelete }) {
  const [editing, setEditing] = useState(false)
  const [name, setName]       = useState(symptom.name)
  const isDefault             = DEFAULT_SYMPTOM_IDS.includes(symptom.id)
  // undefined treated as true for existing symptoms without the field
  const isDaily               = symptom.dailyTracking !== false

  async function handleToggleEnabled() {
    await onUpdate({ ...symptom, enabled: !symptom.enabled })
  }

  async function handleToggleDaily() {
    await onUpdate({ ...symptom, dailyTracking: !isDaily })
  }

  async function handleSaveName() {
    if (name.trim()) await onUpdate({ ...symptom, name: name.trim() })
    setEditing(false)
  }

  async function handleTypeChange(e) {
    await onUpdate({ ...symptom, inputType: e.target.value })
  }

  return (
    <div className={`sym-edit-row${!symptom.enabled ? ' sym-edit-row--disabled' : ''}`}>
      <button
        className={`sym-enable-btn${symptom.enabled ? ' sym-enable-btn--on' : ''}`}
        onClick={handleToggleEnabled}
        title={symptom.enabled ? 'Disable' : 'Enable'}
      >
        {symptom.enabled ? '●' : '○'}
      </button>

      <div className="sym-edit-name">
        {editing ? (
          <input
            className="sym-name-input"
            value={name}
            onChange={e => setName(e.target.value)}
            onBlur={handleSaveName}
            onKeyDown={e => e.key === 'Enter' && handleSaveName()}
            autoFocus
          />
        ) : (
          <span className="sym-edit-label" onClick={() => setEditing(true)}>
            {symptom.name}
          </span>
        )}
      </div>

      <button
        type="button"
        className={`sym-daily-btn${isDaily ? ' sym-daily-btn--on' : ''}`}
        onClick={handleToggleDaily}
        title="Show in daily log"
      >
        Daily
      </button>

      <select className="sym-type-select" value={symptom.inputType} onChange={handleTypeChange}>
        {INPUT_TYPES.map(t => (
          <option key={t.value} value={t.value}>{t.label}</option>
        ))}
      </select>

      {!isDefault && (
        <button className="sym-delete-btn" onClick={() => onDelete(symptom.id)} title="Delete">✕</button>
      )}
    </div>
  )
}

// ── Add new symptom form ───────────────────────────────────────
function AddSymptomForm({ onAdd, onCancel }) {
  const [name,      setName]      = useState('')
  const [category,  setCategory]  = useState('Custom')
  const [inputType, setInputType] = useState('boolean')

  function handleSubmit(e) {
    e.preventDefault()
    if (!name.trim()) return
    onAdd({ name: name.trim(), category, inputType })
  }

  return (
    <form className="add-sym-form" onSubmit={handleSubmit}>
      <input
        className="add-sym-input"
        placeholder="Symptom name"
        value={name}
        onChange={e => setName(e.target.value)}
        autoFocus
      />
      <div className="add-sym-row">
        <select className="sym-type-select" value={category} onChange={e => setCategory(e.target.value)}>
          {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select className="sym-type-select" value={inputType} onChange={e => setInputType(e.target.value)}>
          {INPUT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
      </div>
      <div className="add-sym-actions">
        <button type="submit" className="btn btn--primary">Add symptom</button>
        <button type="button" className="btn btn--ghost" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  )
}

// ── Main Settings screen ───────────────────────────────────────
export default function Settings() {
  const tutorial = useContext(TutorialContext)

  const [symptoms,    setSymptoms]    = useState([])
  const [showAddForm, setShowAddForm] = useState(false)
  const [importMsg,   setImportMsg]   = useState('')
  const [loading,     setLoading]     = useState(true)

  // HRT profile fields
  const [hrtMethod,      setHrtMethod]      = useState('')
  const [hrtDosage,      setHrtDosage]      = useState('')
  const [hrtDosageUnit,  setHrtDosageUnit]  = useState('mg')
  const [hrtAntiandrogen,setHrtAntiandrogen]= useState('')
  const [hrtProgesterone,setHrtProgesterone]= useState('')
  const [hrtBrand,       setHrtBrand]       = useState('')
  const [showMoreHRT,    setShowMoreHRT]    = useState(false)

  // Schedule fields
  const [freqValue,   setFreqValue]   = useState('')
  const [freqUnit,    setFreqUnit]    = useState('days')
  const [lastIntake,  setLastIntake]  = useState('')

  // Notifications
  const [notifEnabled, setNotifEnabled] = useState(false)
  const [notifState,   setNotifState]   = useState('idle') // idle | denied | unsupported

  useEffect(() => {
    async function load() {
      const [syms, method, dosage, antiandrogen, progesterone, brand, schedule, notif] = await Promise.all([
        getAllSymptoms(),
        getSetting('hrtMethod'),
        getSetting('hrtDosage'),
        getSetting('hrtAntiandrogen'),
        getSetting('hrtProgesterone'),
        getSetting('hrtBrand'),
        getHRTSchedule(),
        getSetting('notificationsEnabled'),
      ])

      setSymptoms(syms)
      setHrtMethod(method ?? '')
      if (dosage) {
        const parts = dosage.split(' ')
        setHrtDosage(parts[0] ?? '')
        if (parts[1] && ['mg', 'mcg', 'ml', 'g'].includes(parts[1])) setHrtDosageUnit(parts[1])
      }
      setHrtAntiandrogen(antiandrogen ?? '')
      setHrtProgesterone(progesterone ?? '')
      setHrtBrand(brand ?? '')
      if (schedule) {
        setFreqValue(String(schedule.frequencyValue))
        setFreqUnit(schedule.frequencyUnit)
        setLastIntake(schedule.lastIntakeDate)
      }
      setNotifEnabled(!!notif)
      setLoading(false)
    }
    load()
  }, [])

  // ── Symptom handlers ───────────────────────────────────────

  async function handleUpdateSymptom(updated) {
    await saveSymptom(updated)
    setSymptoms(prev => prev.map(s => s.id === updated.id ? updated : s))
  }

  async function handleDeleteSymptom(id) {
    if (!confirm('Delete this symptom? Any data logged for it will remain in your records.')) return
    await deleteSymptom(id)
    setSymptoms(prev => prev.filter(s => s.id !== id))
  }

  async function handleAddSymptom({ name, category, inputType }) {
    const newSym = {
      id: `custom-${Date.now()}`,
      name, category, inputType,
      enabled: true,
      dailyTracking: true,
      order: symptoms.length,
    }
    await saveSymptom(newSym)
    setSymptoms(prev => [...prev, newSym])
    setShowAddForm(false)
  }

  // ── HRT profile save ───────────────────────────────────────

  async function handleHRTBlur() {
    await Promise.all([
      setSetting('hrtMethod', hrtMethod),
      setSetting('hrtDosage', hrtDosage ? `${hrtDosage} ${hrtDosageUnit}` : ''),
      setSetting('hrtAntiandrogen', hrtAntiandrogen),
      setSetting('hrtProgesterone', hrtProgesterone),
      setSetting('hrtBrand', hrtBrand),
    ])
  }

  // ── Schedule save ──────────────────────────────────────────

  async function handleScheduleBlur() {
    if (freqValue && lastIntake) {
      await setHRTSchedule({
        frequencyValue: Number(freqValue),
        frequencyUnit:  freqUnit,
        lastIntakeDate: lastIntake,
      })
    }
  }

  // ── Notification toggle ────────────────────────────────────

  async function handleNotifToggle() {
    if (notifEnabled) {
      setNotifEnabled(false)
      await setSetting('notificationsEnabled', false)
      return
    }
    if (!('Notification' in window)) {
      setNotifState('unsupported')
      return
    }
    const result = await Notification.requestPermission()
    if (result === 'granted') {
      setNotifState('idle')
      setNotifEnabled(true)
      await setSetting('notificationsEnabled', true)
    } else {
      setNotifState('denied')
    }
  }

  // ── Import / Export ────────────────────────────────────────

  async function handleExport() {
    const data = await exportData()
    const json = JSON.stringify(data, null, 2)
    const blob = new Blob([json], { type: 'application/json' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = `tfpt-export-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  function handleImport(e) {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = async ev => {
      try {
        const data = JSON.parse(ev.target.result)
        await importData(data)
        const updated = await getAllSymptoms()
        setSymptoms(updated)
        setImportMsg('✓ Data imported successfully')
        setTimeout(() => setImportMsg(''), 3000)
      } catch {
        setImportMsg('✕ Import failed — file may be invalid')
        setTimeout(() => setImportMsg(''), 3000)
      }
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  const grouped = symptoms.reduce((acc, s) => {
    if (!acc[s.category]) acc[s.category] = []
    acc[s.category].push(s)
    return acc
  }, {})

  if (loading) return <div className="loading-screen"><div className="loading-dot" /></div>

  return (
    <div className="settings-screen">

      {/* HRT Profile */}
      <div className="card">
        <div className="section-title">HRT profile</div>
        <p className="settings-hint">For your reference only — not used for predictions.</p>

        <div className="settings-field">
          <label className="settings-label">Delivery method</label>
          <select
            className="settings-input"
            value={hrtMethod}
            onChange={e => setHrtMethod(e.target.value)}
            onBlur={handleHRTBlur}
          >
            <option value="">Not set</option>
            {DELIVERY_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>

        <div className="settings-field">
          <label className="settings-label">Dosage</label>
          <div className="onboard-split-row">
            <input
              className="settings-input"
              type="text"
              inputMode="decimal"
              placeholder="e.g. 5"
              value={hrtDosage}
              onChange={e => setHrtDosage(e.target.value)}
              onBlur={handleHRTBlur}
            />
            <select
              className="settings-input onboard-unit-select"
              value={hrtDosageUnit}
              onChange={e => { setHrtDosageUnit(e.target.value); handleHRTBlur() }}
            >
              {DOSAGE_UNITS.map(u => <option key={u} value={u}>{u}</option>)}
            </select>
          </div>
        </div>

        <button
          type="button"
          className="onboard-collapsible-btn"
          onClick={() => setShowMoreHRT(v => !v)}
          style={{ marginBottom: showMoreHRT ? 8 : 0 }}
        >
          <span className="onboard-collapsible-arrow">{showMoreHRT ? '▴' : '▾'}</span>
          Antiandrogen, progesterone, brand name
        </button>

        {showMoreHRT && (
          <div className="onboard-collapsible">
            <div className="settings-field">
              <label className="settings-label">Antiandrogen</label>
              <input
                className="settings-input"
                placeholder="e.g. Spironolactone 100mg…"
                value={hrtAntiandrogen}
                onChange={e => setHrtAntiandrogen(e.target.value)}
                onBlur={handleHRTBlur}
              />
            </div>
            <div className="settings-field">
              <label className="settings-label">Progesterone</label>
              <input
                className="settings-input"
                placeholder="e.g. Utrogestan 100mg…"
                value={hrtProgesterone}
                onChange={e => setHrtProgesterone(e.target.value)}
                onBlur={handleHRTBlur}
              />
            </div>
            <div className="settings-field">
              <label className="settings-label">Brand / product name</label>
              <input
                className="settings-input"
                placeholder="e.g. Progynova, Estradot…"
                value={hrtBrand}
                onChange={e => setHrtBrand(e.target.value)}
                onBlur={handleHRTBlur}
              />
            </div>
          </div>
        )}
      </div>

      {/* Schedule */}
      <div className="card">
        <div className="section-title">HRT schedule</div>
        <p className="settings-hint">Used to calculate your next dose and show the countdown on Today.</p>

        <div className="settings-field">
          <label className="settings-label">Frequency</label>
          <div className="onboard-split-row">
            <input
              className="settings-input"
              type="number"
              min="1"
              placeholder="e.g. 7"
              value={freqValue}
              onChange={e => setFreqValue(e.target.value)}
              onBlur={handleScheduleBlur}
            />
            <select
              className="settings-input onboard-unit-select"
              value={freqUnit}
              onChange={e => { setFreqUnit(e.target.value); handleScheduleBlur() }}
            >
              <option value="days">days</option>
              <option value="weeks">weeks</option>
            </select>
          </div>
        </div>

        <div className="settings-field">
          <label className="settings-label">Last intake date</label>
          <input
            className="settings-input"
            type="date"
            value={lastIntake}
            max={new Date().toISOString().slice(0, 10)}
            onChange={e => setLastIntake(e.target.value)}
            onBlur={handleScheduleBlur}
          />
        </div>

        <div className="onboard-notif-card" style={{ marginTop: 4 }}>
          <div className="onboard-notif-row">
            <div className="onboard-notif-text">
              <div className="onboard-notif-title">Notify me when HRT is due</div>
              <div className="onboard-notif-hint">A notification on the due date when you open the app.</div>
            </div>
            <button
              type="button"
              className={`onboard-toggle${notifEnabled ? ' onboard-toggle--on' : ''}`}
              onClick={handleNotifToggle}
              aria-pressed={notifEnabled}
            >
              {notifEnabled ? 'On' : 'Off'}
            </button>
          </div>
          {notifState === 'denied' && (
            <p className="onboard-notif-denied">Your browser blocked notifications. Allow them in browser settings.</p>
          )}
          {notifState === 'unsupported' && (
            <p className="onboard-notif-denied">Notifications aren't supported in this browser.</p>
          )}
        </div>
      </div>

      {/* Symptoms */}
      <div className="card">
        <div className="section-title">Symptoms</div>
        <p className="settings-hint">Tap a name to rename it. Toggle ● to enable or disable.</p>

        {Object.entries(grouped).map(([category, catSymptoms]) => (
          <div key={category} className="sym-group">
            <div className="sym-group-label">{category}</div>
            {catSymptoms.map(s => (
              <SymptomRow
                key={s.id}
                symptom={s}
                onUpdate={handleUpdateSymptom}
                onDelete={handleDeleteSymptom}
              />
            ))}
          </div>
        ))}

        <div className="divider" />

        {showAddForm ? (
          <AddSymptomForm onAdd={handleAddSymptom} onCancel={() => setShowAddForm(false)} />
        ) : (
          <button className="btn btn--secondary btn--full" onClick={() => setShowAddForm(true)}>
            + Add custom symptom
          </button>
        )}
      </div>

      {/* App */}
      <div className="card">
        <div className="section-title">App</div>

        {tutorial && (
          <button
            className="btn btn--secondary btn--full"
            style={{ marginBottom: 12 }}
            onClick={tutorial.openTutorial}
          >
            ◈ Replay tutorial
          </button>
        )}

        <p className="settings-hint">Your data lives entirely on this device. Export it to back up or move to another device.</p>
        <div className="data-actions">
          <button className="btn btn--secondary btn--full" onClick={handleExport}>
            ↓ Export data as JSON
          </button>
          <label className="btn btn--secondary btn--full import-label">
            ↑ Import from JSON
            <input type="file" accept=".json" onChange={handleImport} style={{ display: 'none' }} />
          </label>
        </div>

        {importMsg && (
          <p className={`import-msg${importMsg.startsWith('✓') ? ' import-msg--ok' : ' import-msg--err'}`}>
            {importMsg}
          </p>
        )}
      </div>

      <div style={{ height: 8 }} />
    </div>
  )
}
