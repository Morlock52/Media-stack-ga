import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Key,
  Loader2,
  RefreshCw,
  Save,
  Shield,
  Trash2,
} from 'lucide-react'
import { buildControlServerUrl, controlServer } from '../utils/controlServer'
import { useSetupStore } from '../store/setupStore'
import { Button } from '../components/ui/button'

type ToastState = { type: 'success' | 'error' | 'info'; text: string } | null

const formatTimestamp = (value: string | null) => {
  if (!value) return '—'
  try {
    return new Date(value).toLocaleTimeString(undefined, {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
  } catch {
    return value
  }
}

export function SettingsPage() {
  const config = useSetupStore((state) => state.config)
  const updateConfig = useSetupStore((state) => state.updateConfig)

  const [apiKeyInput, setApiKeyInput] = useState(config.openaiApiKey || '')
  const [hasRemoteKey, setHasRemoteKey] = useState<boolean | null>(null)
  const [serverOnline, setServerOnline] = useState<boolean | null>(null)
  const [lastCheckedAt, setLastCheckedAt] = useState<string | null>(null)
  const [pendingAction, setPendingAction] = useState<'idle' | 'checking' | 'saving' | 'removing'>('idle')
  const [isBootstrapping, setIsBootstrapping] = useState(false)
  const [toast, setToast] = useState<ToastState>(null)

  useEffect(() => {
    setApiKeyInput(config.openaiApiKey || '')
  }, [config.openaiApiKey])

  const setToastMessage = (update: ToastState) => {
    setToast(update)
    if (update) {
      setTimeout(() => setToast(null), 4000)
    }
  }

  const recordSync = () => setLastCheckedAt(new Date().toISOString())

  const fetchStatus = useCallback(async () => {
    setPendingAction('checking')
    try {
      const res = await fetch(buildControlServerUrl('/api/settings/openai-key'))
      if (!res.ok) throw new Error('Failed to reach control server')
      const data = await res.json()
      setHasRemoteKey(Boolean(data?.hasKey))
      setServerOnline(true)
      setToast(null)
    } catch (error) {
      console.warn('SettingsPage: status check failed', error)
      setServerOnline(false)
      setToastMessage({
        type: 'error',
        text: 'Control server is offline. Start it on http://localhost:3001 and try again.',
      })
    } finally {
      setPendingAction('idle')
      recordSync()
    }
  }, [])

  useEffect(() => {
    fetchStatus()
  }, [fetchStatus])

  const handleSave = async () => {
    const trimmed = apiKeyInput.trim()
    if (!trimmed) {
      setToastMessage({ type: 'error', text: 'Enter a valid sk- key before saving.' })
      return
    }

    setPendingAction('saving')
    updateConfig({ openaiApiKey: trimmed })
    try {
      const res = await fetch(buildControlServerUrl('/api/settings/openai-key'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: trimmed }),
      })
      const data = await res.json()
      if (!res.ok || data?.success !== true) {
        throw new Error(data?.error || 'Failed to store key on control server')
      }
      setHasRemoteKey(true)
      setServerOnline(true)
      setToastMessage({ type: 'success', text: 'OpenAI key stored securely.' })
    } catch (error) {
      console.warn('SettingsPage: save failed, falling back to local storage', error)
      setServerOnline(false)
      setHasRemoteKey(null)
      setToastMessage({
        type: 'info',
        text: 'Saved locally. Start the control server to persist it.',
      })
    } finally {
      setPendingAction('idle')
      recordSync()
    }
  }

  const handleRemove = async () => {
    setPendingAction('removing')
    updateConfig({ openaiApiKey: '' })
    setApiKeyInput('')

    try {
      const res = await fetch(buildControlServerUrl('/api/settings/openai-key'), {
        method: 'DELETE',
      })
      const data = await res.json()
      if (!res.ok || data?.success !== true) {
        throw new Error(data?.error || 'Failed to delete key')
      }
      setHasRemoteKey(false)
      setServerOnline(true)
      setToastMessage({ type: 'success', text: 'OpenAI key removed.' })
    } catch (error) {
      console.warn('SettingsPage: remove failed', error)
      setServerOnline(false)
      setHasRemoteKey(null)
      setToastMessage({
        type: 'info',
        text: 'Removed locally. Start the control server to sync the change.',
      })
    } finally {
      setPendingAction('idle')
      recordSync()
    }
  }

  const handleBootstrapArr = async () => {
    if (!serverOnline) {
      setToastMessage({ type: 'error', text: 'Control server must be online to bootstrap keys.' })
      return
    }

    setIsBootstrapping(true)
    try {
      const data = await controlServer.bootstrapArr()
      if (data.success) {
        const count = Object.keys(data.keys).length
        setToastMessage({
          type: 'success',
          text: count > 0
            ? `Successfully captured ${count} API keys (${Object.keys(data.keys).join(', ')}).`
            : 'No keys were found. Make sure your containers are running and initialized.'
        })
      }
    } catch (error: any) {
      setToastMessage({ type: 'error', text: `Bootstrap failed: ${error.message}` })
    } finally {
      setIsBootstrapping(false)
    }
  }

  const statusPill = useMemo(() => {
    if (serverOnline === null) return { label: 'Checking...', color: 'bg-muted text-muted-foreground' }
    if (serverOnline) return { label: 'Control server connected', color: 'bg-emerald-500/15 text-emerald-300' }
    return { label: 'Control server offline', color: 'bg-amber-500/15 text-amber-300' }
  }, [serverOnline])

  const disableActions = pendingAction !== 'idle'

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="fixed top-0 left-0 right-0 z-30 border-b border-border/60 bg-background/80 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-background/50 border border-purple-500/30 flex items-center justify-center p-0.5 overflow-hidden">
              <img src="/media-stack-logo.png" alt="Logo" className="w-full h-full object-contain" />
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Settings</p>
              <h1 className="text-lg font-bold leading-tight">API & Integrations</h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="glass" asChild className="gap-2">
              <Link to="/">
                <ArrowLeft className="w-4 h-4" />
                Back to wizard
              </Link>
            </Button>
          </div>
        </div>
      </div>

      <section className="pt-28 pb-16">
        <div className="max-w-4xl mx-auto px-4 space-y-10">
          <div className="glass rounded-3xl border border-border/70 p-6 md:p-8 space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className={`px-3 py-1.5 text-xs font-semibold rounded-full ${statusPill.color}`}>
                {statusPill.label}
              </div>
              <button
                onClick={fetchStatus}
                className="text-xs inline-flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
                disabled={pendingAction === 'checking'}
              >
                {pendingAction === 'checking' ? (
                  <>
                    <Loader2 className="w-3 h-3 animate-spin" /> Checking
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-3 h-3" /> Re-check status
                  </>
                )}
              </button>
              <span className="text-xs text-muted-foreground">
                Last checked: {formatTimestamp(lastCheckedAt)}
              </span>
            </div>

            <div className="space-y-2">
              <h2 className="text-2xl font-semibold flex items-center gap-2">
                <Key className="w-6 h-6 text-purple-400" />
                OpenAI API Access
              </h2>
              <p className="text-sm text-muted-foreground max-w-2xl">
                Store your API key securely so the voice companion, AI assistant, and automation helpers can
                call OpenAI on your behalf. Keys are persisted by the control server; we never log or transmit them elsewhere.
              </p>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              <div className="rounded-2xl border border-border p-5 bg-card/80">
                <h3 className="text-sm font-semibold mb-3 text-muted-foreground">Manage key</h3>
                <label className="text-xs uppercase tracking-wide text-muted-foreground mb-1 block">
                  API key
                </label>
                <input
                  type="password"
                  value={apiKeyInput}
                  onChange={(e) => setApiKeyInput(e.target.value)}
                  placeholder="sk-..."
                  className="w-full bg-background/60 border border-border rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-purple-500/60 focus:ring-1 focus:ring-purple-500/30"
                />
                <p className="text-[10px] text-muted-foreground mt-2">
                  Need a key? Visit{' '}
                  <a
                    href="https://platform.openai.com/api-keys"
                    target="_blank"
                    rel="noreferrer"
                    className="text-purple-400 hover:underline"
                  >
                    platform.openai.com/api-keys
                  </a>
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button
                    onClick={handleSave}
                    disabled={disableActions || !apiKeyInput.trim()}
                    className="gap-2 flex-1"
                  >
                    {pendingAction === 'saving' ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Save className="w-4 h-4" />
                    )}
                    Save key
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleRemove}
                    disabled={disableActions || (!apiKeyInput && !hasRemoteKey)}
                    className="gap-2"
                  >
                    {pendingAction === 'removing' ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
                    Remove
                  </Button>
                </div>
              </div>

              <div className="rounded-2xl border border-border p-5 bg-card/80 space-y-4">
                <h3 className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
                  <Shield className="w-4 h-4 text-emerald-300" />
                  Status & diagnostics
                </h3>
                <div className="space-y-3 text-sm">
                  <div className="flex items-center gap-2">
                    {hasRemoteKey ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-amber-400" />
                    )}
                    <span>
                      {hasRemoteKey
                        ? 'Key stored on control server.'
                        : 'No key stored on the control server yet.'}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground leading-relaxed">
                    <p>
                      • Server URL: <code className="bg-muted px-1 py-0.5 rounded text-[11px]">/api/settings/openai-key</code>
                    </p>
                    <p>
                      • Local backup: <strong>{config.openaiApiKey ? 'Ready' : 'Empty'}</strong>
                    </p>
                    <p>• Voice Companion / AI assistant require an active key.</p>
                  </div>
                </div>
                <Button
                  variant="secondary"
                  onClick={fetchStatus}
                  disabled={pendingAction === 'checking'}
                  className="w-full gap-2"
                >
                  {pendingAction === 'checking' ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <RefreshCw className="w-4 h-4" />
                  )}
                  Run connectivity check
                </Button>
              </div>
            </div>

            {toast && (
              <div
                className={`rounded-2xl border px-4 py-3 text-sm flex items-center gap-2 ${toast.type === 'success'
                  ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-200'
                  : toast.type === 'error'
                    ? 'bg-red-500/10 border-red-500/20 text-red-200'
                    : 'bg-amber-500/10 border-amber-500/20 text-amber-100'
                  }`}
              >
                {toast.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4" />
                ) : toast.type === 'error' ? (
                  <AlertTriangle className="w-4 h-4" />
                ) : (
                  <Shield className="w-4 h-4" />
                )}
                {toast.text}
              </div>
            )}
          </div>
          <div className="glass rounded-3xl border border-border/70 p-6 md:p-8 space-y-6">
            <div className="space-y-2">
              <h2 className="text-2xl font-semibold flex items-center gap-2">
                <RefreshCw className="w-6 h-6 text-indigo-400" />
                Arr-Stack Automation
              </h2>
              <p className="text-sm text-muted-foreground max-w-2xl">
                Automatically wire your stack. We can scan your running containers (Sonarr, Radarr, Prowlarr, etc.)
                to extract their API keys directly from their configuration files and sync them to your environment.
              </p>
            </div>

            <div className="p-5 rounded-2xl border border-border bg-card/40 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1">
                <p className="text-sm font-medium">Capture API Keys</p>
                <p className="text-xs text-muted-foreground">Extracts keys from config.xml inside running containers</p>
              </div>
              <Button
                onClick={handleBootstrapArr}
                className="gap-2 bg-indigo-500 hover:bg-indigo-600 shadow-lg shadow-indigo-500/20 px-6"
                disabled={isBootstrapping || !serverOnline}
              >
                {isBootstrapping ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4" />
                )}
                {isBootstrapping ? 'Scanning...' : 'Bootstrap All Keys'}
              </Button>
            </div>
          </div>

          <div className="text-xs text-muted-foreground text-center">
            Need to rotate keys? Run{' '}
            <code className="bg-muted px-2 py-1 rounded">./rotate_secrets.sh</code> or update from this page any time.
          </div>
        </div>
      </section>
    </main>
  )
}
