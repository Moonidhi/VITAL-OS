import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'

const ToastContext = createContext({
  addToast: () => {},
  removeToast: () => {},
})

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const addToast = useCallback(({ type = 'info', title, message, duration }) => {
    const id = Date.now() + Math.random()
    let autoDismiss = duration
    if (autoDismiss === undefined) {
      if (type === 'critical') autoDismiss = 8000
      else if (type === 'success') autoDismiss = 4000
      else if (type === 'warning') autoDismiss = 6000
      else autoDismiss = 5000
    }

    const newToast = { id, type, title, message, duration: autoDismiss, createdAt: Date.now() }
    setToasts((prev) => [newToast, ...prev].slice(0, 4))
  }, [])

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  return (
    <ToastContext.Provider value={{ addToast, removeToast, toasts }}>
      {children}
    </ToastContext.Provider>
  )
}

export function useToast() {
  return useContext(ToastContext)
}

function ToastItem({ toast, onRemove }) {
  const [progress, setProgress] = useState(100)

  useEffect(() => {
    if (!toast.duration) return

    const startTime = Date.now()
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime
      const remaining = Math.max(0, 100 - (elapsed / toast.duration) * 100)
      setProgress(remaining)

      if (elapsed >= toast.duration) {
        clearInterval(interval)
        onRemove(toast.id)
      }
    }, 50)

    return () => clearInterval(interval)
  }, [toast, onRemove])

  const getConfig = () => {
    switch (toast.type) {
      case 'critical':
        return { border: 'border-[#FF5C5C]', bg: 'bg-[#FF5C5C]/10', icon: '🔴', bar: 'bg-[#FF5C5C]' }
      case 'warning':
        return { border: 'border-[#F5A623]', bg: 'bg-[#F5A623]/10', icon: '⚠️', bar: 'bg-[#F5A623]' }
      case 'success':
        return { border: 'border-[#3DD68C]', bg: 'bg-[#3DD68C]/10', icon: '✓', bar: 'bg-[#3DD68C]' }
      default:
        return { border: 'border-[#7C9EFF]', bg: 'bg-[#7C9EFF]/10', icon: 'ℹ️', bar: 'bg-[#7C9EFF]' }
    }
  }

  const cfg = getConfig()

  return (
    <div
      className={`w-80 rounded-xl border ${cfg.border} ${cfg.bg} bg-[#131922] p-3.5 shadow-2xl backdrop-blur-md animate-slide-in-right space-y-2 relative overflow-hidden`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-sm">{cfg.icon}</span>
          <h4 className="font-semibold text-xs text-[#E8EDF4]">{toast.title}</h4>
        </div>
        <button
          onClick={() => onRemove(toast.id)}
          className="text-[#8B95A7] hover:text-white text-xs font-mono transition-colors"
        >
          ✕
        </button>
      </div>

      {toast.message && (
        <p className="text-[11px] text-[#8B95A7] pl-6 leading-relaxed">{toast.message}</p>
      )}

      {toast.duration > 0 && (
        <div className="w-full bg-[#252E3D] h-1 rounded-full overflow-hidden">
          <div className={`h-full ${cfg.bar} transition-all duration-75`} style={{ width: `${progress}%` }} />
        </div>
      )}
    </div>
  )
}

export default function ToastContainer() {
  const { toasts, removeToast } = useContext(ToastContext)

  if (!toasts || toasts.length === 0) return null

  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2.5 pointer-events-auto">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onRemove={removeToast} />
      ))}
    </div>
  )
}
