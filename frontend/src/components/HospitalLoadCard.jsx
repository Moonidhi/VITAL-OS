const DEPT_CONFIG = {
  load_ICU:                   { label: 'ICU',           color: '#FF7849', priority: 1 },
  load_Operation_Theatre:     { label: 'Operation Theatre', color: '#FF5C5C', priority: 2 },
  load_Emergency_Department:  { label: 'Emergency Dept', color: '#F5A623', priority: 3 },
  load_Oxygen_Plant:          { label: 'Oxygen Plant',  color: '#4DD0C4', priority: 4 },
  load_General_Ward:          { label: 'General Ward',  color: '#7C9EFF', priority: 5 },
  load_HVAC:                  { label: 'HVAC',          color: '#8B95A7', priority: 6 },
  load_Lighting:              { label: 'Lighting',      color: '#5A6478', priority: 7 },
}

function DeptBar({ label, value, color, maxValue }) {
  const pct = maxValue > 0 ? Math.min(100, (value / maxValue) * 100) : 0
  return (
    <div className="flex items-center gap-2.5 group">
      <span className="text-[11px] text-text-faint w-28 shrink-0 text-right group-hover:text-text-muted transition-colors">
        {label}
      </span>
      <div className="flex-1 h-2 bg-base-border rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
      <span className="text-[11px] font-mono text-text-muted w-14 shrink-0">
        {value.toFixed(1)} kW
      </span>
    </div>
  )
}

export default function HospitalLoadCard({ snapshot }) {
  if (!snapshot) return null

  const depts = Object.entries(DEPT_CONFIG)
    .map(([key, cfg]) => ({ ...cfg, value: snapshot[key] ?? 0 }))
    .sort((a, b) => a.priority - b.priority)

  const maxVal = Math.max(...depts.map(d => d.value), 1)
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
        {depts.map(d => (
          <DeptBar
            key={d.label}
            label={d.label}
            value={d.value}
            color={d.color}
            maxValue={maxVal}
          />
        ))}
      </div>
    </div>
  )
}
