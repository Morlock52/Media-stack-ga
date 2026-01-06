import { useEffect, useRef, useState } from 'react'
import { motion } from 'motion/react'
import {
    X, Server, Key, Lock, CheckCircle, AlertCircle,
    Loader2, Upload, Rocket, Eye, EyeOff, KeyRound, Monitor, Globe
} from 'lucide-react'
import { toast } from 'sonner'
import { buildControlServerUrl, controlServer, controlServerAuthHeaders, getControlServerBaseUrl } from '../utils/controlServer'
import dockerComposeTemplate from '../../../docker-compose.yml?raw'
import { useSetupStore } from '../store/setupStore'
import { generateEnvFile } from '../utils/generateEnvFile'
import { downloadAsFile } from '../utils/configManager'
import { getErrorMessage, log } from '../utils/logging'
import { Button } from './ui/button'
import { Dialog, DialogContent, DialogTitle, DialogDescription } from './ui/dialog'

interface DeployStep {
    step: string
    status: 'running' | 'done' | 'error' | 'pending'
}

type RemoteContainerStatus = {
    name: string
    on: boolean
}

type RemoteDeployPrefs = {
    host: string
    port: string
    username: string
    authType: 'password' | 'key'
    deployPath: string
    autoRemoveConflictingContainers: boolean
    autoDisableVpnOnTunMissing: boolean
}

interface RemoteDeployModalProps {
    isOpen: boolean
    onClose: () => void
}

const fetchWithTimeout = async (
    input: RequestInfo | URL,
    init: (RequestInit & { timeoutMs?: number }) = {}
) => {
    const { timeoutMs = 30_000, ...rest } = init
    const controller = new AbortController()
    const timeout = window.setTimeout(() => controller.abort(), timeoutMs)
    try {
        return await fetch(input, { ...rest, signal: controller.signal })
    } catch (err: any) {
        if (err?.name === 'AbortError') {
            throw new Error(
                `Request timed out after ${Math.round(timeoutMs / 1000)}s. ` +
                    'Ensure the control server is running and reachable (default: http://127.0.0.1:3001).'
            )
        }
        throw err
    } finally {
        window.clearTimeout(timeout)
    }
}

const tryParseJson = (text: string) => {
    if (!text?.trim()) return null
    try {
        return JSON.parse(text)
    } catch {
        return null
    }
}

