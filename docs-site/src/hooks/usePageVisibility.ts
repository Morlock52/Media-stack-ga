import { useState, useEffect, useCallback } from 'react'

/**
 * Hook to track page visibility state.
 * Used to pause expensive operations (polling, animations) when tab is not visible.
 *
 * @returns boolean indicating if the page is currently visible
 *
 * @example
 * ```tsx
 * const isVisible = usePageVisibility()
 *
 * useEffect(() => {
 *   if (!isVisible) return
 *   const interval = setInterval(fetchData, 10000)
 *   return () => clearInterval(interval)
 * }, [isVisible])
 * ```
 */
export function usePageVisibility(): boolean {
  const [isVisible, setIsVisible] = useState(() => {
    // SSR safety: assume visible if document not available
    if (typeof document === 'undefined') return true
    return !document.hidden
  })

  useEffect(() => {
    const handleVisibilityChange = () => {
      setIsVisible(!document.hidden)
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [])

  return isVisible
}

/**
 * Hook that provides visibility-aware interval.
 * Automatically pauses when page is not visible to save resources.
 *
 * @param callback - Function to call at each interval
 * @param delay - Interval delay in milliseconds (null to pause)
 *
 * @example
 * ```tsx
 * useVisibilityAwareInterval(() => {
 *   fetchSnapshot()
 * }, 10_000)
 * ```
 */
export function useVisibilityAwareInterval(
  callback: () => void,
  delay: number | null
): void {
  const isVisible = usePageVisibility()
  const savedCallback = useCallback(callback, [callback])

  useEffect(() => {
    if (!isVisible || delay === null) return

    const tick = () => {
      savedCallback()
    }

    const id = setInterval(tick, delay)
    return () => clearInterval(id)
  }, [isVisible, delay, savedCallback])
}
