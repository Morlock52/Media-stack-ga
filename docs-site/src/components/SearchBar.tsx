import { useState, useEffect } from 'react'
import { Search, X } from 'lucide-react'
import { motion } from 'framer-motion'

interface SearchResult {
  title: string
  section: string
  url: string
  description: string
}

export function SearchBar() {
  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])

  const mockResults: SearchResult[] = [
    { title: 'Environment Configuration', section: 'Core Infrastructure', url: '#env', description: 'Update DOMAIN, TIMEZONE, and secure passwords' },
    { title: 'Authelia Setup', section: 'Security', url: '#authelia', description: 'Configure SSO and 2FA authentication' },
    { title: 'Plex Integration', section: 'Media Services', url: '#plex', description: 'Connect media server with libraries' },
    { title: 'Arr Stack Configuration', section: 'Automation', url: '#arr-stack', description: 'Sonarr, Radarr, and Prowlarr setup' },
    { title: 'VPN Configuration', section: 'Security', url: '#gluetun', description: 'Route qBittorrent through VPN' },
  ]

  useEffect(() => {
    if (query.length > 2) {
      const filtered = mockResults.filter(result =>
        result.title.toLowerCase().includes(query.toLowerCase()) ||
        result.description.toLowerCase().includes(query.toLowerCase()) ||
        result.section.toLowerCase().includes(query.toLowerCase())
      )
      setResults(filtered)
    } else {
      setResults([])
    }
  }, [query])

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false)
        setQuery('')
      }
    }
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [])

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="p-2 rounded-lg glass border border-white/10 hover:border-primary/30 transition-all"
        aria-label="Search"
        title="Search documentation (Ctrl+K)"
      >
        <Search className="w-5 h-5" />
      </button>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="fixed inset-0 z-50 flex items-start justify-center pt-20 bg-black/80 backdrop-blur-sm"
      onClick={() => setIsOpen(false)}
    >
      <div
        className="w-full max-w-2xl mx-4"
        onClick={e => e.stopPropagation()}
      >
        <div className="glass border border-white/20 rounded-2xl overflow-hidden">
          <div className="p-4 border-b border-white/10">
            <div className="flex items-center gap-3">
              <Search className="w-5 h-5 text-muted-foreground" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search documentation, services, configuration..."
                className="flex-1 bg-transparent outline-none text-white placeholder-muted-foreground"
                autoFocus
              />
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 rounded hover:bg-white/10 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {results.length > 0 && (
            <div className="max-h-96 overflow-y-auto">
              {results.map((result, index) => (
                <motion.a
                  key={result.title}
                  href={result.url}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="block p-4 border-b border-white/5 hover:bg-white/5 transition-colors"
                  onClick={() => setIsOpen(false)}
                >
                  <div className="flex items-start gap-3">
                    <div className="flex-1">
                      <h4 className="font-semibold text-white mb-1">{result.title}</h4>
                      <p className="text-sm text-muted-foreground mb-2">{result.description}</p>
                      <span className="text-xs font-mono text-primary bg-primary/10 px-2 py-1 rounded">
                        {result.section}
                      </span>
                    </div>
                  </div>
                </motion.a>
              ))}
            </div>
          )}

          {query.length > 2 && results.length === 0 && (
            <div className="p-8 text-center text-muted-foreground">
              No results found for "{query}"
            </div>
          )}
        </div>
      </div>
    </motion.div>
  )
}
