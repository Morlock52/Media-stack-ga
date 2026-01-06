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
            className="text-center space-y-4 sm:space-y-6 md:space-y-8 py-4 sm:py-6 px-4 sm:px-0"
        >
            <div className="flex justify-center mb-2 sm:mb-4">
                <div className="w-16 h-16 sm:w-20 sm:h-20 bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 rounded-2xl sm:rounded-3xl flex items-center justify-center border border-border relative overflow-hidden group">
                    <div className="absolute inset-0 bg-gradient-to-tr from-emerald-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    <Sparkles className="w-8 h-8 sm:w-10 sm:h-10 text-primary animate-pulse-glow" />
                </div>
            </div>

            <div className="max-w-2xl mx-auto space-y-2 sm:space-y-3">
                <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-foreground px-2">
                    Welcome to <span className="bg-clip-text text-transparent bg-gradient-to-r from-emerald-400 via-cyan-400 to-lime-400">Media Stack</span>
                </h2>
                <p className="text-sm sm:text-base text-muted-foreground px-2">
                    Your personal streaming service in minutes. First, where will you watch from?
                </p>
            </div>

            {/* Deployment Mode Selection - The Critical Early Choice */}
            <div className="max-w-3xl mx-auto">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                    {deploymentOptions.map((option) => {
                        const isSelected = selectedMode === option.id
                        return (
                            <motion.button
                                key={option.id}
                                onClick={() => handleModeSelect(option.id)}
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                className={`relative p-4 sm:p-5 rounded-xl sm:rounded-2xl border-2 text-left transition-all duration-200 touch-target-44 ${
                                    isSelected
                                        ? 'border-primary bg-primary/10 shadow-lg shadow-primary/20'
                                        : 'border-border bg-card/50 hover:border-muted-foreground/50 hover:bg-card/80'
                                }`}
                            >
                                {/* Selection indicator */}
                                <div className={`absolute top-2 right-2 sm:top-3 sm:right-3 w-5 h-5 sm:w-6 sm:h-6 rounded-full border-2 flex items-center justify-center transition-all ${
                                    isSelected
                                        ? 'border-primary bg-primary'
                                        : 'border-muted-foreground/30'
                                }`}>
                                    {isSelected && <Check className="w-3 h-3 sm:w-4 sm:h-4 text-primary-foreground" />}
                                </div>

                                {/* Header */}
                                <div className="flex items-start gap-2 sm:gap-3 mb-3 pr-6 sm:pr-0">
                                    <div className={`p-2 sm:p-2.5 rounded-lg sm:rounded-xl flex-shrink-0 ${
                                        isSelected
                                            ? 'bg-primary/20 text-primary'
                                            : 'bg-muted text-muted-foreground'
                                    }`}>
                                        {option.icon}
                                    </div>
                                    <div className="min-w-0">
                                        <h3 className={`font-semibold text-base sm:text-lg ${
                                            isSelected ? 'text-foreground' : 'text-foreground/90'
                                        }`}>
                                            {option.title}
                                        </h3>
                                        <p className="text-xs sm:text-sm text-muted-foreground">{option.subtitle}</p>
                                    </div>
                                </div>

                                {/* Features */}
                                <ul className="space-y-1 sm:space-y-1.5 mb-2 sm:mb-3">
                                    {option.features.map((feature, idx) => (
                                        <li key={idx} className="flex items-center gap-2 text-xs sm:text-sm text-muted-foreground">
                                            <div className={`w-1 h-1 sm:w-1.5 sm:h-1.5 rounded-full flex-shrink-0 ${
                                                isSelected ? 'bg-primary' : 'bg-muted-foreground/50'
                                            }`} />
                                            <span className="break-words">{feature}</span>
                                        </li>
                                    ))}
                                </ul>

                                {/* Recommendation badge */}
                                {option.recommended && (
                                    <div className={`text-xs px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full inline-block ${
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
                    className="mt-3 sm:mt-4 p-3 sm:p-4 rounded-lg sm:rounded-xl bg-muted/50 border border-border"
                >
                    {selectedMode === 'local' ? (
                        <div className="flex items-start gap-2 sm:gap-3 text-left">
                            <Server className="w-4 h-4 sm:w-5 sm:h-5 text-cyan-400 mt-0.5 flex-shrink-0" />
                            <div className="text-xs sm:text-sm text-muted-foreground space-y-1.5 sm:space-y-2 min-w-0">
                                <p className="break-words">
                                    <span className="font-medium text-foreground">How it works:</span> After setup, open your browser and go to your server's IP address (like <code className="text-xs bg-muted px-1.5 py-0.5 rounded whitespace-nowrap">http://192.168.1.100</code>).
                                </p>
                                <p className="text-xs">
                                    You'll see a dashboard with links to all your apps. Bookmark it and you're done!
                                </p>
                            </div>
                        </div>
                    ) : (
                        <div className="flex items-start gap-2 sm:gap-3 text-left">
                            <Lock className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-400 mt-0.5 flex-shrink-0" />
                            <div className="text-xs sm:text-sm text-muted-foreground space-y-1.5 sm:space-y-2 min-w-0">
                                <p className="break-words">
                                    <span className="font-medium text-foreground">What you'll need:</span> A domain name (like <code className="text-xs bg-muted px-1.5 py-0.5 rounded whitespace-nowrap">example.com</code>) and a free Cloudflare account.
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
            <details className="max-w-md mx-auto glass-card rounded-xl sm:rounded-2xl">
                <summary className="p-3 sm:p-4 cursor-pointer flex items-center justify-between touch-target-44">
                    <div className="flex items-center gap-2 text-primary min-w-0">
                        <Sparkles className="w-4 h-4 flex-shrink-0" />
                        <span className="font-medium text-xs sm:text-sm truncate">AI Assistant (Optional)</span>
                    </div>
                    <Link
                        to="/settings"
                        className="text-xs text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-1 flex-shrink-0 touch-target-44"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <Settings className="w-3.5 h-3.5" />
                        <span className="hidden xs:inline">Settings</span>
                    </Link>
                </summary>
                <div className="px-3 sm:px-4 pb-3 sm:pb-4 space-y-2 sm:space-y-3">
                    <p className="text-xs text-muted-foreground text-left break-words">
                        Add an OpenAI API key to enable higher-quality AI guidance and voice output.
                        Keys are stored by the local control server (not in the browser).
                    </p>
                    <div className="flex flex-col xs:flex-row xs:items-center xs:justify-between gap-2 xs:gap-3 text-sm text-muted-foreground bg-muted/60 rounded-lg p-2.5 sm:p-3 border border-border">
                        <div className="flex items-center gap-2 min-w-0">
                            <Shield className="w-4 h-4 text-green-400 flex-shrink-0" />
                            <span className="text-xs sm:text-sm truncate">
                                {serverOnline === false
                                    ? 'Control server offline'
                                    : hasKey
                                        ? 'Key stored on control server'
                                        : 'No key stored yet'}
                            </span>
                        </div>
                        <button
                            onClick={refresh}
                            className="text-xs text-muted-foreground hover:text-foreground transition-colors touch-target-44 self-start xs:self-auto"
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
                    className="max-w-2xl mx-auto space-y-4 sm:space-y-6"
                >
                    <div className="text-center mb-3 sm:mb-4 px-2">
                        <h3 className="text-lg sm:text-xl font-semibold text-foreground mb-1 sm:mb-2">
                            How would you like to set up?
                        </h3>
                        <p className="text-xs sm:text-sm text-muted-foreground">
                            Choose the option that fits your experience level
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                        {/* Quick Start Option */}
                        <motion.button
                            onClick={() => handleSetupChoice('quick')}
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            className="relative p-4 sm:p-6 rounded-xl sm:rounded-2xl border-2 border-primary bg-primary/10 text-left transition-all shadow-lg shadow-primary/20 touch-target-44"
                        >
                            <div className="absolute top-2 right-2 sm:top-3 sm:right-3 px-2 py-0.5 sm:py-1 bg-primary/20 rounded-full">
                                <span className="text-xs font-medium text-primary">Recommended</span>
                            </div>
                            <div className="flex items-start gap-3 sm:gap-4">
                                <div className="p-2.5 sm:p-3 rounded-lg sm:rounded-xl bg-gradient-to-br from-emerald-500 to-cyan-500 text-white flex-shrink-0">
                                    <Zap className="w-5 h-5 sm:w-6 sm:h-6" />
                                </div>
                                <div className="min-w-0 pr-16 sm:pr-0">
                                    <h4 className="font-bold text-base sm:text-lg text-foreground mb-0.5 sm:mb-1">
                                        Quick Start
                                    </h4>
                                    <p className="text-xs sm:text-sm text-muted-foreground mb-2 sm:mb-3">
                                        Perfect for beginners
                                    </p>
                                    <ul className="space-y-0.5 sm:space-y-1 text-xs sm:text-sm text-muted-foreground">
                                        <li className="flex items-center gap-2">
                                            <Check className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-400 flex-shrink-0" />
                                            <span>Just 2 simple steps</span>
                                        </li>
                                        <li className="flex items-center gap-2">
                                            <Check className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-400 flex-shrink-0" />
                                            <span>Ready in 2 minutes</span>
                                        </li>
                                        <li className="flex items-center gap-2">
                                            <Check className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-400 flex-shrink-0" />
                                            <span>Smart defaults chosen for you</span>
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
                            className="relative p-4 sm:p-6 rounded-xl sm:rounded-2xl border-2 border-border bg-card/50 hover:border-muted-foreground/50 text-left transition-all touch-target-44"
                        >
                            <div className="flex items-start gap-3 sm:gap-4">
                                <div className="p-2.5 sm:p-3 rounded-lg sm:rounded-xl bg-muted text-muted-foreground flex-shrink-0">
                                    <Wrench className="w-5 h-5 sm:w-6 sm:h-6" />
                                </div>
                                <div className="min-w-0">
                                    <h4 className="font-bold text-base sm:text-lg text-foreground mb-0.5 sm:mb-1">
                                        Custom Setup
                                    </h4>
                                    <p className="text-xs sm:text-sm text-muted-foreground mb-2 sm:mb-3">
                                        More control over options
                                    </p>
                                    <ul className="space-y-0.5 sm:space-y-1 text-xs sm:text-sm text-muted-foreground">
                                        <li className="flex items-center gap-2">
                                            <Check className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-muted-foreground flex-shrink-0" />
                                            <span>Choose each service</span>
                                        </li>
                                        <li className="flex items-center gap-2">
                                            <Check className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-muted-foreground flex-shrink-0" />
                                            <span>Configure storage paths</span>
                                        </li>
                                        <li className="flex items-center gap-2">
                                            <Check className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-muted-foreground flex-shrink-0" />
                                            <span>Advanced settings access</span>
                                        </li>
                                    </ul>
                                </div>
                            </div>
                        </motion.button>
                    </div>

                    <button
                        onClick={() => setShowSetupChoice(false)}
                        className="text-xs sm:text-sm text-muted-foreground hover:text-foreground transition-colors touch-target-44"
                    >
                        <ArrowRight className="w-4 h-4 inline rotate-180 mr-1" />
                        Back to network choice
                    </button>
                </motion.div>
            ) : (
                <div className="pt-2 space-y-2 sm:space-y-3">
                    <button
                        onClick={handleContinue}
                        className="group relative inline-flex items-center justify-center gap-2 px-6 sm:px-8 py-3 sm:py-4 bg-gradient-to-r from-emerald-500 via-cyan-500 to-lime-400 rounded-lg sm:rounded-xl font-semibold text-sm sm:text-base text-white shadow-lg shadow-emerald-500/25 hover:shadow-emerald-400/40 hover:scale-105 transition-all duration-300 touch-target-44 min-w-[160px]"
                    >
                        {selectedMode === 'local' ? "Let's Go!" : 'Start Setup'}
                        <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5 group-hover:translate-x-1 transition-transform" />
                    </button>
                    {selectedMode === 'local' && (
                        <p className="text-xs text-muted-foreground px-2">
                            You'll choose Quick Start or Custom next
                        </p>
                    )}
                </div>
            )}
        </motion.div>
    )
}
