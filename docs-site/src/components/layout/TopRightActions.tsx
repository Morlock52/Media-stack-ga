/**
 * TopRightActions - Shared header controls for light/dark mode and search
 * 
 * This component provides:
 * - Theme toggle (light/dark) using the `.light` class on document.documentElement
 * - Search icon that can either open the AI assistant (if `onOpenAssistant` is provided)
 *   or fall back to a simple search overlay
 * 
 * The theme system works with CSS variables defined in index.css:
 * - :root = dark theme (default)
 * - .light = light theme
 */

import { useEffect, useState } from 'react'
import { Sun, Moon, Search, Key, Check, X, Loader2 } from 'lucide-react'
import { useSetupStore } from '../../store/setupStore'
import { buildControlServerUrl } from '../../utils/controlServer'

interface TopRightActionsProps {
  /** Optional callback to open the AI assistant instead of the search overlay */
  onOpenAssistant?: () => void
}

export function TopRightActions({ onOpenAssistant }: TopRightActionsProps) {
  // Theme state: 'dark' is default (no class), 'light' adds .light class
  const [theme, setTheme] = useState<'light' | 'dark'>('dark')
  const [showSearch, setShowSearch] = useState(false)
  const [search, setSearch] = useState('')
  const [showApiKeyModal, setShowApiKeyModal] = useState(false)
  const [apiKey, setApiKey] = useState('')
  const [hasApiKey, setHasApiKey] = useState(false)
  const [isControlServerAvailable, setIsControlServerAvailable] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState<{type: 'success' | 'error', text: string} | null>(null)
  const updateConfig = useSetupStore((state) => state.updateConfig)
  const storedApiKey = useSetupStore((state) => state.config.openaiApiKey)

  // Check if API key is saved on mount (silently fail if server unavailable)
  useEffect(() => {
    const localHasKey = Boolean(storedApiKey && String(storedApiKey).trim())
    if (localHasKey) {
      setHasApiKey(true)
    }

    fetch(buildControlServerUrl('/api/settings/openai-key'))
      .then(r => (r.ok ? r.json() : null))
      .then(data => {
        if (!data) return
        setIsControlServerAvailable(true)
        if (typeof data.hasKey === 'boolean') {
          setHasApiKey(data.hasKey || localHasKey)
        }
      })
      .catch(() => {
        setIsControlServerAvailable(false)
      })
  }, [storedApiKey])

  const saveApiKey = async () => {
    setIsSaving(true)
    setSaveMessage(null)
    const trimmedKey = apiKey.trim()
    if (trimmedKey) {
      updateConfig({ openaiApiKey: trimmedKey })
      setHasApiKey(true)
    }
    try {
      const res = await fetch(buildControlServerUrl('/api/settings/openai-key'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: trimmedKey })
      })
      const data = await res.json()
      if (data.success) {
        setApiKey('')
        setIsControlServerAvailable(true)
        setSaveMessage({ type: 'success', text: 'API key saved!' })
        setTimeout(() => setShowApiKeyModal(false), 1500)
      } else {
        setSaveMessage({ type: 'error', text: data.error || 'Failed to save' })
      }
    } catch {
      if (trimmedKey) {
        setSaveMessage({
          type: 'success',
          text: 'Saved locally. Start the control server on http://localhost:3001 to persist it.'
        })
      } else {
        setSaveMessage({ type: 'error', text: 'Could not connect to server' })
      }
      setIsControlServerAvailable(false)
    } finally {
      setIsSaving(false)
    }
  }

  const deleteApiKey = async () => {
    setIsSaving(true)
    updateConfig({ openaiApiKey: '' })
    setHasApiKey(false)
    try {
      const res = await fetch(buildControlServerUrl('/api/settings/openai-key'), { method: 'DELETE' })
      const data = await res.json()
      if (data.success) {
        setIsControlServerAvailable(true)
        setSaveMessage({ type: 'success', text: 'API key removed' })
      }
    } catch {
      setSaveMessage({
        type: 'success',
        text: 'Removed locally. Start the control server on http://localhost:3001 to remove persisted key.'
      })
      setIsControlServerAvailable(false)
    } finally {
      setIsSaving(false)
    }
  }

  // Initialize theme from localStorage or system preference on mount
  useEffect(() => {
    if (typeof document === 'undefined') return

    const saved = localStorage.getItem('theme')
    if (saved === 'light') {
      document.documentElement.classList.add('light')
      setTheme('light')
    } else if (saved === 'dark') {
      document.documentElement.classList.remove('light')
      setTheme('dark')
    } else {
      // No saved preference: check system preference
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
      if (!prefersDark) {
        document.documentElement.classList.add('light')
        setTheme('light')
      }
    }
  }, [])

  const handleToggleTheme = () => {
    if (typeof document === 'undefined') return

    const root = document.documentElement
    const isCurrentlyLight = root.classList.contains('light')

    if (isCurrentlyLight) {
      // Switch to dark
      root.classList.remove('light')
      localStorage.setItem('theme', 'dark')
      setTheme('dark')
    } else {
      // Switch to light
      root.classList.add('light')
      localStorage.setItem('theme', 'light')
      setTheme('light')
    }
  }

  return (
    <div className="flex items-center gap-2">
      {/* Search icon */}
      <button
        type="button"
        onClick={() => {
          // If AI assistant callback is provided, open assistant instead of overlay
          if (onOpenAssistant) {
            onOpenAssistant()
          } else {
            setShowSearch(true)
          }
        }}
        className="p-2 rounded-lg border border-border bg-background/60 hover:bg-muted/80 text-muted-foreground hover:text-foreground transition-colors"
        aria-label="Open search"
      >
        <Search className="w-4 h-4" />
      </button>

      {/* API Key Settings */}
      <button
        type="button"
        onClick={() => setShowApiKeyModal(true)}
        className={`p-2 rounded-lg border bg-background/60 hover:bg-muted/80 text-muted-foreground hover:text-foreground transition-colors ${
          hasApiKey ? 'border-green-500/50 text-green-600' : 'border-border'
        }`}
        aria-label="OpenAI API Key Settings"
        title={hasApiKey ? 'OpenAI key configured' : 'Set OpenAI API key'}
      >
        <Key className="w-4 h-4" />
        {hasApiKey && (
          <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-green-500 rounded-full" />
        )}
      </button>

      {/* Theme toggle: Sun = currently dark, Moon = currently light */}
      <button
        type="button"
        onClick={handleToggleTheme}
        className="p-2 rounded-lg border border-border bg-background/60 hover:bg-muted/80 text-muted-foreground hover:text-foreground transition-colors"
        aria-label="Toggle light/dark mode"
      >
        {theme === 'dark' ? (
          <Sun className="w-4 h-4" />
        ) : (
          <Moon className="w-4 h-4" />
        )}
      </button>

      {/* Simple search overlay (fallback when no assistant is available) */}
      {showSearch && !onOpenAssistant && (
        <div className="fixed inset-0 bg-black/60 flex items-start justify-center pt-32 z-50">
          <div className="w-full max-w-lg bg-card border border-border rounded-xl p-4 shadow-xl">
            <div className="flex items-center gap-2 mb-3">
              <Search className="w-4 h-4 text-purple-400" />
              <input
                autoFocus
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search docs, apps, or setup topics..."
                className="flex-1 bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/25"
              />
            </div>
            <p className="text-xs text-muted-foreground mb-3">
              Search UI is ready. We can wire this to real search or AI later.
            </p>
            <div className="flex justify-end">
              <button
                onClick={() => setShowSearch(false)}
                className="text-xs px-3 py-1.5 rounded-md bg-secondary hover:bg-secondary/80 text-secondary-foreground"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* OpenAI API Key Modal */}
      {showApiKeyModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="w-full max-w-md bg-card border border-border rounded-xl p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Key className="w-5 h-5 text-purple-400" />
                OpenAI API Key
              </h3>
              <button
                onClick={() => setShowApiKeyModal(false)}
                className="p-1 hover:bg-white/10 rounded"
                title="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {hasApiKey ? (
              <div className="space-y-4">
                <div className="flex items-center gap-2 p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
                  <Check className="w-5 h-5 text-green-500" />
                  <div>
                    <p className="text-sm font-medium text-green-300">API Key Configured</p>
                    <p className="text-xs text-green-400/70">AI features are enabled</p>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  {isControlServerAvailable
                    ? (
                      <>Your key is stored in the project's <code className="px-1 py-0.5 bg-white/5 rounded">.env</code> file.</>
                    )
                    : (
                      <>Your key is stored locally in this browser. Start the control server to persist it.</>
                    )}
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setHasApiKey(false)}
                    className="flex-1 px-3 py-2 text-sm bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg transition-colors"
                  >
                    Update Key
                  </button>
                  <button
                    onClick={deleteApiKey}
                    disabled={isSaving}
                    className="px-3 py-2 text-sm bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 rounded-lg transition-colors"
                  >
                    {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Remove'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Add your OpenAI API key to enable AI-powered features like the voice companion and intelligent assistance.
                </p>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">API Key</label>
                  <input
                    type="password"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="sk-..."
                    className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/25"
                  />
                </div>
                {saveMessage && (
                  <p className={`text-xs ${saveMessage.type === 'success' ? 'text-green-400' : 'text-red-400'}`}>
                    {saveMessage.text}
                  </p>
                )}
                <button
                  onClick={saveApiKey}
                  disabled={!apiKey.trim() || isSaving}
                  className="w-full px-3 py-2 text-sm bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save Key'}
                </button>
                <p className="text-[10px] text-muted-foreground">
                  Get a key at <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer" className="text-purple-400 hover:underline">platform.openai.com</a>
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
