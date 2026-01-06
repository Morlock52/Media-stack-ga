/**
 * Validation Type Definitions for Frontend
 * Mirrors backend validation types with JSON serialization handling
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
 * Result from a single validator (JSON-serialized from backend)
 */
export interface ValidationResult {
    /** Type of validator that produced this result */
    validator: ValidatorType;
    /** Whether the validation passed */
    passed: boolean;
    /** List of issues found (empty if passed) */
    issues: ValidationIssue[];
    /** Timestamp when validation was performed (ISO string) */
    timestamp: string;
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
 * Aggregated validation results from all validators (JSON-serialized from backend)
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
    /** Timestamp when validation started (ISO string) */
    startedAt: string;
    /** Timestamp when validation completed (ISO string) */
    completedAt: string;
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

// =============================================================================
// UI-Specific Helper Types
// =============================================================================

/**
 * UI state for validation
 */
export interface ValidationState {
    /** Current validation results */
    result: AggregatedValidationResult | null;
    /** Whether validation is in progress */
    isValidating: boolean;
    /** Error message if validation request failed */
    error: string | null;
    /** Timestamp of last validation (ISO string) */
    lastValidatedAt: string | null;
}

/**
 * Validation issue grouped by severity
 */
export interface GroupedValidationIssues {
    errors: ValidationIssue[];
    warnings: ValidationIssue[];
    info: ValidationIssue[];
}

/**
 * Helper to check if validation has blocking errors
 */
export function hasBlockingErrors(result: AggregatedValidationResult | null): boolean {
    return (result?.errorCount ?? 0) > 0;
}

/**
 * Helper to group issues by severity
 */
export function groupIssuesBySeverity(result: AggregatedValidationResult | null): GroupedValidationIssues {
    const grouped: GroupedValidationIssues = {
        errors: [],
        warnings: [],
        info: [],
    };

    if (!result) {
        return grouped;
    }

    for (const validatorResult of result.results) {
        for (const issue of validatorResult.issues) {
            switch (issue.severity) {
                case 'error':
                    grouped.errors.push(issue);
                    break;
                case 'warning':
                    grouped.warnings.push(issue);
                    break;
                case 'info':
                    grouped.info.push(issue);
                    break;
            }
        }
    }

    return grouped;
}

/**
 * Helper to get all issues as a flat array
 */
export function getAllIssues(result: AggregatedValidationResult | null): ValidationIssue[] {
    if (!result) {
        return [];
    }

    return result.results.flatMap((r) => r.issues);
}

/**
 * Helper to get issues for a specific validator
 */
export function getIssuesForValidator(
    result: AggregatedValidationResult | null,
    validatorType: ValidatorType
): ValidationIssue[] {
    if (!result) {
        return [];
    }

    const validatorResult = result.results.find((r) => r.validator === validatorType);
    return validatorResult?.issues ?? [];
}

/**
 * Helper to check if a specific validator passed
 */
export function didValidatorPass(
    result: AggregatedValidationResult | null,
    validatorType: ValidatorType
): boolean {
    if (!result) {
        return false;
    }

    const validatorResult = result.results.find((r) => r.validator === validatorType);
    return validatorResult?.passed ?? false;
}

/**
 * Helper to get a summary message for display
 */
export function getValidationSummary(result: AggregatedValidationResult | null): string {
    if (!result) {
        return 'No validation results';
    }

    if (result.passed) {
        return 'All validations passed';
    }

    const parts: string[] = [];
    if (result.errorCount > 0) {
        parts.push(`${result.errorCount} error${result.errorCount !== 1 ? 's' : ''}`);
    }
    if (result.warningCount > 0) {
        parts.push(`${result.warningCount} warning${result.warningCount !== 1 ? 's' : ''}`);
    }
    if (result.infoCount > 0) {
        parts.push(`${result.infoCount} info message${result.infoCount !== 1 ? 's' : ''}`);
    }

    return parts.join(', ');
}

/**
 * Helper to get severity color class for UI styling
 */
export function getSeverityColorClass(severity: ValidationSeverity): string {
    switch (severity) {
        case 'error':
            return 'text-red-500';
        case 'warning':
            return 'text-yellow-500';
        case 'info':
            return 'text-blue-500';
    }
}

/**
 * Helper to get severity icon for UI display
 */
export function getSeverityIcon(severity: ValidationSeverity): string {
    switch (severity) {
        case 'error':
            return '✕';
        case 'warning':
            return '⚠';
        case 'info':
            return 'ℹ';
    }
}
