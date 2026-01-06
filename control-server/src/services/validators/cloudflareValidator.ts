/**
 * Cloudflare Tunnel Validator
 * Validates Cloudflare tunnel token format and optionally tests connectivity
 */

import { createLogger } from '../../utils/logger.js';
import type {
    ValidationResult,
    ValidationIssue,
    CloudflareValidationOptions
} from '../../types/validation.js';

const logger = createLogger('cloudflareValidator');

/**
 * Cloudflare tunnel tokens are JWTs that start with "eyJ" (Base64 for '{"')
 * They contain metadata about the tunnel, account, and credentials
 */
const JWT_PATTERN = /^eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;

/**
 * Decode a Base64URL string (used in JWTs)
 * Base64URL replaces + with - and / with _, and removes padding
 */
function decodeBase64URL(str: string): string {
    try {
        // Convert Base64URL to Base64
        const base64 = str.replace(/-/g, '+').replace(/_/g, '/');
        // Add padding if needed
        const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
        // Decode from Base64
        return Buffer.from(padded, 'base64').toString('utf-8');
    } catch (error) {
        throw new Error(`Failed to decode Base64URL: ${(error as Error).message}`);
    }
}

/**
 * Parse and validate JWT structure
 */
function parseJWT(token: string): { header: unknown; payload: unknown } | null {
    try {
        const parts = token.split('.');
        if (parts.length !== 3) {
            return null;
        }

        const [headerB64, payloadB64] = parts;

        const headerStr = decodeBase64URL(headerB64);
        const payloadStr = decodeBase64URL(payloadB64);

        const header = JSON.parse(headerStr);
        const payload = JSON.parse(payloadStr);

        return { header, payload };
    } catch (error) {
        logger.debug({ error: (error as Error).message }, 'Failed to parse JWT');
        return null;
    }
}

/**
 * Validate Cloudflare tunnel token format
 */
function validateTokenFormat(token: string | undefined): ValidationIssue[] {
    const issues: ValidationIssue[] = [];

    // Check if token is provided
    if (!token || token.trim() === '') {
        issues.push({
            code: 'CLOUDFLARE_TOKEN_MISSING',
            severity: 'error',
            message: 'Cloudflare tunnel token is required',
            affectedField: 'tunnelToken',
            fixSuggestion: 'Generate a tunnel token at https://one.dash.cloudflare.com → Networks → Tunnels → Create'
        });
        return issues;
    }

    const trimmedToken = token.trim();

    // Check if token starts with eyJ (JWT pattern)
    if (!trimmedToken.startsWith('eyJ')) {
        issues.push({
            code: 'CLOUDFLARE_TOKEN_INVALID_FORMAT',
            severity: 'error',
            message: 'Cloudflare tunnel token must be a valid JWT (should start with "eyJ")',
            affectedField: 'tunnelToken',
            fixSuggestion: 'Ensure you copied the complete tunnel token from the Cloudflare dashboard',
            details: {
                tokenPrefix: trimmedToken.substring(0, 10) + '...'
            }
        });
        return issues;
    }

    // Check if token matches JWT pattern (three parts separated by dots)
    if (!JWT_PATTERN.test(trimmedToken)) {
        issues.push({
            code: 'CLOUDFLARE_TOKEN_MALFORMED',
            severity: 'error',
            message: 'Cloudflare tunnel token is malformed (invalid JWT structure)',
            affectedField: 'tunnelToken',
            fixSuggestion: 'JWT tokens must have three parts separated by dots (header.payload.signature). Copy the complete token from Cloudflare dashboard.',
            details: {
                tokenParts: trimmedToken.split('.').length,
                expectedParts: 3
            }
        });
        return issues;
    }

    // Parse and validate JWT structure
    const parsed = parseJWT(trimmedToken);
    if (!parsed) {
        issues.push({
            code: 'CLOUDFLARE_TOKEN_DECODE_FAILED',
            severity: 'error',
            message: 'Failed to decode Cloudflare tunnel token',
            affectedField: 'tunnelToken',
            fixSuggestion: 'The token may be corrupted or invalid. Generate a new token from the Cloudflare dashboard.'
        });
        return issues;
    }

    // Validate JWT header
    const { header, payload } = parsed;
    if (typeof header !== 'object' || header === null) {
        issues.push({
            code: 'CLOUDFLARE_TOKEN_INVALID_HEADER',
            severity: 'error',
            message: 'Invalid JWT header in tunnel token',
            affectedField: 'tunnelToken',
            fixSuggestion: 'Generate a new token from the Cloudflare dashboard'
        });
        return issues;
    }

    // Validate JWT payload contains expected Cloudflare fields
    if (typeof payload !== 'object' || payload === null) {
        issues.push({
            code: 'CLOUDFLARE_TOKEN_INVALID_PAYLOAD',
            severity: 'error',
            message: 'Invalid JWT payload in tunnel token',
            affectedField: 'tunnelToken',
            fixSuggestion: 'Generate a new token from the Cloudflare dashboard'
        });
        return issues;
    }

    // Check for required Cloudflare tunnel token fields
    // Cloudflare tunnel tokens typically contain: a (account ID), t (tunnel ID), s (secret)
    const payloadObj = payload as Record<string, unknown>;
    const hasAccountId = 'a' in payloadObj || 'account_id' in payloadObj;
    const hasTunnelId = 't' in payloadObj || 'tunnel_id' in payloadObj;
    const hasSecret = 's' in payloadObj || 'secret' in payloadObj;

    if (!hasAccountId && !hasTunnelId && !hasSecret) {
        issues.push({
            code: 'CLOUDFLARE_TOKEN_MISSING_FIELDS',
            severity: 'warning',
            message: 'Tunnel token does not contain expected Cloudflare fields',
            affectedField: 'tunnelToken',
            fixSuggestion: 'This may not be a valid Cloudflare tunnel token. Generate a new token at https://one.dash.cloudflare.com',
            details: {
                payloadKeys: Object.keys(payloadObj)
            }
        });
    }

    // Check token expiration if present
    if ('exp' in payloadObj && typeof payloadObj.exp === 'number') {
        const expirationTime = payloadObj.exp * 1000; // Convert to milliseconds
        const now = Date.now();

        if (expirationTime < now) {
            issues.push({
                code: 'CLOUDFLARE_TOKEN_EXPIRED',
                severity: 'error',
                message: 'Cloudflare tunnel token has expired',
                affectedField: 'tunnelToken',
                fixSuggestion: 'Generate a new tunnel token from the Cloudflare dashboard',
                details: {
                    expiredAt: new Date(expirationTime).toISOString(),
                    now: new Date(now).toISOString()
                }
            });
        } else if (expirationTime - now < 7 * 24 * 60 * 60 * 1000) {
            // Warn if expiring within 7 days
            issues.push({
                code: 'CLOUDFLARE_TOKEN_EXPIRING_SOON',
                severity: 'warning',
                message: 'Cloudflare tunnel token will expire soon',
                affectedField: 'tunnelToken',
                fixSuggestion: 'Consider generating a new tunnel token to avoid service interruption',
                details: {
                    expiresAt: new Date(expirationTime).toISOString(),
                    daysRemaining: Math.floor((expirationTime - now) / (24 * 60 * 60 * 1000))
                }
            });
        }
    }

    return issues;
}

