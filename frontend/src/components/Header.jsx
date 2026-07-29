import { useEffect, useState } from 'react'
import { useHealthCheck, API_BASE } from '../useApi.js'

function SignalIcon({ connected }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="w-3.5 h-3.5">
      <path d="M2 14c1.5-2 3.8-3.3 8-3.3s6.5 1.3 8 3.3" stroke={connected ? '#3DD68C' : '#FF5C5C'} strokeWidth="1.5" strokeLinecap="round" />
      <path d="M4.5 11.5C6 9.8 7.8 9 10 9s4 .8 5.5 2.5" stroke={connected ? '#3DD68C' : '#FF5C5C'} strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="10" cy="17" r="1.2" fill={connected ? '#3DD68C' : '#FF5C5C'} />
    </svg>
  )
}

function RefreshIcon({ isRefreshing }) {
  return (
    <svg viewBox="0 0 16 16" fill="none" className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`}>
      <path d="M13 8A5 5 0 1 1 8 3c1.4 0 2.6.5 3.5 1.4L13 6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M11 6h2V4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function DownloadIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" className="w-3.5 h-3.5">
      <path d="M8 2v8m0 0l-3-3m3 3l3-3M3 13h10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function HamburgerIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="w-5 h-5 text-text-muted">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  )
}

export default function Header({
  title = 'Energy Overview',
  connected,
  lastUpdated,
  onRefresh,
  systemHealth = 'healthy',
  isRefreshing = false,
}) {
  const [clock, setClock] = useState(new Date())
  const health = useHealthCheck(5000)

  const isConnected = typeof connected === 'boolean' ? connected : health.connected
  const effectiveLastUpdated = lastUpdated || health.lastUpdated

  useEffect(() => {
    const t = setInterval(() => setClock(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  const pad = (n) => String(n).padStart(2, '0')
  const timeStr = `${pad(clock.getHours())}:${pad(clock.getMinutes())}:${pad(clock.getSeconds())}`

  const dayStr = clock.toLocaleDateString('en-IN', { weekday: 'long' })
  const dateStr = clock.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
  const fullDateStr = `${dayStr} · ${dateStr}`

  const updatedStr = effectiveLastUpdated
    ? `${pad(effectiveLastUpdated.getHours())}:${pad(effectiveLastUpdated.getMinutes())}:${pad(effectiveLastUpdated.getSeconds())}`
    : '—'

  const healthConfig = {
    healthy: { dot: 'bg-[#3DD68C]', text: 'text-[#3DD68C]', label: 'System Healthy' },
    degraded: { dot: 'bg-[#F5A623]', text: 'text-[#F5A623]', label: 'Degraded' },
    critical: { dot: 'bg-[#FF5C5C]', text: 'text-[#FF5C5C]', label: 'Critical Alert' },
  }
  const currentHealth = healthConfig[systemHealth] || healthConfig.healthy

  return (
    <header className="relative flex flex-col shrink-0 bg-base-surface/80 backdrop-blur-sm z-30">
      <div className="h-16 flex items-center justify-between px-6">
        <div className="flex items-center gap-3">
          <button className="md:hidden p-1 rounded-md bg-base-elevated border border-base-border">
            <HamburgerIcon />
          </button>

          <div>
            <h1 className="font-display font-semibold text-sm text-text-primary tracking-wide">
              {title}
            </h1>
            <p className="text-xs text-text-faint font-medium">{fullDateStr}</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-base-elevated/60 border border-base-border/60">
            <span className={`w-2 h-2 rounded-full ${currentHealth.dot} animate-pulse`} />
            <span className={`text-xs font-medium font-mono ${currentHealth.text}`}>
              {currentHealth.label}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <SignalIcon connected={isConnected} />
            <span className={`text-xs font-medium ${isConnected ? 'text-gridok' : 'text-gridout'}`}>
              {isConnected ? 'Connected' : 'Offline'}
            </span>
          </div>

          {isConnected && (
            <span className="hidden lg:inline text-xs text-text-faint font-mono">
              Updated {updatedStr}
            </span>
          )}

          {/* Download PDF Daily Report Button */}
          <a
            href={`${API_BASE}/reports/daily`}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-battery/15 border border-battery/30 text-battery hover:bg-battery/25 text-xs transition-colors font-medium"
            title="Download Daily PDF Summary Report"
          >
            <DownloadIcon />
            <span className="hidden sm:inline">Download Report</span>
          </a>

          {onRefresh && (
            <button
              onClick={onRefresh}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-base-elevated text-text-muted hover:text-text-primary hover:bg-base-border text-xs transition-colors"
            >
              <RefreshIcon isRefreshing={isRefreshing} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
          )}

          <div className="text-right">
            <p className="font-mono text-base font-semibold text-text-primary tracking-widest">{timeStr}</p>
          </div>
        </div>
      </div>

      <div className="h-px bg-gradient-to-r from-transparent via-base-border to-transparent" />
    </header>
  )
}
