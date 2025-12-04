import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { motion, AnimatePresence } from 'framer-motion'
import {
    ArrowRight, ArrowLeft, Check, Copy, Download, Zap,
    Globe, Clock, User, Lock, Tv, Film, Download as DownloadIcon,
    Shield, Activity, Cpu, Layers, Bell, Settings, FileText,
    AlertCircle, ChevronRight, Sparkles, Mic,
    Key, Server, HelpCircle, Package, FileDown, FileUp, RotateCcw,
    Book, Music, Image, BookOpen, ListVideo, Clapperboard,
    Radio, Inbox, Search, MonitorPlay, HardDrive, UtensilsCrossed
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
import { PostInstallChecklist } from './PostInstallChecklist'
import { TopRightActions } from './layout/TopRightActions'
import { createDefaultStoragePlan, DEFAULT_DATA_ROOT, STORAGE_CATEGORIES } from '../data/storagePlan'
import { ComboboxInput } from './ui/ComboboxInput'

interface ServiceOption {
    // ID used internally by the wizard and config store
    id: string

    // Short, human-friendly name shown in the UI
    name: string

    // One-line description for non-technical users
    description: string

    // Lucide icon for visual grouping
    icon: any

    // Underlying "profile" / group that ties into dockerComposeGenerator
    // Example: selecting Sonarr/Radarr/Prowlarr individually still maps into
    // the "arr" services in the compose generator.
    profile: string

    // High-level category for UI grouping
    category: 'media' | 'automation' | 'download' | 'monitoring' | 'request' | 'utility'
}

// All services the wizard knows about. This list is the "source of truth"
// for what appears in the Stack Selection step. The dockerComposeGenerator
// uses a smaller set of profiles (plex, arr, torrent, vpn, stats, transcode,
// notify, etc.) and expands them into concrete containers.
const services: ServiceOption[] = [
    // ---------------------------------------------------------------------
    // MEDIA SERVERS
    // ---------------------------------------------------------------------
    // PLEX
    // - Premium media server with polished apps on almost every device
    // - Default port: 32400
    // - Needs access to Movies + TV libraries
    // - Requires Plex account + (optional) Plex Pass for hardware transcode
    { id: 'plex', name: 'Plex', description: 'Premium media server with polished UI', icon: Film, profile: 'plex', category: 'media' },

    // JELLYFIN
    // - 100% free and open-source alternative to Plex
    // - No account needed, no telemetry, all features free
    // - Default port: 8096
    { id: 'jellyfin', name: 'Jellyfin', description: 'Free, open-source media server', icon: Tv, profile: 'jellyfin', category: 'media' },

    // EMBY
    // - Hybrid model: free tier + paid Emby Premiere
    // - Strong live TV / DVR capabilities
    // - Default port: 8096 (like Jellyfin, so dont run both on the same port)
    { id: 'emby', name: 'Emby', description: 'Media server with live TV support', icon: MonitorPlay, profile: 'emby', category: 'media' },

    // ---------------------------------------------------------------------
    // MEDIA MANAGEMENT - *Arr FAMILY
    // ---------------------------------------------------------------------
    // SONARR
    // - Automates TV series: monitors indexers, sends grabs to download client
    // - Default port: 8989
    // - Needs access to: TV root (/tv) and downloads (/downloads)
    { id: 'sonarr', name: 'Sonarr', description: 'Automated TV series management', icon: Layers, profile: 'sonarr', category: 'automation' },

    // RADARR
    // - Automates movies in the same way Sonarr does for TV
    // - Default port: 7878
    // - Needs access to: Movies (/movies) and downloads (/downloads)
    { id: 'radarr', name: 'Radarr', description: 'Automated movie management', icon: Layers, profile: 'radarr', category: 'automation' },

    // PROWLARR
    // - Central indexer manager for all *Arr apps
    // - Syncs indexers to Sonarr/Radarr/Lidarr/etc.
    // - Default port: 9696
    { id: 'prowlarr', name: 'Prowlarr', description: 'Indexer management for *Arr apps', icon: Layers, profile: 'prowlarr', category: 'automation' },

    // BAZARR
    // - Subtitle automation for Sonarr/Radarr media
    // - Talks to subtitle providers like OpenSubtitles
    // - Default port: 6767 (not used in compose yet but values are standard)
    { id: 'bazarr', name: 'Bazarr', description: 'Subtitle management for Sonarr/Radarr', icon: Layers, profile: 'bazarr', category: 'automation' },

    // LIDARR
    // - Music automation: manages albums/artists similar to Sonarr/Radarr
    // - Default port: 8686
    // - Needs access to: Music library (/music) and downloads
    { id: 'lidarr', name: 'Lidarr', description: 'Music collection manager', icon: Music, profile: 'lidarr', category: 'automation' },

    // READARR
    // - Books / audiobooks automation
    // - Default port: 8787
    { id: 'readarr', name: 'Readarr', description: 'Book & audiobook manager', icon: BookOpen, profile: 'readarr', category: 'automation' },

    // TDARR
    // - Distributed transcoding / file optimization
    // - Default ports: 8265 (web), 8266 (server)
    // - Used when you want to pre-optimize media instead of on-the-fly
    { id: 'transcode', name: 'Tdarr', description: 'Distributed transcoding', icon: Cpu, profile: 'transcode', category: 'automation' },

    // ---------------------------------------------------------------------
    // DOWNLOADS
    // ---------------------------------------------------------------------
    // TORRENT CLIENT (qBittorrent)
    // - Handles torrent downloads for Sonarr/Radarr/etc.
    // - Default web UI port: 8080
    // - Needs downloads path shared with *Arr apps
    { id: 'torrent', name: 'Torrent Client', description: 'qBittorrent for downloads', icon: DownloadIcon, profile: 'torrent', category: 'download' },

    // USENET CLIENT (SABnzbd)
    // - Optional: Usenet alternative/compliment to torrents
    // - Default port: 8080 (often customized to avoid conflict with qBit)
    { id: 'usenet', name: 'SABnzbd', description: 'Usenet downloader', icon: Inbox, profile: 'usenet', category: 'download' },

    // VPN (Gluetun)
    // - Wraps qBittorrent traffic in a VPN
    // - Needs provider-specific WireGuard / OpenVPN settings
    { id: 'vpn', name: 'Gluetun VPN', description: 'Secure VPN tunnel for privacy', icon: Shield, profile: 'vpn', category: 'download' },

    // ---------------------------------------------------------------------
    // REQUEST & DISCOVERY
    // ---------------------------------------------------------------------
    // OVERSEERR
    // - Request portal for users to ask for movies/TV
    // - Integrates tightly with Plex and *Arr
    // - Default port: 5055
    { id: 'overseerr', name: 'Overseerr', description: 'Media request management', icon: Search, profile: 'overseerr', category: 'request' },

    // OMBI
    // - Alternative request interface with newsletters, etc.
    // - Typically used instead of Overseerr, not in parallel
    { id: 'ombi', name: 'Ombi', description: 'User media requests', icon: ListVideo, profile: 'ombi', category: 'request' },

    // PETIO
    // - Another request app focused on recommendations
    { id: 'petio', name: 'Petio', description: 'Request manager with recommendations', icon: Clapperboard, profile: 'petio', category: 'request' },

    // ---------------------------------------------------------------------
    // MONITORING & NOTIFICATIONS
    // ---------------------------------------------------------------------
    // TAUTULLI
    // - Plex stats: who watched what, when, from where
    // - Default port: 8181
    { id: 'stats', name: 'Tautulli', description: 'Plex usage statistics', icon: Activity, profile: 'stats', category: 'monitoring' },

    // NOTIFIARR
    // - Bridges Plex/*Arr/Tautulli into Discord, Pushover, etc.
    // - Requires Notifiarr account + API key
    { id: 'notify', name: 'Notifiarr', description: 'Unified notifications', icon: Bell, profile: 'notify', category: 'monitoring' },

    // ---------------------------------------------------------------------
    // UTILITY APPS
    // ---------------------------------------------------------------------
    // MEALIE
    // - Recipe manager + meal planner
    // - Default port: 9925
    { id: 'mealie', name: 'Mealie', description: 'Recipe manager & meal planner', icon: UtensilsCrossed, profile: 'mealie', category: 'utility' },

    // KAVITA
    // - Comics / manga / ebooks library server
    { id: 'kavita', name: 'Kavita', description: 'Comics, manga & ebook reader', icon: Book, profile: 'kavita', category: 'utility' },

    // AUDIOBOOKSHELF
    // - Audiobooks + podcasts server with rich progress tracking
    // - Default port: 13378
    { id: 'audiobookshelf', name: 'Audiobookshelf', description: 'Audiobook & podcast server', icon: Radio, profile: 'audiobookshelf', category: 'utility' },

    // PHOTOPRISM
    // - AI-powered photo management with face/object recognition
    // - Default port: 2342
    { id: 'photoprism', name: 'PhotoPrism', description: 'AI-powered photo manager', icon: Image, profile: 'photoprism', category: 'utility' },

    // FILE BROWSER
    // - Simple web file manager for your media server
    // - Great for inspecting folders from a browser
    { id: 'filebrowser', name: 'File Browser', description: 'Web-based file management', icon: HardDrive, profile: 'filebrowser', category: 'utility' },
]

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

    const handleReset = () => {
        if (confirm('Are you sure you want to reset the wizard? All unsaved progress will be lost.')) {
            resetWizard()
            step1Form.reset(initialConfig)
            step4Form.reset(initialConfig)
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
                                className="flex items-center gap-2 px-4 py-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 rounded-lg transition-all text-sm text-red-300 hover:text-red-200"
                                title="Reset wizard to defaults"
                            >
                                <RotateCcw className="w-4 h-4" />
                                Reset
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
                                    onClick={resetWizard}
                                    className="flex items-center gap-2 px-6 py-3 rounded-lg font-medium transition-all btn-lift bg-white/10 text-white hover:bg-white/20"
                                >
                                    <RotateCcw className="w-4 h-4" />
                                    Start Over
                                </button>
                            )}
                        </div>
                    )}
                </div>

            </div>
        </>
    )
}

