import { useState, useEffect, useCallback } from 'react'
import { API_BASE } from '../useApi.js'
import Sidebar from '../components/Sidebar.jsx'
import Header from '../components/Header.jsx'
import StatCard from '../components/StatCard.jsx'

export default function Alerts() {
  const [stats, setStats] = useState(null)
  const [statsLoading, setStatsLoading] = useState(true)

  const [alerts, setAlerts] = useState([])
  const [alertsLoading, setAlertsLoading] = useState(true)
  const [error, setError] = useState(null)

  // Filter & Search states
  const [searchTerm, setSearchTerm] = useState('')
  const [severityFilter, setSeverityFilter] = useState('ALL')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')

  // Fetch summary statistics
  const fetchStats = useCallback(async () => {
    try {
      setStatsLoading(true)
      const res = await fetch(`${API_BASE}/alerts/stats`)
      if (!res.ok) throw new Error('Failed to fetch alert stats')
      const data = await res.json()
      setStats(data)
    } catch (err) {
      console.error(err)
    } finally {
      setStatsLoading(false)
    }
  }, [])

  // Fetch alerts list
  const fetchAlerts = useCallback(async () => {
    try {
      setAlertsLoading(true)
      setError(null)
      const params = new URLSearchParams()
      params.append('limit', 200)

      if (severityFilter !== 'ALL') params.append('severity', severityFilter)
      if (statusFilter !== 'ALL') params.append('status', statusFilter)
      if (fromDate) params.append('from_time', fromDate)
      if (toDate) params.append('to_time', toDate)

      const res = await fetch(`${API_BASE}/alerts?${params.toString()}`)
      if (!res.ok) {
        const errData = await res.json()
        throw new Error(errData.detail || 'Failed to fetch alerts')
      }
      const data = await res.json()
      setAlerts(data)
    } catch (err) {
      setError(err.message)
      setAlerts([])
    } finally {
      setAlertsLoading(false)
    }
  }, [severityFilter, statusFilter, fromDate, toDate])

  useEffect(() => {
    fetchStats()
    fetchAlerts()
  }, [fetchStats, fetchAlerts])

  const handleAcknowledge = async (id) => {
    try {
      const res = await fetch(`${API_BASE}/alerts/${id}/acknowledge`, { method: 'PATCH' })
      if (!res.ok) throw new Error('Failed to acknowledge alert')
      fetchStats()
      fetchAlerts()
    } catch (err) {
      alert(err.message)
    }
  }

  const handleResolve = async (id) => {
    try {
      const res = await fetch(`${API_BASE}/alerts/${id}/resolve`, { method: 'PATCH' })
      if (!res.ok) throw new Error('Failed to resolve alert')
      fetchStats()
      fetchAlerts()
    } catch (err) {
      alert(err.message)
    }
  }

  const handleRefresh = () => {
    fetchStats()
    fetchAlerts()
  }

  // Search filtering in memory
  const filteredAlerts = alerts.filter((alert) => {
    if (!searchTerm.trim()) return true
    const q = searchTerm.toLowerCase()
    return (
      alert.title.toLowerCase().includes(q) ||
      alert.message.toLowerCase().includes(q) ||
      alert.source.toLowerCase().includes(q)
    )
  })

  // Format date helper
  const formatDateLabel = (ts) => {
    if (!ts) return 'N/A'
    const d = new Date(ts)
    return isNaN(d) ? ts : d.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  }

  const getSeverityBadgeClass = (severity) => {
    switch (severity) {
      case 'CRITICAL':
        return 'bg-rose-500/15 text-rose-400 border border-rose-500/30 font-semibold'
      case 'WARNING':
        return 'bg-amber-500/15 text-amber-400 border border-amber-500/30 font-medium'
      default:
        return 'bg-sky-500/15 text-sky-400 border border-sky-500/30 font-medium'
    }
  }

  const getStatusBadgeClass = (status) => {
    switch (status) {
      case 'ACTIVE':
        return 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
      case 'ACKNOWLEDGED':
        return 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
      default:
        return 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
    }
  }

  return (
    <div className="flex h-screen overflow-hidden font-body bg-base">
      <Sidebar />

      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <Header title="System Alerts & Incident Management" />

        <main className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 md:gap-4">
            <StatCard
              title="Total System Alerts"
              value={statsLoading ? '...' : (stats?.total_alerts ?? 0).toLocaleString()}
              subtitle="All historical alerts"
            />
            <StatCard
              title="Active Alerts"
              value={statsLoading ? '...' : (stats?.active_alerts ?? 0).toLocaleString()}
              subtitle="Require attention"
            />
            <StatCard
              title="Active Critical Alerts"
              value={statsLoading ? '...' : (stats?.critical_alerts ?? 0).toLocaleString()}
              subtitle="High severity"
            />
            <StatCard
              title="Acknowledged Alerts"
              value={statsLoading ? '...' : (stats?.acknowledged_alerts ?? 0).toLocaleString()}
              subtitle="Under investigation"
            />
            <StatCard
              title="Resolved Alerts"
              value={statsLoading ? '...' : (stats?.resolved_alerts ?? 0).toLocaleString()}
              subtitle="Cleared / Normal"
            />
          </div>

          {/* Controls & Filter Toolbar */}
          <div className="bg-base-surface/80 border border-base-border rounded-xl p-4 shadow-card space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="font-display font-semibold text-lg text-text-primary">Alert Incident Center</h2>
                <p className="text-xs text-text-muted">Real-time microgrid outage, battery, and power deficit notifications</p>
              </div>

              <button
                onClick={handleRefresh}
                disabled={alertsLoading}
                className="px-3.5 py-1.5 rounded-lg bg-base-elevated border border-base-border text-xs text-text-primary hover:bg-base-border transition-colors disabled:opacity-50"
              >
                {alertsLoading ? 'Refreshing...' : 'Refresh Alerts'}
              </button>
            </div>

            {/* Filter Bar */}
            <div className="flex flex-wrap items-center gap-3 pt-1 border-t border-base-border/50">
              {/* Search */}
              <div className="flex-1 min-w-[200px]">
                <input
                  type="text"
                  placeholder="Search alert title, message, or source..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-base-elevated border border-base-border rounded-lg px-3 py-1.5 text-xs text-text-primary placeholder:text-text-faint focus:outline-none focus:border-battery"
                />
              </div>

              {/* Severity Filter */}
              <div className="flex items-center gap-1.5 text-xs">
                <label className="text-text-muted">Severity:</label>
                <select
                  value={severityFilter}
                  onChange={(e) => setSeverityFilter(e.target.value)}
                  className="bg-base-elevated border border-base-border rounded-lg px-2.5 py-1.5 text-xs text-text-primary focus:outline-none focus:border-battery"
                >
                  <option value="ALL">All Severities</option>
                  <option value="CRITICAL">CRITICAL</option>
                  <option value="WARNING">WARNING</option>
                  <option value="INFO">INFO</option>
                </select>
              </div>

              {/* Status Filter */}
              <div className="flex items-center gap-1.5 text-xs">
                <label className="text-text-muted">Status:</label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="bg-base-elevated border border-base-border rounded-lg px-2.5 py-1.5 text-xs text-text-primary focus:outline-none focus:border-battery"
                >
                  <option value="ALL">All Statuses</option>
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="ACKNOWLEDGED">ACKNOWLEDGED</option>
                  <option value="RESOLVED">RESOLVED</option>
                </select>
              </div>

              {/* Date Filters */}
              <div className="flex items-center gap-1.5 text-xs">
                <label className="text-text-muted">From:</label>
                <input
                  type="datetime-local"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="bg-base-elevated border border-base-border rounded-lg px-2.5 py-1.5 text-xs text-text-primary focus:outline-none focus:border-battery"
                />
              </div>

              <div className="flex items-center gap-1.5 text-xs">
                <label className="text-text-muted">To:</label>
                <input
                  type="datetime-local"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="bg-base-elevated border border-base-border rounded-lg px-2.5 py-1.5 text-xs text-text-primary focus:outline-none focus:border-battery"
                />
              </div>
            </div>

            {error && (
              <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs">
                {error}
              </div>
            )}
          </div>

          {/* Alerts Table */}
          <div className="bg-base-surface/80 border border-base-border rounded-xl p-5 shadow-card space-y-4">
            <h3 className="font-display font-medium text-sm text-text-primary">System Incident Logs ({filteredAlerts.length})</h3>

            {alertsLoading ? (
              <div className="p-8 text-center text-xs text-text-faint">Loading system alerts...</div>
            ) : filteredAlerts.length === 0 ? (
              <div className="p-8 text-center text-xs text-text-faint">
                No alerts found matching your criteria.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-base-border text-text-muted uppercase text-[10px] tracking-wider">
                      <th className="py-2.5 px-3">Severity</th>
                      <th className="py-2.5 px-3">Timestamp</th>
                      <th className="py-2.5 px-3">Alert Title & Description</th>
                      <th className="py-2.5 px-3">Source</th>
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-base-border/50 text-text-primary">
                    {filteredAlerts.map((item) => (
                      <tr key={item.id} className="hover:bg-base-elevated/40 transition-colors">
                        <td className="py-3 px-3">
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] uppercase ${getSeverityBadgeClass(item.severity)}`}>
                            {item.severity}
                          </span>
                        </td>

                        <td className="py-3 px-3 font-mono text-[11px] text-text-muted whitespace-nowrap">
                          {formatDateLabel(item.timestamp)}
                        </td>

                        <td className="py-3 px-3 max-w-md">
                          <p className="font-medium text-text-primary text-xs">{item.title}</p>
                          <p className="text-text-muted text-[11px] mt-0.5">{item.message}</p>
                          {item.acknowledged_at && (
                            <p className="text-[10px] text-amber-400/80 mt-1">
                              Acknowledged: {formatDateLabel(item.acknowledged_at)}
                            </p>
                          )}
                          {item.resolved_at && (
                            <p className="text-[10px] text-emerald-400/80 mt-1">
                              Resolved: {formatDateLabel(item.resolved_at)}
                            </p>
                          )}
                        </td>

                        <td className="py-3 px-3">
                          <span className="px-2 py-0.5 rounded bg-base-elevated border border-base-border text-[10px] text-text-muted font-mono uppercase">
                            {item.source}
                          </span>
                        </td>

                        <td className="py-3 px-3">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] uppercase ${getStatusBadgeClass(item.status)}`}>
                            {item.status}
                          </span>
                        </td>

                        <td className="py-3 px-3 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-2">
                            {item.status === 'ACTIVE' && (
                              <button
                                onClick={() => handleAcknowledge(item.id)}
                                className="px-2.5 py-1 rounded bg-amber-500/10 border border-amber-500/30 text-amber-400 hover:bg-amber-500/20 text-[11px] transition-colors"
                              >
                                Acknowledge
                              </button>
                            )}

                            {item.status !== 'RESOLVED' && (
                              <button
                                onClick={() => handleResolve(item.id)}
                                className="px-2.5 py-1 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20 text-[11px] transition-colors"
                              >
                                Resolve
                              </button>
                            )}

                            {item.status === 'RESOLVED' && (
                              <span className="text-[11px] text-text-faint italic">Closed</span>
                            )}
                          </div>
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
