import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { motion, AnimatePresence } from 'framer-motion'
import {
    ArrowRight, ArrowLeft, Check, FileDown, FileUp, RotateCcw,
    Sparkles, Mic, User, Settings, Layers, Server, Key, FileText
} from 'lucide-react'
import { useSetupStore, type SetupConfig, initialConfig } from '../store/setupStore'
import { VoiceCompanion, type VoicePlanSummary } from './VoiceCompanion'
import {
    basicConfigSchema,
    advancedSettingsSchema,
    type BasicConfigFormData,
    type AdvancedSettingsFormData
} from '../schemas/setupSchema'
import { TemplateSelector } from './TemplateSelector'
import { Template } from '../data/templates'
import { importConfiguration, downloadAsFile } from '../utils/configManager'
import { generateDockerCompose } from '../utils/dockerComposeGenerator'
import { WelcomeStep } from './WelcomeStep'
import { ServiceConfigStep } from './ServiceConfigStep'

import { TopRightActions } from './layout/TopRightActions'
import { createDefaultStoragePlan, DEFAULT_DATA_ROOT } from '../data/storagePlan'
import { services } from '../data/services'

// New Step Components
import { BasicConfigurationStep } from './wizard/steps/BasicConfigurationStep'
import { StackSelectionStep } from './wizard/steps/StackSelectionStep'
import { AdvancedSettingsStep } from './wizard/steps/AdvancedSettingsStep'
import { ReviewGenerateStep } from './wizard/steps/ReviewGenerateStep'

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
        currentStep, mode, selectedServices, config, savedProfiles,
        setMode, toggleService, updateConfig, updateServiceConfig, setSelectedServices,
        updateStoragePath,
        nextStep, prevStep,
        loadTemplate, exportConfig, importConfig, resetWizard,
        saveProfile, deleteProfile, loadProfile
    } = useSetupStore()
    const [copied, setCopied] = useState(false)
    const [shakeField, setShakeField] = useState<string | null>(null)
    const [showTemplates, setShowTemplates] = useState(false)
    const [showProfiles, setShowProfiles] = useState(false)
    const [newProfileName, setNewProfileName] = useState('')
    const [showVoiceCompanion, setShowVoiceCompanion] = useState(false)
    const [voiceHelperInitialized, setVoiceHelperInitialized] = useState(false)

    // Auto-open voice companion for newbie mode
    useEffect(() => {
        if (mode === 'newbie' && !voiceHelperInitialized) {
            setShowVoiceCompanion(true)
            setVoiceHelperInitialized(true)
        }
    }, [mode, voiceHelperInitialized])

    // Apply voice plan to wizard
    const handleApplyVoicePlan = (plan: VoicePlanSummary) => {
        if (plan.services?.length) {
            setSelectedServices(Array.from(new Set(plan.services)))
        }
        const configUpdates: Partial<SetupConfig> = {}
        if (plan.domain) configUpdates.domain = plan.domain
        if (Object.keys(configUpdates).length) {
            updateConfig(configUpdates)
        }
        if (plan.storagePaths?.media) {
            updateServiceConfig('plex', { mediaPath: plan.storagePaths.media })
            updateStoragePath('movies', { path: plan.storagePaths.media })
            updateStoragePath('tv', { path: plan.storagePaths.media })
        }
        if (plan.storagePaths?.downloads) {
            updateServiceConfig('torrent', { downloadsPath: plan.storagePaths.downloads })
            updateStoragePath('downloads', { path: plan.storagePaths.downloads })
        }
        setShowVoiceCompanion(false)
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

    // Step 1 form (Basic Config)
    const step1Form = useForm<BasicConfigFormData>({
        resolver: zodResolver(basicConfigSchema),
        defaultValues: config,
        mode: 'onChange'
    })

    // Step 4 form (Advanced Settings)
    const step4Form = useForm<AdvancedSettingsFormData>({
        resolver: zodResolver(advancedSettingsSchema),
        defaultValues: config,
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
                Object.keys(errors).forEach(field => {
                    setShakeField(field)
                    setTimeout(() => setShakeField(null), 500)
                })
                return
            }
            updateConfig(step1Form.getValues())
            nextStep()
        } else if (currentStep === 2) {
            if (selectedServices.length === 0) return
            nextStep()
        } else if (currentStep === 3) {
            // Service Config step
            nextStep()
        } else if (currentStep === 4) {
            const isValid = await step4Form.trigger()
            if (isValid) {
                updateConfig(step4Form.getValues())
            }
            nextStep()
        }
    }

    const handleTemplateSelect = (template: Template) => {
        loadTemplate(template.services, template.config)
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
                            alert('Invalid configuration file')
                        }
                    } catch (err) {
                        console.error('SetupWizard: failed to import configuration', err)
                        alert('Failed to import configuration')
                    }
                }
                reader.readAsText(file)
            }
        }
        input.click()
    }

    const [showResetConfirm, setShowResetConfirm] = useState(false)

    const handleReset = () => {
        if (showResetConfirm) {
            resetWizard()
            step1Form.reset(initialConfig)
            step4Form.reset(initialConfig)
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

    const generateEnvFile = () => {
        const profiles = selectedServices.join(',')
        const storagePlan = config.storagePlan || createDefaultStoragePlan(DEFAULT_DATA_ROOT)
        const planRoot = storagePlan.dataRoot?.path || DEFAULT_DATA_ROOT
        const storageDefaults = createDefaultStoragePlan(planRoot)
        const resolvePath = (key: string, fallback: string) =>
            storagePlan[key]?.path || storageDefaults[key]?.path || fallback
        const dataRoot = resolvePath('dataRoot', DEFAULT_DATA_ROOT)
        const configRoot = resolvePath('configRoot', `${dataRoot}/config`)
        const moviesPath = resolvePath('movies', `${dataRoot}/media/movies`)
        const tvPath = resolvePath('tv', `${dataRoot}/media/tv`)
        const musicPath = resolvePath('music', `${dataRoot}/media/music`)
        const booksPath = resolvePath('books', `${dataRoot}/media/books`)
        const audiobooksPath = resolvePath('audiobooks', `${dataRoot}/media/audiobooks`)
        const photosPath = resolvePath('photos', `${dataRoot}/media/photos`)
        const transcodePath = resolvePath('transcode', `${dataRoot}/transcode`)
        const downloadsPath = resolvePath('downloads', `${dataRoot}/downloads`)

        // Generate service-specific variables
        let serviceVars = ''
        Object.entries(config.serviceConfigs).forEach(([service, vars]) => {
            if (selectedServices.includes(service)) {
                serviceVars += `\n# ${service.toUpperCase()} CONFIGURATION\n`
                Object.entries(vars).forEach(([key, value]) => {
                    serviceVars += `${key}=${value}\n`
                })
            }
        })

        return `# .env configuration for mediastack
# Generated by Interactive Setup Wizard

# =============================================================================
# GENERAL SETTINGS
# =============================================================================
TIMEZONE=${config.timezone}
PUID=${config.puid}
PGID=${config.pgid}
DOMAIN=${config.domain}
DOCKER_NETWORK=mediastack
COMPOSE_PROFILES=${profiles}

# =============================================================================
# STORAGE & PATHS
# =============================================================================
DATA_ROOT=${dataRoot}
CONFIG_ROOT=${configRoot}
MOVIES_PATH=${moviesPath}
TV_SHOWS_PATH=${tvPath}
MUSIC_PATH=${musicPath}
BOOKS_PATH=${booksPath}
AUDIOBOOKS_PATH=${audiobooksPath}
PHOTOS_PATH=${photosPath}
TRANSCODE_PATH=${transcodePath}
DOWNLOADS_PATH=${downloadsPath}

# =============================================================================
# SERVICE CREDENTIALS & SECRETS
# =============================================================================
CLOUDFLARE_TUNNEL_TOKEN=${config.cloudflareToken || 'CHANGE_ME_TOKEN'}

# Authelia Secrets (Generate these with: openssl rand -hex 32)
AUTHELIA_JWT_SECRET=GENERATE_WITH_OPENSSL
AUTHELIA_SESSION_SECRET=GENERATE_WITH_OPENSSL
AUTHELIA_STORAGE_ENCRYPTION_KEY=GENERATE_WITH_OPENSSL

# Passwords
REDIS_PASSWORD=${config.password}

# API Keys (Fill these in after setting up services)
PLEX_TOKEN=${config.plexClaim || ''}
JELLYFIN_API_KEY=
SONARR_API_KEY=
RADARR_API_KEY=
PROWLARR_API_KEY=
BAZARR_API_KEY=
OVERSEERR_API_KEY=
TAUTULLI_API_KEY=
PORTAINER_TOKEN=

# Plex Claim (Optional - for new servers)
PLEX_CLAIM=${config.plexClaim || ''}

# PhotoPrism
PHOTOPRISM_ADMIN_PASSWORD=

# Gluetun VPN (WireGuard)
WIREGUARD_PRIVATE_KEY=${config.wireguardPrivateKey || ''}
WIREGUARD_ADDRESSES=${config.wireguardAddresses || ''}

# =============================================================================
# SERVICE SPECIFIC CONFIGURATION
# =============================================================================
${serviceVars}
`
    }

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
        return `tunnel: YOUR_TUNNEL_ID
credentials-file: /etc/cloudflared/cert.json

ingress:
  - hostname: auth.${config.domain}
    service: http://authelia:9091
  - hostname: hub.${config.domain}
    service: http://homepage:3000
${selectedServices.includes('plex') ? `  - hostname: plex.${config.domain}
    service: http://plex:32400` : ''}
${selectedServices.includes('jellyfin') ? `  - hostname: jellyfin.${config.domain}
    service: http://jellyfin:8096` : ''}
${selectedServices.includes('arr') ? `  - hostname: sonarr.${config.domain}
    service: http://sonarr:8989
  - hostname: radarr.${config.domain}
    service: http://radarr:7878
  - hostname: prowlarr.${config.domain}
    service: http://prowlarr:9696` : ''}
${selectedServices.includes('torrent') ? `  - hostname: qbit.${config.domain}
    service: http://gluetun:8080` : ''}
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
        downloadFile(generateDockerCompose(selectedServices), 'docker-compose.yml')
    }

    const handleShare = () => {
        const data = { mode, selectedServices, config }
        const encoded = btoa(JSON.stringify(data))
        const url = `${window.location.origin}${window.location.pathname}?config=${encoded}`
        navigator.clipboard.writeText(url)
        alert('Share link copied to clipboard!')
    }

    const progress = ((currentStep + 1) / steps.length) * 100

    return (
        <>
            <VoiceCompanion
                isOpen={showVoiceCompanion}
                onClose={() => setShowVoiceCompanion(false)}
                onApplyPlan={handleApplyVoicePlan}
                templateMode={mode}
            />

            {/* Floating Voice Companion Trigger */}
            {mode === 'newbie' && !showVoiceCompanion && (
                <motion.button
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0, opacity: 0 }}
                    onClick={() => setShowVoiceCompanion(true)}
                    className="fixed bottom-24 right-6 z-40 p-4 rounded-2xl bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-2xl shadow-purple-500/30 hover:scale-105 transition-transform"
                    title="Talk through my setup with AI"
                >
                    <Mic className="w-6 h-6" />
                </motion.button>
            )}

            <div className="min-h-screen pt-24 pb-12 px-4 sm:px-6 lg:px-8">
                <div className="max-w-5xl mx-auto">
                    {/* Header */}
                    <div className="text-center mb-12">
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-purple-500/10 border border-purple-500/20 mb-6"
                        >
                            <Sparkles className="w-4 h-4 text-purple-400" />
                            <span className="text-sm text-purple-300">Interactive Setup Wizard</span>
                        </motion.div>
                        <motion.h1
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.1 }}
                            className="text-4xl md:text-5xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 mb-4"
                        >
                            Configure Your Media Stack
                        </motion.h1>
                        <motion.p
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.2 }}
                            className="text-lg text-muted-foreground max-w-2xl mx-auto"
                        >
                            Step-by-step guidance to generate your <code className="px-2 py-1 bg-white/5 rounded text-purple-300">.env</code> and configuration files
                        </motion.p>

                        {/* Action Buttons */}
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 0.3 }}
                            className="flex flex-wrap items-center justify-center gap-3 mt-6"
                        >
                            <button
                                onClick={handleReset}
                                className={`flex items-center gap-2 px-4 py-2 border rounded-lg transition-all text-sm ${showResetConfirm ? 'bg-red-500 text-white border-red-600 animate-pulse' : 'bg-red-500/10 hover:bg-red-500/20 border-red-500/30 text-red-300 hover:text-red-200'}`}
                                title="Reset wizard to defaults"
                            >
                                <RotateCcw className={`w-4 h-4 ${showResetConfirm ? 'animate-spin' : ''}`} />
                                {showResetConfirm ? 'Confirm Reset?' : 'Reset'}
                            </button>
                            <button
                                onClick={() => setShowProfiles(!showProfiles)}
                                className="flex items-center gap-2 px-4 py-2 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 rounded-lg transition-all text-sm text-blue-300 hover:text-blue-200"
                                title="Manage profiles"
                            >
                                <User className="w-4 h-4" />
                                Profiles
                            </button>
                            <div className="w-px h-6 bg-white/10 mx-2" />
                            <button
                                onClick={handleExport}
                                className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-purple-500/30 rounded-lg transition-all text-sm text-gray-300 hover:text-white"
                                title="Export current configuration"
                            >
                                <FileDown className="w-4 h-4" />
                                Export
                            </button>
                            <button
                                onClick={handleImport}
                                className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-purple-500/30 rounded-lg transition-all text-sm text-gray-300 hover:text-white"
                                title="Import saved configuration"
                            >
                                <FileUp className="w-4 h-4" />
                                Import
                            </button>
                            <button
                                onClick={() => setShowTemplates(!showTemplates)}
                                className="flex items-center gap-2 px-4 py-2 bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/30 rounded-lg transition-all text-sm text-purple-300 hover:text-purple-200"
                                title="Load a template"
                            >
                                <Sparkles className="w-4 h-4" />
                                Templates
                            </button>
                            <div className="w-px h-6 bg-white/10 mx-2" />
                            <TopRightActions />
                        </motion.div>
                    </div>

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
                                    <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                                        <User className="w-5 h-5 text-blue-400" />
                                        Saved Profiles
                                    </h3>

                                    <div className="flex gap-2 mb-6">
                                        <input
                                            type="text"
                                            value={newProfileName}
                                            onChange={(e) => setNewProfileName(e.target.value)}
                                            placeholder="Profile Name (e.g., 'Home Server')"
                                            className="flex-1 bg-black/30 border border-white/10 rounded-lg px-4 py-2 text-sm text-white focus:border-blue-500/50 outline-none"
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
                                            <p className="text-center text-gray-500 py-4">No saved profiles yet.</p>
                                        ) : (
                                            Object.entries(savedProfiles).map(([name, profile]) => (
                                                <div key={name} className="flex items-center justify-between p-3 bg-white/5 rounded-lg border border-white/5 hover:border-white/10 transition-all">
                                                    <div>
                                                        <div className="font-medium text-white">{name}</div>
                                                        <div className="text-xs text-gray-500">
                                                            {profile.selectedServices.length} services • {profile.mode || 'Custom'}
                                                        </div>
                                                    </div>
                                                    <div className="flex gap-2">
                                                        <button
                                                            onClick={() => {
                                                                loadProfile(name)
                                                                setShowProfiles(false)
                                                            }}
                                                            className="p-2 hover:bg-green-500/20 text-gray-400 hover:text-green-400 rounded-lg transition-colors"
                                                            title="Load Profile"
                                                        >
                                                            <FileUp className="w-4 h-4" />
                                                        </button>
                                                        <button
                                                            onClick={() => deleteProfile(name)}
                                                            className="p-2 hover:bg-red-500/20 text-gray-400 hover:text-red-400 rounded-lg transition-colors"
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
                        <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                            <motion.div
                                className="progress-bar h-full"
                                initial={{ width: 0 }}
                                animate={{ width: `${progress}%` }}
                                transition={{ duration: 0.5, ease: 'easeOut' }}
                            />
                        </div>
                        <p className="text-center mt-2 text-sm text-gray-400">
                            Step {currentStep + 1} of {steps.length} • {Math.round(progress)}% Complete
                        </p>
                    </div>

                    {/* Progress Steps */}
                    <div className="mb-12">
                        <div className="flex items-center justify-between max-w-3xl mx-auto">
                            {steps.map((step, index) => {
                                const Icon = step.icon
                                const isActive = index === currentStep
                                const isComplete = index < currentStep

                                return (
                                    <div key={index} className="flex items-center flex-1">
                                        <div className="flex flex-col items-center flex-1">
                                            <motion.div
                                                className={`w-12 h-12 rounded-full flex items-center justify-center border-2 transition-all ${isActive
                                                    ? 'bg-purple-500/20 border-purple-500 text-purple-300 animate-pulse-glow'
                                                    : isComplete
                                                        ? 'bg-green-500/20 border-green-500 text-green-300'
                                                        : 'bg-white/5 border-white/10 text-gray-500'
                                                    }`}
                                                animate={isComplete ? { scale: [1, 1.1, 1] } : {}}
                                                transition={{ duration: 0.3 }}
                                            >
                                                {isComplete ? <Check className="w-5 h-5" /> : <Icon className="w-5 h-5" />}
                                            </motion.div>
                                            <span className={`mt-2 text-xs font-medium hidden md:block ${isActive ? 'text-purple-300' : isComplete ? 'text-green-300' : 'text-gray-500'
                                                }`}>
                                                {step.title}
                                            </span>
                                        </div>
                                        {index < steps.length - 1 && (
                                            <motion.div
                                                className={`h-0.5 flex-1 mx-2 ${isComplete ? 'bg-green-500/50' : 'bg-white/10'}`}
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
                    {showTemplates ? (
                        <motion.div
                            className="glass-ultra rounded-2xl p-8 border border-white/10 min-h-[500px]"
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                        >
                            <TemplateSelector
                                onSelectTemplate={handleTemplateSelect}
                                onSkip={() => setShowTemplates(false)}
                            />
                        </motion.div>
                    ) : (
                        <motion.div
                            className="glass-ultra rounded-2xl p-8 border border-white/10 min-h-[500px]"
                            layout
                        >
                            <AnimatePresence mode="wait">
                                {/* Step 0: Welcome */}
                                {currentStep === 0 && <WelcomeStep />}

                                {/* Step 1: Basic Configuration */}
                                {currentStep === 1 && (
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
                        </motion.div>
                    )}

                    {/* Navigation Buttons */}
                    {currentStep > 0 && (
                        <div className="flex justify-between items-center mt-8">
                            <button
                                onClick={prevStep}
                                className="flex items-center gap-2 px-6 py-3 rounded-lg font-medium transition-all btn-lift bg-white/10 text-white hover:bg-white/20"
                            >
                                <ArrowLeft className="w-4 h-4" />
                                Back
                            </button>

                            {currentStep < 5 ? (
                                <button
                                    onClick={handleNextStep}
                                    className="flex items-center gap-2 px-6 py-3 rounded-lg font-medium transition-all btn-lift bg-gradient-to-r from-purple-500 to-pink-500 text-white hover:from-purple-600 hover:to-pink-600"
                                >
                                    Next
                                    <ArrowRight className="w-4 h-4" />
                                </button>
                            ) : (
                                <button
                                    onClick={handleReset}
                                    className={`flex items-center gap-2 px-6 py-3 rounded-lg font-medium transition-all btn-lift ${showResetConfirm ? 'bg-red-500 text-white hover:bg-red-600' : 'bg-white/10 text-white hover:bg-white/20'}`}
                                >
                                    <RotateCcw className={`w-4 h-4 ${showResetConfirm ? 'animate-spin' : ''}`} />
                                    {showResetConfirm ? 'Confirm Reset?' : 'Start Over'}
                                </button>
                            )}
                        </div>
                    )}
                </div>

            </div>
        </>
    )
}
