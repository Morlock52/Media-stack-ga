import { useEffect, useState } from 'react'

type Theme = 'dark' | 'light' | 'system'

export function useTheme() {
    const [theme, setTheme] = useState<Theme>('system')
    const [resolvedTheme, setResolvedTheme] = useState<'dark' | 'light'>('dark')

    useEffect(() => {
        // 1. Read from localStorage on mount
        const savedTheme = localStorage.getItem('theme') as Theme | null
        if (savedTheme) {
            setTheme(savedTheme)
        }
    }, [])

    useEffect(() => {
        // 2. Resolve theme (handle 'system')
        const root = window.document.documentElement
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')

        const applyTheme = () => {
            let targetTheme = theme

            if (theme === 'system') {
                targetTheme = mediaQuery.matches ? 'dark' : 'light'
            }

            setResolvedTheme(targetTheme as 'dark' | 'light')

            if (targetTheme === 'dark') {
                root.classList.add('dark')
                root.classList.remove('light')
            } else {
                root.classList.add('light')
                root.classList.remove('dark')
            }
        }

        applyTheme()

        // Listen for system changes if mode is system
        const listener = () => {
            if (theme === 'system') applyTheme()
        }

        mediaQuery.addEventListener('change', listener)
        return () => mediaQuery.removeEventListener('change', listener)
    }, [theme])

    const toggleTheme = () => {
        const newTheme = resolvedTheme === 'dark' ? 'light' : 'dark'
        setTheme(newTheme)
        localStorage.setItem('theme', newTheme)
    }

    return { theme, resolvedTheme, toggleTheme, setTheme }
}