// Separate step components for better organization
function BasicConfigurationStep({ form, shakeField }: any) {
    const { register, formState: { errors } } = form

    const timezoneOptions = [
        { value: 'Etc/UTC', label: 'Universal Coordinated Time', description: 'Recommended for servers' },
        { value: 'America/New_York', label: 'Eastern Time (US & Canada)' },
        { value: 'America/Los_Angeles', label: 'Pacific Time (US & Canada)' },
        { value: 'Europe/London', label: 'London', description: 'GMT/BST' },
        { value: 'Europe/Berlin', label: 'Berlin', description: 'CET/CEST' },
        { value: 'Asia/Tokyo', label: 'Tokyo', description: 'JST' },
        { value: 'Australia/Sydney', label: 'Sydney', description: 'AEST/AEDT' },
    ]

    const puidOptions = [
        { value: '1000', label: 'Standard User', description: 'Default for most Linux systems' },
        { value: '1001', label: 'Secondary User' },
        { value: '501', label: 'macOS User', description: 'Default for macOS' },
        { value: '0', label: 'Root', description: 'Not recommended for security' },
    ]

    const pgidOptions = [
        { value: '1000', label: 'Standard Group', description: 'Default for most Linux systems' },
        { value: '100', label: 'Users Group', description: 'Common shared group' },
        { value: '20', label: 'Staff Group', description: 'Default for macOS' },
        { value: '0', label: 'Root Group', description: 'Not recommended' },
    ]

    return (
        <motion.div
            key="step1"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-6"
        >
            <div className="mb-6">
                <h2 className="text-2xl font-bold text-white mb-2">Basic Configuration</h2>
                <p className="text-gray-400">Set up your core environment settings</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Domain */}
                <div className={`md:col-span-2 ${shakeField === 'domain' ? 'animate-shake' : ''}`}>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                        Domain <span className="text-red-400">*</span>
                    </label>
                    <div className="relative">
                        <Globe className="absolute left-3 top-3 w-5 h-5 text-gray-500" />
                        <input
                            {...register('domain')}
                            className={`w-full bg-black/30 border ${errors.domain ? 'border-red-500' : 'border-white/10'} rounded-lg py-2.5 pl-11 pr-4 text-white input-focus-glow transition-all`}
                            placeholder="yourdomain.com"
                        />
                    </div>
                    {errors.domain && (
                        <p className="mt-1 text-sm text-red-400 flex items-center gap-1">
                            <AlertCircle className="w-3 h-3" /> {errors.domain.message as string}
                        </p>
                    )}
                    <p className="mt-1 text-xs text-gray-500">Your domain for Cloudflare Tunnel access</p>
                </div>

                {/* Timezone */}
                <div className="md:col-span-2">
                    <ComboboxInput
                        form={form}
                        name="timezone"
                        label="Timezone"
                        icon={Clock}
                        options={timezoneOptions}
                        placeholder="Etc/UTC"
                        description={`Auto-detected: ${Intl.DateTimeFormat().resolvedOptions().timeZone}`}
                    />
                </div>

                {/* PUID */}
                <div>
                    <ComboboxInput
                        form={form}
                        name="puid"
                        label="PUID"
                        icon={User}
                        options={puidOptions}
                        placeholder="1000"
                        description="User ID for file permissions"
                    />
                </div>

                {/* PGID */}
                <div>
                    <ComboboxInput
                        form={form}
                        name="pgid"
                        label="PGID"
                        icon={User}
                        options={pgidOptions}
                        placeholder="1000"
                        description="Group ID for file permissions"
                    />
                </div>

                {/* Master Password */}
                <div className={`md:col-span-2 ${shakeField === 'password' ? 'animate-shake' : ''}`}>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                        Master Password <span className="text-red-400">*</span>
                    </label>
                    <div className="relative">
                        <Lock className="absolute left-3 top-3 w-5 h-5 text-gray-500" />
                        <input
                            {...register('password')}
                            type="password"
                            className={`w-full bg-black/30 border ${errors.password ? 'border-red-500' : 'border-white/10'} rounded-lg py-2.5 pl-11 pr-4 text-white input-focus-glow transition-all`}
                            placeholder="••••••••"
                        />
                    </div>
                    {errors.password && (
                        <p className="mt-1 text-sm text-red-400 flex items-center gap-1">
                            <AlertCircle className="w-3 h-3" /> {errors.password.message as string}
                        </p>
                    )}
                    <p className="mt-1 text-xs text-gray-500">Used for Redis and default service passwords</p>
                </div>
            </div>
        </motion.div>
    )
}

