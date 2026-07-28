/**
 * AIPredictionPanel
 *
 * Self-contained component that polls /ai/predict (every 10 s) and
 * /ai/status (every 30 s) using the existing usePolledEndpoint hook
 * and renders the model's output in the VITAL-OS design system.
 *
 * Handles three states cleanly:
 *   1. Backend unreachable / loading
 *   2. Model not yet trained (< 10 simulation intervals)
 *   3. Prediction ready — show all four fields
 */

import { usePolledEndpoint } from '../useApi.js'

// prediction + predError are now passed as props from App.jsx.
// Only /ai/status is polled internally (training metadata is only
// used here, so no reason to lift it further up the tree).

// ── Risk level config ────────────────────────────────────────────────────────

const RISK_CONFIG = {
  LOW: {
    label: 'LOW',
    color: '#3DD68C',
    bg: '#3DD68C12',
    border: '#3DD68C30',
    barWidth: '30%',
  },
  MEDIUM: {
    label: 'MEDIUM',
    color: '#F5A623',
    bg: '#F5A62312',
    border: '#F5A62330',
    barWidth: '65%',
  },
  HIGH: {
    label: 'HIGH',
    color: '#FF5C5C',
    bg: '#FF5C5C12',
    border: '#FF5C5C40',
    barWidth: '100%',
  },
}

// ── Icons ────────────────────────────────────────────────────────────────────

function BrainIcon({ color = '#7C9EFF' }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="w-4 h-4">
      <path
        d="M7 3.5C5.6 3.5 4.5 4.6 4.5 6c0 .4.1.8.3 1.1C3.7 7.5 3 8.4 3 9.5c0 1 .6 1.9 1.5 2.3-.1.3-.2.6-.2 1 0 1.4 1 2.5 2.3 2.7H10M13 3.5c1.4 0 2.5 1.1 2.5 2.5 0 .4-.1.8-.3 1.1.9.4 1.6 1.3 1.6 2.4 0 1-.6 1.9-1.5 2.3.1.3.2.6.2 1 0 1.4-1 2.5-2.3 2.7H10M10 3.5v13"
        stroke={color}
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function LiveDot() {
  return (
    <span className="relative flex h-2 w-2">
      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-battery opacity-60" />
      <span className="relative inline-flex rounded-full h-2 w-2 bg-battery" />
    </span>
  )
}

// ── Sub-components ───────────────────────────────────────────────────────────

function MetricBlock({ label, value, unit, accent = '#E8EDF4' }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[10px] uppercase tracking-wider text-text-faint">
        {label}
      </span>
      <div className="flex items-baseline gap-1">
        <span
          className="text-2xl font-mono font-semibold leading-none"
          style={{ color: accent }}
        >
          {value}
        </span>
        {unit && (
          <span className="text-xs text-text-faint">{unit}</span>
        )}
      </div>
    </div>
  )
}

function RiskMeter({ level }) {
  const cfg = RISK_CONFIG[level] || RISK_CONFIG.LOW
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[10px] uppercase tracking-wider text-text-faint">
        Risk Level
      </span>
      <div className="flex items-center gap-2.5">
        <span
          className="text-xs font-semibold font-mono px-2.5 py-0.5 rounded-full border shrink-0"
          style={{ color: cfg.color, background: cfg.bg, borderColor: cfg.border }}
        >
          {cfg.label}
        </span>
        <div className="flex-1 h-1.5 bg-base-border rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{ width: cfg.barWidth, background: cfg.color }}
          />
        </div>
      </div>
    </div>
  )
}

function RecommendationBox({ text }) {
  return (
    <div className="rounded-lg bg-base-elevated border border-base-border px-3.5 py-3">
      <p className="text-[10px] uppercase tracking-wider text-text-faint mb-1.5">
        AI Recommendation
      </p>
      <p className="text-sm text-text-primary leading-relaxed">{text}</p>
    </div>
  )
}

