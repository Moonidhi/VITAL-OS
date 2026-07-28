function StatRow({ label, value, unit, color = '#E8EDF4' }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-base-border last:border-0">
      <span className="text-xs text-text-faint">{label}</span>
      <span className="font-mono text-sm font-medium" style={{ color }}>
        {value} <span className="text-text-faint text-[11px]">{unit}</span>
      </span>
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

  const coveragePercent = summary.total_hospital_load_kwh > 0
    ? Math.min(100, ((summary.total_solar_kwh + summary.total_wind_kwh) / summary.total_hospital_load_kwh) * 100)
    : 0

  const uptime = summary.intervals_recorded > 0
    ? (((summary.intervals_recorded - summary.outage_intervals) / summary.intervals_recorded) * 100).toFixed(1)
    : '—'

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

      <StatRow label="Solar generated"        value={summary.total_solar_kwh.toFixed(1)}       unit="kWh"  color="#F5A623" />
      <StatRow label="Wind generated"         value={summary.total_wind_kwh.toFixed(1)}        unit="kWh"  color="#4DD0C4" />
      <StatRow label="Hospital consumed"      value={summary.total_hospital_load_kwh.toFixed(1)} unit="kWh" color="#FF7849" />
      <StatRow label="Renewable coverage"     value={coveragePercent.toFixed(1)}               unit="%"    color="#7C9EFF" />
      <StatRow label="Battery SOC min"        value={summary.battery_soc_min_percent.toFixed(1)} unit="%"  color="#8B95A7" />
      <StatRow label="Battery SOC max"        value={summary.battery_soc_max_percent.toFixed(1)} unit="%"  color="#E8EDF4" />
      <StatRow label="Outage intervals"       value={summary.outage_intervals}                 unit={`/ ${summary.intervals_recorded}`}  color={summary.outage_intervals > 0 ? '#FF5C5C' : '#3DD68C'} />
      <StatRow label="Grid uptime"            value={uptime}                                   unit="%"    color="#3DD68C" />
    </div>
  )
}
