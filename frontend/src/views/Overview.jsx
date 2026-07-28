import { useState, useCallback, useEffect, useRef } from 'react'
import { usePolledEndpoint, API_BASE } from '../useApi.js'

import Sidebar from '../components/Sidebar.jsx'
import Header from '../components/Header.jsx'
import StatCard from '../components/StatCard.jsx'
import BatterySocGauge from '../components/BatterySocGauge.jsx'
import GridStatusCard from '../components/GridStatusCard.jsx'
import HospitalLoadCard from '../components/HospitalLoadCard.jsx'
import EnergyFlowDiagram from '../components/EnergyFlowDiagram.jsx'
import EnergyFlowChart from '../components/EnergyFlowChart.jsx'
import SimulationStats from '../components/SimulationStats.jsx'
import { SunIcon, WindIcon, BatteryIcon, HospitalIcon } from '../components/Icons.jsx'
import AIPredictionPanel from '../components/AIPredictionPanel.jsx'
import DepartmentAllocationPanel from '../components/DepartmentAllocationPanel.jsx'

// ─── Seed simulation data on first load ────────────────────────────────────

async function seedSimulation() {
  try {
    // Run 96 intervals (one full day) to populate history for the chart
    await fetch(`${API_BASE}/simulation/run?intervals=96`)
  } catch (_) {
    // If backend is down we'll surface the error through the polling hooks
  }
}

// ─── Overview page (main dashboard) ─────────────────────────────────────────

