import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { AlertCircle, Check, Copy, Download, Package, Globe, CheckCircle2, Rocket, Home, ExternalLink, Key, Loader2 } from 'lucide-react'
import { PostInstallChecklist } from '../../PostInstallChecklist'
import { controlServer } from '../../../utils/controlServer'
import { createDefaultStoragePlan, DEFAULT_DATA_ROOT, STORAGE_CATEGORIES } from '../../../data/storagePlan'
import { SetupConfig } from '../../../store/setupStore'

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
    const [bootstrapProgress, setBootstrapProgress] = useState<{ ready: number; running: number; total: number }>({ ready: 0, running: 0, total: 0 })
    const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)

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

    const handleBootstrapKeys = async () => {
        setBootstrapStatus('loading')
        setBootstrapProgress({ ready: 0, running: 0, total: 0 })
        setBootstrapMessage('Checking *arr services...')

        // Start polling for status updates
        const pollStatus = async () => {
            try {
                const status = await controlServer.getArrStatus()
                if (status.success && status.services) {
                    const running = status.services.filter(s => s.running).length
                    const ready = status.services.filter(s => s.ready).length
                    setBootstrapProgress({ ready, running, total: status.services.length })
                    setBootstrapMessage(`Services ready: ${ready}/${running} running (${status.services.length} total)`)
                }
            } catch {
                // Ignore polling errors, the main request will handle failure
            }
        }

        // Initial poll
        await pollStatus()

        // Continue polling every 3 seconds
        pollingRef.current = setInterval(pollStatus, 3000)

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
                const readyCount = result.services?.filter(s => s.ready).length || 0
                setBootstrapProgress({ ready: readyCount, running: readyCount, total: result.services?.length || 0 })
                setBootstrapMessage(`Successfully extracted ${Object.keys(result.keys).length} API keys and wrote to .env`)
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

    // Generate hosts file entry for local deployment
    const serverIP = '127.0.0.1' // User should replace with their server IP
    const localDomains = ['home.local', 'plex.local', 'sonarr.local', 'radarr.local', 'prowlarr.local', 'bazarr.local', 'overseerr.local', 'qbit.local', 'tautulli.local', 'notifiarr.local', 'traefik.local', 'jellyfin.local']
    const hostsEntry = `${serverIP} ${localDomains.join(' ')}`

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
                <p className="text-muted-foreground">Verify your settings and generate configuration files</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                <div className="p-4 rounded-xl bg-muted/40 border border-border">
                    <h3 className="text-sm font-semibold text-foreground/80 mb-4">Configuration Summary</h3>
                    <dl className="space-y-2 text-sm">
                        <div className="flex justify-between items-center">
                            <dt className="text-muted-foreground">Deployment</dt>
                            <dd className={`flex items-center gap-1.5 font-medium ${config.deploymentMode === 'local' ? 'text-emerald-400' : 'text-blue-400'}`}>
                                {config.deploymentMode === 'local' ? (
                                    <><Home className="w-3.5 h-3.5" /> Local Network</>
                                ) : (
                                    <><Globe className="w-3.5 h-3.5" /> Cloud / Remote</>
                                )}
                            </dd>
                        </div>
                        <div className="flex justify-between">
                            <dt className="text-muted-foreground">Domain</dt>
                            <dd className="text-foreground font-mono">{config.domain}</dd>
                        </div>
                        <div className="flex justify-between">
                            <dt className="text-muted-foreground">Timezone</dt>
                            <dd className="text-foreground font-mono">{config.timezone}</dd>
                        </div>
                        <div className="flex justify-between">
                            <dt className="text-muted-foreground">Mode</dt>
                            <dd className="text-primary capitalize">{mode}</dd>
                        </div>
                        <div className="flex justify-between">
                            <dt className="text-muted-foreground">Services</dt>
                            <dd className="text-foreground">{selectedServices.length} selected</dd>
                        </div>
                    </dl>
                </div>

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

            <div className="p-4 rounded-xl bg-muted/40 border border-border">
                <h3 className="text-sm font-semibold text-foreground/80 mb-4">Storage Layout</h3>
                <div className="space-y-2 text-xs">
                    {storageEntries.map((entry) => (
                        <div key={entry.id} className="flex items-start justify-between gap-3">
                            <span className="text-muted-foreground">{entry.label}</span>
                            <div className="text-right">
                                <p className="font-mono text-foreground break-all">{entry.path}</p>
                                {entry.type === 'network' && (
                                    <span className="text-[10px] text-primary uppercase tracking-wide">Network share</span>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
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
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-blue-500/20 rounded-lg">
                                        <Rocket className="w-6 h-6 text-blue-400" />
                                    </div>
                                    <div>
                                        <h2 className="text-xl font-bold text-foreground">Run Local Install</h2>
                                        <p className="text-sm text-muted-foreground">Deploy your media stack to this machine</p>
                                    </div>
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
                                                            <div className="mt-2 space-y-1 font-mono">
                                                                {Object.entries(bootstrapKeys).map(([key, value]) => (
                                                                    <div key={key} className="flex gap-1">
                                                                        <span className="text-green-400">{key}:</span>
                                                                        <span className="text-muted-foreground">{value.slice(0, 6)}...{value.slice(-4)}</span>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        {/* Access URLs */}
                                        <div className="space-y-2">
                                            <div className="text-sm font-medium text-foreground">Access Your Services</div>
                                            <div className="grid grid-cols-2 gap-2 text-sm">
                                                <a href="http://home.local" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 p-2 bg-muted/40 rounded-lg hover:bg-muted/60 transition-colors">
                                                    <Home className="w-4 h-4 text-primary" />
                                                    <span>home.local</span>
                                                    <ExternalLink className="w-3 h-3 ml-auto text-muted-foreground" />
                                                </a>
                                                {selectedServices.includes('plex') && (
                                                    <a href="http://plex.local" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 p-2 bg-muted/40 rounded-lg hover:bg-muted/60 transition-colors">
                                                        <span>plex.local</span>
                                                        <ExternalLink className="w-3 h-3 ml-auto text-muted-foreground" />
                                                    </a>
                                                )}
                                                {selectedServices.includes('arr') && (
                                                    <a href="http://sonarr.local" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 p-2 bg-muted/40 rounded-lg hover:bg-muted/60 transition-colors">
                                                        <span>sonarr.local</span>
                                                        <ExternalLink className="w-3 h-3 ml-auto text-muted-foreground" />
                                                    </a>
                                                )}
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
                                    /* Idle State - Deploy Form */
                                    <>
                                        {/* Step 1: Hosts File */}
                                        <div className="space-y-3">
                                            <div className="flex items-center gap-2">
                                                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-500 text-white text-xs font-bold">1</span>
                                                <h3 className="font-semibold text-foreground">Add to /etc/hosts (optional)</h3>
                                            </div>
                                            <p className="text-sm text-muted-foreground ml-8">
                                                Add this line to access services via .local domains:
                                            </p>
                                            <div className="ml-8 relative">
                                                <pre className="p-3 bg-muted/60 rounded-lg text-xs font-mono text-foreground overflow-x-auto">
                                                    {hostsEntry}
                                                </pre>
                                                <button
                                                    onClick={() => copyToClipboard(hostsEntry)}
                                                    className="absolute top-2 right-2 p-1.5 hover:bg-muted rounded-lg transition-colors"
                                                    title="Copy"
                                                >
                                                    <Copy className="w-4 h-4 text-muted-foreground" />
                                                </button>
                                            </div>
                                        </div>

                                        {/* Step 2: Deploy */}
                                        <div className="space-y-3">
                                            <div className="flex items-center gap-2">
                                                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-green-500 text-white text-xs font-bold">2</span>
                                                <h3 className="font-semibold text-foreground">Deploy</h3>
                                            </div>
                                            <p className="text-sm text-muted-foreground ml-8">
                                                Click below to write your configuration and start all containers:
                                            </p>
                                            <div className="ml-8">
                                                <div className="p-3 bg-muted/40 rounded-lg text-xs text-muted-foreground mb-3">
                                                    <div>Services: <span className="text-foreground">{selectedServices.join(', ')}</span></div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Note */}
                                        <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                                            <p className="text-sm text-amber-200/80">
                                                <strong>Note:</strong> This will write your .env file and run <code className="bg-muted px-1 rounded">docker compose up -d</code>. Ensure Docker is running.
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
