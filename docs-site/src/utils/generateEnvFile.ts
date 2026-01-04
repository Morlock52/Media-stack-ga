import { createDefaultStoragePlan, DEFAULT_DATA_ROOT } from '../data/storagePlan'
import type { SetupConfig } from '../store/setupStore'

/**
 * Generate a cryptographically secure random string for secrets
 * Uses Web Crypto API for secure random generation
 */
function generateSecureSecret(length: number = 32): string {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
    const array = new Uint8Array(length)
    crypto.getRandomValues(array)
    return Array.from(array, (byte) => chars[byte % chars.length]).join('')
}

export function generateEnvFile(config: SetupConfig, selectedServices: string[]): string {
    const profiles = Array.from(new Set(selectedServices)).join(',')
    const storagePlan = config.storagePlan || createDefaultStoragePlan(DEFAULT_DATA_ROOT)
    const planRoot = storagePlan.dataRoot?.path || DEFAULT_DATA_ROOT
    const storageDefaults = createDefaultStoragePlan(planRoot)
    const isLocal = config.deploymentMode === 'local'
    const masterPassword = config.password || generateSecureSecret(24)

    const resolvePath = (key: string, fallback: string) =>
        storagePlan[key]?.path || storageDefaults[key]?.path || fallback

    const dataRoot = resolvePath('dataRoot', DEFAULT_DATA_ROOT)
    const configRoot = resolvePath('configRoot', `${dataRoot}/config`)
    const moviesPath = resolvePath('movies', `${dataRoot}/media/movies`)
    const tvPath = resolvePath('tv', `${dataRoot}/media/tv`)
    const musicPath = resolvePath('music', `${dataRoot}/media/music`)
    const booksPath = resolvePath('books', `${dataRoot}/media/books`)
    const audiobooksPath = resolvePath('audiobooks', `${dataRoot}/media/audiobooks`)
    const photosPath = resolvePath('photos', `${dataRoot}/media/photos`)
    const transcodePath = resolvePath('transcode', `${dataRoot}/transcode`)
    const downloadsPath = resolvePath('downloads', `${dataRoot}/downloads`)

    let serviceVars = ''
    Object.entries(config.serviceConfigs).forEach(([service, vars]) => {
        if (selectedServices.includes(service)) {
            serviceVars += `\n# ${service.toUpperCase()} CONFIGURATION\n`
            Object.entries(vars).forEach(([key, value]) => {
                serviceVars += `${key}=${value}\n`
            })
        }
    })

    const deploymentSection = isLocal
        ? `# =============================================================================
# DEPLOYMENT MODE: LOCAL (DIRECT PORTS)
# =============================================================================
# Use with: docker compose -f docker-compose.local.yml up -d
#
# Set DOMAIN to your server IP/hostname so Homepage links work from other devices.
# Example: DOMAIN=192.168.1.100
DEPLOYMENT_MODE=local

# Grafana host port (defaults to 3003 to avoid clashing with the wizard UI on 3002)
GRAFANA_PORT=3003
`
        : `# =============================================================================
# DEPLOYMENT MODE: CLOUD / REMOTE (CLOUDFLARE + AUTHELIA)
# =============================================================================
DEPLOYMENT_MODE=cloud

# Cloudflare Tunnel token (get from Zero Trust dashboard)
# Generate at: https://one.dash.cloudflare.com → Networks → Tunnels → Create
CLOUDFLARE_TUNNEL_TOKEN=${config.cloudflareToken || ''}

# Authelia Secrets (auto-generated secure random strings)
AUTHELIA_IDENTITY_VALIDATION_RESET_PASSWORD_JWT_SECRET=${generateSecureSecret(64)}
AUTHELIA_SESSION_SECRET=${generateSecureSecret(64)}
AUTHELIA_STORAGE_ENCRYPTION_KEY=${generateSecureSecret(64)}
`

    const databaseSection = isLocal
        ? ''
        : `# =============================================================================
# DATABASE CREDENTIALS
# =============================================================================
# PostgreSQL (required for *Arr apps)
POSTGRES_USER=mediastack
POSTGRES_PASSWORD=${generateSecureSecret(32)}
`

    const serviceSecretsSection = `# =============================================================================
# SERVICE CREDENTIALS & SECRETS
# =============================================================================
REDIS_PASSWORD=${masterPassword}
PHOTOPRISM_ADMIN_PASSWORD=${masterPassword}
GRAFANA_USER=admin
GRAFANA_PASSWORD=${masterPassword}

# API Keys (auto-populated after service initialization via bootstrap)
PLEX_TOKEN=
JELLYFIN_API_KEY=
SONARR_API_KEY=
RADARR_API_KEY=
PROWLARR_API_KEY=
BAZARR_API_KEY=
OVERSEERR_API_KEY=
TAUTULLI_API_KEY=
PORTAINER_TOKEN=

# Homepage widgets
QBITTORRENT_WIDGET_USERNAME=
QBITTORRENT_WIDGET_PASSWORD=

# Notifiarr - Unified Notifications (https://notifiarr.com)
NOTIFIARR_API_KEY=

# Plex Claim Token (https://www.plex.tv/claim)
PLEX_CLAIM=${config.plexClaim || ''}
`

    const vpnSection = isLocal
        ? ''
        : `# =============================================================================
# GLUETUN VPN (WIREGUARD)
# =============================================================================
WIREGUARD_PRIVATE_KEY=${config.wireguardPrivateKey || ''}
WIREGUARD_ADDRESSES=${config.wireguardAddresses || ''}
WIREGUARD_PRESHARED_KEY=
WIREGUARD_PUBLIC_KEY=
WIREGUARD_ENDPOINT_IP=
WIREGUARD_ENDPOINT_PORT=
`

    return `# .env configuration for mediastack
# Generated by Interactive Setup Wizard
# Deployment Mode: ${isLocal ? 'LOCAL (direct ports)' : 'CLOUD (Cloudflare + Authelia)'}

# =============================================================================
# GENERAL SETTINGS
# =============================================================================
TIMEZONE=${config.timezone}
PUID=${config.puid}
PGID=${config.pgid}
DOMAIN=${config.domain}
DOCKER_NETWORK=mediastack
COMPOSE_PROFILES=${profiles}

# =============================================================================
# STORAGE & PATHS
# =============================================================================
DATA_ROOT=${dataRoot}
CONFIG_ROOT=${configRoot}
MOVIES_PATH=${moviesPath}
TV_SHOWS_PATH=${tvPath}
MUSIC_PATH=${musicPath}
BOOKS_PATH=${booksPath}
AUDIOBOOKS_PATH=${audiobooksPath}
PHOTOS_PATH=${photosPath}
TRANSCODE_PATH=${transcodePath}
DOWNLOADS_PATH=${downloadsPath}

${deploymentSection}
${databaseSection}
${serviceSecretsSection}
${vpnSection}
# =============================================================================
# SERVICE SPECIFIC CONFIGURATION
# =============================================================================
${serviceVars}
`
}
