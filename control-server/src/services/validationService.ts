/**
 * Validation Service Orchestrator
 * Runs all validators and aggregates results
 */

import { createLogger } from '../utils/logger.js';
import { validatePaths } from './validators/pathValidator.js';
import { validatePorts } from './validators/portValidator.js';
import { validateVPN } from './validators/vpnValidator.js';
import { validateCloudflare } from './validators/cloudflareValidator.js';
import { validateDocker } from './validators/dockerValidator.js';
import type {
    ValidationResult,
    AggregatedValidationResult,
    ValidatorType,
    ValidationRequest,
    PathValidationOptions,
    PortValidationOptions,
    VpnValidationOptions,
    CloudflareValidationOptions,
    DockerValidationOptions
} from '../types/validation.js';

const logger = createLogger('validationService');

/**
 * Cache entry for validation results
 */
interface CacheEntry {
    result: AggregatedValidationResult;
    timestamp: number;
}

/**
 * Cache for validation results (5 minute TTL)
 */
const CACHE_TTL_MS = 5 * 60 * 1000;
const validationCache = new Map<string, CacheEntry>();

/**
 * Generate cache key from validation request
 */
function getCacheKey(request: ValidationRequest): string {
    const validatorList = request.validators?.sort().join(',') || 'all';
    const configHash = JSON.stringify(request.config);
    return `${validatorList}:${configHash}`;
}

/**
 * Get cached validation result if available and not expired
 */
function getCachedResult(request: ValidationRequest): AggregatedValidationResult | null {
    const key = getCacheKey(request);
    const entry = validationCache.get(key);

    if (!entry) {
        return null;
    }

    const age = Date.now() - entry.timestamp;
    if (age > CACHE_TTL_MS) {
        validationCache.delete(key);
        return null;
    }

    logger.debug({ key, ageMs: age }, 'Using cached validation result');
    return entry.result;
}

/**
 * Store validation result in cache
 */
function setCachedResult(request: ValidationRequest, result: AggregatedValidationResult): void {
    const key = getCacheKey(request);
    validationCache.set(key, {
        result,
        timestamp: Date.now()
    });

    // Clean up old cache entries
    for (const [cacheKey, entry] of validationCache.entries()) {
        const age = Date.now() - entry.timestamp;
        if (age > CACHE_TTL_MS) {
            validationCache.delete(cacheKey);
        }
    }
}

/**
 * Clear validation cache
 */
export function clearValidationCache(): void {
    validationCache.clear();
    logger.debug('Validation cache cleared');
}

/**
 * Run a single validator with timeout and error handling
 */
async function runValidator(
    type: ValidatorType,
    validatorFn: () => Promise<ValidationResult>,
    timeout?: number
): Promise<ValidationResult> {
    try {
        if (timeout && timeout > 0) {
            const timeoutPromise = new Promise<never>((_, reject) => {
                setTimeout(() => reject(new Error('Validation timeout')), timeout);
            });

            return await Promise.race([validatorFn(), timeoutPromise]);
        }

        return await validatorFn();
    } catch (error) {
        logger.error({ type, error: (error as Error).message }, 'Validator failed');

        // Return error result
        return {
            validator: type,
            passed: false,
            issues: [{
                code: 'VALIDATOR_FAILED',
                severity: 'error',
                message: `Validator "${type}" failed to execute`,
                fixSuggestion: 'Check logs for details and ensure all dependencies are available',
                details: {
                    error: (error as Error).message
                }
            }],
            timestamp: new Date(),
            metadata: {
                failed: true,
                error: (error as Error).message
            }
        };
    }
}

/**
 * Build validator functions from configuration
 */
function buildValidatorTasks(
    request: ValidationRequest
): Array<{ type: ValidatorType; fn: () => Promise<ValidationResult>; timeout?: number }> {
    const tasks: Array<{ type: ValidatorType; fn: () => Promise<ValidationResult>; timeout?: number }> = [];
    const config = request.config;
    const validatorConfigs = request.validatorConfigs || {};

    // Determine which validators to run
    const validatorsToRun = request.validators || ['path', 'port', 'vpn', 'cloudflare', 'docker'];

    for (const validatorType of validatorsToRun) {
        const validatorConfig = validatorConfigs[validatorType];

        // Skip disabled validators
        if (validatorConfig?.enabled === false) {
            continue;
        }

        const timeout = validatorConfig?.timeout;

        switch (validatorType) {
            case 'path': {
                const options: PathValidationOptions = {
                    paths: {
                        dataRoot: config.dataRoot as string,
                        configRoot: config.configRoot as string,
                        ...(config.paths as Record<string, string>)
                    },
                    checkWrite: validatorConfig?.options?.checkWrite as boolean | undefined
                };

                tasks.push({
                    type: 'path',
                    fn: () => validatePaths(options),
                    timeout
                });
                break;
            }

            case 'port': {
                const options: PortValidationOptions = {
                    ports: (config.ports as number[]) || [],
                    servicePortMap: config.servicePortMap as Record<string, number[]> | undefined
                };

                tasks.push({
                    type: 'port',
                    fn: () => validatePorts(options),
                    timeout
                });
                break;
            }

            case 'vpn': {
                if (config.vpn) {
                    const vpnConfig = config.vpn as Record<string, unknown>;
                    const options: VpnValidationOptions = {
                        provider: vpnConfig.provider as string | undefined,
                        type: (vpnConfig.type as 'wireguard' | 'openvpn') || 'wireguard',
                        credentials: vpnConfig.credentials as VpnValidationOptions['credentials']
                    };

                    tasks.push({
                        type: 'vpn',
                        fn: () => validateVPN(options),
                        timeout
                    });
                }
                break;
            }

            case 'cloudflare': {
                if (config.cloudflare) {
                    const cfConfig = config.cloudflare as Record<string, unknown>;
                    const options: CloudflareValidationOptions = {
                        tunnelToken: cfConfig.tunnelToken as string | undefined,
                        testConnectivity: validatorConfig?.options?.testConnectivity as boolean | undefined
                    };

                    tasks.push({
                        type: 'cloudflare',
                        fn: () => validateCloudflare(options),
                        timeout
                    });
                }
                break;
            }

            case 'docker': {
                const options: DockerValidationOptions = {
                    minVersion: (config.dockerMinVersion as string) || validatorConfig?.options?.minVersion as string | undefined,
                    requireComposeV2: validatorConfig?.options?.requireComposeV2 as boolean | undefined,
                    networks: config.networks as string[] | undefined
                };

                tasks.push({
                    type: 'docker',
                    fn: () => validateDocker(options),
                    timeout
                });
                break;
            }
        }
    }

    return tasks;
}