function TrainingFooter({ status }) {
  if (!status) return null

  if (!status.trained) {
    return (
      <p className="text-[11px] text-text-faint flex items-center gap-1.5">
        <span className="w-1.5 h-1.5 rounded-full bg-text-faint inline-block" />
        Model not trained yet
      </p>
    )
  }

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-text-faint">
      <span className="flex items-center gap-1.5">
        <span className="w-1.5 h-1.5 rounded-full bg-gridok inline-block" />
        Model trained
      </span>
      <span className="text-base-border">·</span>
      <span>{status.training_samples} samples</span>
      <span className="text-base-border">·</span>
      <span>RMSE {status.rmse?.toFixed(2)} kW</span>
      <span className="text-base-border">·</span>
      <span className="font-mono text-[10px] text-text-faint">{status.model}</span>
    </div>
  )
}

function NotTrainedPlaceholder() {
  return (
    <div className="rounded-lg border border-dashed border-base-border px-4 py-8 flex flex-col items-center gap-3 text-center">
      <BrainIcon color="#5A6478" />
      <div>
        <p className="text-sm text-text-muted font-medium">Model not yet trained</p>
        <p className="text-xs text-text-faint mt-1 max-w-sm">
          The AI model needs at least 10 simulation intervals.
          Use{' '}
          <code className="font-mono text-[11px] text-battery bg-base-elevated px-1 py-0.5 rounded">
            GET /simulation/run
          </code>
          {' '}or click <strong className="text-text-muted font-medium">Refresh</strong> in the header.
        </p>
      </div>
    </div>
  )
}

function LoadingPlaceholder() {
  return (
    <div className="rounded-lg border border-dashed border-base-border px-4 py-8 flex flex-col items-center gap-3 text-center">
      <span className="w-2.5 h-2.5 rounded-full bg-battery animate-pulsedot inline-block" />
      <p className="text-sm text-text-muted">Waiting for AI prediction…</p>
      <p className="text-xs text-text-faint">
        Run the simulation to generate training data.
      </p>
    </div>
  )
}

// ── Main export ──────────────────────────────────────────────────────────────

export default function AIPredictionPanel({ prediction, predError, predLoading }) {
  const { data: aiStatus } = usePolledEndpoint('/ai/status', 30000)

  // 503 from the backend means "not enough simulation data to train"
  const notTrained =
    predError?.includes('503') ||
    (aiStatus !== null && aiStatus?.trained === false)

  const isLoading = predLoading && !prediction && !notTrained
  const showPrediction = !isLoading && !notTrained && prediction

  return (
    <div className="bg-base-surface rounded-xl border border-base-border shadow-card p-4">

      {/* ── Panel header ───────────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-battery/10 border border-battery/20 flex items-center justify-center shrink-0">
            <BrainIcon />
          </div>
          <div className="leading-tight">
            <p className="text-xs font-medium text-text-muted uppercase tracking-wider">
              AI Load Forecast
            </p>
            <p className="text-[10px] text-text-faint mt-0.5">
              GradientBoosting · 15-min ahead
            </p>
          </div>
        </div>

        {showPrediction && (
          <div className="flex items-center gap-1.5 text-[11px] text-battery">
            <LiveDot />
            <span>Live</span>
          </div>
        )}
      </div>

      {/* ── States ─────────────────────────────────────────────────────── */}
      {isLoading   && <LoadingPlaceholder />}
      {notTrained  && <NotTrainedPlaceholder />}

      {/* ── Prediction content ─────────────────────────────────────────── */}
      {showPrediction && (
        <div className="flex flex-col gap-4">

          {/* Metrics row */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-4 pb-4 border-b border-base-border">
            <MetricBlock
              label="Predicted Load"
              value={prediction.predicted_load?.toFixed(1) ?? '—'}
              unit="kW"
              accent="#FF7849"
            />
            <MetricBlock
              label="Confidence"
              value={prediction.confidence?.toFixed(1) ?? '—'}
              unit="%"
              accent="#7C9EFF"
            />
            <div className="col-span-2 sm:col-span-1">
              <RiskMeter level={prediction.risk_level ?? 'LOW'} />
            </div>
          </div>

          {/* Recommendation */}
          <RecommendationBox text={prediction.recommendation ?? '—'} />

          {/* Training status footer */}
          <TrainingFooter status={aiStatus} />

        </div>
      )}

    </div>
  )
}
