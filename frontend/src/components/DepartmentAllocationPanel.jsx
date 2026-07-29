import React from 'react'

const DEPARTMENTS = [
  { key: 'load_ICU', label: 'ICU', tier: 'Critical', color: '#FF7849' },
  { key: 'load_Operation_Theatre', label: 'Operation Theatre', tier: 'Critical', color: '#FF5C5C' },
  { key: 'load_Emergency_Department', label: 'Emergency Dept', tier: 'Critical', color: '#F5A623' },
  { key: 'load_Oxygen_Plant', label: 'Oxygen Plant', tier: 'High', color: '#4DD0C4' },
  { key: 'load_General_Ward', label: 'General Ward', tier: 'Medium', color: '#7C9EFF' },
  { key: 'load_HVAC', label: 'HVAC', tier: 'Low', color: '#8B95A7' },
  { key: 'load_Lighting', label: 'Lighting', tier: 'Low', color: '#5A6478' },
]

const ALLOCATION = {
  Critical: {
    LOW: { powerPercent: 100, status: 'Protected' },
    MEDIUM: { powerPercent: 100, status: 'Protected' },
    HIGH: { powerPercent: 100, status: 'Protected' },
  },
  High: {
    LOW: { powerPercent: 100, status: 'Protected' },
    MEDIUM: { powerPercent: 100, status: 'Protected' },
    HIGH: { powerPercent: 100, status: 'Protected' },
  },
  Medium: {
    LOW: { powerPercent: 100, status: 'Protected' },
    MEDIUM: { powerPercent: 80, status: 'Reduced' },
    HIGH: { powerPercent: 60, status: 'Reduced' },
  },
  Low: {
    LOW: { powerPercent: 100, status: 'Protected' },
    MEDIUM: { powerPercent: 50, status: 'Limited' },
    HIGH: { powerPercent: 0, status: 'Shed' },
  },
}

const STATUS_STYLE = {
  Protected: { color: '#3DD68C', bg: '#3DD68C12', border: '#3DD68C30' },
  Reduced: { color: '#F5A623', bg: '#F5A62312', border: '#F5A62330' },
  Limited: { color: '#FF7849', bg: '#FF784912', border: '#FF784930' },
  Shed: { color: '#FF5C5C', bg: '#FF5C5C12', border: '#FF5C5C30' },
}

const TIER_STYLE = {
  Critical: '#FF5C5C',
  High: '#F5A623',
  Medium: '#7C9EFF',
  Low: '#5A6478',
}

function ShieldIcon({ color }) {
  return (
    <svg viewBox="0 0 16 16" fill="none" className="w-3.5 h-3.5 shrink-0">
      <path
        d="M8 1.5 L14 4 V8 C14 11.5 8 14.5 8 14.5 C8 14.5 2 11.5 2 8 V4 L8 1.5Z"
        stroke={color}
        strokeWidth="1.3"
        strokeLinejoin="round"
        fill={`${color}20`}
      />
    </svg>
  )
}

function DepartmentCard({ dept, currentKw, riskLevel }) {
  const allocation = ALLOCATION[dept.tier]?.[riskLevel] ?? { powerPercent: 100, status: 'Protected' }
  const { powerPercent, status } = allocation

  const allocatedKw = currentKw * (powerPercent / 100)
  const statusStyle = STATUS_STYLE[status] ?? STATUS_STYLE.Protected
  const tierColor = TIER_STYLE[dept.tier] ?? '#8B95A7'
  const barFill = powerPercent

  const isShed = status === 'Shed' || powerPercent === 0

  return (
    <div
      className={`bg-base-elevated rounded-xl border p-3.5 flex flex-col gap-2.5 transition-all duration-300 hover:shadow-lg ${
        isShed ? 'border-[#FF5C5C40]' : 'border-base-border hover:border-battery/40'
      } relative overflow-hidden`}
      style={
        isShed
          ? {
              backgroundImage:
                'repeating-linear-gradient(45deg, transparent, transparent 4px, rgba(255,92,92,0.04) 4px, rgba(255,92,92,0.04) 8px)',
            }
          : {}
      }
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="w-2 h-2 rounded-full shrink-0" style={{ background: dept.color }} />
          <span className="text-sm font-medium text-text-primary truncate">{dept.label}</span>
        </div>

        <span
          className="text-[10px] font-semibold font-mono px-2 py-0.5 rounded-full border shrink-0"
          style={{ color: statusStyle.color, background: statusStyle.bg, borderColor: statusStyle.border }}
        >
          {status}
        </span>
      </div>

      {/* Power bar */}
      <div className="space-y-1">
        <div className="h-1.5 bg-base-border rounded-full overflow-hidden">
          <div
            className="h-full rounded-full"
            style={{
              width: `${barFill}%`,
              background: powerPercent === 0 ? '#FF5C5C' : dept.color,
              transition: 'width 0.7s cubic-bezier(0.4, 0, 0.2, 1)',
            }}
          />
        </div>
      </div>

      {/* Metrics row */}
      <div className="grid grid-cols-3 gap-1 pt-0.5">
        <div className="flex flex-col gap-0.5">
          <span className="text-[9px] uppercase tracking-wide text-text-faint">Priority</span>
          <span className="text-[11px] font-medium" style={{ color: tierColor }}>
            {dept.tier}
          </span>
        </div>

        <div
          className="flex flex-col gap-0.5 cursor-help"
          title={`Powered by: ${status === 'Protected' ? 'Grid + Battery' : 'Allocated Microgrid'}\nEst. power this interval: ${allocatedKw.toFixed(1)} kW`}
        >
          <span className="text-[9px] uppercase tracking-wide text-text-faint">Allocation</span>
          <span className="text-[11px] font-mono font-semibold" style={{ color: statusStyle.color }}>
            {powerPercent}%
          </span>
        </div>

        <div className="flex flex-col gap-0.5">
          <span className="text-[9px] uppercase tracking-wide text-text-faint">Power</span>
          <span className="text-[11px] font-mono text-text-primary">
            {allocatedKw.toFixed(1)} <span className="text-text-faint text-[9px]">kW</span>
          </span>
        </div>
      </div>
    </div>
  )
}

