import React, { useState, useEffect, useMemo, useRef } from 'react'
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
} from 'recharts'
import Sidebar from '../components/Sidebar.jsx'
import Header from '../components/Header.jsx'
import { usePolledEndpoint } from '../useApi.js'

const DEVICE_INFO = {
  Ventilator: { icon: '🫁', watts: '150W', priority: 'Critical' },
  Oxygen_Concentrator: { icon: '🌬️', watts: '300W', priority: 'Critical' },
  Cardiac_Monitor: { icon: '🫀', watts: '45W', priority: 'High' },
  Infusion_Pump: { icon: '💉', watts: '30W', priority: 'High' },
  Dialysis_Machine: { icon: '🩺', watts: '750W', priority: 'Critical' },
  Feeding_Pump: { icon: '🍼', watts: '25W', priority: 'Medium' },
  Suction_Machine: { icon: '🧪', watts: '90W', priority: 'High' },
  Warming_Blanket: { icon: '🌡️', watts: '200W', priority: 'Medium' },
}

function formatDeptName(dept) {
  if (!dept) return ''
  return dept.replace(/_/g, ' ')
}

function getDeterministicVitals(patient) {
  if (!patient) return { hr: 75, spo2: 98, bp: '120/80' }
  const pid = patient.patient_id || 'PT-0000'
  let hash = 0
  for (let i = 0; i < pid.length; i++) {
    hash = (hash << 5) - hash + pid.charCodeAt(i)
    hash |= 0
  }
  const posHash = Math.abs(hash)
  const condition = patient.condition

  let hr, spo2, sys, dia
  if (condition === 'Critical') {
    hr = 115 + (posHash % 30)
    spo2 = 84 + (posHash % 8)
    sys = 145 + (posHash % 25)
    dia = 95 + (posHash % 15)
  } else if (condition === 'Serious') {
    hr = 95 + (posHash % 20)
    spo2 = 92 + (posHash % 4)
    sys = 130 + (posHash % 15)
    dia = 85 + (posHash % 10)
  } else {
    hr = 68 + (posHash % 18)
    spo2 = 96 + (posHash % 4)
    sys = 115 + (posHash % 12)
    dia = 75 + (posHash % 10)
  }

  return { hr, spo2, bp: `${sys}/${dia}` }
}

const CustomTooltip = ({ active, payload }) => {
  if (active && payload && payload.length) {
    const data = payload[0]
    return (
      <div className="bg-[#1A2230] border border-[#252E3D] px-3 py-2 rounded-lg shadow-xl text-xs">
        <span className="font-semibold text-[#E8EDF4]">{formatDeptName(data.name || data.payload?.name)}: </span>
        <span className="font-mono text-[#7C9EFF] font-bold">{data.value}</span>
      </div>
    )
  }
  return null
}

