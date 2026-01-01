import { useState, useEffect } from 'react'

/**
 * Hook to detect user's reduced motion preference.
 * Respects the prefers-reduced-motion media query for accessibility.
 *
 * @returns boolean - true if user prefers reduced motion
 */
export function useReducedMotion(): boolean {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(() => {
    // Check if window is available (SSR safety)
    if (typeof window === 'undefined') return false
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    return mediaQuery.matches
  })

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')

    const handleChange = (event: MediaQueryListEvent) => {
      setPrefersReducedMotion(event.matches)
    }

    // Modern browsers
    mediaQuery.addEventListener('change', handleChange)

    return () => {
      mediaQuery.removeEventListener('change', handleChange)
    }
  }, [])

  return prefersReducedMotion
}

/**
 * Returns motion variants that respect reduced motion preferences.
 * When reduced motion is preferred, animations are instant.
 */
export function getReducedMotionVariants(prefersReducedMotion: boolean) {
  if (prefersReducedMotion) {
    return {
      initial: {},
      animate: {},
      exit: {},
      transition: { duration: 0 }
    }
  }

  return null // Use default animations
}
