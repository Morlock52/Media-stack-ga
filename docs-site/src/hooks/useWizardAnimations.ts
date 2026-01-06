import { useMemo } from 'react'
import { useReducedMotion } from './useReducedMotion'

/**
 * Animation variants for wizard components that respect reduced motion preferences.
 * Returns memoized variants for fade-in-up and scale-in animations.
 *
 * @returns Object containing fadeInUp and scaleIn animation variants
 */
export function useWizardAnimations() {
    const prefersReducedMotion = useReducedMotion()

    const fadeInUp = useMemo(
        () => prefersReducedMotion
            ? { initial: {}, animate: {}, transition: { duration: 0 } }
            : { initial: { opacity: 0, y: 20 }, animate: { opacity: 1, y: 0 } },
        [prefersReducedMotion]
    )

    const scaleIn = useMemo(
        () => prefersReducedMotion
            ? { initial: {}, animate: {}, exit: {}, transition: { duration: 0 } }
            : { initial: { scale: 0, opacity: 0 }, animate: { scale: 1, opacity: 1 }, exit: { scale: 0, opacity: 0 } },
        [prefersReducedMotion]
    )

    return { fadeInUp, scaleIn }
}
