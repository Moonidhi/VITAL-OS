import { useEffect, useState } from 'react'

function SignalIcon({ connected }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="w-3.5 h-3.5">
      <path d="M2 14c1.5-2 3.8-3.3 8-3.3s6.5 1.3 8 3.3" stroke={connected ? '#3DD68C' : '#FF5C5C'} strokeWidth="1.5" strokeLinecap="round" />
      <path d="M4.5 11.5C6 9.8 7.8 9 10 9s4 .8 5.5 2.5" stroke={connected ? '#3DD68C' : '#FF5C5C'} strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="10" cy="17" r="1.2" fill={connected ? '#3DD68C' : '#FF5C5C'} />
    </svg>
  )
}

function RefreshIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" className="w-3.5 h-3.5">
      <path d="M13 8A5 5 0 1 1 8 3c1.4 0 2.6.5 3.5 1.4L13 6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M11 6h2V4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export default function Header({ connected, lastUpdated, onRefresh }) {
  const [clock, setClock] = useState(new Date())

  useEffect(() => {
    const t = setInterval(() => setClock(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  const pad = (n) => String(n).padStart(2, '0')
  const timeStr = `${pad(clock.getHours())}:${pad(clock.getMinutes())}:${pad(clock.getSeconds())}`
  const dateStr = clock.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })

  const updatedStr = lastUpdated
    ? `${pad(lastUpdated.getHours())}:${pad(lastUpdated.getMinutes())}:${pad(lastUpdated.getSeconds())}`
    : '—'

  return (
    <header className="h-16 flex items-center justify-between px-6 border-b border-base-border bg-base-surface/80 backdrop-blur-sm shrink-0">
      <div className="flex items-center gap-4">
        <div>
          <h1 className="font-display font-semibold text-sm text-text-primary tracking-wide">
            Energy Overview
          </h1>
          <p className="text-xs text-text-faint">{dateStr}</p>
        </div>
      </div>

      <div className="flex items-center gap-5">
        <div className="flex items-center gap-2">
          <SignalIcon connected={connected} />
          <span className={`text-xs font-medium ${connected ? 'text-gridok' : 'text-gridout'}`}>
            {connected ? 'Backend connected' : 'Backend offline'}
          </span>
        </div>

        {connected && (
          <span className="text-xs text-text-faint">
            Updated {updatedStr}
          </span>
        )}

        <button
          onClick={onRefresh}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-base-elevated text-text-muted hover:text-text-primary hover:bg-base-border text-xs transition-colors"
        >
          <RefreshIcon />
          Refresh
        </button>

        <div className="text-right">
          <p className="font-mono text-base font-semibold text-text-primary tracking-widest">{timeStr}</p>
        </div>
      </div>
    </header>
  )
}
