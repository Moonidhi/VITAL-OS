import React, { useState, useEffect } from 'react'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts'
import Sidebar from '../components/Sidebar.jsx'
import Header from '../components/Header.jsx'
import { usePolledEndpoint } from '../useApi.js'

const DEPT_COLORS = {
  ICU: '#FF5C5C',
  OT: '#F5A623',
  'Operation Theatre': '#F5A623',
  ED: '#FF7849',
  'Emergency Department': '#FF7849',
  OP: '#4DD0C4',
  'Oxygen Plant': '#4DD0C4',
  GW: '#7C9EFF',
  'General Ward': '#7C9EFF',
  HV: '#8B95A7',
  HVAC: '#8B95A7',
  LT: '#5A6478',
  Lighting: '#5A6478',
}

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-[#1A2230] border border-[#252E3D] px-3 py-2 rounded-lg shadow-xl text-xs space-y-1">
        {label && <p className="font-mono text-[#8B95A7] border-b border-[#252E3D] pb-1">{label}</p>}
        {payload.map((item, idx) => (
          <div key={idx} className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color || item.fill }} />
            <span className="text-[#8B95A7]">{item.name}: </span>
            <span className="font-mono font-bold text-[#E8EDF4]">{item.value} kW</span>
          </div>
        ))}
      </div>
    )
  }
  return null
}

