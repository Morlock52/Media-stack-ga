import * as Icons from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
const {
    Film,
    Tv,
    Activity,
    Search,
    Download,
    Shield,
    Home,
    Container,
    FileVideo,
    Bell,
    Languages,
    ShieldCheck,
    Layers,
    Utensils,
    BookOpen,
    Camera,
    Cloud,
    Terminal,
    Bug,
    Database,
    RefreshCw,
} = Icons

export const ICON_MAP: Record<string, LucideIcon> = {
    Film, Tv, Activity, Search, Download, Shield, Home, Container,
    FileVideo, Bell, Languages, ShieldCheck, Layers, Utensils,
    BookOpen, Camera, Cloud, Terminal, Bug, Database, RefreshCw
}

export type AppId =
    | 'plex'
    | 'jellyfin'
    | 'emby'
    | 'audiobookshelf'
    | 'photoprism'
    | 'mealie'
    | 'arr'
    | 'overseerr'
    | 'tautulli'
    | 'sonarr'
    | 'radarr'
    | 'prowlarr'
    | 'bazarr'
    | 'qbittorrent'
    | 'gluetun'
    | 'homepage'
    | 'authelia'
    | 'portainer'
    | 'tdarr'
    | 'notifiarr'
    | 'cloudflared'
    | 'dozzle'
    | 'flaresolverr'
    | 'redis'
    | 'watchtower'

export interface AppInfo {
    id: AppId
    name: string
    category: string
    description: string
    icon: LucideIcon
    difficulty: 'Easy' | 'Medium' | 'Advanced'
    time: string
}

export const appCards: AppInfo[] = [
    {
        id: 'plex',
        name: 'Plex',
        category: 'Media Server',
        description: 'Premium media server with apps on almost every device.',
        icon: Film,
        difficulty: 'Easy',
        time: '15-30 min',
    },
    {
        id: 'jellyfin',
        name: 'Jellyfin',
        category: 'Media Server',
        description: 'Fully open-source media server with no paid tier.',
        icon: Tv,
        difficulty: 'Easy',
        time: '15-30 min',
    },
    {
        id: 'emby',
        name: 'Emby',
        category: 'Media Server',
        description: 'Bring-your-own-UI media server, great for power users.',
        icon: Tv,
        difficulty: 'Easy',
        time: '15-30 min',
    },
    {
        id: 'audiobookshelf',
        name: 'Audiobookshelf',
        category: 'Media',
        description: 'Stream audiobooks and podcasts with chapter sync.',
        icon: BookOpen,
        difficulty: 'Medium',
        time: '15-30 min',
    },
    {
        id: 'photoprism',
        name: 'PhotoPrism',
        category: 'Media',
        description: 'Private photo library with AI search and sharing.',
        icon: Camera,
        difficulty: 'Advanced',
        time: '30-45 min',
    },
    {
        id: 'mealie',
        name: 'Mealie',
        category: 'Recipes',
        description: 'Meal planning and recipe manager to round out the stack.',
        icon: Utensils,
        difficulty: 'Medium',
        time: '20-30 min',
    },
    {
        id: 'arr',
        name: '*Arr Stack',
        category: 'Automation',
        description: 'Bundled guide for Sonarr, Radarr, Prowlarr, and Bazarr.',
        icon: Layers,
        difficulty: 'Medium',
        time: '45-60 min',
    },
    {
        id: 'sonarr',
        name: 'Sonarr',
        category: 'Automation',
        description: 'Automated TV show downloader and manager.',
        icon: Tv,
        difficulty: 'Medium',
        time: '15-30 min',
    },
    {
        id: 'radarr',
        name: 'Radarr',
        category: 'Automation',
        description: 'Automated movie downloader and manager.',
        icon: Film,
        difficulty: 'Medium',
        time: '15-30 min',
    },
    {
        id: 'prowlarr',
        name: 'Prowlarr',
        category: 'Automation',
        description: 'Indexer manager for all your *Arr apps.',
        icon: Search,
        difficulty: 'Easy',
        time: '10-15 min',
    },
    {
        id: 'bazarr',
        name: 'Bazarr',
        category: 'Automation',
        description: 'Subtitle downloader for movies and TV.',
        icon: Languages,
        difficulty: 'Easy',
        time: '10-15 min',
    },
    {
        id: 'flaresolverr',
        name: 'FlareSolverr',
        category: 'Automation',
        description: 'Solves Cloudflare challenges for picky indexers.',
        icon: Bug,
        difficulty: 'Medium',
        time: '10 min',
    },
    {
        id: 'qbittorrent',
        name: 'qBittorrent',
        category: 'Download',
        description: 'Torrent client protected by VPN.',
        icon: Download,
        difficulty: 'Easy',
        time: '5-10 min',
    },
    {
        id: 'gluetun',
        name: 'Gluetun',
        category: 'Network',
        description: 'VPN client and kill switch for secure downloads.',
        icon: ShieldCheck,
        difficulty: 'Advanced',
        time: 'Via .env',
    },
    {
        id: 'cloudflared',
        name: 'Cloudflared',
        category: 'Networking',
        description: 'Zero-trust tunnel that exposes your stack without ports.',
        icon: Cloud,
        difficulty: 'Medium',
        time: '20-30 min',
    },
    {
        id: 'homepage',
        name: 'Homepage',
        category: 'Dashboard',
        description: 'Modern dashboard for all your services.',
        icon: Home,
        difficulty: 'Easy',
        time: '10-20 min',
    },
    {
        id: 'authelia',
        name: 'Authelia',
        category: 'Security',
        description: 'Single Sign-On and 2FA protection.',
        icon: Shield,
        difficulty: 'Advanced',
        time: 'Via .env',
    },
    {
        id: 'redis',
        name: 'Redis',
        category: 'Infrastructure',
        description: 'Session store keeping Authelia logins persistent.',
        icon: Database,
        difficulty: 'Easy',
        time: '5-10 min',
    },
    {
        id: 'portainer',
        name: 'Portainer',
        category: 'System',
        description: 'Manage your Docker containers visually.',
        icon: Container,
        difficulty: 'Easy',
        time: '5 min',
    },
    {
        id: 'tdarr',
        name: 'Tdarr',
        category: 'Optimization',
        description: 'Distributed transcoding to save space.',
        icon: FileVideo,
        difficulty: 'Advanced',
        time: '15-30 min',
    },
    {
        id: 'notifiarr',
        name: 'Notifiarr',
        category: 'Monitoring',
        description: 'Rich notifications for Discord.',
        icon: Bell,
        difficulty: 'Medium',
        time: '10-15 min',
    },
    {
        id: 'dozzle',
        name: 'Dozzle',
        category: 'Monitoring',
        description: 'Live log viewer for every container in the stack.',
        icon: Terminal,
        difficulty: 'Easy',
        time: '5 min',
    },
    {
        id: 'watchtower',
        name: 'Watchtower',
        category: 'Maintenance',
        description: 'Nightly automated updates for all Docker images.',
        icon: RefreshCw,
        difficulty: 'Easy',
        time: '5 min',
    },
    {
        id: 'overseerr',
        name: 'Overseerr',
        category: 'Requests',
        description: 'Friendly request portal for Plex/Jellyfin users.',
        icon: Search,
        difficulty: 'Medium',
        time: '20-40 min',
    },
    {
        id: 'tautulli',
        name: 'Tautulli',
        category: 'Monitoring',
        description: 'Track Plex usage and get detailed stats and graphs.',
        icon: Activity,
        difficulty: 'Medium',
        time: '20-30 min',
    },
]
