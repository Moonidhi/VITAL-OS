import { useState } from 'react'
import Sidebar from '../components/Sidebar.jsx'
import Header from '../components/Header.jsx'

const MOCK_ALERTS = [
  {
    id: 1,
    severity: 'CRITICAL',
    title: 'Grid Outage Detected',
    message: 'Grid connection lost at 14:32. Hospital on battery+renewables.',
    source: 'Microgrid',
    time: '2 min ago',
    acknowledged: false,
  },
  {
    id: 2,
    severity: 'CRITICAL',
    title: 'Battery SOC Critical',
    message: 'Battery bank A at 18%. Estimated 47 minutes of backup remaining.',
    source: 'Battery System',
    time: '3 min ago',
    acknowledged: false,
  },
  {
    id: 3,
    severity: 'WARNING',
    title: 'Solar Generation Drop',
    message: 'Solar output dropped 38% in last 15 minutes. Cloud cover detected.',
    source: 'Solar Array Alpha',
    time: '8 min ago',
    acknowledged: false,
  },
  {
    id: 4,
    severity: 'CRITICAL',
    title: 'Patient Deterioration',
    message: 'Patient PT-0142 (ICU) deteriorated to Critical. Life support activated.',
    source: 'Patient Engine',
    time: '12 min ago',
    acknowledged: false,
  },
  {
    id: 5,
    severity: 'WARNING',
    title: 'High Load Predicted',
    message: 'AI model predicts 224 kW load in next 15 minutes. Current generation: 87 kW.',
    source: 'AI Engine',
    time: '15 min ago',
    acknowledged: true,
  },
  {
    id: 6,
    severity: 'WARNING',
    title: 'HVAC Load Spike',
    message: 'HVAC load 23% above daily average. Possible chiller inefficiency.',
    source: 'Department Monitor',
    time: '28 min ago',
    acknowledged: true,
  },
  {
    id: 7,
    severity: 'INFO',
    title: 'Battery Fully Charged',
    message: 'Battery bank B reached 100% SOC. Excess solar being exported to grid.',
    source: 'Battery System',
    time: '1 hr ago',
    acknowledged: true,
  },
  {
    id: 8,
    severity: 'INFO',
    title: 'High Renewable Coverage',
    message: 'Renewable fraction reached 84% — highest today. Carbon savings: 127 kg CO₂.',
    source: 'Microgrid',
    time: '2 hr ago',
    acknowledged: true,
  },
]