function StackSelectionStep({ mode, setMode, selectedServices, services, toggleService }: any) {
    return (
        <motion.div
            key="step2"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-6"
        >
            <div className="mb-6">
                <h2 className="text-2xl font-bold text-white mb-2">Choose Your Stack</h2>
                <p className="text-gray-400">Select the services you want to install</p>
            </div>

            {/* Mode Selection */}
            {!mode && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                    <button
                        onClick={() => setMode('newbie')}
                        className="group relative p-6 rounded-xl border border-white/10 bg-gradient-to-br from-green-500/10 to-emerald-500/5 hover:from-green-500/20 hover:to-emerald-500/10 transition-all btn-lift"
                    >
                        <div className="flex items-start gap-4">
                            <div className="p-3 bg-green-500/20 rounded-lg">
                                <Zap className="w-6 h-6 text-green-400" />
                            </div>
                            <div className="flex-1 text-left">
                                <h3 className="text-lg font-semibold text-white mb-1">Newbie Mode</h3>
                                <p className="text-sm text-gray-400 mb-3">
                                    Recommended stack with sensible defaults
                                </p>
                                <div className="text-xs text-gray-500">
                                    Includes: Plex, *Arr Stack, Torrent+VPN, Notifications, Stats
                                </div>
                            </div>
                        </div>
                        <ChevronRight className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500 group-hover:text-green-400 transition-colors" />
                    </button>

                    <button
                        onClick={() => setMode('expert')}
                        className="group relative p-6 rounded-xl border border-white/10 bg-gradient-to-br from-purple-500/10 to-pink-500/5 hover:from-purple-500/20 hover:to-pink-500/10 transition-all btn-lift"
                    >
                        <div className="flex items-start gap-4">
                            <div className="p-3 bg-purple-500/20 rounded-lg">
                                <Settings className="w-6 h-6 text-purple-400" />
                            </div>
                            <div className="flex-1 text-left">
                                <h3 className="text-lg font-semibold text-white mb-1">Expert Mode</h3>
                                <p className="text-sm text-gray-400 mb-3">
                                    Choose exactly what you need
                                </p>
                                <div className="text-xs text-gray-500">
                                    Granular control over every service
                                </div>
                            </div>
                        </div>
                        <ChevronRight className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500 group-hover:text-purple-400 transition-colors" />
                    </button>
                </div>
            )}

            {/* Service Selection */}
            {mode && (
                <div>
                    <div className="flex items-center justify-between mb-4">
                        <div className="text-sm text-gray-400">
                            {mode === 'newbie' ? 'Recommended services selected' : 'Select services to install'}
                        </div>
                        {mode === 'newbie' && (
                            <button
                                onClick={() => setMode('expert')}
                                className="text-sm text-purple-400 hover:text-purple-300 transition-colors"
                            >
                                Customize →
                            </button>
                        )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                        {services.map((service: ServiceOption) => {
                            const isSelected = selectedServices.includes(service.profile)
                            const Icon = service.icon
                            const isDisabled = mode === 'newbie'

                            return (
                                <motion.button
                                    key={service.id}
                                    onClick={() => !isDisabled && toggleService(service.profile)}
                                    disabled={isDisabled}
                                    className={`relative p-4 rounded-xl border transition-all ${isSelected
                                        ? 'bg-purple-500/10 border-purple-500/50'
                                        : 'bg-white/5 border-white/10 hover:border-white/20'
                                        } ${isDisabled ? 'cursor-default' : 'cursor-pointer btn-lift'}`}
                                    whileTap={!isDisabled ? { scale: 0.95 } : {}}
                                >
                                    <div className="flex items-start justify-between mb-2">
                                        <div className={`p-2 rounded-lg ${isSelected ? 'bg-purple-500/20 text-purple-300' : 'bg-white/5 text-gray-400'
                                            }`}>
                                            <Icon className="w-4 h-4" />
                                        </div>
                                        {isSelected && (
                                            <motion.div
                                                initial={{ scale: 0 }}
                                                animate={{ scale: 1 }}
                                                className="bg-green-500/20 text-green-400 p-1 rounded-full"
                                            >
                                                <Check className="w-3 h-3" />
                                            </motion.div>
                                        )}
                                    </div>
                                    <h4 className={`text-sm font-semibold mb-1 ${isSelected ? 'text-white' : 'text-gray-300'
                                        }`}>
                                        {service.name}
                                    </h4>
                                    <p className="text-xs text-gray-500">
                                        {service.description}
                                    </p>
                                </motion.button>
                            )
                        })}
                    </div>

                    {selectedServices.length === 0 && (
                        <p className="mt-4 text-sm text-red-400 flex items-center gap-1">
                            <AlertCircle className="w-3 h-3" /> Please select at least one service
                        </p>
                    )}
                </div>
            )}
        </motion.div>
    )
}

