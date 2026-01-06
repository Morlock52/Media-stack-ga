import { Shield, Lock, Globe, Key } from 'lucide-react'

// Supported VPN protocols
export type VPNProtocol = 'wireguard' | 'openvpn'

// Environment variable definition for Gluetun configuration
export interface VPNEnvironmentVariable {
    key: string
    label: string
    description: string
    required: boolean
    placeholder?: string
    type?: 'text' | 'password' | 'select' | 'number' | 'boolean'
    options?: Array<{ value: string; label: string }>
    defaultValue?: string
}

// Port forwarding configuration details
export interface PortForwardingInfo {
    supported: boolean
    automatic?: boolean // Gluetun can handle automatically
    notes?: string
    setupUrl?: string
}

// Authentication method details
export interface AuthMethod {
    type: 'username-password' | 'service-credentials' | 'api-token' | 'wireguard-config' | 'certificate'
    description: string
    credentialUrl?: string // Where users get credentials
}

// VPN Provider definition
export interface VPNProvider {
    id: string
    name: string
    description: string
    icon: any
    logo?: string // URL or path to logo image

    // Protocol support
    protocols: VPNProtocol[]
    recommendedProtocol: VPNProtocol

    // Authentication
    authMethod: AuthMethod

    // Gluetun provider name (used in VPN_SERVICE_PROVIDER env var)
    gluetunProvider: string

    // Environment variables for Gluetun configuration
    requiredEnvVars: VPNEnvironmentVariable[]
    optionalEnvVars: VPNEnvironmentVariable[]

    // Port forwarding support
    portForwarding: PortForwardingInfo

    // Documentation and support
    setupInstructionsUrl: string
    troubleshootingTips: string[]

    // UI hints
    difficulty: 'easy' | 'moderate' | 'advanced'
    popular?: boolean // Show as recommended/popular
    lastUpdated: string // ISO date string
}

// ---------------------------------------------------------------------------
// VPN PROVIDER CONFIGURATIONS
// ---------------------------------------------------------------------------
// Based on Gluetun VPN client documentation and provider-specific requirements
// See: https://github.com/qdm12/gluetun-wiki

