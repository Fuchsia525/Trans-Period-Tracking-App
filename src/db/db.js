import { openDB } from 'idb'

const DB_NAME = 'tfpt-db'
const DB_VERSION = 1

function getDB() {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('hrtEvents')) {
        const s = db.createObjectStore('hrtEvents', { keyPath: 'id' })
        s.createIndex('date', 'date')
      }
      if (!db.objectStoreNames.contains('dailyLogs')) {
        const s = db.createObjectStore('dailyLogs', { keyPath: 'date' })
        s.createIndex('date', 'date')
      }
      if (!db.objectStoreNames.contains('symptoms')) {
        db.createObjectStore('symptoms', { keyPath: 'id' })
      }
      if (!db.objectStoreNames.contains('settings')) {
        db.createObjectStore('settings')
      }
    },
  })
}

// ── HRT Events ────────────────────────────────────────────────

export async function logHRTEvent(date = new Date()) {
  const db = await getDB()
  const id = `hrt-${Date.now()}`
  const isoDate = toDateString(date)
  await db.put('hrtEvents', { id, date: isoDate, timestamp: Date.now() })
  return id
}

export async function getAllHRTEvents() {
  const db = await getDB()
  const all = await db.getAll('hrtEvents')
  return all.sort((a, b) => a.date.localeCompare(b.date))
}

export async function getHRTEventsBetween(startDate, endDate) {
  const all = await getAllHRTEvents()
  const s = toDateString(startDate)
  const e = toDateString(endDate)
  return all.filter(ev => ev.date >= s && ev.date <= e)
}

export async function deleteHRTEvent(id) {
  const db = await getDB()
  await db.delete('hrtEvents', id)
}

// ── Daily Logs ────────────────────────────────────────────────

export async function saveDailyLog(date, symptoms, notes = '') {
  const db = await getDB()
  await db.put('dailyLogs', {
    date: toDateString(date),
    symptoms,
    notes,
    updatedAt: Date.now(),
  })
}

export async function getDailyLog(date) {
  const db = await getDB()
  return (await db.get('dailyLogs', toDateString(date))) ?? null
}

export async function getAllDailyLogs() {
  const db = await getDB()
  const all = await db.getAll('dailyLogs')
  return all.sort((a, b) => a.date.localeCompare(b.date))
}

export async function getDailyLogsBetween(startDate, endDate) {
  const all = await getAllDailyLogs()
  const s = toDateString(startDate)
  const e = toDateString(endDate)
  return all.filter(l => l.date >= s && l.date <= e)
}

// ── Symptoms ──────────────────────────────────────────────────

export const DEFAULT_SYMPTOM_IDS = [
  'mood-swings', 'anxiety', 'dysphoria', 'euphoria', 'irritability', 'sensitivity',
  'breast-tender', 'bloating', 'fatigue', 'headache', 'cramps', 'hot-flashes', 'nausea', 'acne',
  'energy', 'brain-fog', 'sleep',
]

