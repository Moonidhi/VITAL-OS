/**
 * EnergyFlowDiagram — VITAL-OS signature visual element.
 *
 * Shows power flowing: Solar ─┐
 *                             ├─► Battery ─► Hospital
 *                   Wind ─────┘        Grid ─►
 *
 * Animated dashed lines whose direction and speed respond to live data.
 * Lines from dark sources animate rightward; during grid export they
 * reverse. Everything is SVG + CSS animations, no canvas, no lib.
 */

const NODE_STYLE = {
  solar:    { color: '#F5A623', label: 'Solar',    bg: '#F5A62318' },
  wind:     { color: '#4DD0C4', label: 'Wind',     bg: '#4DD0C418' },
  battery:  { color: '#7C9EFF', label: 'Battery',  bg: '#7C9EFF18' },
  grid:     { color: '#3DD68C', label: 'Grid',     bg: '#3DD68C18' },
  hospital: { color: '#E8EDF4', label: 'Hospital', bg: '#E8EDF408' },
}

function Node({ x, y, type, value, unit = 'kW', r = 34 }) {
  const s = NODE_STYLE[type]
  return (
    <g transform={`translate(${x}, ${y})`}>
      <circle cx="0" cy="0" r={r + 8} fill={s.bg} />
      <circle cx="0" cy="0" r={r} fill="#131922" stroke={s.color} strokeWidth="1.5" />
      <text x="0" y="-6" textAnchor="middle" fontSize="9" fill={s.color} fontFamily="Inter, sans-serif" fontWeight="600" letterSpacing="0.05em">
        {s.label.toUpperCase()}
      </text>
      <text x="0" y="8" textAnchor="middle" fontSize="13" fill="#E8EDF4" fontFamily="JetBrains Mono, monospace" fontWeight="600">
        {typeof value === 'number' ? value.toFixed(1) : value}
      </text>
      <text x="0" y="19" textAnchor="middle" fontSize="8" fill="#8B95A7" fontFamily="Inter, sans-serif">
        {unit}
      </text>
    </g>
  )
}

/**
 * AnimatedFlow — draws a path with flowing dashes.
 * power > 0 means energy flows along the path forward.
 * power === 0 means no flow (faint static line shown).
 */
function AnimatedFlow({ d, color, power = 0, reverse = false, delay = '0s' }) {
  const active = power > 0
  const speed = active ? Math.max(0.4, 2 - power / 80) : null // faster line = more power

  return (
    <>
      {/* Base path — always visible, dim */}
      <path d={d} fill="none" stroke="#252E3D" strokeWidth="2" />
      {/* Animated flow dashes */}
      {active && (
        <path
          d={d}
          fill="none"
          stroke={color}
          strokeWidth="2.5"
          strokeDasharray="10 10"
          strokeLinecap="round"
          opacity="0.85"
          style={{
            animation: `dashflow ${speed}s linear infinite ${delay}`,
            animationDirection: reverse ? 'reverse' : 'normal',
          }}
        />
      )}
      {/* Glow pulse at path end for active flows */}
      {active && (
        <path
          d={d}
          fill="none"
          stroke={color}
          strokeWidth="6"
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

  const solar    = snapshot.solar_kw ?? 0
  const wind     = snapshot.wind_kw ?? 0
  const total    = snapshot.total_generation_kw ?? 0
  const load     = snapshot.total_load_kw ?? 0
  const soc      = snapshot.battery_soc_percent ?? 0
  const bPower   = snapshot.battery_power_kw ?? 0
  const bAction  = snapshot.battery_action ?? 'idle'
  const gridImp  = snapshot.grid_import_kw ?? 0
  const gridExp  = snapshot.grid_export_kw ?? 0

  // SVG coordinate layout (viewBox="0 0 540 220")
  // Solar  (90, 60)  ─┐
  // Wind   (90,160)  ─┼─► Battery (270, 110) ─► Hospital (440, 110)
  //                    │
  //            Grid (270, 195) ────────────────►

  return (
    <div className="w-full h-full">
      <style>{`
        @keyframes dashflow {
          to { stroke-dashoffset: -40; }
        }
        @keyframes pulsedot {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.35; }
        }
      `}</style>

      <svg
        viewBox="0 0 540 230"
        className="w-full h-full"
        aria-label="Live energy flow diagram"
        role="img"
      >
        {/* === FLOW LINES === */}

        {/* Solar → Battery */}
        <AnimatedFlow
          d="M 126 68 C 190 68 200 110 234 110"
          color="#F5A623"
          power={solar}
          delay="0s"
        />

        {/* Wind → Battery */}
        <AnimatedFlow
          d="M 126 160 C 190 160 200 110 234 110"
          color="#4DD0C4"
          power={wind}
          delay="0.3s"
        />

        {/* Battery → Hospital */}
        <AnimatedFlow
          d="M 306 110 L 404 110"
          color="#7C9EFF"
          power={bAction === 'discharging' ? bPower : total > 0 ? total : 0}
          delay="0.15s"
        />

        {/* Grid → Hospital (import) */}
        <AnimatedFlow
          d="M 270 179 C 270 155 360 140 404 115"
          color="#3DD68C"
          power={gridImp}
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
        <Node x={90}  y={68}  type="solar"    value={solar}  />
        <Node x={90}  y={160} type="wind"     value={wind}   />
        <Node x={270} y={110} type="battery"  value={soc}    unit="% SOC" r={38} />
        <Node x={270} y={196} type="grid"     value={gridImp > 0 ? gridImp : gridExp} unit="kW" r={28} />
        <Node x={440} y={110} type="hospital" value={load}   r={38} />

        {/* Battery action label */}
        <text x="270" y="75" textAnchor="middle" fontSize="8" fill="#7C9EFF" fontFamily="Inter, sans-serif" opacity="0.8">
          {bAction.toUpperCase()}
        </text>
      </svg>
    </div>
  )
}