/**
 * Test Cloudflare connectivity (optional)
 * Attempts to verify that Cloudflare services are reachable
 */
async function testConnectivity(): Promise<ValidationIssue[]> {
    const issues: ValidationIssue[] = [];

    try {
        // Test connectivity to Cloudflare's API
        // Using a simple fetch to check if Cloudflare is reachable
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

        const response = await fetch('https://api.cloudflare.com/client/v4/ips', {
            signal: controller.signal,
            headers: {
                'Accept': 'application/json'
            }
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            issues.push({
                code: 'CLOUDFLARE_CONNECTIVITY_WARNING',
                severity: 'warning',
                message: 'Cloudflare API returned an unexpected response',
                fixSuggestion: 'Check your internet connection and firewall settings',
                details: {
                    status: response.status,
                    statusText: response.statusText
                }
            });
        } else {
            issues.push({
                code: 'CLOUDFLARE_CONNECTIVITY_SUCCESS',
                severity: 'info',
                message: 'Successfully connected to Cloudflare API',
                fixSuggestion: 'Your network can reach Cloudflare services'
            });
        }
    } catch (error) {
        const err = error as Error;

        if (err.name === 'AbortError') {
            issues.push({
                code: 'CLOUDFLARE_CONNECTIVITY_TIMEOUT',
                severity: 'warning',
                message: 'Connection to Cloudflare API timed out',
                fixSuggestion: 'Check your internet connection. Cloudflare tunnel may still work if your network is slow.',
                details: { timeout: '5000ms' }
            });
        } else {
            issues.push({
                code: 'CLOUDFLARE_CONNECTIVITY_FAILED',
                severity: 'warning',
                message: 'Failed to connect to Cloudflare API',
                fixSuggestion: 'Check your internet connection and firewall settings. This does not necessarily mean the tunnel will fail.',
                details: {
                    error: err.message
                }
            });
        }
    }

    return issues;
}

/**
 * Validate Cloudflare tunnel configuration
 */
export async function validateCloudflare(
    options: CloudflareValidationOptions
): Promise<ValidationResult> {
    const startTime = Date.now();
    logger.debug({
        hasToken: !!options.tunnelToken,
        testConnectivity: options.testConnectivity
    }, 'Starting Cloudflare tunnel validation');

    const allIssues: ValidationIssue[] = [];

    // Validate token format
    const tokenIssues = validateTokenFormat(options.tunnelToken);
    allIssues.push(...tokenIssues);

    // Only test connectivity if requested and token is valid
    const hasErrors = tokenIssues.some(issue => issue.severity === 'error');
    if (options.testConnectivity && !hasErrors) {
        const connectivityIssues = await testConnectivity();
        allIssues.push(...connectivityIssues);
    }

    // Add success message if no errors
    if (allIssues.length === 0 || allIssues.every(issue => issue.severity === 'info')) {
        allIssues.push({
            code: 'CLOUDFLARE_VALIDATION_SUCCESS',
            severity: 'info',
            message: 'Cloudflare tunnel token format is valid',
            fixSuggestion: 'Token will be used to establish the Cloudflare tunnel'
        });
    }

    const passed = allIssues.every(issue => issue.severity !== 'error');
    const duration = Date.now() - startTime;

    logger.debug({
        passed,
        issueCount: allIssues.length,
        durationMs: duration
    }, 'Cloudflare tunnel validation complete');

    return {
        validator: 'cloudflare',
        passed,
        issues: allIssues,
        timestamp: new Date(),
        metadata: {
            hasToken: !!options.tunnelToken,
            testedConnectivity: options.testConnectivity,
            durationMs: duration
        }
    };
}
