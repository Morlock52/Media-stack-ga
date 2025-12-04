import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
    X, Server, Key, Lock, CheckCircle, AlertCircle, 
    Loader2, Upload, Rocket, Eye, EyeOff
} from 'lucide-react'
import { buildControlServerUrl } from '../utils/controlServer'

interface DeployStep {
    step: string
    status: 'running' | 'done' | 'error' | 'pending'
}

interface RemoteDeployModalProps {
    isOpen: boolean
    onClose: () => void
}

export function RemoteDeployModal({ isOpen, onClose }: RemoteDeployModalProps) {
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

    const resetForm = () => {
        setStatus('idle')
        setSteps([])
        setError('')
        setServerReady(null)
    }

    const testConnection = async () => {
        setStatus('testing')
        setError('')
        
        try {
            const res = await fetch(buildControlServerUrl('/api/remote-deploy/test'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    host, port, username, authType,
                    password: authType === 'password' ? password : undefined,
                    privateKey: authType === 'key' ? privateKey : undefined
                })
            })
            
            const data = await res.json()
            
            if (data.success) {
                setServerReady(data.docker)
                setStatus('idle')
            } else {
                setError(data.error)
                setStatus('error')
            }
        } catch (err) {
            console.error('RemoteDeployModal: test connection failed', err)
            setError('Cannot connect to control server. Is it running?')
            setStatus('error')
        }
    }

    const deploy = async () => {
        setStatus('deploying')
        setError('')
        setSteps([])
        
        try {
            const res = await fetch(buildControlServerUrl('/api/remote-deploy'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    host, port, username, authType, deployPath,
                    password: authType === 'password' ? password : undefined,
                    privateKey: authType === 'key' ? privateKey : undefined
                })
            })
            
            const data = await res.json()
            setSteps(data.steps || [])
            
            if (data.success) {
                setStatus('success')
            } else {
                setError(data.error)
                setStatus('error')
            }
        } catch (err) {
            console.error('RemoteDeployModal: deploy request failed', err)
            setError('Deployment failed. Check control server.')
            setStatus('error')
        }
    }

    const isFormValid = host && username && (authType === 'password' ? password : privateKey)

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
                    onClick={onClose}
                >
                    <motion.div
                        initial={{ scale: 0.95, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.95, opacity: 0 }}
                        className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-md overflow-hidden"
                        onClick={e => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between p-4 border-b border-border">
                            <div className="flex items-center gap-2">
                                <Server className="w-5 h-5 text-primary" />
                                <h2 className="font-semibold">Deploy to Server</h2>
                            </div>
                            <button 
                                onClick={onClose}
                                className="p-1 hover:bg-white/10 rounded transition-colors"
                                title="Close"
                                aria-label="Close modal"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Content */}
                        <div className="p-4 space-y-4 max-h-[70vh] overflow-y-auto">
                            {status === 'success' ? (
                                <div className="text-center py-6">
                                    <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
                                    <h3 className="text-lg font-semibold text-green-400">Deployed Successfully!</h3>
                                    <p className="text-sm text-muted-foreground mt-2">
                                        Your media stack is now running on <span className="text-white">{host}</span>
                                    </p>
                                    <button
                                        onClick={() => { resetForm(); onClose(); }}
                                        className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90"
                                    >
                                        Done
                                    </button>
                                </div>
                            ) : status === 'deploying' ? (
                                <div className="py-4">
                                    <h3 className="font-medium mb-4 flex items-center gap-2">
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        Deploying to {host}...
                                    </h3>
                                    <div className="space-y-2">
                                        {steps.map((s, i) => (
                                            <div key={i} className="flex items-center gap-2 text-sm">
                                                {s.status === 'done' && <CheckCircle className="w-4 h-4 text-green-500" />}
                                                {s.status === 'running' && <Loader2 className="w-4 h-4 animate-spin text-blue-400" />}
                                                {s.status === 'error' && <AlertCircle className="w-4 h-4 text-red-500" />}
                                                <span className={s.status === 'error' ? 'text-red-400' : ''}>{s.step}</span>
                                            </div>
                                        ))}
                                    </div>
                                    {error && (
                                        <p className="mt-4 text-sm text-red-400 bg-red-500/10 p-2 rounded">{error}</p>
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
                                        <button
                                            onClick={() => setAuthType('password')}
                                            className={`flex-1 py-2 px-3 rounded-lg text-sm flex items-center justify-center gap-2 transition-colors ${
                                                authType === 'password' 
                                                    ? 'bg-primary text-primary-foreground' 
                                                    : 'bg-background border border-border hover:bg-white/5'
                                            }`}
                                            aria-label="Password authentication"
                                        >
                                            <Lock className="w-4 h-4" /> Password
                                        </button>
                                        <button
                                            onClick={() => setAuthType('key')}
                                            className={`flex-1 py-2 px-3 rounded-lg text-sm flex items-center justify-center gap-2 transition-colors ${
                                                authType === 'key' 
                                                    ? 'bg-primary text-primary-foreground' 
                                                    : 'bg-background border border-border hover:bg-white/5'
                                            }`}
                                            aria-label="SSH key authentication"
                                        >
                                            <Key className="w-4 h-4" /> SSH Key
                                        </button>
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

                                    {error && (
                                        <p className="text-sm text-red-400 bg-red-500/10 p-2 rounded-lg">{error}</p>
                                    )}
                                </>
                            )}
                        </div>

                        {/* Footer Actions */}
                        {status !== 'success' && status !== 'deploying' && (
                            <div className="flex gap-2 p-4 border-t border-border bg-card/50">
                                <button
                                    onClick={testConnection}
                                    disabled={!isFormValid || status === 'testing'}
                                    className="flex-1 py-2 px-4 border border-border rounded-lg text-sm hover:bg-white/5 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                >
                                    {status === 'testing' ? (
                                        <><Loader2 className="w-4 h-4 animate-spin" /> Testing...</>
                                    ) : (
                                        <><Upload className="w-4 h-4" /> Test Connection</>
                                    )}
                                </button>
                                <button
                                    onClick={deploy}
                                    disabled={!isFormValid || status === 'testing'}
                                    className="flex-1 py-2 px-4 bg-primary text-primary-foreground rounded-lg text-sm hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                >
                                    <Rocket className="w-4 h-4" /> Deploy
                                </button>
                            </div>
                        )}
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    )
}
