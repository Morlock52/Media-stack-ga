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
    logo?: string
    profile: string
    category: 'media' | 'automation' | 'download' | 'monitoring' | 'request' | 'utility'
}

export const services: ServiceOption[] = [
    // MEDIA SERVERS
    { id: 'plex', name: 'Plex', description: 'Premium media server with polished UI', icon: Film, logo: '/icons/plex.svg', profile: 'plex', category: 'media' },
    { id: 'jellyfin', name: 'Jellyfin', description: 'Free, open-source media server', icon: Tv, logo: '/icons/jellyfin.svg', profile: 'jellyfin', category: 'media' },
    { id: 'emby', name: 'Emby', description: 'Media server with live TV support', icon: MonitorPlay, logo: '/icons/emby.svg', profile: 'emby', category: 'media' },

    // MEDIA MANAGEMENT
    { id: 'sonarr', name: 'Sonarr', description: 'Automated TV series management', icon: Layers, logo: '/icons/sonarr.svg', profile: 'sonarr', category: 'automation' },
    { id: 'radarr', name: 'Radarr', description: 'Automated movie management', icon: Layers, logo: '/icons/radarr.svg', profile: 'radarr', category: 'automation' },
    { id: 'prowlarr', name: 'Prowlarr', description: 'Indexer management for *Arr apps', icon: Layers, logo: '/icons/prowlarr.svg', profile: 'prowlarr', category: 'automation' },
    { id: 'bazarr', name: 'Bazarr', description: 'Subtitle management for Sonarr/Radarr', icon: Layers, logo: '/icons/bazarr.svg', profile: 'bazarr', category: 'automation' },
    { id: 'lidarr', name: 'Lidarr', description: 'Music collection manager', icon: Music, logo: '/icons/lidarr.svg', profile: 'lidarr', category: 'automation' },
    { id: 'readarr', name: 'Readarr', description: 'Book & audiobook manager', icon: BookOpen, logo: '/icons/readarr.svg', profile: 'readarr', category: 'automation' },
    { id: 'transcode', name: 'Tdarr', description: 'Distributed transcoding', icon: Cpu, logo: '/icons/tdarr.png', profile: 'transcode', category: 'automation' },

    // DOWNLOADS
    { id: 'torrent', name: 'Torrent Client', description: 'qBittorrent for downloads', icon: DownloadIcon, logo: '/icons/qbittorrent.svg', profile: 'torrent', category: 'download' },
    { id: 'usenet', name: 'SABnzbd', description: 'Usenet downloader', icon: Inbox, logo: '/icons/sabnzbd.svg', profile: 'usenet', category: 'download' },
    { id: 'vpn', name: 'Gluetun VPN', description: 'Secure VPN tunnel for privacy', icon: Shield, logo: '/icons/gluetun.svg', profile: 'vpn', category: 'download' },

    // REQUEST & DISCOVERY
    { id: 'overseerr', name: 'Overseerr', description: 'Media request management', icon: Search, logo: '/icons/overseerr.svg', profile: 'overseerr', category: 'request' },
    { id: 'ombi', name: 'Ombi', description: 'User media requests', icon: ListVideo, logo: '/icons/ombi.svg', profile: 'ombi', category: 'request' },
    { id: 'petio', name: 'Petio', description: 'Request manager with recommendations', icon: Clapperboard, logo: '/icons/petio.png', profile: 'petio', category: 'request' },

    // MONITORING & NOTIFICATIONS
    { id: 'stats', name: 'Tautulli', description: 'Plex usage statistics', icon: Activity, logo: '/icons/tautulli.svg', profile: 'stats', category: 'monitoring' },
    { id: 'notify', name: 'Notifiarr', description: 'Unified notifications', icon: Bell, logo: '/icons/notifiarr.svg', profile: 'notify', category: 'monitoring' },

    // UTILITY APPS
    { id: 'mealie', name: 'Mealie', description: 'Recipe manager & meal planner', icon: UtensilsCrossed, logo: '/icons/mealie.svg', profile: 'mealie', category: 'utility' },
    { id: 'kavita', name: 'Kavita', description: 'Comics, manga & ebook reader', icon: Book, logo: '/icons/kavita.svg', profile: 'kavita', category: 'utility' },
    { id: 'audiobookshelf', name: 'Audiobookshelf', description: 'Audiobook & podcast server', icon: Radio, logo: '/icons/audiobookshelf.svg', profile: 'audiobookshelf', category: 'utility' },
    { id: 'photoprism', name: 'PhotoPrism', description: 'AI-powered photo manager', icon: Image, logo: '/icons/photoprism.svg', profile: 'photoprism', category: 'utility' },
    { id: 'filebrowser', name: 'File Browser', description: 'Web-based file management', icon: HardDrive, logo: '/icons/filebrowser.svg', profile: 'filebrowser', category: 'utility' },
]