export default function Patients() {
  // Filters & State
  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [selectedDept, setSelectedDept] = useState('')
  const [selectedCondition, setSelectedCondition] = useState('')
  const [selectedStatus, setSelectedStatus] = useState('')
  const [sortColumn, setSortColumn] = useState('ai_score')
  const [sortDirection, setSortDirection] = useState('desc')
  const [currentPage, setCurrentPage] = useState(1)
  const [selectedPatient, setSelectedPatient] = useState(null)

  // Flash rows on condition change
  const [flashedIds, setFlashedIds] = useState({})
  const prevConditionsRef = useRef({})

  // Polling Endpoints
  const summaryRes = usePolledEndpoint('/patients/summary', 10000)
  const patientsRes = usePolledEndpoint('/patients?limit=300', 15000)
  const deptStatsRes = usePolledEndpoint('/patients/department-stats', 30000)

  // Debounce Search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery)
      setCurrentPage(1)
    }, 300)
    return () => clearTimeout(timer)
  }, [searchQuery])

  // Track condition changes between polls
  useEffect(() => {
    if (patientsRes.data?.patients) {
      const newFlashes = {}
      const prev = prevConditionsRef.current
      patientsRes.data.patients.forEach((p) => {
        if (prev[p.patient_id] && prev[p.patient_id] !== p.condition) {
          newFlashes[p.patient_id] = true
        }
        prev[p.patient_id] = p.condition
      })

      if (Object.keys(newFlashes).length > 0) {
        setFlashedIds((prev) => ({ ...prev, ...newFlashes }))
        setTimeout(() => {
          setFlashedIds((prev) => {
            const next = { ...prev }
            Object.keys(newFlashes).forEach((id) => delete next[id])
            return next
          })
        }, 1000)
      }
    }
  }, [patientsRes.data])

  // Client-side filtering
  const allPatients = patientsRes.data?.patients || []
  const filteredPatients = useMemo(() => {
    return allPatients.filter((p) => {
      if (debouncedSearch) {
        const q = debouncedSearch.toLowerCase()
        const matchName = p.name?.toLowerCase().includes(q)
        const matchId = p.patient_id?.toLowerCase().includes(q)
        const matchBed = p.bed_number?.toLowerCase().includes(q)
        if (!matchName && !matchId && !matchBed) return false
      }
      if (selectedDept && p.department !== selectedDept) return false
      if (selectedCondition && p.condition !== selectedCondition) return false
      if (selectedStatus && p.status !== selectedStatus) return false
      return true
    })
  }, [allPatients, debouncedSearch, selectedDept, selectedCondition, selectedStatus])

  // Sorting
  const sortedPatients = useMemo(() => {
    return [...filteredPatients].sort((a, b) => {
      let valA = a[sortColumn]
      let valB = b[sortColumn]

      if (typeof valA === 'string') valA = valA.toLowerCase()
      if (typeof valB === 'string') valB = valB.toLowerCase()

      if (valA < valB) return sortDirection === 'asc' ? -1 : 1
      if (valA > valB) return sortDirection === 'asc' ? 1 : -1
      return 0
    })
  }, [filteredPatients, sortColumn, sortDirection])

  // Pagination
  const pageSize = 15
  const totalPages = Math.max(1, Math.ceil(sortedPatients.length / pageSize))
  const safePage = Math.min(currentPage, totalPages)
  const paginatedPatients = sortedPatients.slice((safePage - 1) * pageSize, safePage * pageSize)

  const handleSort = (col) => {
    if (sortColumn === col) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortColumn(col)
      setSortDirection('desc')
    }
  }

  const summary = summaryRes.data || {}
  const stats = deptStatsRes.data || {}

  // Format last updated timestamp
  const lastUpdatedTime = patientsRes.lastUpdated
    ? patientsRes.lastUpdated.toLocaleTimeString()
    : 'Polling...'

  // Helper Badge Renderers
  const renderConditionBadge = (cond) => {
    let style = 'bg-[#3DD68C]/10 text-[#3DD68C] border-[#3DD68C]/30'
    if (cond === 'Critical') style = 'bg-[#FF5C5C]/10 text-[#FF5C5C] border-[#FF5C5C]/30 animate-pulse'
    if (cond === 'Serious') style = 'bg-[#F5A623]/10 text-[#F5A623] border-[#F5A623]/30'

    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${style}`}>
        {cond}
      </span>
    )
  }

  const renderPriorityBadge = (tier) => {
    let style = 'bg-[#5A6478]/10 text-[#8B95A7] border-[#5A6478]/30'
    if (tier === 'Critical') style = 'bg-[#FF5C5C]/10 text-[#FF5C5C] border-[#FF5C5C]/30'
    if (tier === 'High') style = 'bg-[#F5A623]/10 text-[#F5A623] border-[#F5A623]/30'
    if (tier === 'Medium') style = 'bg-[#7C9EFF]/10 text-[#7C9EFF] border-[#7C9EFF]/30'

    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-mono font-medium border ${style}`}>
        {tier}
      </span>
    )
  }

  const renderAiScore = (score) => {
    let barColor = 'bg-[#3DD68C]'
    let textColor = 'text-[#3DD68C]'
    if (score >= 70) {
      barColor = 'bg-[#FF5C5C]'
      textColor = 'text-[#FF5C5C]'
    } else if (score >= 40) {
      barColor = 'bg-[#F5A623]'
      textColor = 'text-[#F5A623]'
    }

    return (
      <div className="flex items-center gap-2">
        <span className={`font-mono font-bold text-sm w-7 ${textColor}`}>{score}</span>
        <div className="w-16 bg-[#252E3D] h-2 rounded-full overflow-hidden flex-1">
          <div className={`h-full ${barColor} transition-all duration-500`} style={{ width: `${score}%` }} />
        </div>
      </div>
    )
  }

  // Chart Color Mappings
  const DEPT_COLORS = {
    ICU: '#FF5C5C',
    Operation_Theatre: '#F5A623',
    Emergency_Department: '#FF7849',
    General_Ward: '#7C9EFF',
    Oxygen_Plant_Dependent: '#8B95A7',
  }

  const COND_COLORS = {
    Critical: '#FF5C5C',
    Serious: '#F5A623',
    Stable: '#3DD68C',
  }

  const PRIORITY_COLORS = {
    Critical: '#FF5C5C',
    High: '#F5A623',
    Medium: '#7C9EFF',
    Low: '#5A6478',
  }

  return (
    <div className="flex h-screen overflow-hidden bg-[#0B0F14] font-body text-[#E8EDF4]">
      <Sidebar />
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <Header title="Patient Management & Clinical Triage" />
        <main className="flex-1 overflow-y-auto px-6 py-5 space-y-6">

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
                  <span className="text-xs font-semibold text-[#8B95A7] uppercase tracking-wider">Total Active</span>
                  <div className="mt-2 flex items-baseline justify-between">
                    <span className="font-display text-2xl font-bold text-[#E8EDF4]">{summary.total_active || 0}</span>
                    <span className="text-[10px] text-[#5A6478] font-mono">Patients</span>
                  </div>
                  <span className="text-xs text-[#5A6478] mt-1">Active admitted load</span>
                </div>

                <div className="bg-[#131922] border border-[#252E3D] rounded-xl p-4 flex flex-col justify-between shadow-card hover:border-[#FF5C5C]/30 transition-all">
                  <span className="text-xs font-semibold text-[#FF5C5C] uppercase tracking-wider">ICU</span>
                  <div className="mt-2 flex items-baseline justify-between">
                    <span className="font-display text-2xl font-bold text-[#FF5C5C]">{summary.icu_count || 0}</span>
                    <span className="text-[10px] text-[#FF5C5C]/70 font-mono">Critical</span>
                  </div>
                  <span className="text-xs text-[#5A6478] mt-1">Intensive care beds</span>
                </div>

                <div className="bg-[#131922] border border-[#252E3D] rounded-xl p-4 flex flex-col justify-between shadow-card hover:border-[#F5A623]/30 transition-all">
                  <span className="text-xs font-semibold text-[#F5A623] uppercase tracking-wider">Emergency</span>
                  <div className="mt-2 flex items-baseline justify-between">
                    <span className="font-display text-2xl font-bold text-[#F5A623]">{summary.emergency_count || 0}</span>
                    <span className="text-[10px] text-[#F5A623]/70 font-mono">ED</span>
                  </div>
                  <span className="text-xs text-[#5A6478] mt-1">Trauma & triage</span>
                </div>

                <div className="bg-[#131922] border border-[#252E3D] rounded-xl p-4 flex flex-col justify-between shadow-card hover:border-[#7C9EFF]/30 transition-all">
                  <span className="text-xs font-semibold text-[#7C9EFF] uppercase tracking-wider">General Ward</span>
                  <div className="mt-2 flex items-baseline justify-between">
                    <span className="font-display text-2xl font-bold text-[#7C9EFF]">{summary.general_ward_count || 0}</span>
                    <span className="text-[10px] text-[#7C9EFF]/70 font-mono">Ward</span>
                  </div>
                  <span className="text-xs text-[#5A6478] mt-1">Standard care beds</span>
                </div>

                <div className="bg-[#131922] border border-[#252E3D] rounded-xl p-4 flex flex-col justify-between shadow-card hover:border-[#4DD0C4]/30 transition-all">
                  <span className="text-xs font-semibold text-[#4DD0C4] uppercase tracking-wider">In Surgery</span>
                  <div className="mt-2 flex items-baseline justify-between">
                    <span className="font-display text-2xl font-bold text-[#4DD0C4]">{summary.in_surgery_count || 0}</span>
                    <span className="text-[10px] text-[#4DD0C4]/70 font-mono">OT</span>
                  </div>
                  <span className="text-xs text-[#5A6478] mt-1">Operating theatre</span>
                </div>

                <div className="bg-[#131922] border border-[#252E3D] rounded-xl p-4 flex flex-col justify-between shadow-card hover:border-[#FF7849]/30 transition-all">
                  <span className="text-xs font-semibold text-[#FF7849] uppercase tracking-wider">On Life Support</span>
                  <div className="mt-2 flex items-baseline justify-between">
                    <span className="font-display text-2xl font-bold text-[#FF7849]">{summary.life_support_count || 0}</span>
                    <span className="text-[10px] text-[#FF7849]/70 font-mono">Devices</span>
                  </div>
                  <span className="text-xs text-[#5A6478] mt-1">Active equipment draw</span>
                </div>
              </>
            )}
          </div>

          {/* SECTION 2 — FILTER BAR & TABLE */}
          <div className="bg-[#131922] border border-[#252E3D] rounded-xl p-5 shadow-card space-y-4">
            
            {/* Filter controls */}
            <div className="flex flex-wrap items-center justify-between gap-3 pb-2 border-b border-[#252E3D]">
              <div className="flex flex-wrap items-center gap-3 flex-1 min-w-[300px]">
                {/* Search input */}
                <div className="relative min-w-[220px]">
                  <input
                    type="text"
                    placeholder="Search name, ID, bed..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-[#1A2230] border border-[#252E3D] text-[#E8EDF4] text-xs rounded-lg px-3 py-2 pl-8 focus:border-[#7C9EFF] focus:outline-none transition-colors placeholder-[#5A6478]"
                  />
                  <span className="absolute left-2.5 top-2 text-xs text-[#5A6478]">🔍</span>
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2.5 top-2 text-xs text-[#8B95A7] hover:text-white"
                    >
                      ✕
                    </button>
                  )}
                </div>

                {/* Department Dropdown */}
                <select
                  value={selectedDept}
                  onChange={(e) => { setSelectedDept(e.target.value); setCurrentPage(1); }}
                  className="bg-[#1A2230] border border-[#252E3D] text-[#E8EDF4] text-xs rounded-lg px-3 py-2 focus:border-[#7C9EFF] focus:outline-none transition-colors"
                >
                  <option value="">All Departments</option>
                  <option value="ICU">ICU</option>
                  <option value="Operation_Theatre">Operation Theatre</option>
                  <option value="Emergency_Department">Emergency Dept</option>
                  <option value="General_Ward">General Ward</option>
                  <option value="Oxygen_Plant_Dependent">Oxygen Plant Dependent</option>
                </select>

                {/* Condition Dropdown */}
                <select
                  value={selectedCondition}
                  onChange={(e) => { setSelectedCondition(e.target.value); setCurrentPage(1); }}
                  className="bg-[#1A2230] border border-[#252E3D] text-[#E8EDF4] text-xs rounded-lg px-3 py-2 focus:border-[#7C9EFF] focus:outline-none transition-colors"
                >
                  <option value="">All Conditions</option>
                  <option value="Critical">Critical</option>
                  <option value="Serious">Serious</option>
                  <option value="Stable">Stable</option>
                </select>

                {/* Status Dropdown */}
                <select
                  value={selectedStatus}
                  onChange={(e) => { setSelectedStatus(e.target.value); setCurrentPage(1); }}
                  className="bg-[#1A2230] border border-[#252E3D] text-[#E8EDF4] text-xs rounded-lg px-3 py-2 focus:border-[#7C9EFF] focus:outline-none transition-colors"
                >
                  <option value="">All Statuses</option>
                  <option value="Admitted">Admitted</option>
                  <option value="Surgery">Surgery</option>
                  <option value="Recovery">Recovery</option>
                  <option value="Discharged">Discharged</option>
                </select>

                {(selectedDept || selectedCondition || selectedStatus || searchQuery) && (
                  <button
                    onClick={() => {
                      setSearchQuery('')
                      setSelectedDept('')
                      setSelectedCondition('')
                      setSelectedStatus('')
                      setCurrentPage(1)
                    }}
                    className="text-xs text-[#7C9EFF] hover:underline"
                  >
                    Reset Filters
                  </button>
                )}
              </div>

              {/* Timestamp */}
              <div className="flex items-center gap-2 text-xs font-mono text-[#5A6478]">
                <span className="w-2 h-2 rounded-full bg-[#3DD68C] animate-ping" />
                <span>Updated: {lastUpdatedTime}</span>
              </div>
            </div>

            {/* Patients Table */}
            <div className="overflow-x-auto rounded-lg border border-[#252E3D]">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-[#1A2230] text-[#8B95A7] border-b border-[#252E3D] font-mono text-[11px] uppercase">
                    <th className="py-3 px-4 cursor-pointer hover:text-white" onClick={() => handleSort('patient_id')}>
                      Patient ID {sortColumn === 'patient_id' && (sortDirection === 'asc' ? '↑' : '↓')}
                    </th>
                    <th className="py-3 px-4 cursor-pointer hover:text-white" onClick={() => handleSort('name')}>
                      Name {sortColumn === 'name' && (sortDirection === 'asc' ? '↑' : '↓')}
                    </th>
                    <th className="py-3 px-4 cursor-pointer hover:text-white" onClick={() => handleSort('age')}>
                      Age {sortColumn === 'age' && (sortDirection === 'asc' ? '↑' : '↓')}
                    </th>
                    <th className="py-3 px-4 cursor-pointer hover:text-white" onClick={() => handleSort('department')}>
                      Dept {sortColumn === 'department' && (sortDirection === 'asc' ? '↑' : '↓')}
                    </th>
                    <th className="py-3 px-4">Bed</th>
                    <th className="py-3 px-4 cursor-pointer hover:text-white" onClick={() => handleSort('condition')}>
                      Condition {sortColumn === 'condition' && (sortDirection === 'asc' ? '↑' : '↓')}
                    </th>
                    <th className="py-3 px-4 cursor-pointer hover:text-white" onClick={() => handleSort('ai_score')}>
                      AI Score {sortColumn === 'ai_score' && (sortDirection === 'asc' ? '↑' : '↓')}
                    </th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 cursor-pointer hover:text-white" onClick={() => handleSort('energy_priority')}>
                      Energy Priority {sortColumn === 'energy_priority' && (sortDirection === 'asc' ? '↑' : '↓')}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#252E3D]">
                  {patientsRes.loading && paginatedPatients.length === 0 ? (
                    Array.from({ length: 8 }).map((_, idx) => (
                      <tr key={idx} className="animate-pulse bg-[#131922]">
                        <td colSpan={9} className="py-3 px-4">
                          <div className="h-4 bg-[#252E3D] rounded w-full" />
                        </td>
                      </tr>
                    ))
                  ) : paginatedPatients.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-8 text-center text-[#5A6478] font-mono">
                        No patient records match the selected filters.
                      </td>
                    </tr>
                  ) : (
                    paginatedPatients.map((p, idx) => {
                      const isFlashed = flashedIds[p.patient_id]
                      const rowBg = isFlashed
                        ? 'bg-yellow-500/20 transition-colors duration-1000'
                        : idx % 2 === 0
                        ? 'bg-[#131922] hover:bg-[#1A2230]'
                        : 'bg-[#1A2230] hover:bg-[#252E3D]/50'

                      const isSelected = selectedPatient?.patient_id === p.patient_id

                      return (
                        <tr
                          key={p.patient_id}
                          onClick={() => setSelectedPatient(p)}
                          className={`cursor-pointer transition-colors ${rowBg} ${isSelected ? 'ring-1 ring-[#7C9EFF] bg-[#1A2230]' : ''}`}
                        >
                          <td className="py-3 px-4 font-mono font-semibold text-[#7C9EFF]">{p.patient_id}</td>
                          <td className="py-3 px-4 font-medium text-[#E8EDF4]">{p.name}</td>
                          <td className="py-3 px-4 text-[#8B95A7] font-mono">{p.age}</td>
                          <td className="py-3 px-4 text-[#8B95A7]">{formatDeptName(p.department)}</td>
                          <td className="py-3 px-4 font-mono text-[11px] text-[#5A6478]">{p.bed_number}</td>
                          <td className="py-3 px-4">{renderConditionBadge(p.condition)}</td>
                          <td className="py-3 px-4">{renderAiScore(p.ai_score)}</td>
                          <td className="py-3 px-4 text-[#8B95A7] text-[11px] font-mono">{p.status}</td>
                          <td className="py-3 px-4">{renderPriorityBadge(p.energy_priority)}</td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            <div className="flex items-center justify-between pt-2 text-xs text-[#8B95A7]">
              <span>
                Showing {sortedPatients.length > 0 ? (safePage - 1) * pageSize + 1 : 0}–
                {Math.min(safePage * pageSize, sortedPatients.length)} of {sortedPatients.length} patients
              </span>
              <div className="flex items-center gap-2">
                <button
                  disabled={safePage <= 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  className="px-3 py-1.5 rounded-md bg-[#1A2230] border border-[#252E3D] text-[#E8EDF4] disabled:opacity-40 disabled:cursor-not-allowed hover:border-[#7C9EFF] transition-colors"
                >
                  Previous
                </button>
                <span className="font-mono text-xs px-2 text-[#5A6478]">
                  Page {safePage} of {totalPages}
                </span>
                <button
                  disabled={safePage >= totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  className="px-3 py-1.5 rounded-md bg-[#1A2230] border border-[#252E3D] text-[#E8EDF4] disabled:opacity-40 disabled:cursor-not-allowed hover:border-[#7C9EFF] transition-colors"
                >
                  Next
                </button>
              </div>
            </div>

          </div>

          {/* SECTION 4 — 3 RECHARTS CHARTS */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Chart 1: Department Breakdown */}
            <div className="bg-[#131922] border border-[#252E3D] rounded-xl p-5 shadow-card flex flex-col justify-between">
              <div className="mb-4">
                <h3 className="font-display font-semibold text-sm text-[#E8EDF4]">Patients by Department</h3>
                <p className="text-xs text-[#5A6478]">Live distribution across clinical wards</p>
              </div>
              <div className="h-56 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={stats.departments || []}
                      dataKey="count"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={75}
                      paddingAngle={3}
                    >
                      {(stats.departments || []).map((entry) => (
                        <Cell key={entry.name} fill={DEPT_COLORS[entry.name] || '#8B95A7'} />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-3 text-[11px] text-[#8B95A7] pt-2 border-t border-[#252E3D]">
                {(stats.departments || []).map((d) => (
                  <div key={d.name} className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: DEPT_COLORS[d.name] || '#8B95A7' }} />
                    <span>{formatDeptName(d.name)} ({d.count})</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Chart 2: Condition Distribution */}
            <div className="bg-[#131922] border border-[#252E3D] rounded-xl p-5 shadow-card flex flex-col justify-between">
              <div className="mb-4">
                <h3 className="font-display font-semibold text-sm text-[#E8EDF4]">Clinical Condition Triage</h3>
                <p className="text-xs text-[#5A6478]">Patient severity distribution</p>
              </div>
              <div className="h-56 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart layout="vertical" data={stats.conditions || []} margin={{ top: 10, right: 20, left: 20, bottom: 5 }}>
                    <XAxis type="number" stroke="#5A6478" tick={{ fill: '#5A6478', fontSize: 11 }} />
                    <YAxis dataKey="name" type="category" stroke="#5A6478" tick={{ fill: '#8B95A7', fontSize: 11 }} width={60} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                      {(stats.conditions || []).map((entry) => (
                        <Cell key={entry.name} fill={COND_COLORS[entry.name] || '#7C9EFF'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="flex items-center justify-center gap-4 text-[11px] text-[#8B95A7] pt-2 border-t border-[#252E3D]">
                {(stats.conditions || []).map((c) => (
                  <div key={c.name} className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COND_COLORS[c.name] }} />
                    <span>{c.name}: {c.count}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Chart 3: Energy Priority Distribution */}
            <div className="bg-[#131922] border border-[#252E3D] rounded-xl p-5 shadow-card flex flex-col justify-between">
              <div className="mb-4">
                <h3 className="font-display font-semibold text-sm text-[#E8EDF4]">Energy Priority Load Tiers</h3>
                <p className="text-xs text-[#5A6478]">Backup power protection breakdown</p>
              </div>
              <div className="h-56 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={stats.energy_priorities || []}
                      dataKey="count"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={75}
                      paddingAngle={3}
                    >
                      {(stats.energy_priorities || []).map((entry) => (
                        <Cell key={entry.name} fill={PRIORITY_COLORS[entry.name] || '#5A6478'} />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-3 text-[11px] text-[#8B95A7] pt-2 border-t border-[#252E3D]">
                {(stats.energy_priorities || []).map((p) => (
                  <div key={p.name} className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: PRIORITY_COLORS[p.name] }} />
                    <span>{p.name}: {p.count}</span>
                  </div>
                ))}
              </div>
            </div>

          </div>

        </main>
      </div>

      {/* SECTION 3 — DETAIL SIDE PANEL (420px RIGHT DRAWER) */}
      {selectedPatient && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm transition-opacity">
          {/* Overlay click to close */}
          <div className="flex-1" onClick={() => setSelectedPatient(null)} />

          <div className="w-[420px] bg-[#131922] border-l border-[#252E3D] h-full overflow-y-auto p-6 space-y-6 shadow-2xl flex flex-col justify-between">
            
            <div className="space-y-6">
              {/* Header & Close */}
              <div className="flex items-start justify-between pb-4 border-b border-[#252E3D]">
                <div>
                  <h2 className="font-display font-bold text-xl text-[#E8EDF4]">{selectedPatient.name}</h2>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="font-mono text-xs text-[#7C9EFF] font-semibold">{selectedPatient.patient_id}</span>
                    <span className="text-[#5A6478]">·</span>
                    <span className="text-xs text-[#8B95A7]">{formatDeptName(selectedPatient.department)}</span>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedPatient(null)}
                  className="w-8 h-8 rounded-lg bg-[#1A2230] border border-[#252E3D] text-[#8B95A7] hover:text-white flex items-center justify-center transition-colors"
                >
                  ✕
                </button>
              </div>

              {/* Patient Info Grid */}
              <div className="bg-[#1A2230] border border-[#252E3D] rounded-xl p-4 space-y-3">
                <h3 className="text-xs font-semibold text-[#8B95A7] uppercase tracking-wider">Patient Demographics</h3>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-[#5A6478] block">Age / Gender</span>
                    <span className="font-medium text-[#E8EDF4]">{selectedPatient.age} yrs / {selectedPatient.gender}</span>
                  </div>
                  <div>
                    <span className="text-[#5A6478] block">Blood Group</span>
                    <span className="font-mono font-bold text-[#4DD0C4]">{selectedPatient.blood_group}</span>
                  </div>
                  <div>
                    <span className="text-[#5A6478] block">Attending Doctor</span>
                    <span className="font-medium text-[#E8EDF4]">{selectedPatient.doctor}</span>
                  </div>
                  <div>
                    <span className="text-[#5A6478] block">Bed Number</span>
                    <span className="font-mono font-medium text-[#F5A623]">{selectedPatient.bed_number}</span>
                  </div>
                </div>
              </div>

              {/* Medical Vitals (Deterministic) */}
              <div className="bg-[#1A2230] border border-[#252E3D] rounded-xl p-4 space-y-3">
                <h3 className="text-xs font-semibold text-[#8B95A7] uppercase tracking-wider">Live Clinical Vitals</h3>
                {(() => {
                  const vitals = getDeterministicVitals(selectedPatient)
                  return (
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-[#131922] p-2.5 rounded-lg border border-[#252E3D]">
                        <span className="text-[11px] text-[#5A6478] block">Heart Rate</span>
                        <span className="font-mono font-bold text-sm text-[#FF5C5C]">{vitals.hr} <span className="text-[10px] text-[#8B95A7]">bpm</span></span>
                      </div>
                      <div className="bg-[#131922] p-2.5 rounded-lg border border-[#252E3D]">
                        <span className="text-[11px] text-[#5A6478] block">SpO2 Oxygen</span>
                        <span className="font-mono font-bold text-sm text-[#4DD0C4]">{vitals.spo2}%</span>
                      </div>
                      <div className="bg-[#131922] p-2.5 rounded-lg border border-[#252E3D]">
                        <span className="text-[11px] text-[#5A6478] block">Blood Pressure</span>
                        <span className="font-mono font-bold text-sm text-[#7C9EFF]">{vitals.bp}</span>
                      </div>
                      <div className="bg-[#131922] p-2.5 rounded-lg border border-[#252E3D] flex flex-col justify-between">
                        <span className="text-[11px] text-[#5A6478] block">Condition</span>
                        <div>{renderConditionBadge(selectedPatient.condition)}</div>
                      </div>
                    </div>
                  )
                })()}
              </div>

              {/* AI Criticality Card */}
              <div className="bg-[#1A2230] border border-[#252E3D] rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-semibold text-[#8B95A7] uppercase tracking-wider">AI Criticality Assessment</h3>
                  <span className="text-[11px] font-mono text-[#5A6478]">Algorithmic Score</span>
                </div>
                <div className="flex items-center gap-4">
                  <div className="font-display font-extrabold text-3xl" style={{
                    color: selectedPatient.ai_score >= 70 ? '#FF5C5C' : selectedPatient.ai_score >= 40 ? '#F5A623' : '#3DD68C'
                  }}>
                    {selectedPatient.ai_score}
                    <span className="text-xs font-mono text-[#5A6478]">/100</span>
                  </div>
                  <div className="flex-1 space-y-1">
                    <div className="w-full bg-[#131922] h-3 rounded-full overflow-hidden border border-[#252E3D]">
                      <div
                        className="h-full transition-all duration-500 rounded-full"
                        style={{
                          width: `${selectedPatient.ai_score}%`,
                          backgroundColor: selectedPatient.ai_score >= 70 ? '#FF5C5C' : selectedPatient.ai_score >= 40 ? '#F5A623' : '#3DD68C'
                        }}
                      />
                    </div>
                    <span className="text-[11px] font-medium text-[#E8EDF4] block">
                      {selectedPatient.risk_label || 'Triage Assessment'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Life Support Devices */}
              <div className="bg-[#1A2230] border border-[#252E3D] rounded-xl p-4 space-y-3">
                <h3 className="text-xs font-semibold text-[#8B95A7] uppercase tracking-wider">Assigned Life Support Equipment</h3>
                {selectedPatient.life_support && selectedPatient.life_support.length > 0 ? (
                  <div className="space-y-2">
                    {selectedPatient.life_support.map((dev) => {
                      const info = DEVICE_INFO[dev] || { icon: '⚡', watts: '50W', priority: 'Medium' }
                      return (
                        <div key={dev} className="flex items-center justify-between p-2.5 rounded-lg bg-[#131922] border border-[#252E3D] text-xs">
                          <div className="flex items-center gap-2">
                            <span>{info.icon}</span>
                            <span className="font-medium text-[#E8EDF4]">{dev.replace(/_/g, ' ')}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-[#7C9EFF] font-semibold">{info.watts}</span>
                            {renderPriorityBadge(info.priority)}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-[#5A6478] italic py-2">No life support — standard monitoring only.</p>
                )}
              </div>

              {/* Energy Allocation */}
              <div className="bg-[#1A2230] border border-[#252E3D] rounded-xl p-4 space-y-3">
                <h3 className="text-xs font-semibold text-[#8B95A7] uppercase tracking-wider">Energy & Microgrid Allocation</h3>
                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="bg-[#131922] p-2 rounded-lg border border-[#252E3D]">
                    <span className="text-[10px] text-[#5A6478] block">Allocated Power</span>
                    <span className="font-mono font-bold text-[#F5A623]">{selectedPatient.allocated_kw} kW</span>
                  </div>
                  <div className="bg-[#131922] p-2 rounded-lg border border-[#252E3D]">
                    <span className="text-[10px] text-[#5A6478] block">Backup Status</span>
                    <span className="font-semibold text-[#3DD68C]">{selectedPatient.backup_status}</span>
                  </div>
                  <div className="bg-[#131922] p-2 rounded-lg border border-[#252E3D]">
                    <span className="text-[10px] text-[#5A6478] block">Power Source</span>
                    <span className="font-mono text-[#7C9EFF] font-medium">{selectedPatient.power_source}</span>
                  </div>
                </div>
              </div>

            </div>

            <div className="pt-4 border-t border-[#252E3D] text-center">
              <button
                onClick={() => setSelectedPatient(null)}
                className="w-full py-2 bg-[#1A2230] border border-[#252E3D] hover:bg-[#252E3D] text-[#E8EDF4] rounded-lg text-xs font-semibold transition-colors"
              >
                Close Drawer
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  )
}
