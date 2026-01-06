/**
 * WireGuard configuration parser
 * Parses .conf files and extracts Gluetun-compatible environment variables
 */

export interface WireGuardConfig {
    // Required fields
    privateKey: string
    addresses: string
    publicKey: string
    endpointIp: string
    endpointPort: string

    // Optional fields
    presharedKey?: string
    dns?: string
    mtu?: string

    // Additional metadata
    allowedIps?: string
}

export interface ParseResult {
    success: boolean
    config?: WireGuardConfig
    errors: string[]
    warnings: string[]
}

/**
 * Parse a WireGuard configuration file content
 */
export function parseWireGuardConfig(content: string): ParseResult {
    const errors: string[] = []
    const warnings: string[] = []
    const config: Partial<WireGuardConfig> = {}

    if (!content || !content.trim()) {
        errors.push('Configuration content is empty')
        return { success: false, errors, warnings }
    }

    // Split into lines and clean up
    const lines = content.split('\n').map(line => line.trim())

    let currentSection: 'interface' | 'peer' | null = null

    for (const line of lines) {
        // Skip empty lines and comments
        if (!line || line.startsWith('#') || line.startsWith(';')) {
            continue
        }

        // Check for section headers
        if (line.toLowerCase() === '[interface]') {
            currentSection = 'interface'
            continue
        } else if (line.toLowerCase() === '[peer]') {
            currentSection = 'peer'
            continue
        }

        // Parse key-value pairs
        const match = line.match(/^(\w+)\s*=\s*(.+)$/)
        if (!match) {
            warnings.push(`Skipping unparseable line: ${line}`)
            continue
        }

        const [, key, value] = match
        const normalizedKey = key.toLowerCase()
        const trimmedValue = value.trim()

        // Parse based on current section
        if (currentSection === 'interface') {
            switch (normalizedKey) {
                case 'privatekey':
                    config.privateKey = trimmedValue
                    break
                case 'address':
                    config.addresses = trimmedValue
                    break
                case 'dns':
                    config.dns = trimmedValue
                    break
                case 'mtu':
                    config.mtu = trimmedValue
                    break
            }
        } else if (currentSection === 'peer') {
            switch (normalizedKey) {
                case 'publickey':
                    config.publicKey = trimmedValue
                    break
                case 'presharedkey':
                    config.presharedKey = trimmedValue
                    break
                case 'endpoint':
                    // Parse endpoint (format: IP:Port or hostname:port)
                    const endpointMatch = trimmedValue.match(/^(.+):(\d+)$/)
                    if (endpointMatch) {
                        config.endpointIp = endpointMatch[1]
                        config.endpointPort = endpointMatch[2]
                    } else {
                        errors.push(`Invalid endpoint format: ${trimmedValue}. Expected format: IP:Port`)
                    }
                    break
                case 'allowedips':
                    config.allowedIps = trimmedValue
                    break
            }
        } else {
            warnings.push(`Found key-value pair outside of section: ${line}`)
        }
    }

    // Validate required fields
    const requiredFields: Array<keyof WireGuardConfig> = [
        'privateKey',
        'addresses',
        'publicKey',
        'endpointIp',
        'endpointPort',
    ]

    for (const field of requiredFields) {
        if (!config[field]) {
            errors.push(`Missing required field: ${formatFieldName(field)}`)
        }
    }

    // Additional validation
    if (config.privateKey && !isValidWireGuardKey(config.privateKey)) {
        errors.push('Private key appears to be invalid (should be base64 encoded, ~44 characters)')
    }

    if (config.publicKey && !isValidWireGuardKey(config.publicKey)) {
        errors.push('Public key appears to be invalid (should be base64 encoded, ~44 characters)')
    }

    if (config.presharedKey && !isValidWireGuardKey(config.presharedKey)) {
        warnings.push('Preshared key appears to be invalid (should be base64 encoded, ~44 characters)')
    }

    if (config.endpointPort) {
        const port = parseInt(config.endpointPort, 10)
        if (isNaN(port) || port < 1 || port > 65535) {
            errors.push(`Invalid port number: ${config.endpointPort}`)
        }
    }

    // Check if addresses is in CIDR notation
    if (config.addresses && !config.addresses.includes('/')) {
        warnings.push('Address should include CIDR notation (e.g., 10.2.0.2/32)')
    }

    const success = errors.length === 0 && requiredFields.every(field => config[field])

    return {
        success,
        config: success ? (config as WireGuardConfig) : undefined,
        errors,
        warnings,
    }
}

/**
 * Validate WireGuard key format (base64, ~44 chars)
 */
function isValidWireGuardKey(key: string): boolean {
    // WireGuard keys are base64 encoded and typically 44 characters
    if (key.length < 40 || key.length > 48) {
        return false
    }
    // Check if it's valid base64
    return /^[A-Za-z0-9+/]+=*$/.test(key)
}

/**
 * Format field name for display
 */
function formatFieldName(field: keyof WireGuardConfig): string {
    const nameMap: Record<keyof WireGuardConfig, string> = {
        privateKey: 'PrivateKey',
        addresses: 'Address',
        publicKey: 'PublicKey',
        endpointIp: 'Endpoint IP',
        endpointPort: 'Endpoint Port',
        presharedKey: 'PresharedKey',
        dns: 'DNS',
        mtu: 'MTU',
        allowedIps: 'AllowedIPs',
    }
    return nameMap[field] || field
}

/**
 * Convert parsed config to Gluetun environment variables
 */
export function configToEnvVars(config: WireGuardConfig): Record<string, string> {
    const envVars: Record<string, string> = {
        VPN_SERVICE_PROVIDER: 'custom',
        VPN_TYPE: 'wireguard',
        VPN_ENDPOINT_IP: config.endpointIp,
        VPN_ENDPOINT_PORT: config.endpointPort,
        WIREGUARD_PUBLIC_KEY: config.publicKey,
        WIREGUARD_PRIVATE_KEY: config.privateKey,
        WIREGUARD_ADDRESSES: config.addresses,
    }

    // Add optional fields
    if (config.presharedKey) {
        envVars.WIREGUARD_PRESHARED_KEY = config.presharedKey
    }

    if (config.dns) {
        envVars.DNS_ADDRESS = config.dns
    }

    if (config.mtu) {
        envVars.WIREGUARD_MTU = config.mtu
    }

    return envVars
}

/**
 * Generate a sample WireGuard config for reference
 */
export function getSampleConfig(): string {
    return `[Interface]
PrivateKey = YourPrivateKeyHere==
Address = 10.2.0.2/32
DNS = 1.1.1.1

[Peer]
PublicKey = ServerPublicKeyHere==
PresharedKey = OptionalPresharedKeyHere== (optional)
Endpoint = 1.2.3.4:51820
AllowedIPs = 0.0.0.0/0`
}
