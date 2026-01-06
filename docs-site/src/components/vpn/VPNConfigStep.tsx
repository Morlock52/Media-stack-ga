import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import {
    ArrowRight,
    ArrowLeft,
    Shield,
    Key,
    Upload,
    Zap,
    AlertCircle,
    CheckCircle,
    Info,
    Lock,
    Globe,
    FileText,
} from 'lucide-react'
import { useSetupStore } from '@/store/setupStore'
import { vpnProviders, type VPNProvider } from '@/data/vpnProviders'
import { VPNProviderSelector } from './VPNProviderSelector'
import { VPNCredentialForm } from './VPNCredentialForm'
import { WireGuardImport } from './WireGuardImport'
import { PortForwardingGuide } from './PortForwardingGuide'
import { VPNTroubleshooting } from './VPNTroubleshooting'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

// VPN configuration sub-steps
type VPNSubStep =
    | 'provider-selection'
    | 'credential-input'
    | 'wireguard-import'
    | 'kill-switch'
    | 'port-forwarding'
    | 'troubleshooting'

interface SubStepConfig {
    id: VPNSubStep
    title: string
    description: string
    icon: any
    optional?: boolean
}

const subSteps: SubStepConfig[] = [
    {
        id: 'provider-selection',
        title: 'Select Provider',
        description: 'Choose your VPN provider',
        icon: Shield,
    },
    {
        id: 'credential-input',
        title: 'Enter Credentials',
        description: 'Configure VPN authentication',
        icon: Key,
    },
    {
        id: 'kill-switch',
        title: 'Kill Switch',
        description: 'Ensure traffic protection',
        icon: Lock,
    },
    {
        id: 'port-forwarding',
        title: 'Port Forwarding',
        description: 'Optional: Configure port forwarding',
        icon: Zap,
        optional: true,
    },
    {
        id: 'troubleshooting',
        title: 'Troubleshooting',
        description: 'Common issues & solutions',
        icon: AlertCircle,
        optional: true,
    },
]

