import {
    Activity, Bell, Book, BookOpen, Clapperboard, Cpu, Download, Film, HardDrive, Image, Inbox, Layers, ListVideo, MonitorPlay, Music, Radio, Search, Shield, Tv, UtensilsCrossed
} from 'lucide-react'

export interface ServiceOption {
    id: string
    name: string
    description: string
    icon: any
    logo?: string
    profile: string
    category: string
}

export const services: ServiceOption[] = [
    { 
        id: 'plex', 
        name: 'Plex', 
        description: 'Premium media server with polished UI', 
        icon: Film, 
        logo: '/icons/plex.svg', 
        profile: 'plex', 
        category: 'Media Server' 
    },
    { 
        id: 'jellyfin', 
        name: 'Jellyfin', 
        description: 'Free, open-source media server with no paid tier', 
        icon: Tv, 
        logo: '/icons/jellyfin.svg', 
        profile: 'jellyfin', 
        category: 'Media Server' 
    },
    { 
        id: 'emby', 
        name: 'Emby', 
        description: 'Media server with live TV support', 
        icon: MonitorPlay, 
        logo: '/icons/emby.svg', 
        profile: 'emby', 
        category: 'Media Server' 
    },
    { 
        id: 'sonarr', 
        name: 'Sonarr', 
        description: 'Automated TV series management', 
        icon: Layers, 
        logo: '/icons/sonarr.svg', 
        profile: 'sonarr', 
        category: 'Automation' 
    },
    { 
        id: 'radarr', 
        name: 'Radarr', 
        description: 'Automated movie management', 
        icon: Layers, 
        logo: '/icons/radarr.svg', 
        profile: 'radarr', 
        category: 'Automation' 
    },
    { 
        id: 'prowlarr', 
        name: 'Prowlarr', 
        description: 'Indexer management for *Arr apps', 
        icon: Layers, 
        logo: '/icons/prowlarr.svg', 
        profile: 'prowlarr', 
        category: 'Automation' 
    },
    { 
        id: 'bazarr', 
        name: 'Bazarr', 
        description: 'Subtitle management for Sonarr/Radarr', 
        icon: Layers, 
        logo: '/icons/bazarr.svg', 
        profile: 'bazarr', 
        category: 'Automation' 
    },
    { 
        id: 'lidarr', 
        name: 'Lidarr', 
        description: 'Music collection manager', 
        icon: Music, 
        logo: '/icons/lidarr.svg', 
        profile: 'lidarr', 
        category: 'Automation' 
    },
    { 
        id: 'readarr', 
        name: 'Readarr', 
        description: 'Book & audiobook manager', 
        icon: BookOpen, 
        logo: '/icons/readarr.svg', 
        profile: 'readarr', 
        category: 'Automation' 
    },
    { 
        id: 'tdarr', 
        name: 'Tdarr', 
        description: 'Distributed transcoding to save space', 
        icon: Cpu, 
        logo: '/icons/tdarr.png', 
        profile: 'transcode', 
        category: 'Automation' 
    },
    { 
        id: 'qbittorrent', 
        name: 'qBittorrent', 
        description: 'Torrent client for downloads', 
        icon: Download, 
        logo: '/icons/qbittorrent.svg', 
        profile: 'torrent', 
        category: 'Download' 
    },
    { 
        id: 'sabnzbd', 
        name: 'SABnzbd', 
        description: 'Usenet downloader', 
        icon: Inbox, 
        logo: '/icons/sabnzbd.svg', 
        profile: 'usenet', 
        category: 'Download' 
    },
    { 
        id: 'gluetun', 
        name: 'Gluetun VPN', 
        description: 'Secure VPN tunnel for privacy', 
        icon: Shield, 
        logo: '/icons/gluetun.svg', 
        profile: 'vpn', 
        category: 'Download' 
    },
    { 
        id: 'overseerr', 
        name: 'Overseerr', 
        description: 'Media request management', 
        icon: Search, 
        logo: '/icons/overseerr.svg', 
        profile: 'overseerr', 
        category: 'Request' 
    },
    { 
        id: 'ombi', 
        name: 'Ombi', 
        description: 'User media requests', 
        icon: ListVideo, 
        logo: '/icons/ombi.svg', 
        profile: 'ombi', 
        category: 'Request' 
    },
    { 
        id: 'petio', 
        name: 'Petio', 
        description: 'Request manager with recommendations', 
        icon: Clapperboard, 
        logo: '/icons/petio.png', 
        profile: 'petio', 
        category: 'Request' 
    },
    { 
        id: 'tautulli', 
        name: 'Tautulli', 
        description: 'Plex usage statistics', 
        icon: Activity, 
        logo: '/icons/tautulli.svg', 
        profile: 'stats', 
        category: 'Monitoring' 
    },
    { 
        id: 'notifiarr', 
        name: 'Notifiarr', 
        description: 'Unified notifications', 
        icon: Bell, 
        logo: '/icons/notifiarr.svg', 
        profile: 'notify', 
        category: 'Monitoring' 
    },
    { 
        id: 'mealie', 
        name: 'Mealie', 
        description: 'Recipe manager & meal planner', 
        icon: UtensilsCrossed, 
        logo: '/icons/mealie.svg', 
        profile: 'mealie', 
        category: 'Utility' 
    },
    { 
        id: 'kavita', 
        name: 'Kavita', 
        description: 'Comics, manga & ebook reader', 
        icon: Book, 
        logo: '/icons/kavita.svg', 
        profile: 'kavita', 
        category: 'Utility' 
    },
    { 
        id: 'audiobookshelf', 
        name: 'Audiobookshelf', 
        description: 'Audiobook & podcast server', 
        icon: Radio, 
        logo: '/icons/audiobookshelf.svg', 
        profile: 'audiobookshelf', 
        category: 'Utility' 
    },
    { 
        id: 'photoprism', 
        name: 'PhotoPrism', 
        description: 'AI-powered photo manager', 
        icon: Image, 
        logo: '/icons/photoprism.svg', 
        profile: 'photoprism', 
        category: 'Utility' 
    },
    { 
        id: 'filebrowser', 
        name: 'File Browser', 
        description: 'Web-based file management', 
        icon: HardDrive, 
        logo: '/icons/filebrowser.svg', 
        profile: 'filebrowser', 
        category: 'Utility' 
    },
]
