import { useState, useEffect } from 'react'
import { setSetting, setHRTSchedule, getAllSymptoms, saveSymptom } from '../db/db'

const DELIVERY_METHODS = ['Injectable EV', 'Injectable EC', 'Patch', 'Gel', 'Oral', 'Sublingual', 'Other']
const DOSAGE_UNITS     = ['mg', 'mcg', 'ml', 'g']
const CATEGORIES       = ['Mood & emotional', 'Physical', 'Energy & cognition', 'Custom']
const TOTAL_STEPS      = 4

// ── Shared primitives ──────────────────────────────────────────

function ProgressDots({ current }) {
  return (
    <div className="onboard-progress">
      {Array.from({ length: TOTAL_STEPS }, (_, i) => (
        <span
          key={i}
          className={[
            'onboard-progress-dot',
            i < current - 1  ? 'onboard-progress-dot--done'   : '',
            i === current - 1 ? 'onboard-progress-dot--active' : '',
          ].filter(Boolean).join(' ')}
        />
      ))}
    </div>
  )
}

function BackBtn({ onClick }) {
  return (
    <button className="onboard-back" onClick={onClick} type="button">
      ← Back
    </button>
  )
}

// ── Welcome ────────────────────────────────────────────────────

function Welcome({ onJumpIn, onSetup }) {
  return (
    <div className="onboard-screen">
      <div className="onboard-hero">
        <div className="onboard-wordmark">TFPT</div>
        <h1 className="onboard-title">Trans Focused<br />Period Tracker</h1>
        <p className="onboard-tagline">
          A private space to track how your cycle and HRT shape how you feel, day by day.
        </p>
      </div>

      <div className="onboard-features">
        <div className="onboard-feature">
          <span className="onboard-feature-icon">✦</span>
          <span>Log HRT intake and symptoms each day</span>
        </div>
        <div className="onboard-feature">
          <span className="onboard-feature-icon">◈</span>
          <span>Browse your history in the calendar and fill in past days</span>
        </div>
        <div className="onboard-feature">
          <span className="onboard-feature-icon">~</span>
          <span>Spot patterns in your mood, energy, and body over time</span>
        </div>
      </div>

      <div className="onboard-footer">
        <button
          className="btn btn--primary btn--full"
          style={{ fontSize: 16, padding: 16 }}
          onClick={onSetup}
        >
          Set up with guidance
        </button>
        <button className="btn btn--secondary btn--full" onClick={onJumpIn}>
          Jump in
        </button>
        <p className="onboard-privacy">All data stays on your device — nothing is ever sent anywhere.</p>
      </div>
    </div>
  )
}

// ── Step 1: HRT details ────────────────────────────────────────

