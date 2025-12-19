import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import {
    ArrowRight, ArrowLeft, Check, FileDown, FileUp, RotateCcw,
    Sparkles, Mic, User, Settings, Layers, Server, Key, FileText, MoreHorizontal
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
import dockerComposeTemplate from '../../../docker-compose.yml?raw'
import { WelcomeStep } from './WelcomeStep'
import { ServiceConfigStep } from './ServiceConfigStep'

import { Button } from './ui/button'
import { createDefaultStoragePlan, DEFAULT_DATA_ROOT } from '../data/storagePlan'
import { services } from '../data/services'

// New Step Components
import { BasicConfigurationStep } from './wizard/steps/BasicConfigurationStep'
import { StackSelectionStep } from './wizard/steps/StackSelectionStep'
import { AdvancedSettingsStep } from './wizard/steps/AdvancedSettingsStep'
import { ReviewGenerateStep } from './wizard/steps/ReviewGenerateStep'
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
    const [toolsOpen, setToolsOpen] = useState(false)

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

    // Scroll to top when step changes
    useEffect(() => {
        window.scrollTo({ top: 0, behavior: 'smooth' })
    }, [currentStep])

    // Step 1 form (Basic Config)
    const step1Form = useForm<BasicConfigFormData>({
        resolver: zodResolver(basicConfigSchema),
        defaultValues: config,
        mode: 'onChange'
    })

    // Step 4 form (Advanced Settings)
    const step4Form = useForm<AdvancedSettingsFormData>({
        resolver: zodResolver(advancedSettingsSchema),
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
                const values = step4Form.getValues()
                updateConfig({
                    cloudflareToken: values.cloudflareToken,
                    plexClaim: values.plexClaim,
                    wireguardPrivateKey: values.wireguardPrivateKey,
                    wireguardAddresses: values.wireguardAddresses,
                })
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

    const generateEnvFile = () => {
        const profiles = Array.from(new Set(selectedServices)).join(',')
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
AUTHELIA_IDENTITY_VALIDATION_RESET_PASSWORD_JWT_SECRET=GENERATE_WITH_OPENSSL
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
        const has = (profile: string) => selectedServices.includes(profile)
        const hasArr = has('arr')
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
        downloadFile(dockerComposeTemplate, 'docker-compose.yml')
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

            <div className="min-h-screen pt-24 pb-28 px-4 sm:px-6 lg:px-8">
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
                            Setup Wizard
                        </motion.h1>
                        <motion.p
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.2 }}
                            className="text-lg text-muted-foreground max-w-2xl mx-auto"
                        >
                            Step-by-step guidance to generate your <code className="px-2 py-1 bg-muted/40 rounded text-purple-300">.env</code> and configuration files
                        </motion.p>

                        {/* Action Buttons */}
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 0.3 }}
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
                                                <div key={name} className="flex items-center justify-between p-3 bg-muted/40 rounded-lg border border-border hover:border-purple-500/30 transition-all">
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
                        <p className="text-center mt-2 text-sm text-muted-foreground">
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
                                                        : 'bg-muted/40 border-border text-muted-foreground'
                                                    }`}
                                                animate={isComplete ? { scale: [1, 1.1, 1] } : {}}
                                                transition={{ duration: 0.3 }}
                                            >
                                                {isComplete ? <Check className="w-5 h-5" /> : <Icon className="w-5 h-5" />}
                                            </motion.div>
                                            <span className={`mt-2 text-xs font-medium hidden md:block ${isActive ? 'text-purple-300' : isComplete ? 'text-green-300' : 'text-muted-foreground'
                                                }`}>
                                                {step.title}
                                            </span>
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
                    {showTemplates ? (
                        <motion.div
                            className="glass-ultra rounded-2xl p-8 border border-border min-h-[500px]"
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
                            className="glass-ultra rounded-2xl p-8 border border-border min-h-[500px]"
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