function AdvancedSettingsStep({ form, selectedServices }: any) {
    const { register, formState: { errors } } = form

    return (
        <motion.div
            key="step4"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-6"
        >
            <div className="mb-6">
                <h2 className="text-2xl font-bold text-white mb-2">Advanced Settings</h2>
                <p className="text-gray-400">Optional configurations (can be set later)</p>
            </div>

            <div className="space-y-6">
                {/* Cloudflare Token */}
                <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2 flex items-center gap-2">
                        Cloudflare Tunnel Token
                        <a
                            href="https://one.dash.cloudflare.com/"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-400 hover:text-blue-300"
                            title="Open Cloudflare dashboard in a new tab to get your tunnel token"
                        >
                            <HelpCircle className="w-4 h-4" />
                        </a>
                    </label>
                    <input
                        {...register('cloudflareToken')}
                        type="password"
                        className="w-full bg-black/30 border border-white/10 rounded-lg py-2.5 px-4 text-white input-focus-glow transition-all"
                        placeholder="ey..."
                    />
                    <p className="mt-1 text-xs text-gray-500">Required for remote access via Cloudflare Tunnel</p>
                </div>

                {/* Plex Claim */}
                {selectedServices.includes('plex') && (
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2 flex items-center gap-2">
                            Plex Claim Token
                            <a
                                href="https://www.plex.tv/claim"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-400 hover:text-blue-300"
                                title="Open Plex claim page in a new tab to generate a claim token"
                            >
                                <HelpCircle className="w-4 h-4" />
                            </a>
                        </label>
                        <input
                            {...register('plexClaim')}
                            className="w-full bg-black/30 border border-white/10 rounded-lg py-2.5 px-4 text-white input-focus-glow transition-all"
                            placeholder="claim-..."
                        />
                        <p className="mt-1 text-xs text-gray-500">Used to automatically claim your Plex server</p>
                    </div>
                )}

                {/* VPN Settings */}
                {selectedServices.includes('vpn') && (
                    <div className="space-y-4 p-4 bg-white/5 rounded-xl border border-white/10">
                        <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                            <Shield className="w-4 h-4 text-green-400" />
                            VPN Configuration (WireGuard)
                        </h3>
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2">Private Key</label>
                            <input
                                {...register('wireguardPrivateKey')}
                                type="password"
                                className="w-full bg-black/30 border border-white/10 rounded-lg py-2.5 px-4 text-white input-focus-glow transition-all"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2">Address</label>
                            <input
                                {...register('wireguardAddresses')}
                                className="w-full bg-black/30 border border-white/10 rounded-lg py-2.5 px-4 text-white input-focus-glow transition-all"
                                placeholder="10.0.0.2/32"
                            />
                            {errors.wireguardAddresses && (
                                <p className="mt-1 text-sm text-red-400">{errors.wireguardAddresses.message as string}</p>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </motion.div>
    )
}

function ReviewGenerateStep({ config, mode, selectedServices, generateEnvFile, generateAutheliaYaml: _generateAutheliaYaml, generateCloudflareYaml: _generateCloudflareYaml, copyToClipboard, downloadFile, downloadAllFiles, handleShare, copied }: any) {
    const storagePlan = config.storagePlan || createDefaultStoragePlan(DEFAULT_DATA_ROOT)
    const planRoot = storagePlan.dataRoot?.path || DEFAULT_DATA_ROOT
    const storageDefaults = createDefaultStoragePlan(planRoot)
    const storageEntries = STORAGE_CATEGORIES.filter((category) => {
        if (category.alwaysVisible) return true
        if (category.services.length === 0) return false
        return category.services.some((service) => selectedServices.includes(service))
    }).map((category) => ({
        id: category.id,
        label: category.label,
        path: storagePlan[category.id]?.path || storageDefaults[category.id]?.path || '',
        type: storagePlan[category.id]?.type || 'local',
    }))

    return (
        <motion.div
            key="step5"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-6"
        >
            <div className="mb-6">
                <h2 className="text-2xl font-bold text-white mb-2">Review & Generate</h2>
                <p className="text-gray-400">Verify your settings and generate configuration files</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                    <h3 className="text-sm font-semibold text-gray-300 mb-4">Configuration Summary</h3>
                    <dl className="space-y-2 text-sm">
                        <div className="flex justify-between">
                            <dt className="text-gray-500">Domain</dt>
                            <dd className="text-white font-mono">{config.domain}</dd>
                        </div>
                        <div className="flex justify-between">
                            <dt className="text-gray-500">Timezone</dt>
                            <dd className="text-white font-mono">{config.timezone}</dd>
                        </div>
                        <div className="flex justify-between">
                            <dt className="text-gray-500">Mode</dt>
                            <dd className="text-purple-300 capitalize">{mode}</dd>
                        </div>
                        <div className="flex justify-between">
                            <dt className="text-gray-500">Services</dt>
                            <dd className="text-white">{selectedServices.length} selected</dd>
                        </div>
                    </dl>
                </div>

                <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                    <h3 className="text-sm font-semibold text-gray-300 mb-4">Selected Services</h3>
                    <div className="flex flex-wrap gap-2">
                        {selectedServices.map((s: string) => (
                            <span key={s} className="px-2 py-1 rounded-md bg-purple-500/20 text-purple-300 text-xs border border-purple-500/30">
                                {s}
                            </span>
                        ))}
                    </div>
                </div>
            </div>

            {selectedServices.includes('torrent') && !selectedServices.includes('vpn') && (
                <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/30 flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-red-400 mt-0.5" />
                    <div>
                        <h3 className="text-sm font-semibold text-red-300">Security Warning: VPN Missing</h3>
                        <p className="text-sm text-red-200/70 mt-1">
                            You have selected a torrent client but not the VPN service.
                            Your IP address will be exposed to the swarm.
                            It is highly recommended to enable <strong>Gluetun VPN</strong> for privacy.
                        </p>
                    </div>
                </div>
            )}

            <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                <h3 className="text-sm font-semibold text-gray-300 mb-4">Storage Layout</h3>
                <div className="space-y-2 text-xs">
                    {storageEntries.map((entry) => (
                        <div key={entry.id} className="flex items-start justify-between gap-3">
                            <span className="text-gray-500">{entry.label}</span>
                            <div className="text-right">
                                <p className="font-mono text-white break-all">{entry.path}</p>
                                {entry.type === 'network' && (
                                    <span className="text-[10px] text-blue-300 uppercase tracking-wide">Network share</span>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* File Previews */}
            <div className="space-y-4">
                <div className="rounded-xl bg-black/50 border border-white/10 overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-2 bg-white/5 border-b border-white/10">
                        <span className="text-sm font-mono text-gray-300">.env</span>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => copyToClipboard(generateEnvFile())}
                                className="p-1.5 hover:bg-white/10 rounded-lg transition-colors text-gray-400 hover:text-white"
                                title="Copy to clipboard"
                            >
                                {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                            </button>
                            <button
                                onClick={() => downloadFile(generateEnvFile(), '.env')}
                                className="p-1.5 hover:bg-white/10 rounded-lg transition-colors text-gray-400 hover:text-white"
                                title="Download file"
                            >
                                <Download className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                    <pre className="p-4 text-xs font-mono text-gray-300 overflow-x-auto max-h-60 custom-scrollbar">
                        {generateEnvFile()}
                    </pre>
                </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 mt-8">
                <button
                    onClick={downloadAllFiles}
                    className="flex-1 flex items-center justify-center gap-2 px-6 py-4 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white rounded-xl font-semibold shadow-lg shadow-green-500/20 transition-all btn-lift"
                >
                    <Package className="w-5 h-5" />
                    Download All Files
                </button>
                <button
                    onClick={handleShare}
                    className="flex items-center justify-center gap-2 px-6 py-4 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 text-white rounded-xl font-semibold transition-all btn-lift"
                >
                    <Globe className="w-5 h-5" />
                    Share Configuration
                </button>
            </div>

            {/* Post-Install Checklist */}
            <div className="mt-12 pt-8 border-t border-white/10">
                <PostInstallChecklist />
            </div>
        </motion.div>
    )
}