function StepHRT({ data, onChange, onBack, onNext }) {
  const [showMore, setShowMore] = useState(false)

  return (
    <div className="onboard-screen">
      <BackBtn onClick={onBack} />
      <ProgressDots current={1} />

      <div className="onboard-step-header">
        <h2 className="onboard-step-title">Your HRT</h2>
        <p className="onboard-body">
          Tell us about your hormone therapy. Everything here is optional — it's just for your own reference inside the app.
        </p>
      </div>

      <div className="onboard-form">
        <div className="settings-field">
          <label className="settings-label">Delivery method</label>
          <select
            className="settings-input"
            value={data.method}
            onChange={e => onChange({ ...data, method: e.target.value })}
          >
            <option value="">Select method…</option>
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
              value={data.dosage}
              onChange={e => onChange({ ...data, dosage: e.target.value })}
            />
            <select
              className="settings-input onboard-unit-select"
              value={data.dosageUnit}
              onChange={e => onChange({ ...data, dosageUnit: e.target.value })}
            >
              {DOSAGE_UNITS.map(u => <option key={u} value={u}>{u}</option>)}
            </select>
          </div>
        </div>

        <button
          type="button"
          className="onboard-collapsible-btn"
          onClick={() => setShowMore(v => !v)}
        >
          <span className="onboard-collapsible-arrow">{showMore ? '▴' : '▾'}</span>
          More details — antiandrogen, progesterone, brand name
        </button>

        {showMore && (
          <div className="onboard-collapsible">
            <div className="settings-field">
              <label className="settings-label">Antiandrogen</label>
              <input
                className="settings-input"
                placeholder="e.g. Spironolactone 100mg, Bicalutamide…"
                value={data.antiandrogen}
                onChange={e => onChange({ ...data, antiandrogen: e.target.value })}
              />
            </div>
            <div className="settings-field">
              <label className="settings-label">Progesterone</label>
              <input
                className="settings-input"
                placeholder="e.g. Utrogestan 100mg…"
                value={data.progesterone}
                onChange={e => onChange({ ...data, progesterone: e.target.value })}
              />
            </div>
            <div className="settings-field">
              <label className="settings-label">Brand / product name</label>
              <input
                className="settings-input"
                placeholder="e.g. Progynova, Estradot…"
                value={data.brand}
                onChange={e => onChange({ ...data, brand: e.target.value })}
              />
            </div>
          </div>
        )}
      </div>

      <div className="onboard-actions">
        <button className="btn btn--primary btn--full" onClick={onNext}>Continue</button>
        <button className="btn btn--ghost btn--full" onClick={onNext}>Skip this step</button>
      </div>
    </div>
  )
}

// ── Step 2: Schedule ───────────────────────────────────────────

function StepSchedule({ data, onChange, onBack, onNext }) {
  const [notifState, setNotifState] = useState('idle') // idle | denied | unsupported
  const today = new Date().toISOString().slice(0, 10)

  async function handleNotifToggle() {
    if (data.notifications) {
      onChange({ ...data, notifications: false })
      return
    }
    if (!('Notification' in window)) {
      setNotifState('unsupported')
      return
    }
    const result = await Notification.requestPermission()
    if (result === 'granted') {
      setNotifState('idle')
      onChange({ ...data, notifications: true })
    } else {
      setNotifState('denied')
    }
  }

  return (
    <div className="onboard-screen">
      <BackBtn onClick={onBack} />
      <ProgressDots current={2} />

      <div className="onboard-step-header">
        <h2 className="onboard-step-title">Your schedule</h2>
        <p className="onboard-body">
          The app uses this to show when your next HRT is due. You can update it any time in Settings.
        </p>
      </div>

      <div className="onboard-form">
        <div className="settings-field">
          <label className="settings-label">How often do you take your HRT?</label>
          <div className="onboard-split-row">
            <input
              className="settings-input"
              type="number"
              min="1"
              placeholder="e.g. 7"
              value={data.frequencyValue}
              onChange={e => onChange({ ...data, frequencyValue: e.target.value })}
            />
            <select
              className="settings-input onboard-unit-select"
              value={data.frequencyUnit}
              onChange={e => onChange({ ...data, frequencyUnit: e.target.value })}
            >
              <option value="days">days</option>
              <option value="weeks">weeks</option>
            </select>
          </div>
        </div>

        <div className="settings-field">
          <label className="settings-label">When did you last take it?</label>
          <input
            className="settings-input"
            type="date"
            value={data.lastIntake}
            max={today}
            onChange={e => onChange({ ...data, lastIntake: e.target.value })}
          />
        </div>

        <div className="onboard-notif-card">
          <div className="onboard-notif-row">
            <div className="onboard-notif-text">
              <div className="onboard-notif-title">Remind me when HRT is due</div>
              <div className="onboard-notif-hint">
                A gentle notification on the day. You can turn this off in Settings any time.
              </div>
            </div>
            <button
              type="button"
              className={`onboard-toggle${data.notifications ? ' onboard-toggle--on' : ''}`}
              onClick={handleNotifToggle}
              aria-pressed={data.notifications}
            >
              {data.notifications ? 'On' : 'Off'}
            </button>
          </div>
          {notifState === 'denied' && (
            <p className="onboard-notif-denied">
              Your browser blocked notifications. You can allow them in your browser settings later.
            </p>
          )}
          {notifState === 'unsupported' && (
            <p className="onboard-notif-denied">
              Notifications aren't supported in this browser.
            </p>
          )}
        </div>
      </div>

      <div className="onboard-actions">
        <button className="btn btn--primary btn--full" onClick={onNext}>Continue</button>
        <button className="btn btn--ghost btn--full" onClick={onNext}>Skip this step</button>
      </div>
    </div>
  )
}

