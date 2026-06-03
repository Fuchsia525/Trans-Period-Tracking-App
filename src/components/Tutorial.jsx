import { useState } from 'react'

const STEPS = [
  {
    icon: '✦',
    title: 'Your anchor event',
    body: 'The ✦ symbol marks an HRT intake — your anchor event. Every pattern the app shows you is measured relative to when you take your hormones.',
  },
  {
    icon: '◈',
    title: 'HRT as your reference point',
    body: 'Log your HRT intake each day you take it. The app tracks the timing to calculate when your next dose is due, and to reveal what shifts in the days around it.',
  },
  {
    icon: '○',
    title: 'Today',
    body: "Today is your daily log — symptoms, notes, and HRT. Even a partial entry is useful. You can also fill in past days by tapping any date in the Calendar.",
  },
  {
    icon: '~',
    title: 'Calendar & Patterns',
    body: 'Calendar shows every day at a glance — amber dots for HRT, rose dots for symptom logs. Patterns charts your data over weeks so you can see what changes around your cycle.',
  },
]

export default function Tutorial({ onClose }) {
  const [step, setStep] = useState(0)
  const current = STEPS[step]
  const isLast = step === STEPS.length - 1

  return (
    <div className="tutorial-backdrop" role="dialog" aria-modal="true" aria-label="App tutorial">
      <div className="tutorial-card">
        <div className="tutorial-top">
          <span className="tutorial-counter">{step + 1} of {STEPS.length}</span>
          <button className="tutorial-skip btn btn--ghost" onClick={onClose} type="button">
            Skip
          </button>
        </div>

        <div className="tutorial-icon">{current.icon}</div>
        <h3 className="tutorial-title">{current.title}</h3>
        <p className="tutorial-body">{current.body}</p>

        <div className="tutorial-dots">
          {STEPS.map((_, i) => (
            <span key={i} className={`tutorial-dot${i === step ? ' tutorial-dot--active' : ''}`} />
          ))}
        </div>

        <div className="tutorial-actions">
          {isLast ? (
            <button className="btn btn--primary btn--full" onClick={onClose}>
              Got it — let's go
            </button>
          ) : (
            <button className="btn btn--primary btn--full" onClick={() => setStep(s => s + 1)}>
              Next
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
