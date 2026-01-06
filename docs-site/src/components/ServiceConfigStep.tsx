import { useState } from 'react'
import { motion } from 'motion/react'
import { useSetupStore } from '../store/setupStore'
import { generateServiceConfig } from '../utils/aiHelper'
import { useControlServerOpenAIKeyStatus } from '../hooks/useControlServerOpenAIKeyStatus'
import { Sparkles, Loader2, AlertCircle, Info, Clock, CheckCircle } from 'lucide-react'
import { StoragePlanner } from './StoragePlanner'

// Pre-install configs only - things users can configure BEFORE running docker
// API keys are NOT included as they're generated AFTER services start
const preInstallConfigs: Record<string, { 
    fields: Record<string, { default: string; description: string; required?: boolean }>
    postInstallNote: string 
}> = {
    // Media Servers
    plex: {
        fields: {
            ALLOWED_NETWORKS: { 
                default: '192.168.1.0/24', 
                description: 'Your local network range for direct connections' 
            }
        },
        postInstallNote: 'After install: Get your Plex Claim token from plex.tv/claim and add media libraries'
    },
    jellyfin: {
        fields: {},
        postInstallNote: 'After install: Create admin account and add media libraries through the web UI'
    },
    emby: {
        fields: {},
        postInstallNote: 'After install: Create admin account, add libraries, and optionally set up Emby Premiere'
    },
    
    // Media Management
    arr: {
        fields: {},
        postInstallNote: 'After install: API keys are auto-generated. Find them in Settings → General for each *Arr app'
    },
    lidarr: {
        fields: {},
        postInstallNote: 'After install: Add your music root folder, connect indexers, and set up a download client'
    },
    readarr: {
        fields: {},
        postInstallNote: 'After install: Add root folders for books/audiobooks and connect to Calibre if desired'
    },
    transcode: {
        fields: {},
        postInstallNote: 'After install: Configure transcoding rules and connect to your media server'
    },
    
    // Downloads
    torrent: {
        fields: {
            LAN_NETWORK: { 
                default: '192.168.1.0/24', 
                description: 'Your local network for direct access to qBittorrent' 
            }
        },
        postInstallNote: 'After install: Configure download paths and connect to your *Arr apps'
    },
    usenet: {
        fields: {},
        postInstallNote: 'After install: Add your Usenet provider credentials and configure categories for *Arr apps'
    },
    vpn: {
        fields: {},
        postInstallNote: 'After install: Add your VPN provider credentials to the .env file (we\'ll guide you)'
    },
    
    // Request & Discovery
    overseerr: {
        fields: {},
        postInstallNote: 'After install: Sign in with Plex, connect to Sonarr/Radarr, and invite users'
    },
    ombi: {
        fields: {},
        postInstallNote: 'After install: Connect to your media server and *Arr apps, then configure user access'
    },
    petio: {
        fields: {},
        postInstallNote: 'After install: Connect to Plex and *Arr apps for request management'
    },
    
    // Monitoring & Stats
    stats: {
        fields: {},
        postInstallNote: 'After install: Connect to your Plex server using your Plex token'
    },
    notify: {
        fields: {},
        postInstallNote: 'After install: 1) Create free account at notifiarr.com 2) Add your API key to .env 3) Configure Discord webhooks in Notifiarr web UI - auto-syncs with *Arr apps!'
    },
    
    // Utility Apps
    mealie: {
        fields: {},
        postInstallNote: 'After install: Create your account, import recipes from URLs, and set up meal plans'
    },
    kavita: {
        fields: {},
        postInstallNote: 'After install: Create admin account, add library paths for comics/manga/books'
    },
    audiobookshelf: {
        fields: {},
        postInstallNote: 'After install: Create account, add audiobook/podcast library folders, and import metadata'
    },
    photoprism: {
        fields: {},
        postInstallNote: 'After install: Set admin password, add photo folders, and let indexing complete'
    },
    filebrowser: {
        fields: {},
        postInstallNote: 'After install: Default login is admin/admin - change it immediately!'
    }
}

