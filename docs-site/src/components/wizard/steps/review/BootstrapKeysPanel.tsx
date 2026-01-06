import { useState, useRef, useEffect } from 'react'
import { Key, Loader2, CheckCircle2, AlertCircle, Eye, EyeOff, Copy, Check } from 'lucide-react'
import { controlServer } from '../../../../utils/controlServer'

type BootstrapCredentialKind = 'API key' | 'token' | 'password' | 'secret'

const maskSecret = (value: string, head = 6, tail = 4) => {
    const trimmed = String(value || '').trim()
    if (!trimmed) return ''
    if (trimmed.length <= head + tail) return `${trimmed.slice(0, Math.min(head, trimmed.length))}...`
    return `${trimmed.slice(0, head)}...${trimmed.slice(-tail)}`
}

const BOOTSTRAP_KEY_META: Record<string, { app: string; kind: BootstrapCredentialKind }> = {
    SONARR_API_KEY: { app: 'Sonarr', kind: 'API key' },
    RADARR_API_KEY: { app: 'Radarr', kind: 'API key' },
    PROWLARR_API_KEY: { app: 'Prowlarr', kind: 'API key' },
    READARR_API_KEY: { app: 'Readarr', kind: 'API key' },
    LIDARR_API_KEY: { app: 'Lidarr', kind: 'API key' },
    WHISPARR_API_KEY: { app: 'Whisparr', kind: 'API key' },
    BAZARR_API_KEY: { app: 'Bazarr', kind: 'API key' },
    OVERSEERR_API_KEY: { app: 'Overseerr', kind: 'API key' },
    JELLYSEERR_API_KEY: { app: 'Jellyseerr', kind: 'API key' },
    OMBI_API_KEY: { app: 'Ombi', kind: 'API key' },
    TAUTULLI_API_KEY: { app: 'Tautulli', kind: 'API key' },
    JACKETT_API_KEY: { app: 'Jackett', kind: 'API key' },
    SABNZBD_API_KEY: { app: 'SABnzbd', kind: 'API key' },
    NOTIFIARR_API_KEY: { app: 'Notifiarr', kind: 'API key' },
    TDARR_API_KEY: { app: 'Tdarr', kind: 'API key' },
    UNPACKERR_API_KEY: { app: 'Unpackerr', kind: 'API key' },
    REQUESTRR_API_KEY: { app: 'Requestrr', kind: 'API key' },
    HOMEPAGE_API_KEY: { app: 'Homepage', kind: 'API key' },
    ORGANIZR_API_KEY: { app: 'Organizr', kind: 'API key' },
    PLEX_TOKEN: { app: 'Plex', kind: 'token' },
    JELLYFIN_API_KEY: { app: 'Jellyfin', kind: 'API key' },
    QBITTORRENT_API_KEY: { app: 'qBittorrent', kind: 'secret' },
    DELUGE_PASSWORD: { app: 'Deluge', kind: 'password' },
    TRANSMISSION_PASSWORD: { app: 'Transmission', kind: 'password' },
    NZBGET_PASSWORD: { app: 'NZBGet', kind: 'password' },
}

const titleCase = (value: string) =>
    value
        .split(/[\s_]+/g)
        .filter(Boolean)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
        .join(' ')

const describeBootstrapKey = (envKey: string): { app: string; kind: BootstrapCredentialKind } => {
    const direct = BOOTSTRAP_KEY_META[envKey]
    if (direct) return direct

    if (envKey.endsWith('_API_KEY')) return { app: titleCase(envKey.replace(/_API_KEY$/, '')), kind: 'API key' }
    if (envKey.endsWith('_TOKEN')) return { app: titleCase(envKey.replace(/_TOKEN$/, '')), kind: 'token' }
    if (envKey.endsWith('_PASSWORD')) return { app: titleCase(envKey.replace(/_PASSWORD$/, '')), kind: 'password' }
    return { app: titleCase(envKey), kind: 'secret' }
}

interface BootstrapKeysPanelProps {
    copyToClipboard: (text: string) => void
}

/**
 * Panel for bootstrapping *arr API keys.
 * Displays a button to extract API keys from running containers,
 * shows extraction progress, and provides reveal/copy functionality for extracted keys.
 */
