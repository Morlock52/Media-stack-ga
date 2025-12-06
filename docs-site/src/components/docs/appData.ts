import type { LucideIcon } from 'lucide-react'
import {
    Activity, Bell, Book, BookOpen, Bug, Clapperboard, Cloud, Container, Cpu, Database, Download, Film, HardDrive, Home, Image, Inbox, Layers, ListVideo, MonitorPlay, Music, Radio, RefreshCw, Search, Shield, Terminal, Tv, UtensilsCrossed
} from 'lucide-react'

export type AppId =
    | 'arr'
    | 'plex'
    | 'jellyfin'
    | 'emby'
    | 'sonarr'
    | 'radarr'
    | 'prowlarr'
    | 'bazarr'
    | 'lidarr'
    | 'readarr'
    | 'tdarr'
    | 'qbittorrent'
    | 'sabnzbd'
    | 'gluetun'
    | 'overseerr'
    | 'ombi'
    | 'petio'
    | 'tautulli'
    | 'notifiarr'
    | 'mealie'
    | 'kavita'
    | 'audiobookshelf'
    | 'photoprism'
    | 'filebrowser'
    | 'homepage'
    | 'authelia'
    | 'redis'
    | 'portainer'
    | 'dozzle'
    | 'watchtower'
    | 'flaresolverr'
    | 'cloudflared'

export interface AppInfo {
    id: AppId
    name: string
    category: string
    description: string
    icon: LucideIcon
    logo?: string
    difficulty: 'Easy' | 'Medium' | 'Advanced'
    time: string
    guideComponent?: string
}

