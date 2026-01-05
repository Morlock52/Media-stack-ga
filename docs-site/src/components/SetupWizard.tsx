import { useState, useEffect, useRef, useCallback, useMemo, lazy, Suspense } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { motion, AnimatePresence } from 'motion/react'
import { useReducedMotion } from '../hooks/useReducedMotion'
import { useConfigGenerators } from '../hooks/useConfigGenerators'
import { useFileDownload } from '../hooks/useFileDownload'
import { useWizardValidation } from '../hooks/useWizardValidation'
import { useVoicePlanHandler } from '../hooks/useVoicePlanHandler'
import { toast } from 'sonner'
import {
    FileDown, FileUp, RotateCcw, Save,
    Sparkles, Mic, User, Settings, Layers, Server, Key, FileText, MoreHorizontal, Loader2
} from 'lucide-react'
import { useSetupStore, initialConfig } from '../store/setupStore'

// Lazy load VoiceCompanion (1,455 lines) for better initial bundle size
const VoiceCompanion = lazy(() => import('./VoiceCompanion').then(m => ({ default: m.VoiceCompanion })))
import { useProactiveSuggestions } from '../hooks/useProactiveSuggestions'
import { ProactiveSuggestionCard } from './ProactiveSuggestionCard'
import {
    basicConfigSchema,
    advancedSettingsSchema,
    type BasicConfigFormData,
    type AdvancedSettingsFormData
} from '../schemas/setupSchema'
import { TemplateSelector } from './TemplateSelector'
import { Template } from '../data/templates'
import { importConfiguration, downloadAsFile } from '../utils/configManager'
import { WelcomeStep } from './WelcomeStep'
import { ServiceConfigStep } from './ServiceConfigStep'

import { Button } from './ui/button'
import { GlassCard } from './ui/glass-card'
import { services } from '../data/services'

