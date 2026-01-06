import { useState } from 'react'
import { motion } from 'motion/react'
import { AlertCircle, Check, Copy, Download, Package, Globe, CheckCircle2, Rocket } from 'lucide-react'
import { PostInstallChecklist } from '../../PostInstallChecklist'
import { createDefaultStoragePlan, DEFAULT_DATA_ROOT, STORAGE_CATEGORIES } from '../../../data/storagePlan'
import { SetupConfig } from '../../../store/setupStore'
import { ConfigSummaryCard } from './review/ConfigSummaryCard'
import { StorageLayoutCard } from './review/StorageLayoutCard'
import { LocalAccessGuide } from './review/LocalAccessGuide'
import { LocalDeployModal } from './review/LocalDeployModal'
import { ValidationPanel } from '../../ValidationPanel'
import { useValidation } from '../../../hooks/useValidation'
import { hasBlockingErrors } from '../../../types/validation'
import type { ValidationRequest } from '../../../types/validation'

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

const isLoopbackHost = (host: string) => {
    const normalized = String(host || '').trim().toLowerCase()
    return normalized === 'localhost' || normalized === '127.0.0.1' || normalized === '::1'
}

const ACCESS_HOST_STORAGE_KEY = 'mediastack.accessHost'

const hostForUrl = (host: string) => {
    const trimmed = String(host || '').trim()
    if (!trimmed) return 'localhost'
    if (trimmed.includes(':') && !trimmed.startsWith('[') && !trimmed.endsWith(']')) return `[${trimmed}]`
    return trimmed
}

const buildLocalHttpUrl = (host: string, port: number, path = '') => {
    const normalizedPath = path ? (path.startsWith('/') ? path : `/${path}`) : ''
    return `http://${hostForUrl(host)}:${port}${normalizedPath}`
}

type LocalAccessApp = {
    id: string
    label: string
    description: string
    port: number
    path?: string
    showWhenSelected: (selected: string[]) => boolean
    containerNames: string[]
}

