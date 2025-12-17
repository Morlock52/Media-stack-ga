/**
 * Docker Compose Generator for Media Stack Maker
 * ----------------------------------------------
 *
 * This module takes a list of logical "profiles" from the setup wizard
 * (plex, arr, torrent, vpn, stats, etc) and expands them into concrete
 * docker-compose services for the final YAML.
 *
 * The goal is:
 * - Keep the generator logic simple.
 * - Centralize accurate, well-documented settings for each app.
 * - Make it clear to non-experts what each env/volume/port does.
 */

/**
 * Definition for a single docker-compose service.
 * This matches the structure under services: in docker-compose.yml
 */
interface DockerComposeService {
    // Docker image (always from a trusted source like linuxserver.io)
    image: string

    // Human-friendly container name, shows up in `docker ps`
    container_name: string

    // Restart policy; "unless-stopped" is good for home servers
    restart: string

    // Environment variables in KEY=value format
    environment?: string[]

    // Volume mounts in HOST:CONTAINER format
    volumes?: string[]

    // Port mappings in HOST:CONTAINER format
    ports?: string[]

    // Compose profiles this service belongs to
    profiles: string[]

    // Networks this container should join
    networks: string[]

    // Optional: dependencies (start order)
    depends_on?: string[]

    // Optional: extra capabilities (e.g. NET_ADMIN for VPN)
    cap_add?: string[]

    // Optional: route through another container's network stack (e.g. service:gluetun)
    network_mode?: string

    // Optional: device passthrough (e.g. /dev/net/tun for VPN)
    devices?: string[]
}

/**
 * Canonical service definitions for each container we know how to generate.
 *
 * IMPORTANT: These are intentionally opinionated but safe defaults.
 * They reflect typical, documented ports/paths as of late 2025.
 */
