import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { AlertCircle, Check, Copy, Download, Package, Globe, CheckCircle2, Rocket, Key, Loader2, Eye, EyeOff, X } from 'lucide-react'
import { PostInstallChecklist } from '../../PostInstallChecklist'
import { controlServer } from '../../../utils/controlServer'
import { createDefaultStoragePlan, DEFAULT_DATA_ROOT, STORAGE_CATEGORIES } from '../../../data/storagePlan'
import { SetupConfig } from '../../../store/setupStore'
import { ConfigSummaryCard } from './review/ConfigSummaryCard'
import { StorageLayoutCard } from './review/StorageLayoutCard'
import { LocalAccessGuide, buildLocalHttpUrl, isLoopbackHost, LOCAL_ACCESS_APPS } from './review/LocalAccessGuide'

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

interface ReviewGenerateStepProps {
    config: SetupConfig
    mode: 'newbie' | 'expert' | null
    selectedServices: string[]
    appliedTemplateId: string | null
    generateEnvFile: () => string
    generateAutheliaYaml: () => string
    generateCloudflareYaml: () => string
    copyToClipboard: (text: string) => void
    downloadFile: (content: string, filename: string) => void
    downloadAllFiles: () => void
    handleShare: () => void
    copied: boolean
}

export function ReviewGenerateStep({
    config, mode, selectedServices, appliedTemplateId: _appliedTemplateId,
    generateEnvFile, generateAutheliaYaml: _generateAutheliaYaml, generateCloudflareYaml: _generateCloudflareYaml,
    copyToClipboard, downloadFile, downloadAllFiles, handleShare, copied
}: ReviewGenerateStepProps) {
    const [showDeployModal, setShowDeployModal] = useState(false)
    const isLocalMode = config.deploymentMode === 'local'

    // Deploy state
    const [deployStatus, setDeployStatus] = useState<'idle' | 'deploying' | 'success' | 'error'>('idle')
    const [deploySteps, setDeploySteps] = useState<Array<{ step: string; status: 'done' | 'error' | 'running' }>>([])
    const [deployError, setDeployError] = useState('')
    const [deployContainers, setDeployContainers] = useState<Array<{ name: string; on: boolean }>>([])

    // Bootstrap state
    const [bootstrapStatus, setBootstrapStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
    const [bootstrapMessage, setBootstrapMessage] = useState('')
    const [bootstrapKeys, setBootstrapKeys] = useState<Record<string, string>>({})
    const [bootstrapValidations, setBootstrapValidations] = useState<Record<string, { ok: boolean; tested: boolean; status?: number; error?: string }>>({})
    const [bootstrapProgress, setBootstrapProgress] = useState<{ ready: number; running: number; total: number }>({ ready: 0, running: 0, total: 0 })
    const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)
    const pollInFlightRef = useRef(false)
    const [revealedBootstrapKeys, setRevealedBootstrapKeys] = useState<Set<string>>(() => new Set())
    const [copiedBootstrapKey, setCopiedBootstrapKey] = useState<string | null>(null)

    // Access host state for deploy modal success URLs
    const [accessHost, setAccessHost] = useState(() => {
        if (typeof window === 'undefined') return 'localhost'
        return window.location.hostname || 'localhost'
    })
    const [lanIpv4, setLanIpv4] = useState<string | null>(null)

    // Fetch LAN IP for deploy modal
    useEffect(() => {
        if (!isLocalMode) return
        if (typeof window === 'undefined') return

        const host = window.location.hostname || 'localhost'
        if (!isLoopbackHost(host)) {
            setAccessHost(host)
            return
        }

        let cancelled = false
        void (async () => {
            try {
                const info = await controlServer.getNetworkInfo()
                if (cancelled) return

                if (info?.success && info.lanIpv4) {
                    setLanIpv4(info.lanIpv4)
                    setAccessHost(info.lanIpv4)
                    return
                }

                if (info?.success && Array.isArray(info.ipv4) && info.ipv4.length) {
                    setLanIpv4(info.ipv4[0] || null)
                }
            } catch {
                // best-effort only
            }
        })()

        return () => {
            cancelled = true
        }
    }, [isLocalMode])

    const handleDeploy = async () => {
        setDeployStatus('deploying')
        setDeploySteps([
            { step: 'Writing .env file...', status: 'running' },
        ])
        setDeployError('')

        // Simulate progress steps with timeouts for better UX feedback
        const progressTimers: ReturnType<typeof setTimeout>[] = []
        
        progressTimers.push(setTimeout(() => {
            setDeploySteps(() => [
                { step: 'Wrote .env file', status: 'done' },
                { step: 'Creating data directories...', status: 'running' },
            ])
        }, 1500))
        
        progressTimers.push(setTimeout(() => {
            setDeploySteps(() => [
                { step: 'Wrote .env file', status: 'done' },
                { step: 'Created data directories', status: 'done' },
                { step: 'Starting containers (this may take 1-2 minutes)...', status: 'running' },
            ])
        }, 3000))

        try {
            const envContent = generateEnvFile()
            const result = await controlServer.localDeploy({
                envContent,
                profiles: selectedServices,
                composeFile: 'docker-compose.local.yml',
            })

            // Clear progress timers
            progressTimers.forEach(t => clearTimeout(t))

            setDeploySteps(result.steps.map(s => ({ ...s, status: s.status as 'done' | 'error' })))

            if (result.success) {
                setDeployStatus('success')
                setDeployContainers(result.containers || [])
            } else {
                setDeployStatus('error')
                setDeployError(result.error || 'Deployment failed')
            }
        } catch (err) {
            // Clear progress timers
            progressTimers.forEach(t => clearTimeout(t))
            
            setDeployStatus('error')
            setDeployError(err instanceof Error ? err.message : 'Deployment failed')
            setDeploySteps([{ step: 'Deployment failed', status: 'error' }])
        }
    }

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

        // Continue polling every 3 seconds
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

    const storagePlan = config.storagePlan || createDefaultStoragePlan(DEFAULT_DATA_ROOT)
    const planRoot = storagePlan.dataRoot?.path || DEFAULT_DATA_ROOT
    const storageDefaults = createDefaultStoragePlan(planRoot)

    const storageEntries = STORAGE_CATEGORIES.filter((category) => {
        if (category.alwaysVisible) return true
        if (category.services.length === 0) return false
        return category.services.some((service) => selectedServices.includes(service))
    }).map((category) => ({
        id: category.id,
        label: category.label,
        path: storagePlan[category.id]?.path || storageDefaults[category.id]?.path || '',
        type: storagePlan[category.id]?.type || 'local',
    }))

    return (
        <motion.div
            key="step5"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-6"
        >
            <div className="mb-6">
                <h2 className="text-2xl font-bold text-foreground mb-2">Review & Generate</h2>
                <p className="text-muted-foreground">
                    {isLocalMode
                        ? "You're almost done! Download your files and start streaming."
                        : "Verify your settings and generate configuration files"}
                </p>
            </div>

            {/* Quick Access Guide for Local Mode - Beginner friendly */}
            {isLocalMode && <LocalAccessGuide selectedServices={selectedServices} />}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                <ConfigSummaryCard
                    config={config}
                    mode={mode}
                    selectedServices={selectedServices}
                />

                <div className="p-4 rounded-xl bg-muted/40 border border-border">
                    <h3 className="text-sm font-semibold text-foreground/80 mb-4">Selected Services</h3>
                    <div className="flex flex-wrap gap-2">
                        {selectedServices.map((s: string) => (
                            <span key={s} className="px-2 py-1 rounded-md bg-primary/20 text-primary text-xs border border-primary/40">
                                {s}
                            </span>
                        ))}
                    </div>
                </div>
            </div>

            {selectedServices.includes('torrent') && !selectedServices.includes('vpn') && (
                <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/30 flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-red-400 mt-0.5" />
                    <div>
                        <h3 className="text-sm font-semibold text-red-300">Security Warning: VPN Missing</h3>
                        <p className="text-sm text-red-200/70 mt-1">
                            You have selected a torrent client but not the VPN service.
                            Your IP address will be exposed to the swarm.
                            It is highly recommended to enable <strong>Gluetun VPN</strong> for privacy.
                        </p>
                    </div>
                </div>
            )}

            <StorageLayoutCard storageEntries={storageEntries} />

            <div className="p-4 rounded-xl bg-primary/10 border border-primary/30 flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-primary mt-0.5" />
                <div>
                    <h3 className="text-sm font-semibold text-primary">TRaSH presets (recommended)</h3>
                    <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                        <li>Import TRaSH quality profiles in Sonarr/Radarr (HD-1080p or UHD-2160p are safe starters).</li>
                        <li>Apply TRaSH naming schemes for consistent filenames across apps.</li>
                        <li>Set per-quality file-size caps to keep storage predictable.</li>
                    </ul>
                    <div className="mt-2 text-[11px] text-muted-foreground">
                        Links:{' '}
                        <a
                            className="text-primary hover:text-primary/80 underline"
                            href="https://trash-guides.info/Sonarr/sonarr-setup-quality-profiles/"
                            target="_blank"
                            rel="noopener noreferrer"
                        >
                            Sonarr profiles
                        </a>
                        ,{' '}
                        <a
                            className="text-primary hover:text-primary/80 underline"
                            href="https://trash-guides.info/Radarr/radarr-setup-quality-profiles/"
                            target="_blank"
                            rel="noopener noreferrer"
                        >
                            Radarr profiles
                        </a>
                        ,{' '}
                        <a
                            className="text-primary hover:text-primary/80 underline"
                            href="https://trash-guides.info/Sonarr/Sonarr-recommended-naming-scheme/"
                            target="_blank"
                            rel="noopener noreferrer"
                        >
                            Sonarr naming
                        </a>
                        ,{' '}
                        <a
                            className="text-primary hover:text-primary/80 underline"
                            href="https://trash-guides.info/Radarr/Radarr-recommended-naming-scheme/"
                            target="_blank"
                            rel="noopener noreferrer"
                        >
                            Radarr naming
                        </a>
                        .
                    </div>
                </div>
            </div>

            {/* File Previews */}
            <div className="space-y-4">
                <div className="rounded-xl bg-card border border-border overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-2 bg-muted/40 border-b border-border">
                        <span className="text-sm font-mono text-muted-foreground">.env</span>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => copyToClipboard(generateEnvFile())}
                                className="p-1.5 hover:bg-muted/60 rounded-lg transition-colors text-muted-foreground hover:text-foreground"
                                title="Copy to clipboard"
                            >
                                {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                            </button>
                            <button
                                onClick={() => downloadFile(generateEnvFile(), '.env')}
                                className="p-1.5 hover:bg-muted/60 rounded-lg transition-colors text-muted-foreground hover:text-foreground"
                                title="Download file"
                            >
                                <Download className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                    <pre className="p-4 text-xs font-mono text-muted-foreground overflow-x-auto max-h-60 custom-scrollbar">
                        {generateEnvFile()}
                    </pre>
                </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 mt-8">
                <button
                    onClick={downloadAllFiles}
                    className="flex-1 flex items-center justify-center gap-2 px-6 py-4 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white rounded-xl font-semibold shadow-lg shadow-green-500/20 transition-all btn-lift"
                >
                    <Package className="w-5 h-5" />
                    Download All Files
                </button>
                {isLocalMode && (
                    <button
                        onClick={() => setShowDeployModal(true)}
                        className="flex-1 flex items-center justify-center gap-2 px-6 py-4 bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white rounded-xl font-semibold shadow-lg shadow-blue-500/20 transition-all btn-lift"
                    >
                        <Rocket className="w-5 h-5" />
                        Run Local Install
                    </button>
                )}
                <button
                    onClick={handleShare}
                    className="flex items-center justify-center gap-2 px-6 py-4 bg-muted/60 hover:bg-muted/80 border border-border hover:border-primary/40 text-foreground rounded-xl font-semibold transition-all btn-lift"
                >
                    <Globe className="w-5 h-5" />
                    Share Configuration
                </button>
            </div>

            {/* Local Deploy Modal */}
            <AnimatePresence>
                {showDeployModal && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
                        onClick={() => setShowDeployModal(false)}
                    >
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            className="bg-card border border-border rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="p-6 border-b border-border">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-blue-500/20 rounded-lg">
                                            <Rocket className="w-6 h-6 text-blue-400" />
                                        </div>
                                        <div>
                                            <h2 className="text-xl font-bold text-foreground">Run Local Install</h2>
                                            <p className="text-sm text-muted-foreground">Deploy your media stack to this machine</p>
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setShowDeployModal(false)}
                                        className="p-2 rounded-lg hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors"
                                        aria-label="Close modal"
                                    >
                                        <X className="w-5 h-5" />
                                    </button>
                                </div>
                            </div>

                            <div className="p-6 space-y-6">
                                {/* Success State */}
                                {deployStatus === 'success' ? (
                                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
                                        <div className="text-center py-4">
                                            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring" }}>
                                                <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4" />
                                            </motion.div>
                                            <h3 className="text-xl font-bold text-green-400 mb-2">Deployment Successful!</h3>
                                            <p className="text-sm text-muted-foreground">Your media stack is now running locally</p>
                                        </div>

                                        {/* Container Status */}
                                        {deployContainers.length > 0 && (
                                            <div className="bg-background/40 border border-border rounded-lg p-3">
                                                <div className="text-xs text-muted-foreground mb-2">Running Containers</div>
                                                <div className="max-h-32 overflow-y-auto space-y-1">
                                                    {deployContainers.map((c) => (
                                                        <div key={c.name} className="flex items-center justify-between text-sm">
                                                            <span className="font-mono text-xs text-foreground truncate pr-3">{c.name}</span>
                                                            <span className={`text-xs ${c.on ? 'text-green-400' : 'text-muted-foreground'}`}>{c.on ? 'running' : 'stopped'}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {/* Bootstrap API Keys */}
                                        {selectedServices.includes('arr') && (
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
                                        )}

                                        {/* Access URLs - Beginner friendly with IP:PORT */}
                                        <div className="space-y-3">
                                            <div className="text-sm font-medium text-foreground">What's Next?</div>
                                            <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg">
                                                <p className="text-sm text-foreground mb-2">
                                                    Open your apps:
                                                </p>
                                                <div className="space-y-1.5 text-xs">
                                                    {LOCAL_ACCESS_APPS.filter((app) => app.showWhenSelected(selectedServices)).map((app) => {
                                                        const url = buildLocalHttpUrl(accessHost, app.port, app.path)
                                                        return (
                                                            <div key={app.id} className="flex items-center justify-between p-2 bg-background/60 rounded gap-3">
                                                                <span className="font-medium">{app.label}</span>
                                                                <a
                                                                    href={url}
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                    className="text-primary font-mono text-[11px] hover:underline truncate"
                                                                >
                                                                    {url}
                                                                </a>
                                                            </div>
                                                        )
                                                    })}
                                                </div>
                                                <p className="text-xs text-muted-foreground mt-2">
                                                    {isLoopbackHost(accessHost)
                                                        ? '💡 These links use localhost. For other devices, use your LAN IP (like 192.168.1.100).'
                                                        : `💡 These links use ${accessHost}${lanIpv4 && lanIpv4 !== accessHost ? ` (LAN: ${lanIpv4})` : ''}.`}
                                                </p>
                                            </div>
                                        </div>
                                    </motion.div>
                                ) : deployStatus === 'deploying' ? (
                                    /* Deploying State */
                                    <div className="py-4">
                                        <h3 className="font-medium mb-4 flex items-center gap-2">
                                            <Loader2 className="w-4 h-4 animate-spin text-blue-400" />
                                            Deploying your media stack...
                                        </h3>
                                        <div className="space-y-3">
                                            {deploySteps.map((s, i) => (
                                                <motion.div
                                                    key={i}
                                                    initial={{ opacity: 0, x: -10 }}
                                                    animate={{ opacity: 1, x: 0 }}
                                                    className="flex items-center gap-3 text-sm"
                                                >
                                                    {s.status === 'done' && <CheckCircle2 className="w-5 h-5 text-green-500" />}
                                                    {s.status === 'running' && <Loader2 className="w-5 h-5 animate-spin text-blue-400" />}
                                                    {s.status === 'error' && <AlertCircle className="w-5 h-5 text-red-500" />}
                                                    <span className={s.status === 'error' ? 'text-red-400' : s.status === 'done' ? 'text-green-400' : 'text-foreground'}>
                                                        {s.step}
                                                    </span>
                                                </motion.div>
                                            ))}
                                        </div>
                                        {deployError && (
                                            <div className="mt-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-sm text-red-400">
                                                {deployError}
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    /* Idle State - Deploy Form - Beginner Friendly */
                                    <>
                                        {/* Simple explanation */}
                                        <div className="space-y-4">
                                            <div className="p-4 bg-gradient-to-br from-emerald-500/10 to-cyan-500/10 border border-emerald-500/30 rounded-xl">
                                                <h3 className="font-semibold text-foreground mb-2">Ready to install?</h3>
                                                <p className="text-sm text-muted-foreground mb-3">
                                                    Click "Deploy Now" to start your media stack. This will:
                                                </p>
                                                <ul className="text-sm text-muted-foreground space-y-1.5 ml-4">
                                                    <li className="flex items-center gap-2">
                                                        <Check className="w-4 h-4 text-emerald-400" />
                                                        Save your configuration
                                                    </li>
                                                    <li className="flex items-center gap-2">
                                                        <Check className="w-4 h-4 text-emerald-400" />
                                                        Download and start all your apps
                                                    </li>
                                                    <li className="flex items-center gap-2">
                                                        <Check className="w-4 h-4 text-emerald-400" />
                                                        Takes 1-2 minutes depending on your internet
                                                    </li>
                                                </ul>
                                            </div>

                                            {/* Selected services summary */}
                                            <div className="p-3 bg-muted/40 rounded-lg">
                                                <div className="text-xs text-muted-foreground mb-2">Apps to install:</div>
                                                <div className="flex flex-wrap gap-1.5">
                                                    {selectedServices.map((s) => (
                                                        <span key={s} className="px-2 py-0.5 bg-primary/20 text-primary text-xs rounded">
                                                            {s}
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Requirement note */}
                                        <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg flex items-start gap-2">
                                            <AlertCircle className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" />
                                            <p className="text-sm text-blue-200/80">
                                                Make sure Docker Desktop is running on your computer before clicking Deploy.
                                            </p>
                                        </div>

                                        {deployStatus === 'error' && deployError && (
                                            <div className="space-y-3">
                                                <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-sm text-red-400">
                                                    {deployError}
                                                </div>
                                                <div className="p-3 bg-muted/40 border border-border rounded-lg">
                                                    <p className="text-sm text-muted-foreground mb-2">
                                                        Can't connect to the control server? Download your config files and deploy manually:
                                                    </p>
                                                    <button
                                                        onClick={() => downloadFile(generateEnvFile(), '.env')}
                                                        className="flex items-center gap-2 text-sm text-primary hover:text-primary/80 transition-colors"
                                                    >
                                                        <Download className="w-4 h-4" />
                                                        Download .env file
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>

                            <div className="p-6 border-t border-border flex justify-end gap-3">
                                <button
                                    onClick={() => {
                                        setShowDeployModal(false)
                                        setDeployStatus('idle')
                                        setDeploySteps([])
                                        setDeployError('')
                                    }}
                                    className="px-4 py-2 bg-muted/60 hover:bg-muted/80 rounded-lg text-foreground transition-colors"
                                >
                                    {deployStatus === 'success' ? 'Done' : 'Close'}
                                </button>
                                {deployStatus === 'idle' && (
                                    <button
                                        onClick={handleDeploy}
                                        className="px-4 py-2 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 rounded-lg text-white font-medium transition-colors flex items-center gap-2"
                                    >
                                        <Rocket className="w-4 h-4" />
                                        Deploy Now
                                    </button>
                                )}
                                {deployStatus === 'error' && (
                                    <button
                                        onClick={handleDeploy}
                                        className="px-4 py-2 bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 rounded-lg text-white font-medium transition-colors flex items-center gap-2"
                                    >
                                        <Rocket className="w-4 h-4" />
                                        Retry
                                    </button>
                                )}
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Post-Install Checklist */}
            <div className="mt-12 pt-8 border-t border-border">
                <PostInstallChecklist />
            </div>
        </motion.div>
    )
}
