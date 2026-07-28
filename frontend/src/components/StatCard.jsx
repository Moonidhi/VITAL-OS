export default function StatCard({ label, value, unit, subvalue, sublabel, accent = '#E8EDF4', icon, trend }) {
  return (
    <div className="bg-base-surface rounded-xl border border-base-border shadow-card p-4 flex flex-col gap-3 h-full">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          {icon && (
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
              style={{ background: `${accent}18`, border: `1px solid ${accent}30` }}
            >
              {icon}
            </div>
          )}
          <span className="text-xs font-medium text-text-muted uppercase tracking-wider">{label}</span>
        </div>
        {trend !== undefined && (
          <span className={`text-xs font-mono ${trend >= 0 ? 'text-gridok' : 'text-gridout'}`}>
            {trend >= 0 ? '↑' : '↓'} {Math.abs(trend).toFixed(1)}
          </span>
        )}
      </div>

      <div className="flex items-baseline gap-1.5">
        <span
          className="font-mono font-semibold leading-none"
          style={{ fontSize: '2rem', color: accent }}
        >
          {value}
        </span>
        {unit && <span className="text-text-muted text-sm font-medium">{unit}</span>}
      </div>

      {(subvalue !== undefined || sublabel) && (
        <div className="flex items-center justify-between border-t border-base-border pt-2 mt-auto">
          <span className="text-xs text-text-faint">{sublabel}</span>
          {subvalue !== undefined && (
            <span className="text-xs font-mono text-text-muted">{subvalue}</span>
          )}
        </div>
      )}
    </div>
  )
}
