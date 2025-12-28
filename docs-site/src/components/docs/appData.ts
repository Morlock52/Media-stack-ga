import type { LucideIcon } from 'lucide-react'
import {
    Activity,
    BarChart3,
    Bell,
    Book,
    BookOpen,
    Bug,
    Camera,
    Cloud,
    Container,
    Database,
    Download,
    FileText,
    FileVideo,
    Film,
    FolderOpen,
    HardDrive,
    Home,
    Inbox,
    Languages,
    Layers,
    ListVideo,
    Music,
    Radio,
    RefreshCw,
    Search,
    Shield,
    ShieldCheck,
    Terminal,
    Tv,
    Utensils,
} from 'lucide-react'

export const ICON_MAP: Record<string, LucideIcon> = {
    Film, Tv, Activity, Search, Download, Shield, Home, Container,
    FileVideo, Bell, Languages, ShieldCheck, Layers, Utensils,
    BookOpen, Camera, Cloud, Terminal, Bug, Database, RefreshCw,
    BarChart3, FileText, Music, Book, Radio, Inbox, ListVideo,
    FolderOpen, HardDrive
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
    | 'post-deploy'
    | 'grafana'
    | 'loki'
    | 'promtail'
    | 'lidarr'
    | 'readarr'
    | 'sabnzbd'
    | 'ombi'
    | 'petio'
    | 'kavita'
    | 'filebrowser'

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
        id: 'post-deploy',
        name: 'Post‑Deploy Checks',
        category: 'Maintenance',
        description: 'One‑shot script to verify VPN, Auth, and Tunnel after updates.',
        icon: ShieldCheck,
        difficulty: 'Easy',
        time: '2–3 min',
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
    {
        id: 'grafana',
        name: 'Grafana',
        category: 'Monitoring',
        description: 'Beautiful dashboards for logs, metrics, and alerts.',
        icon: BarChart3,
        difficulty: 'Medium',
        time: '15-30 min',
    },
    {
        id: 'loki',
        name: 'Loki',
        category: 'Monitoring',
        description: 'Log aggregation system designed for Grafana.',
        icon: FileText,
        difficulty: 'Easy',
        time: '10 min',
    },
    {
        id: 'promtail',
        name: 'Promtail',
        category: 'Monitoring',
        description: 'Ships container logs to Loki for centralized viewing.',
        icon: FileText,
        difficulty: 'Easy',
        time: '5 min',
    },
    {
        id: 'lidarr',
        name: 'Lidarr',
        category: 'Automation',
        description: 'Music collection manager in the *Arr family.',
        icon: Music,
        difficulty: 'Medium',
        time: '20-30 min',
    },
    {
        id: 'readarr',
        name: 'Readarr',
        category: 'Automation',
        description: 'Book and audiobook manager in the *Arr family.',
        icon: Book,
        difficulty: 'Medium',
        time: '20-30 min',
    },
    {
        id: 'sabnzbd',
        name: 'SABnzbd',
        category: 'Download',
        description: 'Usenet downloader for NZB files.',
        icon: Inbox,
        difficulty: 'Medium',
        time: '15-20 min',
    },
    {
        id: 'ombi',
        name: 'Ombi',
        category: 'Requests',
        description: 'Media request system with user management.',
        icon: ListVideo,
        difficulty: 'Medium',
        time: '20-30 min',
    },
    {
        id: 'petio',
        name: 'Petio',
        category: 'Requests',
        description: 'Request portal with personalized recommendations.',
        icon: Search,
        difficulty: 'Medium',
        time: '20-30 min',
    },
    {
        id: 'kavita',
        name: 'Kavita',
        category: 'Media',
        description: 'Comics, manga, and ebook reading server.',
        icon: Book,
        difficulty: 'Easy',
        time: '15-20 min',
    },
    {
        id: 'filebrowser',
        name: 'File Browser',
        category: 'Utility',
        description: 'Web-based file manager for your media folders.',
        icon: FolderOpen,
        difficulty: 'Easy',
        time: '5-10 min',
    },
]