export const DEFAULT_SYMPTOMS = [
  { id: 'mood-swings',   name: 'Mood swings',             category: 'Mood & emotional',   inputType: 'boolean', enabled: true,  order: 0  },
  { id: 'anxiety',       name: 'Anxiety',                  category: 'Mood & emotional',   inputType: 'scale',   enabled: true,  order: 1  },
  { id: 'dysphoria',     name: 'Dysphoria',                category: 'Mood & emotional',   inputType: 'scale',   enabled: true,  order: 2  },
  { id: 'euphoria',      name: 'Euphoria',                 category: 'Mood & emotional',   inputType: 'scale',   enabled: true,  order: 3  },
  { id: 'irritability',  name: 'Irritability',             category: 'Mood & emotional',   inputType: 'scale',   enabled: true,  order: 4  },
  { id: 'sensitivity',   name: 'Emotional sensitivity',    category: 'Mood & emotional',   inputType: 'boolean', enabled: true,  order: 5  },
  { id: 'breast-tender', name: 'Breast tenderness',        category: 'Physical',           inputType: 'scale',   enabled: true,  order: 6  },
  { id: 'bloating',      name: 'Bloating',                 category: 'Physical',           inputType: 'boolean', enabled: true,  order: 7  },
  { id: 'fatigue',       name: 'Fatigue',                  category: 'Physical',           inputType: 'scale',   enabled: true,  order: 8  },
  { id: 'headache',      name: 'Headache / migraine',      category: 'Physical',           inputType: 'boolean', enabled: true,  order: 9  },
  { id: 'cramps',        name: 'Cramps / pelvic sensation',category: 'Physical',           inputType: 'boolean', enabled: true,  order: 10 },
  { id: 'hot-flashes',   name: 'Hot flashes',              category: 'Physical',           inputType: 'boolean', enabled: false, order: 11 },
  { id: 'nausea',        name: 'Nausea',                   category: 'Physical',           inputType: 'boolean', enabled: false, order: 12 },
  { id: 'acne',          name: 'Skin / acne',              category: 'Physical',           inputType: 'boolean', enabled: false, order: 13 },
  { id: 'energy',        name: 'Energy level',             category: 'Energy & cognition', inputType: 'scale',   enabled: true,  order: 14 },
  { id: 'brain-fog',     name: 'Brain fog',                category: 'Energy & cognition', inputType: 'boolean', enabled: true,  order: 15 },
  { id: 'sleep',         name: 'Sleep quality',            category: 'Energy & cognition', inputType: 'scale',   enabled: true,  order: 16 },
]

export async function seedSymptomsIfEmpty() {
  const db = await getDB()
  const existing = await db.getAll('symptoms')
  if (existing.length === 0) {
    const tx = db.transaction('symptoms', 'readwrite')
    for (const s of DEFAULT_SYMPTOMS) await tx.store.put(s)
    await tx.done
  }
}

export async function getAllSymptoms() {
  const db = await getDB()
  const all = await db.getAll('symptoms')
  return all.sort((a, b) => a.order - b.order)
}

export async function getEnabledSymptoms() {
  const all = await getAllSymptoms()
  return all.filter(s => s.enabled)
}

export async function saveSymptom(symptom) {
  const db = await getDB()
  await db.put('symptoms', symptom)
}

export async function deleteSymptom(id) {
  const db = await getDB()
  await db.delete('symptoms', id)
}

// ── Settings ──────────────────────────────────────────────────

export async function getSetting(key) {
  const db = await getDB()
  return (await db.get('settings', key)) ?? null
}

export async function setSetting(key, value) {
  const db = await getDB()
  await db.put('settings', value, key)
}

// ── Import / Export ───────────────────────────────────────────

export async function exportData() {
  const [hrtEvents, dailyLogs, symptoms] = await Promise.all([
    getAllHRTEvents(),
    getAllDailyLogs(),
    getAllSymptoms(),
  ])
  return { exportedAt: new Date().toISOString(), version: 1, hrtEvents, dailyLogs, symptoms }
}

export async function importData(data) {
  const db = await getDB()
  if (data.hrtEvents) {
    const tx = db.transaction('hrtEvents', 'readwrite')
    for (const e of data.hrtEvents) await tx.store.put(e)
    await tx.done
  }
  if (data.dailyLogs) {
    const tx = db.transaction('dailyLogs', 'readwrite')
    for (const l of data.dailyLogs) await tx.store.put(l)
    await tx.done
  }
  if (data.symptoms) {
    const tx = db.transaction('symptoms', 'readwrite')
    for (const s of data.symptoms) await tx.store.put(s)
    await tx.done
  }
}

// ── Helpers ───────────────────────────────────────────────────

export function toDateString(date) {
  if (typeof date === 'string') return date.slice(0, 10)
  return date.toISOString().slice(0, 10)
}
