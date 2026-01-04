import {
    Film, Tv, MonitorPlay, Layers, Music, BookOpen, Cpu, Download as DownloadIcon,
    Inbox, Shield, Search, ListVideo, Clapperboard, Activity, Bell, UtensilsCrossed,
    Book, Radio, Image, HardDrive
} from 'lucide-react'

export interface ServiceOption {
    id: string
    name: string
    description: string
    icon: any
    profile: string
    category: 'media' | 'automation' | 'download' | 'monitoring' | 'request' | 'utility'
    // Docker Compose profiles for selective deployment
    composeProfiles?: string[]
    // Recommended for specific media server setups
    recommendedWith?: string[]
}

export const services: ServiceOption[] = [
    // MEDIA SERVERS
    { id: 'plex', name: 'Plex', description: 'Premium media server with polished UI', icon: Film, profile: 'plex', category: 'media', composeProfiles: ['media', 'plex'], recommendedWith: ['overseerr', 'stats'] },
    { id: 'jellyfin', name: 'Jellyfin', description: 'Free, open-source media server', icon: Tv, profile: 'jellyfin', category: 'media', composeProfiles: ['media', 'jellyfin'], recommendedWith: ['jellyseerr'] },
    { id: 'emby', name: 'Emby', description: 'Media server with live TV support', icon: MonitorPlay, profile: 'emby', category: 'media', composeProfiles: ['media', 'emby'] },

    // MEDIA MANAGEMENT
    { id: 'arr', name: '*Arr Stack', description: 'Sonarr + Radarr + Prowlarr + Overseerr + Bazarr', icon: Layers, profile: 'arr', category: 'automation', composeProfiles: ['automation', 'arr'], recommendedWith: ['torrent', 'vpn'] },
    { id: 'sonarr', name: 'Sonarr', description: 'Automated TV series management', icon: Layers, profile: 'sonarr', category: 'automation', composeProfiles: ['automation', 'arr'], recommendedWith: ['prowlarr', 'torrent'] },
    { id: 'radarr', name: 'Radarr', description: 'Automated movie management', icon: Layers, profile: 'radarr', category: 'automation', composeProfiles: ['automation', 'arr'], recommendedWith: ['prowlarr', 'torrent'] },
    { id: 'prowlarr', name: 'Prowlarr', description: 'Indexer management for *Arr apps', icon: Layers, profile: 'prowlarr', category: 'automation', composeProfiles: ['automation', 'arr'], recommendedWith: ['sonarr', 'radarr'] },
    { id: 'bazarr', name: 'Bazarr', description: 'Subtitle management for Sonarr/Radarr', icon: Layers, profile: 'bazarr', category: 'automation', composeProfiles: ['automation', 'arr'], recommendedWith: ['sonarr', 'radarr'] },
    { id: 'lidarr', name: 'Lidarr', description: 'Music collection manager', icon: Music, profile: 'lidarr', category: 'automation', composeProfiles: ['automation', 'music'] },
    { id: 'readarr', name: 'Readarr', description: 'Book & audiobook manager', icon: BookOpen, profile: 'readarr', category: 'automation', composeProfiles: ['automation', 'books'], recommendedWith: ['audiobookshelf'] },
    { id: 'transcode', name: 'Tdarr', description: 'Distributed transcoding', icon: Cpu, profile: 'transcode', category: 'automation', composeProfiles: ['automation', 'transcode'] },

    // DOWNLOADS
    { id: 'torrent', name: 'Torrent Client', description: 'qBittorrent for downloads', icon: DownloadIcon, profile: 'torrent', category: 'download', composeProfiles: ['download'], recommendedWith: ['vpn', 'sonarr', 'radarr'] },
    { id: 'usenet', name: 'SABnzbd', description: 'Usenet downloader', icon: Inbox, profile: 'usenet', category: 'download', composeProfiles: ['download', 'usenet'] },
    { id: 'vpn', name: 'Gluetun VPN', description: 'Secure VPN tunnel for privacy', icon: Shield, profile: 'vpn', category: 'download', composeProfiles: ['download', 'vpn'], recommendedWith: ['torrent'] },

    // REQUEST & DISCOVERY
    { id: 'overseerr', name: 'Overseerr', description: 'Media request management', icon: Search, profile: 'overseerr', category: 'request', composeProfiles: ['request'], recommendedWith: ['plex', 'sonarr', 'radarr'] },
    { id: 'ombi', name: 'Ombi', description: 'User media requests', icon: ListVideo, profile: 'ombi', category: 'request', composeProfiles: ['request'] },
    { id: 'petio', name: 'Petio', description: 'Request manager with recommendations', icon: Clapperboard, profile: 'petio', category: 'request', composeProfiles: ['request'] },

    // MONITORING & NOTIFICATIONS
    { id: 'stats', name: 'Tautulli', description: 'Plex usage statistics', icon: Activity, profile: 'stats', category: 'monitoring', composeProfiles: ['monitoring'], recommendedWith: ['plex'] },
    { id: 'notify', name: 'Notifiarr', description: 'Unified notifications', icon: Bell, profile: 'notify', category: 'monitoring', composeProfiles: ['monitoring', 'notifications'] },

    // UTILITY APPS
    { id: 'mealie', name: 'Mealie', description: 'Recipe manager & meal planner', icon: UtensilsCrossed, profile: 'mealie', category: 'utility', composeProfiles: ['utility'] },
    { id: 'kavita', name: 'Kavita', description: 'Comics, manga & ebook reader', icon: Book, profile: 'kavita', category: 'utility', composeProfiles: ['utility', 'books'] },
    { id: 'audiobookshelf', name: 'Audiobookshelf', description: 'Audiobook & podcast server', icon: Radio, profile: 'audiobookshelf', category: 'utility', composeProfiles: ['utility', 'books'], recommendedWith: ['readarr'] },
    { id: 'photoprism', name: 'PhotoPrism', description: 'AI-powered photo manager', icon: Image, profile: 'photoprism', category: 'utility', composeProfiles: ['utility', 'photos'] },
    { id: 'filebrowser', name: 'File Browser', description: 'Web-based file management', icon: HardDrive, profile: 'filebrowser', category: 'utility', composeProfiles: ['utility'] },
]