// New Step Components
import { BasicConfigurationStep } from './wizard/steps/BasicConfigurationStep'
import { StackSelectionStep } from './wizard/steps/StackSelectionStep'
import { AdvancedSettingsStep } from './wizard/steps/AdvancedSettingsStep'
import { ReviewGenerateStep } from './wizard/steps/ReviewGenerateStep'
import { QuickStartStep } from './wizard/steps/QuickStartStep'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog'
import { WizardHeader } from './wizard/WizardHeader'
import { WizardProgressBar } from './wizard/WizardProgressBar'
import { WizardStepIndicator } from './wizard/WizardStepIndicator'
import { WizardNavigation } from './wizard/WizardNavigation'

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
        currentStep, mode, selectedServices, config, savedProfiles, appliedTemplateId,
        quickStartMode,
        setMode, toggleService, updateConfig,
        nextStep, prevStep,
        loadTemplate, exportConfig, importConfig, resetWizard,
        saveProfile, deleteProfile, loadProfile,
        hasRecoverableDraft, getRecoverableDraft, dismissDraft, restoreDraft
    } = useSetupStore()
    const [showTemplates, setShowTemplates] = useState(false)
    const [showProfiles, setShowProfiles] = useState(false)
    const [newProfileName, setNewProfileName] = useState('')
    const [showVoiceCompanion, setShowVoiceCompanion] = useState(false)
    const [voiceHelperInitialized, setVoiceHelperInitialized] = useState(false)
    const [toolsOpen, setToolsOpen] = useState(false)

    // Accessibility: Respect user's reduced motion preference
    const prefersReducedMotion = useReducedMotion()

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

    // Animation variants that respect reduced motion
    const fadeInUp = useMemo(() => prefersReducedMotion
        ? { initial: {}, animate: {}, transition: { duration: 0 } }
        : { initial: { opacity: 0, y: 20 }, animate: { opacity: 1, y: 0 } },
        [prefersReducedMotion]
    )

    const scaleIn = useMemo(() => prefersReducedMotion
        ? { initial: {}, animate: {}, exit: {}, transition: { duration: 0 } }
        : { initial: { scale: 0, opacity: 0 }, animate: { scale: 1, opacity: 1 }, exit: { scale: 0, opacity: 0 } },
        [prefersReducedMotion]
    )

    // Auto-open voice companion for newbie mode
    useEffect(() => {
        if (mode === 'newbie' && !voiceHelperInitialized) {
            setShowVoiceCompanion(true)
            setVoiceHelperInitialized(true)
        }
    }, [mode, voiceHelperInitialized])

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

    const [showResetConfirm, setShowResetConfirm] = useState(false)
    const [showDraftRecovery, setShowDraftRecovery] = useState(false)
    const [draftInfo, setDraftInfo] = useState<{ savedAt: number; serviceCount: number } | null>(null)

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

    const handleSaveProfile = () => {
        if (!newProfileName.trim()) return
        saveProfile(newProfileName)
        setNewProfileName('')
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

    const handleShare = () => {
        const data = { mode, selectedServices, config }
        const encoded = btoa(JSON.stringify(data))
        const url = `${window.location.origin}${window.location.pathname}?config=${encoded}`
        navigator.clipboard
            .writeText(url)
            .then(() => {
                toast.success('Share link copied to clipboard!')
            })
            .catch((err) => {
                console.error('SetupWizard: failed to copy share link', err)
                toast.error('Failed to copy share link')
            })
    }

    return (
        <>
            <Suspense fallback={
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
                    <div className="bg-card border border-border rounded-xl shadow-2xl px-4 py-3 flex items-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span className="text-sm">Loading voice assistant…</span>
                    </div>
                </div>
            }>
                <VoiceCompanion
                    isOpen={showVoiceCompanion}
                    onClose={() => setShowVoiceCompanion(false)}
                    onApplyPlan={(plan) => handleApplyVoicePlan(plan, () => setShowVoiceCompanion(false))}
                    templateMode={mode}
                />
            </Suspense>

            {/* Floating Voice Companion Trigger */}
            {mode === 'newbie' && !showVoiceCompanion && (
                <motion.button
                    {...scaleIn}
                    onClick={() => setShowVoiceCompanion(true)}
                    className="fixed bottom-24 right-6 z-40 p-4 rounded-2xl bg-gradient-to-r from-emerald-500 via-cyan-500 to-lime-400 text-white shadow-2xl shadow-emerald-500/30 hover:scale-105 transition-transform"
                    title="Talk through my setup with AI"
                >
                    <Mic className="w-6 h-6" />
                </motion.button>
            )}

            {/* Proactive Suggestions - Agentic AI assistance */}
            <ProactiveSuggestionCard
                suggestions={suggestions}
                onDismiss={dismissSuggestion}
                onAction={handleSuggestionAction}
            />

            {/* Draft Recovery Modal */}
            <AnimatePresence>
                {showDraftRecovery && draftInfo && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm"
                    >
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            className="bg-card border border-border rounded-2xl shadow-2xl max-w-md w-full p-6"
                        >
                            <div className="flex items-start gap-4">
                                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                                    <Save className="w-6 h-6 text-primary" />
                                </div>
                                <div className="flex-1">
                                    <h3 className="text-lg font-semibold text-foreground mb-1">
                                        Resume Your Setup?
                                    </h3>
                                    <p className="text-sm text-muted-foreground mb-4">
                                        We found an unsaved configuration from{' '}
                                        {new Date(draftInfo.savedAt).toLocaleDateString(undefined, {
                                            month: 'short',
                                            day: 'numeric',
                                            hour: 'numeric',
                                            minute: '2-digit'
                                        })}
                                        {draftInfo.serviceCount > 0 && (
                                            <> with <strong>{draftInfo.serviceCount} services</strong> selected</>
                                        )}.
                                    </p>
                                    <div className="flex gap-2">
                                        <Button
                                            onClick={handleRestoreDraft}
                                            className="flex-1"
                                        >
                                            <RotateCcw className="w-4 h-4 mr-2" />
                                            Resume
                                        </Button>
                                        <Button
                                            variant="outline"
                                            onClick={handleDismissDraft}
                                            className="flex-1"
                                        >
                                            Start Fresh
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            <div className="min-h-screen pt-24 pb-28 px-4 sm:px-6 lg:px-8">
                <div className="max-w-5xl mx-auto">
                    {/* Header */}
                    <WizardHeader
                        onResetClick={handleReset}
                        showResetConfirm={showResetConfirm}
                        onProfilesClick={() => setShowProfiles(!showProfiles)}
                        onToolsClick={() => setToolsOpen(true)}
                    />

                    {/* Tools Dialog */}
                    <Dialog open={toolsOpen} onOpenChange={setToolsOpen}>
                        <DialogContent className="max-w-xl">
                            <DialogHeader>
                                <DialogTitle>Wizard Tools</DialogTitle>
                                <DialogDescription>
                                    Import/export your configuration or start from a curated template.
                                </DialogDescription>
                            </DialogHeader>

                            <div className="grid gap-3">
                                <Button
                                    type="button"
                                    variant="outline"
                                    className="justify-start"
                                    onClick={() => {
                                        setToolsOpen(false)
                                        setShowTemplates(true)
                                    }}
                                >
                                    <Sparkles className="w-4 h-4" />
                                    Browse Templates
                                </Button>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        className="justify-start"
                                        onClick={() => {
                                            setToolsOpen(false)
                                            handleExport()
                                        }}
                                        title="Export current configuration"
                                    >
                                        <FileDown className="w-4 h-4" />
                                        Export Config
                                    </Button>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        className="justify-start"
                                        onClick={() => {
                                            setToolsOpen(false)
                                            handleImport()
                                        }}
                                        title="Import a saved configuration"
                                    >
                                        <FileUp className="w-4 h-4" />
                                        Import Config
                                    </Button>
                                </div>
                            </div>
                        </DialogContent>
                    </Dialog>

                    {/* Profiles Modal */}
                    <AnimatePresence>
                        {showProfiles && (
                            <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                                className="mb-8 overflow-hidden"
                            >
                                <div className="glass-ultra rounded-xl p-6 border border-blue-500/20 max-w-2xl mx-auto">
                                    <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                                        <User className="w-5 h-5 text-blue-400" />
                                        Saved Profiles
                                    </h3>

                                    <div className="flex gap-2 mb-6">
                                        <input
                                            type="text"
                                            value={newProfileName}
                                            onChange={(e) => setNewProfileName(e.target.value)}
                                            placeholder="Profile Name (e.g., 'Home Server')"
                                            className="flex-1 bg-background border border-border rounded-lg px-4 py-2 text-sm text-foreground focus:border-blue-500/50 outline-none"
                                            onKeyDown={(e) => e.key === 'Enter' && handleSaveProfile()}
                                        />
                                        <button
                                            onClick={handleSaveProfile}
                                            disabled={!newProfileName.trim()}
                                            className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            Save Current
                                        </button>
                                    </div>

                                    <div className="space-y-2 max-h-60 overflow-y-auto custom-scrollbar">
                                        {Object.keys(savedProfiles).length === 0 ? (
                                            <p className="text-center text-muted-foreground py-4">No saved profiles yet.</p>
                                        ) : (
                                            Object.entries(savedProfiles).map(([name, profile]) => (
                                                <div key={name} className="flex items-center justify-between p-3 bg-muted/40 rounded-lg border border-border hover:border-primary/40 transition-all">
                                                    <div>
                                                        <div className="font-medium text-foreground">{name}</div>
                                                        <div className="text-xs text-muted-foreground">
                                                            {profile.selectedServices.length} services • {profile.mode || 'Custom'}
                                                        </div>
                                                    </div>
                                                    <div className="flex gap-2">
                                                        <button
                                                            onClick={() => {
                                                                loadProfile(name)
                                                                setShowProfiles(false)
                                                            }}
                                                            className="p-2 hover:bg-green-500/20 text-muted-foreground hover:text-green-600 rounded-lg transition-colors"
                                                            title="Load Profile"
                                                        >
                                                            <FileUp className="w-4 h-4" />
                                                        </button>
                                                        <button
                                                            onClick={() => deleteProfile(name)}
                                                            className="p-2 hover:bg-red-500/20 text-muted-foreground hover:text-red-600 rounded-lg transition-colors"
                                                            title="Delete Profile"
                                                        >
                                                            <RotateCcw className="w-4 h-4 rotate-45" />
                                                        </button>
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Progress Bar */}
                    <WizardProgressBar steps={steps} />

                    {/* Progress Steps - Click to navigate to completed steps */}
                    <WizardStepIndicator steps={steps} />

                    {/* Main Content */}
                    <div ref={mainContentRef} className="scroll-mt-24">
                        {showTemplates ? (
                            <GlassCard
                                blur="lg"
                                variant="accent"
                                className="p-8 min-h-[500px] transition-all duration-300"
                            >
                                <TemplateSelector
                                    onSelectTemplate={handleTemplateSelect}
                                    onSkip={() => setShowTemplates(false)}
                                />
                            </GlassCard>
                        ) : (
                            <GlassCard
                                blur="lg"
                                variant="default"
                                className="p-8 min-h-[500px] transition-all duration-300 hover:bg-white/20"
                            >
                            <AnimatePresence mode="wait">
                                {/* Step 0: Welcome */}
                                {currentStep === 0 && <WelcomeStep />}

                                {/* Step 1: Quick Start (if enabled) or Basic Configuration */}
                                {currentStep === 1 && quickStartMode && <QuickStartStep />}
                                {currentStep === 1 && !quickStartMode && (
                                    <BasicConfigurationStep
                                        form={step1Form}
                                        shakeField={shakeField}
                                    />
                                )}

                                {/* Step 2: Stack Selection */}
                                {currentStep === 2 && (
                                    <StackSelectionStep
                                        mode={mode}
                                        setMode={setMode}
                                        selectedServices={selectedServices}
                                        services={services}
                                        toggleService={toggleService}
                                    />
                                )}

                                {/* Step 3: Service Configuration */}
                                {currentStep === 3 && <ServiceConfigStep />}

                                {/* Step 4: Advanced Settings */}
                                {currentStep === 4 && (
                                    <AdvancedSettingsStep
                                        form={step4Form}
                                        selectedServices={selectedServices}
                                    />
                                )}

                                {/* Step 5: Review & Generate */}
                                {currentStep === 5 && (
                                    <ReviewGenerateStep
                                        config={config}
                                        mode={mode}
                                        selectedServices={selectedServices}
                                        appliedTemplateId={appliedTemplateId}
                                        generateEnvFile={generateEnvFile}
                                        generateAutheliaYaml={generateAutheliaYaml}
                                        generateCloudflareYaml={generateCloudflareYaml}
                                        copyToClipboard={copyToClipboard}
                                        downloadFile={downloadFile}
                                        downloadAllFiles={downloadAllFiles}
                                        handleShare={handleShare}
                                        copied={copied}
                                    />
                                )}
                            </AnimatePresence>
                        </GlassCard>
                        )}
                    </div>

                    {/* Navigation Buttons - hidden for QuickStartStep which has its own button */}
                    {currentStep > 0 && !(quickStartMode && currentStep === 1) && (
                        <WizardNavigation
                            onNext={handleNextStep}
                            onPrev={prevStep}
                            onReset={resetWizard}
                        />
                    )}
                </div>

            </div>
        </>
    )
}