export default function Alerts() {
  const [activeTab, setActiveTab] = useState('ALL')
  const [alerts, setAlerts] = useState(MOCK_ALERTS)

  const handleAcknowledge = (id) => {
    setAlerts((prev) =>
      prev.map((a) => (a.id === id ? { ...a, acknowledged: true } : a))
    )
  }

  const filteredAlerts = alerts.filter((alert) => {
    if (activeTab === 'ALL') return true
    if (activeTab === 'CRITICAL') return alert.severity === 'CRITICAL'
    if (activeTab === 'WARNING') return alert.severity === 'WARNING'
    if (activeTab === 'INFO') return alert.severity === 'INFO'
    if (activeTab === 'ACKNOWLEDGED') return alert.acknowledged
    return true
  })

  return (
    <div className="flex h-screen overflow-hidden font-body bg-base text-text-primary">
      <Sidebar />

      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <Header title="Alerts & Notifications" />

        <main className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
          {/* Header Summary Row */}
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="font-display font-semibold text-lg text-text-primary">Alert Incident Center</h2>
              <p className="text-xs text-text-muted">Real-time microgrid outage, battery, and clinical alert feed</p>
            </div>

            <div className="flex items-center gap-2">
              <span className="px-3 py-1 rounded-full bg-rose-500/15 border border-rose-500/30 text-rose-400 text-xs font-mono font-semibold">
                4 Critical
              </span>
              <span className="px-3 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-400 text-xs font-mono font-semibold">
                2 Warning
              </span>
              <span className="px-3 py-1 rounded-full bg-battery/15 border border-battery/30 text-battery text-xs font-mono font-semibold">
                18 Info
              </span>
            </div>
          </div>

          {/* Filter Tabs */}
          <div className="flex items-center gap-6 border-b border-base-border text-xs font-medium">
            {['ALL', 'CRITICAL', 'WARNING', 'INFO', 'ACKNOWLEDGED'].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`pb-3 transition-colors relative uppercase tracking-wider ${
                  activeTab === tab ? 'text-battery font-semibold' : 'text-text-muted hover:text-text-primary'
                }`}
              >
                {tab}
                {activeTab === tab && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-battery rounded-full shadow-[0_0_8px_#7C9EFF]" />
                )}
              </button>
            ))}
          </div>

          {/* Alert Cards Feed */}
          <div className="space-y-3">
            {filteredAlerts.map((alert, index) => {
              const isCritical = alert.severity === 'CRITICAL'
              const isWarning = alert.severity === 'WARNING'

              let borderClass = 'border-base-border'
              let bgClass = 'bg-base-surface'
              let dotColor = '#7C9EFF'

              if (isCritical) {
                borderClass = 'border-l-4 border-l-[#FF5C5C] border-base-border'
                bgClass = 'bg-[#FF5C5C0A]'
                dotColor = '#FF5C5C'
              } else if (isWarning) {
                borderClass = 'border-l-4 border-l-[#F5A623] border-base-border'
                bgClass = 'bg-[#F5A6230A]'
                dotColor = '#F5A623'
              }

              return (
                <div
                  key={alert.id}
                  className={`rounded-xl border p-4 shadow-card flex items-start justify-between gap-4 transition-all duration-300 hover:scale-[1.005] hover:shadow-lg ${borderClass} ${bgClass} animate-slide-in-up`}
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  <div className="flex items-start gap-3.5">
                    <span
                      className="w-2.5 h-2.5 rounded-full mt-1 shrink-0 animate-pulsedot"
                      style={{ backgroundColor: dotColor }}
                    />

                    <div className="space-y-1">
                      <div className="flex items-center gap-2.5">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase border ${
                            isCritical
                              ? 'bg-rose-500/20 text-rose-400 border-rose-500/30'
                              : isWarning
                              ? 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                              : 'bg-battery/20 text-battery border-battery/30'
                          }`}
                        >
                          {alert.severity}
                        </span>

                        <h3 className="font-semibold text-sm text-text-primary">{alert.title}</h3>
                      </div>

                      <p className="text-xs text-text-muted leading-relaxed">{alert.message}</p>

                      <div className="flex items-center gap-3 pt-1 text-[11px] text-text-faint font-mono">
                        <span>Source: <strong className="text-text-muted">{alert.source}</strong></span>
                        <span>·</span>
                        <span>{alert.time}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    {alert.acknowledged ? (
                      <span className="text-xs font-mono text-gridok flex items-center gap-1">
                        ✓ Acknowledged
                      </span>
                    ) : (
                      <button
                        onClick={() => handleAcknowledge(alert.id)}
                        className="px-3 py-1.5 rounded-lg bg-base-elevated border border-base-border text-xs text-text-muted hover:text-text-primary hover:bg-base-border transition-colors font-medium"
                      >
                        Acknowledge
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Stats Row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-2">
            <div className="bg-base-surface rounded-xl border border-base-border p-4 text-center">
              <p className="text-[10px] uppercase tracking-wider text-text-faint">Total Today</p>
              <p className="font-mono text-xl font-bold text-text-primary mt-1">24</p>
            </div>
            <div className="bg-base-surface rounded-xl border border-base-border p-4 text-center">
              <p className="text-[10px] uppercase tracking-wider text-text-faint">Acknowledged</p>
              <p className="font-mono text-xl font-bold text-gridok mt-1">18</p>
            </div>
            <div className="bg-base-surface rounded-xl border border-base-border p-4 text-center">
              <p className="text-[10px] uppercase tracking-wider text-text-faint">Pending</p>
              <p className="font-mono text-xl font-bold text-critical mt-1">6</p>
            </div>
            <div className="bg-base-surface rounded-xl border border-base-border p-4 text-center">
              <p className="text-[10px] uppercase tracking-wider text-text-faint">MTTR (Avg Resolve)</p>
              <p className="font-mono text-xl font-bold text-battery mt-1">4.2m</p>
            </div>
          </div>

          {/* Coming Soon Banner */}
          <div className="rounded-xl bg-base-surface border border-battery/30 p-4 text-center space-y-1">
            <p className="text-xs text-battery font-semibold">Coming Soon</p>
            <p className="text-xs text-text-muted">
              Full alert management with rule configuration, escalation policies, and notification channels — Milestone 8
            </p>
          </div>
        </main>
      </div>
    </div>
  )
}
