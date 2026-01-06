/**
 * VPN Credentials Validator
 * Validates VPN provider credentials format for Gluetun (WireGuard, OpenVPN)
 */

import { createLogger } from '../../utils/logger.js';
import type {
    ValidationResult,
    ValidationIssue,
    VpnValidationOptions
} from '../../types/validation.js';

const logger = createLogger('vpnValidator');

/**
 * Regular expression for Base64 strings (WireGuard keys)
 * WireGuard keys are 32 bytes encoded in base64 = 44 characters
 */
const BASE64_PATTERN = /^[A-Za-z0-9+/]{43}=$/;

/**
 * Regular expression for CIDR notation (WireGuard addresses)
 * Matches IPv4 CIDR (e.g., 10.13.13.2/32) and IPv6 CIDR
 */
const CIDR_IPV4_PATTERN = /^(\d{1,3}\.){3}\d{1,3}\/\d{1,2}$/;
const CIDR_IPV6_PATTERN = /^([0-9a-fA-F]{0,4}:){2,7}[0-9a-fA-F]{0,4}\/\d{1,3}$/;

/**
 * Regular expression for IP addresses
 */
const IPV4_PATTERN = /^(\d{1,3}\.){3}\d{1,3}$/;
const IPV6_PATTERN = /^([0-9a-fA-F]{0,4}:){2,7}[0-9a-fA-F]{0,4}$/;

/**
 * Known VPN providers that work with Gluetun
 * See: https://github.com/qdm12/gluetun-wiki/tree/main/setup/providers
 */
const KNOWN_PROVIDERS = [
    'airvpn',
    'custom',
    'cyberghost',
    'expressvpn',
    'fastestvpn',
    'hideme',
    'ipvanish',
    'ivpn',
    'mullvad',
    'nordvpn',
    'perfectprivacy',
    'privado',
    'privatevpn',
    'protonvpn',
    'purevpn',
    'surfshark',
    'torguard',
    'vyprvpn',
    'wevpn',
    'windscribe'
];

/**
 * Validate Base64 format for WireGuard keys
 */
function validateBase64Key(
    key: string | undefined,
    fieldName: string,
    required: boolean
): ValidationIssue | null {
    if (!key || key.trim() === '') {
        if (required) {
            return {
                code: 'VPN_KEY_MISSING',
                severity: 'error',
                message: `${fieldName} is required for WireGuard`,
                affectedField: fieldName,
                fixSuggestion: `Provide a valid Base64-encoded WireGuard key (44 characters)`
            };
        }
        return null; // Optional field
    }

    const trimmedKey = key.trim();

    if (trimmedKey.length !== 44) {
        return {
            code: 'VPN_KEY_INVALID_LENGTH',
            severity: 'error',
            message: `${fieldName} must be exactly 44 characters (Base64-encoded 32 bytes)`,
            affectedField: fieldName,
            fixSuggestion: `WireGuard keys are 32 bytes encoded in Base64, resulting in 44 characters including padding`,
            details: {
                actualLength: trimmedKey.length,
                expectedLength: 44
            }
        };
    }

    if (!BASE64_PATTERN.test(trimmedKey)) {
        return {
            code: 'VPN_KEY_INVALID_FORMAT',
            severity: 'error',
            message: `${fieldName} is not a valid Base64 string`,
            affectedField: fieldName,
            fixSuggestion: `Ensure the key contains only Base64 characters (A-Z, a-z, 0-9, +, /) and ends with '='`,
            details: { key: trimmedKey.substring(0, 10) + '...' }
        };
    }

    return null;
}

/**
 * Validate CIDR notation for WireGuard addresses
 */
