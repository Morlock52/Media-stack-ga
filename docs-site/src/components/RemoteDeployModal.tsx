import { useState } from 'react'
import { motion } from 'framer-motion'
import {
    X, Server, Key, Lock, CheckCircle, AlertCircle,
    Loader2, Upload, Rocket, Eye, EyeOff
} from 'lucide-react'
import { toast } from 'sonner'
import { buildControlServerUrl, controlServerAuthHeaders, getControlServerBaseUrl } from '../utils/controlServer'
import dockerComposeTemplate from '../../../docker-compose.yml?raw'
import { useSetupStore } from '../store/setupStore'
import { generateEnvFile } from '../utils/generateEnvFile'
import { getErrorMessage, log } from '../utils/logging'
import { Button } from './ui/button'
import { Dialog, DialogContent, DialogTitle } from './ui/dialog'

interface DeployStep {
    step: string
    status: 'running' | 'done' | 'error' | 'pending'
}

type RemoteContainerStatus = {
    name: string
    on: boolean
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

    const resetForm = () => {
        setStatus('idle')
        setSteps([])
        setError('')
        setServerReady(null)
        setDeployLocked(false)
        setAutoRemoveConflictingContainers(true)
        setAutoDisableVpnOnTunMissing(true)
        setRemoteContainers([])
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

    const isFormValid = host && username && (authType === 'password' ? password : privateKey)

    return (
        <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose() }}>
            <DialogContent
                showClose={false}
                className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden p-0 max-h-[90vh] flex flex-col"
            >
                <DialogTitle className="sr-only">Deploy to Server</DialogTitle>
                <motion.div initial={{ scale: 0.98, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="flex flex-col flex-1">
                    {/* Header */}
                    <div className="flex items-center justify-between p-4 border-b border-border">
                        <div className="flex items-center gap-2">
                            <Server className="w-5 h-5 text-primary" />
                            <h2 className="font-semibold">Deploy to Server</h2>
                        </div>
                        <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={onClose}
                            title="Close"
                            aria-label="Close modal"
                        >
                            <X className="w-5 h-5" />
                        </Button>
                    </div>

                    {/* Content */}
                    <div className="p-4 space-y-4 overflow-y-auto flex-1">
                        {status === 'success' ? (
                            <motion.div
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                className="text-center py-8"
                            >
                                <motion.div
                                    initial={{ scale: 0 }}
                                    animate={{ scale: 1 }}
                                    transition={{ type: "spring", stiffness: 200, delay: 0.1 }}
                                    className="mb-4"
                                >
                                    <CheckCircle className="w-20 h-20 text-green-500 mx-auto drop-shadow-lg" />
                                </motion.div>
                                <motion.h3
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.2 }}
                                    className="text-xl font-bold text-green-400 mb-2"
                                >
                                    Deployment Successful!
                                </motion.h3>
                                <motion.p
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.3 }}
                                    className="text-sm text-muted-foreground"
                                >
                                    Your media stack is now running on{' '}
                                    <span className="font-semibold text-white bg-white/10 px-2 py-0.5 rounded">{host}</span>
                                </motion.p>

                                {remoteContainers.length > 0 && (
                                    <div className="mt-6 text-left bg-background/40 border border-border rounded-lg p-3">
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
                                <Button
                                    type="button"
                                    variant="gradient"
                                    className="mt-6"
                                    onClick={() => { resetForm(); onClose(); }}
                                >
                                    Done
                                </Button>
                            </motion.div>
                        ) : status === 'deploying' ? (
                            <div className="py-4">
                                <h3 className="font-medium mb-4 flex items-center gap-2">
                                    <Loader2 className="w-4 h-4 animate-spin text-blue-400" />
                                    Deploying to {host}...
                                </h3>
                                <div className="space-y-3">
                                    {steps.map((s, i) => (
                                        <motion.div
                                            key={i}
                                            initial={{ opacity: 0, x: -10 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            transition={{ delay: i * 0.1 }}
                                            className="flex items-center gap-3 text-sm"
                                        >
                                            <div className="flex-shrink-0">
                                                {s.status === 'done' && (
                                                    <motion.div
                                                        initial={{ scale: 0 }}
                                                        animate={{ scale: 1 }}
                                                        transition={{ type: "spring", stiffness: 200 }}
                                                    >
                                                        <CheckCircle className="w-5 h-5 text-green-500" />
                                                    </motion.div>
                                                )}
                                                {s.status === 'running' && (
                                                    <Loader2 className="w-5 h-5 animate-spin text-blue-400" />
                                                )}
                                                {s.status === 'error' && (
                                                    <motion.div
                                                        initial={{ scale: 0 }}
                                                        animate={{ scale: 1 }}
                                                        transition={{ type: "spring", stiffness: 200 }}
                                                    >
                                                        <AlertCircle className="w-5 h-5 text-red-500" />
                                                    </motion.div>
                                                )}
                                            </div>
                                            <span className={`${s.status === 'error' ? 'text-red-400' : s.status === 'done' ? 'text-green-400' : 'text-foreground'} flex-1`}>
                                                {s.step}
                                            </span>
                                        </motion.div>
                                    ))}
                                </div>
                                {error && (
                                    <motion.div
                                        initial={{ opacity: 0, y: -10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        className="mt-4 text-sm text-red-400 bg-red-500/10 border border-red-500/20 p-3 rounded-lg"
                                    >
                                        {error}
                                    </motion.div>
                                )}

                                {remoteContainers.length > 0 && (
                                    <div className="mt-4 bg-background/40 border border-border rounded-lg p-3">
                                        <div className="flex items-center justify-between mb-2">
                                            <div className="text-xs text-muted-foreground">Remote containers (snapshot)</div>
                                            <div className="text-xs text-muted-foreground">{remoteContainers.length}</div>
                                        </div>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 max-h-40 overflow-y-auto">
                                            {remoteContainers.map((c) => (
                                                <div key={c.name} className="flex items-center justify-between gap-3 text-xs bg-card/40 border border-border/60 rounded-md px-2 py-1">
                                                    <span className="font-mono truncate">{c.name}</span>
                                                    <span className={`${c.on ? 'text-green-400' : 'text-muted-foreground'}`}>{c.on ? 'on' : 'off'}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <>
                                {/* Server Details */}
                                <div className="grid grid-cols-3 gap-3">
                                    <div className="col-span-2">
                                        <label className="text-xs text-muted-foreground">Host / IP</label>
                                        <input
                                            type="text"
                                            value={host}
                                            onChange={e => setHost(e.target.value)}
                                            placeholder="192.168.1.100"
                                            className="w-full mt-1 px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs text-muted-foreground" htmlFor="port">Port</label>
                                        <input
                                            type="text"
                                            value={port}
                                            onChange={e => setPort(e.target.value)}
                                            placeholder="22"
                                            className="w-full mt-1 px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                                            id="port"
                                            aria-label="Port"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="text-xs text-muted-foreground" htmlFor="username">Username</label>
                                    <input
                                        type="text"
                                        value={username}
                                        onChange={e => setUsername(e.target.value)}
                                        placeholder="root"
                                        className="w-full mt-1 px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                                        id="username"
                                        aria-label="Username"
                                    />
                                </div>

                                {/* Auth Type Toggle */}
                                <div className="flex gap-2">
                                    <Button
                                        type="button"
                                        variant={authType === 'password' ? 'default' : 'outline'}
                                        className="flex-1 gap-2"
                                        onClick={() => setAuthType('password')}
                                        aria-label="Password authentication"
                                    >
                                        <Lock className="w-4 h-4" /> Password
                                    </Button>
                                    <Button
                                        type="button"
                                        variant={authType === 'key' ? 'default' : 'outline'}
                                        className="flex-1 gap-2"
                                        onClick={() => setAuthType('key')}
                                        aria-label="SSH key authentication"
                                    >
                                        <Key className="w-4 h-4" /> SSH Key
                                    </Button>
                                </div>

                                {/* Auth Input */}
                                {authType === 'password' ? (
                                    <div className="relative">
                                        <label className="text-xs text-muted-foreground" htmlFor="password">Password</label>
                                        <input
                                            type={showPassword ? 'text' : 'password'}
                                            value={password}
                                            onChange={e => setPassword(e.target.value)}
                                            placeholder="Enter password"
                                            className="w-full mt-1 px-3 py-2 pr-10 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                                            id="password"
                                            aria-label="Password"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowPassword(!showPassword)}
                                            className="absolute right-2 top-7 text-muted-foreground hover:text-white"
                                            aria-label="Toggle password visibility"
                                        >
                                            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                        </button>
                                    </div>
                                ) : (
                                    <div>
                                        <label className="text-xs text-muted-foreground" htmlFor="privateKey">Private Key (paste contents)</label>
                                        <textarea
                                            value={privateKey}
                                            onChange={e => setPrivateKey(e.target.value)}
                                            placeholder="-----BEGIN OPENSSH PRIVATE KEY-----"
                                            rows={3}
                                            className="w-full mt-1 px-3 py-2 bg-background border border-border rounded-lg text-xs font-mono focus:outline-none focus:ring-1 focus:ring-primary resize-none"
                                            id="privateKey"
                                            aria-label="Private Key"
                                        />
                                    </div>
                                )}

                                {/* Deploy Path */}
                                <div>
                                    <label className="text-xs text-muted-foreground" htmlFor="deployPath">Deploy Path</label>
                                    <input
                                        type="text"
                                        value={deployPath}
                                        onChange={e => setDeployPath(e.target.value)}
                                        placeholder="~/media-stack"
                                        className="w-full mt-1 px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                                        id="deployPath"
                                        aria-label="Deploy Path"
                                    />
                                </div>

                                <label className="flex items-start gap-2 text-xs text-muted-foreground select-none">
                                    <input
                                        type="checkbox"
                                        checked={autoRemoveConflictingContainers}
                                        onChange={(e) => setAutoRemoveConflictingContainers(e.target.checked)}
                                        className="mt-0.5"
                                        aria-label="Auto remove conflicting containers"
                                    />
                                    <span>
                                        Auto-remove conflicting containers (recommended). If Docker reports a name conflict (e.g. existing <code className="text-xs">portainer</code>), the deploy will remove it and retry once.
                                    </span>
                                </label>

                                <label className="flex items-start gap-2 text-xs text-muted-foreground select-none">
                                    <input
                                        type="checkbox"
                                        checked={autoDisableVpnOnTunMissing}
                                        onChange={(e) => setAutoDisableVpnOnTunMissing(e.target.checked)}
                                        className="mt-0.5"
                                        aria-label="Auto disable VPN profile if /dev/net/tun is missing"
                                    />
                                    <span>
                                        Auto-disable VPN/torrent profiles if <code className="text-xs">/dev/net/tun</code> is missing (lets the rest of the stack update on hosts without TUN).
                                    </span>
                                </label>

                                {/* Connection Status */}
                                {serverReady !== null && (
                                    <div className={`flex items-center gap-2 text-sm p-2 rounded-lg ${
                                        serverReady ? 'bg-green-500/10 text-green-400' : 'bg-yellow-500/10 text-yellow-400'
                                    }`}>
                                        {serverReady ? (
                                            <><CheckCircle className="w-4 h-4" /> Server ready with Docker</>
                                        ) : (
                                            <><AlertCircle className="w-4 h-4" /> Docker not found on server</>
                                        )}
                                    </div>
                                )}

                                {deployLocked && (
                                    <div className="text-sm bg-yellow-500/10 border border-yellow-500/20 text-yellow-300 p-3 rounded-lg">
                                        <div className="font-medium">Deployment already in progress</div>
                                        <div className="text-xs text-yellow-200/80 mt-1">
                                            Another deploy request for this server is currently running. Wait for it to finish, then try again.
                                        </div>
                                    </div>
                                )}

                                {error && (
                                    <p className={`text-sm p-2 rounded-lg ${deployLocked ? 'text-yellow-200 bg-yellow-500/10 border border-yellow-500/20' : 'text-red-400 bg-red-500/10'}`}>{error}</p>
                                )}

                                {remoteContainers.length > 0 && (
                                    <div className="bg-background/40 border border-border rounded-lg p-3">
                                        <div className="text-xs text-muted-foreground mb-2">Remote containers (snapshot)</div>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 max-h-40 overflow-y-auto">
                                            {remoteContainers.map((c) => (
                                                <div key={c.name} className="flex items-center justify-between gap-3 text-xs bg-card/40 border border-border/60 rounded-md px-2 py-1">
                                                    <span className="font-mono truncate">{c.name}</span>
                                                    <span className={`${c.on ? 'text-green-400' : 'text-muted-foreground'}`}>{c.on ? 'on' : 'off'}</span>
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
                        <div className="flex gap-2 p-4 border-t border-border bg-card/50">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={testConnection}
                                disabled={!isFormValid || status === 'testing'}
                                className="flex-1 gap-2"
                            >
                                {status === 'testing' ? (
                                    <><Loader2 className="w-4 h-4 animate-spin" /> Testing...</>
                                ) : (
                                    <><Upload className="w-4 h-4" /> Test Connection</>
                                )}
                            </Button>
                            <Button
                                type="button"
                                onClick={deploy}
                                disabled={!isFormValid || status === 'testing'}
                                className="flex-1 gap-2"
                            >
                                <Rocket className="w-4 h-4" /> Deploy
                            </Button>
                        </div>
                    )}
                </motion.div>
            </DialogContent>
        </Dialog>
    )
}
