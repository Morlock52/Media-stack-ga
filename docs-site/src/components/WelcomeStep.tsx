import { useState } from 'react'
import { motion } from 'motion/react'
import { Sparkles, ArrowRight, Shield, Settings, Wifi, Globe, Server, Lock, Check, Zap, Wrench } from 'lucide-react'
import { useSetupStore } from '../store/setupStore'
import { Link } from 'react-router-dom'
import { useControlServerOpenAIKeyStatus } from '../hooks/useControlServerOpenAIKeyStatus'
import { controlServer } from '../utils/controlServer'

type DeploymentMode = 'local' | 'cloud'
type SetupType = 'quick' | 'custom' | null

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
        title: 'Home Network',
        subtitle: 'Easiest setup — stream on your home WiFi',
        icon: <Wifi className="w-6 h-6" />,
        features: [
            'Works immediately after install',
            'Access via your computer\'s IP address',
            'No accounts or domains needed',
            'Perfect for beginners',
        ],
        recommended: '⭐ Recommended for first-time users',
    },
    {
        id: 'cloud',
        title: 'Remote Access',
        subtitle: 'Stream from anywhere (more setup required)',
        icon: <Globe className="w-6 h-6" />,
        features: [
            'Access from outside your home',
            'Requires a domain name',
            'Cloudflare account needed',
            'Login protection included',
        ],
        recommended: '⭐⭐ For experienced users',
    },
]

