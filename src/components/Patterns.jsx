import { useState, useEffect } from 'react'
import { subDays, format, eachDayOfInterval } from 'date-fns'
import {
  ResponsiveContainer, ComposedChart, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, ReferenceLine, Legend,
} from 'recharts'
import { getHRTEventsBetween, getDailyLogsBetween, getEnabledSymptoms } from '../db/db'

// A palette of warm colours for the symptom lines
const COLORS = [
  '#e8827a', '#f0a96b', '#c9a8e0', '#7ec8c8', '#f2c97d',
  '#e07ab0', '#82b8e8', '#a8e0a0', '#e8c07a', '#b07ae0',
]

const RANGES = [
  { label: '30 days', days: 30 },
  { label: '60 days', days: 60 },
  { label: '90 days', days: 90 },
]

// Custom tooltip for the chart
function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="chart-tooltip">
      <div className="chart-tooltip-date">{label}</div>
      {payload.map(p => (
        <div key={p.dataKey} className="chart-tooltip-row" style={{ color: p.color }}>
          <span>{p.name}</span>
          <span>{p.value}</span>
        </div>
      ))}
    </div>
  )
}

export default function Patterns() {
  const [rangeDays, setRangeDays]         = useState(60)
  const [allSymptoms, setAllSymptoms]     = useState([])
  const [visibleIds, setVisibleIds]       = useState([])
  const [chartData, setChartData]         = useState([])
  const [hrtDates, setHrtDates]           = useState([])
  const [loading, setLoading]             = useState(true)

  useEffect(() => {
    loadData()
  }, [rangeDays])

  async function loadData() {
    setLoading(true)
    const end   = new Date()
    const start = subDays(end, rangeDays - 1)
    const startStr = format(start, 'yyyy-MM-dd')
    const endStr   = format(end,   'yyyy-MM-dd')

    const [syms, logs, hrt] = await Promise.all([
      getEnabledSymptoms(),
      getDailyLogsBetween(startStr, endStr),
      getHRTEventsBetween(startStr, endStr),
    ])

    setAllSymptoms(syms)

    // On first load, default to showing scale symptoms (more interesting on a chart)
    if (visibleIds.length === 0) {
      setVisibleIds(syms.filter(s => s.inputType === 'scale').map(s => s.id))
    }

    // Build a map of date → log for quick lookup
    const logMap = {}
    for (const log of logs) logMap[log.date] = log

    // Build chart data: one object per day
    const days = eachDayOfInterval({ start, end })
    const data = days.map(day => {
      const dateStr = format(day, 'yyyy-MM-dd')
      const log     = logMap[dateStr]
      const entry   = { date: format(day, 'dd MMM') }
      for (const sym of syms) {
        const val = log?.symptoms?.[sym.id]
        if (val === null || val === undefined) {
          entry[sym.id] = null
        } else if (typeof val === 'boolean' || val === true) {
          entry[sym.id] = 1 // boolean symptoms show as 1 when active
        } else {
          entry[sym.id] = val
        }
      }
      return entry
    })

    // HRT dates as the short date format used in chart data
    const hrtDateSet = new Set(
      hrt.map(e => format(new Date(e.date + 'T00:00:00'), 'dd MMM'))
    )

    setChartData(data)
    setHrtDates([...hrtDateSet])
    setLoading(false)
  }

  function toggleSymptom(id) {
    setVisibleIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    )
  }

  const hasData = chartData.some(d =>
    allSymptoms.some(s => d[s.id] !== null && d[s.id] !== undefined)
  )

  if (loading) {
    return <div className="loading-screen"><div className="loading-dot" /></div>
  }

  return (
    <div className="patterns-screen">
      {/* Range selector */}
      <div className="range-tabs">
        {RANGES.map(r => (
          <button
            key={r.days}
            className={`range-tab${rangeDays === r.days ? ' range-tab--active' : ''}`}
            onClick={() => setRangeDays(r.days)}
          >
            {r.label}
          </button>
        ))}
      </div>

      {/* Symptom toggles */}
      <div className="sym-toggles">
        {allSymptoms.map((s, i) => (
          <button
            key={s.id}
            className={`sym-toggle${visibleIds.includes(s.id) ? ' sym-toggle--active' : ''}`}
            style={visibleIds.includes(s.id) ? { borderColor: COLORS[i % COLORS.length], color: COLORS[i % COLORS.length] } : {}}
            onClick={() => toggleSymptom(s.id)}
          >
            {s.name}
          </button>
        ))}
      </div>

      {/* Chart or empty state */}
      {!hasData ? (
        <div className="empty-state">
          <div className="empty-state-icon">📊</div>
          <p>No data yet for this period.</p>
          <p className="text-muted text-sm">Start logging on the Today screen and your patterns will appear here.</p>
        </div>
      ) : visibleIds.length === 0 ? (
        <div className="empty-state">
          <p className="text-muted">Select symptoms above to see them on the chart.</p>
        </div>
      ) : (
        <div className="chart-wrapper">
          <ResponsiveContainer width="100%" height={320}>
            <ComposedChart data={chartData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2e2850" vertical={false} />
              <XAxis
                dataKey="date"
                tick={{ fill: '#6b6285', fontSize: 10 }}
                tickLine={false}
                axisLine={{ stroke: '#2e2850' }}
                interval={Math.floor(chartData.length / 6)}
              />
              <YAxis
                domain={[0, 5]}
                ticks={[1, 2, 3, 4, 5]}
                tick={{ fill: '#6b6285', fontSize: 10 }}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip content={<CustomTooltip />} />

              {/* Amber vertical lines for HRT events */}
              {hrtDates.map(d => (
                <ReferenceLine
                  key={d}
                  x={d}
                  stroke="#f0a96b"
                  strokeWidth={1.5}
                  strokeDasharray="4 3"
                  label={false}
                />
              ))}

              {/* One line per visible symptom */}
              {visibleIds.map((id, i) => (
                <Line
                  key={id}
                  type="monotone"
                  dataKey={id}
                  name={allSymptoms.find(s => s.id === id)?.name ?? id}
                  stroke={COLORS[allSymptoms.findIndex(s => s.id === id) % COLORS.length]}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4 }}
                  connectNulls={false}
                />
              ))}
            </ComposedChart>
          </ResponsiveContainer>

          {/* HRT legend note */}
          <div className="chart-hrt-note">
            <span className="chart-hrt-line" /> HRT intake
          </div>
        </div>
      )}
    </div>
  )
}
