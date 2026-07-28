export function SunIcon({ color = '#F5A623' }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="w-4 h-4">
      <circle cx="10" cy="10" r="3.5" stroke={color} strokeWidth="1.5" />
      <path d="M10 2v2M10 16v2M2 10h2M16 10h2M4.2 4.2l1.4 1.4M14.4 14.4l1.4 1.4M4.2 15.8l1.4-1.4M14.4 5.6l1.4-1.4"
        stroke={color} strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

export function WindIcon({ color = '#4DD0C4' }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="w-4 h-4">
      <path d="M3 8h9a2.5 2.5 0 0 0 0-5c-1 0-1.8.5-2.2 1.3" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
      <path d="M3 12h12a2.5 2.5 0 0 1 0 5c-1 0-1.8-.5-2.2-1.3" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
      <path d="M3 10h7" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

export function BatteryIcon({ color = '#7C9EFF' }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="w-4 h-4">
      <rect x="2" y="6" width="13" height="8" rx="1.5" stroke={color} strokeWidth="1.5" />
      <path d="M15 9v2h2.5V9H15Z" stroke={color} strokeWidth="1.2" />
      <rect x="4" y="8" width="4" height="4" rx="0.5" fill={color} />
    </svg>
  )
}

export function HospitalIcon({ color = '#FF7849' }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="w-4 h-4">
      <rect x="3" y="4" width="14" height="13" rx="1.5" stroke={color} strokeWidth="1.5" />
      <path d="M10 8v4M8 10h4" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}
