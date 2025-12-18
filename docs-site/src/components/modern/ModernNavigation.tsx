import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Menu, X, Search, Moon, Sun, Settings } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useTheme } from '../../hooks/useTheme'

export function ModernNavigation() {
  const [isOpen, setIsOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const { toggleTheme, resolvedTheme } = useTheme()

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 50)
    }
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const navItems = [
    { label: 'Setup Wizard', href: '#builder', shortcut: '1' },
    { label: 'Home', href: '#hero', shortcut: '2' },
  ]

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }



  const openSearch = () => {
    // In a real app, open search modal or focus search input
    console.log('Opening search')
    // Could trigger command palette
  }

  const handleNavClick = (href: string) => {
    if (href.startsWith('#')) {
      // Internal link - smooth scroll
      const element = document.querySelector(href)
      if (element) {
        element.scrollIntoView({ behavior: 'smooth' })
      }
    } else {
      // External link - open in new tab
      window.open(href, '_blank')
    }
  }

  return (
    <>
      {/* Navigation bar */}
      <motion.nav
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled
          ? 'glass border-b-0'
          : 'bg-transparent'
          }`}
      >
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <motion.div
              whileHover={{ scale: 1.05 }}
              onClick={scrollToTop}
              className="flex items-center gap-2 cursor-pointer"
              title="Scroll to top"
            >
              <div className="w-10 h-10 rounded-xl bg-background/50 border border-border flex items-center justify-center p-0.5 shadow-lg shadow-purple-500/10">
                <img src="/media-stack-logo.png" alt="Media Stack" className="w-full h-full object-contain" />
              </div>
              <span className="font-bold text-xl text-foreground tracking-tight">MediaStack</span>
            </motion.div>

            {/* Desktop navigation */}
            <div className="hidden md:flex items-center gap-8">
              {navItems.map((item) => (
                <button
                  key={item.label}
                  onClick={() => handleNavClick(item.href)}
                  className="text-muted-foreground hover:text-foreground transition-colors relative group"
                  title={`Navigate to ${item.label}`}
                >
                  {item.label}
                  <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-gradient-to-r from-purple-500 to-blue-500 group-hover:w-full transition-all duration-300" />
                </button>
              ))}
            </div>

            {/* Right side actions */}
            <div className="flex items-center gap-3">
              {/* Search */}
              <button
                onClick={openSearch}
                className="p-2 rounded-lg bg-background/60 hover:bg-muted/80 border border-border transition-colors"
                title="Search documentation"
              >
                <Search className="w-4 h-4 text-muted-foreground" />
              </button>

              <Link
                to="/settings"
                className="hidden md:inline-flex p-2 rounded-lg bg-background/60 hover:bg-muted/80 border border-border transition-colors"
                title="Open settings"
              >
                <Settings className="w-4 h-4 text-muted-foreground" />
              </Link>

              {/* Theme toggle */}
              <button
                onClick={toggleTheme}
                className="p-2 rounded-lg bg-background/60 hover:bg-muted/80 border border-border transition-colors"
                title={`Switch to ${resolvedTheme === 'dark' ? 'light' : 'dark'} mode`}
              >
                {resolvedTheme === 'dark' ? <Sun className="w-4 h-4 text-muted-foreground" /> : <Moon className="w-4 h-4 text-muted-foreground" />}
              </button>

              {/* Mobile menu toggle */}
              <button
                onClick={() => setIsOpen(!isOpen)}
                className="md:hidden p-2 rounded-lg bg-background/60 hover:bg-muted/80 border border-border transition-colors"
                title="Toggle mobile menu"
              >
                {isOpen ? <X className="w-4 h-4 text-muted-foreground" /> : <Menu className="w-4 h-4 text-muted-foreground" />}
              </button>
            </div>
          </div>
        </div>
      </motion.nav>

      {/* Mobile menu */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="fixed top-16 left-0 right-0 z-40 md:hidden bg-background/95 backdrop-blur-xl border-b border-border"
          >
            <div className="container mx-auto px-4 py-4">
              <div className="space-y-2">
                {navItems.map((item) => (
                  <button
                    key={item.label}
                    onClick={() => {
                      handleNavClick(item.href)
                      setIsOpen(false)
                    }}
                    className="w-full flex items-center justify-between p-3 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
                    title={`Navigate to ${item.label}`}
                  >
                    <span className="text-muted-foreground">{item.label}</span>
                    <kbd className="px-2 py-1 text-xs bg-muted rounded text-muted-foreground">
                      {item.shortcut}
                    </kbd>
                  </button>
                ))}
                <Link
                  to="/settings"
                  onClick={() => setIsOpen(false)}
                  className="w-full flex items-center justify-between p-3 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
                  title="Go to Settings"
                >
                  <span className="text-muted-foreground">Settings</span>
                  <Settings className="w-4 h-4 text-muted-foreground" />
                </Link>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Keyboard shortcuts hint */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1 }}
        className="fixed bottom-6 left-6 z-40 hidden lg:block"
      >
        <div className="bg-background/80 backdrop-blur-sm rounded-lg border border-border px-3 py-2">
          <p className="text-xs text-muted-foreground">
            Press <kbd className="px-1 py-0.5 bg-white/10 rounded text-xs">1-5</kbd> to navigate
          </p>
        </div>
      </motion.div>
    </>
  )
}
