import { useState, useEffect, useCallback } from 'react'
import { API_BASE } from '../useApi.js'
import Sidebar from '../components/Sidebar.jsx'
import Header from '../components/Header.jsx'
import StatCard from '../components/StatCard.jsx'
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from 'recharts'

export default function Analytics() {
  const [stats, setStats] = useState(null)
  const [statsLoading, setStatsLoading] = useState(true)
  const [history, setHistory] = useState([])
  const [historyLoading, setHistoryLoading] = useState(true)
  const [error, setError] = useState(null)

  // Filters
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [limit, setLimit] = useState(100)

  // Fetch summary statistics
  const fetchStats = useCallback(async () => {
    try {
      setStatsLoading(true)
      const res = await fetch(`${API_BASE}/simulation/stats`)
      if (!res.ok) throw new Error('Failed to fetch stats')
      const data = await res.json()
      setStats(data)
    } catch (err) {
      console.error(err)
    } finally {
      setStatsLoading(false)
    }
  }, [])

  // Fetch historical telemetry
  const fetchHistory = useCallback(async () => {
    try {
      setHistoryLoading(true)
      setError(null)
      const params = new URLSearchParams()
      params.append('limit', limit)
      if (fromDate) params.append('from_time', fromDate)
      if (toDate) params.append('to_time', toDate)

      const res = await fetch(`${API_BASE}/simulation/history?${params.toString()}`)
      if (!res.ok) {
        const errData = await res.json()
        throw new Error(errData.detail || 'Failed to fetch history')
      }
      const data = await res.json()
      // Sort chronologically for charting
      const sorted = [...data].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
      setHistory(sorted)
    } catch (err) {
      setError(err.message)
      setHistory([])
    } finally {
      setHistoryLoading(false)
    }
  }, [fromDate, toDate, limit])

  useEffect(() => {
    fetchStats()
    fetchHistory()
  }, [fetchStats, fetchHistory])

  const handleExportCSV = () => {
    const params = new URLSearchParams()
    params.append('limit', limit)
    if (fromDate) params.append('from_time', fromDate)
    if (toDate) params.append('to_time', toDate)
    window.open(`${API_BASE}/simulation/export?${params.toString()}`, '_blank')
  }

  const handleRefresh = () => {
    fetchStats()
    fetchHistory()
  }

  // Format timestamp for display
  const formatTimeLabel = (ts) => {
    if (!ts) return ''
    const d = new Date(ts)
    return isNaN(d) ? ts : d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  const formatDateLabel = (ts) => {
    if (!ts) return 'N/A'
    const d = new Date(ts)
    return isNaN(d) ? ts : d.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div className="flex h-screen overflow-hidden font-body bg-base">
      <Sidebar />

      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <Header title="Analytics & Simulation History" />

        <main className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
          {/* Summary Stats Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 md:gap-4">
            <StatCard
              title="Total Saved Records"
              value={statsLoading ? '...' : (stats?.total_records ?? 0).toLocaleString()}
              subtitle="Database entries"
            />
            <StatCard
              title="Avg Hospital Load"
              value={statsLoading ? '...' : stats?.avg_hospital_load_kw != null ? `${stats.avg_hospital_load_kw} kW` : 'N/A'}
              subtitle="Historical average"
            />
            <StatCard
              title="Avg Renewable Gen"
              value={statsLoading ? '...' : stats?.avg_renewable_generation_kw != null ? `${stats.avg_renewable_generation_kw} kW` : 'N/A'}
              subtitle="Solar + Wind avg"
            />
            <StatCard
              title="Avg Battery SOC"
              value={statsLoading ? '...' : stats?.avg_battery_soc_percent != null ? `${stats.avg_battery_soc_percent}%` : 'N/A'}
              subtitle="Battery state"
            />
            <StatCard
              title="Oldest Record"
              value={statsLoading ? '...' : formatDateLabel(stats?.oldest_record)}
              subtitle="History start"
            />
            <StatCard
              title="Newest Record"
              value={statsLoading ? '...' : formatDateLabel(stats?.newest_record)}
              subtitle="Latest snapshot"
            />
          </div>

          {/* History Controls Toolbar */}
          <div className="bg-base-surface/80 border border-base-border rounded-xl p-4 shadow-card">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="font-display font-semibold text-lg text-text-primary">Historical Telemetry Data</h2>
                <p className="text-xs text-text-muted">Filter, visualize, and export stored microgrid simulation intervals</p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                {/* Date range filters */}
                <div className="flex items-center gap-2 text-xs">
                  <label className="text-text-muted">From:</label>
                  <input
                    type="datetime-local"
                    value={fromDate}
                    onChange={(e) => setFromDate(e.target.value)}
                    className="bg-base-elevated border border-base-border rounded-lg px-2.5 py-1.5 text-text-primary focus:outline-none focus:border-battery text-xs"
                  />
                </div>

                <div className="flex items-center gap-2 text-xs">
                  <label className="text-text-muted">To:</label>
                  <input
                    type="datetime-local"
                    value={toDate}
                    onChange={(e) => setToDate(e.target.value)}
                    className="bg-base-elevated border border-base-border rounded-lg px-2.5 py-1.5 text-text-primary focus:outline-none focus:border-battery text-xs"
                  />
                </div>

                {/* Limit Selector */}
                <div className="flex items-center gap-2 text-xs">
                  <label className="text-text-muted">Limit:</label>
                  <select
                    value={limit}
                    onChange={(e) => setLimit(Number(e.target.value))}
                    className="bg-base-elevated border border-base-border rounded-lg px-2.5 py-1.5 text-text-primary focus:outline-none focus:border-battery text-xs"
                  >
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                    <option value={250}>250</option>
                    <option value={500}>500</option>
                    <option value={1000}>1000</option>
                  </select>
                </div>

                {/* Actions */}
                <button
                  onClick={handleRefresh}
                  disabled={historyLoading}
                  className="px-3.5 py-1.5 rounded-lg bg-base-elevated border border-base-border text-xs text-text-primary hover:bg-base-border transition-colors disabled:opacity-50"
                >
                  {historyLoading ? 'Loading...' : 'Refresh'}
                </button>

                <button
                  onClick={handleExportCSV}
                  className="px-3.5 py-1.5 rounded-lg bg-battery text-base font-medium text-xs hover:bg-battery/90 transition-colors shadow-sm"
                >
                  Export CSV
                </button>
              </div>
            </div>

            {error && (
              <div className="mt-3 p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs">
                {error}
              </div>
            )}
          </div>

          {/* Historical Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Load vs Generation Chart */}
            <div className="bg-base-surface/80 border border-base-border rounded-xl p-5 shadow-card space-y-3">
              <h3 className="font-display font-medium text-sm text-text-primary">Hospital Load vs. Renewable Generation (kW)</h3>
              <div className="h-64 w-full">
                {historyLoading ? (
                  <div className="h-full flex items-center justify-center text-xs text-text-faint">Loading chart data...</div>
                ) : history.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-xs text-text-faint">No historical data available</div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={history} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="loadGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.4} />
                          <stop offset="95%" stopColor="#f43f5e" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="renGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                      <XAxis dataKey="timestamp" tickFormatter={formatTimeLabel} stroke="#6b7280" tick={{ fontSize: 11 }} />
                      <YAxis stroke="#6b7280" tick={{ fontSize: 11 }} />
                      <Tooltip
                        contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a', borderRadius: '8px', fontSize: '12px' }}
                        labelFormatter={formatDateLabel}
                      />
                      <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '8px' }} />
                      <Area type="monotone" dataKey="total_load_kw" name="Hospital Load (kW)" stroke="#f43f5e" fillOpacity={1} fill="url(#loadGrad)" />
                      <Area type="monotone" dataKey="renewable_generation_kw" name="Renewable Gen (kW)" stroke="#10b981" fillOpacity={1} fill="url(#renGrad)" />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            {/* Battery SOC Chart */}
            <div className="bg-base-surface/80 border border-base-border rounded-xl p-5 shadow-card space-y-3">
              <h3 className="font-display font-medium text-sm text-text-primary">Battery State of Charge (%)</h3>
              <div className="h-64 w-full">
                {historyLoading ? (
                  <div className="h-full flex items-center justify-center text-xs text-text-faint">Loading chart data...</div>
                ) : history.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-xs text-text-faint">No historical data available</div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={history} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                      <XAxis dataKey="timestamp" tickFormatter={formatTimeLabel} stroke="#6b7280" tick={{ fontSize: 11 }} />
                      <YAxis domain={[0, 100]} stroke="#6b7280" tick={{ fontSize: 11 }} />
                      <Tooltip
                        contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a', borderRadius: '8px', fontSize: '12px' }}
                        labelFormatter={formatDateLabel}
                      />
                      <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '8px' }} />
                      <Line type="monotone" dataKey="battery_soc_percent" name="Battery SOC (%)" stroke="#3b82f6" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          </div>

          {/* Historical Data Table */}
          <div className="bg-base-surface/80 border border-base-border rounded-xl p-5 shadow-card space-y-4">
            <h3 className="font-display font-medium text-sm text-text-primary">Telemetry Interval Records</h3>

            {historyLoading ? (
              <div className="p-8 text-center text-xs text-text-faint">Loading records from database...</div>
            ) : history.length === 0 ? (
              <div className="p-8 text-center text-xs text-text-faint">
                No historical records found for the selected filter parameters.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-base-border text-text-muted uppercase text-[10px] tracking-wider">
                      <th className="py-2.5 px-3">Timestamp</th>
                      <th className="py-2.5 px-3">Load (kW)</th>
                      <th className="py-2.5 px-3">Renewables (kW)</th>
                      <th className="py-2.5 px-3">Solar / Wind (kW)</th>
                      <th className="py-2.5 px-3">Battery SOC</th>
                      <th className="py-2.5 px-3">Net Balance</th>
                      <th className="py-2.5 px-3">Grid Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-base-border/50 text-text-primary">
                    {history.map((row) => (
                      <tr key={row.id || row.timestamp} className="hover:bg-base-elevated/40 transition-colors">
                        <td className="py-2.5 px-3 font-mono">{formatDateLabel(row.timestamp)}</td>
                        <td className="py-2.5 px-3 font-semibold text-rose-400">{row.total_load_kw} kW</td>
                        <td className="py-2.5 px-3 font-semibold text-emerald-400">{row.renewable_generation_kw} kW</td>
                        <td className="py-2.5 px-3 text-text-muted">
                          {row.solar_kw} / {row.wind_kw}
                        </td>
                        <td className="py-2.5 px-3 text-sky-400 font-medium">{row.battery_soc_percent}%</td>
                        <td className={`py-2.5 px-3 font-medium ${row.net_balance_kw >= 0 ? 'text-emerald-400' : 'text-amber-400'}`}>
                          {row.net_balance_kw >= 0 ? `+${row.net_balance_kw}` : row.net_balance_kw} kW
                        </td>
                        <td className="py-2.5 px-3">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-medium uppercase ${
                              row.grid_status === 'NORMAL'
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                                : row.grid_status === 'OUTAGE'
                                ? 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                                : 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                            }`}
                          >
                            {row.grid_status || 'NORMAL'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  )
}
