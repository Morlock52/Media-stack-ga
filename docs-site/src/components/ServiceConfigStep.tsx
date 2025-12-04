import { useState } from 'react'
import { motion } from 'framer-motion'
import { useSetupStore } from '../store/setupStore'
import { generateServiceConfig } from '../utils/aiHelper'
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
        postInstallNote: 'After install: Create a Notifiarr account and add the API key to each *Arr app'
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
            className="space-y-6"
        >
            <div className="mb-6">
                <h2 className="text-2xl font-bold text-white mb-2">Service Configuration</h2>
                <p className="text-gray-400">Review settings - most services work with defaults!</p>
            </div>

            {/* Helpful banner for non-techie users */}
            <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl flex items-start gap-3">
                <Info className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
                <div className="text-sm">
                    <p className="text-blue-200 font-medium">Good news! Most settings are configured automatically.</p>
                    <p className="text-blue-300/70 mt-1">API keys and tokens are generated after installation. We'll guide you through those in the Post-Install Checklist.</p>
                </div>
            </div>

            <StoragePlanner />

            <div className="flex flex-col md:flex-row gap-6 min-h-[350px]">
                {/* Sidebar - Service List */}
                <div className="w-full md:w-64 flex flex-row md:flex-col gap-2 overflow-x-auto md:overflow-visible pb-2 md:pb-0">
                    {selectedServices.map(serviceId => {
                        const hasFields = Object.keys(preInstallConfigs[serviceId]?.fields || {}).length > 0
                        return (
                            <button
                                key={serviceId}
                                onClick={() => setActiveService(serviceId)}
                                className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${activeService === serviceId
                                    ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                                    : 'bg-white/5 text-gray-400 hover:bg-white/10 border border-transparent'
                                    }`}
                            >
                                <div className={`w-2 h-2 rounded-full ${hasFields ? 'bg-yellow-500' : 'bg-green-500'}`} />
                                {serviceId.charAt(0).toUpperCase() + serviceId.slice(1)}
                                {!hasFields && <CheckCircle className="w-3 h-3 text-green-400 ml-auto" />}
                            </button>
                        )
                    })}
                </div>

                {/* Main Content - Config Form */}
                <div className="flex-1 bg-black/20 rounded-xl border border-white/10 p-6">
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="text-lg font-semibold text-white capitalize">
                            {activeService} Settings
                        </h3>
                        {config.openaiApiKey && Object.keys(serviceConfig.fields).length > 0 && (
                            <button
                                onClick={handleAiSuggest}
                                disabled={isGenerating}
                                className="flex items-center gap-2 px-3 py-1.5 bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/30 rounded-lg text-xs text-purple-300 transition-all disabled:opacity-50"
                                title="Get AI suggestions"
                            >
                                {isGenerating ? (
                                    <Loader2 className="w-3 h-3 animate-spin" />
                                ) : (
                                    <Sparkles className="w-3 h-3" />
                                )}
                                AI Suggest
                            </button>
                        )}
                    </div>

                    {aiError && (
                        <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center gap-2 text-sm text-red-400">
                            <AlertCircle className="w-4 h-4" />
                            {aiError}
                        </div>
                    )}

                    <div className="space-y-4">
                        {Object.keys(serviceConfig.fields).length > 0 ? (
                            Object.entries(serviceConfig.fields).map(([key, fieldConfig]) => (
                                <div key={key}>
                                    <label 
                                        htmlFor={`field-${key}`}
                                        className="block text-xs font-medium text-gray-400 mb-1.5 uppercase tracking-wider"
                                    >
                                        {key.replace(/_/g, ' ')}
                                    </label>
                                    <input
                                        id={`field-${key}`}
                                        type="text"
                                        value={currentValues[key] || fieldConfig.default}
                                        onChange={(e) => handleInputChange(key, e.target.value)}
                                        placeholder={fieldConfig.default}
                                        className="w-full bg-black/30 border border-white/10 rounded-lg py-2 px-3 text-sm text-white focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/50 transition-all outline-none"
                                    />
                                    <p className="mt-1 text-xs text-gray-500">{fieldConfig.description}</p>
                                </div>
                            ))
                        ) : (
                            <div className="text-center py-8">
                                <CheckCircle className="w-12 h-12 text-green-400 mx-auto mb-3" />
                                <p className="text-white font-medium">No pre-configuration needed!</p>
                                <p className="text-gray-500 text-sm mt-1">This service works out of the box.</p>
                            </div>
                        )}
                    </div>

                    {/* Post-install note */}
                    {serviceConfig.postInstallNote && (
                        <div className="mt-6 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg flex items-start gap-2">
                            <Clock className="w-4 h-4 text-yellow-400 flex-shrink-0 mt-0.5" />
                            <p className="text-xs text-yellow-200">{serviceConfig.postInstallNote}</p>
                        </div>
                    )}
                </div>
            </div>
        </motion.div>
    )
}