// Get unique compose profiles from selected services
export function getComposeProfilesForServices(selectedServiceIds: string[]): string[] {
    const profiles = new Set<string>()
    for (const service of services) {
        if (selectedServiceIds.includes(service.id) && service.composeProfiles) {
            service.composeProfiles.forEach(p => profiles.add(p))
        }
    }
    return Array.from(profiles).sort()
}

// Get service recommendations based on current selections
export function getServiceRecommendations(selectedServiceIds: string[]): Array<{ service: ServiceOption; reason: string }> {
    const recommendations: Array<{ service: ServiceOption; reason: string }> = []
    const selectedSet = new Set(selectedServiceIds)

    for (const service of services) {
        // Skip already selected services
        if (selectedSet.has(service.id)) continue

        // Check if this service is recommended by any selected service
        for (const selectedId of selectedServiceIds) {
            const selectedService = services.find(s => s.id === selectedId)
            if (selectedService?.recommendedWith?.includes(service.id)) {
                recommendations.push({
                    service,
                    reason: `Works great with ${selectedService.name}`
                })
                break // Only add once per service
            }
        }

        // Check if any selected service is recommended with this one
        if (!recommendations.find(r => r.service.id === service.id) && service.recommendedWith) {
            const matchedService = services.find(
                s => selectedSet.has(s.id) && service.recommendedWith?.includes(s.id)
            )
            if (matchedService) {
                recommendations.push({
                    service,
                    reason: `Recommended with ${matchedService.name}`
                })
            }
        }
    }

    return recommendations.slice(0, 3) // Return top 3 recommendations
}
