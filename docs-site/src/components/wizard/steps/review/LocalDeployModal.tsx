import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { AlertCircle, Check, Download, CheckCircle2, Rocket, Loader2, X } from 'lucide-react'
import { controlServer } from '../../../../utils/controlServer'
import { buildLocalHttpUrl, isLoopbackHost, LOCAL_ACCESS_APPS } from './LocalAccessGuide'
import { BootstrapKeysPanel } from './BootstrapKeysPanel'

interface LocalDeployModalProps {
    isOpen: boolean
    onClose: () => void
    selectedServices: string[]
    generateEnvFile: () => string
    downloadFile: (content: string, filename: string) => void
    copyToClipboard: (text: string) => void
}

/**
 * Modal for local deployment of the media stack.
 * Handles deployment to local Docker, displays progress, and provides API key extraction.
 * Shows idle, deploying, and success states with container status and access URLs.
 */
export function LocalDeployModal({
    isOpen,
    onClose,
    selectedServices,
    generateEnvFile,
    downloadFile,
    copyToClipboard
}: LocalDeployModalProps) {
    // Deploy state
    const [deployStatus, setDeployStatus] = useState<'idle' | 'deploying' | 'success' | 'error'>('idle')
    const [deploySteps, setDeploySteps] = useState<Array<{ step: string; status: 'done' | 'error' | 'running' }>>([])
    const [deployError, setDeployError] = useState('')
    const [deployContainers, setDeployContainers] = useState<Array<{ name: string; on: boolean }>>([])

    // Access host state for deploy modal success URLs
    const [accessHost, setAccessHost] = useState(() => {
        if (typeof window === 'undefined') return 'localhost'
        return window.location.hostname || 'localhost'
    })
    const [lanIpv4, setLanIpv4] = useState<string | null>(null)

    // Fetch LAN IP for deploy modal
    useEffect(() => {
        if (!isOpen) return
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
    }, [isOpen])

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

    const handleClose = () => {
        onClose()
        // Reset state when closing
        setTimeout(() => {
            setDeployStatus('idle')
            setDeploySteps([])
            setDeployError('')
        }, 300)
    }

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
                    onClick={handleClose}
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
                                    onClick={handleClose}
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
                                        <BootstrapKeysPanel copyToClipboard={copyToClipboard} />
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
                                onClick={handleClose}
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
    )
}