// ── Step 3: Symptoms ───────────────────────────────────────────

function StepSymptoms({ symptoms, onToggle, onAddCustom, onBack, onNext }) {
  const [showAdd,      setShowAdd]      = useState(false)
  const [newName,      setNewName]      = useState('')
  const [newCategory,  setNewCategory]  = useState('Custom')
  const [newType,      setNewType]      = useState('boolean')

  const grouped = symptoms.reduce((acc, s) => {
    if (!acc[s.category]) acc[s.category] = []
    acc[s.category].push(s)
    return acc
  }, {})

  function handleAdd(e) {
    e.preventDefault()
    if (!newName.trim()) return
    onAddCustom({ name: newName.trim(), category: newCategory, inputType: newType })
    setNewName('')
    setShowAdd(false)
  }

  return (
    <div className="onboard-screen">
      <BackBtn onClick={onBack} />
      <ProgressDots current={3} />

      <div className="onboard-step-header" style={{ flex: 'none' }}>
        <h2 className="onboard-step-title">What do you want to track?</h2>
        <p className="onboard-body">
          Enable what's relevant to you. You can change this any time in Settings.
        </p>
      </div>

      <div className="onboard-sym-list">
        {Object.entries(grouped).map(([category, catSymptoms]) => (
          <div key={category} className="sym-group">
            <div className="sym-group-label">{category}</div>
            {catSymptoms.map(s => (
              <div
                key={s.id}
                className={`sym-edit-row${!s.enabled ? ' sym-edit-row--disabled' : ''}`}
              >
                <button
                  type="button"
                  className={`sym-enable-btn${s.enabled ? ' sym-enable-btn--on' : ''}`}
                  onClick={() => onToggle(s.id)}
                >
                  {s.enabled ? '●' : '○'}
                </button>
                <span className="sym-edit-label" style={{ cursor: 'default' }}>{s.name}</span>
              </div>
            ))}
          </div>
        ))}

        {showAdd ? (
          <form className="add-sym-form" onSubmit={handleAdd}>
            <input
              className="add-sym-input"
              placeholder="Symptom name"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              autoFocus
            />
            <div className="add-sym-row">
              <select
                className="sym-type-select"
                value={newCategory}
                onChange={e => setNewCategory(e.target.value)}
              >
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <select
                className="sym-type-select"
                value={newType}
                onChange={e => setNewType(e.target.value)}
              >
                <option value="boolean">Yes / No</option>
                <option value="scale">Scale 1–5</option>
                <option value="tags">Text note</option>
              </select>
            </div>
            <div className="add-sym-actions">
              <button type="submit" className="btn btn--primary">Add</button>
              <button type="button" className="btn btn--ghost" onClick={() => setShowAdd(false)}>Cancel</button>
            </div>
          </form>
        ) : (
          <button
            className="btn btn--secondary btn--full"
            style={{ marginTop: 8 }}
            onClick={() => setShowAdd(true)}
          >
            + Add custom symptom
          </button>
        )}
      </div>

      <div className="onboard-actions">
        <button className="btn btn--primary btn--full" onClick={onNext}>Continue</button>
      </div>
    </div>
  )
}

// ── Step 4: Done ───────────────────────────────────────────────