export default function Overview() {
  const [seeded, setSeeded] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const [chartHistory, setChartHistory] = useState([])
  const previousNetRef = useRef(null)

  // Seed once on mount
  useEffect(() => {
    if (!seeded) {
      seedSimulation().then(() => setSeeded(true))
    }
  }, [seeded])

  // Live snapshot — poll every 6s
  const {
    data: snapshot,
    error: snapError,
    loading: snapLoading,
    lastUpdated,
  } = usePolledEndpoint('/simulation/current', 6000)

  // Day summary — poll every 15s
  const {
    data: summary,
    loading: summaryLoading,
  } = usePolledEndpoint('/simulation/day-summary', 15000)

  // AI prediction — polled once here, passed as props to both AI panels
  const {
    data: prediction,
    error: predError,
    loading: predLoading,
  } = usePolledEndpoint('/ai/predict', 10000)

  const connected = !snapError

  // Accumulate snapshot history for the rolling chart (last 96 points = 24h)
  useEffect(() => {
    if (!snapshot) return
    setChartHistory(prev => {
      const already = prev.some(p => p.timestamp === snapshot.timestamp)
      if (already) return prev
      const next = [...prev, snapshot]
      return next.length > 96 ? next.slice(-96) : next
    })
  }, [snapshot])

  const handleRefresh = useCallback(() => {
    setSeeded(false) // re-trigger seed
    setRefreshKey(k => k + 1)
  }, [])

  const soc        = snapshot?.battery_soc_percent ?? 0
  const solar      = snapshot?.solar_kw ?? 0
  const wind       = snapshot?.wind_kw ?? 0
  const load       = snapshot?.total_load_kw ?? 0
  const bAction    = snapshot?.battery_action ?? 'idle'
  const gridStatus = snapshot?.grid_status ?? 'NORMAL'
  const gridImport = snapshot?.grid_import_kw ?? 0
  const gridExport = snapshot?.grid_export_kw ?? 0
  const netBalance = snapshot?.net_balance_kw ?? 0
  
  console.log("prediction =", prediction)
  console.log("predError =", predError)
  console.log("predLoading =", predLoading)

  return (
    <div className="flex h-screen overflow-hidden font-body">
      <Sidebar />

      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <Header
          connected={connected}
          lastUpdated={lastUpdated}
          onRefresh={handleRefresh}
        />

        <main className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

          {/* ── Loading state ── */}
          {snapLoading && !snapshot && (
            <div className="flex items-center gap-3 text-text-faint text-sm py-8 justify-center">
              <span className="w-3 h-3 rounded-full bg-battery animate-pulsedot inline-block" />
              Connecting to VITAL-OS backend…
            </div>
          )}

          {/* ── Error banner ── */}
          {snapError && (
            <div className="rounded-lg border border-gridout/40 bg-gridout/10 px-4 py-3 text-sm text-gridout">
              <strong>Backend unreachable</strong> — make sure FastAPI is running on{' '}
              <code className="font-mono text-xs">http://127.0.0.1:8000</code> and refresh.
            </div>
          )}

          {/* ── Row 1: Top stat cards ── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              label="Solar Output"
              value={solar.toFixed(1)}
              unit="kW"
              accent="#F5A623"
              icon={<SunIcon />}
              sublabel="Peak capacity 150 kW"
              subvalue={`${((solar / 150) * 100).toFixed(0)}%`}
            />
            <StatCard
              label="Wind Output"
              value={wind.toFixed(1)}
              unit="kW"
              accent="#4DD0C4"
              icon={<WindIcon />}
              sublabel="Rated capacity 60 kW"
              subvalue={`${((wind / 60) * 100).toFixed(0)}%`}
            />
            <StatCard
              label="Net Balance"
              value={netBalance >= 0 ? `+${netBalance.toFixed(1)}` : netBalance.toFixed(1)}
              unit="kW"
              accent={netBalance >= 0 ? '#3DD68C' : '#FF5C5C'}
              icon={<BatteryIcon color={netBalance >= 0 ? '#3DD68C' : '#FF5C5C'} />}
              sublabel={netBalance >= 0 ? 'Generation surplus' : 'Generation deficit'}
            />
            <StatCard
              label="Total Load"
              value={load.toFixed(1)}
              unit="kW"
              accent="#FF7849"
              icon={<HospitalIcon />}
              sublabel="7 departments"
              subvalue={`Wind speed ${snapshot?.wind_speed_ms?.toFixed(1) ?? '—'} m/s`}
            />
          </div>

          {/* ── Row 2: Flow diagram + Battery gauge + Grid status ── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

            {/* Energy flow diagram — 2/3 width */}
            <div className="lg:col-span-2 bg-base-surface rounded-xl border border-base-border shadow-card p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-medium text-text-muted uppercase tracking-wider">
                  Live Energy Flow
                </span>
                <span className="text-[10px] text-text-faint font-mono bg-base-elevated px-2 py-0.5 rounded-full">
                  {snapshot?.timestamp
                    ? new Date(snapshot.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
                    : '—'}
                </span>
              </div>
              <div style={{ height: '210px' }}>
                <EnergyFlowDiagram snapshot={snapshot} />
              </div>
            </div>

            {/* Battery + grid stack — 1/3 width */}
            <div className="flex flex-col gap-4">
              <div className="bg-base-surface rounded-xl border border-base-border shadow-card p-4 flex-1">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium text-text-muted uppercase tracking-wider">Battery SOC</span>
                  <span className="text-[10px] font-mono text-battery bg-battery/10 px-2 py-0.5 rounded-full">{soc.toFixed(1)}%</span>
                </div>
                <div style={{ height: '160px' }}>
                  <BatterySocGauge soc={soc} action={bAction} />
                </div>
              </div>

              <GridStatusCard
                status={gridStatus}
                gridImportKw={gridImport}
                gridExportKw={gridExport}
              />
            </div>
          </div>

          {/* ── Row 3: Hospital load + Stats ── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2">
              <HospitalLoadCard snapshot={snapshot} />
            </div>
            <SimulationStats summary={summary} />
          </div>

          {/* ── Row 4: AI prediction + department allocation ── */}
          <AIPredictionPanel
            prediction={prediction}
            predError={predError}
            predLoading={predLoading}
          />
          <DepartmentAllocationPanel
            snapshot={snapshot}
            prediction={prediction}
          />

          {/* ── Row 5: Recharts time-series chart ── */}
          <div className="bg-base-surface rounded-xl border border-base-border shadow-card p-4">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-xs font-medium text-text-muted uppercase tracking-wider">Energy Timeline</p>
                <p className="text-[11px] text-text-faint mt-0.5">Solar · Wind · Total Generation · Hospital Load</p>
              </div>
              <span className="text-[10px] text-text-faint font-mono">
                {chartHistory.length} points
              </span>
            </div>
            <div style={{ height: '220px' }}>
              <EnergyFlowChart history={chartHistory} />
            </div>
          </div>

        </main>
      </div>
    </div>
  )
}
