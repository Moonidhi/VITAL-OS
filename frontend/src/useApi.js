import { useEffect, useRef, useState } from 'react'

export const API_BASE = 'http://127.0.0.1:8000'

/**
 * Polls a GET endpoint on an interval and exposes { data, error, loading, lastUpdated }.
 * Used to drive the dashboard from /simulation/current and /simulation/day-summary
 * without needing any state management library — plain fetch() on a timer.
 */
export function usePolledEndpoint(path, intervalMs = 5000) {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)
  const [lastUpdated, setLastUpdated] = useState(null)
  const timerRef = useRef(null)

  useEffect(() => {
    let cancelled = false

    async function fetchOnce() {
      try {
        const res = await fetch(`${API_BASE}${path}`)
        if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
        const json = await res.json()
        if (!cancelled) {
          setData(json)
          setError(null)
          setLastUpdated(new Date())
          setLoading(false)
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message || 'Request failed')
          setLoading(false)
        }
      }
    }

    fetchOnce()
    timerRef.current = setInterval(fetchOnce, intervalMs)

    return () => {
      cancelled = true
      clearInterval(timerRef.current)
    }
  }, [path, intervalMs])

  return { data, error, loading, lastUpdated }
}
