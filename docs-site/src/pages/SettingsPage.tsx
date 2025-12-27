import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Key,
  Loader2,
  Save,
  RefreshCw,
  Shield,
  Terminal,
  Trash2,
} from 'lucide-react'
import {
  buildControlServerUrl,
  controlServer,
  controlServerAuthHeaders,
} from '../utils/controlServer'
import { Button } from '../components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog'
import { ThemeToggleButton } from '../components/layout/ThemeToggleButton'
import { useControlServerOpenAIKeyStatus } from '../hooks/useControlServerOpenAIKeyStatus'
import { useControlServerClaudeKeyStatus } from '../hooks/useControlServerClaudeKeyStatus'
import { useControlServerTtsStatus } from '../hooks/useControlServerTtsStatus'
import { StatusBadge } from '../components/StatusBadge'

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
  // Keep the key out of persisted client state; the control-server is the secure store.
  const [apiKeyInput, setApiKeyInput] = useState('')
  const [pendingAction, setPendingAction] = useState<'idle' | 'checking' | 'saving' | 'removing'>('idle')
  const [isBootstrapping, setIsBootstrapping] = useState(false)
  const [localRetrievedKeys, setLocalRetrievedKeys] = useState<Record<string, string> | null>(null)
  const [localRetrievedError, setLocalRetrievedError] = useState('')
  const [isRemoteArrOpen, setIsRemoteArrOpen] = useState(false)
  const [isRemoteBootstrapping, setIsRemoteBootstrapping] = useState(false)
  const [remoteRetrievedKeys, setRemoteRetrievedKeys] = useState<Record<string, string> | null>(null)
  const [remoteRetrievedError, setRemoteRetrievedError] = useState('')
  const [remoteScanHost, setRemoteScanHost] = useState('')
  const [remoteScanPort, setRemoteScanPort] = useState('22')
  const [remoteScanUsername, setRemoteScanUsername] = useState('')
  const [remoteScanAuthType, setRemoteScanAuthType] = useState<'password' | 'key'>('password')
  const [remoteScanPassword, setRemoteScanPassword] = useState('')
  const [remoteScanPrivateKey, setRemoteScanPrivateKey] = useState('')
  const [useSeparateEnvHost, setUseSeparateEnvHost] = useState(false)
  const [remoteEnvHost, setRemoteEnvHost] = useState('')
  const [remoteEnvPort, setRemoteEnvPort] = useState('')
  const [remoteEnvUsername, setRemoteEnvUsername] = useState('')
  const [remoteEnvAuthType, setRemoteEnvAuthType] = useState<'password' | 'key' | ''>('')
  const [remoteEnvPassword, setRemoteEnvPassword] = useState('')
  const [remoteEnvPrivateKey, setRemoteEnvPrivateKey] = useState('')
  const [remoteEnvPath, setRemoteEnvPath] = useState('')
  const [toast, setToast] = useState<ToastState>(null)
  const [elevenLabsKeyInput, setElevenLabsKeyInput] = useState('')
  const [elevenLabsVoiceIdInput, setElevenLabsVoiceIdInput] = useState('')
  const [elevenLabsAction, setElevenLabsAction] = useState<'idle' | 'saving' | 'removing' | 'savingVoice'>('idle')
  const [claudeKeyInput, setClaudeKeyInput] = useState('')
  const [claudeAction, setClaudeAction] = useState<'idle' | 'saving' | 'removing'>('idle')
  const [isRestarting, setIsRestarting] = useState(false)

  const { serverOnline, hasKey: hasRemoteKey, lastCheckedAt, refresh } = useControlServerOpenAIKeyStatus()
  const { hasKey: hasClaudeKey, model: claudeModel, refresh: refreshClaude } = useControlServerClaudeKeyStatus()
  const { elevenlabs, refresh: refreshTts } = useControlServerTtsStatus()

  const setToastMessage = (update: ToastState) => {
    setToast(update)
    if (update) {
      setTimeout(() => setToast(null), 4000)
    }
  }

  const fetchStatus = useCallback(async () => {
    setPendingAction('checking')
    await refresh()
    setPendingAction('idle')
  }, [refresh])

  const handleRestartSystem = useCallback(async () => {
    if (!serverOnline) {
      setToastMessage({
        type: 'info',
        text: 'Control server is offline. Start it first, then retry restarting the server.',
      })
      return
    }

    setIsRestarting(true)
    try {
      const data = await controlServer.systemRestart()
      if (data?.success !== true) {
        throw new Error(data?.error || 'Restart request failed')
      }
      setToastMessage({ type: 'success', text: 'Restart requested. Services may take a moment to come back online.' })

      // During a restart, an immediate refresh often races the server reboot and flips the UI to
      // "offline". Poll /api/health until the control server is reachable again.
      const startedAt = Date.now()
      const timeoutMs = 60_000
      const pollIntervalMs = 2_000

      while (Date.now() - startedAt < timeoutMs) {
        try {
          const healthRes = await fetch(buildControlServerUrl('/api/health'), {
            headers: { ...controlServerAuthHeaders() },
          })
          if (healthRes.ok) break
        } catch {
          // ignore, keep polling
        }
        await new Promise((resolve) => setTimeout(resolve, pollIntervalMs))
      }
    } catch (error: any) {
      const message = error?.message || 'Failed to restart the server'
      setToastMessage({ type: 'error', text: message })
    } finally {
      setIsRestarting(false)
      await refresh()
    }
  }, [refresh, serverOnline])

  useEffect(() => {
    fetchStatus()
  }, [fetchStatus])

  useEffect(() => {
    if (!isRemoteArrOpen) return
    try {
      const raw = localStorage.getItem('remote-deploy-prefs')
      if (!raw) return
      const parsed = JSON.parse(raw) as {
        host?: string
        port?: string
        username?: string
        authType?: 'password' | 'key'
        deployPath?: string
      }

      if (!remoteScanHost.trim() && typeof parsed.host === 'string') setRemoteScanHost(parsed.host)
      if (remoteScanPort.trim() === '22' && typeof parsed.port === 'string') setRemoteScanPort(parsed.port)
      if (!remoteScanUsername.trim() && typeof parsed.username === 'string') setRemoteScanUsername(parsed.username)
      if (!remoteScanHost.trim() && !remoteScanUsername.trim() && (parsed.authType === 'password' || parsed.authType === 'key')) {
        setRemoteScanAuthType(parsed.authType)
      }

      if (!remoteEnvPath) {
        const deployPath = typeof parsed.deployPath === 'string' ? parsed.deployPath.trim() : ''
        if (deployPath) {
          const normalized = deployPath.endsWith('/') ? deployPath.slice(0, -1) : deployPath
          setRemoteEnvPath(`${normalized}/.env`)
        } else {
          setRemoteEnvPath('~/media-stack/.env')
        }
      }
    } catch {
      // ignore invalid local storage
    }
  }, [
    isRemoteArrOpen,
    remoteEnvPath,
    remoteScanAuthType,
    remoteScanHost,
    remoteScanPort,
    remoteScanUsername,
  ])

  useEffect(() => {
    if (!isRemoteArrOpen) return
    setRemoteRetrievedKeys(null)
    setRemoteRetrievedError('')
  }, [isRemoteArrOpen])

  const handleSave = async () => {
    const trimmed = apiKeyInput.trim()
    if (!trimmed) {
      setToastMessage({ type: 'error', text: 'Enter a valid sk- key before saving.' })
      return
    }

    setPendingAction('saving')
    try {
      const res = await fetch(buildControlServerUrl('/api/settings/openai-key'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...controlServerAuthHeaders() },
        body: JSON.stringify({ key: trimmed }),
      })
      const data = await res.json()
      if (!res.ok || data?.success !== true) {
        throw new Error(data?.error || 'Failed to store key on control server')
      }
      setApiKeyInput('')
      setToastMessage({ type: 'success', text: 'OpenAI key stored securely.' })
    } catch (error) {
      console.warn('SettingsPage: save failed', error)
      setToastMessage({
        type: 'info',
        text: 'Control server is offline. Start it on http://localhost:3001 to store your key securely.',
      })
    } finally {
      setPendingAction('idle')
      await refresh()
    }
  }

  const handleRemove = async () => {
    setPendingAction('removing')
    setApiKeyInput('')

    try {
      const res = await fetch(buildControlServerUrl('/api/settings/openai-key'), {
        method: 'DELETE',
        headers: { ...controlServerAuthHeaders() },
      })
      const data = await res.json()
      if (!res.ok || data?.success !== true) {
        throw new Error(data?.error || 'Failed to delete key')
      }
      setToastMessage({ type: 'success', text: 'OpenAI key removed.' })
    } catch (error) {
      console.warn('SettingsPage: remove failed', error)
      setToastMessage({
        type: 'info',
        text: 'Control server is offline. Start it on http://localhost:3001 to remove the stored key.',
      })
    } finally {
      setPendingAction('idle')
      await refresh()
    }
  }

  const handleSaveElevenLabsKey = async () => {
    const trimmed = elevenLabsKeyInput.trim()
    if (!trimmed) {
      setToastMessage({ type: 'error', text: 'Enter an ElevenLabs API key before saving.' })
      return
    }

    setElevenLabsAction('saving')
    try {
      const res = await fetch(buildControlServerUrl('/api/settings/elevenlabs-key'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...controlServerAuthHeaders() },
        body: JSON.stringify({ key: trimmed }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok || data?.success !== true) {
        throw new Error(data?.error || 'Failed to store ElevenLabs key')
      }
      setElevenLabsKeyInput('')
      setToastMessage({ type: 'success', text: 'ElevenLabs key stored.' })
    } catch (error: any) {
      setToastMessage({ type: 'error', text: error.message || 'Failed to store ElevenLabs key.' })
    } finally {
      setElevenLabsAction('idle')
      await refreshTts()
    }
  }

  const handleRemoveElevenLabsKey = async () => {
    setElevenLabsAction('removing')
    setElevenLabsKeyInput('')

    try {
      const res = await fetch(buildControlServerUrl('/api/settings/elevenlabs-key'), {
        method: 'DELETE',
        headers: { ...controlServerAuthHeaders() },
      })
      const data = await res.json().catch(() => null)
      if (!res.ok || data?.success !== true) {
        throw new Error(data?.error || 'Failed to delete ElevenLabs key')
      }
      setToastMessage({ type: 'success', text: 'ElevenLabs key removed.' })
    } catch (error: any) {
      setToastMessage({ type: 'error', text: error.message || 'Failed to remove ElevenLabs key.' })
    } finally {
      setElevenLabsAction('idle')
      await refreshTts()
    }
  }

  const handleSaveElevenLabsVoice = async () => {
    const trimmed = elevenLabsVoiceIdInput.trim()
    if (!trimmed) {
      setToastMessage({ type: 'error', text: 'Enter a voice ID before saving.' })
      return
    }

    setElevenLabsAction('savingVoice')
    try {
      const res = await fetch(buildControlServerUrl('/api/settings/elevenlabs-voice'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...controlServerAuthHeaders() },
        body: JSON.stringify({ voiceId: trimmed }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok || data?.success !== true) {
        throw new Error(data?.error || 'Failed to store voice ID')
      }
      setToastMessage({ type: 'success', text: 'ElevenLabs voice ID saved.' })
    } catch (error: any) {
      setToastMessage({ type: 'error', text: error.message || 'Failed to save voice ID.' })
    } finally {
      setElevenLabsAction('idle')
      await refreshTts()
    }
  }

  const handleSaveClaudeKey = async () => {
    const trimmed = claudeKeyInput.trim()
    if (!trimmed) {
      setToastMessage({ type: 'error', text: 'Enter a Claude API key before saving.' })
      return
    }

    setClaudeAction('saving')
    try {
      const res = await fetch(buildControlServerUrl('/api/settings/claude-key'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...controlServerAuthHeaders() },
        body: JSON.stringify({ key: trimmed }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok || data?.success !== true) {
        throw new Error(data?.error || 'Failed to store Claude key')
      }
      setClaudeKeyInput('')
      setToastMessage({ type: 'success', text: 'Claude API key stored securely.' })
    } catch (error: any) {
      setToastMessage({ type: 'error', text: error.message || 'Failed to store Claude key.' })
    } finally {
      setClaudeAction('idle')
      await refreshClaude()
    }
  }

  const handleRemoveClaudeKey = async () => {
    setClaudeAction('removing')
    setClaudeKeyInput('')

    try {
      const res = await fetch(buildControlServerUrl('/api/settings/claude-key'), {
        method: 'DELETE',
        headers: { ...controlServerAuthHeaders() },
      })
      const data = await res.json().catch(() => null)
      if (!res.ok || data?.success !== true) {
        throw new Error(data?.error || 'Failed to delete Claude key')
      }
      setToastMessage({ type: 'success', text: 'Claude API key removed.' })
    } catch (error: any) {
      setToastMessage({ type: 'error', text: error.message || 'Failed to remove Claude key.' })
    } finally {
      setClaudeAction('idle')
      await refreshClaude()
    }
  }

  const handleBootstrapArr = async () => {
    if (!serverOnline) {
      setToastMessage({ type: 'error', text: 'Control server must be online to bootstrap keys.' })
      return
    }

    setIsBootstrapping(true)
    setLocalRetrievedKeys(null)
    setLocalRetrievedError('')
    try {
      const data = await controlServer.bootstrapArr()
      setLocalRetrievedKeys(data.keys || {})

      if (!data.success) {
        const message = data.error || 'No keys were found. Make sure your containers are running and initialized.'
        setLocalRetrievedError(message)
        setToastMessage({ type: 'error', text: message })
        return
      }

      const count = Object.keys(data.keys || {}).length
      setToastMessage({
        type: 'success',
        text:
          count > 0
            ? `Successfully captured ${count} API keys (${Object.keys(data.keys || {}).join(', ')}).`
            : 'No keys were found. Make sure your containers are running and initialized.',
      })
    } catch (error: any) {
      const message = error?.message || 'Bootstrap failed'
      setLocalRetrievedError(message)
      setToastMessage({ type: 'error', text: `Bootstrap failed: ${message}` })
    } finally {
      setIsBootstrapping(false)
    }
  }

  const handleBootstrapArrRemote = async () => {
    if (!serverOnline) {
      setToastMessage({ type: 'error', text: 'Control server must be online to bootstrap keys.' })
      return
    }

    const scanHost = remoteScanHost.trim()
    const scanUsername = remoteScanUsername.trim()
    const scanPort = (remoteScanPort || '22').trim()

    if (!scanHost || !scanUsername) {
      setToastMessage({ type: 'error', text: 'Enter a scan host and username.' })
      return
    }
    if (!remoteEnvPath.trim()) {
      setToastMessage({ type: 'error', text: 'Enter the remote .env path to update.' })
      return
    }

    const scanAuthType = remoteScanAuthType
    if (scanAuthType === 'password' && !remoteScanPassword.trim()) {
      setToastMessage({ type: 'error', text: 'Enter the SSH password for the scan host.' })
      return
    }
    if (scanAuthType === 'key' && !remoteScanPrivateKey.trim()) {
      setToastMessage({ type: 'error', text: 'Paste the SSH private key for the scan host.' })
      return
    }

    const envCredentialType = remoteEnvAuthType || scanAuthType
    const envPayload = useSeparateEnvHost
      ? {
          envHost: remoteEnvHost.trim() || undefined,
          envPort: remoteEnvPort.trim() || undefined,
          envUsername: remoteEnvUsername.trim() || undefined,
          envAuthType: remoteEnvAuthType || undefined,
          envPassword: envCredentialType === 'password' ? (remoteEnvPassword.trim() || undefined) : undefined,
          envPrivateKey: envCredentialType === 'key' ? (remoteEnvPrivateKey.trim() || undefined) : undefined,
        }
      : {}

    setIsRemoteBootstrapping(true)
    setRemoteRetrievedKeys(null)
    setRemoteRetrievedError('')
    try {
      const data = await controlServer.bootstrapArrRemote({
        host: scanHost,
        port: scanPort,
        username: scanUsername,
        authType: scanAuthType,
        password: scanAuthType === 'password' ? remoteScanPassword : undefined,
        privateKey: scanAuthType === 'key' ? remoteScanPrivateKey : undefined,
        envPath: remoteEnvPath.trim(),
        ...envPayload,
      })

      setRemoteRetrievedKeys(data.keys || {})

      if (!data.success) {
        const message = data.error || 'Remote bootstrap failed'
        setRemoteRetrievedError(message)
        setToastMessage({ type: 'error', text: message })
        return
      }

      const count = Object.keys(data.keys || {}).length
      setToastMessage({
        type: 'success',
        text:
          count > 0
            ? `Updated ${count} keys in ${data.env?.host || scanHost}:${data.env?.path || remoteEnvPath.trim()}.`
            : 'No keys were found. Make sure your containers are running and initialized.',
      })
      setIsRemoteArrOpen(false)
    } catch (error: any) {
      const message = error?.message || 'Remote bootstrap failed'
      setRemoteRetrievedError(message)
      setToastMessage({ type: 'error', text: `Remote bootstrap failed: ${message}` })
    } finally {
      setIsRemoteBootstrapping(false)
    }
  }

  const statusPill = useMemo(() => {
    if (isRestarting) return { label: 'Restarting…', color: 'bg-sky-500/15 text-sky-200' }
    if (serverOnline === null) return { label: 'Checking...', color: 'bg-muted text-muted-foreground' }
    if (serverOnline) return { label: 'Control server connected', color: 'bg-emerald-500/15 text-emerald-300' }
    return { label: 'Control server offline', color: 'bg-amber-500/15 text-amber-300' }
  }, [isRestarting, serverOnline])

  const disableActions = pendingAction !== 'idle' || elevenLabsAction !== 'idle' || claudeAction !== 'idle' || isRestarting
  const healthUrl = buildControlServerUrl('/api/health')
  const lastCheckedLabel = lastCheckedAt ? formatTimestamp(lastCheckedAt) : '—'

  return (
    <main className="min-h-screen bg-background text-foreground relative overflow-x-hidden">
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div className="absolute inset-0 matrix-grid opacity-10" />
        <div className="absolute inset-0 matrix-rain opacity-18" />
        <div className="absolute inset-0 scanlines" />
      </div>

      <div className="relative z-10">
        <div className="fixed top-0 left-0 right-0 z-30 border-b border-border/60 bg-background/80 backdrop-blur-md">
          <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-background/50 border border-primary/40 flex items-center justify-center p-0.5 overflow-hidden">
                <picture className="w-full h-full">
                  <source srcSet="/media-stack-logo.webp" type="image/webp" />
                  <img src="/media-stack-logo.png" alt="Logo" className="w-full h-full object-contain" loading="lazy" decoding="async" />
                </picture>
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
              <Button variant="glass" asChild className="gap-2 hidden sm:inline-flex">
                <Link to="/docs">Docs</Link>
              </Button>
              <ThemeToggleButton />
            </div>
          </div>
        </div>

      <section className="pt-28 pb-16">
        <div className="max-w-4xl mx-auto px-4 space-y-10">
          <div className="glass rounded-3xl border border-border/70 p-6 md:p-8 space-y-6">
            <div className="flex flex-col gap-5">
              <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                <div className="space-y-3">
                  <h2 className="text-2xl font-semibold flex items-center gap-2">
                    <Shield className="w-6 h-6 text-primary" />
                    Control server
                  </h2>
                  <p className="text-sm text-muted-foreground max-w-2xl">
                    Check connectivity and request a restart for the Wizard control server that powers settings and automation.
                  </p>
                  <div className="flex flex-wrap items-center gap-3">
                    <div className={`px-3 py-1.5 text-xs font-semibold rounded-full ${statusPill.color}`}>
                      {statusPill.label}
                    </div>
                    <StatusBadge hideText />
                    <span className="text-xs text-muted-foreground">Last checked: {lastCheckedLabel}</span>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    onClick={handleRestartSystem}
                    className="gap-2"
                    data-testid="cockpit-restart"
                    disabled={isRestarting || pendingAction === 'checking'}
                  >
                    {isRestarting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Shield className="w-4 h-4" />}
                    {isRestarting ? 'Restarting…' : 'Restart server'}
                  </Button>
                  <Button
                    onClick={fetchStatus}
                    variant="secondary"
                    className="gap-2"
                    data-testid="cockpit-recheck"
                    disabled={pendingAction === 'checking' || isRestarting}
                  >
                    {pendingAction === 'checking' ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                    {pendingAction === 'checking' ? 'Checking...' : 'Re-check status'}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      window.open(healthUrl, '_blank', 'noopener,noreferrer')
                    }}
                    className="gap-2"
                  >
                    <Terminal className="w-4 h-4" />
                    Open /api/health
                  </Button>
                </div>
              </div>
            </div>
          </div>

          <div className="glass rounded-3xl border border-border/70 p-6 md:p-8 space-y-4">
            <div className="space-y-2">
              <h2 className="text-2xl font-semibold flex items-center gap-2">
                <Key className="w-6 h-6 text-primary" />
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
                  className="w-full bg-background/60 border border-border rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/30"
                />
                <p className="text-[10px] text-muted-foreground mt-2">
                  Need a key? Visit{' '}
                  <a
                    href="https://platform.openai.com/api-keys"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
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
                      • Local backup: <strong>Not used</strong>
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

          <div className="glass rounded-3xl border border-border/70 p-6 md:p-8 space-y-4">
            <div className="space-y-2">
              <h2 className="text-2xl font-semibold flex items-center gap-2">
                <Key className="w-6 h-6 text-orange-400" />
                Claude API Access (Fallback)
              </h2>
              <p className="text-sm text-muted-foreground max-w-2xl">
                Store your Anthropic API key to enable Claude as a fallback AI provider. When OpenAI is unavailable,
                the system automatically switches to Claude for uninterrupted operation.
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
                  value={claudeKeyInput}
                  onChange={(e) => setClaudeKeyInput(e.target.value)}
                  placeholder="sk-ant-..."
                  className="w-full bg-background/60 border border-border rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/30"
                />
                <p className="text-[10px] text-muted-foreground mt-2">
                  Need a key? Visit{' '}
                  <a
                    href="https://console.anthropic.com/settings/keys"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    console.anthropic.com/settings/keys
                  </a>
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button
                    onClick={handleSaveClaudeKey}
                    disabled={disableActions || !claudeKeyInput.trim()}
                    className="gap-2 flex-1"
                  >
                    {claudeAction === 'saving' ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Save className="w-4 h-4" />
                    )}
                    Save key
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleRemoveClaudeKey}
                    disabled={disableActions || (!claudeKeyInput && !hasClaudeKey)}
                    className="gap-2"
                  >
                    {claudeAction === 'removing' ? (
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
                  <Shield className="w-4 h-4 text-orange-300" />
                  Status & diagnostics
                </h3>
                <div className="space-y-3 text-sm">
                  <div className="flex items-center gap-2">
                    {hasClaudeKey ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-amber-400" />
                    )}
                    <span>
                      {hasClaudeKey
                        ? 'Key stored on control server.'
                        : 'No key stored on the control server yet.'}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground leading-relaxed">
                    <p>
                      • Server URL: <code className="bg-muted px-1 py-0.5 rounded text-[11px]">/api/settings/claude-key</code>
                    </p>
                    <p>
                      • Model: <code className="bg-muted px-1 py-0.5 rounded text-[11px]">{claudeModel || 'claude-sonnet-4-5-20250929'}</code>
                    </p>
                    <p>• Claude is used as fallback when OpenAI is unavailable.</p>
                  </div>
                </div>
                <Button
                  variant="secondary"
                  onClick={refreshClaude}
                  disabled={claudeAction !== 'idle'}
                  className="w-full gap-2"
                >
                  {claudeAction !== 'idle' ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <RefreshCw className="w-4 h-4" />
                  )}
                  Run connectivity check
                </Button>
              </div>
            </div>
          </div>

          <div className="glass rounded-3xl border border-border/70 p-6 md:p-8 space-y-4">
            <div className="space-y-2">
              <h2 className="text-2xl font-semibold flex items-center gap-2">
                <Key className="w-6 h-6 text-primary" />
                ElevenLabs Voice (Optional)
              </h2>
              <p className="text-sm text-muted-foreground max-w-2xl">
                Enable ElevenLabs for more natural voice output in the Voice Companion. Keys are stored by the control server.
              </p>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              <div className="rounded-2xl border border-border p-5 bg-card/80">
                <h3 className="text-sm font-semibold mb-3 text-muted-foreground">API key</h3>
                <input
                  type="password"
                  value={elevenLabsKeyInput}
                  onChange={(e) => setElevenLabsKeyInput(e.target.value)}
                  placeholder="xi-... / ElevenLabs API key"
                  className="w-full bg-background/60 border border-border rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/30"
                />
                <p className="text-[10px] text-muted-foreground mt-2">
                  Stored on the control server as <code className="font-mono">ELEVENLABS_API_KEY</code>.
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button
                    onClick={handleSaveElevenLabsKey}
                    disabled={disableActions || !elevenLabsKeyInput.trim()}
                    className="gap-2 flex-1"
                  >
                    {elevenLabsAction === 'saving' ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Save className="w-4 h-4" />
                    )}
                    Save key
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleRemoveElevenLabsKey}
                    disabled={disableActions || !elevenlabs?.hasKey}
                    className="gap-2"
                  >
                    {elevenLabsAction === 'removing' ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
                    Remove
                  </Button>
                </div>
              </div>

              <div className="rounded-2xl border border-border p-5 bg-card/80">
                <h3 className="text-sm font-semibold mb-3 text-muted-foreground">Voice ID</h3>
                <input
                  value={elevenLabsVoiceIdInput}
                  onChange={(e) => setElevenLabsVoiceIdInput(e.target.value)}
                  placeholder={elevenlabs?.voiceId || 'e.g. 21m00Tcm4TlvDq8ikWAM'}
                  className="w-full bg-background/60 border border-border rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/30"
                />
                <p className="text-[10px] text-muted-foreground mt-2">
                  Stored as <code className="font-mono">ELEVENLABS_VOICE_ID</code>. Required to use ElevenLabs TTS.
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button
                    onClick={handleSaveElevenLabsVoice}
                    disabled={disableActions || !elevenLabsVoiceIdInput.trim()}
                    className="gap-2 flex-1"
                  >
                    {elevenLabsAction === 'savingVoice' ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Save className="w-4 h-4" />
                    )}
                    Save voice ID
                  </Button>
                </div>
              </div>
            </div>
          </div>
          <div className="glass rounded-3xl border border-border/70 p-6 md:p-8 space-y-6">
            <div className="space-y-2">
              <h2 className="text-2xl font-semibold flex items-center gap-2">
                <RefreshCw className="w-6 h-6 text-cyan-300" />
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
              <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
                <Button
                  onClick={handleBootstrapArr}
                  className="gap-2 bg-emerald-500 hover:bg-emerald-400 shadow-lg shadow-emerald-500/20 px-6 flex-1"
                  disabled={isBootstrapping || !serverOnline}
                >
                  {isBootstrapping ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <RefreshCw className="w-4 h-4" />
                  )}
                  {isBootstrapping ? 'Scanning...' : 'Local'}
                </Button>
                <Button
                  onClick={() => setIsRemoteArrOpen(true)}
                  variant="outline"
                  className="gap-2 px-6 flex-1"
                >
                  <Key className="w-4 h-4" />
                  Remote
                </Button>
              </div>
            </div>

            {(localRetrievedError || (localRetrievedKeys && Object.keys(localRetrievedKeys).length > 0)) && (
              <div className="rounded-2xl border border-border p-4 bg-card/40 space-y-3">
                {localRetrievedError && (
                  <div className="text-sm text-red-400 whitespace-pre-wrap">{localRetrievedError}</div>
                )}
                {localRetrievedKeys && Object.keys(localRetrievedKeys).length > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Retrieved keys</p>
                    <div className="grid grid-cols-1 gap-2">
                      {Object.entries(localRetrievedKeys).map(([k, v]) => (
                        <div
                          key={k}
                          className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-background/40 px-3 py-2"
                        >
                          <code className="text-xs font-mono text-muted-foreground">{k}</code>
                          <code className="text-xs font-mono text-foreground truncate max-w-[60%]">{v}</code>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            <Dialog open={isRemoteArrOpen} onOpenChange={setIsRemoteArrOpen}>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Remote Arr Key Bootstrap</DialogTitle>
                  <DialogDescription>
                    Extract API keys from your remote *arr containers and update a remote .env file.
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <p className="text-sm font-medium">Scan host</p>
                      <input
                        value={remoteScanHost}
                        onChange={(e) => setRemoteScanHost(e.target.value)}
                        placeholder="e.g. 192.168.1.50"
                        className="w-full bg-background/60 border border-border rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/30"
                      />
                    </div>
                    <div className="space-y-2">
                      <p className="text-sm font-medium">Port</p>
                      <input
                        value={remoteScanPort}
                        onChange={(e) => setRemoteScanPort(e.target.value)}
                        placeholder="22"
                        className="w-full bg-background/60 border border-border rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/30"
                      />
                    </div>
                    <div className="space-y-2">
                      <p className="text-sm font-medium">Username</p>
                      <input
                        value={remoteScanUsername}
                        onChange={(e) => setRemoteScanUsername(e.target.value)}
                        placeholder="e.g. ubuntu"
                        className="w-full bg-background/60 border border-border rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/30"
                      />
                    </div>
                    <div className="space-y-2">
                      <p className="text-sm font-medium">Auth</p>
                      <select
                        value={remoteScanAuthType}
                        onChange={(e) => setRemoteScanAuthType(e.target.value as 'password' | 'key')}
                        aria-label="Scan host authentication type"
                        className="w-full bg-background/60 border border-border rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/30"
                      >
                        <option value="password">Password</option>
                        <option value="key">SSH Key</option>
                      </select>
                    </div>
                  </div>

                  {remoteScanAuthType === 'password' ? (
                    <div className="space-y-2">
                      <p className="text-sm font-medium">Password</p>
                      <input
                        value={remoteScanPassword}
                        onChange={(e) => setRemoteScanPassword(e.target.value)}
                        placeholder="SSH password"
                        type="password"
                        className="w-full bg-background/60 border border-border rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/30"
                      />
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <p className="text-sm font-medium">Private key</p>
                      <textarea
                        value={remoteScanPrivateKey}
                        onChange={(e) => setRemoteScanPrivateKey(e.target.value)}
                        placeholder="-----BEGIN OPENSSH PRIVATE KEY-----"
                        rows={6}
                        className="w-full bg-background/60 border border-border rounded-xl px-4 py-2 text-sm font-mono focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/30"
                      />
                    </div>
                  )}

                  <div className="space-y-2">
                    <p className="text-sm font-medium">Remote .env path</p>
                    <input
                      value={remoteEnvPath}
                      onChange={(e) => setRemoteEnvPath(e.target.value)}
                      placeholder="~/media-stack/.env"
                      className="w-full bg-background/60 border border-border rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/30"
                    />
                  </div>

                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={useSeparateEnvHost}
                      onChange={(e) => setUseSeparateEnvHost(e.target.checked)}
                      className="h-4 w-4"
                    />
                    Use a different host for the .env file
                  </label>

                  {useSeparateEnvHost && (
                    <div className="rounded-2xl border border-border p-4 bg-card/60 space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <p className="text-sm font-medium">Env host</p>
                          <input
                            value={remoteEnvHost}
                            onChange={(e) => setRemoteEnvHost(e.target.value)}
                            placeholder="e.g. 10.0.0.10"
                            className="w-full bg-background/60 border border-border rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/30"
                          />
                        </div>
                        <div className="space-y-2">
                          <p className="text-sm font-medium">Env port</p>
                          <input
                            value={remoteEnvPort}
                            onChange={(e) => setRemoteEnvPort(e.target.value)}
                            placeholder={remoteScanPort || '22'}
                            className="w-full bg-background/60 border border-border rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/30"
                          />
                        </div>
                        <div className="space-y-2">
                          <p className="text-sm font-medium">Env username</p>
                          <input
                            value={remoteEnvUsername}
                            onChange={(e) => setRemoteEnvUsername(e.target.value)}
                            placeholder={remoteScanUsername || 'e.g. ubuntu'}
                            className="w-full bg-background/60 border border-border rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/30"
                          />
                        </div>
                        <div className="space-y-2">
                          <p className="text-sm font-medium">Env auth</p>
                          <select
                            value={remoteEnvAuthType}
                            onChange={(e) => setRemoteEnvAuthType(e.target.value as 'password' | 'key' | '')}
                            aria-label="Env host authentication type"
                            className="w-full bg-background/60 border border-border rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/30"
                          >
                            <option value="">Same as scan host</option>
                            <option value="password">Password</option>
                            <option value="key">SSH Key</option>
                          </select>
                        </div>
                      </div>

                      {(remoteEnvAuthType || remoteScanAuthType) === 'password' ? (
                        <div className="space-y-2">
                          <p className="text-sm font-medium">Env password</p>
                          <input
                            value={remoteEnvPassword}
                            onChange={(e) => setRemoteEnvPassword(e.target.value)}
                            placeholder="SSH password"
                            type="password"
                            className="w-full bg-background/60 border border-border rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/30"
                          />
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <p className="text-sm font-medium">Env private key</p>
                          <textarea
                            value={remoteEnvPrivateKey}
                            onChange={(e) => setRemoteEnvPrivateKey(e.target.value)}
                            placeholder="-----BEGIN OPENSSH PRIVATE KEY-----"
                            rows={6}
                            className="w-full bg-background/60 border border-border rounded-xl px-4 py-2 text-sm font-mono focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/30"
                          />
                        </div>
                      )}
                    </div>
                  )}

                  {(remoteRetrievedError || (remoteRetrievedKeys && Object.keys(remoteRetrievedKeys).length > 0)) && (
                    <div className="rounded-2xl border border-border p-4 bg-card/60 space-y-3">
                      {remoteRetrievedError && (
                        <div className="text-sm text-red-400 whitespace-pre-wrap">{remoteRetrievedError}</div>
                      )}
                      {remoteRetrievedKeys && Object.keys(remoteRetrievedKeys).length > 0 && (
                        <div className="space-y-2">
                          <p className="text-sm font-medium">Retrieved keys</p>
                          <div className="grid grid-cols-1 gap-2">
                            {Object.entries(remoteRetrievedKeys).map(([k, v]) => (
                              <div key={k} className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-background/40 px-3 py-2">
                                <code className="text-xs font-mono text-muted-foreground">{k}</code>
                                <code className="text-xs font-mono text-foreground truncate max-w-[60%]">{v}</code>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <DialogFooter className="gap-2">
                  <Button variant="outline" onClick={() => setIsRemoteArrOpen(false)} disabled={isRemoteBootstrapping}>
                    Cancel
                  </Button>
                  <Button onClick={handleBootstrapArrRemote} disabled={isRemoteBootstrapping || !serverOnline} className="gap-2">
                    {isRemoteBootstrapping ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                    {isRemoteBootstrapping ? 'Updating...' : 'Bootstrap Remote Keys'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          <div className="text-xs text-muted-foreground text-center">
            Need to rotate keys? Run{' '}
            <code className="bg-muted px-2 py-1 rounded">./rotate_secrets.sh</code> or update from this page any time.
          </div>
        </div>
      </section>
      </div>
    </main>
  )
}
