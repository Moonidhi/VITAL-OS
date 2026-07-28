import { NavLink } from 'react-router-dom'

const NAV_ITEMS = [
  { label: 'Overview',    to: '/',            icon: GridIcon    },
  { label: 'Patients',    to: '/patients',    icon: PulseIcon   },
  { label: 'Microgrid',   to: '/microgrid',   icon: BoltIcon    },
  { label: 'Departments', to: '/departments', icon: BuildingIcon },
  { label: 'Alerts',      to: '/alerts',      icon: BellIcon    },
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
function BellIcon({ className }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" className={className}>
      <path d="M10 2.5c-2.3 0-4 1.9-4 4.3v2.4c0 .5-.2 1-.6 1.4L4 12h12l-1.4-1.4a2 2 0 0 1-.6-1.4V6.8c0-2.4-1.7-4.3-4-4.3Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M8.2 15a1.8 1.8 0 0 0 3.6 0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

export default function Sidebar() {
  return (
    <aside className="hidden md:flex w-60 shrink-0 flex-col border-r border-base-border bg-base-surface/60 backdrop-blur-sm">
      <div className="flex items-center gap-2.5 px-5 h-16 border-b border-base-border">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-battery to-wind flex items-center justify-center shrink-0">
          <BoltIcon className="w-4.5 h-4.5 text-base" />
        </div>
        <div className="leading-tight">
          <p className="font-display font-semibold text-sm tracking-wide text-text-primary">VITAL-OS</p>
          <p className="text-[10px] text-text-faint tracking-wider uppercase">Microgrid Control</p>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1">
        {NAV_ITEMS.map(({ label, to, icon: Icon }) => (
          <NavLink
            key={label}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                isActive
                  ? 'bg-base-elevated text-text-primary shadow-card'
                  : 'text-text-muted hover:text-text-primary hover:bg-base-elevated/60'
              }`
            }
          >
            <Icon className="w-4 h-4 shrink-0" />
            <span>{label}</span>
            {/* Active dot rendered via NavLink's isActive — inline so it stays DRY */}
            <span className="ml-auto">
              <ActiveDot to={to} />
            </span>
          </NavLink>
        ))}
      </nav>

      <div className="px-4 py-4 border-t border-base-border">
        <div className="rounded-lg bg-base-elevated px-3 py-3 space-y-1">
          <p className="text-[10px] uppercase tracking-wider text-text-faint">Facility</p>
          <p className="text-sm text-text-primary font-medium">St. Vital General</p>
          <p className="text-xs text-text-faint">7 departments · 1 microgrid</p>
        </div>
      </div>
    </aside>
  )
}

// Small helper: renders the battery-coloured active dot only on the current route.
// Using a separate component lets us call useLocation without prop-drilling.
import { useLocation } from 'react-router-dom'

function ActiveDot({ to }) {
  const { pathname } = useLocation()
  const isActive = to === '/' ? pathname === '/' : pathname.startsWith(to)
  return isActive ? <span className="w-1.5 h-1.5 rounded-full bg-battery inline-block" /> : null
}