export const vpnProviders: VPNProvider[] = [
    // ===== MULLVAD =====
    {
        id: 'mullvad',
        name: 'Mullvad',
        description: 'Privacy-focused VPN with port forwarding support',
        icon: Shield,
        gluetunProvider: 'mullvad',
        protocols: ['wireguard', 'openvpn'],
        recommendedProtocol: 'wireguard',
        authMethod: {
            type: 'service-credentials',
            description: 'Mullvad account number (16 digits)',
            credentialUrl: 'https://mullvad.net/en/account/',
        },
        requiredEnvVars: [
            {
                key: 'VPN_SERVICE_PROVIDER',
                label: 'VPN Provider',
                description: 'Must be set to "mullvad"',
                required: true,
                type: 'text',
            },
            {
                key: 'VPN_TYPE',
                label: 'VPN Protocol',
                description: 'WireGuard recommended for better performance',
                required: true,
                type: 'select',
                options: [
                    { value: 'wireguard', label: 'WireGuard (recommended)' },
                    { value: 'openvpn', label: 'OpenVPN' },
                ],
            },
            {
                key: 'WIREGUARD_PRIVATE_KEY',
                label: 'WireGuard Private Key',
                description: 'Generate in Mullvad account > WireGuard configuration',
                required: true,
                type: 'password',
                placeholder: 'Your WireGuard private key',
            },
            {
                key: 'WIREGUARD_ADDRESSES',
                label: 'WireGuard Addresses',
                description: 'IPv4/IPv6 addresses from Mullvad config',
                required: true,
                placeholder: '10.x.x.x/32,fc00:x:x:x::x/128',
            },
        ],
        optionalEnvVars: [
            {
                key: 'SERVER_CITIES',
                label: 'Server Cities',
                description: 'Comma-separated list (e.g., "New York,London")',
                required: false,
                placeholder: 'Leave empty for automatic selection',
            },
            {
                key: 'SERVER_COUNTRIES',
                label: 'Server Countries',
                description: 'ISO country codes (e.g., "US,GB,SE")',
                required: false,
                placeholder: 'Leave empty for automatic selection',
            },
            {
                key: 'VPN_PORT_FORWARDING',
                label: 'Port Forwarding',
                description: 'Enable port forwarding (on/off)',
                required: false,
                type: 'select',
                options: [
                    { value: 'on', label: 'Enabled' },
                    { value: 'off', label: 'Disabled' },
                ],
            },
            {
                key: 'VPN_PORT_FORWARDING_PROVIDER',
                label: 'Port Forwarding Provider',
                description: 'Port forwarding implementation (usually "port_forwarding")',
                required: false,
                placeholder: 'port_forwarding',
            },
        ],
        portForwarding: {
            supported: true,
            automatic: true,
            notes: 'Mullvad assigns a static port per account. Get your port from the Mullvad website.',
            setupUrl: 'https://mullvad.net/en/account/#/ports',
        },
        setupInstructionsUrl: 'https://github.com/qdm12/gluetun-wiki/blob/main/setup/providers/mullvad.md',
        troubleshootingTips: [
            'Generate WireGuard keys at mullvad.net/en/account/#/wireguard-config',
            'Port forwarding: Assign a port at mullvad.net/en/account/#/ports before enabling',
            'If connection fails, verify your account has active subscription (accepts cash and crypto)',
            'Mullvad rotates servers frequently - country/city selection may need updates',
            'WireGuard addresses include both IPv4 and IPv6 - copy the full string from account page',
            'No username/password - only WireGuard private key authentication',
            'Connection timeout: Try different server location or verify firewall rules',
        ],
        difficulty: 'easy',
        popular: true,
        lastUpdated: '2026-01-05',
    },

    // ===== PROTONVPN =====
    {
        id: 'protonvpn',
        name: 'ProtonVPN',
        description: 'Secure VPN from the creators of ProtonMail',
        icon: Lock,
        gluetunProvider: 'protonvpn',
        protocols: ['wireguard', 'openvpn'],
        recommendedProtocol: 'wireguard',
        authMethod: {
            type: 'username-password',
            description: 'OpenVPN/IKEv2 username and password (not your ProtonVPN account password)',
            credentialUrl: 'https://account.protonvpn.com/account',
        },
        requiredEnvVars: [
            {
                key: 'VPN_SERVICE_PROVIDER',
                label: 'VPN Provider',
                description: 'Must be set to "protonvpn"',
                required: true,
                type: 'text',
            },
            {
                key: 'VPN_TYPE',
                label: 'VPN Protocol',
                description: 'WireGuard or OpenVPN',
                required: true,
                type: 'select',
                options: [
                    { value: 'wireguard', label: 'WireGuard (recommended)' },
                    { value: 'openvpn', label: 'OpenVPN' },
                ],
            },
            {
                key: 'OPENVPN_USER',
                label: 'OpenVPN Username',
                description: 'From ProtonVPN Account settings (not email)',
                required: true,
                placeholder: 'username+pmp',
            },
            {
                key: 'OPENVPN_PASSWORD',
                label: 'OpenVPN Password',
                description: 'From ProtonVPN Account settings (not login password)',
                required: true,
                type: 'password',
            },
        ],
        optionalEnvVars: [
            {
                key: 'SERVER_COUNTRIES',
                label: 'Server Countries',
                description: 'ISO country codes (e.g., "US,GB")',
                required: false,
                placeholder: 'Leave empty for automatic selection',
            },
            {
                key: 'FREE_ONLY',
                label: 'Free Servers Only',
                description: 'Set to "on" for free tier users',
                required: false,
                type: 'select',
                options: [
                    { value: 'off', label: 'All servers (Plus/Unlimited)' },
                    { value: 'on', label: 'Free servers only' },
                ],
            },
            {
                key: 'VPN_PORT_FORWARDING',
                label: 'Port Forwarding',
                description: 'Enable port forwarding (on/off) - requires Plus/Unlimited plan',
                required: false,
                type: 'select',
                options: [
                    { value: 'on', label: 'Enabled (requires +pmp username suffix)' },
                    { value: 'off', label: 'Disabled' },
                ],
            },
        ],
        portForwarding: {
            supported: true,
            automatic: true,
            notes: 'ProtonVPN port forwarding requires Plus or Unlimited plan and NAT-PMP enabled. Use OpenVPN protocol with +pmp suffix in username.',
            setupUrl: 'https://protonvpn.com/support/port-forwarding-manual-setup/',
        },
        setupInstructionsUrl: 'https://github.com/qdm12/gluetun-wiki/blob/main/setup/providers/protonvpn.md',
        troubleshootingTips: [
            'For port forwarding: Add +pmp to your OpenVPN username (e.g., username+pmp)',
            'Use OpenVPN credentials from Account settings, not your ProtonVPN login password',
            'Port forwarding requires Plus or Unlimited subscription and only works with OpenVPN',
            'If "credentials rejected": regenerate OpenVPN credentials on ProtonVPN website',
            'Free tier: Set FREE_ONLY=on to access free servers only (limited to 3 countries)',
            'WireGuard is faster but does NOT support port forwarding - use OpenVPN for P2P',
            'NetShield and Split Tunneling are not available when using Gluetun',
            'Connection issues: Verify account is active and not at device limit',
        ],
        difficulty: 'moderate',
        popular: true,
        lastUpdated: '2026-01-05',
    },

    // ===== PRIVATE INTERNET ACCESS (PIA) =====
    {
        id: 'pia',
        name: 'Private Internet Access',
        description: 'Affordable VPN with port forwarding',
        icon: Shield,
        gluetunProvider: 'private internet access',
        protocols: ['wireguard', 'openvpn'],
        recommendedProtocol: 'wireguard',
        authMethod: {
            type: 'username-password',
            description: 'PIA username (p-prefix) and password',
            credentialUrl: 'https://www.privateinternetaccess.com/pages/client-sign-in',
        },
        requiredEnvVars: [
            {
                key: 'VPN_SERVICE_PROVIDER',
                label: 'VPN Provider',
                description: 'Must be set to "private internet access"',
                required: true,
                type: 'text',
            },
            {
                key: 'VPN_TYPE',
                label: 'VPN Protocol',
                description: 'WireGuard recommended',
                required: true,
                type: 'select',
                options: [
                    { value: 'wireguard', label: 'WireGuard (recommended)' },
                    { value: 'openvpn', label: 'OpenVPN' },
                ],
            },
            {
                key: 'OPENVPN_USER',
                label: 'PIA Username',
                description: 'Your PIA username (starts with p)',
                required: true,
                placeholder: 'pxxxxxxxx',
            },
            {
                key: 'OPENVPN_PASSWORD',
                label: 'PIA Password',
                description: 'Your PIA account password',
                required: true,
                type: 'password',
            },
        ],
        optionalEnvVars: [
            {
                key: 'SERVER_REGIONS',
                label: 'Server Regions',
                description: 'Comma-separated regions (e.g., "US East,UK London")',
                required: false,
                placeholder: 'Leave empty for automatic selection',
            },
            {
                key: 'VPN_PORT_FORWARDING',
                label: 'Port Forwarding',
                description: 'Enable automatic port forwarding (on/off)',
                required: false,
                type: 'select',
                options: [
                    { value: 'on', label: 'Enabled (automatic)' },
                    { value: 'off', label: 'Disabled' },
                ],
            },
        ],
        portForwarding: {
            supported: true,
            automatic: true,
            notes: 'PIA supports automatic port forwarding with Gluetun. The port is dynamically assigned.',
        },
        setupInstructionsUrl: 'https://github.com/qdm12/gluetun-wiki/blob/main/setup/providers/private-internet-access.md',
        troubleshootingTips: [
            'Port forwarding is fully automatic - Gluetun will request and configure the port dynamically',
            'Use your PIA account credentials (username starts with "p")',
            'If connection fails, verify active subscription and credentials',
            'Some regions may have better performance than others - try different SERVER_REGIONS',
            'Port forwarding works with both WireGuard and OpenVPN protocols',
            'PIA rotates port assignments periodically for security',
            'Check Gluetun logs for assigned port number after connection',
            'If auth fails: Ensure you\'re using account credentials, not email address',
        ],
        difficulty: 'easy',
        popular: true,
        lastUpdated: '2026-01-05',
    },

    // ===== NORDVPN =====
    {
        id: 'nordvpn',
        name: 'NordVPN',
        description: 'Popular VPN with large server network',
        icon: Globe,
        gluetunProvider: 'nordvpn',
        protocols: ['wireguard', 'openvpn'],
        recommendedProtocol: 'wireguard',
        authMethod: {
            type: 'api-token',
            description: 'Service credentials (token) from NordVPN dashboard',
            credentialUrl: 'https://my.nordaccount.com/dashboard/nordvpn/',
        },
        requiredEnvVars: [
            {
                key: 'VPN_SERVICE_PROVIDER',
                label: 'VPN Provider',
                description: 'Must be set to "nordvpn"',
                required: true,
                type: 'text',
            },
            {
                key: 'VPN_TYPE',
                label: 'VPN Protocol',
                description: 'WireGuard recommended',
                required: true,
                type: 'select',
                options: [
                    { value: 'wireguard', label: 'WireGuard (recommended)' },
                    { value: 'openvpn', label: 'OpenVPN' },
                ],
            },
            {
                key: 'OPENVPN_USER',
                label: 'Service Credentials Token',
                description: 'Generate at my.nordaccount.com under Services > NordVPN',
                required: true,
                type: 'password',
                placeholder: 'Your service credentials token',
            },
            {
                key: 'OPENVPN_PASSWORD',
                label: 'Service Credentials (repeated)',
                description: 'Same token as username',
                required: true,
                type: 'password',
            },
        ],
        optionalEnvVars: [
            {
                key: 'SERVER_COUNTRIES',
                label: 'Server Countries',
                description: 'ISO country codes (e.g., "US,GB")',
                required: false,
                placeholder: 'Leave empty for automatic selection',
            },
            {
                key: 'SERVER_REGIONS',
                label: 'Server Regions',
                description: 'Specific regions within countries',
                required: false,
            },
        ],
        portForwarding: {
            supported: false,
            notes: 'NordVPN does not support port forwarding on any plan.',
        },
        setupInstructionsUrl: 'https://github.com/qdm12/gluetun-wiki/blob/main/setup/providers/nordvpn.md',
        troubleshootingTips: [
            'Generate service credentials at my.nordaccount.com under Services > NordVPN (not your login password)',
            'Use the same token for both username and password fields',
            'NordVPN does not support port forwarding - consider Mullvad, PIA, or ProtonVPN if needed for P2P',
            'If connection fails, regenerate service credentials and try again',
            'Service credentials are different from your account password - never use account password',
            'Obfuscated servers and Double VPN features not available via Gluetun',
            'Check NordVPN server status page if connections fail repeatedly',
            'WireGuard (NordLynx) recommended for better speeds than OpenVPN',
        ],
        difficulty: 'moderate',
        popular: true,
        lastUpdated: '2026-01-05',
    },

    // ===== EXPRESSVPN =====
    {
        id: 'expressvpn',
        name: 'ExpressVPN',
        description: 'Premium VPN with fast speeds',
        icon: Globe,
        gluetunProvider: 'expressvpn',
        protocols: ['openvpn'],
        recommendedProtocol: 'openvpn',
        authMethod: {
            type: 'service-credentials',
            description: 'Activation code from ExpressVPN website',
            credentialUrl: 'https://www.expressvpn.com/setup',
        },
        requiredEnvVars: [
            {
                key: 'VPN_SERVICE_PROVIDER',
                label: 'VPN Provider',
                description: 'Must be set to "expressvpn"',
                required: true,
                type: 'text',
            },
            {
                key: 'VPN_TYPE',
                label: 'VPN Protocol',
                description: 'OpenVPN only',
                required: true,
                type: 'select',
                options: [{ value: 'openvpn', label: 'OpenVPN' }],
            },
            {
                key: 'OPENVPN_USER',
                label: 'Activation Code',
                description: 'From expressvpn.com/setup',
                required: true,
                type: 'password',
                placeholder: 'Your activation code',
            },
        ],
        optionalEnvVars: [
            {
                key: 'SERVER_COUNTRIES',
                label: 'Server Countries',
                description: 'Country selection',
                required: false,
            },
        ],
        portForwarding: {
            supported: false,
            notes: 'ExpressVPN does not support port forwarding.',
        },
        setupInstructionsUrl: 'https://github.com/qdm12/gluetun-wiki/blob/main/setup/providers/expressvpn.md',
        troubleshootingTips: [
            'Get activation code from expressvpn.com/setup (not your login password)',
            'Only OpenVPN protocol is supported with Gluetun',
            'No port forwarding support - consider alternatives if needed for torrenting',
            'If activation fails, generate a new code on the ExpressVPN website',
        ],
        difficulty: 'moderate',
        popular: true,
        lastUpdated: '2026-01-05',
    },

    // ===== SURFSHARK =====
    {
        id: 'surfshark',
        name: 'Surfshark',
        description: 'Budget-friendly VPN with unlimited devices',
        icon: Shield,
        gluetunProvider: 'surfshark',
        protocols: ['wireguard', 'openvpn'],
        recommendedProtocol: 'wireguard',
        authMethod: {
            type: 'username-password',
            description: 'Service credentials from Surfshark manual setup',
            credentialUrl: 'https://my.surfshark.com/vpn/manual-setup/main',
        },
        requiredEnvVars: [
            {
                key: 'VPN_SERVICE_PROVIDER',
                label: 'VPN Provider',
                description: 'Must be set to "surfshark"',
                required: true,
                type: 'text',
            },
            {
                key: 'VPN_TYPE',
                label: 'VPN Protocol',
                description: 'WireGuard or OpenVPN',
                required: true,
                type: 'select',
                options: [
                    { value: 'wireguard', label: 'WireGuard (recommended)' },
                    { value: 'openvpn', label: 'OpenVPN' },
                ],
            },
            {
                key: 'OPENVPN_USER',
                label: 'Service Username',
                description: 'From Surfshark manual setup page',
                required: true,
            },
            {
                key: 'OPENVPN_PASSWORD',
                label: 'Service Password',
                description: 'From Surfshark manual setup page',
                required: true,
                type: 'password',
            },
        ],
        optionalEnvVars: [
            {
                key: 'SERVER_COUNTRIES',
                label: 'Server Countries',
                description: 'ISO country codes',
                required: false,
            },
        ],
        portForwarding: {
            supported: false,
            notes: 'Surfshark does not support port forwarding.',
        },
        setupInstructionsUrl: 'https://github.com/qdm12/gluetun-wiki/blob/main/setup/providers/surfshark.md',
        troubleshootingTips: [
            'Get service credentials from my.surfshark.com/vpn/manual-setup/main',
            'Use service credentials, not your Surfshark account login',
            'No port forwarding available - consider Mullvad/PIA for torrenting',
            'WireGuard provides better performance than OpenVPN',
        ],
        difficulty: 'easy',
        popular: false,
        lastUpdated: '2026-01-05',
    },

    // ===== WINDSCRIBE =====
    {
        id: 'windscribe',
        name: 'Windscribe',
        description: 'VPN with generous free tier',
        icon: Globe,
        gluetunProvider: 'windscribe',
        protocols: ['wireguard', 'openvpn'],
        recommendedProtocol: 'wireguard',
        authMethod: {
            type: 'username-password',
            description: 'Windscribe username and password',
            credentialUrl: 'https://windscribe.com/myaccount',
        },
        requiredEnvVars: [
            {
                key: 'VPN_SERVICE_PROVIDER',
                label: 'VPN Provider',
                description: 'Must be set to "windscribe"',
                required: true,
                type: 'text',
            },
            {
                key: 'VPN_TYPE',
                label: 'VPN Protocol',
                description: 'WireGuard or OpenVPN',
                required: true,
                type: 'select',
                options: [
                    { value: 'wireguard', label: 'WireGuard (recommended)' },
                    { value: 'openvpn', label: 'OpenVPN' },
                ],
            },
            {
                key: 'OPENVPN_USER',
                label: 'Windscribe Username',
                description: 'Your Windscribe account username',
                required: true,
            },
            {
                key: 'OPENVPN_PASSWORD',
                label: 'Windscribe Password',
                description: 'Your Windscribe account password',
                required: true,
                type: 'password',
            },
        ],
        optionalEnvVars: [
            {
                key: 'SERVER_COUNTRIES',
                label: 'Server Countries',
                description: 'Country selection',
                required: false,
            },
        ],
        portForwarding: {
            supported: false,
            notes: 'Windscribe does not support port forwarding.',
        },
        setupInstructionsUrl: 'https://github.com/qdm12/gluetun-wiki/blob/main/setup/providers/windscribe.md',
        troubleshootingTips: [
            'Use your regular Windscribe account credentials',
            'Free tier has limited server locations and bandwidth',
            'No port forwarding support',
            'If connection fails, check account status and bandwidth limits',
        ],
        difficulty: 'easy',
        popular: false,
        lastUpdated: '2026-01-05',
    },

    // ===== IPVANISH =====
    {
        id: 'ipvanish',
        name: 'IPVanish',
        description: 'US-based VPN with no logs policy',
        icon: Shield,
        gluetunProvider: 'ipvanish',
        protocols: ['openvpn'],
        recommendedProtocol: 'openvpn',
        authMethod: {
            type: 'username-password',
            description: 'IPVanish account credentials',
            credentialUrl: 'https://www.ipvanish.com/account/',
        },
        requiredEnvVars: [
            {
                key: 'VPN_SERVICE_PROVIDER',
                label: 'VPN Provider',
                description: 'Must be set to "ipvanish"',
                required: true,
                type: 'text',
            },
            {
                key: 'VPN_TYPE',
                label: 'VPN Protocol',
                description: 'OpenVPN only',
                required: true,
                type: 'select',
                options: [{ value: 'openvpn', label: 'OpenVPN' }],
            },
            {
                key: 'OPENVPN_USER',
                label: 'IPVanish Username',
                description: 'Your IPVanish account username',
                required: true,
            },
            {
                key: 'OPENVPN_PASSWORD',
                label: 'IPVanish Password',
                description: 'Your IPVanish account password',
                required: true,
                type: 'password',
            },
        ],
        optionalEnvVars: [
            {
                key: 'SERVER_COUNTRIES',
                label: 'Server Countries',
                description: 'Country codes',
                required: false,
            },
        ],
        portForwarding: {
            supported: false,
            notes: 'IPVanish does not support port forwarding.',
        },
        setupInstructionsUrl: 'https://github.com/qdm12/gluetun-wiki/blob/main/setup/providers/ipvanish.md',
        troubleshootingTips: [
            'Use your IPVanish account login credentials',
            'Only OpenVPN is supported (no WireGuard)',
            'No port forwarding available',
            'Large server network - try different regions for better performance',
        ],
        difficulty: 'easy',
        popular: false,
        lastUpdated: '2026-01-05',
    },

    // ===== CYBERGHOST =====
    {
        id: 'cyberghost',
        name: 'CyberGhost',
        description: 'User-friendly VPN with streaming focus',
        icon: Globe,
        gluetunProvider: 'cyberghost',
        protocols: ['openvpn'],
        recommendedProtocol: 'openvpn',
        authMethod: {
            type: 'username-password',
            description: 'CyberGhost account credentials',
            credentialUrl: 'https://my.cyberghostvpn.com/en_US/account',
        },
        requiredEnvVars: [
            {
                key: 'VPN_SERVICE_PROVIDER',
                label: 'VPN Provider',
                description: 'Must be set to "cyberghost"',
                required: true,
                type: 'text',
            },
            {
                key: 'VPN_TYPE',
                label: 'VPN Protocol',
                description: 'OpenVPN only',
                required: true,
                type: 'select',
                options: [{ value: 'openvpn', label: 'OpenVPN' }],
            },
            {
                key: 'OPENVPN_USER',
                label: 'CyberGhost Username',
                description: 'From CyberGhost account settings',
                required: true,
            },
            {
                key: 'OPENVPN_PASSWORD',
                label: 'CyberGhost Password',
                description: 'From CyberGhost account settings',
                required: true,
                type: 'password',
            },
        ],
        optionalEnvVars: [
            {
                key: 'SERVER_COUNTRIES',
                label: 'Server Countries',
                description: 'Country selection',
                required: false,
            },
        ],
        portForwarding: {
            supported: false,
            notes: 'CyberGhost does not support port forwarding.',
        },
        setupInstructionsUrl: 'https://github.com/qdm12/gluetun-wiki/blob/main/setup/providers/cyberghost.md',
        troubleshootingTips: [
            'Use credentials from my.cyberghostvpn.com account page',
            'May require device credentials instead of account password',
            'No port forwarding support',
            'Optimized servers for streaming may not work with Gluetun',
        ],
        difficulty: 'moderate',
        popular: false,
        lastUpdated: '2026-01-05',
    },

    // ===== TORGUARD =====
    {
        id: 'torguard',
        name: 'TorGuard',
        description: 'VPN designed for P2P and torrenting',
        icon: Shield,
        gluetunProvider: 'torguard',
        protocols: ['openvpn'],
        recommendedProtocol: 'openvpn',
        authMethod: {
            type: 'username-password',
            description: 'TorGuard account credentials',
            credentialUrl: 'https://torguard.net/clientarea.php',
        },
        requiredEnvVars: [
            {
                key: 'VPN_SERVICE_PROVIDER',
                label: 'VPN Provider',
                description: 'Must be set to "torguard"',
                required: true,
                type: 'text',
            },
            {
                key: 'VPN_TYPE',
                label: 'VPN Protocol',
                description: 'OpenVPN only',
                required: true,
                type: 'select',
                options: [{ value: 'openvpn', label: 'OpenVPN' }],
            },
            {
                key: 'OPENVPN_USER',
                label: 'TorGuard Username',
                description: 'Your TorGuard account username',
                required: true,
            },
            {
                key: 'OPENVPN_PASSWORD',
                label: 'TorGuard Password',
                description: 'Your TorGuard account password',
                required: true,
                type: 'password',
            },
        ],
        optionalEnvVars: [
            {
                key: 'SERVER_COUNTRIES',
                label: 'Server Countries',
                description: 'Country selection',
                required: false,
            },
        ],
        portForwarding: {
            supported: false,
            notes: 'TorGuard offers port forwarding as an add-on service, but automated setup via Gluetun is not supported.',
        },
        setupInstructionsUrl: 'https://github.com/qdm12/gluetun-wiki/blob/main/setup/providers/torguard.md',
        troubleshootingTips: [
            'Use your TorGuard account credentials',
            'Port forwarding requires manual setup (not automated)',
            'May need to enable OpenVPN access in account settings',
            'TorGuard is optimized for P2P traffic',
        ],
        difficulty: 'moderate',
        popular: false,
        lastUpdated: '2026-01-05',
    },

    // ===== VYPRVPN =====
    {
        id: 'vyprvpn',
        name: 'VyprVPN',
        description: 'VPN with proprietary Chameleon protocol',
        icon: Globe,
        gluetunProvider: 'vyprvpn',
        protocols: ['openvpn'],
        recommendedProtocol: 'openvpn',
        authMethod: {
            type: 'username-password',
            description: 'VyprVPN account credentials',
            credentialUrl: 'https://www.vyprvpn.com/account',
        },
        requiredEnvVars: [
            {
                key: 'VPN_SERVICE_PROVIDER',
                label: 'VPN Provider',
                description: 'Must be set to "vyprvpn"',
                required: true,
                type: 'text',
            },
            {
                key: 'VPN_TYPE',
                label: 'VPN Protocol',
                description: 'OpenVPN only',
                required: true,
                type: 'select',
                options: [{ value: 'openvpn', label: 'OpenVPN' }],
            },
            {
                key: 'OPENVPN_USER',
                label: 'VyprVPN Username',
                description: 'Your VyprVPN account username',
                required: true,
            },
            {
                key: 'OPENVPN_PASSWORD',
                label: 'VyprVPN Password',
                description: 'Your VyprVPN account password',
                required: true,
                type: 'password',
            },
        ],
        optionalEnvVars: [
            {
                key: 'SERVER_REGIONS',
                label: 'Server Regions',
                description: 'Region selection',
                required: false,
            },
        ],
        portForwarding: {
            supported: false,
            notes: 'VyprVPN does not support port forwarding.',
        },
        setupInstructionsUrl: 'https://github.com/qdm12/gluetun-wiki/blob/main/setup/providers/vyprvpn.md',
        troubleshootingTips: [
            'Use your VyprVPN account credentials',
            'No port forwarding available',
            'Chameleon protocol not supported in Gluetun (OpenVPN only)',
            'Owns all its servers (no third-party hosting)',
        ],
        difficulty: 'easy',
        popular: false,
        lastUpdated: '2026-01-05',
    },

    // ===== AIRVPN =====
    {
        id: 'airvpn',
        name: 'AirVPN',
        description: 'Privacy-focused VPN for power users',
        icon: Lock,
        gluetunProvider: 'airvpn',
        protocols: ['wireguard', 'openvpn'],
        recommendedProtocol: 'wireguard',
        authMethod: {
            type: 'api-token',
            description: 'AirVPN API key from client area',
            credentialUrl: 'https://airvpn.org/client/',
        },
        requiredEnvVars: [
            {
                key: 'VPN_SERVICE_PROVIDER',
                label: 'VPN Provider',
                description: 'Must be set to "airvpn"',
                required: true,
                type: 'text',
            },
            {
                key: 'VPN_TYPE',
                label: 'VPN Protocol',
                description: 'WireGuard or OpenVPN',
                required: true,
                type: 'select',
                options: [
                    { value: 'wireguard', label: 'WireGuard (recommended)' },
                    { value: 'openvpn', label: 'OpenVPN' },
                ],
            },
            {
                key: 'OPENVPN_USER',
                label: 'API Key',
                description: 'From AirVPN client area',
                required: true,
                type: 'password',
            },
        ],
        optionalEnvVars: [
            {
                key: 'SERVER_COUNTRIES',
                label: 'Server Countries',
                description: 'Country codes',
                required: false,
            },
            {
                key: 'VPN_PORT_FORWARDING',
                label: 'Port Forwarding',
                description: 'Enable port forwarding (requires manual setup in AirVPN client area)',
                required: false,
                type: 'select',
                options: [
                    { value: 'on', label: 'Enabled' },
                    { value: 'off', label: 'Disabled' },
                ],
            },
        ],
        portForwarding: {
            supported: true,
            automatic: false,
            notes: 'AirVPN supports port forwarding but requires manual configuration in the client area.',
            setupUrl: 'https://airvpn.org/ports/',
        },
        setupInstructionsUrl: 'https://github.com/qdm12/gluetun-wiki/blob/main/setup/providers/airvpn.md',
        troubleshootingTips: [
            'Generate API key at airvpn.org/client/',
            'Port forwarding requires manual setup in AirVPN client area',
            'Strong focus on privacy and technical users',
            'Supports advanced routing and firewall options',
        ],
        difficulty: 'advanced',
        popular: false,
        lastUpdated: '2026-01-05',
    },

    // ===== IVPN =====
    {
        id: 'ivpn',
        name: 'IVPN',
        description: 'Privacy-focused VPN with transparency',
        icon: Lock,
        gluetunProvider: 'ivpn',
        protocols: ['wireguard', 'openvpn'],
        recommendedProtocol: 'wireguard',
        authMethod: {
            type: 'service-credentials',
            description: 'IVPN account ID (starts with i- or ivpn)',
            credentialUrl: 'https://www.ivpn.net/account/login',
        },
        requiredEnvVars: [
            {
                key: 'VPN_SERVICE_PROVIDER',
                label: 'VPN Provider',
                description: 'Must be set to "ivpn"',
                required: true,
                type: 'text',
            },
            {
                key: 'VPN_TYPE',
                label: 'VPN Protocol',
                description: 'WireGuard recommended',
                required: true,
                type: 'select',
                options: [
                    { value: 'wireguard', label: 'WireGuard (recommended)' },
                    { value: 'openvpn', label: 'OpenVPN' },
                ],
            },
            {
                key: 'OPENVPN_USER',
                label: 'Account ID',
                description: 'Your IVPN account ID (i-XXXX-XXXX-XXXX)',
                required: true,
                placeholder: 'i-XXXX-XXXX-XXXX',
            },
        ],
        optionalEnvVars: [
            {
                key: 'SERVER_COUNTRIES',
                label: 'Server Countries',
                description: 'Country selection',
                required: false,
            },
            {
                key: 'VPN_PORT_FORWARDING',
                label: 'Port Forwarding',
                description: 'Enable port forwarding (Pro plan only, requires manual setup)',
                required: false,
                type: 'select',
                options: [
                    { value: 'on', label: 'Enabled' },
                    { value: 'off', label: 'Disabled' },
                ],
            },
        ],
        portForwarding: {
            supported: true,
            automatic: false,
            notes: 'IVPN supports port forwarding on Pro plan. Manual configuration required.',
            setupUrl: 'https://www.ivpn.net/knowledgebase/general/how-do-i-activate-port-forwarding/',
        },
        setupInstructionsUrl: 'https://github.com/qdm12/gluetun-wiki/blob/main/setup/providers/ivpn.md',
        troubleshootingTips: [
            'Use your IVPN account ID (format: i-XXXX-XXXX-XXXX)',
            'Port forwarding requires Pro subscription and manual setup',
            'IVPN focuses on privacy and transparency',
            'Regular security audits published on website',
        ],
        difficulty: 'moderate',
        popular: false,
        lastUpdated: '2026-01-05',
    },

    // ===== WEVPN =====
    {
        id: 'wevpn',
        name: 'WeVPN',
        description: 'Fast VPN with good privacy practices',
        icon: Shield,
        gluetunProvider: 'wevpn',
        protocols: ['wireguard', 'openvpn'],
        recommendedProtocol: 'wireguard',
        authMethod: {
            type: 'username-password',
            description: 'WeVPN account credentials',
            credentialUrl: 'https://www.wevpn.com/account',
        },
        requiredEnvVars: [
            {
                key: 'VPN_SERVICE_PROVIDER',
                label: 'VPN Provider',
                description: 'Must be set to "wevpn"',
                required: true,
                type: 'text',
            },
            {
                key: 'VPN_TYPE',
                label: 'VPN Protocol',
                description: 'WireGuard or OpenVPN',
                required: true,
                type: 'select',
                options: [
                    { value: 'wireguard', label: 'WireGuard (recommended)' },
                    { value: 'openvpn', label: 'OpenVPN' },
                ],
            },
            {
                key: 'OPENVPN_USER',
                label: 'WeVPN Username',
                description: 'Your WeVPN account username',
                required: true,
            },
            {
                key: 'OPENVPN_PASSWORD',
                label: 'WeVPN Password',
                description: 'Your WeVPN account password',
                required: true,
                type: 'password',
            },
        ],
        optionalEnvVars: [
            {
                key: 'SERVER_COUNTRIES',
                label: 'Server Countries',
                description: 'Country selection',
                required: false,
            },
        ],
        portForwarding: {
            supported: false,
            notes: 'WeVPN does not support port forwarding.',
        },
        setupInstructionsUrl: 'https://github.com/qdm12/gluetun-wiki/blob/main/setup/providers/wevpn.md',
        troubleshootingTips: [
            'Use your WeVPN account credentials',
            'No port forwarding available',
            'Good performance with both protocols',
            'Smaller provider with focus on speed',
        ],
        difficulty: 'easy',
        popular: false,
        lastUpdated: '2026-01-05',
    },

    // ===== CUSTOM WIREGUARD =====
    {
        id: 'custom-wireguard',
        name: 'Custom WireGuard',
        description: 'Import your own WireGuard configuration',
        icon: Key,
        gluetunProvider: 'custom',
        protocols: ['wireguard'],
        recommendedProtocol: 'wireguard',
        authMethod: {
            type: 'wireguard-config',
            description: 'WireGuard configuration file (.conf)',
            credentialUrl: undefined,
        },
        requiredEnvVars: [
            {
                key: 'VPN_SERVICE_PROVIDER',
                label: 'VPN Provider',
                description: 'Must be set to "custom"',
                required: true,
                type: 'text',
            },
            {
                key: 'VPN_TYPE',
                label: 'VPN Protocol',
                description: 'WireGuard only',
                required: true,
                type: 'select',
                options: [{ value: 'wireguard', label: 'WireGuard' }],
            },
            {
                key: 'VPN_ENDPOINT_IP',
                label: 'Endpoint IP',
                description: 'VPN server IP address',
                required: true,
                placeholder: '1.2.3.4',
            },
            {
                key: 'VPN_ENDPOINT_PORT',
                label: 'Endpoint Port',
                description: 'VPN server port',
                required: true,
                type: 'number',
                placeholder: '51820',
            },
            {
                key: 'WIREGUARD_PUBLIC_KEY',
                label: 'Server Public Key',
                description: 'VPN server public key',
                required: true,
                type: 'password',
            },
            {
                key: 'WIREGUARD_PRIVATE_KEY',
                label: 'Client Private Key',
                description: 'Your WireGuard private key',
                required: true,
                type: 'password',
            },
            {
                key: 'WIREGUARD_PRESHARED_KEY',
                label: 'Preshared Key (optional)',
                description: 'Additional layer of security',
                required: false,
                type: 'password',
            },
            {
                key: 'WIREGUARD_ADDRESSES',
                label: 'Interface Addresses',
                description: 'Client tunnel IP addresses',
                required: true,
                placeholder: '10.2.0.2/32',
            },
        ],
        optionalEnvVars: [
            {
                key: 'DNS_ADDRESS',
                label: 'Custom DNS',
                description: 'Override DNS servers (comma-separated IPs)',
                required: false,
                placeholder: '1.1.1.1,1.0.0.1',
            },
            {
                key: 'WIREGUARD_MTU',
                label: 'WireGuard MTU',
                description: 'Maximum Transmission Unit size',
                required: false,
                type: 'number',
                placeholder: '1420',
            },
        ],
        portForwarding: {
            supported: false,
            notes: 'Port forwarding depends on your VPN provider. Configure manually if supported.',
        },
        setupInstructionsUrl: 'https://github.com/qdm12/gluetun-wiki/blob/main/setup/advanced/custom-provider.md',
        troubleshootingTips: [
            'Import .conf file or manually enter values from your configuration',
            'Ensure all keys are base64 encoded',
            'Port forwarding depends on your specific VPN provider',
            'Check endpoint IP and port are correct',
            'Verify private key permissions are secure',
        ],
        difficulty: 'advanced',
        popular: false,
        lastUpdated: '2026-01-05',
    },
]

