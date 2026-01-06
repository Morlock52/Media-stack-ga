/**
 * Docker Environment Validator
 * Checks Docker daemon accessibility, version compatibility, and network configuration
 */

import { createLogger } from '../../utils/logger.js';
import { runCommand } from '../../utils/docker.js';
import type {
    ValidationResult,
    ValidationIssue,
    DockerValidationOptions
} from '../../types/validation.js';

const logger = createLogger('dockerValidator');

/**
 * Default minimum Docker version requirement
 */
const DEFAULT_MIN_VERSION = '20.10.0';

/**
 * Parse version string to comparable number array
 */
function parseVersion(version: string): number[] {
    const cleaned = version.replace(/[^0-9.]/g, '');
    return cleaned.split('.').map(v => parseInt(v, 10) || 0);
}

/**
 * Compare two version arrays
 * Returns: -1 if v1 < v2, 0 if equal, 1 if v1 > v2
 */
function compareVersions(v1: number[], v2: number[]): number {
    const maxLen = Math.max(v1.length, v2.length);
    for (let i = 0; i < maxLen; i++) {
        const a = v1[i] || 0;
        const b = v2[i] || 0;
        if (a < b) return -1;
        if (a > b) return 1;
    }
    return 0;
}

/**
 * Check if Docker daemon is accessible
 */
async function checkDockerDaemon(): Promise<ValidationIssue | null> {
    try {
        await runCommand('docker', ['info'], {
            timeoutMs: 10000,
            label: 'docker-info'
        });
        return null;
    } catch (error) {
        const errorMsg = (error as Error).message;

        if (errorMsg.includes('not found') || errorMsg.includes('ENOENT')) {
            return {
                code: 'DOCKER_NOT_INSTALLED',
                severity: 'error',
                message: 'Docker is not installed or not in PATH',
                fixSuggestion: 'Install Docker Desktop or Docker Engine from https://docs.docker.com/get-docker/',
                details: { error: errorMsg }
            };
        }

        if (errorMsg.includes('Cannot connect to the Docker daemon') || errorMsg.includes('daemon is not running')) {
            return {
                code: 'DOCKER_DAEMON_NOT_RUNNING',
                severity: 'error',
                message: 'Docker daemon is not running',
                fixSuggestion: 'Start Docker Desktop or run "sudo systemctl start docker" on Linux',
                details: { error: errorMsg }
            };
        }

        if (errorMsg.includes('permission denied')) {
            return {
                code: 'DOCKER_PERMISSION_DENIED',
                severity: 'error',
                message: 'Permission denied accessing Docker socket',
                fixSuggestion: 'Add your user to the docker group: "sudo usermod -aG docker $USER" and re-login, or run with sudo',
                details: { error: errorMsg }
            };
        }

        return {
            code: 'DOCKER_CHECK_FAILED',
            severity: 'error',
            message: 'Failed to communicate with Docker daemon',
            fixSuggestion: 'Ensure Docker is installed and running, and that you have permission to access the Docker socket',
            details: { error: errorMsg }
        };
    }
}

/**
 * Check Docker version compatibility
 */
async function checkDockerVersion(minVersion: string): Promise<ValidationIssue[]> {
    const issues: ValidationIssue[] = [];

    try {
        const output = await runCommand('docker', ['version', '--format', '{{.Server.Version}}'], {
            timeoutMs: 5000,
            label: 'docker-version'
        });

        const currentVersion = output.trim();
        const current = parseVersion(currentVersion);
        const minimum = parseVersion(minVersion);

        if (compareVersions(current, minimum) < 0) {
            issues.push({
                code: 'DOCKER_VERSION_TOO_OLD',
                severity: 'error',
                message: `Docker version ${currentVersion} is below minimum required version ${minVersion}`,
                fixSuggestion: `Update Docker to version ${minVersion} or higher. See https://docs.docker.com/engine/install/`,
                details: {
                    currentVersion,
                    minimumVersion: minVersion
                }
            });
        } else {
            logger.debug({ currentVersion, minVersion }, 'Docker version check passed');
        }
    } catch (error) {
        issues.push({
            code: 'DOCKER_VERSION_CHECK_FAILED',
            severity: 'warning',
            message: 'Could not determine Docker version',
            fixSuggestion: 'Ensure Docker is properly installed and accessible',
            details: { error: (error as Error).message }
        });
    }

    return issues;
}