export function ServiceConfigStep() {
    const { selectedServices, config, updateServiceConfig } = useSetupStore()
    const [activeService, setActiveService] = useState(selectedServices[0])
    const [isGenerating, setIsGenerating] = useState(false)
    const [aiError, setAiError] = useState<string | null>(null)
    const { hasKey: hasRemoteKey } = useControlServerOpenAIKeyStatus()

    // Get pre-install config for the active service
    const serviceConfig = preInstallConfigs[activeService] || { fields: {}, postInstallNote: '' }
    const currentValues = config.serviceConfigs[activeService] || {}

    const handleInputChange = (key: string, value: string) => {
        updateServiceConfig(activeService, { [key]: value })
    }

    const handleAiSuggest = async () => {
        setIsGenerating(true)
        setAiError(null)
        try {
            const result = await generateServiceConfig(activeService, config)
            if (result.config) {
                updateServiceConfig(activeService, result.config)
            } else {
                setAiError(result.suggestion)
            }
        } catch (err) {
            console.error('ServiceConfigStep: generateServiceConfig failed', err)
            setAiError('Failed to generate suggestions')
        } finally {
            setIsGenerating(false)
        }
    }

    return (
        <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-4 sm:space-y-6 px-4 sm:px-0"
        >
            <div className="mb-4 sm:mb-6">
                <h2 className="text-xl sm:text-2xl font-bold text-white mb-2">Service Configuration</h2>
                <p className="text-sm sm:text-base text-gray-400 break-words">Review settings - most services work with defaults!</p>
            </div>

            {/* Helpful banner for non-techie users */}
            <div className="p-3 sm:p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg sm:rounded-xl flex items-start gap-3">
                <Info className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
                <div className="text-xs sm:text-sm">
                    <p className="text-blue-200 font-medium break-words">Good news! Most settings are configured automatically.</p>
                    <p className="text-blue-300/70 mt-1 break-words">API keys and tokens are generated after installation. We'll guide you through those in the Post-Install Checklist.</p>
                </div>
            </div>

            <StoragePlanner />

            <div className="flex flex-col md:flex-row gap-4 sm:gap-6 min-h-[350px]">
                {/* Sidebar - Service List */}
                <div className="w-full md:w-64 flex flex-row md:flex-col gap-2 overflow-x-auto md:overflow-visible pb-2 md:pb-0">
                    {selectedServices.map(serviceId => {
                        const hasFields = Object.keys(preInstallConfigs[serviceId]?.fields || {}).length > 0
                        return (
                            <button
                                key={serviceId}
                                onClick={() => setActiveService(serviceId)}
                                className={`flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2.5 sm:py-3 rounded-lg text-xs sm:text-sm font-medium transition-all whitespace-nowrap touch-target-44 ${activeService === serviceId
                                    ? 'bg-primary/20 text-primary border border-primary/40'
                                    : 'bg-white/5 text-gray-400 hover:bg-white/10 border border-transparent'
                                    }`}
                            >
                                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${hasFields ? 'bg-yellow-500' : 'bg-green-500'}`} />
                                <span className="break-words">{serviceId.charAt(0).toUpperCase() + serviceId.slice(1)}</span>
                                {!hasFields && <CheckCircle className="w-3 h-3 text-green-400 ml-auto flex-shrink-0" />}
                            </button>
                        )
                    })}
                </div>

                {/* Main Content - Config Form */}
                <div className="flex-1 bg-black/20 rounded-lg sm:rounded-xl border border-white/10 p-4 sm:p-6">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0 mb-4 sm:mb-6">
                        <h3 className="text-base sm:text-lg font-semibold text-white capitalize break-words">
                            {activeService} Settings
                        </h3>
                        {hasRemoteKey && Object.keys(serviceConfig.fields).length > 0 && (
                            <button
                                onClick={handleAiSuggest}
                                disabled={isGenerating}
                                className="flex items-center gap-2 px-3 sm:px-4 py-2 sm:py-2.5 bg-primary/10 hover:bg-primary/20 border border-primary/40 rounded-lg text-xs sm:text-sm text-primary transition-all disabled:opacity-50 touch-target-44 w-full sm:w-auto"
                                title="Get AI suggestions"
                            >
                                {isGenerating ? (
                                    <Loader2 className="w-4 h-4 animate-spin flex-shrink-0" />
                                ) : (
                                    <Sparkles className="w-4 h-4 flex-shrink-0" />
                                )}
                                <span>AI Suggest</span>
                            </button>
                        )}
                    </div>

                    {aiError && (
                        <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-start gap-2 text-xs sm:text-sm text-red-400">
                            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                            <span className="break-words">{aiError}</span>
                        </div>
                    )}

                    <div className="space-y-4">
                        {Object.keys(serviceConfig.fields).length > 0 ? (
                            Object.entries(serviceConfig.fields).map(([key, fieldConfig]) => (
                                <div key={key}>
                                    <label
                                        htmlFor={`field-${key}`}
                                        className="block text-xs font-medium text-gray-400 mb-1.5 uppercase tracking-wider break-words"
                                    >
                                        {key.replace(/_/g, ' ')}
                                    </label>
                                    <input
                                        id={`field-${key}`}
                                        type="text"
                                        value={currentValues[key] || fieldConfig.default}
                                        onChange={(e) => handleInputChange(key, e.target.value)}
                                        placeholder={fieldConfig.default}
                                        className="w-full h-11 bg-black/30 border border-white/10 rounded-lg px-3 text-base text-white focus:border-primary/50 focus:ring-1 focus:ring-primary/50 transition-all outline-none"
                                    />
                                    <p className="mt-1 text-xs text-gray-500 break-words">{fieldConfig.description}</p>
                                </div>
                            ))
                        ) : (
                            <div className="text-center py-6 sm:py-8">
                                <CheckCircle className="w-10 h-10 sm:w-12 sm:h-12 text-green-400 mx-auto mb-3 flex-shrink-0" />
                                <p className="text-sm sm:text-base text-white font-medium break-words">No pre-configuration needed!</p>
                                <p className="text-xs sm:text-sm text-gray-500 mt-1 break-words">This service works out of the box.</p>
                            </div>
                        )}
                    </div>

                    {/* Post-install note */}
                    {serviceConfig.postInstallNote && (
                        <div className="mt-4 sm:mt-6 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg flex items-start gap-2">
                            <Clock className="w-4 h-4 text-yellow-400 flex-shrink-0 mt-0.5" />
                            <p className="text-xs text-yellow-200 break-words">{serviceConfig.postInstallNote}</p>
                        </div>
                    )}
                </div>
            </div>
        </motion.div>
    )
}
