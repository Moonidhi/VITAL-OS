import React from 'react'

export default function StatCard({
  label,
  title,
  value,
  unit,
  subvalue,
  sublabel,
  subtitle,
  accent = '#E8EDF4',
  icon,
  trend,
  sparkline,
  loading = false,
  onClick,
}) {
  const cardTitle = title || label
  const cardSubtitle = subtitle || sublabel

  if (loading) {
    return (
      <div className="bg-base-surface rounded-xl border border-base-border shadow-card p-4 flex flex-col gap-2.5 h-full">
        <div className="skeleton h-4 w-24" />
        <div className="skeleton h-8 w-32 my-auto" />
        <div className="skeleton h-3 w-40" />
      </div>
    )
  }

  // Generate SVG points for sparkline if provided
  let sparklinePoints = ''
  let sparklineFill = ''
  if (Array.isArray(sparkline) && sparkline.length > 1) {
    const min = Math.min(...sparkline)
    const max = Math.max(...sparkline)
    const range = max - min || 1
    const width = 80
    const height = 24

    const points = sparkline.map((val, idx) => {
      const x = (idx / (sparkline.length - 1)) * width
      const y = height - ((val - min) / range) * (height - 4) - 2
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })

    sparklinePoints = points.join(' ')
    sparklineFill = `0,${height} ${sparklinePoints} ${width},${height}`
  }

  return (
    <div
      onClick={onClick}
      className={`bg-base-surface hover:bg-base-elevated/50 rounded-xl border border-base-border shadow-card p-4 flex flex-col gap-2.5 h-full transition-all duration-300 hover:scale-[1.01] hover:shadow-lg ${
        onClick ? 'cursor-pointer active:scale-[0.99]' : ''
      }`}
      style={{ borderTop: `2px solid ${accent}66` }}
    >
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

        {/* Trend Indicator */}
        {trend !== undefined && (
          <div className="flex items-center gap-1 shrink-0">
            {typeof trend === 'object' ? (
              <span
                className={`text-xs font-mono font-semibold ${
                  trend.value >= 0 ? 'text-gridok' : 'text-gridout'
                }`}
              >
                {trend.value >= 0 ? '↑' : '↓'} {Math.abs(trend.value).toFixed(1)}%
              </span>
            ) : (
              <span
                className={`text-xs font-mono font-semibold ${
                  trend >= 0 ? 'text-gridok' : 'text-gridout'
                }`}
              >
                {trend >= 0 ? '↑' : '↓'} {Math.abs(trend).toFixed(1)}
              </span>
            )}
          </div>
        )}
      </div>

      <div className="flex items-baseline justify-between gap-1.5 my-auto">
        <div className="flex items-baseline gap-1.5">
          <span
            className="font-mono font-bold leading-tight text-lg sm:text-xl md:text-2xl tabular-nums num-transition"
            style={{ color: accent }}
          >
            {value}
          </span>
          {unit && <span className="text-text-muted text-xs font-medium">{unit}</span>}
        </div>

        {/* Inline SVG Sparkline */}
        {sparklinePoints && (
          <svg className="w-20 h-6 overflow-visible shrink-0" viewBox="0 0 80 24">
            <polygon points={sparklineFill} fill={accent} fillOpacity="0.15" />
            <polyline
              points={sparklinePoints}
              fill="none"
              stroke={accent}
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </div>

      {(subvalue !== undefined || cardSubtitle) && (
        <div className="flex items-center justify-between border-t border-base-border/50 pt-2 mt-auto">
          <span className="text-[11px] text-text-faint leading-tight truncate">{cardSubtitle}</span>
          {subvalue !== undefined && (
            <span className="text-[11px] font-mono text-text-muted shrink-0 ml-2">{subvalue}</span>
          )}
        </div>
      )}
    </div>
  )
}