const RISK_BANNER = {
  LOW: { label: 'LOW RISK — All departments fully powered', color: '#3DD68C', bg: '#3DD68C0D' },
  MEDIUM: { label: 'MEDIUM RISK — Low-priority loads reducing', color: '#F5A623', bg: '#F5A6230D' },
  HIGH: { label: 'HIGH RISK — Non-critical departments shedding load', color: '#FF5C5C', bg: '#FF5C5C0D' },
}

export default function DepartmentAllocationPanel({ snapshot, prediction }) {
  if (!snapshot) return null

  const riskLevel = prediction?.risk_level ?? 'LOW'
  const banner = RISK_BANNER[riskLevel] ?? RISK_BANNER.LOW

  let totalCurrentKw = 0
  let totalAllocatedKw = 0

  DEPARTMENTS.forEach((dept) => {
    const currentKw = snapshot[dept.key] ?? 0
    const { powerPercent } = ALLOCATION[dept.tier]?.[riskLevel] ?? { powerPercent: 100 }
    totalCurrentKw += currentKw
    totalAllocatedKw += currentKw * (powerPercent / 100)
  })

  const shedKw = totalCurrentKw - totalAllocatedKw
  const shedDepts = DEPARTMENTS.filter((d) => {
    const { powerPercent } = ALLOCATION[d.tier]?.[riskLevel] ?? { powerPercent: 100 }
    return powerPercent === 0
  }).length

  return (
    <div className="bg-base-surface rounded-xl border border-base-border shadow-card p-4">
      {/* Panel header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2.5">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
            style={{ background: `${banner.color}18`, border: `1px solid ${banner.color}30` }}
          >
            <ShieldIcon color={banner.color} />
          </div>
          <div className="leading-tight">
            <p className="text-xs font-medium text-text-muted uppercase tracking-wider">
              AI Power Allocation
            </p>
            <p className="text-[10px] text-text-faint mt-0.5">Department-level load management</p>
          </div>
        </div>

        {prediction && (
          <span
            className="text-[10px] font-semibold font-mono px-2.5 py-1 rounded-full border"
            style={{ color: banner.color, background: banner.bg, borderColor: `${banner.color}40` }}
          >
            {riskLevel} RISK
          </span>
        )}
      </div>

      {/* Strategy banner with pulsing dot */}
      <div
        className="rounded-lg px-3 py-2 mb-4 text-[11px] font-medium flex items-center justify-between"
        style={{ background: banner.bg, color: banner.color }}
      >
        <span>{banner.label}</span>
        <span className="w-2 h-2 rounded-full animate-pulsedot" style={{ backgroundColor: banner.color }} />
      </div>

      {/* Department cards grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {DEPARTMENTS.map((dept) => (
          <DepartmentCard
            key={dept.key}
            dept={dept}
            currentKw={snapshot[dept.key] ?? 0}
            riskLevel={riskLevel}
          />
        ))}
      </div>

      {/* Summary footer */}
      <div className="mt-4 pt-3 border-t border-base-border grid grid-cols-3 gap-4">
        <div className="flex flex-col gap-0.5">
          <span className="text-[10px] uppercase tracking-wider text-text-faint">Total Load</span>
          <span className="font-mono text-sm text-text-primary">
            {totalCurrentKw.toFixed(1)} <span className="text-text-faint text-xs">kW</span>
          </span>
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-[10px] uppercase tracking-wider text-text-faint">Allocated</span>
          <span className="font-mono text-sm text-gridok">
            {totalAllocatedKw.toFixed(1)} <span className="text-text-faint text-xs">kW</span>
          </span>
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-[10px] uppercase tracking-wider text-text-faint">
            {shedDepts > 0 ? `Shed (${shedDepts} dept${shedDepts > 1 ? 's' : ''})` : 'Shed'}
          </span>
          <span className="font-mono text-sm" style={{ color: shedKw > 0 ? '#FF5C5C' : '#3DD68C' }}>
            {shedKw.toFixed(1)} <span className="text-text-faint text-xs">kW</span>
          </span>
        </div>
      </div>
    </div>
  )
}