/**
 * Aggregate validation results with proper priority ordering
 */
function aggregateResults(results: ValidationResult[]): AggregatedValidationResult {
    const startedAt = new Date(Math.min(...results.map(r => r.timestamp.getTime())));
    const completedAt = new Date();
    const durationMs = completedAt.getTime() - startedAt.getTime();

    let errorCount = 0;
    let warningCount = 0;
    let infoCount = 0;

    for (const result of results) {
        for (const issue of result.issues) {
            switch (issue.severity) {
                case 'error':
                    errorCount++;
                    break;
                case 'warning':
                    warningCount++;
                    break;
                case 'info':
                    infoCount++;
                    break;
            }
        }
    }

    const passed = errorCount === 0;

    // Sort results by priority: failed validators first, then by validator type
    const validatorPriority: Record<ValidatorType, number> = {
        docker: 1,      // Check Docker first (critical infrastructure)
        path: 2,        // Then paths (required for all services)
        port: 3,        // Then ports (affects deployment)
        vpn: 4,         // VPN configuration
        cloudflare: 5,  // Cloudflare tunnel
        environment: 6  // General environment
    };

    const sortedResults = [...results].sort((a, b) => {
        // Failed validators first
        if (!a.passed && b.passed) return -1;
        if (a.passed && !b.passed) return 1;

        // Then by priority
        const priorityA = validatorPriority[a.validator] || 99;
        const priorityB = validatorPriority[b.validator] || 99;
        return priorityA - priorityB;
    });

    return {
        passed,
        errorCount,
        warningCount,
        infoCount,
        results: sortedResults,
        startedAt,
        completedAt,
        durationMs
    };
}

/**
 * Run validation on configuration
 * Runs all enabled validators in parallel and aggregates results
 */
export async function validateConfiguration(
    request: ValidationRequest,
    useCache = true
): Promise<AggregatedValidationResult> {
    const startTime = Date.now();
    logger.info({
        validators: request.validators || 'all',
        useCache
    }, 'Starting configuration validation');

    // Check cache first
    if (useCache) {
        const cachedResult = getCachedResult(request);
        if (cachedResult) {
            return cachedResult;
        }
    }

    // Build validator tasks
    const tasks = buildValidatorTasks(request);

    if (tasks.length === 0) {
        logger.warn('No validators configured or all validators disabled');
        return {
            passed: true,
            errorCount: 0,
            warningCount: 0,
            infoCount: 0,
            results: [],
            startedAt: new Date(),
            completedAt: new Date(),
            durationMs: 0
        };
    }

    logger.debug({ validatorCount: tasks.length }, 'Running validators in parallel');

    // Run all validators in parallel
    const results = await Promise.all(
        tasks.map(task => runValidator(task.type, task.fn, task.timeout))
    );

    // Aggregate results
    const aggregated = aggregateResults(results);

    const duration = Date.now() - startTime;
    logger.info({
        passed: aggregated.passed,
        errorCount: aggregated.errorCount,
        warningCount: aggregated.warningCount,
        infoCount: aggregated.infoCount,
        validatorCount: results.length,
        durationMs: duration
    }, 'Configuration validation complete');

    // Cache result
    if (useCache) {
        setCachedResult(request, aggregated);
    }

    return aggregated;
}

/**
 * Run specific validators on demand
 */
export async function runSpecificValidators(
    validatorTypes: ValidatorType[],
    config: Record<string, unknown>
): Promise<AggregatedValidationResult> {
    return validateConfiguration({
        config,
        validators: validatorTypes
    }, false); // Don't use cache for on-demand validation
}

/**
 * Quick validation check (essential validators only)
 * Runs Docker and path validators with short timeouts
 */
export async function quickValidation(
    config: Record<string, unknown>
): Promise<AggregatedValidationResult> {
    logger.debug('Running quick validation (Docker + paths)');

    return validateConfiguration({
        config,
        validators: ['docker', 'path'],
        validatorConfigs: {
            docker: {
                enabled: true,
                timeout: 5000 // 5 second timeout
            },
            path: {
                enabled: true,
                timeout: 3000 // 3 second timeout
            }
        }
    }, false); // Don't use cache for quick checks
}