export function WelcomeStep() {
    const { nextStep, config, updateConfig, setQuickStartMode, setCurrentStep } = useSetupStore()
    const { serverOnline, hasKey, refresh } = useControlServerOpenAIKeyStatus()
    const [selectedMode, setSelectedMode] = useState<DeploymentMode>(config.deploymentMode)
    const [showSetupChoice, setShowSetupChoice] = useState(false)

    const isLoopbackHost = (host: string) => {
        const normalized = String(host || '').trim().toLowerCase()
        return normalized === 'localhost' || normalized === '127.0.0.1' || normalized === '::1'
    }

    const handleModeSelect = (mode: DeploymentMode) => {
        setSelectedMode(mode)
        updateConfig({ deploymentMode: mode })

        if (mode === 'local') {
            const currentDomain = String(config.domain || '').trim()
            const shouldAutofill = !currentDomain || currentDomain === 'example.com' || currentDomain === 'local'
            if (!shouldAutofill) return

            void (async () => {
                const pageHost =
                    typeof window !== 'undefined' ? String(window.location.hostname || '').trim() : ''
                if (pageHost && !isLoopbackHost(pageHost)) {
                    updateConfig({ domain: pageHost })
                    return
                }

                try {
                    const info = await controlServer.getNetworkInfo()
                    // When the control server runs in Docker (wizard mode), `ipv4` will be the container IP,
                    // which is not helpful for building LAN URLs. In that case, fall back to localhost.
                    if (info?.success && !info.inContainer && info.lanIpv4) {
                        updateConfig({ domain: info.lanIpv4 })
                        return
                    }
                } catch {
                    // ignore
                }

                updateConfig({ domain: 'localhost' })
            })()
        }
    }

    const handleContinue = () => {
        updateConfig({ deploymentMode: selectedMode })
        if (selectedMode === 'local') {
            // Show Quick Start vs Custom choice for local users
            setShowSetupChoice(true)
        } else {
            // Cloud users go to full wizard
            setQuickStartMode(false)
            nextStep()
        }
    }

    const handleSetupChoice = (type: SetupType) => {
        if (type === 'quick') {
            setQuickStartMode(true)
            // Go to Quick Start step (step 1 in quick mode = QuickStartStep)
            setCurrentStep(1)
        } else {
            setQuickStartMode(false)
            nextStep()
        }
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
                    Your personal streaming service in minutes. First, where will you watch from?
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
                    className="mt-4 p-4 rounded-xl bg-muted/50 border border-border"
                >
                    {selectedMode === 'local' ? (
                        <div className="flex items-start gap-3 text-left">
                            <Server className="w-5 h-5 text-cyan-400 mt-0.5 flex-shrink-0" />
                            <div className="text-sm text-muted-foreground space-y-2">
                                <p>
                                    <span className="font-medium text-foreground">How it works:</span> After setup, open your browser and go to your server's IP address (like <code className="text-xs bg-muted px-1.5 py-0.5 rounded">http://192.168.1.100</code>).
                                </p>
                                <p className="text-xs">
                                    You'll see a dashboard with links to all your apps. Bookmark it and you're done!
                                </p>
                            </div>
                        </div>
                    ) : (
                        <div className="flex items-start gap-3 text-left">
                            <Lock className="w-5 h-5 text-emerald-400 mt-0.5 flex-shrink-0" />
                            <div className="text-sm text-muted-foreground space-y-2">
                                <p>
                                    <span className="font-medium text-foreground">What you'll need:</span> A domain name (like <code className="text-xs bg-muted px-1.5 py-0.5 rounded">example.com</code>) and a free Cloudflare account.
                                </p>
                                <p className="text-xs">
                                    This creates a secure tunnel so you can access your media from anywhere with login protection.
                                </p>
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

            {/* Setup Type Choice (only for local after Continue) */}
            {showSetupChoice ? (
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="max-w-2xl mx-auto space-y-6"
                >
                    <div className="text-center mb-4">
                        <h3 className="text-xl font-semibold text-foreground mb-2">
                            How would you like to set up?
                        </h3>
                        <p className="text-sm text-muted-foreground">
                            Choose the option that fits your experience level
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Quick Start Option */}
                        <motion.button
                            onClick={() => handleSetupChoice('quick')}
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            className="relative p-6 rounded-2xl border-2 border-primary bg-primary/10 text-left transition-all shadow-lg shadow-primary/20"
                        >
                            <div className="absolute top-3 right-3 px-2 py-1 bg-primary/20 rounded-full">
                                <span className="text-xs font-medium text-primary">Recommended</span>
                            </div>
                            <div className="flex items-start gap-4">
                                <div className="p-3 rounded-xl bg-gradient-to-br from-emerald-500 to-cyan-500 text-white">
                                    <Zap className="w-6 h-6" />
                                </div>
                                <div>
                                    <h4 className="font-bold text-lg text-foreground mb-1">
                                        Quick Start
                                    </h4>
                                    <p className="text-sm text-muted-foreground mb-3">
                                        Perfect for beginners
                                    </p>
                                    <ul className="space-y-1 text-sm text-muted-foreground">
                                        <li className="flex items-center gap-2">
                                            <Check className="w-4 h-4 text-emerald-400" />
                                            Just 2 simple steps
                                        </li>
                                        <li className="flex items-center gap-2">
                                            <Check className="w-4 h-4 text-emerald-400" />
                                            Ready in 2 minutes
                                        </li>
                                        <li className="flex items-center gap-2">
                                            <Check className="w-4 h-4 text-emerald-400" />
                                            Smart defaults chosen for you
                                        </li>
                                    </ul>
                                </div>
                            </div>
                        </motion.button>

                        {/* Custom Setup Option */}
                        <motion.button
                            onClick={() => handleSetupChoice('custom')}
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            className="relative p-6 rounded-2xl border-2 border-border bg-card/50 hover:border-muted-foreground/50 text-left transition-all"
                        >
                            <div className="flex items-start gap-4">
                                <div className="p-3 rounded-xl bg-muted text-muted-foreground">
                                    <Wrench className="w-6 h-6" />
                                </div>
                                <div>
                                    <h4 className="font-bold text-lg text-foreground mb-1">
                                        Custom Setup
                                    </h4>
                                    <p className="text-sm text-muted-foreground mb-3">
                                        More control over options
                                    </p>
                                    <ul className="space-y-1 text-sm text-muted-foreground">
                                        <li className="flex items-center gap-2">
                                            <Check className="w-4 h-4 text-muted-foreground" />
                                            Choose each service
                                        </li>
                                        <li className="flex items-center gap-2">
                                            <Check className="w-4 h-4 text-muted-foreground" />
                                            Configure storage paths
                                        </li>
                                        <li className="flex items-center gap-2">
                                            <Check className="w-4 h-4 text-muted-foreground" />
                                            Advanced settings access
                                        </li>
                                    </ul>
                                </div>
                            </div>
                        </motion.button>
                    </div>

                    <button
                        onClick={() => setShowSetupChoice(false)}
                        className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                    >
                        <ArrowRight className="w-4 h-4 inline rotate-180 mr-1" />
                        Back to network choice
                    </button>
                </motion.div>
            ) : (
                <div className="pt-2 space-y-3">
                    <button
                        onClick={handleContinue}
                        className="group relative inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-emerald-500 via-cyan-500 to-lime-400 rounded-xl font-semibold text-white shadow-lg shadow-emerald-500/25 hover:shadow-emerald-400/40 hover:scale-105 transition-all duration-300"
                    >
                        {selectedMode === 'local' ? "Let's Go!" : 'Start Setup'}
                        <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                    </button>
                    {selectedMode === 'local' && (
                        <p className="text-xs text-muted-foreground">
                            You'll choose Quick Start or Custom next
                        </p>
                    )}
                </div>
            )}
        </motion.div>
    )
}
