import React from 'react'

const NODE_STYLE = {
  solar: { color: '#F5A623', label: 'Solar', bg: '#F5A62318' },
  wind: { color: '#4DD0C4', label: 'Wind', bg: '#4DD0C418' },
  battery: { color: '#7C9EFF', label: 'Battery', bg: '#7C9EFF18' },
  grid: { color: '#3DD68C', label: 'Grid', bg: '#3DD68C18' },
  hospital: { color: '#E8EDF4', label: 'Hospital', bg: '#E8EDF408' },
}

function getBatteryColor(soc) {
  if (soc >= 60) return '#7C9EFF'
  if (soc >= 30) return '#F5A623'
  return '#FF5C5C'
}

function Node({ x, y, type, value, unit = 'kW', r = 38, isOutage = false, soc = 80 }) {
  let s = { ...NODE_STYLE[type] }

  if (type === 'grid' && isOutage) {
    s.color = '#FF5C5C'
    s.bg = '#FF5C5C18'
    s.label = 'Grid (OUTAGE)'
  }

  if (type === 'battery') {
    const batColor = getBatteryColor(soc)
    s.color = batColor
    s.bg = `${batColor}18`
  }

  const isActive = typeof value === 'number' ? value > 0 : true

  return (
    <g transform={`translate(${x}, ${y})`}>
      {/* Outer pulsing ring for active nodes */}
      {isActive && (
        <circle
          cx="0"
          cy="0"
          r={r + 12}
          fill="none"
          stroke={s.color}
          strokeWidth="1.5"
          opacity="0.3"
          className="animate-pulsedot"
        />
      )}
      <circle cx="0" cy="0" r={r + 6} fill={s.bg} />
      <circle
        cx="0"
        cy="0"
        r={r}
        fill="#131922"
        stroke={s.color}
        strokeWidth="1.8"
        style={{ filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.4))' }}
      />
      <text
        x="0"
        y="-6"
        textAnchor="middle"
        fontSize="9"
        fill={s.color}
        fontFamily="Inter, sans-serif"
        fontWeight="600"
        letterSpacing="0.05em"
      >
        {s.label.toUpperCase()}
      </text>
      <text
        x="0"
        y="8"
        textAnchor="middle"
        fontSize="13"
        fill="#E8EDF4"
        fontFamily="JetBrains Mono, monospace"
        fontWeight="600"
      >
        {typeof value === 'number' ? value.toFixed(1) : value}
      </text>
      <text x="0" y="19" textAnchor="middle" fontSize="8" fill="#8B95A7" fontFamily="Inter, sans-serif">
        {unit}
      </text>
    </g>
  )
}

function AnimatedFlow({ d, color, power = 0, reverse = false, delay = '0s' }) {
  const active = power > 0
  const strokeWidth = active ? Math.min(4, 1.5 + power / 80) : 2
  const speed = active ? Math.max(0.4, 2 - power / 80) : null

  return (
    <>
      {/* Base path */}
      <path d={d} fill="none" stroke="#252E3D" strokeWidth={strokeWidth} />
      {/* Animated flow dashes */}
      {active && (
        <path
          d={d}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth + 0.5}
          strokeDasharray="10 10"
          strokeLinecap="round"
          opacity="0.85"
          style={{
            animation: `dashflow ${speed}s linear infinite ${delay}`,
            animationDirection: reverse ? 'reverse' : 'normal',
          }}
        />
      )}
      {/* Glow pulse */}
      {active && (
        <path
          d={d}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth + 4}
          opacity="0.12"
          strokeDasharray="4 30"
          style={{
            animation: `dashflow ${speed}s linear infinite ${delay}`,
            animationDirection: reverse ? 'reverse' : 'normal',
          }}
        />
      )}
    </>
  )
}

export default function EnergyFlowDiagram({ snapshot }) {
  if (!snapshot) {
    return (
      <div className="flex items-center justify-center h-full text-text-faint text-sm">
        Waiting for simulation data…
      </div>
    )
  }

  const solar = snapshot.solar_kw ?? 0
  const wind = snapshot.wind_kw ?? 0
  const total = snapshot.total_generation_kw ?? 0
  const load = snapshot.total_load_kw ?? 0
  const soc = snapshot.battery_soc_percent ?? 0
  const bPower = snapshot.battery_power_kw ?? 0
  const bAction = snapshot.battery_action ?? 'idle'
  const gridImp = snapshot.grid_import_kw ?? 0
  const gridExp = snapshot.grid_export_kw ?? 0
  const isOutage = snapshot.grid_status === 'OUTAGE'

  return (
    <div className="w-full h-full">
      <svg viewBox="0 0 540 230" className="w-full h-full" aria-label="Live energy flow diagram" role="img">
        {/* === FLOW LINES === */}
        {/* Solar → Battery */}
        <AnimatedFlow d="M 126 68 C 190 68 200 110 234 110" color="#F5A623" power={solar} delay="0s" />

        {/* Wind → Battery */}
        <AnimatedFlow d="M 126 160 C 190 160 200 110 234 110" color="#4DD0C4" power={wind} delay="0.3s" />

        {/* Battery → Hospital */}
        <AnimatedFlow
          d="M 306 110 L 404 110"
          color={getBatteryColor(soc)}
          power={bAction === 'discharging' ? bPower : total > 0 ? total : 0}
          delay="0.15s"
        />

        {/* Grid → Hospital (import) */}
        <AnimatedFlow
          d="M 270 179 C 270 155 360 140 404 115"
          color={isOutage ? '#FF5C5C' : '#3DD68C'}
          power={gridImp}
          reverse={isOutage}
          delay="0.5s"
        />

        {/* Battery → Grid (export) */}
        <AnimatedFlow
          d="M 290 125 C 290 175 275 179 275 179"
          color="#3DD68C"
          power={gridExp}
          delay="0s"
          reverse
        />

        {/* === NODES === */}
        <Node x={90} y={68} type="solar" value={solar} r={38} />
        <Node x={90} y={160} type="wind" value={wind} r={38} />
        <Node x={270} y={110} type="battery" value={soc} unit="% SOC" r={42} soc={soc} />
        <Node x={270} y={196} type="grid" value={gridImp > 0 ? gridImp : gridExp} unit="kW" r={32} isOutage={isOutage} />
        <Node x={440} y={110} type="hospital" value={load} r={42} />

        {/* Outage Label overlay */}
        {isOutage && (
          <text x="270" y="152" textAnchor="middle" fontSize="9" fill="#FF5C5C" fontFamily="Inter, sans-serif" fontWeight="bold" className="animate-pulse">
            OUTAGE
          </text>
        )}

        {/* Battery action label */}
        <text x="270" y="60" textAnchor="middle" fontSize="8" fill={getBatteryColor(soc)} fontFamily="Inter, sans-serif" opacity="0.9" fontWeight="600">
          {bAction.toUpperCase()}
        </text>
      </svg>
    </div>
  )
}