function validateCIDR(addresses: string | undefined): ValidationIssue | null {
    if (!addresses || addresses.trim() === '') {
        return {
            code: 'VPN_ADDRESS_MISSING',
            severity: 'error',
            message: 'WireGuard addresses are required',
            affectedField: 'addresses',
            fixSuggestion: `Provide address in CIDR notation (e.g., 10.13.13.2/32 for IPv4 or fd00::1/64 for IPv6)`
        };
    }

    const trimmedAddresses = addresses.trim();

    // WireGuard addresses can be comma-separated for multiple addresses
    const addressList = trimmedAddresses.split(',').map(a => a.trim());

    for (const addr of addressList) {
        const isValidIPv4 = CIDR_IPV4_PATTERN.test(addr);
        const isValidIPv6 = CIDR_IPV6_PATTERN.test(addr);

        if (!isValidIPv4 && !isValidIPv6) {
            return {
                code: 'VPN_ADDRESS_INVALID_FORMAT',
                severity: 'error',
                message: `Invalid CIDR notation: ${addr}`,
                affectedField: 'addresses',
                fixSuggestion: `Use CIDR notation (e.g., 10.13.13.2/32 for IPv4 or fd00::1/64 for IPv6)`,
                details: { invalidAddress: addr }
            };
        }

        // Validate IPv4 CIDR prefix
        if (isValidIPv4) {
            const [ip, prefix] = addr.split('/');
            const prefixNum = parseInt(prefix, 10);

            // Check IP octets are valid (0-255)
            const octets = ip.split('.').map(o => parseInt(o, 10));
            if (octets.some(o => o < 0 || o > 255)) {
                return {
                    code: 'VPN_ADDRESS_INVALID_IP',
                    severity: 'error',
                    message: `Invalid IP address in CIDR: ${ip}`,
                    affectedField: 'addresses',
                    fixSuggestion: `Each octet must be between 0 and 255`,
                    details: { address: addr }
                };
            }

            // Check prefix is valid (0-32)
            if (prefixNum < 0 || prefixNum > 32) {
                return {
                    code: 'VPN_ADDRESS_INVALID_PREFIX',
                    severity: 'error',
                    message: `Invalid IPv4 CIDR prefix: /${prefix}`,
                    affectedField: 'addresses',
                    fixSuggestion: `IPv4 CIDR prefix must be between /0 and /32 (typically /32 for single host)`,
                    details: { address: addr }
                };
            }
        }

        // Validate IPv6 CIDR prefix
        if (isValidIPv6) {
            const prefix = addr.split('/')[1];
            const prefixNum = parseInt(prefix, 10);

            if (prefixNum < 0 || prefixNum > 128) {
                return {
                    code: 'VPN_ADDRESS_INVALID_PREFIX',
                    severity: 'error',
                    message: `Invalid IPv6 CIDR prefix: /${prefix}`,
                    affectedField: 'addresses',
                    fixSuggestion: `IPv6 CIDR prefix must be between /0 and /128 (typically /64)`,
                    details: { address: addr }
                };
            }
        }
    }

    return null;
}

/**
 * Validate IP address format
 */
function validateIPAddress(
    ip: string | undefined,
    fieldName: string
): ValidationIssue | null {
    if (!ip || ip.trim() === '') {
        return {
            code: 'VPN_ENDPOINT_IP_MISSING',
            severity: 'error',
            message: `${fieldName} is required for WireGuard`,
            affectedField: fieldName,
            fixSuggestion: `Provide the VPN endpoint IP address`
        };
    }

    const trimmedIP = ip.trim();
    const isValidIPv4 = IPV4_PATTERN.test(trimmedIP);
    const isValidIPv6 = IPV6_PATTERN.test(trimmedIP);

    if (!isValidIPv4 && !isValidIPv6) {
        return {
            code: 'VPN_ENDPOINT_IP_INVALID',
            severity: 'error',
            message: `Invalid IP address: ${trimmedIP}`,
            affectedField: fieldName,
            fixSuggestion: `Provide a valid IPv4 or IPv6 address`,
            details: { value: trimmedIP }
        };
    }

    // Check IPv4 octets are valid
    if (isValidIPv4) {
        const octets = trimmedIP.split('.').map(o => parseInt(o, 10));
        if (octets.some(o => o < 0 || o > 255)) {
            return {
                code: 'VPN_ENDPOINT_IP_INVALID',
                severity: 'error',
                message: `Invalid IPv4 address: ${trimmedIP}`,
                affectedField: fieldName,
                fixSuggestion: `Each octet must be between 0 and 255`,
                details: { value: trimmedIP }
            };
        }
    }

    return null;
}

/**
 * Validate port number
 */
function validatePort(
    port: string | number | undefined,
    fieldName: string
): ValidationIssue | null {
    if (!port || port === '') {
        return {
            code: 'VPN_ENDPOINT_PORT_MISSING',
            severity: 'error',
            message: `${fieldName} is required for WireGuard`,
            affectedField: fieldName,
            fixSuggestion: `Provide the VPN endpoint port number (typically 51820 for WireGuard)`
        };
    }

    const portNum = typeof port === 'string' ? parseInt(port, 10) : port;

    if (isNaN(portNum) || portNum < 1 || portNum > 65535) {
        return {
            code: 'VPN_ENDPOINT_PORT_INVALID',
            severity: 'error',
            message: `Invalid port number: ${port}`,
            affectedField: fieldName,
            fixSuggestion: `Port must be between 1 and 65535`,
            details: { value: port }
        };
    }

    return null;
}

/**
 * Validate WireGuard credentials
 */
function validateWireGuard(
    credentials: VpnValidationOptions['credentials']
): ValidationIssue[] {
    const issues: ValidationIssue[] = [];

    // Validate private key (required)
    const privateKeyIssue = validateBase64Key(
        credentials.privateKey,
        'privateKey',
        true
    );
    if (privateKeyIssue) issues.push(privateKeyIssue);

    // Validate addresses (required)
    const addressIssue = validateCIDR(credentials.addresses);
    if (addressIssue) issues.push(addressIssue);

    // Validate public key (required for most providers)
    const publicKeyIssue = validateBase64Key(
        credentials.publicKey,
        'publicKey',
        true
    );
    if (publicKeyIssue) issues.push(publicKeyIssue);

    // Validate preshared key (optional)
    if (credentials.presharedKey) {
        const presharedKeyIssue = validateBase64Key(
            credentials.presharedKey,
            'presharedKey',
            false
        );
        if (presharedKeyIssue) issues.push(presharedKeyIssue);
    }

    // Validate endpoint IP (required)
    const endpointIPIssue = validateIPAddress(
        credentials.endpointIp,
        'endpointIp'
    );
    if (endpointIPIssue) issues.push(endpointIPIssue);

    // Validate endpoint port (required)
    const endpointPortIssue = validatePort(
        credentials.endpointPort,
        'endpointPort'
    );
    if (endpointPortIssue) issues.push(endpointPortIssue);

    return issues;
}