export function RemoteDeployModal({ isOpen, onClose }: RemoteDeployModalProps) {
    const { config, selectedServices } = useSetupStore()
    const didHydratePrefsRef = useRef(false)
    const [deployMode, setDeployMode] = useState<'local' | 'remote'>('remote')
    const [host, setHost] = useState('')
    const [port, setPort] = useState('22')
    const [username, setUsername] = useState('')
    const [authType, setAuthType] = useState<'password' | 'key'>('password')
    const [password, setPassword] = useState('')
    const [privateKey, setPrivateKey] = useState('')
    const [deployPath, setDeployPath] = useState('~/media-stack')
    const [showPassword, setShowPassword] = useState(false)
    
    const [status, setStatus] = useState<'idle' | 'testing' | 'deploying' | 'success' | 'error'>('idle')
    const [steps, setSteps] = useState<DeployStep[]>([])
    const [error, setError] = useState('')
    const [serverReady, setServerReady] = useState<boolean | null>(null)
    const [deployLocked, setDeployLocked] = useState(false)
    const [autoRemoveConflictingContainers, setAutoRemoveConflictingContainers] = useState(true)
    const [autoDisableVpnOnTunMissing, setAutoDisableVpnOnTunMissing] = useState(true)
    const [remoteContainers, setRemoteContainers] = useState<RemoteContainerStatus[]>([])

    // Bootstrap state
    const [bootstrapStatus, setBootstrapStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
    const [bootstrapMessage, setBootstrapMessage] = useState('')
    const [bootstrapKeys, setBootstrapKeys] = useState<Record<string, string>>({})

    useEffect(() => {
        if (!isOpen) return
        if (didHydratePrefsRef.current) return
        didHydratePrefsRef.current = true

        try {
            const raw = localStorage.getItem('remote-deploy-prefs')
            if (!raw) return
            const parsed = JSON.parse(raw) as Partial<RemoteDeployPrefs>

            if (typeof parsed.host === 'string') setHost(parsed.host)
            if (typeof parsed.port === 'string') setPort(parsed.port)
            if (typeof parsed.username === 'string') setUsername(parsed.username)
            if (parsed.authType === 'password' || parsed.authType === 'key') setAuthType(parsed.authType)
            if (typeof parsed.deployPath === 'string') setDeployPath(parsed.deployPath)

            if (typeof parsed.autoRemoveConflictingContainers === 'boolean') {
                setAutoRemoveConflictingContainers(parsed.autoRemoveConflictingContainers)
            }
            if (typeof parsed.autoDisableVpnOnTunMissing === 'boolean') {
                setAutoDisableVpnOnTunMissing(parsed.autoDisableVpnOnTunMissing)
            }
        } catch {
            // ignore invalid local storage
        }
    }, [isOpen])

    useEffect(() => {
        if (!didHydratePrefsRef.current) return
        try {
            const prefs: RemoteDeployPrefs = {
                host,
                port,
                username,
                authType,
                deployPath,
                autoRemoveConflictingContainers,
                autoDisableVpnOnTunMissing,
            }
            localStorage.setItem('remote-deploy-prefs', JSON.stringify(prefs))
        } catch {
            // ignore storage failures
        }
    }, [
        host,
        port,
        username,
        authType,
        deployPath,
        autoRemoveConflictingContainers,
        autoDisableVpnOnTunMissing,
    ])

    const resetForm = () => {
        setStatus('idle')
        setSteps([])
        setError('')
        setServerReady(null)
        setDeployLocked(false)
        setAutoRemoveConflictingContainers(true)
        setAutoDisableVpnOnTunMissing(true)
        setRemoteContainers([])
        setBootstrapStatus('idle')
        setBootstrapMessage('')
        setBootstrapKeys({})
    }

    const handleBootstrapKeys = async () => {
        setBootstrapStatus('loading')
        setBootstrapMessage('Waiting for *arr services to initialize...')

        try {
            const result = await controlServer.autoBootstrapArrRemote({
                host,
                port,
                username,
                authType,
                password: authType === 'password' ? password : undefined,
                privateKey: authType === 'key' ? privateKey : undefined,
                envPath: deployPath ? `${deployPath}/.env` : undefined,
                timeout: 120000,
                pollInterval: 5000,
            })

            if (result.success) {
                setBootstrapStatus('success')
                setBootstrapKeys(result.keys)
                setBootstrapMessage(`Successfully extracted ${Object.keys(result.keys).length} API keys and wrote to remote .env`)
                toast.success('API keys bootstrapped!', {
                    description: `${Object.keys(result.keys).length} keys written to ${host}`
                })
            } else {
                setBootstrapStatus('error')
                setBootstrapMessage(result.error || `Failed at step: ${result.step}`)
                toast.error('Bootstrap failed', { description: result.error })
            }
        } catch (err) {
            setBootstrapStatus('error')
            const msg = err instanceof Error ? err.message : 'Failed to bootstrap API keys'
            setBootstrapMessage(msg)
            toast.error('Bootstrap failed', { description: msg })
        }
    }

    const testConnection = async () => {
        setStatus('testing')
        setError('')

        try {
            const res = await fetchWithTimeout(buildControlServerUrl('/api/remote-deploy/test'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...controlServerAuthHeaders() },
                body: JSON.stringify({
                    host,
                    port,
                    username,
                    authType,
                    password: authType === 'password' ? password : undefined,
                    privateKey: authType === 'key' ? privateKey : undefined
                }),
                timeoutMs: 20_000,
            })

            const text = await res.text().catch(() => '')

            if (!res.ok) {
                const parsed = tryParseJson(text)
                const payloadError = typeof parsed?.error === 'string' ? parsed.error : ''
                const statusHint =
                    res.status === 401
                        ? ' (Control server token required; set it in the UI settings or VITE_CONTROL_SERVER_TOKEN.)'
                        : ''
                const errorMsg = payloadError
                    ? `${payloadError}${statusHint}`
                    : `HTTP ${res.status}: ${res.statusText}${text.trim() ? ` — ${text.trim().slice(0, 200)}${text.trim().length > 200 ? '…' : ''}` : ''}${statusHint}`
                setError(errorMsg)
                setStatus('error')
                toast.error('Connection failed', { description: errorMsg })
                return
            }
            
            if (!text.trim()) {
                throw new Error('Empty response from server')
            }

            let data
            try {
                data = JSON.parse(text)
            } catch {
                console.error('Failed to parse JSON response:', text)
                throw new Error(`Invalid JSON response from server: ${text.slice(0, 200)}`)
            }

            if (data.success) {
                const deployReady = Boolean(data.docker) && Boolean(data.dockerCompose)
                setServerReady(deployReady)
                setStatus('idle')
                if (deployReady) {
                    toast.success('Connection successful! Ready to deploy.', {
                        description: `Connected to ${host} as ${username}`
                    })
                } else if (!data.docker) {
                    toast.warning('Connected, but Docker is not ready', {
                        description: data.message || 'Ensure Docker is installed and the daemon is accessible (permissions/service).'
                    })
                } else {
                    toast.warning('Connected, but Docker Compose not found', {
                        description: data.message || 'Install Docker Compose on the remote server before deploying.'
                    })
                }
            } else {
                setError(data.error)
                setStatus('error')
                toast.error('Connection failed', {
                    description: data.error
                })
            }
        } catch (err) {
            log('error', 'RemoteDeployModal: test connection failed', err)
            const baseHint = getControlServerBaseUrl()
                ? ''
                : ' (Tip: start the control server on :3001, proxy /api, or set VITE_CONTROL_SERVER_URL and rebuild.)'
            const errorMsg = `${getErrorMessage(err)}${baseHint}`
            setError(errorMsg)
            setStatus('error')
            toast.error('Connection failed', { description: errorMsg })
        }
    }

    const deploy = async () => {
        // Handle local deployment - just download files
        if (deployMode === 'local') {
            setStatus('deploying')
            setSteps([
                { step: 'Generating configuration files...', status: 'running' }
            ])
            toast.loading('Generating files...', { id: 'deploy' })

            try {
                // Small delay for UX
                await new Promise(r => setTimeout(r, 500))

                // Generate and download files
                const envContent = generateEnvFile(config, selectedServices)
                downloadAsFile(envContent, '.env')

                setSteps(prev => [
                    { ...prev[0], status: 'done' },
                    { step: 'Downloading .env file...', status: 'done' }
                ])

                await new Promise(r => setTimeout(r, 300))
                downloadAsFile(dockerComposeTemplate, 'docker-compose.yml')

                setSteps(prev => [
                    ...prev,
                    { step: 'Downloading docker-compose.yml...', status: 'done' }
                ])

                await new Promise(r => setTimeout(r, 300))
                setStatus('success')
                toast.success('Files generated!', {
                    id: 'deploy',
                    description: `Place files in ${deployPath} and run: docker compose up -d`
                })
            } catch (err) {
                log('error', 'RemoteDeployModal: local deploy failed', err)
                setError(getErrorMessage(err))
                setStatus('error')
                toast.error('Failed to generate files', { id: 'deploy' })
            }
            return
        }

        // Remote deployment via SSH
        setStatus('deploying')
        setError('')
        setDeployLocked(false)
        setRemoteContainers([])
        setSteps([{ step: 'Contacting control server...', status: 'running' }])

        toast.loading('Starting deployment...', { id: 'deploy' })

        try {
            const res = await fetchWithTimeout(buildControlServerUrl('/api/remote-deploy'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...controlServerAuthHeaders() },
                body: JSON.stringify({
                    host,
                    port,
                    username,
                    authType,
                    deployPath,
                    autoRemoveConflictingContainers,
                    autoDisableVpnOnTunMissing,
                    password: authType === 'password' ? password : undefined,
                    privateKey: authType === 'key' ? privateKey : undefined,
                    composeYml: dockerComposeTemplate,
                    envFile: generateEnvFile(config, selectedServices),
                }),
                timeoutMs: 120_000,
            })

            const text = await res.text().catch(() => '')

            if (!res.ok) {
                const parsed = tryParseJson(text)
                const payloadSteps = Array.isArray(parsed?.steps) ? parsed.steps : null
                const payloadError = typeof parsed?.error === 'string' ? parsed.error : ''
                const payloadContainers = Array.isArray(parsed?.remoteContainers) ? parsed.remoteContainers : null

                const statusHint =
                    res.status === 401
                        ? ' (Control server token required; set it in the UI settings or VITE_CONTROL_SERVER_TOKEN.)'
                        : ''

                const errorMsg = payloadError
                    ? `${payloadError}${statusHint}`
                    : `HTTP ${res.status}: ${res.statusText}${text.trim() ? ` — ${text.trim().slice(0, 200)}${text.trim().length > 200 ? '…' : ''}` : ''}${statusHint}`

                if (payloadSteps?.length) setSteps(payloadSteps)
                if (payloadContainers?.length) setRemoteContainers(payloadContainers)
                setError(errorMsg)
                setStatus('error')
                if (res.status === 409) {
                    setDeployLocked(true)
                    toast.warning('Deployment already in progress', {
                        id: 'deploy',
                        description: errorMsg,
                    })
                } else {
                    toast.error('Deployment failed', { id: 'deploy', description: errorMsg })
                }
                return
            }
            
            if (!text.trim()) {
                throw new Error('Empty response from server')
            }

            let data
            try {
                data = JSON.parse(text)
            } catch {
                console.error('Failed to parse JSON response:', text)
                throw new Error(`Invalid JSON response from server: ${text.slice(0, 200)}`)
            }
            setSteps(data.steps?.length ? data.steps : [{ step: 'Deploy request accepted.', status: 'done' }])
            setRemoteContainers(Array.isArray(data.remoteContainers) ? data.remoteContainers : [])

            if (data.success) {
                setStatus('success')
                toast.success('Deployment successful!', {
                    id: 'deploy',
                    description: `Your media stack is now running on ${host}`
                })
            } else {
                setError(data.error)
                setStatus('error')
                toast.error('Deployment failed', {
                    id: 'deploy',
                    description: data.error
                })
            }
        } catch (err) {
            log('error', 'RemoteDeployModal: deploy request failed', err)
            setSteps([{ step: 'Deployment failed.', status: 'error' }])
            const baseHint = getControlServerBaseUrl()
                ? ''
                : ' (Tip: start the control server on :3001, proxy /api, or set VITE_CONTROL_SERVER_URL and rebuild.)'
            const errorMsg = `${getErrorMessage(err)}${baseHint}`
            setError(errorMsg)
            setStatus('error')
            toast.error('Deployment failed', { id: 'deploy', description: errorMsg })
        }
    }

    const isFormValid = deployMode === 'local'
        ? deployPath.trim() !== ''
        : host && username && (authType === 'password' ? password : privateKey)

    return (
        <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose() }}>
            <DialogContent
                showClose={false}
                className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden p-0 max-h-[90vh] flex flex-col"
            >
                <DialogTitle className="sr-only">Deploy to Server</DialogTitle>
                <DialogDescription className="sr-only">
                    Configure SSH connection and deploy your media stack to a remote server
                </DialogDescription>
                <motion.div initial={{ scale: 0.98, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="flex flex-col flex-1">
                    {/* Header */}
                    <div className="flex items-center justify-between p-3 sm:p-4 border-b border-border">
                        <div className="flex items-center gap-2 min-w-0">
                            <Server className="w-5 h-5 text-primary flex-shrink-0" />
                            <h2 className="text-base sm:text-lg font-semibold break-words">Deploy to Server</h2>
                        </div>
                        <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={onClose}
                            title="Close"
                            aria-label="Close modal"
                            className="touch-target-44 -m-2 p-2"
                        >
                            <X className="w-5 h-5 flex-shrink-0" />
                        </Button>
                    </div>

                    {/* Content */}
                    <div className="p-3 sm:p-4 space-y-3 sm:space-y-4 overflow-y-auto flex-1">
                        {status === 'success' ? (
                            <motion.div
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                className="text-center py-6 sm:py-8"
                            >
                                <motion.div
                                    initial={{ scale: 0 }}
                                    animate={{ scale: 1 }}
                                    transition={{ type: "spring", stiffness: 200, delay: 0.1 }}
                                    className="mb-3 sm:mb-4"
                                >
                                    <CheckCircle className="w-16 h-16 sm:w-20 sm:h-20 text-green-500 mx-auto drop-shadow-lg flex-shrink-0" />
                                </motion.div>
                                <motion.h3
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.2 }}
                                    className="text-lg sm:text-xl font-bold text-green-400 mb-2 break-words px-2"
                                >
                                    Deployment Successful!
                                </motion.h3>
                                <motion.p
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.3 }}
                                    className="text-xs sm:text-sm text-muted-foreground break-words px-2"
                                >
                                    Your media stack is now running on{' '}
                                    <span className="font-semibold text-white bg-white/10 px-2 py-0.5 rounded break-all">{host}</span>
                                </motion.p>

                                {remoteContainers.length > 0 && (
                                    <div className="mt-4 sm:mt-6 text-left bg-background/40 border border-border rounded-lg p-2 sm:p-3">
                                        <div className="text-xs text-muted-foreground mb-2">Remote containers</div>
                                        <div className="max-h-40 overflow-y-auto space-y-1">
                                            {remoteContainers.map((c) => (
                                                <div key={c.name} className="flex items-center justify-between text-sm">
                                                    <span className="font-mono text-xs text-foreground truncate pr-3">{c.name}</span>
                                                    <span className={`text-xs ${c.on ? 'text-green-400' : 'text-muted-foreground'}`}>{c.on ? 'on' : 'off'}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Bootstrap API Keys Section */}
                                {selectedServices.includes('arr') && (
                                    <div className="mt-4 sm:mt-6 text-left bg-purple-500/10 border border-purple-500/30 rounded-lg p-3 sm:p-4">
                                        <div className="flex items-center gap-2 mb-2">
                                            <KeyRound className="w-4 h-4 text-purple-400 flex-shrink-0" />
                                            <span className="text-xs sm:text-sm font-medium text-purple-300 break-words">Bootstrap API Keys</span>
                                        </div>
                                        <p className="text-xs text-muted-foreground mb-3 break-words">
                                            Automatically extract *arr API keys and write to remote .env
                                        </p>
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            onClick={handleBootstrapKeys}
                                            disabled={bootstrapStatus === 'loading'}
                                            className="w-full border-purple-500/50 hover:bg-purple-500/20 touch-target-44 text-xs sm:text-sm"
                                        >
                                            {bootstrapStatus === 'loading' ? (
                                                <>
                                                    <Loader2 className="w-4 h-4 mr-2 animate-spin flex-shrink-0" />
                                                    <span className="break-words">Waiting for services...</span>
                                                </>
                                            ) : bootstrapStatus === 'success' ? (
                                                <>
                                                    <CheckCircle className="w-4 h-4 mr-2 text-green-400 flex-shrink-0" />
                                                    Keys Extracted
                                                </>
                                            ) : (
                                                <>
                                                    <Key className="w-4 h-4 mr-2 flex-shrink-0" />
                                                    Bootstrap Keys
                                                </>
                                            )}
                                        </Button>

                                        {bootstrapStatus !== 'idle' && (
                                            <div className={`mt-3 p-2 rounded text-xs break-words ${
                                                bootstrapStatus === 'loading' ? 'bg-blue-500/10 text-blue-300' :
                                                bootstrapStatus === 'success' ? 'bg-green-500/10 text-green-300' :
                                                'bg-red-500/10 text-red-300'
                                            }`}>
                                                {bootstrapMessage}
                                                {bootstrapStatus === 'success' && Object.keys(bootstrapKeys).length > 0 && (
                                                    <div className="mt-2 space-y-1 font-mono text-[10px] sm:text-xs">
                                                        {Object.entries(bootstrapKeys).map(([key, value]) => (
                                                            <div key={key} className="flex gap-1 break-all">
                                                                <span className="text-green-400 flex-shrink-0">{key}:</span>
                                                                <span className="text-muted-foreground break-all">{value.slice(0, 6)}...{value.slice(-4)}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                )}

                                <Button
                                    type="button"
                                    variant="gradient"
                                    className="mt-4 sm:mt-6 w-full touch-target-44"
                                    onClick={() => { resetForm(); onClose(); }}
                                >
                                    Done
                                </Button>
                            </motion.div>
                        ) : status === 'deploying' ? (
                            <div className="py-3 sm:py-4">
                                <h3 className="text-sm sm:text-base font-medium mb-3 sm:mb-4 flex items-center gap-2 break-words">
                                    <Loader2 className="w-4 h-4 animate-spin text-blue-400 flex-shrink-0" />
                                    <span className="break-words">Deploying to {host}...</span>
                                </h3>
                                <div className="space-y-2 sm:space-y-3 max-h-64 overflow-y-auto pr-1">
                                    {steps.map((s, i) => (
                                        <motion.div
                                            key={i}
                                            initial={{ opacity: 0, x: -10 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            transition={{ delay: i * 0.1 }}
                                            className="flex items-center gap-2 sm:gap-3 text-xs sm:text-sm"
                                        >
                                            <div className="flex-shrink-0">
                                                {s.status === 'done' && (
                                                    <motion.div
                                                        initial={{ scale: 0 }}
                                                        animate={{ scale: 1 }}
                                                        transition={{ type: "spring", stiffness: 200 }}
                                                    >
                                                        <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5 text-green-500" />
                                                    </motion.div>
                                                )}
                                                {s.status === 'running' && (
                                                    <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 animate-spin text-blue-400" />
                                                )}
                                                {s.status === 'error' && (
                                                    <motion.div
                                                        initial={{ scale: 0 }}
                                                        animate={{ scale: 1 }}
                                                        transition={{ type: "spring", stiffness: 200 }}
                                                    >
                                                        <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5 text-red-500" />
                                                    </motion.div>
                                                )}
                                            </div>
                                            <span className={`${s.status === 'error' ? 'text-red-400' : s.status === 'done' ? 'text-green-400' : 'text-foreground'} flex-1 break-words`}>
                                                {s.step}
                                            </span>
                                        </motion.div>
                                    ))}
                                </div>
                                {error && (
                                    <motion.div
                                        initial={{ opacity: 0, y: -10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        className="mt-3 sm:mt-4 text-xs sm:text-sm text-red-400 bg-red-500/10 border border-red-500/20 p-2 sm:p-3 rounded-lg whitespace-pre-wrap break-words"
                                    >
                                        {error}
                                    </motion.div>
                                )}

                                {remoteContainers.length > 0 && (
                                    <div className="mt-3 sm:mt-4 bg-background/40 border border-border rounded-lg p-2 sm:p-3">
                                        <div className="flex items-center justify-between mb-2">
                                            <div className="text-xs text-muted-foreground">Remote containers (snapshot)</div>
                                            <div className="text-xs text-muted-foreground flex-shrink-0">{remoteContainers.length}</div>
                                        </div>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 max-h-40 overflow-y-auto">
                                            {remoteContainers.map((c) => (
                                                <div key={c.name} className="flex items-center justify-between gap-2 sm:gap-3 text-xs bg-card/40 border border-border/60 rounded-md px-2 py-1">
                                                    <span className="font-mono truncate min-w-0">{c.name}</span>
                                                    <span className={`${c.on ? 'text-green-400' : 'text-muted-foreground'} flex-shrink-0`}>{c.on ? 'on' : 'off'}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <>
                                {/* Deploy Mode Toggle */}
                                <div className="flex flex-col sm:flex-row gap-2 mb-2">
                                    <Button
                                        type="button"
                                        variant={deployMode === 'local' ? 'default' : 'outline'}
                                        className="flex-1 gap-2 touch-target-44 text-xs sm:text-sm"
                                        onClick={() => setDeployMode('local')}
                                        aria-label="Local deployment"
                                    >
                                        <Monitor className="w-4 h-4 flex-shrink-0" /> Local
                                    </Button>
                                    <Button
                                        type="button"
                                        variant={deployMode === 'remote' ? 'default' : 'outline'}
                                        className="flex-1 gap-2 touch-target-44 text-xs sm:text-sm"
                                        onClick={() => setDeployMode('remote')}
                                        aria-label="Remote deployment via SSH"
                                    >
                                        <Globe className="w-4 h-4 flex-shrink-0" /> Remote (SSH)
                                    </Button>
                                </div>

                                {deployMode === 'remote' && (
                                    <>
                                        {/* Server Details */}
                                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                            <div className="sm:col-span-2">
                                                <label htmlFor="deploy-host" className="text-xs text-muted-foreground break-words">Host / IP</label>
                                                <input
                                                    id="deploy-host"
                                                    type="text"
                                                    value={host}
                                                    onChange={e => setHost(e.target.value)}
                                                    placeholder="192.168.1.100"
                                                    aria-label="Host or IP address"
                                                    className="w-full mt-1 px-3 py-2 h-11 bg-background border border-border rounded-lg text-base focus:outline-none focus:ring-1 focus:ring-primary"
                                                />
                                            </div>
                                            <div>
                                                <label className="text-xs text-muted-foreground break-words" htmlFor="port">Port</label>
                                                <input
                                                    type="text"
                                                    value={port}
                                                    onChange={e => setPort(e.target.value)}
                                                    placeholder="22"
                                                    className="w-full mt-1 px-3 py-2 h-11 bg-background border border-border rounded-lg text-base focus:outline-none focus:ring-1 focus:ring-primary"
                                                    id="port"
                                                    aria-label="Port"
                                                />
                                            </div>
                                        </div>

                                        <div>
                                            <label className="text-xs text-muted-foreground break-words" htmlFor="username">Username</label>
                                            <input
                                                type="text"
                                                value={username}
                                                onChange={e => setUsername(e.target.value)}
                                                placeholder="root"
                                                className="w-full mt-1 px-3 py-2 h-11 bg-background border border-border rounded-lg text-base focus:outline-none focus:ring-1 focus:ring-primary"
                                                id="username"
                                                aria-label="Username"
                                            />
                                        </div>

                                        {/* Auth Type Toggle */}
                                <div className="flex flex-col sm:flex-row gap-2">
                                    <Button
                                        type="button"
                                        variant={authType === 'password' ? 'default' : 'outline'}
                                        className="flex-1 gap-2 touch-target-44 text-xs sm:text-sm"
                                        onClick={() => setAuthType('password')}
                                        aria-label="Password authentication"
                                    >
                                        <Lock className="w-4 h-4 flex-shrink-0" /> Password
                                    </Button>
                                    <Button
                                        type="button"
                                        variant={authType === 'key' ? 'default' : 'outline'}
                                        className="flex-1 gap-2 touch-target-44 text-xs sm:text-sm"
                                        onClick={() => setAuthType('key')}
                                        aria-label="SSH key authentication"
                                    >
                                        <Key className="w-4 h-4 flex-shrink-0" /> SSH Key
                                    </Button>
                                </div>

                                {/* Auth Input */}
                                {authType === 'password' ? (
                                    <div className="relative">
                                        <label className="text-xs text-muted-foreground break-words" htmlFor="password">Password</label>
                                        <input
                                            type={showPassword ? 'text' : 'password'}
                                            value={password}
                                            onChange={e => setPassword(e.target.value)}
                                            placeholder="Enter password"
                                            className="w-full mt-1 px-3 py-2 pr-11 h-11 bg-background border border-border rounded-lg text-base focus:outline-none focus:ring-1 focus:ring-primary"
                                            id="password"
                                            aria-label="Password"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowPassword(!showPassword)}
                                            className="absolute right-1 top-8 text-muted-foreground hover:text-white touch-target-44 -m-2 p-2"
                                            aria-label="Toggle password visibility"
                                        >
                                            {showPassword ? <EyeOff className="w-4 h-4 flex-shrink-0" /> : <Eye className="w-4 h-4 flex-shrink-0" />}
                                        </button>
                                    </div>
                                ) : (
                                    <div>
                                        <label className="text-xs text-muted-foreground break-words" htmlFor="privateKey">Private Key (paste contents)</label>
                                        <textarea
                                            value={privateKey}
                                            onChange={e => setPrivateKey(e.target.value)}
                                            placeholder="-----BEGIN OPENSSH PRIVATE KEY-----"
                                            rows={3}
                                            className="w-full mt-1 px-3 py-2 min-h-[88px] bg-background border border-border rounded-lg text-xs sm:text-sm font-mono focus:outline-none focus:ring-1 focus:ring-primary resize-none"
                                            id="privateKey"
                                            aria-label="Private Key"
                                        />
                                        {/* SSH Key Generation Guidance */}
                                        <details className="mt-2 group">
                                            <summary className="text-xs text-primary cursor-pointer hover:underline flex items-center gap-1 touch-target-44 -m-2 p-2">
                                                <Key className="w-3 h-3 flex-shrink-0" />
                                                <span className="break-words">Don't have an SSH key? Generate one</span>
                                            </summary>
                                            <div className="mt-2 p-2 sm:p-3 bg-muted/30 border border-border rounded-lg text-xs space-y-2">
                                                <p className="text-muted-foreground break-words">
                                                    <strong className="text-foreground">1. Generate a secure Ed25519 key</strong> (recommended for 2025):
                                                </p>
                                                <code className="block bg-background/80 px-2 py-1.5 rounded font-mono text-[10px] sm:text-[11px] select-all break-all">
                                                    ssh-keygen -t ed25519 -C "media-stack-deploy"
                                                </code>
                                                <p className="text-muted-foreground break-words">
                                                    <strong className="text-foreground">2. Copy your public key to the server:</strong>
                                                </p>
                                                <code className="block bg-background/80 px-2 py-1.5 rounded font-mono text-[10px] sm:text-[11px] select-all break-all">
                                                    ssh-copy-id -i ~/.ssh/id_ed25519.pub {username || 'user'}@{host || 'server'}
                                                </code>
                                                <p className="text-muted-foreground break-words">
                                                    <strong className="text-foreground">3. View and copy your private key:</strong>
                                                </p>
                                                <code className="block bg-background/80 px-2 py-1.5 rounded font-mono text-[10px] sm:text-[11px] select-all break-all">
                                                    cat ~/.ssh/id_ed25519
                                                </code>
                                                <p className="text-muted-foreground mt-2 text-[10px] sm:text-[11px] break-words">
                                                    Paste the entire output (including BEGIN/END lines) in the field above.
                                                </p>
                                            </div>
                                        </details>
                                    </div>
                                )}
                                    </>
                                )}

                                {/* Local mode info */}
                                {deployMode === 'local' && (
                                    <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-2 sm:p-3">
                                        <p className="text-xs text-blue-300 break-words">
                                            <strong>Local deployment:</strong> Files will be saved to the path below.
                                            Run <code className="bg-blue-500/20 px-1 rounded break-all">docker compose up -d</code> from that directory to start your stack.
                                        </p>
                                    </div>
                                )}

                                {/* Deploy Path - shown for both local and remote */}
                                <div>
                                    <label className="text-xs text-muted-foreground break-words" htmlFor="deployPath">Deploy Path</label>
                                    <input
                                        type="text"
                                        value={deployPath}
                                        onChange={e => setDeployPath(e.target.value)}
                                        placeholder={deployMode === 'local' ? './media-stack' : '~/media-stack'}
                                        className="w-full mt-1 px-3 py-2 h-11 bg-background border border-border rounded-lg text-base focus:outline-none focus:ring-1 focus:ring-primary"
                                        id="deployPath"
                                        aria-label="Deploy Path"
                                    />
                                </div>

                                <label className="flex items-start gap-2 text-xs text-muted-foreground select-none cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={autoRemoveConflictingContainers}
                                        onChange={(e) => setAutoRemoveConflictingContainers(e.target.checked)}
                                        className="mt-0.5 w-4 h-4 flex-shrink-0 cursor-pointer"
                                        aria-label="Auto remove conflicting containers"
                                    />
                                    <span className="break-words">
                                        Auto-remove conflicting containers (recommended). If Docker reports a name conflict (e.g. existing <code className="text-[10px] sm:text-xs break-all">portainer</code>), the deploy will remove it and retry once.
                                    </span>
                                </label>

                                <label className="flex items-start gap-2 text-xs text-muted-foreground select-none cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={autoDisableVpnOnTunMissing}
                                        onChange={(e) => setAutoDisableVpnOnTunMissing(e.target.checked)}
                                        className="mt-0.5 w-4 h-4 flex-shrink-0 cursor-pointer"
                                        aria-label="Auto disable VPN profile if /dev/net/tun is missing"
                                    />
                                    <span className="break-words">
                                        Auto-disable VPN/torrent profiles if <code className="text-[10px] sm:text-xs break-all">/dev/net/tun</code> is missing (lets the rest of the stack update on hosts without TUN).
                                    </span>
                                </label>

                                {/* Connection Status */}
                                {serverReady !== null && (
                                    <div className={`flex items-center gap-2 text-xs sm:text-sm p-2 rounded-lg ${
                                        serverReady ? 'bg-green-500/10 text-green-400' : 'bg-yellow-500/10 text-yellow-400'
                                    }`}>
                                        {serverReady ? (
                                            <><CheckCircle className="w-4 h-4 flex-shrink-0" /> <span className="break-words">Server ready with Docker</span></>
                                        ) : (
                                            <><AlertCircle className="w-4 h-4 flex-shrink-0" /> <span className="break-words">Docker not found on server</span></>
                                        )}
                                    </div>
                                )}

                                {deployLocked && (
                                    <div className="text-xs sm:text-sm bg-yellow-500/10 border border-yellow-500/20 text-yellow-300 p-2 sm:p-3 rounded-lg">
                                        <div className="font-medium break-words">Deployment already in progress</div>
                                        <div className="text-xs text-yellow-200/80 mt-1 break-words">
                                            Another deploy request for this server is currently running. Wait for it to finish, then try again.
                                        </div>
                                    </div>
                                )}

                                {error && (
                                    <p
                                        className={`text-xs sm:text-sm p-2 rounded-lg whitespace-pre-wrap break-words ${deployLocked ? 'text-yellow-200 bg-yellow-500/10 border border-yellow-500/20' : 'text-red-400 bg-red-500/10'}`}
                                    >
                                        {error}
                                    </p>
                                )}

                                {remoteContainers.length > 0 && (
                                    <div className="bg-background/40 border border-border rounded-lg p-2 sm:p-3">
                                        <div className="text-xs text-muted-foreground mb-2">Remote containers (snapshot)</div>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 max-h-40 overflow-y-auto">
                                            {remoteContainers.map((c) => (
                                                <div key={c.name} className="flex items-center justify-between gap-2 sm:gap-3 text-xs bg-card/40 border border-border/60 rounded-md px-2 py-1">
                                                    <span className="font-mono truncate min-w-0">{c.name}</span>
                                                    <span className={`${c.on ? 'text-green-400' : 'text-muted-foreground'} flex-shrink-0`}>{c.on ? 'on' : 'off'}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </>
                        )}
                    </div>

                    {/* Footer Actions */}
                    {status !== 'success' && status !== 'deploying' && (
                        <div className="flex flex-col sm:flex-row gap-2 p-3 sm:p-4 border-t border-border bg-card/50">
                            {deployMode === 'remote' && (
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={testConnection}
                                    disabled={!isFormValid || status === 'testing'}
                                    className="flex-1 gap-2 touch-target-44 text-xs sm:text-sm"
                                >
                                    {status === 'testing' ? (
                                        <><Loader2 className="w-4 h-4 animate-spin flex-shrink-0" /> Testing...</>
                                    ) : (
                                        <><Upload className="w-4 h-4 flex-shrink-0" /> Test Connection</>
                                    )}
                                </Button>
                            )}
                            <Button
                                type="button"
                                onClick={deploy}
                                disabled={!isFormValid || status === 'testing'}
                                className="flex-1 gap-2 touch-target-44 text-xs sm:text-sm"
                            >
                                <Rocket className="w-4 h-4 flex-shrink-0" /> {deployMode === 'local' ? 'Generate Files' : 'Deploy'}
                            </Button>
                        </div>
                    )}
                </motion.div>
            </DialogContent>
        </Dialog>
    )
}
