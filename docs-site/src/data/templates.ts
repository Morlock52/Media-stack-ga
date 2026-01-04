export interface Template {
    id: string
    name: string
    description: string
    detailedDescription: string
    icon: string
    difficulty: 'beginner' | 'intermediate' | 'advanced'
    services: string[]
    highlights: string[]
    config?: {
        puid?: string
        pgid?: string
        deploymentMode?: 'local' | 'cloud'
    }
}

// Map service IDs to human-readable names and descriptions
export const serviceInfo: Record<string, { name: string; description: string }> = {
    plex: { name: 'Plex', description: 'Premium media server with polished apps for every device' },
    jellyfin: { name: 'Jellyfin', description: 'Free, open-source media server with no account required' },
    emby: { name: 'Emby', description: 'Media server with live TV and DVR support' },
    arr: { name: '*Arr Stack', description: 'Sonarr + Radarr + Prowlarr for automated media management' },
    sonarr: { name: 'Sonarr', description: 'Automated TV series downloading and management' },
    radarr: { name: 'Radarr', description: 'Automated movie downloading and management' },
    prowlarr: { name: 'Prowlarr', description: 'Indexer manager that syncs with all *Arr apps' },
    bazarr: { name: 'Bazarr', description: 'Automatic subtitle downloading for movies and TV' },
    lidarr: { name: 'Lidarr', description: 'Music collection manager and downloader' },
    readarr: { name: 'Readarr', description: 'Book and audiobook manager' },
    torrent: { name: 'qBittorrent', description: 'Torrent client with web UI for downloading' },
    usenet: { name: 'SABnzbd', description: 'Usenet downloader for fast, secure downloads' },
    vpn: { name: 'Gluetun VPN', description: 'VPN container to protect your download traffic' },
    transcode: { name: 'Tdarr', description: 'Distributed transcoding to optimize your library' },
    stats: { name: 'Tautulli', description: 'Detailed statistics and monitoring for Plex' },
    notify: { name: 'Notifiarr', description: 'Unified notifications for all your services' },
    overseerr: { name: 'Overseerr', description: 'Beautiful request management for users' },
    ombi: { name: 'Ombi', description: 'Request management with newsletter features' },
    petio: { name: 'Petio', description: 'Request manager with smart recommendations' },
    mealie: { name: 'Mealie', description: 'Recipe manager and meal planner' },
    kavita: { name: 'Kavita', description: 'Comics, manga, and ebook reader' },
    audiobookshelf: { name: 'Audiobookshelf', description: 'Audiobook and podcast server' },
    photoprism: { name: 'PhotoPrism', description: 'AI-powered photo management' },
    filebrowser: { name: 'File Browser', description: 'Web-based file management' }
}

