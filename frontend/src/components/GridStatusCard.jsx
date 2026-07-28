const STATUS_CONFIG = {
  NORMAL: {
    label: 'Grid Normal',
    color: '#3DD68C',
    bg: '#3DD68C12',
    border: '#3DD68C30',
    description: 'Utility connection stable',
    pulse: false,
  },
  OUTAGE: {
    label: 'Grid Outage',
    color: '#FF5C5C',
    bg: '#FF5C5C12',
    border: '#FF5C5C40',
    description: 'Running on battery + renewables',
    pulse: true,
  },
  RESTORED: {
    label: 'Grid Restored',
    color: '#F5A623',
    bg: '#F5A62312',
    border: '#F5A62330',
    description: 'Utility reconnected, stabilising',
    pulse: false,
  },
}

function ZapIcon({ color }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="w-5 h-5">
      <path d="M11 2 4 11.5h5L8.5 18 16 8h-5L11 2Z" stroke={color} strokeWidth="1.6" strokeLinejoin="round" fill={`${color}30`} />
    </svg>
  )
}

export default function GridStatusCard({ status = 'NORMAL', gridImportKw = 0, gridExportKw = 0 }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.NORMAL

  return (
    <div
      className="rounded-xl border shadow-card p-4 flex flex-col gap-3 h-full transition-colors duration-500"
      style={{ background: cfg.bg, borderColor: cfg.border }}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-text-muted uppercase tracking-wider">Grid Status</span>
        <div className="flex items-center gap-1.5">
          <span
            className={`w-2 h-2 rounded-full ${cfg.pulse ? 'animate-pulsedot' : ''}`}
            style={{ background: cfg.color }}
          />
        </div>
      </div>

      <div className="flex items-center gap-2.5">
        <div
          className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
          style={{ background: cfg.bg, border: `1px solid ${cfg.border}` }}
        >
          <ZapIcon color={cfg.color} />
        </div>
        <div>
          <p className="font-display font-semibold text-base" style={{ color: cfg.color }}>
            {cfg.label}
          </p>
          <p className="text-[11px] text-text-faint mt-0.5">{cfg.description}</p>
        </div>
      </div>

      <div className="border-t border-white/5 pt-2 grid grid-cols-2 gap-3 mt-auto">
        <div>
          <p className="text-[10px] text-text-faint uppercase tracking-wide mb-0.5">Importing</p>
          <p className="font-mono text-sm text-text-primary">{gridImportKw.toFixed(1)} <span className="text-text-faint text-xs">kW</span></p>
        </div>
        <div>
          <p className="text-[10px] text-text-faint uppercase tracking-wide mb-0.5">Exporting</p>
          <p className="font-mono text-sm text-text-primary">{gridExportKw.toFixed(1)} <span className="text-text-faint text-xs">kW</span></p>
        </div>
      </div>
    </div>
  )
}
