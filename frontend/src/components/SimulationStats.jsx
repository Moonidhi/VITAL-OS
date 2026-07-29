import React from 'react'

const THRESHOLDS = {
  'Renewable coverage': { good: 70, warn: 30 },
  'Grid uptime': { good: 99, warn: 95 },
  'Battery SOC min': { good: 40, warn: 20 },
  'Battery SOC max': { good: 80, warn: 50 },
  'Outage intervals': { good: 0, warn: 2, invert: true },
}

function getThresholdColor(label, numValue) {
  const cfg = THRESHOLDS[label]
  if (!cfg || typeof numValue !== 'number' || isNaN(numValue)) return null

  if (cfg.invert) {
    if (numValue <= cfg.good) return { color: '#3DD68C', state: 'good' }
    if (numValue <= cfg.warn) return { color: '#F5A623', state: 'warn' }
    return { color: '#FF5C5C', state: 'critical' }
  } else {
    if (numValue >= cfg.good) return { color: '#3DD68C', state: 'good' }
    if (numValue >= cfg.warn) return { color: '#F5A623', state: 'warn' }
    return { color: '#FF5C5C', state: 'critical' }
  }
}

function StatRow({ label, value, unit, color = '#E8EDF4', numValue }) {
  const threshold = getThresholdColor(label, numValue)
  const displayColor = threshold ? threshold.color : color

  let bgTint = ''
  if (threshold?.state === 'warn') bgTint = 'bg-[#F5A6230D]'
  if (threshold?.state === 'critical') bgTint = 'bg-[#FF5C5C0D]'

  return (
    <div className={`flex items-center justify-between py-2 px-2 rounded border-b border-base-border last:border-0 transition-colors ${bgTint}`}>
      <span className="text-xs text-text-faint">{label}</span>
      <div className="flex items-center gap-1.5 font-mono text-sm font-medium">
        {threshold && (
          <span
            className="w-1.5 h-1.5 rounded-sm inline-block shrink-0"
            style={{ backgroundColor: displayColor }}
          />
        )}
        <span style={{ color: displayColor }}>
          {value} <span className="text-text-faint text-[11px]">{unit}</span>
        </span>
      </div>
    </div>
  )
}

export default function SimulationStats({ summary, intervalsRun = 0 }) {
  if (!summary) {
    return (
      <div className="bg-base-surface rounded-xl border border-base-border shadow-card p-4">
        <p className="text-xs text-text-faint">
          Run the simulation to see statistics.
        </p>
      </div>
    )
  }

  const coveragePercent =
    summary.total_hospital_load_kwh > 0
      ? Math.min(
          100,
          ((summary.total_solar_kwh + summary.total_wind_kwh) / summary.total_hospital_load_kwh) * 100
        )
      : 0

  const uptimeVal =
    summary.intervals_recorded > 0
      ? ((summary.intervals_recorded - summary.outage_intervals) / summary.intervals_recorded) * 100
      : null

  const uptimeStr = uptimeVal !== null ? uptimeVal.toFixed(1) : '—'

  return (
    <div className="bg-base-surface rounded-xl border border-base-border shadow-card p-4 flex flex-col gap-1">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-text-muted uppercase tracking-wider">
          Simulation Stats
        </span>
        <span className="text-[10px] font-mono text-text-faint bg-base-elevated px-2 py-0.5 rounded-full">
          {summary.intervals_recorded} intervals
        </span>
      </div>

      <StatRow label="Solar generated" value={summary.total_solar_kwh.toFixed(1)} unit="kWh" color="#F5A623" />
      <StatRow label="Wind generated" value={summary.total_wind_kwh.toFixed(1)} unit="kWh" color="#4DD0C4" />
      <StatRow label="Hospital consumed" value={summary.total_hospital_load_kwh.toFixed(1)} unit="kWh" color="#FF7849" />
      <StatRow label="Renewable coverage" value={coveragePercent.toFixed(1)} unit="%" numValue={coveragePercent} />
      <StatRow label="Battery SOC min" value={summary.battery_soc_min_percent.toFixed(1)} unit="%" numValue={summary.battery_soc_min_percent} />
      <StatRow label="Battery SOC max" value={summary.battery_soc_max_percent.toFixed(1)} unit="%" numValue={summary.battery_soc_max_percent} />
      <StatRow label="Outage intervals" value={summary.outage_intervals} unit={`/ ${summary.intervals_recorded}`} numValue={summary.outage_intervals} />
      <StatRow label="Grid uptime" value={uptimeStr} unit="%" numValue={uptimeVal} />
    </div>
  )
}
