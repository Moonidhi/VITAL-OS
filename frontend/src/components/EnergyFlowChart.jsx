import React from 'react'
import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from 'recharts'

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div
      style={{
        background: '#1A2230',
        border: '1px solid #252E3D',
        borderRadius: '10px',
        boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
      }}
      className="px-3 py-2 text-xs"
    >
      <p className="text-text-faint mb-1.5 font-mono">{label}</p>
      {payload.map((p) => (
        <div key={p.dataKey} className="flex items-center justify-between gap-4 py-0.5">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full inline-block" style={{ background: p.color }} />
            <span className="text-text-muted">{p.name}</span>
          </span>
          <span className="font-mono font-medium" style={{ color: p.color }}>
            {Number(p.value).toFixed(1)} kW
          </span>
        </div>
      ))}
    </div>
  )
}

function formatTime(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export default function EnergyFlowChart({ history = [] }) {
  const data = history.map((row) => ({
    time: formatTime(row.timestamp),
    Solar: row.solar_kw ?? 0,
    Wind: row.wind_kw ?? 0,
    Load: row.total_load_kw ?? 0,
    Generation: row.total_generation_kw ?? 0,
  }))

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-text-faint text-sm">
        No chart data yet — run the simulation to populate.
      </div>
    )
  }

  return (
    <div className="w-full h-full flex flex-col justify-between">
      <div className="flex-1 w-full min-h-[160px]">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 8, right: 16, left: -8, bottom: 0 }}>
            <defs>
              <linearGradient id="solarFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#F5A623" stopOpacity={0.15} />
                <stop offset="100%" stopColor="#F5A623" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="windFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#4DD0C4" stopOpacity={0.15} />
                <stop offset="100%" stopColor="#4DD0C4" stopOpacity={0} />
              </linearGradient>
            </defs>

            <CartesianGrid strokeDasharray="3 3" stroke="#252E3D" vertical={false} />
            <ReferenceLine y={0} stroke="#252E3D" strokeDasharray="3 3" />

            <XAxis
              dataKey="time"
              tick={{ fill: '#5A6478', fontSize: 10, fontFamily: 'JetBrains Mono' }}
              tickLine={false}
              axisLine={{ stroke: '#252E3D' }}
              interval="preserveStartEnd"
            />
            <YAxis
              tick={{ fill: '#5A6478', fontSize: 10, fontFamily: 'JetBrains Mono' }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => `${v}`}
              unit=" kW"
            />

            <Tooltip content={<CustomTooltip />} />

            <Area
              type="monotone"
              dataKey="Solar"
              stroke="#F5A623"
              strokeWidth={2}
              fill="url(#solarFill)"
              name="Solar"
              activeDot={{ r: 4, strokeWidth: 0, fill: '#F5A623' }}
            />
            <Area
              type="monotone"
              dataKey="Wind"
              stroke="#4DD0C4"
              strokeWidth={2}
              fill="url(#windFill)"
              name="Wind"
              activeDot={{ r: 4, strokeWidth: 0, fill: '#4DD0C4' }}
            />
            <Line
              type="monotone"
              dataKey="Generation"
              stroke="#7C9EFF"
              strokeWidth={1.5}
              dot={false}
              strokeDasharray="4 2"
              name="Total Gen"
              activeDot={{ r: 4, strokeWidth: 0, fill: '#7C9EFF' }}
            />
            <Line
              type="monotone"
              dataKey="Load"
              stroke="#FF7849"
              strokeWidth={2}
              dot={false}
              name="Hospital Load"
              activeDot={{ r: 4, strokeWidth: 0, fill: '#FF7849' }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Custom Legend */}
      <div className="flex items-center justify-center gap-6 pt-2 border-t border-base-border/40 text-[11px] text-text-faint">
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-[#F5A623]" />
          <span>Solar</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-[#4DD0C4]" />
          <span>Wind</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-[#7C9EFF]" />
          <span>Total Gen</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-[#FF7849]" />
          <span>Hospital Load</span>
        </div>
      </div>
    </div>
  )
}
