import { useState, useEffect, useRef, useCallback, lazy, Suspense } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { AnimatePresence } from 'motion/react'
import { Sparkles, Settings, Layers, Server, Key, FileText, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

// Store
import { useSetupStore, initialConfig } from '../store/setupStore'

// Hooks
import { useConfigGenerators } from '../hooks/useConfigGenerators'
import { useFileDownload } from '../hooks/useFileDownload'
import { useWizardValidation } from '../hooks/useWizardValidation'
import { useVoicePlanHandler } from '../hooks/useVoicePlanHandler'
import { useProactiveSuggestions } from '../hooks/useProactiveSuggestions'

// Schemas
import {
    basicConfigSchema,
    advancedSettingsSchema,
    type BasicConfigFormData,
    type AdvancedSettingsFormData
} from '../schemas/setupSchema'

// Utils
import { importConfiguration, downloadAsFile } from '../utils/configManager'
import { Template } from '../data/templates'

// Components
import { GlassCard } from './ui/glass-card'
import { ProactiveSuggestionCard } from './ProactiveSuggestionCard'
import { TemplateSelector } from './TemplateSelector'
import { WelcomeStep } from './WelcomeStep'
import { ServiceConfigStep } from './ServiceConfigStep'
import { ValidationBadge } from './ValidationBadge'
import { useValidation } from '../hooks/useValidation'
import type { ValidationRequest } from '../types/validation'

// Wizard Components
import {
    WizardHeader,
    WizardProgressBar,
    WizardStepIndicator,
    WizardNavigation,
    DraftRecoveryModal,
    ProfilesPanel,
    ToolsDialog,
    VoiceCompanionTrigger,
    QuickStartStep,
    StackSelectionStep,
    BasicConfigurationStep,
    AdvancedSettingsStep,
    ReviewGenerateStep
} from './wizard'

// Lazy load VoiceCompanion (1,455 lines) for better initial bundle size
const VoiceCompanion = lazy(() => import('./VoiceCompanion').then(m => ({ default: m.VoiceCompanion })))

const steps = [
    { title: 'Welcome', icon: Sparkles },
    { title: 'Basic Config', icon: Settings },
    { title: 'Stack Selection', icon: Layers },
    { title: 'Service Config', icon: Server },
    { title: 'Advanced', icon: Key },
    { title: 'Review', icon: FileText }
]

export function SetupWizard() {
    const {
        currentStep, mode, selectedServices, config, appliedTemplateId,
        quickStartMode,
        updateConfig,
        nextStep, prevStep,
        loadTemplate, exportConfig, importConfig, resetWizard,
        hasRecoverableDraft, getRecoverableDraft, dismissDraft, restoreDraft
    } = useSetupStore()
    const [showTemplates, setShowTemplates] = useState(false)
    const [showProfiles, setShowProfiles] = useState(false)
    const [showVoiceCompanion, setShowVoiceCompanion] = useState(false)
    const [voiceHelperInitialized, setVoiceHelperInitialized] = useState(false)
    const [toolsOpen, setToolsOpen] = useState(false)
    const [showResetConfirm, setShowResetConfirm] = useState(false)
    const [showDraftRecovery, setShowDraftRecovery] = useState(false)
    const [draftInfo, setDraftInfo] = useState<{ savedAt: number; serviceCount: number } | null>(null)

    // Accessibility: Respect user's reduced motion preference
    const prefersReducedMotion = useReducedMotion()

    // Validation state - persists across steps
    const { result: validationResult, isValidating, error: validationError, validate } = useValidation({
        autoValidate: false,
        debounceMs: 500,
    })

    // Proactive suggestions based on current step and config
    const { suggestions, dismiss: dismissSuggestion } = useProactiveSuggestions(currentStep)

    // Config generators for YAML files
    const { generateAutheliaYaml, generateCloudflareYaml } = useConfigGenerators()

    // File download and clipboard utilities
    const { copied, copyToClipboard, downloadFile, downloadAllFiles, generateEnvFile } = useFileDownload()

    // Voice plan handler
    const { handleApplyVoicePlan } = useVoicePlanHandler()

    // Handle proactive suggestion actions
    const handleSuggestionAction = useCallback((suggestion: typeof suggestions[0]) => {
        suggestion.action()
        toast.success(`Applied: ${suggestion.text.replace('?', '')}`, {
            description: suggestion.description
        })
    }, [])

    // Auto-open voice companion for newbie mode
    useEffect(() => {
        if (mode === 'newbie' && !voiceHelperInitialized) {
            setShowVoiceCompanion(true)
            setVoiceHelperInitialized(true)
        }
    }, [mode, voiceHelperInitialized])

    // Trigger validation when reaching review step or when config changes significantly
    useEffect(() => {
        // Only validate on review step or advanced settings step
        if (currentStep !== 4 && currentStep !== 5) {
            return
        }

        // Build validation request based on current config
        const validators: ValidationRequest['validators'] = ['docker', 'path']

        // Add port validation if services are selected
        if (selectedServices.length > 0) {
            validators.push('port')
        }

        // Add VPN validation if VPN/torrent service is selected
        if (selectedServices.includes('vpn') || selectedServices.includes('torrent')) {
            validators.push('vpn')
        }

        // Add Cloudflare validation if in cloud mode
        if (config.deploymentMode === 'cloud' && config.cloudflareToken) {
            validators.push('cloudflare')
        }

        const validationRequest: ValidationRequest = {
            config: {
                dataRoot: config.storagePlan?.dataRoot || '/mnt/media',
                configRoot: config.storagePlan?.configRoot || '/opt/media-stack',
                domain: config.domain,
                cloudflareToken: config.cloudflareToken,
                wireguardPrivateKey: config.wireguardPrivateKey,
                wireguardAddresses: config.wireguardAddresses,
                selectedServices,
            },
            validators,
        }

        validate(validationRequest)
    }, [currentStep, config.storagePlan?.dataRoot, config.storagePlan?.configRoot, config.domain, config.cloudflareToken, config.wireguardPrivateKey, config.wireguardAddresses, config.deploymentMode, selectedServices, validate])

    // Apply voice plan to wizard
    const handleApplyVoicePlan = (plan: VoicePlanSummary) => {
        const appliedChanges: string[] = []

        if (plan.services?.length) {
            setSelectedServices(Array.from(new Set(plan.services)))
            appliedChanges.push(`${plan.services.length} services`)
        }
        const configUpdates: Partial<SetupConfig> = {}
        if (plan.domain) {
            configUpdates.domain = plan.domain
            appliedChanges.push(`domain: ${plan.domain}`)
        }
        if (Object.keys(configUpdates).length) {
            updateConfig(configUpdates)
        }
        if (plan.storagePaths?.media) {
            updateServiceConfig('plex', { mediaPath: plan.storagePaths.media })
            updateStoragePath('movies', { path: plan.storagePaths.media })
            updateStoragePath('tv', { path: plan.storagePaths.media })
            appliedChanges.push('media paths')
        }
        if (plan.storagePaths?.downloads) {
            updateServiceConfig('torrent', { downloadsPath: plan.storagePaths.downloads })
            updateStoragePath('downloads', { path: plan.storagePaths.downloads })
            appliedChanges.push('download paths')
        }
        setShowVoiceCompanion(false)

        // Agentic: Show success feedback and navigate to Stack Selection
        if (appliedChanges.length > 0) {
            toast.success('Voice plan applied!', {
                description: `Set up: ${appliedChanges.join(', ')}`,
                action: {
                    label: 'Undo',
                    onClick: () => {
                        setSelectedServices([])
                        updateConfig({ domain: '' })
                        toast.info('Plan changes undone')
                    }
                }
            })
            // Navigate to Stack Selection step to review services
            if (plan.services?.length && currentStep < 2) {
                setCurrentStep(2)
            }
        }
    }

    // Load config from URL on mount
    useEffect(() => {
        const params = new URLSearchParams(window.location.search)
        const configParam = params.get('config')
        if (configParam) {
            try {
                const decoded = atob(configParam)
                const data = JSON.parse(decoded)
                importConfig(data)
                // Clear URL param
                window.history.replaceState({}, '', window.location.pathname)
            } catch (error) {
                console.error('Failed to load shared config:', error)
            }
        }
    }, [])

    // Ref for the main content area
    const mainContentRef = useRef<HTMLDivElement>(null)

    // Scroll to content area when step changes, then focus first input
    useEffect(() => {
        // Scroll main content into view
        if (mainContentRef.current) {
            mainContentRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
        }

        // Focus first input after animation completes
        setTimeout(() => {
            const firstInput = document.querySelector('input:not([type="hidden"]), select, textarea') as HTMLElement
            if (firstInput && firstInput instanceof HTMLInputElement) {
                firstInput.focus()
            }
        }, 400) // Wait for framer-motion animation
    }, [currentStep])

    // Step 1 form (Basic Config)
    // Note: Type assertion needed for Zod 4 compatibility with @hookform/resolvers
    const step1Form = useForm<BasicConfigFormData>({
        resolver: zodResolver(basicConfigSchema as any),
        defaultValues: config,
        mode: 'onChange'
    })

    // Step 4 form (Advanced Settings)
    // Note: Type assertion needed for Zod 4 compatibility with @hookform/resolvers
    const step4Form = useForm<AdvancedSettingsFormData>({
        resolver: zodResolver(advancedSettingsSchema as any),
        defaultValues: {
            cloudflareToken: config.cloudflareToken,
            plexClaim: config.plexClaim,
            wireguardPrivateKey: config.wireguardPrivateKey,
            wireguardAddresses: config.wireguardAddresses,
        },
        mode: 'onChange'
    })

    // Form validation and step navigation
    const { handleNextStep, shakeField, setShakeField } = useWizardValidation(step1Form, step4Form)

    const handleTemplateSelect = (template: Template) => {
        loadTemplate(template.id, template.services, template.config)
        setShowTemplates(false)
    }

    const handleExport = () => {
        const json = exportConfig()
        downloadAsFile(json, 'mediastack-config.json')
    }

    const handleImport = () => {
        const input = document.createElement('input')
        input.type = 'file'
        input.accept = '.json'
        input.onchange = (e) => {
            const file = (e.target as HTMLInputElement).files?.[0]
            if (file) {
                const reader = new FileReader()
                reader.onload = (event) => {
                    try {
                        const json = event.target?.result as string
                        const data = importConfiguration(json)
                        if (data) {
                            importConfig(data)
                        } else {
                            toast.error('Invalid configuration file')
                        }
                    } catch (err) {
                        console.error('SetupWizard: failed to import configuration', err)
                        toast.error('Failed to import configuration')
                    }
                }
                reader.readAsText(file)
            }
        }
        input.click()
    }

    const handleReset = () => {
        if (showResetConfirm) {
            resetWizard()
            step1Form.reset(initialConfig)
            step4Form.reset({
                cloudflareToken: '',
                plexClaim: '',
                wireguardPrivateKey: '',
                wireguardAddresses: '',
            })
            setShowResetConfirm(false)
        } else {
            setShowResetConfirm(true)
            setTimeout(() => setShowResetConfirm(false), 10000)
        }
    }

    // Check for recoverable draft on initial mount
    useEffect(() => {
        const draft = hasRecoverableDraft()
        if (draft && currentStep === 0 && selectedServices.length === 0) {
            const draftData = getRecoverableDraft()
            if (draftData) {
                setDraftInfo({
                    savedAt: draftData.savedAt,
                    serviceCount: draftData.selectedServices.length,
                })
                setShowDraftRecovery(true)
            }
        }
    // Only run on mount - intentionally empty deps array
    }, [])

    const handleRestoreDraft = () => {
        restoreDraft()
        setShowDraftRecovery(false)
        setDraftInfo(null)
    }

    const handleDismissDraft = () => {
        dismissDraft()
        setShowDraftRecovery(false)
        setDraftInfo(null)
    }

    return (
        <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900">
            {/* Animated background elements */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl" />
                <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl" />
            </div>

            <div className="relative z-10">
                {/* Main container */}
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                    {/* Header with navigation */}
                    <div className="mb-12">
                        <div className="flex items-center justify-between mb-8">
                            <div>
                                <h1 className="text-4xl font-bold text-white mb-2">Media Stack Setup</h1>
                                <p className="text-slate-400">Configure your self-hosted media solution</p>
                            </div>

                            {/* Mode and quick actions */}
                            <div className="flex items-center gap-4">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setToolsOpen(!toolsOpen)}
                                    className="gap-2"
                                >
                                    <MoreHorizontal className="w-4 h-4" />
                                    Tools
                                </Button>

                                {/* Tools menu */}
                                {toolsOpen && (
                                    <GlassCard className="absolute right-0 top-full mt-2 p-2 min-w-max z-50">
                                        <div className="flex flex-col gap-1">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => {
                                                    setShowTemplates(true)
                                                    setToolsOpen(false)
                                                }}
                                                className="gap-2"
                                            >
                                                <Layers className="w-4 h-4" />
                                                Templates
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => {
                                                    setShowProfiles(true)
                                                    setToolsOpen(false)
                                                }}
                                                className="gap-2"
                                            >
                                                <Save className="w-4 h-4" />
                                                Profiles
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={handleExport}
                                                className="gap-2"
                                            >
                                                <FileDown className="w-4 h-4" />
                                                Export
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={handleImport}
                                                className="gap-2"
                                            >
                                                <FileUp className="w-4 h-4" />
                                                Import
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={handleReset}
                                                className="gap-2"
                                            >
                                                <RotateCcw className="w-4 h-4" />
                                                {showResetConfirm ? 'Confirm Reset?' : 'Reset'}
                                            </Button>
                                        </div>
                                    </GlassCard>
                                )}
                            </div>
                        </div>

                        {/* Step indicator */}
                        <div className="flex items-center gap-2 overflow-x-auto pb-2">
                            {steps.map((step, index) => {
                                const isActive = index === currentStep
                                const isCompleted = index < currentStep
                                const Icon = step.icon

                                return (
                                    <motion.button
                                        key={index}
                                        onClick={() => {
                                            if (index < currentStep) {
                                                setCurrentStep(index)
                                            }
                                        }}
                                        disabled={index > currentStep}
                                        className={`flex items-center gap-2 px-4 py-2 rounded-lg whitespace-nowrap transition-all ${
                                            isActive
                                                ? 'bg-blue-600 text-white'
                                                : isCompleted
                                                  ? 'bg-green-600/20 text-green-400 hover:bg-green-600/30'
                                                  : 'bg-slate-700/50 text-slate-400 cursor-not-allowed'
                                        }`}
                                        whileHover={index < currentStep ? { scale: 1.05 } : {}}
                                    >
                                        {isCompleted ? (
                                            <Check className="w-4 h-4" />
                                        ) : (
                                            <Icon className="w-4 h-4" />
                                        )}
                                        <span className="text-sm font-medium">{step.title}</span>
                                    </motion.button>
                                )
                            })}
                        </div>
                    </div>

                    {/* Draft recovery dialog */}
                    <Dialog open={showDraftRecovery} onOpenChange={setShowDraftRecovery}>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>Recover Previous Session?</DialogTitle>
                                <DialogDescription>
                                    We found a previous configuration with {draftInfo?.serviceCount} services.
                                    {draftInfo?.savedAt && (
                                        <div className="mt-2 text-sm">
                                            Saved {new Date(draftInfo.savedAt).toLocaleTimeString()}
                                        </div>
                                    )}
                                </DialogDescription>
                            </DialogHeader>
                            <div className="flex gap-2 justify-end">
                                <Button variant="outline" onClick={handleDismissDraft}>
                                    Dismiss
                                </Button>
                                <Button onClick={handleRestoreDraft}>Recover</Button>
                            </div>
                        </DialogContent>
                    </Dialog>

                    {/* Main content area */}
                    <div ref={mainContentRef} className="mt-8">
                        <AnimatePresence mode="wait">
                            {currentStep === 0 && (
                                <motion.div key="welcome" {...fadeInUp}>
                                    <WelcomeStep
                                        onVoiceClick={() => setShowVoiceCompanion(true)}
                                    />
                                </motion.div>
                            )}

                            {currentStep === 1 && (
                                <motion.div key="basic-config" {...fadeInUp}>
                                    <BasicConfigurationStep
                                        form={step1Form}
                                        shakeField={shakeField}
                                    />
                                </motion.div>
                            )}

                            {currentStep === 2 && (
                                <motion.div key="stack-selection" {...fadeInUp}>
                                    <StackSelectionStep />
                                </motion.div>
                            )}

                            {currentStep === 3 && (
                                <motion.div key="service-config" {...fadeInUp}>
                                    <ServiceConfigStep />
                                </motion.div>
                            )}

                            {currentStep === 4 && (
                                <motion.div key="advanced-settings" {...fadeInUp}>
                                    <AdvancedSettingsStep form={step4Form} />
                                </motion.div>
                            )}

                            {currentStep === 5 && (
                                <motion.div key="review-generate" {...fadeInUp}>
                                    <ReviewGenerateStep
                                        validationResult={validationResult}
                                        isValidating={isValidating}
                                        validationError={validationError}
                                    />
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>

                    {/* Navigation buttons */}
                    <div className="flex items-center justify-between mt-12">
                        <Button
                            variant="outline"
                            onClick={prevStep}
                            disabled={currentStep === 0}
                            className="gap-2"
                        >
                            <ArrowLeft className="w-4 h-4" />
                            Previous
                        </Button>

                        {/* Proactive suggestions */}
                        {suggestions.length > 0 && (
                            <div className="flex gap-2">
                                {suggestions.map((suggestion, index) => (
                                    <ProactiveSuggestionCard
                                        key={index}
                                        suggestion={suggestion}
                                        onAction={() => {
                                            handleSuggestionAction(suggestion)
                                            dismissSuggestion(index)
                                        }}
                                        onDismiss={() => dismissSuggestion(index)}
                                    />
                                ))}
                            </div>
                        )}

                        <Button
                            onClick={handleNextStep}
                            disabled={currentStep === 5}
                            className="gap-2"
                        >
                            {currentStep === 5 ? 'Complete' : 'Next'}
                            {currentStep !== 5 && <ArrowRight className="w-4 h-4" />}
                        </Button>
                    </div>
                </div>
            </div>

            {/* Voice companion modal */}
            {showVoiceCompanion && (
                <Suspense fallback={<div className="flex items-center justify-center p-8"><Loader2 className="w-8 h-8 animate-spin" /></div>}>
                    <VoiceCompanion
                        isOpen={showVoiceCompanion}
                        onClose={() => setShowVoiceCompanion(false)}
                        onPlanApplied={handleApplyVoicePlan}
                    />
                </Suspense>
            )}

            {/* Template selector modal */}
            {showTemplates && (
                <TemplateSelector
                    onSelect={handleTemplateSelect}
                    onClose={() => setShowTemplates(false)}
                />
            )}

            {/* Profile manager modal */}
            {showProfiles && (
                <Dialog open={showProfiles} onOpenChange={setShowProfiles}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Save/Load Profiles</DialogTitle>
                            <DialogDescription>
                                Save your current configuration or load a previous one
                            </DialogDescription>
                        </DialogHeader>

                        <div className="space-y-4">
                            {/* Save profile */}
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    placeholder="Profile name"
                                    value={newProfileName}
                                    onChange={(e) => setNewProfileName(e.target.value)}
                                    className="flex-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500"
                                />
                                <Button onClick={handleSaveProfile} size="sm">
                                    <Save className="w-4 h-4 mr-1" />
                                    Save
                                </Button>
                            </div>

                            {/* Load profiles */}
                            <div className="space-y-2 max-h-64 overflow-y-auto">
                                {savedProfiles.length === 0 ? (
                                    <p className="text-sm text-slate-400">No saved profiles</p>
                                ) : (
                                    savedProfiles.map((profile) => (
                                        <div
                                            key={profile}
                                            className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg"
                                        >
                                            <span className="text-sm text-slate-300">{profile}</span>
                                            <div className="flex gap-2">
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => {
                                                        loadProfile(profile)
                                                        setShowProfiles(false)
                                                    }}
                                                >
                                                    Load
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => deleteProfile(profile)}
                                                    className="text-red-400 hover:text-red-300"
                                                >
                                                    Delete
                                                </Button>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </DialogContent>
                </Dialog>
            )}
        </div>
    )
}