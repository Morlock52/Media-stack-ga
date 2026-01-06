import { createDefaultStoragePlan, DEFAULT_DATA_ROOT } from '../data/storagePlan'
import type { SetupConfig } from '../store/setupStore'
import { getVPNProviderById, commonGluetunEnvVars } from '../data/vpnProviders'
import type { VPNProvider, VPNEnvironmentVariable } from '../data/vpnProviders'

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

/**
 * Generate Gluetun VPN environment variables based on provider and configuration
 * Returns a formatted string with all necessary VPN environment variables
 */
function generateVpnEnvVars(config: SetupConfig): string {
    // If no VPN provider selected, return empty string
    if (!config.selectedVpnProvider) {
        return ''
    }

    const provider = getVPNProviderById(config.selectedVpnProvider)
    if (!provider) {
        return ''
    }

    const protocol = config.vpnProtocol || 'wireguard'
    const credentials = config.vpnCredentials || {}
    const lines: string[] = []

    // Header comment
    lines.push('# =============================================================================')
    lines.push(`# GLUETUN VPN CONFIGURATION - ${provider.name}`)
    lines.push('# =============================================================================')
    lines.push(`# Provider: ${provider.name}`)
    lines.push(`# Protocol: ${protocol.toUpperCase()}`)
    lines.push(`# Documentation: ${provider.setupInstructionsUrl}`)
    lines.push('')

    // Core provider and protocol settings
    lines.push('# Core VPN Settings')
    lines.push(`VPN_SERVICE_PROVIDER=${provider.gluetunProvider}`)
    lines.push(`VPN_TYPE=${protocol}`)
    lines.push('')

    // Generate environment variables based on provider requirements
    // Filter variables based on selected protocol
    const getProtocolSpecificVars = (vars: VPNEnvironmentVariable[]) => {
        return vars.filter(v => {
            const key = v.key.toLowerCase()
            // Filter WireGuard-specific vars if using OpenVPN
            if (protocol === 'openvpn' && key.includes('wireguard')) {
                return false
            }
            // Filter OpenVPN-specific vars if using WireGuard
            if (protocol === 'wireguard' && key.includes('openvpn')) {
                return false
            }
            // Skip VPN_SERVICE_PROVIDER and VPN_TYPE as they're already set
            if (key === 'vpn_service_provider' || key === 'vpn_type') {
                return false
            }
            return true
        })
    }

    const requiredVars = getProtocolSpecificVars(provider.requiredEnvVars)
    const optionalVars = getProtocolSpecificVars(provider.optionalEnvVars)

    // Required credentials/configuration
    if (requiredVars.length > 0) {
        lines.push('# Required Configuration')
        requiredVars.forEach(envVar => {
            const value = credentials[envVar.key] || ''
            lines.push(`${envVar.key}=${value}`)
        })
        lines.push('')
    }

    // Optional configuration (server selection, etc.)
    const optionalWithValues = optionalVars.filter(v => {
        // Include if user has provided a value
        if (credentials[v.key]) {
            return true
        }
        // Include port forwarding vars if enabled
        if (v.key.includes('PORT_FORWARDING') && config.portForwardingEnabled) {
            return true
        }
        return false
    })

    if (optionalWithValues.length > 0) {
        lines.push('# Optional Configuration')
        optionalWithValues.forEach(envVar => {
            const value = credentials[envVar.key] || envVar.defaultValue || ''
            if (envVar.key === 'VPN_PORT_FORWARDING' && config.portForwardingEnabled) {
                lines.push(`# Port forwarding enabled - ${provider.portForwarding.notes || 'see provider documentation'}`)
                lines.push(`${envVar.key}=${value || 'on'}`)
            } else {
                lines.push(`${envVar.key}=${value}`)
            }
        })
        lines.push('')
    }

    // Port forwarding section (if supported and enabled)
    if (provider.portForwarding.supported && config.portForwardingEnabled) {
        if (!optionalWithValues.some(v => v.key === 'VPN_PORT_FORWARDING')) {
            lines.push('# Port Forwarding')
            lines.push(`# ${provider.portForwarding.notes || 'Automatic port forwarding'}`)
            if (provider.portForwarding.setupUrl) {
                lines.push(`# Setup: ${provider.portForwarding.setupUrl}`)
            }
            lines.push('VPN_PORT_FORWARDING=on')
            lines.push('')
        }
    }

    // Kill switch / Firewall configuration
    lines.push('# Kill Switch / Firewall Configuration')
    lines.push('# Blocks all traffic if VPN disconnects (recommended for privacy)')
    const killSwitchValue = config.killSwitchEnabled !== false ? 'on' : 'off'
    lines.push(`FIREWALL=${killSwitchValue}`)
    lines.push('')

    // Allow local network access if kill switch is enabled
    if (config.killSwitchEnabled !== false) {
        lines.push('# Allow local network access (adjust to your subnet)')
        const localSubnet = credentials['FIREWALL_OUTBOUND_SUBNETS'] || ''
        lines.push(`FIREWALL_OUTBOUND_SUBNETS=${localSubnet}`)
        lines.push('')
    }

    // Common Gluetun settings (DNS, logging, health checks)
    lines.push('# DNS and Privacy Settings')
    lines.push('# Use encrypted DNS-over-TLS for additional privacy')
    const dotValue = credentials['DOT'] || 'on'
    lines.push(`DOT=${dotValue}`)

    const dnsAddress = credentials['DNS_ADDRESS'] || ''
    if (dnsAddress) {
        lines.push(`DNS_ADDRESS=${dnsAddress}`)
    }
    lines.push('')

    lines.push('# Health Check and Logging')
    const healthCheck = credentials['HEALTH_VPN_DURATION_INITIAL'] || '6s'
    lines.push(`HEALTH_VPN_DURATION_INITIAL=${healthCheck}`)

    const logLevel = credentials['LOG_LEVEL'] || 'info'
    lines.push(`LOG_LEVEL=${logLevel}`)
    lines.push('')

    // Timezone
    lines.push('# Timezone (uses system timezone from main config)')
    lines.push(`TZ=${config.timezone}`)
    lines.push('')

    return lines.join('\n')
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

    // Generate VPN configuration based on selected provider and settings
    // Returns empty string if no VPN provider is configured
    const vpnSection = generateVpnEnvVars(config)

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
