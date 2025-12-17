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
}

export const services: ServiceOption[] = [
    // MEDIA SERVERS
    { id: 'plex', name: 'Plex', description: 'Premium media server with polished UI', icon: Film, profile: 'plex', category: 'media' },
    { id: 'jellyfin', name: 'Jellyfin', description: 'Free, open-source media server', icon: Tv, profile: 'jellyfin', category: 'media' },
    { id: 'emby', name: 'Emby', description: 'Media server with live TV support', icon: MonitorPlay, profile: 'emby', category: 'media' },

    // MEDIA MANAGEMENT
    { id: 'arr', name: '*Arr Stack', description: 'Sonarr + Radarr + Prowlarr + Overseerr + Bazarr', icon: Layers, profile: 'arr', category: 'automation' },
    { id: 'sonarr', name: 'Sonarr', description: 'Automated TV series management', icon: Layers, profile: 'sonarr', category: 'automation' },
    { id: 'radarr', name: 'Radarr', description: 'Automated movie management', icon: Layers, profile: 'radarr', category: 'automation' },
    { id: 'prowlarr', name: 'Prowlarr', description: 'Indexer management for *Arr apps', icon: Layers, profile: 'prowlarr', category: 'automation' },
    { id: 'bazarr', name: 'Bazarr', description: 'Subtitle management for Sonarr/Radarr', icon: Layers, profile: 'bazarr', category: 'automation' },
    { id: 'lidarr', name: 'Lidarr', description: 'Music collection manager', icon: Music, profile: 'lidarr', category: 'automation' },
    { id: 'readarr', name: 'Readarr', description: 'Book & audiobook manager', icon: BookOpen, profile: 'readarr', category: 'automation' },
    { id: 'transcode', name: 'Tdarr', description: 'Distributed transcoding', icon: Cpu, profile: 'transcode', category: 'automation' },

    // DOWNLOADS
    { id: 'torrent', name: 'Torrent Client', description: 'qBittorrent for downloads', icon: DownloadIcon, profile: 'torrent', category: 'download' },
    { id: 'usenet', name: 'SABnzbd', description: 'Usenet downloader', icon: Inbox, profile: 'usenet', category: 'download' },
    { id: 'vpn', name: 'Gluetun VPN', description: 'Secure VPN tunnel for privacy', icon: Shield, profile: 'vpn', category: 'download' },

    // REQUEST & DISCOVERY
    { id: 'overseerr', name: 'Overseerr', description: 'Media request management', icon: Search, profile: 'overseerr', category: 'request' },
    { id: 'ombi', name: 'Ombi', description: 'User media requests', icon: ListVideo, profile: 'ombi', category: 'request' },
    { id: 'petio', name: 'Petio', description: 'Request manager with recommendations', icon: Clapperboard, profile: 'petio', category: 'request' },

    // MONITORING & NOTIFICATIONS
    { id: 'stats', name: 'Tautulli', description: 'Plex usage statistics', icon: Activity, profile: 'stats', category: 'monitoring' },
    { id: 'notify', name: 'Notifiarr', description: 'Unified notifications', icon: Bell, profile: 'notify', category: 'monitoring' },

    // UTILITY APPS
    { id: 'mealie', name: 'Mealie', description: 'Recipe manager & meal planner', icon: UtensilsCrossed, profile: 'mealie', category: 'utility' },
    { id: 'kavita', name: 'Kavita', description: 'Comics, manga & ebook reader', icon: Book, profile: 'kavita', category: 'utility' },
    { id: 'audiobookshelf', name: 'Audiobookshelf', description: 'Audiobook & podcast server', icon: Radio, profile: 'audiobookshelf', category: 'utility' },
    { id: 'photoprism', name: 'PhotoPrism', description: 'AI-powered photo manager', icon: Image, profile: 'photoprism', category: 'utility' },
    { id: 'filebrowser', name: 'File Browser', description: 'Web-based file management', icon: HardDrive, profile: 'filebrowser', category: 'utility' },
]
