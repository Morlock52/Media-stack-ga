/**
 * Validation Type Definitions
 * Used for configuration validation across the Media Stack
 */

/**
 * Severity levels for validation issues
 */
export type ValidationSeverity = 'error' | 'warning' | 'info';

/**
 * Types of validators available
 */
export type ValidatorType =
    | 'path'
    | 'port'
    | 'vpn'
    | 'cloudflare'
    | 'docker'
    | 'environment';

/**
 * Individual validation issue with context and fix suggestion
 */
export interface ValidationIssue {
    /** Unique identifier for the issue type */
    code: string;
    /** Severity of the issue */
    severity: ValidationSeverity;
    /** Human-readable message describing the issue */
    message: string;
    /** Field or configuration key affected by this issue */
    affectedField?: string;
    /** Suggested fix or remediation steps */
    fixSuggestion?: string;
    /** Additional context or details */
    details?: Record<string, unknown>;
}

/**
 * Result from a single validator
 */
export interface ValidationResult {
    /** Type of validator that produced this result */
    validator: ValidatorType;
    /** Whether the validation passed */
    passed: boolean;
    /** List of issues found (empty if passed) */
    issues: ValidationIssue[];
    /** Timestamp when validation was performed */
    timestamp: Date;
    /** Optional metadata from the validator */
    metadata?: Record<string, unknown>;
}

/**
 * Configuration for a validator
 */
export interface ValidatorConfig {
    /** Whether this validator is enabled */
    enabled: boolean;
    /** Timeout in milliseconds (0 = no timeout) */
    timeout?: number;
    /** Validator-specific options */
    options?: Record<string, unknown>;
}

/**
 * Aggregated validation results from all validators
 */
export interface AggregatedValidationResult {
    /** Overall validation status */
    passed: boolean;
    /** Total number of errors */
    errorCount: number;
    /** Total number of warnings */
    warningCount: number;
    /** Total number of info messages */
    infoCount: number;
    /** Individual validator results */
    results: ValidationResult[];
    /** Timestamp when validation started */
    startedAt: Date;
    /** Timestamp when validation completed */
    completedAt: Date;
    /** Total duration in milliseconds */
    durationMs: number;
}

/**
 * Request payload for validation endpoints
 */
export interface ValidationRequest {
    /** Configuration data to validate */
    config: Record<string, unknown>;
    /** Specific validators to run (empty = all) */
    validators?: ValidatorType[];
    /** Validator configurations */
    validatorConfigs?: Partial<Record<ValidatorType, ValidatorConfig>>;
}

/**
 * Path validation specific types
 */
export interface PathValidationOptions {
    /** Paths to validate */
    paths: {
        dataRoot?: string;
        configRoot?: string;
        [key: string]: string | undefined;
    };
    /** Whether to check write permissions */
    checkWrite?: boolean;
}

/**
 * Port validation specific types
 */
export interface PortValidationOptions {
    /** Ports to check for conflicts */
    ports: number[];
    /** Service names mapped to ports */
    servicePortMap?: Record<string, number[]>;
}

/**
 * VPN validation specific types
 */
export interface VpnValidationOptions {
    /** VPN provider (e.g., 'nordvpn', 'pia') */
    provider?: string;
    /** VPN type */
    type: 'wireguard' | 'openvpn';
    /** Credentials to validate */
    credentials: {
        // WireGuard fields
        privateKey?: string;
        publicKey?: string;
        presharedKey?: string;
        addresses?: string;
        endpointIp?: string;
        endpointPort?: string | number;
        // OpenVPN fields
        username?: string;
        password?: string;
        [key: string]: string | number | undefined;
    };
}

/**
 * Cloudflare validation specific types
 */
export interface CloudflareValidationOptions {
    /** Tunnel token to validate */
    tunnelToken?: string;
    /** Whether to test connectivity */
    testConnectivity?: boolean;
}

/**
 * Docker validation specific types
 */
export interface DockerValidationOptions {
    /** Minimum required Docker version */
    minVersion?: string;
    /** Whether to check for Docker Compose v2 */
    requireComposeV2?: boolean;
    /** Networks to check for conflicts */
    networks?: string[];
}
