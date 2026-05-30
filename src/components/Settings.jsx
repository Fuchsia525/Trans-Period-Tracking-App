import { useState, useEffect } from 'react'
import {
  getAllSymptoms, saveSymptom, deleteSymptom,
  getSetting, setSetting,
  exportData, importData,
  DEFAULT_SYMPTOM_IDS,
} from '../db/db'

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

  async function handleToggleEnabled() {
    await onUpdate({ ...symptom, enabled: !symptom.enabled })
  }

  async function handleSaveName() {
    if (name.trim()) {
      await onUpdate({ ...symptom, name: name.trim() })
    }
    setEditing(false)
  }

  async function handleTypeChange(e) {
    await onUpdate({ ...symptom, inputType: e.target.value })
  }

  return (
    <div className={`sym-edit-row${!symptom.enabled ? ' sym-edit-row--disabled' : ''}`}>
      {/* Enable toggle */}
      <button
        className={`sym-enable-btn${symptom.enabled ? ' sym-enable-btn--on' : ''}`}
        onClick={handleToggleEnabled}
        title={symptom.enabled ? 'Disable' : 'Enable'}
      >
        {symptom.enabled ? '●' : '○'}
      </button>

      {/* Name */}
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

      {/* Input type */}
      <select className="sym-type-select" value={symptom.inputType} onChange={handleTypeChange}>
        {INPUT_TYPES.map(t => (
          <option key={t.value} value={t.value}>{t.label}</option>
        ))}
      </select>

      {/* Delete (custom symptoms only) */}
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
  const [symptoms,   setSymptoms]   = useState([])
  const [hrtMethod,  setHrtMethod]  = useState('')
  const [hrtFreq,    setHrtFreq]    = useState('')
  const [showAddForm,setShowAddForm]= useState(false)
  const [importMsg,  setImportMsg]  = useState('')
  const [loading,    setLoading]    = useState(true)

  useEffect(() => {
    async function load() {
      const [syms, method, freq] = await Promise.all([
        getAllSymptoms(),
        getSetting('hrtMethod'),
        getSetting('hrtFrequency'),
      ])
      setSymptoms(syms)
      setHrtMethod(method ?? '')
      setHrtFreq(freq ?? '')
      setLoading(false)
    }
    load()
  }, [])

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
      name,
      category,
      inputType,
      enabled: true,
      order: symptoms.length,
    }
    await saveSymptom(newSym)
    setSymptoms(prev => [...prev, newSym])
    setShowAddForm(false)
  }

  async function handleHRTBlur() {
    await setSetting('hrtMethod', hrtMethod)
    await setSetting('hrtFrequency', hrtFreq)
  }

  async function handleExport() {
    const data     = await exportData()
    const json     = JSON.stringify(data, null, 2)
    const blob     = new Blob([json], { type: 'application/json' })
    const url      = URL.createObjectURL(blob)
    const a        = document.createElement('a')
    a.href         = url
    a.download     = `tfpt-export-${format(new Date(), 'yyyy-MM-dd')}.json`
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
    e.target.value = '' // reset file input
  }

  // Group symptoms by category for display
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
        <p className="settings-hint">This is for your reference only — not used for predictions.</p>
        <div className="settings-field">
          <label className="settings-label">Delivery method</label>
          <input
            className="settings-input"
            placeholder="e.g. Injectable EV, Patches, Gel…"
            value={hrtMethod}
            onChange={e => setHrtMethod(e.target.value)}
            onBlur={handleHRTBlur}
          />
        </div>
        <div className="settings-field">
          <label className="settings-label">Typical frequency</label>
          <input
            className="settings-input"
            placeholder="e.g. Weekly injection, Daily patch change…"
            value={hrtFreq}
            onChange={e => setHrtFreq(e.target.value)}
            onBlur={handleHRTBlur}
          />
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

      {/* Import / Export */}
      <div className="card">
        <div className="section-title">Data</div>
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

// date-fns format needed for export filename
function format(date, fmt) {
  const d = date
  const pad = n => String(n).padStart(2, '0')
  if (fmt === 'yyyy-MM-dd') {
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`
  }
  return d.toISOString().slice(0,10)
}