export default function Departments() {
  const [selectedDept, setSelectedDept] = useState(null)
  const [singleTrend, setSingleTrend] = useState([])

  // Polling hooks
  const summaryRes = usePolledEndpoint('/departments/summary', 10000)
  const deptsRes = usePolledEndpoint('/departments', 8000)
  const breakdownRes = usePolledEndpoint('/departments/energy-breakdown', 15000)
  const efficiencyRes = usePolledEndpoint('/departments/efficiency-matrix', 15000)
  const eventsRes = usePolledEndpoint('/departments/events', 20000)

  const summary = summaryRes.data || {}
  const departments = deptsRes.data || []
  const breakdown = breakdownRes.data?.departments || []
  const efficiencyMatrix = efficiencyRes.data || []
  const events = eventsRes.data || []

  // Fetch single department trend when selected
  useEffect(() => {
    if (selectedDept?.dept_id) {
      let isCancelled = false
      fetch(`http://127.0.0.1:8000/departments/${selectedDept.dept_id}/trend?hours=24`)
        .then((res) => res.json())
        .then((data) => {
          if (!isCancelled) setSingleTrend(data)
        })
        .catch(() => {})
      return () => {
        isCancelled = true
      }
    }
  }, [selectedDept])

  const lastUpdatedTime = summaryRes.lastUpdated
    ? summaryRes.lastUpdated.toLocaleTimeString()
    : 'Polling...'

  // Helper Badge Renderers
  const renderStatusBadge = (status) => {
    let style = 'bg-[#3DD68C]/10 text-[#3DD68C] border-[#3DD68C]/30'
    if (status === 'Maintenance') style = 'bg-[#F5A623]/10 text-[#F5A623] border-[#F5A623]/30'
    if (status === 'Partial') style = 'bg-[#FF7849]/10 text-[#FF7849] border-[#FF7849]/30'

    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold border ${style}`}>
        {status}
      </span>
    )
  }

  const renderAllocationBadge = (alloc) => {
    let style = 'bg-[#3DD68C]/10 text-[#3DD68C] border-[#3DD68C]/30'
    if (alloc === 'Reduced') style = 'bg-[#F5A623]/10 text-[#F5A623] border-[#F5A623]/30'
    if (alloc === 'Limited') style = 'bg-[#FF7849]/10 text-[#FF7849] border-[#FF7849]/30'
    if (alloc === 'Shed') style = 'bg-[#FF5C5C]/10 text-[#FF5C5C] border-[#FF5C5C]/30'

    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-mono font-medium border ${style}`}>
        {alloc}
      </span>
    )
  }

  const renderTrendIcon = (trend) => {
    if (trend === 'rising') {
      return <span className="text-[#FF5C5C] font-semibold">▲ Rising</span>
    }
    if (trend === 'falling') {
      return <span className="text-[#3DD68C] font-semibold">▼ Falling</span>
    }
    return <span className="text-[#8B95A7]">→ Stable</span>
  }

  // Allocation distribution donut chart data
  const allocCounts = { Protected: 0, Reduced: 0, Limited: 0, Shed: 0 }
  departments.forEach((d) => {
    const st = d.allocation_status || 'Protected'
    if (allocCounts[st] !== undefined) allocCounts[st]++
  })

  const allocPieData = [
    { name: 'Protected', value: allocCounts.Protected, color: '#3DD68C' },
    { name: 'Reduced', value: allocCounts.Reduced, color: '#F5A623' },
    { name: 'Limited', value: allocCounts.Limited, color: '#FF7849' },
    { name: 'Shed', value: allocCounts.Shed, color: '#FF5C5C' },
  ].filter((d) => d.value > 0)

  return (
    <div className="flex h-screen overflow-hidden bg-[#0B0F14] font-body text-[#E8EDF4]">
      <Sidebar />
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <Header title="Department Management & Energy Allocation" />
        <main className="flex-1 overflow-y-auto px-6 py-5 space-y-6">

          {/* Top Bar Indicator */}
          <div className="flex items-center justify-between text-xs text-[#5A6478]">
            <div className="flex items-center gap-3">
              <span className="font-display font-semibold text-sm text-[#E8EDF4]">Hospital Departments</span>
              <span className="px-2 py-0.5 rounded bg-[#131922] border border-[#252E3D] font-mono text-[11px] text-[#7C9EFF]">
                7 Wards & Facilities
              </span>
            </div>
            <div className="flex items-center gap-2 font-mono">
              <span className="w-2 h-2 rounded-full bg-[#3DD68C] animate-ping" />
              <span>Last updated: {lastUpdatedTime} · Polling 8s</span>
            </div>
          </div>

          {/* SECTION 1 — 6 KPI CARDS */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            {summaryRes.loading && !summaryRes.data ? (
              Array.from({ length: 6 }).map((_, idx) => (
                <div key={idx} className="h-24 rounded-xl bg-[#131922] border border-[#252E3D] animate-pulse p-4 flex flex-col justify-between">
                  <div className="h-4 bg-[#252E3D] rounded w-1/2" />
                  <div className="h-7 bg-[#252E3D] rounded w-3/4" />
                </div>
              ))
            ) : (
              <>
                <div className="bg-[#131922] border border-[#252E3D] rounded-xl p-4 flex flex-col justify-between shadow-card hover:border-[#7C9EFF]/30 transition-all">
                  <span className="text-xs font-semibold text-[#8B95A7] uppercase tracking-wider">Total Wards</span>
                  <div className="mt-2 flex items-baseline justify-between">
                    <span className="font-display text-2xl font-bold text-[#E8EDF4]">{summary.total_departments || 7}</span>
                    <span className="text-[10px] text-[#5A6478] font-mono">Depts</span>
                  </div>
                  <span className="text-xs text-[#5A6478] mt-1">7 registered units</span>
                </div>

                <div className="bg-[#131922] border border-[#252E3D] rounded-xl p-4 flex flex-col justify-between shadow-card hover:border-[#3DD68C]/30 transition-all">
                  <span className="text-xs font-semibold text-[#3DD68C] uppercase tracking-wider">Operational</span>
                  <div className="mt-2 flex items-baseline justify-between">
                    <span className="font-display text-2xl font-bold text-[#3DD68C]">{summary.operational_departments || 7}</span>
                    <span className="text-[10px] text-[#3DD68C]/70 font-mono">Active</span>
                  </div>
                  <span className="text-xs text-[#5A6478] mt-1">{summary.operational_departments || 7} of 7 active</span>
                </div>

                <div className="bg-[#131922] border border-[#252E3D] rounded-xl p-4 flex flex-col justify-between shadow-card hover:border-[#F5A623]/30 transition-all">
                  <span className="text-xs font-semibold text-[#F5A623] uppercase tracking-wider">Maintenance</span>
                  <div className="mt-2 flex items-baseline justify-between">
                    <span className="font-display text-2xl font-bold text-[#F5A623]">{summary.maintenance_departments || 0}</span>
                    <span className="text-[10px] text-[#F5A623]/70 font-mono">Scheduled</span>
                  </div>
                  <span className="text-xs text-[#5A6478] mt-1">{summary.maintenance_departments || 0} scheduled</span>
                </div>

                <div className="bg-[#131922] border border-[#252E3D] rounded-xl p-4 flex flex-col justify-between shadow-card hover:border-[#7C9EFF]/30 transition-all">
                  <span className="text-xs font-semibold text-[#7C9EFF] uppercase tracking-wider">Total Beds</span>
                  <div className="mt-2 flex items-baseline justify-between">
                    <span className="font-display text-2xl font-bold text-[#7C9EFF]">{summary.total_beds || 134}</span>
                    <span className="text-[10px] text-[#7C9EFF]/70 font-mono">Beds</span>
                  </div>
                  <span className="text-xs text-[#5A6478] mt-1">Clinical capacity</span>
                </div>

                <div className="bg-[#131922] border border-[#252E3D] rounded-xl p-4 flex flex-col justify-between shadow-card hover:border-[#FF7849]/30 transition-all">
                  <span className="text-xs font-semibold text-[#FF7849] uppercase tracking-wider">Occupied Beds</span>
                  <div className="mt-2 flex items-baseline justify-between">
                    <span className="font-display text-2xl font-bold text-[#FF7849]">{summary.occupied_beds || 107}</span>
                    <span className="text-[10px] text-[#FF7849]/70 font-mono">{summary.occupancy_rate_pct || 79.9}%</span>
                  </div>
                  <span className="text-xs text-[#5A6478] mt-1">{summary.occupancy_rate_pct || 79.9}% occupancy</span>
                </div>

                <div className="bg-[#131922] border border-[#252E3D] rounded-xl p-4 flex flex-col justify-between shadow-card hover:border-[#FF5C5C]/30 transition-all">
                  <span className="text-xs font-semibold text-[#FF5C5C] uppercase tracking-wider">Critical Load</span>
                  <div className="mt-2 flex items-baseline justify-between">
                    <span className="font-display text-2xl font-bold text-[#FF5C5C]">{summary.critical_load_departments || 0}</span>
                    <span className="text-[10px] text-[#FF5C5C]/70 font-mono">High Load</span>
                  </div>
                  <span className="text-xs text-[#5A6478] mt-1">Above load threshold</span>
                </div>
              </>
            )}
          </div>

          {/* SECTION 2 — DEPARTMENT CARDS GRID (7 CARDS) */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-display font-bold text-base text-[#E8EDF4]">Hospital Wards & Subsystem Load Grid</h3>
              <span className="text-xs text-[#5A6478] font-mono">7 Registered Wards</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {deptsRes.loading && departments.length === 0 ? (
                Array.from({ length: 7 }).map((_, idx) => (
                  <div key={idx} className="h-52 rounded-xl bg-[#131922] border border-[#252E3D] animate-pulse p-4 flex flex-col justify-between">
                    <div className="h-4 bg-[#252E3D] rounded w-1/2" />
                    <div className="h-10 bg-[#252E3D] rounded w-full" />
                  </div>
                ))
              ) : (
                departments.map((dept) => {
                  const accentColor = DEPT_COLORS[dept.code] || DEPT_COLORS[dept.name] || '#7C9EFF'
                  const isSelected = selectedDept?.dept_id === dept.dept_id
                  const loadRatio = dept.peak_load_kw > 0 ? (dept.current_load_kw / dept.peak_load_kw) * 100 : 0

                  return (
                    <div
                      key={dept.dept_id}
                      onClick={() => setSelectedDept(dept)}
                      className={`bg-[#131922] border rounded-xl p-4 shadow-card hover:border-[#7C9EFF] cursor-pointer transition-all space-y-3 ${
                        isSelected ? 'ring-1 ring-[#7C9EFF] border-[#7C9EFF] bg-[#1A2230]' : 'border-[#252E3D]'
                      }`}
                    >
                      {/* Header */}
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2">
                          <span className="w-3 h-3 rounded-full" style={{ backgroundColor: accentColor }} />
                          <div>
                            <h4 className="font-semibold text-xs text-[#E8EDF4]">{dept.name}</h4>
                            <span className="text-[10px] text-[#5A6478] font-mono">{dept.code} · {dept.floor}</span>
                          </div>
                        </div>
                        {renderStatusBadge(dept.status)}
                      </div>

                      {/* Head Doctor */}
                      <div className="text-[11px] text-[#8B95A7]">
                        <span className="text-[#5A6478]">Head: </span>
                        <span>{dept.head_doctor}</span>
                      </div>

                      {/* 3 Load metrics */}
                      <div className="grid grid-cols-3 gap-1 text-center bg-[#1A2230] p-2 rounded-lg border border-[#252E3D]">
                        <div>
                          <span className="text-[9px] text-[#5A6478] uppercase block">Current</span>
                          <span className="font-mono font-bold text-xs text-[#E8EDF4]">{dept.current_load_kw} kW</span>
                        </div>
                        <div>
                          <span className="text-[9px] text-[#5A6478] uppercase block">Peak</span>
                          <span className="font-mono font-bold text-xs text-[#FF5C5C]">{dept.peak_load_kw} kW</span>
                        </div>
                        <div>
                          <span className="text-[9px] text-[#5A6478] uppercase block">Avg</span>
                          <span className="font-mono font-bold text-xs text-[#7C9EFF]">{dept.avg_load_kw} kW</span>
                        </div>
                      </div>

                      {/* Load Progress Bar */}
                      <div className="space-y-1">
                        <div className="w-full bg-[#1A2230] h-1.5 rounded-full overflow-hidden border border-[#252E3D]">
                          <div
                            className="h-full transition-all duration-500 rounded-full"
                            style={{ width: `${Math.min(100, loadRatio)}%`, backgroundColor: accentColor }}
                          />
                        </div>
                      </div>

                      {/* Allocation & Trend */}
                      <div className="flex items-center justify-between text-[11px] pt-1 border-t border-[#252E3D]">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[#5A6478]">Alloc:</span>
                          {renderAllocationBadge(dept.allocation_status)}
                        </div>
                        <div className="text-right">
                          {renderTrendIcon(dept.load_trend)}
                        </div>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>

          {/* SECTION 4 — CHARTS ROW (3 CHARTS) */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

            {/* Chart 1 — Energy Load by Department */}
            <div className="bg-[#131922] border border-[#252E3D] rounded-xl p-5 shadow-card flex flex-col justify-between">
              <div className="mb-4">
                <h3 className="font-display font-semibold text-sm text-[#E8EDF4]">Department Load Breakdown</h3>
                <p className="text-xs text-[#5A6478]">Current vs Peak vs Allocated kW per ward</p>
              </div>
              <div className="h-56 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={breakdown} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#252E3D" />
                    <XAxis dataKey="code" stroke="#5A6478" tick={{ fill: '#5A6478', fontSize: 10 }} />
                    <YAxis stroke="#5A6478" tick={{ fill: '#5A6478', fontSize: 10 }} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="current_load_kw" name="Current kW" fill="#FF7849" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="peak_load_kw" name="Peak kW" fill="#FF5C5C" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="allocated_kw" name="Allocated kW" fill="#3DD68C" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Chart 2 — Efficiency Heatmap */}
            <div className="bg-[#131922] border border-[#252E3D] rounded-xl p-5 shadow-card flex flex-col justify-between">
              <div className="mb-4">
                <h3 className="font-display font-semibold text-sm text-[#E8EDF4]">Efficiency Heatmap</h3>
                <p className="text-xs text-[#5A6478]">Operational efficiency score (0–100)</p>
              </div>
              <div className="h-56 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart layout="vertical" data={efficiencyMatrix} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                    <XAxis type="number" domain={[0, 100]} stroke="#5A6478" tick={{ fill: '#5A6478', fontSize: 10 }} />
                    <YAxis dataKey="code" type="category" stroke="#5A6478" tick={{ fill: '#8B95A7', fontSize: 10 }} width={30} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="efficiency_score" name="Efficiency Score" radius={[0, 4, 4, 0]}>
                      {efficiencyMatrix.map((entry) => {
                        let fill = '#3DD68C'
                        if (entry.efficiency_score < 60) fill = '#FF5C5C'
                        else if (entry.efficiency_score < 80) fill = '#F5A623'
                        return <Cell key={entry.code} fill={fill} />
                      })}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Chart 3 — Allocation Status Distribution */}
            <div className="bg-[#131922] border border-[#252E3D] rounded-xl p-5 shadow-card flex flex-col justify-between">
              <div className="mb-4">
                <h3 className="font-display font-semibold text-sm text-[#E8EDF4]">Load Allocation Tier Mix</h3>
                <p className="text-xs text-[#5A6478]">Protected vs Reduced vs Shed departments</p>
              </div>
              <div className="h-56 w-full relative">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={allocPieData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={75}
                      paddingAngle={4}
                    >
                      {allocPieData.map((entry) => (
                        <Cell key={entry.name} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-3 text-[11px] text-[#8B95A7] pt-2 border-t border-[#252E3D]">
                {allocPieData.map((d) => (
                  <div key={d.name} className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: d.color }} />
                    <span>{d.name} ({d.value})</span>
                  </div>
                ))}
              </div>
            </div>

          </div>

          {/* SECTION 5 — EVENTS FEED */}
          <div className="bg-[#131922] border border-[#252E3D] rounded-xl p-5 shadow-card space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-display font-bold text-base text-[#E8EDF4]">Department Event Log</h3>
              <span className="text-xs text-[#5A6478] font-mono">Recent Events</span>
            </div>

            <div className="overflow-x-auto rounded-lg border border-[#252E3D]">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-[#1A2230] text-[#8B95A7] border-b border-[#252E3D] font-mono text-[11px] uppercase">
                    <th className="py-3 px-4">Time</th>
                    <th className="py-3 px-4">Department</th>
                    <th className="py-3 px-4">Severity</th>
                    <th className="py-3 px-4">Event Description</th>
                    <th className="py-3 px-4">Load at Time</th>
                    <th className="py-3 px-4">Threshold</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#252E3D]">
                  {events.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-[#5A6478] font-mono">
                        No events recorded — all departments operating normally.
                      </td>
                    </tr>
                  ) : (
                    events.slice(0, 20).map((ev) => {
                      let sevStyle = 'bg-[#3DD68C]/10 text-[#3DD68C] border-[#3DD68C]/30'
                      if (ev.severity === 'WARNING') sevStyle = 'bg-[#F5A623]/10 text-[#F5A623] border-[#F5A623]/30'
                      if (ev.severity === 'CRITICAL') sevStyle = 'bg-[#FF5C5C]/10 text-[#FF5C5C] border-[#FF5C5C]/30 animate-pulse'

                      return (
                        <tr key={ev.id} className="hover:bg-[#1A2230]/50 transition-colors">
                          <td className="py-3 px-4 font-mono text-[#5A6478] text-[11px]">{ev.timestamp}</td>
                          <td className="py-3 px-4 font-semibold text-[#E8EDF4]">{ev.dept_name}</td>
                          <td className="py-3 px-4">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold border ${sevStyle}`}>
                              {ev.severity}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-[#8B95A7]">{ev.message}</td>
                          <td className="py-3 px-4 font-mono text-[#7C9EFF]">{ev.load_kw} kW</td>
                          <td className="py-3 px-4 font-mono text-[#5A6478]">{ev.threshold_kw} kW</td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </main>
      </div>

      {/* SECTION 3 — DETAIL SIDE PANEL (460px RIGHT DRAWER) */}
      {selectedDept && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm transition-opacity">
          <div className="flex-1" onClick={() => setSelectedDept(null)} />

          <div className="w-[460px] bg-[#131922] border-l border-[#252E3D] h-full overflow-y-auto p-6 space-y-6 shadow-2xl flex flex-col justify-between">
            <div className="space-y-6">
              {/* Header */}
              <div className="flex items-start justify-between pb-4 border-b border-[#252E3D]">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="w-3.5 h-3.5 rounded-full" style={{ backgroundColor: DEPT_COLORS[selectedDept.code] || '#7C9EFF' }} />
                    <h2 className="font-display font-bold text-xl text-[#E8EDF4]">{selectedDept.name}</h2>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="font-mono text-xs text-[#7C9EFF]">{selectedDept.dept_id}</span>
                    <span className="text-[#5A6478]">·</span>
                    {renderStatusBadge(selectedDept.status)}
                  </div>
                </div>
                <button
                  onClick={() => setSelectedDept(null)}
                  className="w-8 h-8 rounded-lg bg-[#1A2230] border border-[#252E3D] text-[#8B95A7] hover:text-white flex items-center justify-center transition-colors"
                >
                  ✕
                </button>
              </div>

              {/* Dept Info 2x2 Grid */}
              <div className="bg-[#1A2230] border border-[#252E3D] rounded-xl p-4 space-y-3">
                <h3 className="text-xs font-semibold text-[#8B95A7] uppercase tracking-wider">Department Details</h3>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-[#5A6478] block">Category</span>
                    <span className="font-medium text-[#E8EDF4]">{selectedDept.category}</span>
                  </div>
                  <div>
                    <span className="text-[#5A6478] block">Location Floor</span>
                    <span className="font-medium text-[#E8EDF4]">{selectedDept.floor}</span>
                  </div>
                  <div>
                    <span className="text-[#5A6478] block">Head Doctor</span>
                    <span className="font-medium text-[#E8EDF4]">{selectedDept.head_doctor}</span>
                  </div>
                  <div>
                    <span className="text-[#5A6478] block">Contact Ext</span>
                    <span className="font-mono text-[#7C9EFF]">{selectedDept.contact_ext}</span>
                  </div>
                </div>
              </div>

              {/* Live Metrics 2x3 Grid */}
              <div className="bg-[#1A2230] border border-[#252E3D] rounded-xl p-4 space-y-3">
                <h3 className="text-xs font-semibold text-[#8B95A7] uppercase tracking-wider">Live Power Telemetry</h3>
                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="bg-[#131922] p-2 rounded-lg border border-[#252E3D]">
                    <span className="text-[10px] text-[#5A6478] block">Current Load</span>
                    <span className="font-mono font-bold text-[#E8EDF4]">{selectedDept.current_load_kw} kW</span>
                  </div>
                  <div className="bg-[#131922] p-2 rounded-lg border border-[#252E3D]">
                    <span className="text-[10px] text-[#5A6478] block">Peak Load</span>
                    <span className="font-mono font-bold text-[#FF5C5C]">{selectedDept.peak_load_kw} kW</span>
                  </div>
                  <div className="bg-[#131922] p-2 rounded-lg border border-[#252E3D]">
                    <span className="text-[10px] text-[#5A6478] block">Avg Load</span>
                    <span className="font-mono font-bold text-[#7C9EFF]">{selectedDept.avg_load_kw} kW</span>
                  </div>
                  <div className="bg-[#131922] p-2 rounded-lg border border-[#252E3D]">
                    <span className="text-[10px] text-[#5A6478] block">Efficiency</span>
                    <span className="font-mono font-bold text-[#3DD68C]">{selectedDept.efficiency_score}</span>
                  </div>
                  <div className="bg-[#131922] p-2 rounded-lg border border-[#252E3D]">
                    <span className="text-[10px] text-[#5A6478] block">Uptime</span>
                    <span className="font-mono font-bold text-[#4DD0C4]">{selectedDept.uptime_percent}%</span>
                  </div>
                  <div className="bg-[#131922] p-2 rounded-lg border border-[#252E3D]">
                    <span className="text-[10px] text-[#5A6478] block">Energy Rank</span>
                    <span className="font-mono font-bold text-[#F5A623]">#{selectedDept.energy_rank} of 7</span>
                  </div>
                </div>
              </div>

              {/* Sparkline Chart */}
              <div className="bg-[#1A2230] border border-[#252E3D] rounded-xl p-4 space-y-2">
                <h3 className="text-xs font-semibold text-[#8B95A7] uppercase tracking-wider">24h Load Trend Sparkline</h3>
                <div className="h-16 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={singleTrend}>
                      <Line type="monotone" dataKey="load_kw" stroke={DEPT_COLORS[selectedDept.code] || '#7C9EFF'} strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Equipment Registry */}
              <div className="bg-[#1A2230] border border-[#252E3D] rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-semibold text-[#8B95A7] uppercase tracking-wider">Assigned Equipment Registry</h3>
                  <span className="text-[10px] font-mono text-[#7C9EFF]">{selectedDept.equipment_total_power_kw || 0} kW total</span>
                </div>
                <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                  {(selectedDept.equipment || []).map((eq, idx) => (
                    <div key={idx} className="flex items-center justify-between p-2 rounded bg-[#131922] border border-[#252E3D] text-xs">
                      <div className="flex items-center gap-2">
                        <span className="px-1.5 py-0.5 rounded bg-[#1A2230] text-[#7C9EFF] font-mono font-bold text-[10px] border border-[#252E3D]">
                          x{eq.count}
                        </span>
                        <span className="font-medium text-[#E8EDF4]">{eq.name}</span>
                      </div>
                      <span className="font-mono text-[#5A6478] text-[11px]">{eq.watts * eq.count}W · {eq.status}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Allocation Card */}
              <div className="bg-[#1A2230] border border-[#252E3D] rounded-xl p-4 space-y-3">
                <h3 className="text-xs font-semibold text-[#8B95A7] uppercase tracking-wider">Power Allocation & Shedding</h3>
                <div className="flex items-center justify-between">
                  <div className="font-display font-extrabold text-3xl text-[#3DD68C]">
                    {selectedDept.allocated_pct}%
                  </div>
                  {renderAllocationBadge(selectedDept.allocation_status)}
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                  <div className="bg-[#131922] p-2 rounded border border-[#252E3D]">
                    <span className="text-[10px] text-[#5A6478] block">Allocated Power</span>
                    <span className="font-mono font-bold text-[#E8EDF4]">{selectedDept.allocated_kw} kW</span>
                  </div>
                  <div className="bg-[#131922] p-2 rounded border border-[#252E3D]">
                    <span className="text-[10px] text-[#5A6478] block">Power Shed</span>
                    <span className="font-mono font-bold text-[#FF5C5C]">{selectedDept.savings_kw} kW</span>
                  </div>
                </div>
              </div>

            </div>

            <div className="pt-4 border-t border-[#252E3D] text-center">
              <button
                onClick={() => setSelectedDept(null)}
                className="w-full py-2 bg-[#1A2230] border border-[#252E3D] hover:bg-[#252E3D] text-[#E8EDF4] rounded-lg text-xs font-semibold transition-colors"
              >
                Close Department Drawer
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
