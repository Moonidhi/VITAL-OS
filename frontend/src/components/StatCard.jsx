export default function StatCard({ label, title, value, unit, subvalue, sublabel, subtitle, accent = '#E8EDF4', icon, trend }) {
  const cardTitle = title || label
  const cardSubtitle = subtitle || sublabel

  return (
    <div className="bg-base-surface rounded-xl border border-base-border shadow-card p-4 flex flex-col gap-2.5 h-full">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {icon && (
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
              style={{ background: `${accent}18`, border: `1px solid ${accent}30` }}
            >
              {icon}
            </div>
          )}
          <span className="text-[11px] sm:text-xs font-semibold text-text-muted uppercase tracking-wider truncate">
            {cardTitle}
          </span>
        </div>
        {trend !== undefined && (
          <span className={`text-xs font-mono shrink-0 ${trend >= 0 ? 'text-gridok' : 'text-gridout'}`}>
            {trend >= 0 ? '↑' : '↓'} {Math.abs(trend).toFixed(1)}
          </span>
        )}
      </div>

      <div className="flex items-baseline gap-1.5 my-auto">
        <span
          className="font-mono font-bold leading-tight text-lg sm:text-xl md:text-2xl"
          style={{ color: accent }}
        >
          {value}
        </span>
        {unit && <span className="text-text-muted text-xs font-medium">{unit}</span>}
      </div>

      {(subvalue !== undefined || cardSubtitle) && (
        <div className="flex items-center justify-between border-t border-base-border/40 pt-2 mt-auto">
          <span className="text-[11px] text-text-faint leading-tight">{cardSubtitle}</span>
          {subvalue !== undefined && (
            <span className="text-[11px] font-mono text-text-muted">{subvalue}</span>
          )}
        </div>
      )}
    </div>
  )
}