function StepDone({ onStartTutorial, onFinish }) {
  return (
    <div className="onboard-screen">
      <ProgressDots current={4} />

      <div className="onboard-hero" style={{ alignItems: 'center', textAlign: 'center' }}>
        <div className="onboard-done-icon">✦</div>
        <h2 className="onboard-step-title">You're all set</h2>
        <p className="onboard-body">
          Your space is ready. Take it one day at a time — every entry, big or small, helps you understand your own patterns.
        </p>
      </div>

      <div className="onboard-actions">
        <button
          className="btn btn--primary btn--full"
          style={{ fontSize: 16, padding: 16 }}
          onClick={onStartTutorial}
        >
          Show me around
        </button>
        <button className="btn btn--ghost btn--full" onClick={onFinish}>
          Go straight to the app
        </button>
      </div>
    </div>
  )
}

// ── Root component ─────────────────────────────────────────────

export default function Onboarding({ onComplete }) {
  const [screen, setScreen] = useState('welcome')
  const today = new Date().toISOString().slice(0, 10)

  const [hrtData, setHrtData] = useState({
    method: '', dosage: '', dosageUnit: 'mg',
    antiandrogen: '', progesterone: '', brand: '',
  })

  const [scheduleData, setScheduleData] = useState({
    frequencyValue: '', frequencyUnit: 'days',
    lastIntake: today, notifications: false,
  })

  const [symptoms, setSymptoms] = useState([])
  const [saving,   setSaving]   = useState(false)

  useEffect(() => {
    getAllSymptoms().then(setSymptoms)
  }, [])

  function handleToggle(id) {
    setSymptoms(prev => prev.map(s => s.id === id ? { ...s, enabled: !s.enabled } : s))
  }

  function handleAddCustom({ name, category, inputType }) {
    const newSym = {
      id: `custom-${Date.now()}`,
      name, category, inputType,
      enabled: true,
      order: symptoms.length,
    }
    setSymptoms(prev => [...prev, newSym])
  }

  async function handleJumpIn() {
    await setSetting('onboardingComplete', true)
    onComplete(false)
  }

  async function handleFinish(startTutorial) {
    if (saving) return
    setSaving(true)

    if (hrtData.method)       await setSetting('hrtMethod',       hrtData.method)
    if (hrtData.dosage)       await setSetting('hrtDosage',       `${hrtData.dosage} ${hrtData.dosageUnit}`)
    if (hrtData.antiandrogen) await setSetting('hrtAntiandrogen', hrtData.antiandrogen)
    if (hrtData.progesterone) await setSetting('hrtProgesterone', hrtData.progesterone)
    if (hrtData.brand)        await setSetting('hrtBrand',        hrtData.brand)

    if (scheduleData.frequencyValue && scheduleData.lastIntake) {
      await setHRTSchedule({
        frequencyValue: Number(scheduleData.frequencyValue),
        frequencyUnit:  scheduleData.frequencyUnit,
        lastIntakeDate: scheduleData.lastIntake,
      })
    }

    await setSetting('notificationsEnabled', scheduleData.notifications)

    for (const s of symptoms) await saveSymptom(s)

    await setSetting('onboardingComplete', true)
    onComplete(startTutorial)
  }

  if (screen === 'welcome') return <Welcome onJumpIn={handleJumpIn} onSetup={() => setScreen(1)} />
  if (screen === 1) return <StepHRT      data={hrtData}      onChange={setHrtData}      onBack={() => setScreen('welcome')} onNext={() => setScreen(2)} />
  if (screen === 2) return <StepSchedule data={scheduleData} onChange={setScheduleData} onBack={() => setScreen(1)}         onNext={() => setScreen(3)} />
  if (screen === 3) return <StepSymptoms symptoms={symptoms} onToggle={handleToggle} onAddCustom={handleAddCustom}          onBack={() => setScreen(2)} onNext={() => setScreen(4)} />
  if (screen === 4) return <StepDone onStartTutorial={() => handleFinish(true)} onFinish={() => handleFinish(false)} />
}