export function BootstrapKeysPanel({ copyToClipboard }: BootstrapKeysPanelProps) {
    const [bootstrapStatus, setBootstrapStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
    const [bootstrapMessage, setBootstrapMessage] = useState('')
    const [bootstrapKeys, setBootstrapKeys] = useState<Record<string, string>>({})
    const [bootstrapValidations, setBootstrapValidations] = useState<Record<string, { ok: boolean; tested: boolean; status?: number; error?: string }>>({})
    const [bootstrapProgress, setBootstrapProgress] = useState<{ ready: number; running: number; total: number }>({ ready: 0, running: 0, total: 0 })
    const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)
    const pollInFlightRef = useRef(false)
    const [revealedBootstrapKeys, setRevealedBootstrapKeys] = useState<Set<string>>(() => new Set())
    const [copiedBootstrapKey, setCopiedBootstrapKey] = useState<string | null>(null)

    // Cleanup polling on unmount
    useEffect(() => {
        return () => {
            if (pollingRef.current) {
                clearInterval(pollingRef.current)
            }
        }
    }, [])

    const toggleRevealBootstrapKey = (envKey: string) => {
        setRevealedBootstrapKeys((prev) => {
            const next = new Set(prev)
            if (next.has(envKey)) next.delete(envKey)
            else next.add(envKey)
            return next
        })
    }

    const copyBootstrapSecret = async (envKey: string, secret: string) => {
        const value = String(secret || '')
        if (!value) return
        try {
            if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
                await navigator.clipboard.writeText(value)
            } else {
                copyToClipboard(value)
            }
            setCopiedBootstrapKey(envKey)
            setTimeout(() => setCopiedBootstrapKey((current) => (current === envKey ? null : current)), 1500)
        } catch {
            copyToClipboard(value)
            setCopiedBootstrapKey(envKey)
            setTimeout(() => setCopiedBootstrapKey((current) => (current === envKey ? null : current)), 1500)
        }
    }

    const handleBootstrapKeys = async () => {
        setBootstrapStatus('loading')
        setBootstrapProgress({ ready: 0, running: 0, total: 0 })
        setBootstrapMessage('Checking *arr services...')
        setBootstrapKeys({})
        setBootstrapValidations({})
        setRevealedBootstrapKeys(new Set())
        setCopiedBootstrapKey(null)

        // Start polling for status updates
        const pollStatus = async () => {
            if (pollInFlightRef.current) return
            pollInFlightRef.current = true
            try {
                const status = await controlServer.getArrStatus()
                if (status.success && status.services) {
                    const running = status.services.filter(s => s.running).length
                    const ready = status.services.filter(s => s.ready).length
                    const notReady = status.services.filter(s => s.running && !s.ready).map(s => s.id)
                    setBootstrapProgress({ ready, running, total: status.services.length })
                    setBootstrapMessage(
                        notReady.length
                            ? `Services ready: ${ready}/${running} running (waiting on: ${notReady.join(', ')})`
                            : `Services ready: ${ready}/${running} running`
                    )
                }
            } catch {
                // Ignore polling errors, the main request will handle failure
            } finally {
                pollInFlightRef.current = false
            }
        }

        // Initial poll
        await pollStatus()

        // Continue polling every 5 seconds
        pollingRef.current = setInterval(() => { void pollStatus() }, 5000)

        try {
            const result = await controlServer.autoBootstrapArr({ timeout: 120000, pollInterval: 5000 })

            // Stop polling
            if (pollingRef.current) {
                clearInterval(pollingRef.current)
                pollingRef.current = null
            }

            if (result.success) {
                setBootstrapStatus('success')
                setBootstrapKeys(result.keys)
                setBootstrapValidations(result.validations || {})
                const readyCount = result.services?.filter(s => s.ready).length || 0
                setBootstrapProgress({ ready: readyCount, running: readyCount, total: result.services?.length || 0 })
                const tested = Object.values(result.validations || {}).filter((v) => v.tested).length
                const ok = Object.values(result.validations || {}).filter((v) => v.tested && v.ok).length
                const suffix = tested > 0 ? ` (verified ${ok}/${tested})` : ''
                setBootstrapMessage(`Successfully extracted ${Object.keys(result.keys).length} keys and wrote to .env${suffix}`)
            } else {
                setBootstrapStatus('error')
                setBootstrapMessage(result.error || `Failed at step: ${result.step}`)
            }
        } catch (err) {
            // Stop polling on error
            if (pollingRef.current) {
                clearInterval(pollingRef.current)
                pollingRef.current = null
            }
            setBootstrapStatus('error')
            setBootstrapMessage(err instanceof Error ? err.message : 'Failed to bootstrap API keys')
        }
    }

    return (
        <div className="bg-purple-500/10 border border-purple-500/30 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
                <Key className="w-4 h-4 text-purple-400" />
                <span className="text-sm font-medium text-purple-300">Bootstrap API Keys</span>
            </div>
            <p className="text-xs text-muted-foreground mb-3">
                Automatically extract *arr API keys and write to .env
            </p>
            <button
                onClick={handleBootstrapKeys}
                disabled={bootstrapStatus === 'loading'}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-purple-500 hover:bg-purple-600 disabled:bg-purple-500/50 text-white rounded-lg font-medium transition-colors"
            >
                {bootstrapStatus === 'loading' ? (
                    <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        {bootstrapProgress.running > 0
                            ? `${bootstrapProgress.ready}/${bootstrapProgress.running} ready...`
                            : 'Checking services...'}
                    </>
                ) : bootstrapStatus === 'success' ? (
                    <>
                        <CheckCircle2 className="w-4 h-4" />
                        Keys Extracted
                    </>
                ) : (
                    <>
                        <Key className="w-4 h-4" />
                        Bootstrap Keys
                    </>
                )}
            </button>
            {bootstrapStatus !== 'idle' && (
                <div className={`mt-3 p-2 rounded text-xs ${
                    bootstrapStatus === 'loading' ? 'bg-blue-500/10 text-blue-300' :
                    bootstrapStatus === 'success' ? 'bg-green-500/10 text-green-300' :
                    'bg-red-500/10 text-red-300'
                }`}>
                    {/* Progress bar during loading */}
                    {bootstrapStatus === 'loading' && bootstrapProgress.running > 0 && (
                        <div className="mb-2">
                            <div className="h-1.5 bg-purple-900/30 rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-purple-500 transition-all duration-500 ease-out"
                                    style={{ width: `${(bootstrapProgress.ready / bootstrapProgress.running) * 100}%` }}
                                />
                            </div>
                        </div>
                    )}
                    {bootstrapMessage}
                    {bootstrapStatus === 'success' && Object.keys(bootstrapKeys).length > 0 && (
                        <div className="mt-2 space-y-1">
                            {Object.entries(bootstrapKeys).map(([envKey, secret]) => {
                                const meta = describeBootstrapKey(envKey)
                                const validation = bootstrapValidations[envKey]
                                const tested = Boolean(validation?.tested)
                                const ok = Boolean(validation?.tested && validation?.ok)
                                const revealed = revealedBootstrapKeys.has(envKey)
                                const displayed = revealed ? secret : maskSecret(secret)
                                return (
                                    <div key={envKey} className="rounded bg-background/50 p-2">
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="min-w-0">
                                                <div className="text-xs font-medium text-green-300 truncate">
                                                    {meta.app}{' '}
                                                    <span className="text-muted-foreground">({meta.kind})</span>
                                                </div>
                                                <div className="text-[11px] text-muted-foreground font-mono truncate">{envKey}</div>
                                            </div>
                                            <div className="shrink-0 flex items-center gap-1">
                                                {tested ? (
                                                    ok ? (
                                                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                                                    ) : (
                                                        <AlertCircle className="w-4 h-4 text-amber-400" />
                                                    )
                                                ) : (
                                                    <Key className="w-4 h-4 text-muted-foreground" />
                                                )}
                                            </div>
                                        </div>

                                        <div className="mt-2 flex items-start gap-2">
                                            <button
                                                type="button"
                                                onClick={() => void copyBootstrapSecret(envKey, secret)}
                                                className="flex-1 text-left rounded border border-border bg-background/60 px-2 py-1 font-mono text-[11px] text-muted-foreground hover:border-primary/40 break-all"
                                                title="Click to copy"
                                            >
                                                {displayed}
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => toggleRevealBootstrapKey(envKey)}
                                                className="p-2 rounded border border-border bg-background/60 hover:bg-background/80 hover:border-primary/40 transition-colors"
                                                title={revealed ? 'Hide' : 'Reveal'}
                                                aria-label={revealed ? 'Hide key' : 'Reveal key'}
                                            >
                                                {revealed ? (
                                                    <EyeOff className="w-3.5 h-3.5 text-muted-foreground" />
                                                ) : (
                                                    <Eye className="w-3.5 h-3.5 text-muted-foreground" />
                                                )}
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => void copyBootstrapSecret(envKey, secret)}
                                                className="p-2 rounded border border-border bg-background/60 hover:bg-background/80 hover:border-primary/40 transition-colors"
                                                title={copiedBootstrapKey === envKey ? 'Copied' : 'Copy'}
                                                aria-label={copiedBootstrapKey === envKey ? 'Copied' : 'Copy key'}
                                            >
                                                {copiedBootstrapKey === envKey ? (
                                                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                                                ) : (
                                                    <Copy className="w-3.5 h-3.5 text-muted-foreground" />
                                                )}
                                            </button>
                                        </div>

                                        <div className="mt-1 text-[11px] text-muted-foreground">
                                            {tested ? (ok ? 'Verified' : validation?.error || 'Validation failed') : 'Not tested'}
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}
