import { useEffect, useState } from 'react'

type Theme = 'dark' | 'light'

export function useTheme() {
    const [theme, setTheme] = useState<Theme>('dark')
    const [resolvedTheme, setResolvedTheme] = useState<'dark' | 'light'>('dark')

    useEffect(() => {
        // 1. Read from localStorage on mount
        const savedTheme = localStorage.getItem('theme') as Theme | null
        if (savedTheme) {
            setTheme(savedTheme)
        }
    }, [])

    useEffect(() => {
        // 2. Apply theme to document
        const root = window.document.documentElement

        const applyTheme = () => {
            setResolvedTheme(theme)
            if (theme === 'dark') {
                root.classList.add('dark')
                root.classList.remove('light')
            } else {
                root.classList.add('light')
                root.classList.remove('dark')
            }
        }

        applyTheme()
    }, [theme])

    const toggleTheme = () => {
        const newTheme = resolvedTheme === 'dark' ? 'light' : 'dark'
        setTheme(newTheme)
        localStorage.setItem('theme', newTheme)
    }

    return { theme, resolvedTheme, toggleTheme, setTheme }
}
