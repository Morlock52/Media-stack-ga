import { useState } from 'react'
import { motion } from 'framer-motion'
import { Sparkles, ArrowRight, Shield, Settings, Wifi, Globe, Server, Lock, Check } from 'lucide-react'
import { useSetupStore } from '../store/setupStore'
import { Link } from 'react-router-dom'
import { useControlServerOpenAIKeyStatus } from '../hooks/useControlServerOpenAIKeyStatus'

type DeploymentMode = 'local' | 'cloud'

interface DeploymentOption {
    id: DeploymentMode
    title: string
    subtitle: string
    icon: React.ReactNode
    features: string[]
    recommended?: string
}

const deploymentOptions: DeploymentOption[] = [
    {
        id: 'local',
        title: 'Local Network',
        subtitle: 'Home & LAN access only',
        icon: <Wifi className="w-6 h-6" />,
        features: [
            'Traefik reverse proxy',
            '*.local domain names',
            'No external dependencies',
            'Simpler setup, faster start',
        ],
        recommended: 'Best for home labs & privacy-focused setups',
    },
    {
        id: 'cloud',
        title: 'Cloud / Remote',
        subtitle: 'Access from anywhere',
        icon: <Globe className="w-6 h-6" />,
        features: [
            'Cloudflare Tunnel (Zero Trust)',
            'Authelia SSO authentication',
            'External domain required',
            'Enhanced security & monitoring',
        ],
        recommended: 'Best for remote access & multi-user households',
    },
]

