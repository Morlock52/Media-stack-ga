import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { getErrorMessage } from '../utils/errors.js';

// VPN validation request schema
const VPNValidationSchema = z.object({
    provider: z.string().min(1, 'Provider is required'),
    protocol: z.enum(['wireguard', 'openvpn']),
    credentials: z.record(z.string(), z.string()),
    portForwardingEnabled: z.boolean().optional(),
});

type VPNValidationRequest = z.infer<typeof VPNValidationSchema>;

interface ValidationResult {
    valid: boolean;
    errors: string[];
    warnings: string[];
    details?: Record<string, unknown>;
}

export async function vpnRoutes(fastify: FastifyInstance) {
    /**
     * POST /api/vpn/validate
     * Validates VPN configuration before deployment
     *
     * This performs pre-deployment validation:
     * - Credential format validation
     * - WireGuard config structure validation
     * - Provider-specific validation rules
     *
     * Note: Full connection testing requires a running Gluetun container (post-deployment)
     */
    fastify.post<{ Body: VPNValidationRequest }>(
        '/api/vpn/validate',
        async (request, reply) => {
            try {
                // Validate request body schema
                const validationResult = VPNValidationSchema.safeParse(request.body);
                if (!validationResult.success) {
                    return reply.status(400).send({
                        success: false,
                        valid: false,
                        errors: validationResult.error.errors.map(e => `${e.path.join('.')}: ${e.message}`),
                        warnings: [],
                    });
                }

                const { provider, protocol, credentials, portForwardingEnabled } = validationResult.data;

                fastify.log.info(
                    { provider, protocol, portForwarding: portForwardingEnabled },
                    '[vpn/validate] Validating VPN configuration'
                );

                const result = await validateVPNConfig(
                    provider,
                    protocol,
                    credentials,
                    portForwardingEnabled || false
                );

                return reply.status(200).send({
                    success: true,
                    ...result,
                });
            } catch (error: unknown) {
                fastify.log.error({ err: error }, '[vpn/validate] Validation failed');
                return reply.status(200).send({
                    success: false,
                    valid: false,
                    errors: [getErrorMessage(error)],
                    warnings: [],
                });
            }
        }
    );
}

/**
 * Validate VPN configuration
 */
async function validateVPNConfig(
    provider: string,
    protocol: 'wireguard' | 'openvpn',
    credentials: Record<string, string>,
    portForwardingEnabled: boolean
): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];
    const details: Record<string, unknown> = {};

    // Provider-specific validation
    if (provider === 'custom') {
        // Custom WireGuard configuration
        if (protocol !== 'wireguard') {
            errors.push('Custom provider only supports WireGuard protocol');
        }

        const wireGuardResult = validateWireGuardCredentials(credentials);
        errors.push(...wireGuardResult.errors);
        warnings.push(...wireGuardResult.warnings);
        details.wireGuard = wireGuardResult.details;
    } else {
        // Standard provider validation
        if (protocol === 'wireguard') {
            const wireGuardResult = validateWireGuardCredentials(credentials);
            errors.push(...wireGuardResult.errors);
            warnings.push(...wireGuardResult.warnings);
            details.wireGuard = wireGuardResult.details;
        } else if (protocol === 'openvpn') {
            const openVpnResult = validateOpenVPNCredentials(credentials, provider);
            errors.push(...openVpnResult.errors);
            warnings.push(...openVpnResult.warnings);
            details.openVpn = openVpnResult.details;
        }

        // Provider-specific checks
        const providerResult = validateProviderSpecific(provider, credentials, portForwardingEnabled);
        errors.push(...providerResult.errors);
        warnings.push(...providerResult.warnings);
        if (Object.keys(providerResult.details || {}).length > 0) {
            details.provider = providerResult.details;
        }
    }

    // General credential validation
    if (Object.keys(credentials).length === 0) {
        errors.push('No credentials provided');
    }

    return {
        valid: errors.length === 0,
        errors,
        warnings,
        details: Object.keys(details).length > 0 ? details : undefined,
    };
}

/**
 * Validate WireGuard credentials
 */
function validateWireGuardCredentials(credentials: Record<string, string>): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const details: Record<string, unknown> = {};

    // Check required WireGuard fields
    const privateKey = credentials.WIREGUARD_PRIVATE_KEY || credentials.privateKey;
    const addresses = credentials.WIREGUARD_ADDRESSES || credentials.addresses;
    const publicKey = credentials.WIREGUARD_PUBLIC_KEY || credentials.publicKey;

    if (!privateKey) {
        errors.push('WireGuard private key is required');
    } else {
        const keyValidation = validateWireGuardKey(privateKey, 'Private key');
        errors.push(...keyValidation.errors);
        warnings.push(...keyValidation.warnings);
        details.privateKeyValid = keyValidation.valid;
    }

    if (!addresses) {
        errors.push('WireGuard addresses are required');
    } else {
        const addressValidation = validateWireGuardAddresses(addresses);
        errors.push(...addressValidation.errors);
        warnings.push(...addressValidation.warnings);
        details.addressesValid = addressValidation.valid;
    }

    // Public key is optional for some providers but recommended
    if (publicKey) {
        const keyValidation = validateWireGuardKey(publicKey, 'Public key');
        errors.push(...keyValidation.errors);
        warnings.push(...keyValidation.warnings);
        details.publicKeyValid = keyValidation.valid;
    }

    // Check preshared key if provided
    const presharedKey = credentials.WIREGUARD_PRESHARED_KEY || credentials.presharedKey;
    if (presharedKey) {
        const keyValidation = validateWireGuardKey(presharedKey, 'Preshared key');
        // Preshared key warnings are non-critical
        warnings.push(...keyValidation.errors);
        warnings.push(...keyValidation.warnings);
        details.presharedKeyValid = keyValidation.valid;
    }

    // Validate endpoint if provided
    const endpointIp = credentials.VPN_ENDPOINT_IP || credentials.endpointIp;
    const endpointPort = credentials.VPN_ENDPOINT_PORT || credentials.endpointPort;

    if (endpointIp && endpointPort) {
        const portNum = parseInt(endpointPort, 10);
        if (isNaN(portNum) || portNum < 1 || portNum > 65535) {
            errors.push(`Invalid endpoint port: ${endpointPort} (must be 1-65535)`);
        } else {
            details.endpointValid = true;
        }
    }

    return {
        valid: errors.length === 0,
        errors,
        warnings,
        details,
    };
}

