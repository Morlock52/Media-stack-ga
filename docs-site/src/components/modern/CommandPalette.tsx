import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Command, Search, Terminal, FileText, Shield, Play, ArrowRight } from 'lucide-react'

interface CommandItem {
  id: string
  title: string
  description: string
  category: 'setup' | 'verify' | 'troubleshoot' | 'config'
  command: string
  icon: any
}

const commands: CommandItem[] = [
  {
    id: 'env-setup',
    title: 'Setup Environment',
    description: 'Copy and configure .env file',
    category: 'setup',
    command: 'cp .env.fixed.template .env && nano .env',
    icon: FileText
  },
  {
    id: 'start-stack',
    title: 'Start Media Stack',
    description: 'Deploy all services with Docker Compose',
    category: 'setup',
    command: 'docker-compose -f docker-compose.fixed.yml up -d',
    icon: Play
  },
  {
    id: 'check-status',
    title: 'Check Service Status',
    description: 'Verify all containers are running',
    category: 'verify',
    command: 'docker-compose ps',
    icon: Terminal
  },
  {
    id: 'view-logs',
    title: 'View Service Logs',
    description: 'Monitor real-time logs',
    category: 'troubleshoot',
    command: 'docker-compose logs -f',
    icon: Terminal
  },
  {
    id: 'test-auth',
    title: 'Test Authentication',
    description: 'Verify Authelia is working',
    category: 'verify',
    command: 'curl -k https://auth.yourdomain.com',
    icon: Shield
  },
  {
    id: 'restart-service',
    title: 'Restart Service',
    description: 'Restart a specific service',
    category: 'troubleshoot',
    command: 'docker-compose restart [service-name]',
    icon: Play
  }
]

const categoryColors = {
  setup: 'from-blue-500/20 to-cyan-500/20 border-blue-500/30',
  verify: 'from-emerald-500/20 to-green-500/20 border-emerald-500/30',
  troubleshoot: 'from-orange-500/20 to-red-500/20 border-orange-500/30',
  config: 'from-purple-500/20 to-pink-500/20 border-purple-500/30'
}

export function CommandPalette() {
  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setIsOpen(true)
      } else if (e.key === 'Escape') {
        setIsOpen(false)
      } else if (isOpen) {
        if (e.key === 'ArrowDown') {
          e.preventDefault()
          setSelectedIndex(prev => (prev + 1) % filteredCommands.length)
        } else if (e.key === 'ArrowUp') {
          e.preventDefault()
          setSelectedIndex(prev => (prev - 1 + filteredCommands.length) % filteredCommands.length)
        } else if (e.key === 'Enter' && filteredCommands[selectedIndex]) {
          executeCommand(filteredCommands[selectedIndex])
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, selectedIndex])

  const filteredCommands = commands.filter(cmd =>
    cmd.title.toLowerCase().includes(query.toLowerCase()) ||
    cmd.description.toLowerCase().includes(query.toLowerCase())
  )

  const executeCommand = (command: CommandItem) => {
    navigator.clipboard.writeText(command.command)
    setIsOpen(false)
    setQuery('')
  }

  return (
    <>
      {/* Trigger button */}
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 z-40 w-14 h-14 rounded-full bg-gradient-to-r from-purple-600 to-blue-600 text-white shadow-lg hover:shadow-xl hover:shadow-purple-500/25 transition-all duration-300 hover:scale-110 flex items-center justify-center group"
        title="Open command palette (⌘K)"
      >
        <Command className="w-6 h-6 group-hover:rotate-12 transition-transform" />
        <span className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-500 rounded-full animate-pulse" />
      </button>

      {/* Command palette */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="fixed inset-0 z-50 flex items-start justify-center pt-20 bg-black/80 backdrop-blur-sm"
            onClick={() => setIsOpen(false)}
          >
            <div
              className="w-full max-w-2xl mx-4"
              onClick={e => e.stopPropagation()}
            >
              {/* Search input */}
              <div className="glass-panel rounded-2xl overflow-hidden">
                <div className="p-4 border-b border-white/10">
                  <div className="flex items-center gap-3">
                    <Search className="w-5 h-5 text-gray-400" />
                    <input
                      type="text"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Type a command or search..."
                      className="flex-1 bg-transparent outline-none text-white placeholder-gray-400"
                      autoFocus
                    />
                    <kbd className="px-2 py-1 text-xs bg-white/10 rounded text-gray-400">ESC</kbd>
                  </div>
                </div>

                {/* Command list */}
                <div className="max-h-96 overflow-y-auto">
                  {filteredCommands.length === 0 ? (
                    <div className="p-8 text-center text-gray-400">
                      <Command className="w-12 h-12 mx-auto mb-4 opacity-50" />
                      <p>No commands found</p>
                    </div>
                  ) : (
                    <div className="p-2">
                      {filteredCommands.map((command, index) => {
                        const Icon = command.icon
                        const isSelected = index === selectedIndex

                        return (
                          <motion.button
                            key={command.id}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: index * 0.05 }}
                            onClick={() => executeCommand(command)}
                            className={`w-full p-3 rounded-xl transition-all duration-200 ${isSelected
                                ? `bg-gradient-to-r ${categoryColors[command.category]}`
                                : 'hover:bg-white/5'
                              }`}
                          >
                            <div className="flex items-center gap-3">
                              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${isSelected ? 'bg-white/20' : 'bg-white/10'
                                }`}>
                                <Icon className={`w-5 h-5 ${isSelected ? 'text-white' : 'text-gray-400'}`} />
                              </div>

                              <div className="flex-1 text-left">
                                <div className="flex items-center gap-2 mb-1">
                                  <h4 className={`font-medium ${isSelected ? 'text-white' : 'text-gray-300'}`}>
                                    {command.title}
                                  </h4>
                                  <span className={`px-2 py-0.5 rounded text-xs ${isSelected ? 'bg-white/20 text-white' : 'bg-white/10 text-gray-400'
                                    }`}>
                                    {command.category}
                                  </span>
                                </div>
                                <p className={`text-sm ${isSelected ? 'text-gray-300' : 'text-gray-500'}`}>
                                  {command.description}
                                </p>
                                <code className={`text-xs font-mono mt-1 block ${isSelected ? 'text-gray-400' : 'text-gray-600'
                                  }`}>
                                  {command.command}
                                </code>
                              </div>

                              <ArrowRight className={`w-4 h-4 ${isSelected ? 'text-white' : 'text-gray-500'}`} />
                            </div>
                          </motion.button>
                        )
                      })}
                    </div>
                  )}
                </div>

                {/* Footer */}
                <div className="p-3 border-t border-white/10 flex items-center justify-between text-xs text-gray-400">
                  <div className="flex items-center gap-4">
                    <span>↑↓ Navigate</span>
                    <span>↵ Execute</span>
                    <span>⌘K Open</span>
                  </div>
                  <span>{filteredCommands.length} commands</span>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