export const templates: Template[] = [
    {
        id: 'local-install',
        name: 'Local Install',
        description: 'Simple local-only setup with Traefik - no Cloudflare or auth',
        detailedDescription: 'Perfect for home networks where you only need local access. Uses Traefik as a simple reverse proxy without Cloudflare tunnels or Authelia authentication. Access your services via *.local domains (e.g., plex.local, sonarr.local). Just set a password and deploy!',
        icon: '🏠',
        difficulty: 'beginner',
        services: ['plex', 'arr', 'torrent', 'notify'],
        highlights: [
            'Access via *.local domains (plex.local, sonarr.local)',
            'No Cloudflare or external services needed',
            'Simple Traefik reverse proxy included',
            'Notifiarr for Discord notifications',
            'One-click deploy ready'
        ],
        config: {
            puid: '1000',
            pgid: '1000',
            deploymentMode: 'local'
        }
    },
    {
        id: 'plex-enthusiast',
        name: 'Plex Enthusiast',
        description: 'Complete Plex setup with automation, downloads, and monitoring',
        detailedDescription: 'The perfect starting point for Plex users who want a fully automated media library. This template includes everything you need: Plex as your media server, the *Arr stack for automatic downloading, a torrent client behind a VPN for privacy, and Tautulli for monitoring who is watching what. Great for families or anyone sharing their library.',
        icon: '🎬',
        difficulty: 'beginner',
        services: ['plex', 'arr', 'torrent', 'vpn', 'notify', 'stats'],
        highlights: [
            'Fully automated TV & movie downloads',
            'VPN protection for all downloads',
            'Real-time usage statistics',
            'Push notifications for new content'
        ],
        config: {
            puid: '1000',
            pgid: '1000',
            deploymentMode: 'cloud'
        }
    },
    {
        id: 'foss-stack',
        name: 'FOSS Stack',
        description: 'Free and open-source media server with Jellyfin',
        detailedDescription: 'A completely free and open-source media stack. Jellyfin requires no account and has no premium tiers—all features are free. Combined with the *Arr automation suite and VPN-protected downloads, this gives you a powerful media setup without any subscription costs.',
        icon: '🆓',
        difficulty: 'beginner',
        services: ['jellyfin', 'arr', 'torrent', 'vpn', 'notify'],
        highlights: [
            '100% free, no subscriptions needed',
            'No account required for Jellyfin',
            'Full automation with *Arr stack',
            'Notifiarr notifications included'
        ],
        config: {
            puid: '1000',
            pgid: '1000',
            deploymentMode: 'cloud'
        }
    },
    {
        id: 'power-user',
        name: 'Power User',
        description: 'Everything enabled - for advanced users who want it all',
        detailedDescription: 'The ultimate media stack with every feature enabled. Run both Plex and Jellyfin side-by-side, get full automation with the *Arr suite, distributed transcoding with Tdarr to optimize your library, comprehensive monitoring, and push notifications. This is for users who want maximum control and features.',
        icon: '⚡',
        difficulty: 'advanced',
        services: ['plex', 'jellyfin', 'arr', 'torrent', 'vpn', 'transcode', 'notify', 'stats'],
        highlights: [
            'Dual media servers (Plex + Jellyfin)',
            'Hardware-accelerated transcoding',
            'Complete automation suite',
            'Advanced monitoring & notifications'
        ],
        config: {
            puid: '1000',
            pgid: '1000',
            deploymentMode: 'cloud'
        }
    },
    {
        id: 'minimal',
        name: 'Minimal Setup',
        description: 'Just the basics - media server with notifications',
        detailedDescription: 'A simple, lightweight setup for users who just want to stream their existing media collection. Perfect if you already have media files and just need a way to access them from any device. Includes Notifiarr for Discord notifications about playback and server status.',
        icon: '🔹',
        difficulty: 'beginner',
        services: ['plex', 'notify'],
        highlights: [
            'Simple two-service setup',
            'Stream existing media library',
            'Discord notifications via Notifiarr',
            'Easy to maintain'
        ],
        config: {
            puid: '1000',
            pgid: '1000',
            deploymentMode: 'local'
        }
    },
    {
        id: 'streaming-beast',
        name: 'Streaming Beast',
        description: 'Optimized for transcoding and multiple streams',
        detailedDescription: 'Built for households with multiple simultaneous viewers or users who need to stream to devices that require transcoding. Includes Tdarr for pre-transcoding your library to optimal formats, reducing real-time CPU load. Perfect for sharing with family members on various devices.',
        icon: '🚀',
        difficulty: 'intermediate',
        services: ['plex', 'transcode', 'arr', 'stats', 'notify'],
        highlights: [
            'Pre-transcode library for smooth playback',
            'Handle multiple simultaneous streams',
            'Monitor performance with Tautulli',
            'Notifiarr notifications included'
        ],
        config: {
            puid: '1000',
            pgid: '1000',
            deploymentMode: 'cloud'
        }
    },
    {
        id: 'privacy-focused',
        name: 'Privacy Focused',
        description: 'VPN-first setup with secure downloads',
        detailedDescription: 'Security and privacy are the priority with this stack. All download traffic is routed through a VPN container, and Jellyfin requires no external account or telemetry. Your ISP and anyone else watching your network will only see encrypted VPN traffic.',
        icon: '🔒',
        difficulty: 'intermediate',
        services: ['jellyfin', 'torrent', 'vpn', 'arr', 'notify'],
        highlights: [
            'All downloads through VPN tunnel',
            'No external accounts required',
            'Notifiarr for download alerts',
            'ISP cannot see your activity'
        ],
        config: {
            puid: '1000',
            pgid: '1000',
            deploymentMode: 'local'
        }
    },
    {
        id: 'jellyfin-complete',
        name: 'Jellyfin Complete',
        description: 'Full-featured Jellyfin setup with transcoding and automation',
        detailedDescription: 'The complete Jellyfin experience with all the bells and whistles. Unlike the basic FOSS stack, this template adds hardware-accelerated transcoding via Tdarr for optimal playback on any device, plus Usenet downloads for faster, more reliable media acquisition. Perfect for Jellyfin enthusiasts who want maximum features without paying for Plex Pass.',
        icon: '🎥',
        difficulty: 'intermediate',
        services: ['jellyfin', 'arr', 'torrent', 'usenet', 'vpn', 'transcode', 'notify'],
        highlights: [
            'Hardware-accelerated transcoding with Tdarr',
            'Dual download sources (torrent + Usenet)',
            'No subscriptions or premium tiers needed',
            'VPN protection for all downloads',
            'Full *Arr automation suite'
        ],
        config: {
            puid: '1000',
            pgid: '1000',
            deploymentMode: 'cloud'
        }
    }
]

export function getTemplateById(id: string): Template | undefined {
    return templates.find(t => t.id === id)
}