export function WelcomeStep() {
    const { nextStep, config, updateConfig } = useSetupStore()
    const { serverOnline, hasKey, refresh } = useControlServerOpenAIKeyStatus()
    const [selectedMode, setSelectedMode] = useState<DeploymentMode>(config.deploymentMode)

    const handleModeSelect = (mode: DeploymentMode) => {
        setSelectedMode(mode)
        updateConfig({ deploymentMode: mode })
    }

    const handleStart = () => {
        // Ensure deployment mode is saved before proceeding
        updateConfig({ deploymentMode: selectedMode })
        nextStep()
    }

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="text-center space-y-8 py-6"
        >
            <div className="flex justify-center mb-4">
                <div className="w-20 h-20 bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 rounded-3xl flex items-center justify-center border border-border relative overflow-hidden group">
                    <div className="absolute inset-0 bg-gradient-to-tr from-emerald-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    <Sparkles className="w-10 h-10 text-primary animate-pulse-glow" />
                </div>
            </div>

            <div className="max-w-2xl mx-auto space-y-3">
                <h2 className="text-3xl md:text-4xl font-bold text-foreground">
                    Welcome to <span className="bg-clip-text text-transparent bg-gradient-to-r from-emerald-400 via-cyan-400 to-lime-400">Media Stack</span>
                </h2>
                <p className="text-base text-muted-foreground">
                    First, choose how you'll access your media server. This determines the entire stack architecture.
                </p>
            </div>

            {/* Deployment Mode Selection - The Critical Early Choice */}
            <div className="max-w-3xl mx-auto">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {deploymentOptions.map((option) => {
                        const isSelected = selectedMode === option.id
                        return (
                            <motion.button
                                key={option.id}
                                onClick={() => handleModeSelect(option.id)}
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                className={`relative p-5 rounded-2xl border-2 text-left transition-all duration-200 ${
                                    isSelected
                                        ? 'border-primary bg-primary/10 shadow-lg shadow-primary/20'
                                        : 'border-border bg-card/50 hover:border-muted-foreground/50 hover:bg-card/80'
                                }`}
                            >
                                {/* Selection indicator */}
                                <div className={`absolute top-3 right-3 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
                                    isSelected
                                        ? 'border-primary bg-primary'
                                        : 'border-muted-foreground/30'
                                }`}>
                                    {isSelected && <Check className="w-4 h-4 text-primary-foreground" />}
                                </div>

                                {/* Header */}
                                <div className="flex items-start gap-3 mb-3">
                                    <div className={`p-2.5 rounded-xl ${
                                        isSelected
                                            ? 'bg-primary/20 text-primary'
                                            : 'bg-muted text-muted-foreground'
                                    }`}>
                                        {option.icon}
                                    </div>
                                    <div>
                                        <h3 className={`font-semibold text-lg ${
                                            isSelected ? 'text-foreground' : 'text-foreground/90'
                                        }`}>
                                            {option.title}
                                        </h3>
                                        <p className="text-sm text-muted-foreground">{option.subtitle}</p>
                                    </div>
                                </div>

                                {/* Features */}
                                <ul className="space-y-1.5 mb-3">
                                    {option.features.map((feature, idx) => (
                                        <li key={idx} className="flex items-center gap-2 text-sm text-muted-foreground">
                                            <div className={`w-1.5 h-1.5 rounded-full ${
                                                isSelected ? 'bg-primary' : 'bg-muted-foreground/50'
                                            }`} />
                                            {feature}
                                        </li>
                                    ))}
                                </ul>

                                {/* Recommendation badge */}
                                {option.recommended && (
                                    <div className={`text-xs px-2.5 py-1 rounded-full inline-block ${
                                        isSelected
                                            ? 'bg-primary/20 text-primary'
                                            : 'bg-muted text-muted-foreground'
                                    }`}>
                                        {option.recommended}
                                    </div>
                                )}
                            </motion.button>
                        )
                    })}
                </div>

                {/* Mode-specific info banner */}
                <motion.div
                    key={selectedMode}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-4 p-3 rounded-xl bg-muted/50 border border-border"
                >
                    {selectedMode === 'local' ? (
                        <div className="flex items-start gap-3 text-left">
                            <Server className="w-5 h-5 text-cyan-400 mt-0.5 flex-shrink-0" />
                            <div className="text-sm text-muted-foreground">
                                <span className="font-medium text-foreground">Local mode</span> uses Traefik for internal routing.
                                Access services via <code className="text-xs bg-muted px-1.5 py-0.5 rounded">plex.local</code>, <code className="text-xs bg-muted px-1.5 py-0.5 rounded">sonarr.local</code>, etc.
                                Add entries to your <code className="text-xs bg-muted px-1.5 py-0.5 rounded">/etc/hosts</code> or use mDNS.
                            </div>
                        </div>
                    ) : (
                        <div className="flex items-start gap-3 text-left">
                            <Lock className="w-5 h-5 text-emerald-400 mt-0.5 flex-shrink-0" />
                            <div className="text-sm text-muted-foreground">
                                <span className="font-medium text-foreground">Cloud mode</span> routes traffic through Cloudflare Tunnel with Authelia SSO.
                                You'll need a domain and Cloudflare account. All services protected by single sign-on.
                            </div>
                        </div>
                    )}
                </motion.div>
            </div>

            {/* AI Assistant Section (collapsed) */}
            <details className="max-w-md mx-auto glass-card rounded-2xl">
                <summary className="p-4 cursor-pointer flex items-center justify-between">
                    <div className="flex items-center gap-2 text-primary">
                        <Sparkles className="w-4 h-4" />
                        <span className="font-medium text-sm">AI Assistant (Optional)</span>
                    </div>
                    <Link
                        to="/settings"
                        className="text-xs text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-1"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <Settings className="w-3.5 h-3.5" />
                        Settings
                    </Link>
                </summary>
                <div className="px-4 pb-4 space-y-3">
                    <p className="text-xs text-muted-foreground text-left">
                        Add an OpenAI API key to enable higher-quality AI guidance and voice output.
                        Keys are stored by the local control server (not in the browser).
                    </p>
                    <div className="flex items-center justify-between gap-3 text-sm text-muted-foreground bg-muted/60 rounded-lg p-3 border border-border">
                        <div className="flex items-center gap-2">
                            <Shield className="w-4 h-4 text-green-400" />
                            <span>
                                {serverOnline === false
                                    ? 'Control server offline'
                                    : hasKey
                                        ? 'Key stored on control server'
                                        : 'No key stored yet'}
                            </span>
                        </div>
                        <button
                            onClick={refresh}
                            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                            type="button"
                        >
                            Refresh
                        </button>
                    </div>
                </div>
            </details>

            <div className="pt-2">
                <button
                    onClick={handleStart}
                    className="group relative inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-emerald-500 via-cyan-500 to-lime-400 rounded-xl font-semibold text-white shadow-lg shadow-emerald-500/25 hover:shadow-emerald-400/40 hover:scale-105 transition-all duration-300"
                >
                    Continue with {selectedMode === 'local' ? 'Local' : 'Cloud'} Setup
                    <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </button>
            </div>
        </motion.div>
    )
}