/**
 * Validate WireGuard key format (base64, ~44 chars)
 */
function validateWireGuardKey(key: string, keyType: string): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (key.length < 40 || key.length > 48) {
        errors.push(`${keyType} has invalid length (expected ~44 characters, got ${key.length})`);
    }

    // Check if it's valid base64
    if (!/^[A-Za-z0-9+/]+=*$/.test(key)) {
        errors.push(`${keyType} is not valid base64 format`);
    }

    // Warn if key looks suspicious
    if (key.includes(' ')) {
        warnings.push(`${keyType} contains spaces (may be invalid)`);
    }

    return {
        valid: errors.length === 0,
        errors,
        warnings,
    };
}

/**
 * Validate WireGuard addresses (CIDR notation)
 */
function validateWireGuardAddresses(addresses: string): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!addresses.includes('/')) {
        warnings.push('Address should include CIDR notation (e.g., 10.2.0.2/32)');
    }

    // Check for multiple addresses (comma-separated)
    const addressList = addresses.split(',').map(a => a.trim()).filter(Boolean);

    if (addressList.length === 0) {
        errors.push('No valid addresses found');
    }

    // Validate each address has CIDR notation
    for (const addr of addressList) {
        if (!addr.includes('/')) {
            warnings.push(`Address "${addr}" missing CIDR notation`);
        }
    }

    return {
        valid: errors.length === 0,
        errors,
        warnings,
    };
}

/**
 * Validate OpenVPN credentials
 */
function validateOpenVPNCredentials(
    credentials: Record<string, string>,
    provider: string
): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const details: Record<string, unknown> = {};

    const username = credentials.OPENVPN_USER || credentials.username;
    const password = credentials.OPENVPN_PASSWORD || credentials.password;

    // Most providers require username/password for OpenVPN
    if (!username) {
        errors.push('OpenVPN username is required');
    } else {
        details.usernameProvided = true;

        // Provider-specific username validation
        if (provider === 'protonvpn') {
            // ProtonVPN requires +pmp suffix for port forwarding
            if (username && credentials.VPN_PORT_FORWARDING === 'on' && !username.includes('+pmp')) {
                warnings.push('ProtonVPN port forwarding requires username with +pmp suffix (e.g., username+pmp)');
            }
        }
    }

    if (!password) {
        errors.push('OpenVPN password is required');
    } else {
        details.passwordProvided = true;
    }

    return {
        valid: errors.length === 0,
        errors,
        warnings,
        details,
    };
}

/**
 * Provider-specific validation rules
 */
function validateProviderSpecific(
    provider: string,
    credentials: Record<string, string>,
    portForwardingEnabled: boolean
): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const details: Record<string, unknown> = {};

    // Port forwarding validation
    if (portForwardingEnabled) {
        const portForwardingProviders = ['mullvad', 'protonvpn', 'pia', 'airvpn', 'ivpn'];

        if (!portForwardingProviders.includes(provider.toLowerCase())) {
            warnings.push(
                `Port forwarding is not supported by ${provider}. ` +
                `Supported providers: ${portForwardingProviders.join(', ')}`
            );
        } else {
            details.portForwardingSupported = true;
        }
    }

    // Provider-specific credential validation
    switch (provider.toLowerCase()) {
        case 'mullvad':
            // Mullvad uses account number (16 digits)
            const mullvadAccount = credentials.WIREGUARD_PRIVATE_KEY;
            if (mullvadAccount && mullvadAccount.length === 16 && /^\d+$/.test(mullvadAccount)) {
                warnings.push('Mullvad account number detected. Make sure you are using WireGuard keys, not the account number.');
            }
            break;

        case 'protonvpn':
            // ProtonVPN port forwarding requires specific configuration
            if (portForwardingEnabled) {
                const protocol = credentials.VPN_TYPE || 'wireguard';
                if (protocol === 'wireguard') {
                    warnings.push('ProtonVPN port forwarding requires OpenVPN protocol (not WireGuard)');
                }
            }
            break;

        case 'nordvpn':
            // NordVPN doesn't support port forwarding
            if (portForwardingEnabled) {
                warnings.push('NordVPN does not support port forwarding. Consider switching to Mullvad or ProtonVPN.');
            }
            break;

        case 'expressvpn':
            // ExpressVPN requires API token
            const apiToken = credentials.EXPRESSVPN_API_TOKEN;
            if (!apiToken) {
                warnings.push('ExpressVPN requires an API token from your account settings');
            }
            break;
    }

    return {
        valid: errors.length === 0,
        errors,
        warnings,
        details,
    };
}
