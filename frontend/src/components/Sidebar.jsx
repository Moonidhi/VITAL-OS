import { NavLink, useLocation } from 'react-router-dom'
import { usePolledEndpoint } from '../useApi.js'

const NAV_ITEMS = [
  { label: 'Overview', to: '/', icon: GridIcon, desc: 'Overview — Live energy dashboard' },
  { label: 'Patients', to: '/patients', icon: PulseIcon, desc: 'Patients — Patient management & triage' },
  { label: 'Microgrid', to: '/microgrid', icon: BoltIcon, desc: 'Microgrid — Live generation & BESS storage' },
  { label: 'Departments', to: '/departments', icon: BuildingIcon, desc: 'Departments — Wards & energy allocations' },
  { label: 'Analytics', to: '/analytics', icon: ChartIcon, desc: 'Analytics — Performance & predictive trends' },
  { label: 'Alerts', to: '/alerts', icon: BellIcon, desc: 'Alerts — System alerts & fault logs' },
]

function GridIcon({ className }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" className={className}>
      <rect x="2.5" y="2.5" width="6" height="6" rx="1.2" stroke="currentColor" strokeWidth="1.5" />
      <rect x="11.5" y="2.5" width="6" height="6" rx="1.2" stroke="currentColor" strokeWidth="1.5" />
      <rect x="2.5" y="11.5" width="6" height="6" rx="1.2" stroke="currentColor" strokeWidth="1.5" />
      <rect x="11.5" y="11.5" width="6" height="6" rx="1.2" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  )
}
function PulseIcon({ className }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" className={className}>
      <path d="M2 10h3.5l1.8-5 3 9 2-5.5 1.4 1.5H18" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
function BoltIcon({ className }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" className={className}>
      <path d="M11 2 4 11.5h5L8.5 18 16 8h-5L11 2Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  )
}
function BuildingIcon({ className }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" className={className}>
      <rect x="4" y="3" width="9" height="14" rx="1" stroke="currentColor" strokeWidth="1.5" />
      <path d="M7 7h1M7 10h1M7 13h1M11 7h1M11 10h1M11 13h1M13 17v-3.5h3.5V17" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  )
}
function ChartIcon({ className }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" className={className}>
      <path d="M3 17h14M4 14l4-5 3 3 5-7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
function BellIcon({ className }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" className={className}>
      <path d="M10 2.5c-2.3 0-4 1.9-4 4.3v2.4c0 .5-.2 1-.6 1.4L4 12h12l-1.4-1.4a2 2 0 0 1-.6-1.4V6.8c0-2.4-1.7-4.3-4-4.3Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M8.2 15a1.8 1.8 0 0 0 3.6 0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

function ActiveDot({ to }) {
  const { pathname } = useLocation()
  const isActive = to === '/' ? pathname === '/' : pathname.startsWith(to)
  return isActive ? <span className="w-1.5 h-1.5 rounded-full bg-battery inline-block shadow-[0_0_8px_#7C9EFF]" /> : null
}

export default function Sidebar() {
  const { data: alertStats } = usePolledEndpoint('/alerts/stats', 8000)
  const criticalCount = alertStats?.critical_alerts ?? 0

  return (
    <aside className="hidden md:flex w-60 shrink-0 flex-col border-r border-base-border bg-gradient-to-b from-base-surface to-base backdrop-blur-sm z-40">
      <div className="flex items-center gap-2.5 px-5 h-16 border-b border-base-border">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-battery to-wind flex items-center justify-center shrink-0 shadow-card">
          <BoltIcon className="w-4.5 h-4.5 text-base" />
        </div>
        <div className="leading-tight">
          <p className="font-display font-semibold text-sm tracking-wide text-text-primary">VITAL-OS</p>
          <p className="text-[10px] text-text-faint tracking-wider uppercase">Microgrid Control</p>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1">
        {NAV_ITEMS.map(({ label, to, icon: Icon, desc }) => (
          <NavLink
            key={label}
            to={to}
            end={to === '/'}
            title={desc}
            className={({ isActive }) =>
              `group relative w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all duration-200 ${
                isActive
                  ? 'text-text-primary shadow-card border-l-2 border-battery'
                  : 'text-text-muted hover:text-text-primary hover:bg-base-elevated/60'
              }`
            }
            style={({ isActive }) =>
              isActive
                ? {
                    background:
                      'linear-gradient(135deg, rgba(124,158,255,0.12) 0%, rgba(124,158,255,0.04) 100%)',
                  }
                : {}
            }
          >
            <Icon className="w-4 h-4 shrink-0 transition-transform duration-200 group-hover:translate-x-0.5" />
            <span>{label}</span>

            {/* Critical Alert Badge */}
            {label === 'Alerts' && criticalCount > 0 && (
              <span className="px-1.5 py-0.2 text-[10px] font-bold rounded-full bg-rose-500 text-white animate-pulse">
                {criticalCount}
              </span>
            )}

            <span className="ml-auto">
              <ActiveDot to={to} />
            </span>
          </NavLink>
        ))}
      </nav>

      <div className="px-4 py-3 border-t border-base-border space-y-3">
        <div className="rounded-lg bg-base-elevated/80 border border-base-border/50 px-3 py-3 space-y-1">
          <div className="flex items-center justify-between">
            <p className="text-[10px] uppercase tracking-wider text-text-faint">Facility</p>
            <span className="w-2 h-2 rounded-full bg-gridok animate-pulse" />
          </div>
          <p className="text-sm text-text-primary font-medium">St. Vital General</p>
          <p className="text-xs text-text-faint">7 departments · 1 microgrid</p>
        </div>

        {/* API Endpoint Footer */}
        <div className="text-[9px] font-mono text-text-faint text-center tracking-wider">
          API: http://127.0.0.1:8000
        </div>
      </div>
    </aside>
  )
}