const serviceDefinitions: Record<string, DockerComposeService> = {
    // PLEX - premium media server, account + claim token required
    plex: {
        image: 'lscr.io/linuxserver/plex:latest',
        container_name: 'plex',
        restart: 'unless-stopped',
        environment: [
            // PUID / PGID: map to a non-root user on the host so Plex can
            // read/write your media and config safely.
            'PUID=${PUID}',
            'PGID=${PGID}',
            // TIMEZONE: affects logs, schedules, etc.
            'TZ=${TIMEZONE}',
            // Use Docker-friendly update channel.
            'VERSION=docker',
            // One-time token to claim this server to your Plex account.
            // You can leave it empty after first run.
            'PLEX_CLAIM=${PLEX_CLAIM}',
        ],
        volumes: [
            // Plex config DB + metadata cache lives here.
            '${CONFIG_ROOT}/plex:/config',
            // Movies and TV folders; keep paths consistent with *Arr apps.
            '${MOVIES_PATH}:/movies',
            '${TV_SHOWS_PATH}:/tv',
            // Transcode scratch space (optional but recommended for performance)
            '${TRANSCODE_PATH}:/transcode',
        ],
        // 32400 is Plex's main web UI + streaming port.
        ports: ['32400:32400'],
        profiles: ['plex'],
        networks: ['mediastack'],
    },

    // JELLYFIN - FOSS alternative to Plex, no account needed
    jellyfin: {
        image: 'lscr.io/linuxserver/jellyfin:latest',
        container_name: 'jellyfin',
        restart: 'unless-stopped',
        environment: [
            'PUID=${PUID}',
            'PGID=${PGID}',
            'TZ=${TIMEZONE}',
        ],
        volumes: [
            '${CONFIG_ROOT}/jellyfin:/config',
            // Jellyfin likes /data by default
            '${MOVIES_PATH}:/data/movies',
            '${TV_SHOWS_PATH}:/data/tvshows',
            '${TRANSCODE_PATH}:/cache',
        ],
        // 8096 is HTTP web UI. HTTPS (8920) is optional.
        ports: ['8096:8096'],
        profiles: ['jellyfin'],
        networks: ['mediastack'],
    },

    // SONARR - TV show automation (*Arr family)
    sonarr: {
        image: 'lscr.io/linuxserver/sonarr:latest',
        container_name: 'sonarr',
        restart: 'unless-stopped',
        environment: [
            'PUID=${PUID}',
            'PGID=${PGID}',
            'TZ=${TIMEZONE}',
        ],
        volumes: [
            '${CONFIG_ROOT}/sonarr:/config',
            // Sonarr sees your TV library at /tv
            '${TV_SHOWS_PATH}:/tv',
            // Downloads must match what qBittorrent/SABnzbd use
            '${DOWNLOADS_PATH}:/downloads',
        ],
        // UI + API
        ports: ['8989:8989'],
        profiles: ['arr'],
        networks: ['mediastack'],
    },

    // RADARR - Movies automation (*Arr family)
    radarr: {
        image: 'lscr.io/linuxserver/radarr:latest',
        container_name: 'radarr',
        restart: 'unless-stopped',
        environment: [
            'PUID=${PUID}',
            'PGID=${PGID}',
            'TZ=${TIMEZONE}',
        ],
        volumes: [
            '${CONFIG_ROOT}/radarr:/config',
            // Movies root
            '${MOVIES_PATH}:/movies',
            // Completed downloads
            '${DOWNLOADS_PATH}:/downloads',
        ],
        ports: ['7878:7878'],
        profiles: ['arr'],
        networks: ['mediastack'],
    },

    // PROWLARR - Indexer manager (*Arr companion)
    prowlarr: {
        image: 'lscr.io/linuxserver/prowlarr:latest',
        container_name: 'prowlarr',
        restart: 'unless-stopped',
        environment: [
            'PUID=${PUID}',
            'PGID=${PGID}',
            'TZ=${TIMEZONE}',
        ],
        volumes: [
            // Config only – no media paths needed.
            '${CONFIG_ROOT}/prowlarr:/config',
        ],
        ports: ['9696:9696'],
        profiles: ['arr'],
        networks: ['mediastack'],
    },

    // QBITTORRENT - torrent download client
    qbittorrent: {
        image: 'lscr.io/linuxserver/qbittorrent:latest',
        container_name: 'qbittorrent',
        restart: 'unless-stopped',
        environment: [
            'PUID=${PUID}',
            'PGID=${PGID}',
            'TZ=${TIMEZONE}',
            // Web UI port inside the container
            'WEBUI_PORT=8080',
        ],
        volumes: [
            '${CONFIG_ROOT}/qbittorrent:/config',
            // All downloads land here; *Arr apps see the same path.
            '${DOWNLOADS_PATH}:/downloads',
        ],
        ports: [
            '8080:8080', // Web UI
            '6881:6881',
            '6881:6881/udp', // Torrent ports
        ],
        profiles: ['torrent'],
        networks: ['mediastack'],
    },

    // GLUETUN - VPN container for all download traffic
    gluetun: {
        image: 'qmcgaw/gluetun:latest',
        container_name: 'gluetun',
        restart: 'unless-stopped',
        // Needs NET_ADMIN to manage network stack.
        cap_add: ['NET_ADMIN'],
        devices: ['/dev/net/tun:/dev/net/tun'],
        environment: [
            'VPN_SERVICE_PROVIDER=custom',
            'VPN_TYPE=wireguard',
            'WIREGUARD_PRIVATE_KEY=${WIREGUARD_PRIVATE_KEY}',
            'WIREGUARD_ADDRESSES=${WIREGUARD_ADDRESSES}',
            'TZ=${TIMEZONE}',
        ],
        volumes: ['${CONFIG_ROOT}/gluetun:/gluetun'],
        ports: [
            '8888:8888/tcp', // HTTP proxy
            '8388:8388/tcp', // Shadowsocks
            '8388:8388/udp', // Shadowsocks
            // qBittorrent ports (when qbittorrent uses network_mode: service:gluetun)
            '8080:8080',
            '6881:6881',
            '6881:6881/udp',
        ],
        profiles: ['vpn'],
        networks: ['mediastack'],
    },

    // TAUTULLI - Plex stats/monitoring
    tautulli: {
        image: 'lscr.io/linuxserver/tautulli:latest',
        container_name: 'tautulli',
        restart: 'unless-stopped',
        environment: [
            'PUID=${PUID}',
            'PGID=${PGID}',
            'TZ=${TIMEZONE}',
        ],
        volumes: ['${CONFIG_ROOT}/tautulli:/config'],
        ports: ['8181:8181'],
        profiles: ['stats'],
        networks: ['mediastack'],
    },

    // TDARR - distributed transcoding/optimizer
    tdarr: {
        image: 'ghcr.io/haveagitgat/tdarr:latest',
        container_name: 'tdarr',
        restart: 'unless-stopped',
        environment: [
            'PUID=${PUID}',
            'PGID=${PGID}',
            'TZ=${TIMEZONE}',
            'serverIP=0.0.0.0',
            'serverPort=8266',
        ],
        volumes: [
            '${CONFIG_ROOT}/tdarr/server:/app/server',
            '${CONFIG_ROOT}/tdarr/configs:/app/configs',
            '${MOVIES_PATH}:/media/movies',
            '${TV_SHOWS_PATH}:/media/tv',
            '${TRANSCODE_PATH}:/temp',
        ],
        ports: ['8265:8265', '8266:8266'],
        profiles: ['transcode'],
        networks: ['mediastack'],
    },

    // NOTIFIARR - unified notifications for all your services
    notifiarr: {
        image: 'golift/notifiarr:latest',
        container_name: 'notifiarr',
        restart: 'unless-stopped',
        environment: [
            'TZ=${TIMEZONE}',
            // API key comes from https://notifiarr.com
            'DN_API_KEY=${NOTIFIARR_API_KEY}',
        ],
        volumes: ['${CONFIG_ROOT}/notifiarr:/config'],
        profiles: ['notify'],
        networks: ['mediastack'],
    },

    // MEALIE - Recipe manager
    mealie: {
        image: 'ghcr.io/mealie-recipes/mealie:latest',
        container_name: 'mealie',
        restart: 'unless-stopped',
        environment: [
            'PUID=${PUID}',
            'PGID=${PGID}',
            'TZ=${TIMEZONE}',
        ],
        volumes: ['${CONFIG_ROOT}/mealie:/app/data'],
        ports: ['9000:9000'],
        profiles: ['mealie'],
        networks: ['mediastack'],
    },

    // KAVITA - Comics/books server
    kavita: {
        image: 'lscr.io/linuxserver/kavita:latest',
        container_name: 'kavita',
        restart: 'unless-stopped',
        environment: [
            'PUID=${PUID}',
            'PGID=${PGID}',
            'TZ=${TIMEZONE}',
        ],
        volumes: [
            '${CONFIG_ROOT}/kavita:/config',
            '${BOOKS_PATH}:/books',
        ],
        ports: ['5000:5000'],
        profiles: ['kavita'],
        networks: ['mediastack'],
    },

    // AUDIOBOOKSHELF
    audiobookshelf: {
        image: 'lscr.io/linuxserver/audiobookshelf:latest',
        container_name: 'audiobookshelf',
        restart: 'unless-stopped',
        environment: [
            'PUID=${PUID}',
            'PGID=${PGID}',
            'TZ=${TIMEZONE}',
        ],
        volumes: [
            '${CONFIG_ROOT}/audiobookshelf:/config',
            '${AUDIOBOOKS_PATH}:/audiobooks',
            '${AUDIOBOOKS_PATH}:/podcasts',
        ],
        ports: ['13378:13378'],
        profiles: ['audiobookshelf'],
        networks: ['mediastack'],
    },

    // PHOTOPRISM
    photoprism: {
        image: 'lscr.io/linuxserver/photoprism:latest',
        container_name: 'photoprism',
        restart: 'unless-stopped',
        environment: [
            'PUID=${PUID}',
            'PGID=${PGID}',
            'TZ=${TIMEZONE}',
            'PHOTOPRISM_ADMIN_PASSWORD=${PHOTOPRISM_ADMIN_PASSWORD}',
        ],
        volumes: [
            '${CONFIG_ROOT}/photoprism:/config',
            '${PHOTOS_PATH}:/photos',
        ],
        ports: ['2342:2342'],
        profiles: ['photoprism'],
        networks: ['mediastack'],
    },
}

