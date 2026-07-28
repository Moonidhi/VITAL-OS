const RADIUS = 52
const STROKE = 9
const CIRCUMFERENCE = Math.PI * RADIUS // half-circle arc length ≈ 163

function getArcColor(soc) {
  if (soc >= 60) return '#3DD68C'   // healthy
  if (soc >= 30) return '#F5A623'   // moderate
  return '#FF5C5C'                   // critical
}

function getStatusLabel(soc) {
  if (soc >= 60) return 'Healthy'
  if (soc >= 30) return 'Moderate'
  return 'Critical'
}

export default function BatterySocGauge({ soc = 0, action = 'idle' }) {
  // Arc fills from left → right across the top of a half-circle
  const fillLength = (soc / 100) * CIRCUMFERENCE
  const gapLength = CIRCUMFERENCE - fillLength
  const color = getArcColor(soc)
  const label = getStatusLabel(soc)

  const actionLabels = {
    charging: { text: '↑ Charging', color: '#7C9EFF' },
    discharging: { text: '↓ Discharging', color: '#F5A623' },
    idle: { text: '— Idle', color: '#8B95A7' },
  }
  const actionInfo = actionLabels[action] || actionLabels.idle

  return (
    <div className="flex flex-col items-center justify-between h-full gap-2">
      <div className="relative w-36 mt-2" style={{ height: '80px' }}>
        <svg
          viewBox="0 0 130 74"
          className="w-full"
          role="img"
          aria-label={`Battery state of charge: ${soc.toFixed(1)}%`}
        >
          {/* Background track */}
          <path
            d="M 12 68 A 53 53 0 0 1 118 68"
            fill="none"
            stroke="#252E3D"
            strokeWidth={STROKE}
            strokeLinecap="round"
          />
          {/* Filled arc */}
          <path
            d="M 12 68 A 53 53 0 0 1 118 68"
            fill="none"
            stroke={color}
            strokeWidth={STROKE}
            strokeLinecap="round"
            strokeDasharray={`${fillLength} ${gapLength}`}
            style={{ transition: 'stroke-dasharray 0.6s ease, stroke 0.4s ease' }}
          />
          {/* Glow filter */}
          <defs>
            <filter id="glow">
              <feGaussianBlur stdDeviation="2.5" result="blur" />
              <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
          </defs>
          {/* Glow copy */}
          <path
            d="M 12 68 A 53 53 0 0 1 118 68"
            fill="none"
            stroke={color}
            strokeWidth={STROKE - 4}
            strokeLinecap="round"
            strokeDasharray={`${fillLength} ${gapLength}`}
            filter="url(#glow)"
            opacity="0.5"
            style={{ transition: 'stroke-dasharray 0.6s ease' }}
          />

          {/* SOC number */}
          <text x="65" y="60" textAnchor="middle" className="font-mono" fontSize="20" fontWeight="600" fill="#E8EDF4" fontFamily="JetBrains Mono, monospace">
            {soc.toFixed(1)}
          </text>
          <text x="90" y="56" textAnchor="start" fontSize="10" fill="#8B95A7" fontFamily="Inter, sans-serif">%</text>

          {/* Scale labels */}
          <text x="10" y="76" fontSize="8" fill="#5A6478" fontFamily="Inter, sans-serif">0</text>
          <text x="112" y="76" fontSize="8" fill="#5A6478" fontFamily="Inter, sans-serif">100</text>
        </svg>
      </div>

      <div className="flex flex-col items-center gap-1 pb-2">
        <span className="text-xs font-medium" style={{ color }}>{label}</span>
        <span className="text-[11px] font-mono" style={{ color: actionInfo.color }}>
          {actionInfo.text}
        </span>
        <span className="text-[10px] text-text-faint">400 kWh capacity</span>
      </div>
    </div>
  )
}