export function VPNConfigStep() {
    const { config, updateVpnConfig } = useSetupStore()
    const [currentSubStep, setCurrentSubStep] = useState<VPNSubStep>('provider-selection')
    const [completedSubSteps, setCompletedSubSteps] = useState<Set<VPNSubStep>>(new Set())
    const [credentialsValid, setCredentialsValid] = useState(false)
    const [showWireGuardImport, setShowWireGuardImport] = useState(false)
    const [killSwitchEnabled, setKillSwitchEnabled] = useState(true) // Default enabled

    // Get selected provider
    const selectedProvider = config.selectedVpnProvider
        ? vpnProviders.find((p) => p.id === config.selectedVpnProvider)
        : null

    // Determine which sub-steps are relevant based on provider selection
    const relevantSubSteps = subSteps.filter((step) => {
        if (step.id === 'port-forwarding' && (!selectedProvider || !selectedProvider.portForwarding.supported)) {
            return false
        }
        if (step.id === 'credential-input' && showWireGuardImport) {
            return false // Skip credential input if using WireGuard import
        }
        if (step.id === 'wireguard-import' && !showWireGuardImport) {
            return false
        }
        return true
    })

    // Save kill switch state to store
    useEffect(() => {
        updateVpnConfig({ killSwitchEnabled })
    }, [killSwitchEnabled, updateVpnConfig])

    // Auto-complete provider selection step when provider is selected
    useEffect(() => {
        if (selectedProvider && currentSubStep === 'provider-selection') {
            setCompletedSubSteps((prev) => new Set(prev).add('provider-selection'))
        }
    }, [selectedProvider, currentSubStep])

    // Mark kill switch step as completed when enabled
    useEffect(() => {
        if (killSwitchEnabled) {
            setCompletedSubSteps((prev) => new Set(prev).add('kill-switch'))
        }
    }, [killSwitchEnabled])

    const handleProviderSelected = (provider: VPNProvider) => {
        setCompletedSubSteps((prev) => new Set(prev).add('provider-selection'))

        // Check if provider is Custom WireGuard
        if (provider.id === 'custom') {
            setShowWireGuardImport(true)
            setCurrentSubStep('wireguard-import')
        } else {
            setShowWireGuardImport(false)
            setCurrentSubStep('credential-input')
        }
    }

    const handleCredentialsValidated = (isValid: boolean) => {
        setCredentialsValid(isValid)
        if (isValid) {
            setCompletedSubSteps((prev) => new Set(prev).add('credential-input'))
        } else {
            setCompletedSubSteps((prev) => {
                const next = new Set(prev)
                next.delete('credential-input')
                return next
            })
        }
    }

    const handleWireGuardImportComplete = () => {
        setCompletedSubSteps((prev) => new Set(prev).add('wireguard-import'))
        updateVpnConfig({ wireguardConfigImported: true })
    }

    const canNavigateToSubStep = (stepId: VPNSubStep): boolean => {
        const stepIndex = relevantSubSteps.findIndex((s) => s.id === stepId)
        if (stepIndex === 0) return true

        // Check if all previous required steps are completed
        for (let i = 0; i < stepIndex; i++) {
            const step = relevantSubSteps[i]
            if (!step.optional && !completedSubSteps.has(step.id)) {
                return false
            }
        }
        return true
    }

    const handleNextSubStep = () => {
        const currentIndex = relevantSubSteps.findIndex((s) => s.id === currentSubStep)
        if (currentIndex < relevantSubSteps.length - 1) {
            const nextStep = relevantSubSteps[currentIndex + 1]
            setCurrentSubStep(nextStep.id)
        }
    }

    const handlePrevSubStep = () => {
        const currentIndex = relevantSubSteps.findIndex((s) => s.id === currentSubStep)
        if (currentIndex > 0) {
            const prevStep = relevantSubSteps[currentIndex - 1]
            setCurrentSubStep(prevStep.id)
        }
    }

    const isCurrentSubStepValid = (): boolean => {
        switch (currentSubStep) {
            case 'provider-selection':
                return !!selectedProvider
            case 'credential-input':
                return credentialsValid
            case 'wireguard-import':
                return config.wireguardConfigImported || false
            case 'kill-switch':
                return true // Always valid, just informational
            case 'port-forwarding':
                return true // Optional, always valid
            case 'troubleshooting':
                return true // Optional, always valid
            default:
                return false
        }
    }

    const currentStepIndex = relevantSubSteps.findIndex((s) => s.id === currentSubStep)
    const isFirstStep = currentStepIndex === 0
    const isLastStep = currentStepIndex === relevantSubSteps.length - 1

    return (
        <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-6"
        >
            {/* Header */}
            <div className="mb-6">
                <h2 className="text-2xl font-bold text-foreground mb-2">VPN Configuration</h2>
                <p className="text-muted-foreground">
                    Configure your VPN provider for secure torrenting with Gluetun
                </p>
            </div>

            {/* Info Banner */}
            <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl flex items-start gap-3">
                <Info className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
                <div className="text-sm">
                    <p className="text-blue-200 font-medium">
                        VPN protects your torrenting activity and enables port forwarding
                    </p>
                    <p className="text-blue-300/70 mt-1">
                        We'll guide you through selecting a provider, entering credentials, and configuring
                        security features.
                    </p>
                </div>
            </div>

            {/* Sub-step Progress Indicator */}
            <div className="bg-card/40 border border-border rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-foreground">Configuration Steps</h3>
                    <span className="text-xs text-muted-foreground">
                        Step {currentStepIndex + 1} of {relevantSubSteps.length}
                    </span>
                </div>

                {/* Progress Bar */}
                <div className="h-2 bg-muted/40 rounded-full overflow-hidden mb-4">
                    <motion.div
                        className="h-full bg-gradient-to-r from-emerald-500 via-cyan-500 to-lime-400"
                        initial={{ width: 0 }}
                        animate={{
                            width: `${((currentStepIndex + 1) / relevantSubSteps.length) * 100}%`,
                        }}
                        transition={{ duration: 0.3 }}
                    />
                </div>

                {/* Sub-step Pills */}
                <div className="flex flex-wrap gap-2">
                    {relevantSubSteps.map((step, index) => {
                        const Icon = step.icon
                        const isActive = step.id === currentSubStep
                        const isCompleted = completedSubSteps.has(step.id)
                        const isAccessible = canNavigateToSubStep(step.id)

                        return (
                            <button
                                key={step.id}
                                onClick={() => isAccessible && setCurrentSubStep(step.id)}
                                disabled={!isAccessible}
                                className={cn(
                                    'flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all',
                                    isActive &&
                                        'bg-primary/20 text-primary border border-primary/40 ring-2 ring-primary/30',
                                    !isActive &&
                                        isCompleted &&
                                        'bg-green-500/20 text-green-300 border border-green-500/40 hover:bg-green-500/30 cursor-pointer',
                                    !isActive &&
                                        !isCompleted &&
                                        isAccessible &&
                                        'bg-muted/40 text-muted-foreground border border-border hover:bg-muted/60 cursor-pointer',
                                    !isAccessible &&
                                        'bg-muted/20 text-muted-foreground/50 border border-border/50 cursor-not-allowed opacity-50'
                                )}
                                title={step.description}
                            >
                                {isCompleted ? (
                                    <CheckCircle className="w-3 h-3" />
                                ) : (
                                    <Icon className="w-3 h-3" />
                                )}
                                <span>{step.title}</span>
                                {step.optional && (
                                    <span className="text-[10px] opacity-60">(Optional)</span>
                                )}
                            </button>
                        )
                    })}
                </div>
            </div>

            {/* Main Content Area */}
            <div className="bg-black/20 rounded-xl border border-white/10 p-6 min-h-[500px]">
                <AnimatePresence mode="wait">
                    {/* Provider Selection */}
                    {currentSubStep === 'provider-selection' && (
                        <motion.div
                            key="provider-selection"
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                        >
                            <VPNProviderSelector onProviderSelected={handleProviderSelected} />
                        </motion.div>
                    )}

                    {/* Credential Input */}
                    {currentSubStep === 'credential-input' && selectedProvider && (
                        <motion.div
                            key="credential-input"
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                        >
                            <div className="mb-4">
                                <h3 className="text-xl font-semibold text-foreground mb-2 flex items-center gap-2">
                                    <Key className="w-5 h-5 text-primary" />
                                    {selectedProvider.name} Credentials
                                </h3>
                                <p className="text-sm text-muted-foreground">
                                    Enter your {selectedProvider.name} credentials to configure Gluetun
                                </p>
                            </div>

                            {/* Protocol Toggle */}
                            <div className="mb-6 p-4 bg-card/40 border border-border rounded-xl">
                                <label className="text-sm font-medium text-foreground mb-3 block">
                                    VPN Protocol
                                </label>
                                <div className="flex gap-3">
                                    {selectedProvider.protocols.map((protocol) => (
                                        <button
                                            key={protocol}
                                            onClick={() => updateVpnConfig({ vpnProtocol: protocol })}
                                            className={cn(
                                                'flex-1 px-4 py-3 rounded-lg border transition-all text-sm font-medium',
                                                config.vpnProtocol === protocol
                                                    ? 'bg-primary/20 border-primary/40 text-primary'
                                                    : 'bg-muted/40 border-border text-muted-foreground hover:bg-muted/60'
                                            )}
                                        >
                                            <div className="flex items-center justify-center gap-2">
                                                <Globe className="w-4 h-4" />
                                                <span className="uppercase">{protocol}</span>
                                                {protocol === selectedProvider.recommendedProtocol && (
                                                    <span className="text-xs px-2 py-0.5 bg-green-500/20 text-green-300 rounded">
                                                        Recommended
                                                    </span>
                                                )}
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <VPNCredentialForm
                                provider={selectedProvider}
                                onValidationChange={handleCredentialsValidated}
                            />
                        </motion.div>
                    )}

                    {/* WireGuard Import */}
                    {currentSubStep === 'wireguard-import' && selectedProvider?.id === 'custom' && (
                        <motion.div
                            key="wireguard-import"
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                        >
                            <div className="mb-4">
                                <h3 className="text-xl font-semibold text-foreground mb-2 flex items-center gap-2">
                                    <Upload className="w-5 h-5 text-primary" />
                                    Import WireGuard Configuration
                                </h3>
                                <p className="text-sm text-muted-foreground">
                                    Upload or paste your WireGuard .conf file
                                </p>
                            </div>

                            <WireGuardImport onImportComplete={handleWireGuardImportComplete} />
                        </motion.div>
                    )}

                    {/* Kill Switch Configuration */}
                    {currentSubStep === 'kill-switch' && (
                        <motion.div
                            key="kill-switch"
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                        >
                            <div className="mb-4">
                                <h3 className="text-xl font-semibold text-foreground mb-2 flex items-center gap-2">
                                    <Lock className="w-5 h-5 text-primary" />
                                    Kill Switch Protection
                                </h3>
                                <p className="text-sm text-muted-foreground">
                                    Prevent traffic leaks if VPN connection drops
                                </p>
                            </div>

                            <div className="space-y-6">
                                {/* Kill Switch Toggle */}
                                <div className="p-6 bg-card/40 border border-border rounded-xl">
                                    <div className="flex items-start justify-between gap-4">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-2">
                                                <Shield className="w-5 h-5 text-green-400" />
                                                <h4 className="text-lg font-semibold text-foreground">
                                                    Enable Kill Switch
                                                </h4>
                                                <span className="text-xs px-2 py-0.5 bg-green-500/20 text-green-300 rounded">
                                                    Recommended
                                                </span>
                                            </div>
                                            <p className="text-sm text-muted-foreground mb-3">
                                                The kill switch blocks all internet traffic if the VPN connection
                                                fails, ensuring your real IP is never exposed. This is critical for
                                                privacy-sensitive applications like torrenting.
                                            </p>
                                            <div className="text-xs text-muted-foreground space-y-1">
                                                <p>✓ Blocks all traffic if VPN disconnects</p>
                                                <p>✓ Prevents IP leaks during reconnection</p>
                                                <p>✓ Protects DNS queries from leaking</p>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => setKillSwitchEnabled(!killSwitchEnabled)}
                                            className={cn(
                                                'relative w-14 h-8 rounded-full transition-all',
                                                killSwitchEnabled
                                                    ? 'bg-green-500'
                                                    : 'bg-muted-foreground/30'
                                            )}
                                            aria-label="Toggle kill switch"
                                        >
                                            <motion.div
                                                className="absolute top-1 w-6 h-6 bg-white rounded-full shadow-md"
                                                animate={{ left: killSwitchEnabled ? '28px' : '4px' }}
                                                transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                                            />
                                        </button>
                                    </div>
                                </div>

                                {/* How It Works */}
                                <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl">
                                    <div className="flex items-start gap-3">
                                        <Info className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
                                        <div className="text-sm">
                                            <p className="text-blue-200 font-medium mb-2">How the Kill Switch Works</p>
                                            <p className="text-blue-300/70 mb-2">
                                                Gluetun's firewall (via FIREWALL env var) creates iptables rules that:
                                            </p>
                                            <ol className="text-blue-300/70 space-y-1 text-xs list-decimal list-inside">
                                                <li>Allow traffic only through the VPN interface</li>
                                                <li>Block all traffic if VPN connection drops</li>
                                                <li>Permit traffic to your local network (LAN_NETWORK)</li>
                                                <li>Automatically restore protection when VPN reconnects</li>
                                            </ol>
                                        </div>
                                    </div>
                                </div>

                                {/* Warning if disabled */}
                                {!killSwitchEnabled && (
                                    <motion.div
                                        initial={{ opacity: 0, scale: 0.95 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl"
                                    >
                                        <div className="flex items-start gap-3">
                                            <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                                            <div className="text-sm">
                                                <p className="text-red-200 font-medium mb-1">
                                                    Warning: Kill Switch Disabled
                                                </p>
                                                <p className="text-red-300/70">
                                                    Your real IP address may be exposed if the VPN connection drops.
                                                    We strongly recommend keeping the kill switch enabled for privacy
                                                    protection.
                                                </p>
                                            </div>
                                        </div>
                                    </motion.div>
                                )}
                            </div>
                        </motion.div>
                    )}

                    {/* Port Forwarding */}
                    {currentSubStep === 'port-forwarding' && selectedProvider && (
                        <motion.div
                            key="port-forwarding"
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                        >
                            <div className="mb-4">
                                <h3 className="text-xl font-semibold text-foreground mb-2 flex items-center gap-2">
                                    <Zap className="w-5 h-5 text-emerald-400" />
                                    Port Forwarding Setup
                                </h3>
                                <p className="text-sm text-muted-foreground">
                                    Configure port forwarding for better torrent performance
                                </p>
                            </div>

                            <PortForwardingGuide provider={selectedProvider} />
                        </motion.div>
                    )}

                    {/* Troubleshooting */}
                    {currentSubStep === 'troubleshooting' && (
                        <motion.div
                            key="troubleshooting"
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                        >
                            <div className="mb-4">
                                <h3 className="text-xl font-semibold text-foreground mb-2 flex items-center gap-2">
                                    <FileText className="w-5 h-5 text-amber-400" />
                                    Troubleshooting Guide
                                </h3>
                                <p className="text-sm text-muted-foreground">
                                    Common VPN issues and how to fix them
                                </p>
                            </div>

                            <VPNTroubleshooting provider={selectedProvider || undefined} />
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* Navigation Buttons */}
            <div className="flex items-center justify-between pt-4">
                <Button
                    onClick={handlePrevSubStep}
                    disabled={isFirstStep}
                    variant="outline"
                    className="gap-2"
                >
                    <ArrowLeft className="w-4 h-4" />
                    Previous
                </Button>

                <div className="flex items-center gap-3">
                    {/* Validation Status */}
                    {!isCurrentSubStepValid() && !relevantSubSteps[currentStepIndex]?.optional && (
                        <div className="flex items-center gap-2 text-sm text-amber-400">
                            <AlertCircle className="w-4 h-4" />
                            <span>Complete this step to continue</span>
                        </div>
                    )}

                    {isCurrentSubStepValid() && (
                        <div className="flex items-center gap-2 text-sm text-green-400">
                            <CheckCircle className="w-4 h-4" />
                            <span>Step completed</span>
                        </div>
                    )}
                </div>

                <Button
                    onClick={handleNextSubStep}
                    disabled={
                        isLastStep ||
                        (!isCurrentSubStepValid() && !relevantSubSteps[currentStepIndex]?.optional)
                    }
                    variant="default"
                    className="gap-2 bg-gradient-to-r from-emerald-500 via-cyan-500 to-lime-400 hover:opacity-90"
                >
                    {isLastStep ? 'Complete' : 'Next'}
                    <ArrowRight className="w-4 h-4" />
                </Button>
            </div>

            {/* Summary Footer */}
            {selectedProvider && (
                <div className="mt-6 p-4 bg-card/40 border border-border rounded-xl">
                    <h4 className="text-sm font-semibold text-foreground mb-2">Configuration Summary</h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                        <div>
                            <span className="text-muted-foreground">Provider:</span>
                            <div className="text-foreground font-medium">{selectedProvider.name}</div>
                        </div>
                        <div>
                            <span className="text-muted-foreground">Protocol:</span>
                            <div className="text-foreground font-medium uppercase">
                                {config.vpnProtocol || selectedProvider.recommendedProtocol}
                            </div>
                        </div>
                        <div>
                            <span className="text-muted-foreground">Kill Switch:</span>
                            <div
                                className={cn(
                                    'font-medium',
                                    killSwitchEnabled ? 'text-green-400' : 'text-red-400'
                                )}
                            >
                                {killSwitchEnabled ? 'Enabled' : 'Disabled'}
                            </div>
                        </div>
                        <div>
                            <span className="text-muted-foreground">Port Forwarding:</span>
                            <div className="text-foreground font-medium">
                                {selectedProvider.portForwarding.supported ? 'Supported' : 'Not Supported'}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </motion.div>
    )
}
