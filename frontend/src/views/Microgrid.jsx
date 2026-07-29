import React, { useState, useEffect, useMemo } from 'react'
import {
  ResponsiveContainer,
  ComposedChart,
  AreaChart,
  Area,
  Line,
  BarChart,
  Bar,
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
import { usePolledEndpoint, API_BASE } from '../useApi.js'

// Inline SVG Icon components for assets
function AssetIcon({ type, className = 'w-5 h-5' }) {
  switch (type) {
    case 'solar':
      return (
        <svg className={`${className} text-[#F5A623]`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
      )
    case 'wind':
      return (
        <svg className={`${className} text-[#4DD0C4]`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 10l-2 1m0 0l-2-1m2 1v2.5M20 7l-2 1m0 0l-2-1m2 1v2.5M8 14l-2 1m0 0l-2-1m2 1v2.5" />
        </svg>
      )
    case 'battery':
      return (
        <svg className={`${className} text-[#7C9EFF]`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      )
    case 'grid':
      return (
        <svg className={`${className} text-[#3DD68C]`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      )
    case 'inverter':
      return (
        <svg className={`${className} text-[#8B95A7]`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
        </svg>
      )
    case 'transformer':
      return (
        <svg className={`${className} text-[#8B95A7]`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h8m-8 5h8m-8 5h8M5 3h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2z" />
        </svg>
      )
    default:
      return (
        <svg className={`${className} text-[#5A6478]`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      )
  }
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
            <span className="font-mono font-bold text-[#E8EDF4]">{item.value}</span>
          </div>
        ))}
      </div>
    )
  }
  return null
}

export default function Microgrid() {
  const [selectedAsset, setSelectedAsset] = useState(null)
  const [acknowledgedEvents, setAcknowledgedEvents] = useState({})

  // Polling hooks
  const summaryRes = usePolledEndpoint('/microgrid/summary', 6000)
  const powerFlowRes = usePolledEndpoint('/microgrid/power-flow', 5000)
  const assetsRes = usePolledEndpoint('/microgrid/assets', 8000)
  const hourlyTrendRes = usePolledEndpoint('/microgrid/hourly-trend', 30000)
  const genBreakdownRes = usePolledEndpoint('/microgrid/generation-breakdown', 30000)
  const weeklyTrendRes = usePolledEndpoint('/microgrid/weekly-trend', 60000)
  const savingsRes = usePolledEndpoint('/microgrid/carbon-savings', 60000)
  const eventsRes = usePolledEndpoint('/microgrid/events', 15000)

  const summary = summaryRes.data || {}
  const flow = powerFlowRes.data || { nodes: [], edges: [] }
  const assets = assetsRes.data || []
  const hourlyData = hourlyTrendRes.data || []
  const breakdown = genBreakdownRes.data || {}
  const weeklyData = weeklyTrendRes.data || []
  const savings = savingsRes.data || {}
  const events = eventsRes.data || []

  // Active unacknowledged event count
  const unackEvents = events.filter((e) => e.acknowledged === 0 && !acknowledgedEvents[e.id])

  const isOutage = summary.grid_status === 'OUTAGE'
  const isLowBattery = (summary.battery_soc_percent || 100) < 20.0

  const handleAcknowledge = async (eventId) => {
    try {
      const res = await fetch(`${API_BASE}/microgrid/events/${eventId}/acknowledge`, {
        method: 'PATCH',
      })
      if (res.ok) {
        setAcknowledgedEvents((prev) => ({ ...prev, [eventId]: true }))
      }
    } catch (_) {}
  }

  // Format last updated timestamp
  const lastUpdatedTime = summaryRes.lastUpdated
    ? summaryRes.lastUpdated.toLocaleTimeString()
    : 'Polling...'

  // Helper Badge renderers
  const renderStatusBadge = (status) => {
    let style = 'bg-[#3DD68C]/10 text-[#3DD68C] border-[#3DD68C]/30'
    if (status === 'Degraded') style = 'bg-[#F5A623]/10 text-[#F5A623] border-[#F5A623]/30'
    if (status === 'Offline') style = 'bg-[#FF5C5C]/10 text-[#FF5C5C] border-[#FF5C5C]/30'
    if (status === 'Maintenance') style = 'bg-[#8B95A7]/10 text-[#8B95A7] border-[#8B95A7]/30'

    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold border ${style}`}>
        {status}
      </span>
    )
  }

  const renderHealthBar = (health) => {
    let barColor = 'bg-[#3DD68C]'
    let textColor = 'text-[#3DD68C]'
    if (health < 60) {
      barColor = 'bg-[#FF5C5C]'
      textColor = 'text-[#FF5C5C]'
    } else if (health < 80) {
      barColor = 'bg-[#F5A623]'
      textColor = 'text-[#F5A623]'
    }

    return (
      <div className="flex items-center gap-2">
        <span className={`font-mono font-bold text-xs ${textColor}`}>{health}%</span>
        <div className="w-16 bg-[#252E3D] h-1.5 rounded-full overflow-hidden flex-1">
          <div className={`h-full ${barColor} transition-all duration-500`} style={{ width: `${health}%` }} />
        </div>
      </div>
    )
  }

  // Data breakdown pie chart colors
  const PIE_COLORS = ['#F5A623', '#4DD0C4', '#3DD68C']
  const pieData = [
    { name: 'Solar', value: breakdown.solar_kw || 0 },
    { name: 'Wind', value: breakdown.wind_kw || 0 },
    { name: 'Grid Import', value: breakdown.grid_import_kw || 0 },
  ]

  // Mock Sparkline data generator for asset detail panel
  const getAssetSparklineData = (asset) => {
    if (!asset) return []
    const out = asset.current_output_kw || 10.0
    return Array.from({ length: 24 }).map((_, i) => ({
      hour: `${i}:00`,
      kw: Math.max(0, Math.round(out * (0.6 + Math.sin(i / 3) * 0.4) * 10) / 10),
    }))
  }

  return (
    <div className="flex h-screen overflow-hidden bg-[#0B0F14] font-body text-[#E8EDF4]">
      <Sidebar />
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <Header title="Microgrid Energy Management & Assets" />
        
        {/* Outage Warning Alert Banner */}
        {isOutage && (
          <div className="bg-[#FF5C5C] text-white px-6 py-2 flex items-center justify-between font-semibold text-xs tracking-wide animate-pulse shadow-lg">
            <div className="flex items-center gap-2">
              <span className="text-base">🚨</span>
              <span>GRID POWER OUTAGE DETECTED — Hospital Operating in Microgrid Island Mode (Battery + Renewables)</span>
            </div>
            <span className="font-mono text-[11px]">STATUS: ISLANDED</span>
          </div>
        )}

        <main className="flex-1 overflow-y-auto px-6 py-5 space-y-6">

          {/* Header Bar Status */}
          <div className="flex items-center justify-between text-xs text-[#5A6478]">
            <div className="flex items-center gap-3">
              <span className="font-display font-semibold text-sm text-[#E8EDF4]">System Overview</span>
              <span className="px-2 py-0.5 rounded bg-[#131922] border border-[#252E3D] font-mono text-[11px] text-[#7C9EFF]">
                12 Assets Monitored
              </span>
            </div>
            <div className="flex items-center gap-2 font-mono">
              <span className="w-2 h-2 rounded-full bg-[#3DD68C] animate-ping" />
              <span>Last updated: {lastUpdatedTime} · Polling 5s</span>
            </div>
          </div>

          {/* SECTION 1 — 8 KPI CARDS */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {summaryRes.loading && !summaryRes.data ? (
              Array.from({ length: 8 }).map((_, idx) => (
                <div key={idx} className="h-24 rounded-xl bg-[#131922] border border-[#252E3D] animate-pulse p-4 flex flex-col justify-between">
                  <div className="h-4 bg-[#252E3D] rounded w-1/2" />
                  <div className="h-7 bg-[#252E3D] rounded w-3/4" />
                </div>
              ))
            ) : (
              <>
                {/* Row 1 */}
                <div className="bg-[#131922] border border-[#252E3D] rounded-xl p-4 flex flex-col justify-between shadow-card hover:border-[#3DD68C]/30 transition-all">
                  <span className="text-xs font-semibold text-[#3DD68C] uppercase tracking-wider">Total Generation</span>
                  <div className="mt-2 flex items-baseline justify-between">
                    <span className="font-display text-2xl font-bold text-[#3DD68C]">{summary.total_generation_kw || 0} kW</span>
                    <span className="text-[10px] text-[#5A6478] font-mono">kW</span>
                  </div>
                  <span className="text-xs text-[#5A6478] mt-1">Solar ({summary.total_solar_kw || 0} kW) + Wind ({summary.total_wind_kw || 0} kW)</span>
                </div>

                <div className="bg-[#131922] border border-[#252E3D] rounded-xl p-4 flex flex-col justify-between shadow-card hover:border-[#F5A623]/30 transition-all">
                  <span className="text-xs font-semibold text-[#F5A623] uppercase tracking-wider">Solar Output</span>
                  <div className="mt-2 flex items-baseline justify-between">
                    <span className="font-display text-2xl font-bold text-[#F5A623]">{summary.total_solar_kw || 0} kW</span>
                    <span className="text-[10px] text-[#F5A623]/70 font-mono">{Math.round(((summary.total_solar_kw || 0) / 150) * 100)}%</span>
                  </div>
                  <span className="text-xs text-[#5A6478] mt-1">Array capacity: 150 kW peak</span>
                </div>

                <div className="bg-[#131922] border border-[#252E3D] rounded-xl p-4 flex flex-col justify-between shadow-card hover:border-[#4DD0C4]/30 transition-all">
                  <span className="text-xs font-semibold text-[#4DD0C4] uppercase tracking-wider">Wind Output</span>
                  <div className="mt-2 flex items-baseline justify-between">
                    <span className="font-display text-2xl font-bold text-[#4DD0C4]">{summary.total_wind_kw || 0} kW</span>
                    <span className="text-[10px] text-[#4DD0C4]/70 font-mono">Turbines</span>
                  </div>
                  <span className="text-xs text-[#5A6478] mt-1">Wind speed 8.4 m/s · Clear</span>
                </div>

                <div className="bg-[#131922] border border-[#252E3D] rounded-xl p-4 flex flex-col justify-between shadow-card transition-all">
                  <span className="text-xs font-semibold text-[#8B95A7] uppercase tracking-wider">Net Balance</span>
                  <div className="mt-2 flex items-baseline justify-between">
                    <span className={`font-display text-2xl font-bold ${(summary.net_balance_kw || 0) >= 0 ? 'text-[#3DD68C]' : 'text-[#FF5C5C]'}`}>
                      {(summary.net_balance_kw || 0) >= 0 ? `+${summary.net_balance_kw}` : summary.net_balance_kw} kW
                    </span>
                    <span className="text-[10px] font-mono text-[#5A6478]">
                      {(summary.net_balance_kw || 0) >= 0 ? 'Surplus' : 'Deficit'}
                    </span>
                  </div>
                  <span className="text-xs text-[#5A6478] mt-1">Load demand: {summary.total_load_kw || 0} kW</span>
                </div>

                {/* Row 2 */}
                <div className={`bg-[#131922] border rounded-xl p-4 flex flex-col justify-between shadow-card transition-all ${isLowBattery ? 'border-[#FF5C5C] animate-pulse' : 'border-[#252E3D] hover:border-[#7C9EFF]/30'}`}>
                  <span className="text-xs font-semibold text-[#7C9EFF] uppercase tracking-wider">Battery SOC</span>
                  <div className="mt-2 flex items-baseline justify-between">
                    <span className={`font-display text-2xl font-bold ${isLowBattery ? 'text-[#FF5C5C]' : 'text-[#7C9EFF]'}`}>
                      {summary.battery_soc_percent || 0}%
                    </span>
                    <span className="text-[10px] font-mono text-[#7C9EFF]/70">400 kWh</span>
                  </div>
                  <span className="text-xs text-[#5A6478] mt-1">412 cycles · Health 98.5%</span>
                </div>

                <div className="bg-[#131922] border border-[#252E3D] rounded-xl p-4 flex flex-col justify-between shadow-card hover:border-[#3DD68C]/30 transition-all">
                  <span className="text-xs font-semibold text-[#3DD68C] uppercase tracking-wider">Renewable Fraction</span>
                  <div className="mt-2 flex items-baseline justify-between">
                    <span className="font-display text-2xl font-bold text-[#3DD68C]">{summary.renewable_fraction_pct || 0}%</span>
                    <span className="text-[10px] font-mono text-[#3DD68C]/70">Coverage</span>
                  </div>
                  <span className="text-xs text-[#5A6478] mt-1">Self-sufficiency: {summary.self_sufficiency_pct || 0}%</span>
                </div>

                <div className="bg-[#131922] border border-[#252E3D] rounded-xl p-4 flex flex-col justify-between shadow-card hover:border-[#F5A623]/30 transition-all">
                  <span className="text-xs font-semibold text-[#F5A623] uppercase tracking-wider">Cost Saved Today</span>
                  <div className="mt-2 flex items-baseline justify-between">
                    <span className="font-display text-2xl font-bold text-[#F5A623]">₹{(summary.cost_saved_today_inr || 0).toLocaleString()}</span>
                    <span className="text-[10px] font-mono text-[#F5A623]/70">Tariff</span>
                  </div>
                  <span className="text-xs text-[#5A6478] mt-1">Tamil Nadu ₹8/kWh rate</span>
                </div>

                <div className="bg-[#131922] border border-[#252E3D] rounded-xl p-4 flex flex-col justify-between shadow-card hover:border-[#4DD0C4]/30 transition-all">
                  <span className="text-xs font-semibold text-[#4DD0C4] uppercase tracking-wider">Carbon Offset</span>
                  <div className="mt-2 flex items-baseline justify-between">
                    <span className="font-display text-2xl font-bold text-[#4DD0C4]">{summary.carbon_saved_today_kg || 0} kg</span>
                    <span className="text-[10px] font-mono text-[#4DD0C4]/70">CO₂</span>
                  </div>
                  <span className="text-xs text-[#5A6478] mt-1">0.82 kg/kWh emission factor</span>
                </div>
              </>
            )}
          </div>

          {/* SECTION 2 — LIVE POWER FLOW DIAGRAM (CENTREPIECE SVG) */}
          <div className="bg-[#131922] border border-[#252E3D] rounded-xl p-5 shadow-card space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-display font-bold text-base text-[#E8EDF4]">Live Microgrid Power Flow Topology</h3>
                <p className="text-xs text-[#5A6478]">Real-time power routing across generation sources, battery storage, main AC bus, and clinical load</p>
              </div>
              <span className="px-2.5 py-1 rounded bg-[#1A2230] border border-[#252E3D] font-mono text-xs text-[#3DD68C] flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#3DD68C] animate-ping" />
                ACTIVE FLOW
              </span>
            </div>

            <div className="bg-[#0B0F14] border border-[#252E3D] rounded-xl p-4 relative overflow-hidden">
              <svg viewBox="0 0 800 300" className="w-full h-80">
                <defs>
                  <linearGradient id="solarGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#F5A623" stopOpacity="0.8" />
                    <stop offset="100%" stopColor="#F5A623" stopOpacity="0.3" />
                  </linearGradient>
                  <linearGradient id="windGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#4DD0C4" stopOpacity="0.8" />
                    <stop offset="100%" stopColor="#4DD0C4" stopOpacity="0.3" />
                  </linearGradient>
                </defs>

                {/* Animated Power Flow Path Lines */}
                {/* Solar A -> Inverter A */}
                <path d="M 130 45 L 240 75" stroke="#F5A623" strokeWidth="2.5" strokeDasharray="6 4" className="animate-dashflow" />
                {/* Solar B -> Inverter B */}
                <path d="M 130 105 L 240 195" stroke="#F5A623" strokeWidth="2.5" strokeDasharray="6 4" className="animate-dashflow" />
                {/* Wind 1 -> Inverter A */}
                <path d="M 130 165 L 240 75" stroke="#4DD0C4" strokeWidth="2" strokeDasharray="6 4" className="animate-dashflow" />
                {/* Wind 2 -> Inverter B */}
                <path d="M 130 225 L 240 195" stroke="#4DD0C4" strokeWidth="2" strokeDasharray="6 4" className="animate-dashflow" />
                
                {/* Inverter A -> Bus */}
                <path d="M 350 75 L 430 135" stroke="#8B95A7" strokeWidth="3" strokeDasharray="6 4" className="animate-dashflow" />
                {/* Inverter B -> Bus */}
                <path d="M 350 195 L 430 135" stroke="#8B95A7" strokeWidth="3" strokeDasharray="6 4" className="animate-dashflow" />

                {/* Bus -> Hospital Load */}
                <path d="M 530 135 L 630 75" stroke="#FF7849" strokeWidth="4" strokeDasharray="6 4" className="animate-dashflow" />
                {/* Bus -> Battery */}
                <path d="M 480 165 L 480 230" stroke="#7C9EFF" strokeWidth="3" strokeDasharray="6 4" className="animate-dashflow" />
                {/* Grid -> Bus */}
                <path d="M 630 195 L 530 135" stroke={isOutage ? '#FF5C5C' : '#3DD68C'} strokeWidth="3" strokeDasharray="6 4" className="animate-dashflow" />

                {/* NODES */}
                {/* Solar Array A */}
                <g transform="translate(30, 25)">
                  <rect width="100" height="40" rx="6" fill="#131922" stroke="#F5A623" strokeWidth="1.5" />
                  <text x="50" y="18" textAnchor="middle" fill="#E8EDF4" fontSize="10" fontWeight="bold">Solar Array A</text>
                  <text x="50" y="32" textAnchor="middle" fill="#F5A623" fontSize="11" fontFamily="JetBrains Mono" fontWeight="bold">{Math.round((summary.total_solar_kw || 0) * 0.5)} kW</text>
                </g>

                {/* Solar Array B */}
                <g transform="translate(30, 85)">
                  <rect width="100" height="40" rx="6" fill="#131922" stroke="#F5A623" strokeWidth="1.5" />
                  <text x="50" y="18" textAnchor="middle" fill="#E8EDF4" fontSize="10" fontWeight="bold">Solar Array B</text>
                  <text x="50" y="32" textAnchor="middle" fill="#F5A623" fontSize="11" fontFamily="JetBrains Mono" fontWeight="bold">{Math.round((summary.total_solar_kw || 0) * 0.5)} kW</text>
                </g>

                {/* Wind Turbine 1 */}
                <g transform="translate(30, 145)">
                  <rect width="100" height="40" rx="6" fill="#131922" stroke="#4DD0C4" strokeWidth="1.5" />
                  <text x="50" y="18" textAnchor="middle" fill="#E8EDF4" fontSize="10" fontWeight="bold">Wind Turbine 1</text>
                  <text x="50" y="32" textAnchor="middle" fill="#4DD0C4" fontSize="11" fontFamily="JetBrains Mono" fontWeight="bold">{Math.round((summary.total_wind_kw || 0) * 0.5)} kW</text>
                </g>

                {/* Wind Turbine 2 */}
                <g transform="translate(30, 205)">
                  <rect width="100" height="40" rx="6" fill="#131922" stroke="#4DD0C4" strokeWidth="1.5" />
                  <text x="50" y="18" textAnchor="middle" fill="#E8EDF4" fontSize="10" fontWeight="bold">Wind Turbine 2</text>
                  <text x="50" y="32" textAnchor="middle" fill="#4DD0C4" fontSize="11" fontFamily="JetBrains Mono" fontWeight="bold">{Math.round((summary.total_wind_kw || 0) * 0.5)} kW</text>
                </g>

                {/* Inverter Array A */}
                <g transform="translate(240, 55)">
                  <rect width="110" height="40" rx="6" fill="#1A2230" stroke="#8B95A7" strokeWidth="1.5" />
                  <text x="55" y="18" textAnchor="middle" fill="#E8EDF4" fontSize="10" fontWeight="bold">Inverter Array A</text>
                  <text x="55" y="32" textAnchor="middle" fill="#8B95A7" fontSize="11" fontFamily="JetBrains Mono">{Math.round(((summary.total_generation_kw || 0) * 0.5) * 0.96)} kW</text>
                </g>

                {/* Inverter Array B */}
                <g transform="translate(240, 175)">
                  <rect width="110" height="40" rx="6" fill="#1A2230" stroke="#8B95A7" strokeWidth="1.5" />
                  <text x="55" y="18" textAnchor="middle" fill="#E8EDF4" fontSize="10" fontWeight="bold">Inverter Array B</text>
                  <text x="55" y="32" textAnchor="middle" fill="#8B95A7" fontSize="11" fontFamily="JetBrains Mono">{Math.round(((summary.total_generation_kw || 0) * 0.5) * 0.96)} kW</text>
                </g>

                {/* Main AC Bus */}
                <g transform="translate(430, 115)">
                  <rect width="100" height="50" rx="8" fill="#131922" stroke="#E8EDF4" strokeWidth="2" className="animate-pulse" />
                  <text x="50" y="20" textAnchor="middle" fill="#E8EDF4" fontSize="11" fontWeight="bold">MAIN AC BUS</text>
                  <text x="50" y="38" textAnchor="middle" fill="#3DD68C" fontSize="13" fontFamily="JetBrains Mono" fontWeight="bold">{summary.total_generation_kw || 0} kW</text>
                </g>

                {/* Battery Storage */}
                <g transform="translate(430, 230)">
                  <rect width="100" height="45" rx="6" fill="#1A2230" stroke="#7C9EFF" strokeWidth="1.5" />
                  <text x="50" y="18" textAnchor="middle" fill="#E8EDF4" fontSize="10" fontWeight="bold">BESS Battery</text>
                  <text x="50" y="33" textAnchor="middle" fill="#7C9EFF" fontSize="11" fontFamily="JetBrains Mono" fontWeight="bold">{summary.battery_soc_percent || 0}% SOC</text>
                </g>

                {/* Hospital Load */}
                <g transform="translate(630, 55)">
                  <rect width="120" height="45" rx="6" fill="#131922" stroke="#FF7849" strokeWidth="2" />
                  <text x="60" y="18" textAnchor="middle" fill="#E8EDF4" fontSize="10" fontWeight="bold">HOSPITAL LOAD</text>
                  <text x="60" y="34" textAnchor="middle" fill="#FF7849" fontSize="12" fontFamily="JetBrains Mono" fontWeight="bold">{summary.total_load_kw || 0} kW</text>
                </g>

                {/* Main Grid Tie */}
                <g transform="translate(630, 175)">
                  <rect width="120" height="45" rx="6" fill="#131922" stroke={isOutage ? '#FF5C5C' : '#3DD68C'} strokeWidth="1.5" />
                  <text x="60" y="18" textAnchor="middle" fill="#E8EDF4" fontSize="10" fontWeight="bold">GRID TIE</text>
                  <text x="60" y="34" textAnchor="middle" fill={isOutage ? '#FF5C5C' : '#3DD68C'} fontSize="11" fontFamily="JetBrains Mono" fontWeight="bold">
                    {isOutage ? 'OFFLINE' : 'ONLINE'}
                  </text>
                </g>
              </svg>

              {/* Legend */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs pt-3 border-t border-[#252E3D] text-[#8B95A7]">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-[#F5A623]" />
                  <span>Solar PV Sources</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-[#4DD0C4]" />
                  <span>Wind Turbines</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-[#7C9EFF]" />
                  <span>Battery BESS Storage</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`w-3 h-3 rounded-full ${isOutage ? 'bg-[#FF5C5C]' : 'bg-[#3DD68C]'}`} />
                  <span>Grid Tie ({isOutage ? 'Outage' : 'Normal'})</span>
                </div>
              </div>
            </div>
          </div>

          {/* SECTION 3 — ASSET GRID (12 CARDS) */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-display font-bold text-base text-[#E8EDF4]">Physical Microgrid Asset Registry</h3>
              <span className="text-xs text-[#5A6478] font-mono">Showing all 12 assets</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {assetsRes.loading && assets.length === 0 ? (
                Array.from({ length: 12 }).map((_, idx) => (
                  <div key={idx} className="h-44 rounded-xl bg-[#131922] border border-[#252E3D] animate-pulse p-4 flex flex-col justify-between">
                    <div className="h-4 bg-[#252E3D] rounded w-1/2" />
                    <div className="h-8 bg-[#252E3D] rounded w-full" />
                  </div>
                ))
              ) : (
                assets.map((asset) => {
                  const isSelected = selectedAsset?.asset_id === asset.asset_id
                  return (
                    <div
                      key={asset.asset_id}
                      onClick={() => setSelectedAsset(asset)}
                      className={`bg-[#131922] border rounded-xl p-4 shadow-card hover:border-[#7C9EFF] cursor-pointer transition-all space-y-3 ${
                        isSelected ? 'ring-1 ring-[#7C9EFF] border-[#7C9EFF] bg-[#1A2230]' : 'border-[#252E3D]'
                      }`}
                    >
                      {/* Header */}
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2">
                          <AssetIcon type={asset.type} />
                          <div>
                            <h4 className="font-semibold text-xs text-[#E8EDF4]">{asset.name}</h4>
                            <span className="text-[10px] text-[#5A6478] font-mono">{asset.location}</span>
                          </div>
                        </div>
                        {renderStatusBadge(asset.status)}
                      </div>

                      {/* Output Bar */}
                      <div className="space-y-1">
                        <div className="flex justify-between text-[11px]">
                          <span className="text-[#8B95A7]">Output</span>
                          <span className="font-mono font-bold text-[#E8EDF4]">{asset.current_output_kw} kW</span>
                        </div>
                        <div className="w-full bg-[#1A2230] h-2 rounded-full overflow-hidden border border-[#252E3D]">
                          <div
                            className="h-full bg-[#7C9EFF] transition-all duration-500 rounded-full"
                            style={{ width: `${asset.output_percent}%` }}
                          />
                        </div>
                      </div>

                      {/* Efficiency & Temp */}
                      <div className="grid grid-cols-2 gap-2 text-[11px] pt-1">
                        <div className="bg-[#1A2230] p-1.5 rounded border border-[#252E3D]">
                          <span className="text-[#5A6478] block text-[10px]">Efficiency</span>
                          <span className="font-mono font-semibold text-[#3DD68C]">{asset.efficiency_percent}%</span>
                        </div>
                        <div className="bg-[#1A2230] p-1.5 rounded border border-[#252E3D]">
                          <span className="text-[#5A6478] block text-[10px]">Temp</span>
                          <span className="font-mono font-semibold text-[#F5A623]">{asset.temperature_c}°C</span>
                        </div>
                      </div>

                      {/* Health & Maint */}
                      <div className="flex items-center justify-between text-[11px] pt-1 border-t border-[#252E3D]">
                        <span className="text-[#5A6478]">Health</span>
                        {renderHealthBar(asset.health_score)}
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>

          {/* SECTION 5 — ANALYTICS CHARTS ROW (3 CHARTS) */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

            {/* Chart 1 — 24h Generation vs Load */}
            <div className="bg-[#131922] border border-[#252E3D] rounded-xl p-5 shadow-card flex flex-col justify-between">
              <div className="mb-4">
                <h3 className="font-display font-semibold text-sm text-[#E8EDF4]">24h Generation vs Load Profile</h3>
                <p className="text-xs text-[#5A6478]">Solar, wind, load, and battery SOC curve</p>
              </div>
              <div className="h-56 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={hourlyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#252E3D" />
                    <XAxis dataKey="time" stroke="#5A6478" tick={{ fill: '#5A6478', fontSize: 10 }} />
                    <YAxis yAxisId="left" stroke="#5A6478" tick={{ fill: '#5A6478', fontSize: 10 }} />
                    <YAxis yAxisId="right" orientation="right" domain={[0, 100]} stroke="#7C9EFF" tick={{ fill: '#7C9EFF', fontSize: 10 }} />
                    <Tooltip content={<CustomTooltip />} />
                    <Area yAxisId="left" type="monotone" dataKey="solar_kw" name="Solar kW" fill="#F5A623" fillOpacity={0.2} stroke="#F5A623" />
                    <Area yAxisId="left" type="monotone" dataKey="wind_kw" name="Wind kW" fill="#4DD0C4" fillOpacity={0.2} stroke="#4DD0C4" />
                    <Line yAxisId="left" type="monotone" dataKey="total_load_kw" name="Load kW" stroke="#FF7849" strokeWidth={2} dot={false} />
                    <Line yAxisId="right" type="monotone" dataKey="battery_soc" name="SOC %" stroke="#7C9EFF" strokeWidth={1.5} strokeDasharray="3 3" dot={false} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Chart 2 — Generation Source Breakdown */}
            <div className="bg-[#131922] border border-[#252E3D] rounded-xl p-5 shadow-card flex flex-col justify-between">
              <div className="mb-4">
                <h3 className="font-display font-semibold text-sm text-[#E8EDF4]">Generation Mix Breakdown</h3>
                <p className="text-xs text-[#5A6478]">Solar vs Wind vs Grid Import ratio</p>
              </div>
              <div className="h-56 w-full relative">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={75}
                      paddingAngle={4}
                    >
                      {pieData.map((entry, idx) => (
                        <Cell key={entry.name} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-[10px] text-[#5A6478] uppercase">Total Today</span>
                  <span className="font-mono font-bold text-sm text-[#E8EDF4]">{breakdown.total_today_kwh || 0} kWh</span>
                </div>
              </div>
              <div className="flex items-center justify-center gap-4 text-[11px] text-[#8B95A7] pt-2 border-t border-[#252E3D]">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#F5A623]" />
                  <span>Solar ({breakdown.solar_pct || 0}%)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#4DD0C4]" />
                  <span>Wind ({breakdown.wind_pct || 0}%)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#3DD68C]" />
                  <span>Grid ({breakdown.grid_pct || 0}%)</span>
                </div>
              </div>
            </div>

            {/* Chart 3 — 7-Day Energy Summary */}
            <div className="bg-[#131922] border border-[#252E3D] rounded-xl p-5 shadow-card flex flex-col justify-between">
              <div className="mb-4">
                <h3 className="font-display font-semibold text-sm text-[#E8EDF4]">7-Day Energy Trend</h3>
                <p className="text-xs text-[#5A6478]">Daily generation vs load vs grid import</p>
              </div>
              <div className="h-56 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={weeklyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#252E3D" />
                    <XAxis dataKey="day" stroke="#5A6478" tick={{ fill: '#5A6478', fontSize: 10 }} />
                    <YAxis stroke="#5A6478" tick={{ fill: '#5A6478', fontSize: 10 }} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="generation_kwh" name="Gen kWh" fill="#3DD68C" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="load_kwh" name="Load kWh" fill="#FF7849" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="grid_import_kwh" name="Grid kWh" fill="#7C9EFF" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

          </div>

          {/* SECTION 6 — SAVINGS & CARBON DASHBOARD */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* Left Card: Financial Savings */}
            <div className="bg-[#131922] border border-[#252E3D] rounded-xl p-5 shadow-card space-y-4">
              <h3 className="font-display font-bold text-sm text-[#E8EDF4]">Financial Savings Dashboard</h3>
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="bg-[#1A2230] p-3 rounded-lg border border-[#252E3D]">
                  <span className="text-[10px] text-[#5A6478] block">Today</span>
                  <span className="font-mono font-bold text-base text-[#F5A623]">₹{(savings.today_inr || 0).toLocaleString()}</span>
                </div>
                <div className="bg-[#1A2230] p-3 rounded-lg border border-[#252E3D]">
                  <span className="text-[10px] text-[#5A6478] block">This Week</span>
                  <span className="font-mono font-bold text-base text-[#F5A623]">₹{(savings.week_inr || 0).toLocaleString()}</span>
                </div>
                <div className="bg-[#1A2230] p-3 rounded-lg border border-[#252E3D]">
                  <span className="text-[10px] text-[#5A6478] block">Month (Proj)</span>
                  <span className="font-mono font-bold text-base text-[#3DD68C]">₹{(savings.month_inr_projected || 0).toLocaleString()}</span>
                </div>
              </div>
              <p className="text-xs text-[#5A6478]">Based on Tamil Nadu Industrial Electricity Tariff (₹8.00/kWh) avoided cost.</p>
            </div>

            {/* Right Card: Carbon Impact */}
            <div className="bg-[#131922] border border-[#252E3D] rounded-xl p-5 shadow-card space-y-4">
              <h3 className="font-display font-bold text-sm text-[#E8EDF4]">Environmental Impact</h3>
              <div className="grid grid-cols-4 gap-2 text-center text-xs">
                <div className="bg-[#1A2230] p-2.5 rounded-lg border border-[#252E3D]">
                  <span className="text-[10px] text-[#5A6478] block">CO₂ Today</span>
                  <span className="font-mono font-bold text-sm text-[#4DD0C4]">{savings.today_co2_kg || 0} kg</span>
                </div>
                <div className="bg-[#1A2230] p-2.5 rounded-lg border border-[#252E3D]">
                  <span className="text-[10px] text-[#5A6478] block">CO₂ Week</span>
                  <span className="font-mono font-bold text-sm text-[#4DD0C4]">{savings.week_co2_kg || 0} kg</span>
                </div>
                <div className="bg-[#1A2230] p-2.5 rounded-lg border border-[#252E3D]">
                  <span className="text-[10px] text-[#5A6478] block">Trees Equiv</span>
                  <span className="font-mono font-bold text-sm text-[#3DD68C]">{savings.equivalent_trees || 0} 🌳</span>
                </div>
                <div className="bg-[#1A2230] p-2.5 rounded-lg border border-[#252E3D]">
                  <span className="text-[10px] text-[#5A6478] block">Cars Off Road</span>
                  <span className="font-mono font-bold text-sm text-[#7C9EFF]">{savings.equivalent_car_days || 0} 🚗</span>
                </div>
              </div>
              <p className="text-xs text-[#5A6478]">Calculated using 0.82 kg CO₂/kWh grid emission factor for Tamil Nadu power grid.</p>
            </div>

          </div>

          {/* SECTION 7 — EVENTS FEED */}
          <div className="bg-[#131922] border border-[#252E3D] rounded-xl p-5 shadow-card space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h3 className="font-display font-bold text-base text-[#E8EDF4]">Microgrid Event Log</h3>
                {unackEvents.length > 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-[#FF5C5C]/20 text-[#FF5C5C] border border-[#FF5C5C]/30 text-xs font-mono font-semibold">
                    {unackEvents.length} Unacknowledged
                  </span>
                )}
              </div>
              <span className="text-xs text-[#5A6478] font-mono">Recent 50 Events</span>
            </div>

            <div className="overflow-x-auto rounded-lg border border-[#252E3D]">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-[#1A2230] text-[#8B95A7] border-b border-[#252E3D] font-mono text-[11px] uppercase">
                    <th className="py-3 px-4">Timestamp</th>
                    <th className="py-3 px-4">Asset</th>
                    <th className="py-3 px-4">Severity</th>
                    <th className="py-3 px-4">Event Description</th>
                    <th className="py-3 px-4">Value</th>
                    <th className="py-3 px-4">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#252E3D]">
                  {events.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-[#5A6478] font-mono">
                        All microgrid systems nominal — no events recorded.
                      </td>
                    </tr>
                  ) : (
                    events.map((ev) => {
                      const isAck = ev.acknowledged === 1 || acknowledgedEvents[ev.id]
                      let sevStyle = 'bg-[#3DD68C]/10 text-[#3DD68C] border-[#3DD68C]/30'
                      if (ev.severity === 'WARNING') sevStyle = 'bg-[#F5A623]/10 text-[#F5A623] border-[#F5A623]/30'
                      if (ev.severity === 'CRITICAL') sevStyle = 'bg-[#FF5C5C]/10 text-[#FF5C5C] border-[#FF5C5C]/30 animate-pulse'

                      return (
                        <tr key={ev.id} className={`hover:bg-[#1A2230]/50 transition-colors ${isAck ? 'opacity-50' : ''}`}>
                          <td className="py-3 px-4 font-mono text-[#5A6478] text-[11px]">{ev.timestamp}</td>
                          <td className="py-3 px-4 font-semibold text-[#E8EDF4]">{ev.asset_name}</td>
                          <td className="py-3 px-4">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold border ${sevStyle}`}>
                              {ev.severity}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-[#8B95A7]">{ev.message}</td>
                          <td className="py-3 px-4 font-mono text-[#7C9EFF]">{ev.value}</td>
                          <td className="py-3 px-4">
                            {!isAck ? (
                              <button
                                onClick={() => handleAcknowledge(ev.id)}
                                className="px-2.5 py-1 rounded bg-[#1A2230] border border-[#252E3D] hover:border-[#7C9EFF] text-[#E8EDF4] hover:text-[#7C9EFF] text-[11px] transition-colors"
                              >
                                Acknowledge
                              </button>
                            ) : (
                              <span className="text-[11px] text-[#5A6478] font-mono">Acknowledged</span>
                            )}
                          </td>
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

      {/* SECTION 4 — ASSET DETAIL SIDE PANEL (460px RIGHT DRAWER) */}
      {selectedAsset && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm transition-opacity">
          <div className="flex-1" onClick={() => setSelectedAsset(null)} />

          <div className="w-[460px] bg-[#131922] border-l border-[#252E3D] h-full overflow-y-auto p-6 space-y-6 shadow-2xl flex flex-col justify-between">
            <div className="space-y-6">
              {/* Header */}
              <div className="flex items-start justify-between pb-4 border-b border-[#252E3D]">
                <div>
                  <div className="flex items-center gap-2">
                    <AssetIcon type={selectedAsset.type} className="w-6 h-6" />
                    <h2 className="font-display font-bold text-xl text-[#E8EDF4]">{selectedAsset.name}</h2>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="font-mono text-xs text-[#7C9EFF]">{selectedAsset.asset_id}</span>
                    <span className="text-[#5A6478]">·</span>
                    {renderStatusBadge(selectedAsset.status)}
                  </div>
                </div>
                <button
                  onClick={() => setSelectedAsset(null)}
                  className="w-8 h-8 rounded-lg bg-[#1A2230] border border-[#252E3D] text-[#8B95A7] hover:text-white flex items-center justify-center transition-colors"
                >
                  ✕
                </button>
              </div>

              {/* Asset Info 2x3 Grid */}
              <div className="bg-[#1A2230] border border-[#252E3D] rounded-xl p-4 space-y-3">
                <h3 className="text-xs font-semibold text-[#8B95A7] uppercase tracking-wider">Asset Specifications</h3>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-[#5A6478] block">Manufacturer</span>
                    <span className="font-medium text-[#E8EDF4]">{selectedAsset.manufacturer}</span>
                  </div>
                  <div>
                    <span className="text-[#5A6478] block">Model</span>
                    <span className="font-mono text-[#7C9EFF]">{selectedAsset.model_number}</span>
                  </div>
                  <div>
                    <span className="text-[#5A6478] block">Location</span>
                    <span className="font-medium text-[#E8EDF4]">{selectedAsset.location}</span>
                  </div>
                  <div>
                    <span className="text-[#5A6478] block">Installed Year</span>
                    <span className="font-mono text-[#E8EDF4]">{selectedAsset.installed_year}</span>
                  </div>
                  <div>
                    <span className="text-[#5A6478] block">Last Maint</span>
                    <span className="font-mono text-[#8B95A7]">{selectedAsset.last_maintenance}</span>
                  </div>
                  <div>
                    <span className="text-[#5A6478] block">Next Maint</span>
                    <span className="font-mono text-[#F5A623]">{selectedAsset.next_maintenance}</span>
                  </div>
                </div>
              </div>

              {/* Live Performance 2x3 Grid */}
              <div className="bg-[#1A2230] border border-[#252E3D] rounded-xl p-4 space-y-3">
                <h3 className="text-xs font-semibold text-[#8B95A7] uppercase tracking-wider">Live Performance Telemetry</h3>
                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="bg-[#131922] p-2 rounded-lg border border-[#252E3D]">
                    <span className="text-[10px] text-[#5A6478] block">Output</span>
                    <span className="font-mono font-bold text-[#E8EDF4]">{selectedAsset.current_output_kw} kW</span>
                  </div>
                  <div className="bg-[#131922] p-2 rounded-lg border border-[#252E3D]">
                    <span className="text-[10px] text-[#5A6478] block">Capacity</span>
                    <span className="font-mono font-bold text-[#8B95A7]">{selectedAsset.capacity_kw} kW</span>
                  </div>
                  <div className="bg-[#131922] p-2 rounded-lg border border-[#252E3D]">
                    <span className="text-[10px] text-[#5A6478] block">Load Pct</span>
                    <span className="font-mono font-bold text-[#7C9EFF]">{selectedAsset.output_percent}%</span>
                  </div>
                  <div className="bg-[#131922] p-2 rounded-lg border border-[#252E3D]">
                    <span className="text-[10px] text-[#5A6478] block">Daily kWh</span>
                    <span className="font-mono font-bold text-[#3DD68C]">{selectedAsset.daily_generation_kwh}</span>
                  </div>
                  <div className="bg-[#131922] p-2 rounded-lg border border-[#252E3D]">
                    <span className="text-[10px] text-[#5A6478] block">Efficiency</span>
                    <span className="font-mono font-bold text-[#F5A623]">{selectedAsset.efficiency_percent}%</span>
                  </div>
                  <div className="bg-[#131922] p-2 rounded-lg border border-[#252E3D]">
                    <span className="text-[10px] text-[#5A6478] block">Temp</span>
                    <span className="font-mono font-bold text-[#FF7849]">{selectedAsset.temperature_c}°C</span>
                  </div>
                </div>
              </div>

              {/* Sparkline Chart */}
              <div className="bg-[#1A2230] border border-[#252E3D] rounded-xl p-4 space-y-2">
                <h3 className="text-xs font-semibold text-[#8B95A7] uppercase tracking-wider">24h Output Trend Sparkline</h3>
                <div className="h-20 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={getAssetSparklineData(selectedAsset)}>
                      <Area type="monotone" dataKey="kw" stroke="#7C9EFF" fill="#7C9EFF" fillOpacity={0.2} strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Health Assessment Card */}
              <div className="bg-[#1A2230] border border-[#252E3D] rounded-xl p-4 space-y-3">
                <h3 className="text-xs font-semibold text-[#8B95A7] uppercase tracking-wider">Health & Lifecycle Prognostics</h3>
                <div className="flex items-center justify-between">
                  <div className="font-display font-extrabold text-3xl text-[#3DD68C]">
                    {selectedAsset.health_score}%
                  </div>
                  <span className="text-xs text-[#5A6478] font-mono">Degradation: 0.001%/hr</span>
                </div>
                <div className="w-full bg-[#131922] h-2.5 rounded-full overflow-hidden border border-[#252E3D]">
                  <div className="h-full bg-[#3DD68C] rounded-full" style={{ width: `${selectedAsset.health_score}%` }} />
                </div>
                <p className="text-xs text-[#8B95A7]">Estimated remaining operational life: <span className="text-[#E8EDF4] font-semibold">~14.2 years</span> based on measured degradation rate.</p>
              </div>

              {/* Maintenance Notes */}
              <div className="bg-[#1A2230] border border-[#252E3D] rounded-xl p-4 space-y-2">
                <h3 className="text-xs font-semibold text-[#8B95A7] uppercase tracking-wider">Maintenance Notes</h3>
                <p className="text-xs text-[#5A6478] italic">
                  Scheduled preventive maintenance check up to date. Inverter calibration and thermal paste check performed on {selectedAsset.last_maintenance}. Next inspection due in {selectedAsset.next_maintenance}.
                </p>
              </div>
            </div>

            <div className="pt-4 border-t border-[#252E3D] text-center">
              <button
                onClick={() => setSelectedAsset(null)}
                className="w-full py-2 bg-[#1A2230] border border-[#252E3D] hover:bg-[#252E3D] text-[#E8EDF4] rounded-lg text-xs font-semibold transition-colors"
              >
                Close Asset Drawer
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
