import { useState } from 'react'
import { motion } from 'framer-motion'
import { Keyboard, X } from 'lucide-react'

interface Shortcut {
  keys: string
  description: string
  category: string
}

export function KeyboardShortcutsHelp() {
  const [isOpen, setIsOpen] = useState(false)

  const shortcuts: Shortcut[] = [
    { keys: 'Ctrl + K', description: 'Open search', category: 'Navigation' },
    { keys: 'Ctrl + /', description: 'Show shortcuts help', category: 'Navigation' },
    { keys: 'H', description: 'Go to home', category: 'Navigation' },
    { keys: 'O', description: 'Go to hobbies', category: 'Navigation' },
    { keys: 'S', description: 'Go to services', category: 'Navigation' },
    { keys: 'D', description: 'Go to dashboard', category: 'Navigation' },
    { keys: 'C', description: 'Go to setup', category: 'Navigation' },
    { keys: 'M', description: 'Go to community', category: 'Navigation' },
    { keys: 'I', description: 'Go to install', category: 'Navigation' },
    { keys: 'G', description: 'Go to guide', category: 'Navigation' },
    { keys: 'Ctrl + T', description: 'Toggle theme', category: 'UI' },
    { keys: 'Esc', description: 'Close modals', category: 'UI' },
    { keys: 'Ctrl + S', description: 'Share current page', category: 'Actions' },
    { keys: 'Ctrl + E', description: 'Export data', category: 'Actions' },
  ]

  const categories = Array.from(new Set(shortcuts.map(s => s.category)))

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="p-2 rounded-lg glass border border-white/10 hover:border-primary/30 transition-all"
        aria-label="Keyboard shortcuts"
        title="View keyboard shortcuts help"
      >
        <Keyboard className="w-5 h-5" />
      </button>

      {isOpen && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
          onClick={() => setIsOpen(false)}
        >
          <div
            className="w-full max-w-2xl max-h-[calc(100dvh-2rem)] overflow-hidden glass border border-white/20 rounded-2xl flex flex-col"
            onClick={e => e.stopPropagation()}
          >
            <div className="p-6 border-b border-white/10">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Keyboard className="w-6 h-6 text-primary" />
                  <h2 className="text-xl font-bold text-white">Keyboard Shortcuts</h2>
                </div>
                <button
                  onClick={() => setIsOpen(false)}
                  aria-label="Close keyboard shortcuts"
                  title="Close keyboard shortcuts"
                  className="p-2 rounded-lg hover:bg-white/10 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-6 min-h-0 overflow-y-auto">
              {categories.map(category => (
                <div key={category} className="mb-8">
                  <h3 className="text-sm font-semibold text-primary mb-4 uppercase tracking-wider">
                    {category}
                  </h3>
                  <div className="space-y-3">
                    {shortcuts
                      .filter(s => s.category === category)
                      .map(shortcut => (
                        <div
                          key={shortcut.keys}
                          className="flex items-center justify-between py-2"
                        >
                          <span className="text-muted-foreground">{shortcut.description}</span>
                          <kbd className="px-3 py-1 text-xs font-mono bg-background border border-white/20 rounded">
                            {shortcut.keys}
                          </kbd>
                        </div>
                      ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="p-4 border-t border-white/10">
              <p className="text-xs text-muted-foreground text-center">
                Press <kbd className="px-2 py-1 text-xs font-mono bg-background border border-white/20 rounded">Esc</kbd> to close
              </p>
            </div>
          </div>
        </motion.div>
      )}
    </>
  )
}