// ---------------------------------------------------------------------------
// COMMON GLUETUN ENVIRONMENT VARIABLES
// ---------------------------------------------------------------------------
// These apply to all VPN providers and control Gluetun behavior

export const commonGluetunEnvVars: VPNEnvironmentVariable[] = [
    {
        key: 'FIREWALL',
        label: 'Kill Switch (Firewall)',
        description: 'Block all traffic if VPN disconnects - recommended ON for privacy',
        required: false,
        type: 'select',
        defaultValue: 'on',
        options: [
            { value: 'on', label: 'Enabled (recommended)' },
            { value: 'off', label: 'Disabled' },
        ],
    },
    {
        key: 'FIREWALL_OUTBOUND_SUBNETS',
        label: 'Allowed Subnets',
        description: 'Comma-separated subnets allowed when VPN is down (e.g., "192.168.1.0/24")',
        required: false,
        placeholder: 'Leave empty to block all when VPN down',
    },
    {
        key: 'DOT',
        label: 'DNS over TLS',
        description: 'Use encrypted DNS queries',
        required: false,
        type: 'select',
        defaultValue: 'on',
        options: [
            { value: 'on', label: 'Enabled (recommended)' },
            { value: 'off', label: 'Disabled' },
        ],
    },
    {
        key: 'DNS_ADDRESS',
        label: 'Custom DNS Servers',
        description: 'Override DNS servers (comma-separated IPs)',
        required: false,
        placeholder: '1.1.1.1,1.0.0.1',
    },
    {
        key: 'HEALTH_VPN_DURATION_INITIAL',
        label: 'Initial Health Check',
        description: 'Time to wait for VPN connection on startup',
        required: false,
        placeholder: '6s',
    },
    {
        key: 'LOG_LEVEL',
        label: 'Log Level',
        description: 'Logging verbosity',
        required: false,
        type: 'select',
        defaultValue: 'info',
        options: [
            { value: 'debug', label: 'Debug (verbose)' },
            { value: 'info', label: 'Info (recommended)' },
            { value: 'warning', label: 'Warning' },
            { value: 'error', label: 'Error only' },
        ],
    },
    {
        key: 'TZ',
        label: 'Timezone',
        description: 'Container timezone (e.g., "America/New_York")',
        required: false,
        placeholder: 'UTC',
    },
]