/**
 * Check Docker Compose v2 availability
 */
async function checkDockerCompose(): Promise<ValidationIssue[]> {
    const issues: ValidationIssue[] = [];

    try {
        // Try Docker Compose v2 (docker compose) first
        await runCommand('docker', ['compose', 'version'], {
            timeoutMs: 5000,
            label: 'docker-compose-version'
        });

        logger.debug('Docker Compose v2 is available');
    } catch (error) {
        // Docker Compose v2 not available
        try {
            // Try legacy docker-compose
            await runCommand('docker-compose', ['version'], {
                timeoutMs: 5000,
                label: 'docker-compose-legacy-version'
            });

            issues.push({
                code: 'DOCKER_COMPOSE_V1_DETECTED',
                severity: 'warning',
                message: 'Using legacy docker-compose v1. Docker Compose v2 is recommended',
                fixSuggestion: 'Install Docker Compose v2 (bundled with Docker Desktop) or install docker-compose-plugin package',
                details: { error: (error as Error).message }
            });
        } catch (legacyError) {
            issues.push({
                code: 'DOCKER_COMPOSE_NOT_FOUND',
                severity: 'error',
                message: 'Docker Compose is not installed',
                fixSuggestion: 'Install Docker Compose v2 (bundled with Docker Desktop) or install docker-compose-plugin. See https://docs.docker.com/compose/install/',
                details: {
                    error: (legacyError as Error).message
                }
            });
        }
    }

    return issues;
}

/**
 * Check for Docker network conflicts
 */
async function checkDockerNetworks(networksToCheck?: string[]): Promise<ValidationIssue[]> {
    const issues: ValidationIssue[] = [];

    try {
        // Get existing Docker networks
        const output = await runCommand('docker', ['network', 'ls', '--format', '{{.Name}}\t{{.Driver}}\t{{.Scope}}'], {
            timeoutMs: 10000,
            label: 'docker-network-ls'
        });

        const existingNetworks = output.split('\n')
            .filter(Boolean)
            .map(line => {
                const [name, driver, scope] = line.split('\t');
                return { name, driver, scope };
            });

        // Check if we have too many networks (potential network exhaustion)
        if (existingNetworks.length > 50) {
            issues.push({
                code: 'DOCKER_NETWORK_COUNT_HIGH',
                severity: 'warning',
                message: `High number of Docker networks detected (${existingNetworks.length})`,
                fixSuggestion: 'Consider cleaning up unused networks with "docker network prune"',
                details: { networkCount: existingNetworks.length }
            });
        }

        // If specific networks were provided to check
        if (networksToCheck && networksToCheck.length > 0) {
            for (const networkName of networksToCheck) {
                const existing = existingNetworks.find(n => n.name === networkName);
                if (existing) {
                    // Get detailed network info to check for subnet conflicts
                    try {
                        const inspectOutput = await runCommand('docker', ['network', 'inspect', networkName], {
                            timeoutMs: 5000,
                            label: 'docker-network-inspect'
                        });

                        const networkInfo = JSON.parse(inspectOutput);
                        if (networkInfo && networkInfo.length > 0) {
                            const subnet = networkInfo[0]?.IPAM?.Config?.[0]?.Subnet;

                            issues.push({
                                code: 'DOCKER_NETWORK_EXISTS',
                                severity: 'info',
                                message: `Network "${networkName}" already exists${subnet ? ` with subnet ${subnet}` : ''}`,
                                fixSuggestion: 'This is usually fine. Docker Compose will reuse the existing network. If you encounter issues, remove it with "docker network rm ' + networkName + '" (ensure no containers are using it)',
                                details: {
                                    networkName,
                                    driver: existing.driver,
                                    subnet
                                }
                            });
                        }
                    } catch (inspectError) {
                        logger.warn({ networkName, error: inspectError }, 'Failed to inspect existing network');
                    }
                }
            }
        }

        // Check for bridge network IP range conflicts
        try {
            const bridgeNetworks = existingNetworks.filter(n => n.driver === 'bridge');

            // Get bridge network subnets to detect potential conflicts
            const subnets: Array<{ name: string; subnet: string }> = [];
            for (const network of bridgeNetworks) {
                try {
                    const inspectOutput = await runCommand('docker', ['network', 'inspect', network.name], {
                        timeoutMs: 5000,
                        label: 'docker-network-inspect-bridge'
                    });

                    const networkInfo = JSON.parse(inspectOutput);
                    if (networkInfo && networkInfo.length > 0) {
                        const subnet = networkInfo[0]?.IPAM?.Config?.[0]?.Subnet;
                        if (subnet) {
                            subnets.push({ name: network.name, subnet });
                        }
                    }
                } catch {
                    // Skip networks we can't inspect
                }
            }

            // Check for common VPN subnet conflicts (10.x.x.x ranges)
            const vpnSubnets = subnets.filter(s => s.subnet.startsWith('10.'));
            if (vpnSubnets.length > 0) {
                issues.push({
                    code: 'DOCKER_NETWORK_VPN_CONFLICT_POSSIBLE',
                    severity: 'info',
                    message: `Docker networks using 10.x.x.x ranges may conflict with VPN subnets`,
                    fixSuggestion: 'If you use a VPN, ensure Docker network ranges don\'t overlap with your VPN subnet. Configure custom subnets in docker-compose.yml if needed',
                    details: {
                        affectedNetworks: vpnSubnets.map(s => `${s.name} (${s.subnet})`)
                    }
                });
            }
        } catch (error) {
            logger.warn({ error }, 'Failed to check bridge network subnets');
        }
    } catch (error) {
        issues.push({
            code: 'DOCKER_NETWORK_CHECK_FAILED',
            severity: 'warning',
            message: 'Failed to check Docker networks',
            fixSuggestion: 'Ensure Docker daemon is running and accessible',
            details: { error: (error as Error).message }
        });
    }

    return issues;
}

