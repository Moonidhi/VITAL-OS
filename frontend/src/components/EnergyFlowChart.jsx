import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, ReferenceLine,
} from 'recharts'

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-base-elevated border border-base-border rounded-lg px-3 py-2 text-xs shadow-lg">
      <p className="text-text-faint mb-1.5 font-mono">{label}</p>
      {payload.map(p => (
        <div key={p.dataKey} className="flex items-center justify-between gap-4">
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
  const data = history.map(row => ({
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
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top: 4, right: 16, left: -8, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#252E3D" vertical={false} />
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
          tickFormatter={v => `${v}`}
          unit=" kW"
        />
        <Tooltip content={<CustomTooltip />} />
        <Legend
          wrapperStyle={{ paddingTop: '8px', fontSize: '11px', color: '#8B95A7' }}
          formatter={(value) => <span style={{ color: '#8B95A7' }}>{value}</span>}
        />
        <Line type="monotone" dataKey="Solar"      stroke="#F5A623" strokeWidth={2} dot={false} name="Solar" />
        <Line type="monotone" dataKey="Wind"       stroke="#4DD0C4" strokeWidth={2} dot={false} name="Wind" />
        <Line type="monotone" dataKey="Generation" stroke="#7C9EFF" strokeWidth={1.5} dot={false} strokeDasharray="4 2" name="Total Gen" />
        <Line type="monotone" dataKey="Load"       stroke="#FF7849" strokeWidth={2} dot={false} name="Hospital Load" />
      </LineChart>
    </ResponsiveContainer>
  )
}