// ---------------------------------------------------------------------------
// HELPER FUNCTIONS
// ---------------------------------------------------------------------------

/**
 * Get provider by ID
 */
export function getVPNProviderById(id: string): VPNProvider | undefined {
    return vpnProviders.find((provider) => provider.id === id)
}

/**
 * Get all providers that support port forwarding
 */
export function getPortForwardingProviders(): VPNProvider[] {
    return vpnProviders.filter((provider) => provider.portForwarding.supported)
}

/**
 * Get recommended/popular providers
 */
export function getPopularProviders(): VPNProvider[] {
    return vpnProviders.filter((provider) => provider.popular)
}

/**
 * Filter providers by protocol support
 */
export function getProvidersByProtocol(protocol: VPNProtocol): VPNProvider[] {
    return vpnProviders.filter((provider) => provider.protocols.includes(protocol))
}

/**
 * Get providers sorted by difficulty
 */
export function getProvidersByDifficulty(): Record<string, VPNProvider[]> {
    return {
        easy: vpnProviders.filter((p) => p.difficulty === 'easy'),
        moderate: vpnProviders.filter((p) => p.difficulty === 'moderate'),
        advanced: vpnProviders.filter((p) => p.difficulty === 'advanced'),
    }
}

/**
 * Get common Gluetun environment variables
 */
export function getCommonGluetunEnvVars(): VPNEnvironmentVariable[] {
    return commonGluetunEnvVars
}

/**
 * Search providers by name or description
 */
export function searchProviders(query: string): VPNProvider[] {
    const lowerQuery = query.toLowerCase()
    return vpnProviders.filter(
        (provider) =>
            provider.name.toLowerCase().includes(lowerQuery) ||
            provider.description.toLowerCase().includes(lowerQuery) ||
            provider.id.toLowerCase().includes(lowerQuery)
    )
}
