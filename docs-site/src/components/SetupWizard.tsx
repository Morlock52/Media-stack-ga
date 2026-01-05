import { useState, useEffect, useRef, useCallback, useMemo, lazy, Suspense } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { motion, AnimatePresence } from 'motion/react'
import { useReducedMotion } from '../hooks/useReducedMotion'
import { toast } from 'sonner'
import {
    ArrowRight, ArrowLeft, Check, FileDown, FileUp, RotateCcw, Save,
    Sparkles, Mic, User, Settings, Layers, Server, Key, FileText, MoreHorizontal, Loader2
} from 'lucide-react'
import { useSetupStore, type SetupConfig, initialConfig } from '../store/setupStore'
import type { VoicePlanSummary } from './VoiceCompanion'

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
import dockerComposeTemplate from '../../../docker-compose.yml?raw'
import dockerComposeLocalTemplate from '../../../docker-compose.local.yml?raw'
import { generateEnvFile as buildEnvFile } from '../utils/generateEnvFile'
import { WelcomeStep } from './WelcomeStep'
import { ServiceConfigStep } from './ServiceConfigStep'
import { ValidationBadge } from './ValidationBadge'
import { useValidation } from '../hooks/useValidation'
import type { ValidationRequest } from '../types/validation'

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
        setMode, toggleService, updateConfig, updateServiceConfig, setSelectedServices,
        updateStoragePath, setCurrentStep,
        nextStep, prevStep,
        loadTemplate, exportConfig, importConfig, resetWizard,
        saveProfile, deleteProfile, loadProfile,
        hasRecoverableDraft, getRecoverableDraft, dismissDraft, restoreDraft
    } = useSetupStore()
    const [copied, setCopied] = useState(false)
    const [shakeField, setShakeField] = useState<string | null>(null)
    const [showTemplates, setShowTemplates] = useState(false)
    const [showProfiles, setShowProfiles] = useState(false)
    const [newProfileName, setNewProfileName] = useState('')
    const [showVoiceCompanion, setShowVoiceCompanion] = useState(false)
    const [voiceHelperInitialized, setVoiceHelperInitialized] = useState(false)
    const [toolsOpen, setToolsOpen] = useState(false)

    // Accessibility: Respect user's reduced motion preference
    const prefersReducedMotion = useReducedMotion()

    // Validation state - persists across steps
    const { result: validationResult, isValidating, error: validationError, validate } = useValidation({
        autoValidate: false,
        debounceMs: 500,
    })

    // Proactive suggestions based on current step and config
    const { suggestions, dismiss: dismissSuggestion } = useProactiveSuggestions(currentStep)

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

    // Scroll to element and focus
    const scrollToElement = useCallback((selector: string, shouldFocus = true) => {
        setTimeout(() => {
            const element = document.querySelector(selector) as HTMLElement
            if (element) {
                element.scrollIntoView({ behavior: 'smooth', block: 'center' })
                if (shouldFocus && element instanceof HTMLInputElement) {
                    element.focus()
                }
            }
        }, 100)
    }, [])

    // Scroll to first error field
    const scrollToFirstError = useCallback((errors: Record<string, unknown>) => {
        const firstErrorField = Object.keys(errors)[0]
        if (firstErrorField) {
            scrollToElement(`[name="${firstErrorField}"]`, true)
        }
    }, [scrollToElement])

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

    const handleNextStep = async () => {
        if (currentStep === 0) {
            // Welcome step handled by component
            nextStep()
        } else if (currentStep === 1) {
            const isValid = await step1Form.trigger()
            if (!isValid) {
                const errors = step1Form.formState.errors
                const firstErrorField = Object.keys(errors)[0]
                if (firstErrorField) {
                    setShakeField(firstErrorField)
                    setTimeout(() => setShakeField(null), 500)
                    // Scroll to error field and focus
                    scrollToFirstError(errors)
                    toast.error(`Please fix the ${firstErrorField} field`)
                }
                return
            }
            updateConfig(step1Form.getValues())
            nextStep()
        } else if (currentStep === 2) {
            if (selectedServices.length === 0) {
                toast.error('Please select at least one service')
                // Scroll to service selection area
                scrollToElement('.grid.grid-cols-1.sm\\:grid-cols-2', false)
                return
            }
            nextStep()
        } else if (currentStep === 3) {
            // Service Config step
            nextStep()
        } else if (currentStep === 4) {
            const isValid = await step4Form.trigger()
            if (!isValid) {
                const errors = step4Form.formState.errors
                scrollToFirstError(errors)
                toast.error('Please check the form fields')
                return
            }
            const values = step4Form.getValues()
            updateConfig({
                cloudflareToken: values.cloudflareToken,
                plexClaim: values.plexClaim,
                wireguardPrivateKey: values.wireguardPrivateKey,
                wireguardAddresses: values.wireguardAddresses,
            })
            nextStep()
        }
    }

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

    const generateEnvFile = () => buildEnvFile(config, selectedServices)

    const generateAutheliaYaml = () => {
        return `---
theme: dark
default_redirection_url: https://${config.domain}

server:
  host: 0.0.0.0
  port: 9091

log:
  level: info

totp:
  issuer: ${config.domain}

authentication_backend:
  file:
    path: /config/users_database.yml

access_control:
  default_policy: deny
  rules:
    - domain: "*.${config.domain}"
      policy: two_factor

session:
  name: authelia_session
  domain: ${config.domain}
  expiration: 1h
  inactivity: 5m
  remember_me_duration: 1M
  redis:
    host: redis
    port: 6379
    password: \${AUTHELIA_SESSION_REDIS_PASSWORD}

storage:
  encryption_key: \${AUTHELIA_STORAGE_ENCRYPTION_KEY}
  local:
    path: /config/db.sqlite3

notifier:
  filesystem:
    filename: /config/notification.txt
`
    }

    const generateCloudflareYaml = () => {
        const has = (profile: string) => selectedServices.includes(profile)
        const hasArr = has('arr')
        return `tunnel: YOUR_TUNNEL_ID
credentials-file: /etc/cloudflared/cert.json

ingress:
  - hostname: auth.${config.domain}
    service: http://authelia:9091
  - hostname: hub.${config.domain}
    service: http://homepage:3000
  - hostname: portainer.${config.domain}
    service: http://portainer:9000
  - hostname: dozzle.${config.domain}
    service: http://dozzle:8080
  - hostname: grafana.${config.domain}
    service: http://grafana:3000
${selectedServices.includes('plex') ? `  - hostname: plex.${config.domain}
    service: http://plex:32400` : ''}
${selectedServices.includes('jellyfin') ? `  - hostname: jellyfin.${config.domain}
    service: http://jellyfin:8096` : ''}
${hasArr || has('overseerr') ? `  - hostname: request.${config.domain}
    service: http://overseerr:5055` : ''}
${hasArr || has('sonarr') ? `  - hostname: sonarr.${config.domain}
    service: http://sonarr:8989` : ''}
${hasArr || has('radarr') ? `  - hostname: radarr.${config.domain}
    service: http://radarr:7878` : ''}
${hasArr || has('prowlarr') ? `  - hostname: prowlarr.${config.domain}
    service: http://prowlarr:9696` : ''}
${hasArr || has('bazarr') ? `  - hostname: bazarr.${config.domain}
    service: http://bazarr:6767` : ''}
${selectedServices.includes('stats') ? `  - hostname: tautulli.${config.domain}
    service: http://tautulli:8181` : ''}
${selectedServices.includes('transcode') ? `  - hostname: tdarr.${config.domain}
    service: http://tdarr:8265` : ''}
${selectedServices.includes('notify') ? `  - hostname: notifiarr.${config.domain}
    service: http://notifiarr:5454` : ''}
${selectedServices.includes('torrent') ? `  - hostname: qbt.${config.domain}
    service: http://gluetun:8080` : ''}
${selectedServices.includes('mealie') ? `  - hostname: mealie.${config.domain}
    service: http://mealie:9000` : ''}
${selectedServices.includes('kavita') ? `  - hostname: kavita.${config.domain}
    service: http://kavita:5000` : ''}
${selectedServices.includes('audiobookshelf') ? `  - hostname: audiobookshelf.${config.domain}
    service: http://audiobookshelf:13378` : ''}
${selectedServices.includes('photoprism') ? `  - hostname: photoprism.${config.domain}
    service: http://photoprism:2342` : ''}
  - service: http_status:404
`
    }

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
    }

    const downloadFile = (content: string, filename: string) => {
        const blob = new Blob([content], { type: 'text/plain' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = filename
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
    }

    const downloadAllFiles = () => {
        downloadFile(generateEnvFile(), '.env')
        downloadFile(generateAutheliaYaml(), 'authelia-configuration.yml')
        downloadFile(generateCloudflareYaml(), 'cloudflare-config.yml')
        const compose =
            config.deploymentMode === 'local'
                ? dockerComposeLocalTemplate
                : dockerComposeTemplate
        downloadFile(compose, 'docker-compose.yml')
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

    const progress = ((currentStep + 1) / steps.length) * 100

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
                    onApplyPlan={handleApplyVoicePlan}
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
                    <div className="text-center mb-12">
                        <motion.div
                            {...fadeInUp}
                            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/30 mb-6"
                        >
                            <Sparkles className="w-4 h-4 text-primary" />
                            <span className="text-sm text-primary">Interactive Setup Wizard</span>
                        </motion.div>
                        <motion.h1
                            {...fadeInUp}
                            transition={prefersReducedMotion ? { duration: 0 } : { delay: 0.1 }}
                            className="text-4xl md:text-5xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-emerald-400 via-cyan-400 to-lime-400 mb-4"
                        >
                            Setup Wizard
                        </motion.h1>
                        <motion.p
                            {...fadeInUp}
                            transition={prefersReducedMotion ? { duration: 0 } : { delay: 0.2 }}
                            className="text-lg text-muted-foreground max-w-2xl mx-auto"
                        >
                            Step-by-step guidance to generate your <code className="px-2 py-1 bg-muted/40 rounded text-primary">.env</code> and configuration files
                        </motion.p>

                        {/* Action Buttons */}
                        <motion.div
                            initial={prefersReducedMotion ? {} : { opacity: 0 }}
                            animate={prefersReducedMotion ? {} : { opacity: 1 }}
                            transition={prefersReducedMotion ? { duration: 0 } : { delay: 0.3 }}
                            className="flex flex-wrap items-center justify-center gap-3 mt-6"
                        >
                            <Button
                                onClick={handleReset}
                                variant={showResetConfirm ? 'destructive' : 'outline'}
                                className={showResetConfirm
                                    ? 'animate-pulse'
                                    : 'border-red-500/30 text-red-300 hover:bg-red-500/20 hover:text-red-200'}
                                title="Reset wizard to defaults"
                            >
                                <RotateCcw className={`w-4 h-4 ${showResetConfirm ? 'animate-spin' : ''}`} />
                                {showResetConfirm ? 'Confirm Reset?' : 'Reset'}
                            </Button>
                            <Button
                                onClick={() => setShowProfiles(!showProfiles)}
                                variant="glass"
                                className="text-foreground hover:text-foreground"
                                title="Manage saved profiles"
                            >
                                <User className="w-4 h-4" />
                                Profiles
                            </Button>
                            <Button
                                onClick={() => setToolsOpen(true)}
                                variant="glass"
                                className="text-foreground hover:text-foreground"
                                title="Import/export and templates"
                            >
                                <MoreHorizontal className="w-4 h-4" />
                                Tools
                            </Button>
                        </motion.div>
                    </div>

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
                    <div className="mb-8">
                        <div className="h-2 bg-muted/40 rounded-full overflow-hidden">
                            <motion.div
                                className="progress-bar h-full"
                                initial={{ width: 0 }}
                                animate={{ width: `${progress}%` }}
                                transition={{ duration: 0.5, ease: 'easeOut' }}
                            />
                        </div>
                        <div className="flex items-center justify-center gap-3 mt-2">
                            <p className="text-sm text-muted-foreground">
                                Step {currentStep + 1} of {steps.length} • {Math.round(progress)}% Complete
                            </p>
                            {/* Show validation status badge on advanced and review steps */}
                            {(currentStep === 4 || currentStep === 5) && (
                                <ValidationBadge
                                    result={validationResult}
                                    isValidating={isValidating}
                                    error={validationError}
                                    onValidate={() => {
                                        // Re-trigger validation on click
                                        const validators: ValidationRequest['validators'] = ['docker', 'path']
                                        if (selectedServices.length > 0) validators.push('port')
                                        if (selectedServices.includes('vpn') || selectedServices.includes('torrent')) validators.push('vpn')
                                        if (config.deploymentMode === 'cloud' && config.cloudflareToken) validators.push('cloudflare')

                                        validate({
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
                                        })
                                    }}
                                    compact
                                />
                            )}
                        </div>
                    </div>

                    {/* Progress Steps - Click to navigate to completed steps */}
                    <div className="mb-12">
                        <div className="flex items-center justify-between max-w-3xl mx-auto">
                            {steps.map((step, index) => {
                                const Icon = step.icon
                                const isActive = index === currentStep
                                const isComplete = index < currentStep
                                const isClickable = isComplete // Can click on completed steps

                                // Determine if this step has validation issues
                                const hasStepValidationIssues = validationResult && !validationResult.passed && (() => {
                                    // Step 1 (Basic Config) - path and environment issues
                                    if (index === 1) {
                                        return validationResult.results.some(r =>
                                            (r.validator === 'path' || r.validator === 'environment') && !r.passed
                                        )
                                    }
                                    // Step 4 (Advanced Settings) - VPN and Cloudflare issues
                                    if (index === 4) {
                                        return validationResult.results.some(r =>
                                            (r.validator === 'vpn' || r.validator === 'cloudflare') && !r.passed
                                        )
                                    }
                                    // Step 5 (Review) - any validation issues
                                    if (index === 5) {
                                        return validationResult.errorCount > 0
                                    }
                                    return false
                                })()

                                return (
                                    <div key={index} className="flex items-center flex-1">
                                        <div className="flex flex-col items-center flex-1">
                                            <motion.button
                                                type="button"
                                                onClick={() => isClickable && setCurrentStep(index)}
                                                disabled={!isClickable}
                                                className={`w-12 h-12 rounded-full flex items-center justify-center border-2 transition-all relative ${
                                                    isActive
                                                        ? 'bg-primary/20 border-primary text-primary animate-pulse-glow'
                                                        : isComplete
                                                        ? 'bg-green-500/20 border-green-500 text-green-300 hover:bg-green-500/30 hover:scale-105 cursor-pointer'
                                                        : 'bg-muted/40 border-border text-muted-foreground cursor-not-allowed'
                                                    }`}
                                                animate={isComplete ? { scale: [1, 1.1, 1] } : {}}
                                                transition={{ duration: 0.3 }}
                                                title={isClickable ? `Go back to ${step.title}` : isActive ? 'Current step' : 'Complete previous steps first'}
                                                aria-label={isClickable ? `Navigate to ${step.title}` : step.title}
                                            >
                                                {isComplete ? <Check className="w-5 h-5" /> : <Icon className="w-5 h-5" />}
                                                {/* Validation issue indicator */}
                                                {hasStepValidationIssues && (
                                                    <span
                                                        className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-background"
                                                        title="This step has validation issues"
                                                    />
                                                )}
                                            </motion.button>
                                            <button
                                                type="button"
                                                onClick={() => isClickable && setCurrentStep(index)}
                                                disabled={!isClickable}
                                                className={`mt-2 text-xs font-medium hidden md:block transition-colors ${
                                                    isActive
                                                        ? 'text-primary'
                                                        : isComplete
                                                        ? 'text-green-300 hover:text-green-200 cursor-pointer'
                                                        : 'text-muted-foreground cursor-not-allowed'
                                                    }`}
                                            >
                                                {step.title}
                                            </button>
                                        </div>
                                        {index < steps.length - 1 && (
                                            <motion.div
                                                className={`h-0.5 flex-1 mx-2 ${isComplete ? 'bg-green-500/50' : 'bg-border'}`}
                                                initial={{ scaleX: 0 }}
                                                animate={{ scaleX: isComplete ? 1 : 0 }}
                                                transition={{ duration: 0.5 }}
                                            />
                                        )}
                                    </div>
                                )
                            })}
                        </div>
                    </div>

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
                        <div className="sticky bottom-4 z-30 mt-8">
                            <div className="flex justify-between items-center glass-ultra rounded-2xl border border-border/60 px-4 py-3 backdrop-blur">
                                <Button
                                    type="button"
                                    onClick={prevStep}
                                    variant="glass"
                                    className="btn-lift px-6 py-3"
                                >
                                    <ArrowLeft className="w-4 h-4" />
                                    Back
                                </Button>

                                {currentStep < 5 ? (
                                    <Button
                                        type="button"
                                        onClick={handleNextStep}
                                        variant="gradient"
                                        className="btn-lift px-6 py-3"
                                    >
                                        Next
                                        <ArrowRight className="w-4 h-4" />
                                    </Button>
                                ) : (
                                    <Button
                                        type="button"
                                        onClick={handleReset}
                                        variant={showResetConfirm ? 'destructive' : 'glass'}
                                        className={showResetConfirm ? 'btn-lift px-6 py-3 animate-pulse' : 'btn-lift px-6 py-3'}
                                    >
                                        <RotateCcw className={`w-4 h-4 ${showResetConfirm ? 'animate-spin' : ''}`} />
                                        {showResetConfirm ? 'Confirm Reset?' : 'Start Over'}
                                    </Button>
                                )}
                            </div>
                        </div>
                    )}
                </div>

            </div>
        </>
    )
}