export const appCards: AppInfo[] = [
    {
        id: 'arr',
        name: '*Arr Stack',
        category: 'Automation',
        description: 'Bundled guide for Sonarr, Radarr, Prowlarr, and Bazarr',
        icon: Layers,
        logo: '',
        difficulty: 'Medium',
        time: '45-60 min',
        guideComponent: 'ArrStackGuide'
    },
    {
        id: 'plex',
        name: 'Plex',
        category: 'Media Server',
        description: 'Premium media server with polished UI',
        icon: Film,
        logo: '/icons/plex.svg',
        difficulty: 'Easy',
        time: '15-30 min',
        guideComponent: 'PlexGuide'
    },
    {
        id: 'jellyfin',
        name: 'Jellyfin',
        category: 'Media Server',
        description: 'Free, open-source media server with no paid tier',
        icon: Tv,
        logo: '/icons/jellyfin.svg',
        difficulty: 'Easy',
        time: '15-30 min',
        guideComponent: 'JellyfinGuide'
    },
    {
        id: 'emby',
        name: 'Emby',
        category: 'Media Server',
        description: 'Media server with live TV support',
        icon: MonitorPlay,
        logo: '/icons/emby.svg',
        difficulty: 'Easy',
        time: '15-30 min',
        guideComponent: 'EmbyGuide'
    },
    {
        id: 'sonarr',
        name: 'Sonarr',
        category: 'Automation',
        description: 'Automated TV series management',
        icon: Layers,
        logo: '/icons/sonarr.svg',
        difficulty: 'Medium',
        time: '15-30 min',
        guideComponent: 'SonarrGuide'
    },
    {
        id: 'radarr',
        name: 'Radarr',
        category: 'Automation',
        description: 'Automated movie management',
        icon: Layers,
        logo: '/icons/radarr.svg',
        difficulty: 'Medium',
        time: '15-30 min',
        guideComponent: 'RadarrGuide'
    },
    {
        id: 'prowlarr',
        name: 'Prowlarr',
        category: 'Automation',
        description: 'Indexer management for *Arr apps',
        icon: Layers,
        logo: '/icons/prowlarr.svg',
        difficulty: 'Easy',
        time: '10-15 min',
        guideComponent: 'ProwlarrGuide'
    },
    {
        id: 'bazarr',
        name: 'Bazarr',
        category: 'Automation',
        description: 'Subtitle management for Sonarr/Radarr',
        icon: Layers,
        logo: '/icons/bazarr.svg',
        difficulty: 'Easy',
        time: '10-15 min',
        guideComponent: 'BazarrGuide'
    },
    {
        id: 'lidarr',
        name: 'Lidarr',
        category: 'Automation',
        description: 'Music collection manager',
        icon: Music,
        logo: '/icons/lidarr.svg',
        difficulty: 'Medium',
        time: '15-30 min',
        guideComponent: ''
    },
    {
        id: 'readarr',
        name: 'Readarr',
        category: 'Automation',
        description: 'Book & audiobook manager',
        icon: BookOpen,
        logo: '/icons/readarr.svg',
        difficulty: 'Medium',
        time: '15-30 min',
        guideComponent: ''
    },
    {
        id: 'tdarr',
        name: 'Tdarr',
        category: 'Automation',
        description: 'Distributed transcoding to save space',
        icon: Cpu,
        logo: '/icons/tdarr.png',
        difficulty: 'Advanced',
        time: '15-30 min',
        guideComponent: 'TdarrGuide'
    },
    {
        id: 'qbittorrent',
        name: 'qBittorrent',
        category: 'Download',
        description: 'Torrent client for downloads',
        icon: Download,
        logo: '/icons/qbittorrent.svg',
        difficulty: 'Easy',
        time: '5-10 min',
        guideComponent: 'QBittorrentGuide'
    },
    {
        id: 'sabnzbd',
        name: 'SABnzbd',
        category: 'Download',
        description: 'Usenet downloader',
        icon: Inbox,
        logo: '/icons/sabnzbd.svg',
        difficulty: 'Easy',
        time: '5-10 min',
        guideComponent: ''
    },
    {
        id: 'gluetun',
        name: 'Gluetun VPN',
        category: 'Download',
        description: 'Secure VPN tunnel for privacy',
        icon: Shield,
        logo: '/icons/gluetun.svg',
        difficulty: 'Advanced',
        time: 'Via .env',
        guideComponent: 'GluetunGuide'
    },
    {
        id: 'overseerr',
        name: 'Overseerr',
        category: 'Request',
        description: 'Media request management',
        icon: Search,
        logo: '/icons/overseerr.svg',
        difficulty: 'Medium',
        time: '20-40 min',
        guideComponent: 'OverseerrGuide'
    },
    {
        id: 'ombi',
        name: 'Ombi',
        category: 'Request',
        description: 'User media requests',
        icon: ListVideo,
        logo: '/icons/ombi.svg',
        difficulty: 'Easy',
        time: '10-20 min',
        guideComponent: ''
    },
    {
        id: 'petio',
        name: 'Petio',
        category: 'Request',
        description: 'Request manager with recommendations',
        icon: Clapperboard,
        logo: '/icons/petio.png',
        difficulty: 'Medium',
        time: '15-20 min',
        guideComponent: ''
    },
    {
        id: 'tautulli',
        name: 'Tautulli',
        category: 'Monitoring',
        description: 'Plex usage statistics',
        icon: Activity,
        logo: '/icons/tautulli.svg',
        difficulty: 'Medium',
        time: '20-30 min',
        guideComponent: 'TautulliGuide'
    },
    {
        id: 'notifiarr',
        name: 'Notifiarr',
        category: 'Monitoring',
        description: 'Unified notifications',
        icon: Bell,
        logo: '/icons/notifiarr.svg',
        difficulty: 'Medium',
        time: '10-15 min',
        guideComponent: 'NotifiarrGuide'
    },
    {
        id: 'mealie',
        name: 'Mealie',
        category: 'Utility',
        description: 'Recipe manager & meal planner',
        icon: UtensilsCrossed,
        logo: '/icons/mealie.svg',
        difficulty: 'Medium',
        time: '20-30 min',
        guideComponent: 'MealieGuide'
    },
    {
        id: 'kavita',
        name: 'Kavita',
        category: 'Utility',
        description: 'Comics, manga & ebook reader',
        icon: Book,
        logo: '/icons/kavita.svg',
        difficulty: 'Easy',
        time: '10-15 min',
        guideComponent: ''
    },
    {
        id: 'audiobookshelf',
        name: 'Audiobookshelf',
        category: 'Utility',
        description: 'Audiobook & podcast server',
        icon: Radio,
        logo: '/icons/audiobookshelf.svg',
        difficulty: 'Medium',
        time: '15-30 min',
        guideComponent: 'AudiobookshelfGuide'
    },
    {
        id: 'photoprism',
        name: 'PhotoPrism',
        category: 'Utility',
        description: 'AI-powered photo manager',
        icon: Image,
        logo: '/icons/photoprism.svg',
        difficulty: 'Advanced',
        time: '30-45 min',
        guideComponent: 'PhotoPrismGuide'
    },
    {
        id: 'filebrowser',
        name: 'File Browser',
        category: 'Utility',
        description: 'Web-based file management',
        icon: HardDrive,
        logo: '/icons/filebrowser.svg',
        difficulty: 'Easy',
        time: '5 min',
        guideComponent: ''
    },
    {
        id: 'homepage',
        name: 'Homepage',
        category: 'Dashboard',
        description: 'Modern dashboard for all your services',
        icon: Home,
        logo: '',
        difficulty: 'Easy',
        time: '10-20 min',
        guideComponent: 'HomepageGuide'
    },
    {
        id: 'authelia',
        name: 'Authelia',
        category: 'Security',
        description: 'Single Sign-On and 2FA protection',
        icon: Shield,
        logo: '',
        difficulty: 'Advanced',
        time: 'Via .env',
        guideComponent: 'AutheliaGuide'
    },
    {
        id: 'redis',
        name: 'Redis',
        category: 'Infrastructure',
        description: 'Session store keeping Authelia logins persistent',
        icon: Database,
        logo: '',
        difficulty: 'Easy',
        time: '5-10 min',
        guideComponent: 'RedisGuide'
    },
    {
        id: 'portainer',
        name: 'Portainer',
        category: 'System',
        description: 'Manage your Docker containers visually',
        icon: Container,
        logo: '',
        difficulty: 'Easy',
        time: '5 min',
        guideComponent: 'PortainerGuide'
    },
    {
        id: 'dozzle',
        name: 'Dozzle',
        category: 'Monitoring',
        description: 'Live log viewer for every container',
        icon: Terminal,
        logo: '',
        difficulty: 'Easy',
        time: '5 min',
        guideComponent: 'DozzleGuide'
    },
    {
        id: 'watchtower',
        name: 'Watchtower',
        category: 'Maintenance',
        description: 'Nightly automated updates',
        icon: RefreshCw,
        logo: '',
        difficulty: 'Easy',
        time: '5 min',
        guideComponent: 'WatchtowerGuide'
    },
    {
        id: 'flaresolverr',
        name: 'FlareSolverr',
        category: 'Automation',
        description: 'Solves Cloudflare challenges',
        icon: Bug,
        logo: '',
        difficulty: 'Medium',
        time: '10 min',
        guideComponent: 'FlareSolverrGuide'
    },
    {
        id: 'cloudflared',
        name: 'Cloudflared',
        category: 'Networking',
        description: 'Zero-trust tunnel',
        icon: Cloud,
        logo: '',
        difficulty: 'Medium',
        time: '20-30 min',
        guideComponent: 'CloudflaredGuide'
    },
]
