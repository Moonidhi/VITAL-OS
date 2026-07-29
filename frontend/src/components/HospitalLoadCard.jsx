import React, { useRef } from 'react'

const DEPT_CONFIG = {
  load_ICU: { label: 'ICU', color: '#FF7849', priority: 1 },
  load_Operation_Theatre: { label: 'Operation Theatre', color: '#FF5C5C', priority: 2 },
  load_Emergency_Department: { label: 'Emergency Dept', color: '#F5A623', priority: 3 },
  load_Oxygen_Plant: { label: 'Oxygen Plant', color: '#4DD0C4', priority: 4 },
  load_General_Ward: { label: 'General Ward', color: '#7C9EFF', priority: 5 },
  load_HVAC: { label: 'HVAC', color: '#8B95A7', priority: 6 },
  load_Lighting: { label: 'Lighting', color: '#5A6478', priority: 7 },
}

function DeptBar({ label, value, color, maxValue, prevValue }) {
  const pct = maxValue > 0 ? Math.min(100, (value / maxValue) * 100) : 0

  let trend = '—'
  let trendColor = '#8B95A7'
  if (prevValue !== undefined) {
    if (value > prevValue + 0.2) {
      trend = '▲'
      trendColor = '#FF5C5C'
    } else if (value < prevValue - 0.2) {
      trend = '▼'
      trendColor = '#3DD68C'
    }
  }

  return (
    <div className="flex items-center gap-2.5 group">
      <div className="flex items-center justify-end gap-1 w-28 shrink-0">
        <span className="text-[10px] font-mono shrink-0" style={{ color: trendColor }}>
          {trend}
        </span>
        <span className="text-[11px] text-text-faint truncate group-hover:text-text-muted transition-colors">
          {label}
        </span>
      </div>

      <div className="flex-1 h-2.5 bg-base-border rounded-full overflow-hidden relative">
        <div
          className="h-full rounded-full transition-all duration-700 ease-smooth flex items-center justify-end pr-0.5"
          style={{
            width: `${pct}%`,
            background: `linear-gradient(90deg, ${color}, ${color}CC)`,
          }}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-white opacity-80" />
        </div>
      </div>

      <span className="text-[11px] font-mono text-text-muted w-14 shrink-0 font-medium">
        {value.toFixed(1)} kW
      </span>
    </div>
  )
}

export default function HospitalLoadCard({ snapshot }) {
  const prevSnapshotRef = useRef({})

  if (!snapshot) return null

  const prevSnap = prevSnapshotRef.current

  const depts = Object.entries(DEPT_CONFIG)
    .map(([key, cfg]) => ({
      ...cfg,
      key,
      value: snapshot[key] ?? 0,
      prevValue: prevSnap[key],
    }))
    .sort((a, b) => a.priority - b.priority)

  // Save current values to ref
  prevSnapshotRef.current = snapshot

  const maxVal = Math.max(...depts.map((d) => d.value), 1)
  const total = snapshot.total_load_kw ?? 0

  return (
    <div className="bg-base-surface rounded-xl border border-base-border shadow-card p-4 flex flex-col gap-3 h-full">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-text-muted uppercase tracking-wider">
          Hospital Load
        </span>
        <div className="flex items-baseline gap-1">
          <span className="font-mono font-semibold text-lg text-critical">{total.toFixed(1)}</span>
          <span className="text-xs text-text-faint">kW total</span>
        </div>
      </div>

      <div className="flex flex-col gap-2.5 flex-1 justify-center">
        {depts.map((d) => (
          <DeptBar
            key={d.label}
            label={d.label}
            value={d.value}
            color={d.color}
            maxValue={maxVal}
            prevValue={d.prevValue}
          />
        ))}
      </div>
    </div>
  )
}