/**
 * Map high-level wizard profile IDs to actual container keys above.
 * Example: selecting the "arr" profile pulls in Sonarr, Radarr, Prowlarr.
 */
const serviceProfileMap: Record<string, string[]> = {
    plex: ['plex'],
    jellyfin: ['jellyfin'],
    // arr = core automation trio (TV + Movies + indexers)
    arr: ['sonarr', 'radarr', 'prowlarr'],
    // torrent = qBittorrent behind optional VPN
    torrent: ['qbittorrent'],
    vpn: ['gluetun'],
    stats: ['tautulli'],
    transcode: ['tdarr'],
    notify: ['notifiarr'],
    mealie: ['mealie'],
    kavita: ['kavita'],
    audiobookshelf: ['audiobookshelf'],
    photoprism: ['photoprism'],
}

/**
 * Main entry: generate a YAML string for docker-compose.yml
 * based on selected logical profiles from the wizard.
 */
export function generateDockerCompose(selectedProfiles: string[]): string {
    // 1) Expand profiles (arr, torrent, etc.) into concrete services
    const serviceNames = new Set<string>()
    selectedProfiles.forEach((profile) => {
        const services = serviceProfileMap[profile] || []
        services.forEach((svc) => serviceNames.add(svc))
    })

    // 2) Build services: block for docker-compose
    const services: Record<string, any> = {}
    const hasGluetun = serviceNames.has('gluetun')
    serviceNames.forEach((serviceName) => {
        const def = serviceDefinitions[serviceName]
        if (def) {
            const service: Record<string, any> = {
                image: def.image,
                container_name: def.container_name,
                restart: def.restart,
                ...(def.environment && { environment: def.environment }),
                ...(def.volumes && { volumes: def.volumes }),
                ...(def.ports && { ports: def.ports }),
                ...(def.cap_add && { cap_add: (def as any).cap_add }),
                ...(def.depends_on && { depends_on: def.depends_on }),
                ...(def.devices && { devices: def.devices }),
            }

            // If VPN is selected, route qBittorrent through Gluetun (prevents IP leaks).
            if (serviceName === 'qbittorrent' && hasGluetun) {
                delete service.ports
                delete service.networks
                service.network_mode = 'service:gluetun'
                service.depends_on = ['gluetun']
            } else {
                service.networks = def.networks
            }

            services[serviceName] = service
        }
    })

    // 3) Wrap in top-level compose structure (version + network)
    const compose = {
        version: '3.8',
        networks: {
            mediastack: {
                name: '${DOCKER_NETWORK}',
                driver: 'bridge',
            },
        },
        services,
    }

    // 4) Convert JS object to a simple YAML-like text
    return generateYAML(compose)
}

/**
 * Very small YAML serializer – just enough for our docker-compose output.
 * It uses 2-space indentation and handles nested objects + arrays.
 */
function generateYAML(obj: any, indent = 0): string {
    const spaces = '  '.repeat(indent)
    let yaml = ''

    for (const [key, value] of Object.entries(obj)) {
        if (value === null || value === undefined) continue

        if (Array.isArray(value)) {
            yaml += `${spaces}${key}: \n`
            value.forEach((item) => {
                if (typeof item === 'object') {
                    yaml += generateYAML(item, indent + 1)
                } else {
                    yaml += `${spaces}  - ${item} \n`
                }
            })
        } else if (typeof value === 'object') {
            yaml += `${spaces}${key}: \n`
            yaml += generateYAML(value, indent + 1)
        } else {
            yaml += `${spaces}${key}: ${value} \n`
        }
    }

    return yaml
}
