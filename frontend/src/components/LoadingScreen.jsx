import React, { useState, useEffect } from 'react'

const STEPS = [
  'Loading solar & wind irradiance data...',
  'Initializing 7 hospital department telemetry...',
  'Training GradientBoosting AI forecast model...',
  'Seeding 96 simulation intervals...',
  'Simulation Engine Ready',
]

function BoltIcon({ className }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <path
        d="M13 2L3 14H12L11 22L21 10H12L13 2Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
        fill="currentColor"
        fillOpacity="0.2"
      />
    </svg>
  )
}

export default function LoadingScreen({ isLoading }) {
  const [stepIndex, setStepIndex] = useState(0)
  const [progress, setProgress] = useState(10)
  const [visible, setVisible] = useState(true)
  const [fadeOut, setFadeOut] = useState(false)

  // Step cycling timer
  useEffect(() => {
    if (!isLoading && progress >= 100) {
      setFadeOut(true)
      const timer = setTimeout(() => setVisible(false), 700)
      return () => clearTimeout(timer)
    }

    const stepInterval = setInterval(() => {
      setStepIndex((prev) => {
        if (prev < STEPS.length - 1) return prev + 1
        return prev
      })
    }, 450)

    const progressInterval = setInterval(() => {
      setProgress((prev) => {
        if (!isLoading) return 100
        if (prev < 90) return prev + Math.floor(Math.random() * 8) + 4
        return 92
      })
    }, 150)

    return () => {
      clearInterval(stepInterval)
      clearInterval(progressInterval)
    }
  }, [isLoading, progress])

  // When isLoading turns false, set progress to 100 and fade out
  useEffect(() => {
    if (!isLoading) {
      setProgress(100)
      setStepIndex(STEPS.length - 1)
      const timer = setTimeout(() => {
        setFadeOut(true)
        setTimeout(() => setVisible(false), 700)
      }, 300)
      return () => clearTimeout(timer)
    }
  }, [isLoading])

  if (!visible) return null

  return (
    <div
      className={`fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#0B0F14] bg-gradient-mesh transition-opacity duration-700 ${
        fadeOut ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
    >
      <div className="relative flex flex-col items-center max-w-md w-full px-6 space-y-8 text-center">
        {/* Animated Glow Rings Behind Logo */}
        <div className="relative flex items-center justify-center">
          <div className="absolute w-32 h-32 rounded-full bg-battery/20 animate-ping opacity-40" />
          <div className="absolute w-24 h-24 rounded-full bg-battery/30 animate-pulse opacity-60" />

          {/* Logo Badge */}
          <div className="relative w-16 h-16 rounded-2xl bg-gradient-to-br from-battery via-[#4DD0C4] to-solar p-0.5 shadow-[0_0_40px_rgba(124,158,255,0.4)]">
            <div className="w-full h-full bg-[#0B0F14] rounded-[14px] flex items-center justify-center">
              <BoltIcon className="w-8 h-8 text-battery animate-float" />
            </div>
          </div>
        </div>

        {/* Title */}
        <div className="space-y-1.5">
          <h1 className="font-display font-bold text-2xl tracking-wider text-[#E8EDF4]">
            VITAL-OS
          </h1>
          <p className="text-xs uppercase tracking-[0.25em] text-[#8B95A7] font-semibold">
            Microgrid & Patient Operations Engine
          </p>
        </div>

        {/* Progress Step & Bar */}
        <div className="w-full space-y-3">
          <div className="flex items-center justify-between text-xs font-mono">
            <span className="text-[#7C9EFF] font-medium animate-pulse">
              {STEPS[stepIndex]}
            </span>
            <span className="text-[#5A6478]">{progress}%</span>
          </div>

          {/* Progress Bar Container */}
          <div className="w-full h-1.5 bg-[#1A2230] rounded-full overflow-hidden border border-[#252E3D]">
            <div
              className="h-full bg-gradient-to-r from-[#7C9EFF] via-[#4DD0C4] to-[#3DD68C] transition-all duration-300 ease-smooth rounded-full"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Footnote */}
        <p className="text-[10px] text-[#5A6478] font-mono tracking-widest uppercase">
          Autonomous Power Allocation & Emergency Control
        </p>
      </div>
    </div>
  )
}