/**
 * Validate Docker environment
 */
export async function validateDocker(options: DockerValidationOptions = {}): Promise<ValidationResult> {
    const startTime = Date.now();
    logger.debug({ options }, 'Starting Docker validation');

    const allIssues: ValidationIssue[] = [];

    // 1. Check Docker daemon accessibility (critical check)
    const daemonIssue = await checkDockerDaemon();
    if (daemonIssue) {
        allIssues.push(daemonIssue);

        // If daemon is not accessible, skip other checks
        const passed = false;
        const duration = Date.now() - startTime;

        logger.debug({
            passed,
            issueCount: allIssues.length,
            durationMs: duration
        }, 'Docker validation complete (daemon not accessible)');

        return {
            validator: 'docker',
            passed,
            issues: allIssues,
            timestamp: new Date(),
            metadata: {
                daemonAccessible: false,
                durationMs: duration
            }
        };
    }

    // Daemon is accessible, continue with other checks
    const minVersion = options.minVersion || DEFAULT_MIN_VERSION;

    // 2. Check Docker version
    const versionIssues = await checkDockerVersion(minVersion);
    allIssues.push(...versionIssues);

    // 3. Check Docker Compose availability (if required)
    if (options.requireComposeV2 !== false) {
        const composeIssues = await checkDockerCompose();
        allIssues.push(...composeIssues);
    }

    // 4. Check Docker networks
    const networkIssues = await checkDockerNetworks(options.networks);
    allIssues.push(...networkIssues);

    const passed = allIssues.every(issue => issue.severity !== 'error');
    const duration = Date.now() - startTime;

    logger.debug({
        passed,
        issueCount: allIssues.length,
        durationMs: duration
    }, 'Docker validation complete');

    return {
        validator: 'docker',
        passed,
        issues: allIssues,
        timestamp: new Date(),
        metadata: {
            daemonAccessible: true,
            minVersionRequired: minVersion,
            composeV2Required: options.requireComposeV2 !== false,
            durationMs: duration
        }
    };
}