const LOCAL_ACCESS_APPS: LocalAccessApp[] = [
    {
        id: 'homepage',
        label: 'Dashboard',
        description: 'Links to all your apps',
        port: 3000,
        showWhenSelected: () => true,
        containerNames: ['homepage'],
    },
    {
        id: 'plex',
        label: 'Plex',
        description: 'Stream your media',
        port: 32400,
        path: '/web',
        showWhenSelected: (s) => s.includes('plex'),
        containerNames: ['plex'],
    },
    {
        id: 'jellyfin',
        label: 'Jellyfin',
        description: 'Stream your media (free)',
        port: 8096,
        showWhenSelected: (s) => s.includes('jellyfin'),
        containerNames: ['jellyfin'],
    },
    {
        id: 'sonarr',
        label: 'Sonarr',
        description: 'TV show automation',
        port: 8989,
        showWhenSelected: (s) => s.includes('arr') || s.includes('sonarr'),
        containerNames: ['sonarr'],
    },
    {
        id: 'radarr',
        label: 'Radarr',
        description: 'Movie automation',
        port: 7878,
        showWhenSelected: (s) => s.includes('arr') || s.includes('radarr'),
        containerNames: ['radarr'],
    },
    {
        id: 'prowlarr',
        label: 'Prowlarr',
        description: 'Indexer management',
        port: 9696,
        showWhenSelected: (s) => s.includes('arr') || s.includes('prowlarr'),
        containerNames: ['prowlarr'],
    },
    {
        id: 'bazarr',
        label: 'Bazarr',
        description: 'Subtitle automation',
        port: 6767,
        showWhenSelected: (s) => s.includes('arr') || s.includes('bazarr'),
        containerNames: ['bazarr'],
    },
    {
        id: 'overseerr',
        label: 'Overseerr',
        description: 'Requests & discovery',
        port: 5055,
        showWhenSelected: (s) => s.includes('arr') || s.includes('overseerr'),
        containerNames: ['overseerr'],
    },
    {
        id: 'qbittorrent',
        label: 'qBittorrent',
        description: 'Download client',
        port: 8081,
        showWhenSelected: (s) => s.includes('torrent'),
        containerNames: ['qbittorrent'],
    },
    {
        id: 'tautulli',
        label: 'Tautulli',
        description: 'Plex statistics',
        port: 8181,
        showWhenSelected: (s) => s.includes('stats'),
        containerNames: ['tautulli'],
    },
    {
        id: 'grafana',
        label: 'Grafana',
        description: 'Logs & metrics',
        port: 3003,
        showWhenSelected: () => false,
        containerNames: ['grafana'],
    },
]

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

    // Validation hook for pre-deployment checks
    const validation = useValidation({
        autoValidate: false, // We'll trigger manually when step becomes active
    })

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

    const [accessHost, setAccessHost] = useState(() => {
        if (typeof window === 'undefined') return 'localhost'
        try {
            const stored = window.localStorage.getItem(ACCESS_HOST_STORAGE_KEY)
            if (stored && stored.trim()) return stored.trim()
        } catch {
            // ignore storage failures
        }
        return window.location.hostname || 'localhost'
    })
    const [lanIpv4, setLanIpv4] = useState<string | null>(null)
    const hasAccessHostOverride = useRef(false)

    const handleDeploy = async () => {
        // Block deployment if there are blocking validation errors
        if (validation.result && hasBlockingErrors(validation.result)) {
            setDeployError('Cannot deploy: Please fix the validation errors above before proceeding.')
            return
        }

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

    // Auto-validate configuration when step becomes active
    useEffect(() => {
        // Build validation request from current config
        const validationRequest: ValidationRequest = {
            config: {
                dataRoot: config.storagePlan?.dataRoot?.path || DEFAULT_DATA_ROOT,
                configRoot: config.storagePlan?.config?.path || '/opt/mediastack/config',
                domain: config.domain,
                cloudflareToken: config.cloudflareToken,
                wireguardPrivateKey: config.wireguardPrivateKey,
                wireguardAddresses: config.wireguardAddresses,
                selectedServices,
                deploymentMode: config.deploymentMode,
            },
            validators: ['docker', 'path'], // Start with essential validators
        }

        // Add port validation if we have services selected
        if (selectedServices.length > 0) {
            validationRequest.validators?.push('port')
        }

        // Add VPN validation if VPN/torrent is selected
        if (selectedServices.includes('vpn') || selectedServices.includes('torrent')) {
            validationRequest.validators?.push('vpn')
            validationRequest.validatorConfigs = {
                ...validationRequest.validatorConfigs,
                vpn: {
                    provider: 'custom', // Assuming custom WireGuard config
                    type: 'wireguard',
                    credentials: {
                        privateKey: config.wireguardPrivateKey,
                        addresses: config.wireguardAddresses,
                    },
                },
            }
        }

        // Add Cloudflare validation for cloud mode
        if (config.deploymentMode === 'cloud' && config.cloudflareToken) {
            validationRequest.validators?.push('cloudflare')
            validationRequest.validatorConfigs = {
                ...validationRequest.validatorConfigs,
                cloudflare: {
                    tunnelToken: config.cloudflareToken,
                    testConnectivity: false, // Don't test connectivity by default
                },
            }
        }

        // Trigger validation
        validation.validate(validationRequest).catch(() => {
            // Error is already handled by the hook and displayed in the ValidationPanel
        })
    }, []) // Run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps

    useEffect(() => {
        if (!isLocalMode) return
        if (typeof window === 'undefined') return

        try {
            const stored = window.localStorage.getItem(ACCESS_HOST_STORAGE_KEY)
            hasAccessHostOverride.current = Boolean(stored && stored.trim())
        } catch {
            hasAccessHostOverride.current = false
        }

        const host = window.location.hostname || 'localhost'
        if (!isLoopbackHost(host)) {
            if (!hasAccessHostOverride.current) setAccessHost(host)
            return
        }

        let cancelled = false
        void (async () => {
            try {
                const info = await controlServer.getNetworkInfo()
                if (cancelled) return

                if (info?.success && info.lanIpv4) {
                    setLanIpv4(info.lanIpv4)
                    if (!hasAccessHostOverride.current) setAccessHost(info.lanIpv4)
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

    const updateAccessHost = (nextHost: string) => {
        const normalized = String(nextHost || '').trim()
        setAccessHost(normalized || 'localhost')
        if (typeof window === 'undefined') return
        try {
            if (!normalized) window.localStorage.removeItem(ACCESS_HOST_STORAGE_KEY)
            else window.localStorage.setItem(ACCESS_HOST_STORAGE_KEY, normalized)
            hasAccessHostOverride.current = Boolean(normalized)
        } catch {
            // ignore storage failures
        }
    }

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

            {/* Pre-deployment Validation */}
            <div className="space-y-3">
                <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-foreground/80">Pre-Deployment Validation</h3>
                    {validation.lastValidatedAt && (
                        <span className="text-xs text-muted-foreground">
                            Last checked: {new Date(validation.lastValidatedAt).toLocaleTimeString()}
                        </span>
                    )}
                </div>
                <ValidationPanel
                    result={validation.result}
                    isValidating={validation.isValidating}
                    error={validation.error}
                    onRefresh={validation.refresh}
                    showRefreshButton={true}
                    compact={false}
                />
            </div>

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

            {/* Deployment Blocking Error */}
            {validation.result && hasBlockingErrors(validation.result) && (
                <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-red-400 mt-0.5" />
                    <div>
                        <h3 className="text-sm font-semibold text-red-300">Deployment Blocked</h3>
                        <p className="text-sm text-red-200/70 mt-1">
                            Please fix the validation errors above before deploying. You can still download your configuration files.
                        </p>
                    </div>
                </div>
            )}

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
                        onClick={() => {
                            // Block if validation has blocking errors
                            if (validation.result && hasBlockingErrors(validation.result)) {
                                setDeployError('Cannot deploy: Please fix the validation errors above before proceeding.')
                                return
                            }
                            setShowDeployModal(true)
                        }}
                        disabled={validation.result ? hasBlockingErrors(validation.result) : false}
                        className={`flex-1 flex items-center justify-center gap-2 px-6 py-4 rounded-xl font-semibold shadow-lg transition-all btn-lift ${
                            validation.result && hasBlockingErrors(validation.result)
                                ? 'bg-gray-500 cursor-not-allowed opacity-60'
                                : 'bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white shadow-blue-500/20'
                        }`}
                        title={
                            validation.result && hasBlockingErrors(validation.result)
                                ? 'Fix validation errors before deploying'
                                : 'Deploy your media stack locally'
                        }
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
            <LocalDeployModal
                isOpen={showDeployModal}
                onClose={() => setShowDeployModal(false)}
                selectedServices={selectedServices}
                generateEnvFile={generateEnvFile}
                downloadFile={downloadFile}
                copyToClipboard={copyToClipboard}
            />

            {/* Post-Install Checklist */}
            <div className="mt-12 pt-8 border-t border-border">
                <PostInstallChecklist />
            </div>
        </motion.div>
    )
}