/**
 * Validate OpenVPN credentials
 */
function validateOpenVPN(
    credentials: VpnValidationOptions['credentials']
): ValidationIssue[] {
    const issues: ValidationIssue[] = [];

    // OpenVPN typically requires username and password
    if (!credentials.username || credentials.username.trim() === '') {
        issues.push({
            code: 'VPN_USERNAME_MISSING',
            severity: 'error',
            message: 'OpenVPN username is required',
            affectedField: 'username',
            fixSuggestion: `Provide your VPN provider username`
        });
    } else {
        // Basic username validation
        const username = credentials.username.trim();
        if (username.length < 3) {
            issues.push({
                code: 'VPN_USERNAME_TOO_SHORT',
                severity: 'warning',
                message: 'OpenVPN username seems too short',
                affectedField: 'username',
                fixSuggestion: `Verify your username is correct`,
                details: { length: username.length }
            });
        }
    }

    if (!credentials.password || credentials.password.trim() === '') {
        issues.push({
            code: 'VPN_PASSWORD_MISSING',
            severity: 'error',
            message: 'OpenVPN password is required',
            affectedField: 'password',
            fixSuggestion: `Provide your VPN provider password`
        });
    } else {
        // Basic password validation
        const password = credentials.password.trim();
        if (password.length < 4) {
            issues.push({
                code: 'VPN_PASSWORD_TOO_SHORT',
                severity: 'warning',
                message: 'OpenVPN password seems too short',
                affectedField: 'password',
                fixSuggestion: `Verify your password is correct`,
                details: { length: password.length }
            });
        }
    }

    return issues;
}

/**
 * Validate VPN credentials for Gluetun
 */
export async function validateVPN(options: VpnValidationOptions): Promise<ValidationResult> {
    const startTime = Date.now();
    logger.debug({
        provider: options.provider,
        type: options.type
    }, 'Starting VPN validation');

    const allIssues: ValidationIssue[] = [];

    // Validate provider if specified
    if (options.provider) {
        const provider = options.provider.toLowerCase().trim();
        if (!KNOWN_PROVIDERS.includes(provider)) {
            allIssues.push({
                code: 'VPN_PROVIDER_UNKNOWN',
                severity: 'warning',
                message: `Unknown VPN provider: ${options.provider}`,
                affectedField: 'provider',
                fixSuggestion: `Verify provider name. Known providers: ${KNOWN_PROVIDERS.join(', ')}. Use 'custom' for custom configurations.`,
                details: {
                    provider: options.provider,
                    knownProviders: KNOWN_PROVIDERS
                }
            });
        }
    }

    // Validate credentials based on VPN type
    if (options.type === 'wireguard') {
        const wireGuardIssues = validateWireGuard(options.credentials);
        allIssues.push(...wireGuardIssues);
    } else if (options.type === 'openvpn') {
        const openVPNIssues = validateOpenVPN(options.credentials);
        allIssues.push(...openVPNIssues);
    } else {
        allIssues.push({
            code: 'VPN_TYPE_INVALID',
            severity: 'error',
            message: `Invalid VPN type: ${options.type}`,
            affectedField: 'type',
            fixSuggestion: `VPN type must be either 'wireguard' or 'openvpn'`
        });
    }

    // Informational messages
    if (allIssues.length === 0) {
        if (options.type === 'wireguard') {
            allIssues.push({
                code: 'VPN_VALIDATION_SUCCESS',
                severity: 'info',
                message: `WireGuard credentials format is valid`,
                fixSuggestion: `Ensure these credentials match your VPN provider's configuration`,
                details: { type: options.type, provider: options.provider }
            });
        } else if (options.type === 'openvpn') {
            allIssues.push({
                code: 'VPN_VALIDATION_SUCCESS',
                severity: 'info',
                message: `OpenVPN credentials format is valid`,
                fixSuggestion: `Ensure these credentials match your VPN provider's configuration`,
                details: { type: options.type, provider: options.provider }
            });
        }
    }

    const passed = allIssues.every(issue => issue.severity !== 'error');
    const duration = Date.now() - startTime;

    logger.debug({
        passed,
        issueCount: allIssues.length,
        durationMs: duration
    }, 'VPN validation complete');

    return {
        validator: 'vpn',
        passed,
        issues: allIssues,
        timestamp: new Date(),
        metadata: {
            vpnType: options.type,
            provider: options.provider,
            durationMs: duration
        }
    };
}
