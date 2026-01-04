/**
 * Orchestrator Tools - Extended capabilities for full app control
 *
 * These tools give the orchestrator agent direct control over:
 * - Docker container lifecycle (start, stop, pull, compose)
 * - Configuration management (.env, docker-compose.yml)
 * - Stack deployment and management
 * - System resources and diagnostics
 * - Service dependencies and ordering
 */

import { runCommand } from '../utils/docker.js';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { PROJECT_ROOT, getEnvValue, setEnvValue } from '../utils/env.js';
import { createLogger } from '../utils/logger.js';
import { getErrorMessage } from '../utils/errors.js';
import type { ToolResult } from './agentTools.js';

const logger = createLogger('orchestratorTools');

// Service dependency map for ordered startup/shutdown
const SERVICE_DEPENDENCIES: Record<string, string[]> = {
    sonarr: ['prowlarr'],
    radarr: ['prowlarr'],
    lidarr: ['prowlarr'],
    readarr: ['prowlarr'],
    bazarr: ['sonarr', 'radarr'],
    overseerr: ['plex', 'sonarr', 'radarr'],
    jellyseerr: ['jellyfin', 'sonarr', 'radarr'],
    tautulli: ['plex'],
    qbittorrent: ['gluetun'],
    transmission: ['gluetun'],
    deluge: ['gluetun'],
    sabnzbd: ['gluetun'],
    nzbget: ['gluetun'],
};

// Service categories for group operations
const SERVICE_CATEGORIES: Record<string, string[]> = {
    media: ['plex', 'jellyfin', 'emby'],
    indexer: ['prowlarr'],
    pvr: ['sonarr', 'radarr', 'lidarr', 'readarr', 'whisparr'],
    subtitle: ['bazarr'],
    request: ['overseerr', 'jellyseerr', 'ombi'],
    download: ['qbittorrent', 'transmission', 'deluge', 'sabnzbd', 'nzbget'],
    vpn: ['gluetun'],
    monitoring: ['tautulli', 'homepage', 'homarr'],
    network: ['traefik', 'cloudflared', 'authelia'],
    utility: ['recyclarr', 'unpackerr', 'flaresolverr', 'autobrr'],
};

/**
 * Start a Docker container
 */
export async function startContainer(containerName: string): Promise<ToolResult> {
    try {
        logger.info({ container: containerName }, 'Starting container');
        await runCommand('docker', ['start', containerName], { timeoutMs: 30000 });

        // Wait a moment and check status
        await new Promise(resolve => setTimeout(resolve, 2000));
        const status = await runCommand('docker', ['inspect', '-f', '{{.State.Running}}', containerName], { timeoutMs: 5000 });

        return {
            success: status.trim() === 'true',
            data: {
                container: containerName,
                action: 'start',
                running: status.trim() === 'true'
            }
        };
    } catch (err) {
        logger.error({ err, container: containerName }, 'Failed to start container');
        return { success: false, error: getErrorMessage(err) };
    }
}

/**
 * Stop a Docker container
 */
export async function stopContainer(containerName: string, force: boolean = false): Promise<ToolResult> {
    try {
        logger.info({ container: containerName, force }, 'Stopping container');
        const cmd = force ? 'kill' : 'stop';
        await runCommand('docker', [cmd, containerName], { timeoutMs: 60000 });

        return {
            success: true,
            data: { container: containerName, action: 'stop', force }
        };
    } catch (err) {
        logger.error({ err, container: containerName }, 'Failed to stop container');
        return { success: false, error: getErrorMessage(err) };
    }
}

/**
 * Pull latest image for a container
 */
export async function pullImage(imageName: string): Promise<ToolResult> {
    try {
        logger.info({ image: imageName }, 'Pulling image');
        const output = await runCommand('docker', ['pull', imageName], { timeoutMs: 300000 }); // 5 min timeout

        const upToDate = output.includes('Image is up to date') || output.includes('Status: Image is up to date');
        const downloaded = output.includes('Downloaded newer image') || output.includes('Pull complete');

        return {
            success: true,
            data: {
                image: imageName,
                updated: downloaded,
                upToDate: upToDate,
                output: output.slice(0, 500)
            }
        };
    } catch (err) {
        logger.error({ err, image: imageName }, 'Failed to pull image');
        return { success: false, error: getErrorMessage(err) };
    }
}

/**
 * Run docker-compose command
 */
export async function dockerCompose(
    action: 'up' | 'down' | 'restart' | 'pull' | 'logs' | 'ps',
    options: {
        services?: string[];
        detach?: boolean;
        follow?: boolean;
        tail?: number;
        composeFile?: string;
    } = {}
): Promise<ToolResult> {
    const { services = [], detach = true, follow = false, tail = 100, composeFile } = options;

    try {
        const args: string[] = ['compose'];

        if (composeFile) {
            args.push('-f', composeFile);
        }

        args.push(action);

        if (action === 'up' && detach) {
            args.push('-d');
        }

        if (action === 'logs') {
            if (!follow) args.push('--no-follow');
            args.push('--tail', tail.toString());
        }

        if (services.length > 0) {
            args.push(...services);
        }

        logger.info({ action, services, args }, 'Running docker-compose');
        const output = await runCommand('docker', args, {
            timeoutMs: action === 'pull' ? 600000 : 120000,
            cwd: PROJECT_ROOT
        });

        return {
            success: true,
            data: { action, services, output: output.slice(0, 2000) }
        };
    } catch (err) {
        logger.error({ err, action, services }, 'docker-compose failed');
        return { success: false, error: getErrorMessage(err) };
    }
}

/**
 * Get or set environment variable
 */
export async function manageEnvVar(
    action: 'get' | 'set' | 'list' | 'delete',
    key?: string,
    value?: string
): Promise<ToolResult> {
    try {
        if (action === 'get' && key) {
            const val = getEnvValue(key);
            return { success: true, data: { key, value: val, exists: val !== undefined } };
        }

        if (action === 'set' && key && value !== undefined) {
            setEnvValue(key, value);
            logger.info({ key }, 'Set environment variable');
            return { success: true, data: { key, action: 'set' } };
        }

        if (action === 'list') {
            const envPath = join(PROJECT_ROOT, '.env');
            try {
                const content = await readFile(envPath, 'utf-8');
                const vars: Record<string, string> = {};
                for (const line of content.split('\n')) {
                    const trimmed = line.trim();
                    if (!trimmed || trimmed.startsWith('#')) continue;
                    const eqIndex = trimmed.indexOf('=');
                    if (eqIndex > 0) {
                        const k = trimmed.slice(0, eqIndex).trim();
                        // Mask sensitive values
                        const v = trimmed.slice(eqIndex + 1).trim();
                        vars[k] = k.includes('KEY') || k.includes('SECRET') || k.includes('PASSWORD') || k.includes('TOKEN')
                            ? '***MASKED***'
                            : v;
                    }
                }
                return { success: true, data: { variables: vars, count: Object.keys(vars).length } };
            } catch {
                return { success: false, error: '.env file not found' };
            }
        }

        if (action === 'delete' && key) {
            setEnvValue(key, '');
            logger.info({ key }, 'Deleted environment variable');
            return { success: true, data: { key, action: 'delete' } };
        }

        return { success: false, error: 'Invalid action or missing parameters' };
    } catch (err) {
        logger.error({ err, action, key }, 'manageEnvVar failed');
        return { success: false, error: getErrorMessage(err) };
    }
}

/**
 * Start a category of services in dependency order
 */
export async function startServiceCategory(category: string): Promise<ToolResult> {
    const services = SERVICE_CATEGORIES[category];
    if (!services) {
        return { success: false, error: `Unknown category: ${category}. Valid: ${Object.keys(SERVICE_CATEGORIES).join(', ')}` };
    }

    logger.info({ category, services }, 'Starting service category');

    const results: Array<{ service: string; success: boolean; error?: string }> = [];

    // Sort by dependencies
    const sorted = topologicalSort(services);

    for (const service of sorted) {
        try {
            // Check if container exists
            const containers = await runCommand('docker', ['ps', '-a', '--filter', `name=${service}`, '--format', '{{.Names}}'], { timeoutMs: 5000 });
            const matching = containers.split('\n').filter(n => n.includes(service));

            if (matching.length === 0) {
                results.push({ service, success: false, error: 'Container not found' });
                continue;
            }

            const containerName = matching[0];
            await runCommand('docker', ['start', containerName], { timeoutMs: 30000 });
            results.push({ service, success: true });

            // Small delay between starts
            await new Promise(resolve => setTimeout(resolve, 1000));
        } catch (err) {
            results.push({ service, success: false, error: getErrorMessage(err) });
        }
    }

    const successCount = results.filter(r => r.success).length;
    return {
        success: successCount > 0,
        data: {
            category,
            results,
            summary: { started: successCount, failed: results.length - successCount }
        }
    };
}

/**
 * Stop a category of services in reverse dependency order
 */
export async function stopServiceCategory(category: string, force: boolean = false): Promise<ToolResult> {
    const services = SERVICE_CATEGORIES[category];
    if (!services) {
        return { success: false, error: `Unknown category: ${category}` };
    }

    logger.info({ category, services, force }, 'Stopping service category');

    const results: Array<{ service: string; success: boolean; error?: string }> = [];

    // Reverse dependency order for stopping
    const sorted = topologicalSort(services).reverse();

    for (const service of sorted) {
        try {
            const containers = await runCommand('docker', ['ps', '--filter', `name=${service}`, '--format', '{{.Names}}'], { timeoutMs: 5000 });
            const matching = containers.split('\n').filter(n => n.includes(service));

            if (matching.length === 0) {
                results.push({ service, success: true, error: 'Not running' });
                continue;
            }

            const containerName = matching[0];
            const cmd = force ? 'kill' : 'stop';
            await runCommand('docker', [cmd, containerName], { timeoutMs: 30000 });
            results.push({ service, success: true });
        } catch (err) {
            results.push({ service, success: false, error: getErrorMessage(err) });
        }
    }

    const successCount = results.filter(r => r.success).length;
    return {
        success: true,
        data: {
            category,
            results,
            summary: { stopped: successCount, failed: results.filter(r => !r.success && !r.error?.includes('Not running')).length }
        }
    };
}

/**
 * Deploy full media stack
 */
export async function deployStack(options: {
    services?: string[];
    pull?: boolean;
    recreate?: boolean;
} = {}): Promise<ToolResult> {
    const { services, pull = true, recreate = false } = options;

    logger.info({ services, pull, recreate }, 'Deploying stack');

    const steps: Array<{ step: string; success: boolean; message?: string }> = [];

    try {
        // Step 1: Pull images if requested
        if (pull) {
            const pullResult = await dockerCompose('pull', { services });
            steps.push({ step: 'pull', success: pullResult.success, message: pullResult.error });
        }

        // Step 2: Bring up services
        const args: string[] = ['compose', 'up', '-d'];
        if (recreate) {
            args.push('--force-recreate');
        }
        if (services && services.length > 0) {
            args.push(...services);
        }

        await runCommand('docker', args, { timeoutMs: 300000, cwd: PROJECT_ROOT });
        steps.push({ step: 'up', success: true });

        // Step 3: Wait for health
        await new Promise(resolve => setTimeout(resolve, 5000));

        // Step 4: Check status
        const statusOutput = await runCommand('docker', ['compose', 'ps', '--format', 'json'], { timeoutMs: 10000, cwd: PROJECT_ROOT });
        let running = 0;
        try {
            const containers = statusOutput.split('\n').filter(Boolean).map(line => JSON.parse(line));
            running = containers.filter((c: { State: string }) => c.State === 'running').length;
        } catch {
            // Fallback count
            const psOutput = await runCommand('docker', ['compose', 'ps'], { timeoutMs: 10000, cwd: PROJECT_ROOT });
            running = (psOutput.match(/Up/g) || []).length;
        }

        steps.push({ step: 'verify', success: running > 0, message: `${running} containers running` });

        return {
            success: steps.every(s => s.success),
            data: { steps, containersRunning: running }
        };
    } catch (err) {
        logger.error({ err }, 'deployStack failed');
        return { success: false, error: getErrorMessage(err), data: { steps } };
    }
}

/**
 * Get system resource usage
 */
export async function getSystemResources(): Promise<ToolResult> {
    try {
        const results: Record<string, unknown> = {};

        // Disk usage
        try {
            const dfOutput = await runCommand('df', ['-h', PROJECT_ROOT], { timeoutMs: 5000 });
            const lines = dfOutput.split('\n').filter(Boolean);
            if (lines.length > 1) {
                const parts = lines[1].split(/\s+/);
                results.disk = {
                    total: parts[1],
                    used: parts[2],
                    available: parts[3],
                    usePercent: parts[4]
                };
            }
        } catch { /* ignore */ }

        // Docker disk usage
        try {
            const dockerDf = await runCommand('docker', ['system', 'df', '--format', '{{.Type}}\t{{.Size}}\t{{.Reclaimable}}'], { timeoutMs: 10000 });
            const dockerUsage: Record<string, { size: string; reclaimable: string }> = {};
            for (const line of dockerDf.split('\n').filter(Boolean)) {
                const [type, size, reclaimable] = line.split('\t');
                dockerUsage[type.toLowerCase()] = { size, reclaimable };
            }
            results.docker = dockerUsage;
        } catch { /* ignore */ }

        // Memory (macOS/Linux)
        try {
            if (process.platform === 'darwin') {
                const vmStat = await runCommand('vm_stat', [], { timeoutMs: 5000 });
                const pageSize = 16384; // Default page size
                const freeMatch = vmStat.match(/Pages free:\s+(\d+)/);
                const activeMatch = vmStat.match(/Pages active:\s+(\d+)/);
                if (freeMatch && activeMatch) {
                    const freeGB = (parseInt(freeMatch[1]) * pageSize / 1024 / 1024 / 1024).toFixed(1);
                    const activeGB = (parseInt(activeMatch[1]) * pageSize / 1024 / 1024 / 1024).toFixed(1);
                    results.memory = { freeGB, activeGB };
                }
            } else {
                const memInfo = await runCommand('free', ['-h'], { timeoutMs: 5000 });
                const memLine = memInfo.split('\n')[1];
                if (memLine) {
                    const parts = memLine.split(/\s+/);
                    results.memory = { total: parts[1], used: parts[2], free: parts[3], available: parts[6] };
                }
            }
        } catch { /* ignore */ }

        return { success: true, data: results };
    } catch (err) {
        logger.error({ err }, 'getSystemResources failed');
        return { success: false, error: getErrorMessage(err) };
    }
}

/**
 * Clean up Docker resources
 */
export async function cleanupDocker(options: {
    containers?: boolean;
    images?: boolean;
    volumes?: boolean;
    networks?: boolean;
    all?: boolean;
} = {}): Promise<ToolResult> {
    const { containers = false, images = false, volumes = false, networks = false, all = false } = options;

    const results: Array<{ type: string; success: boolean; output?: string }> = [];

    try {
        if (all || containers) {
            try {
                const output = await runCommand('docker', ['container', 'prune', '-f'], { timeoutMs: 30000 });
                results.push({ type: 'containers', success: true, output: output.slice(0, 200) });
            } catch (err) {
                results.push({ type: 'containers', success: false, output: getErrorMessage(err) });
            }
        }

        if (all || images) {
            try {
                const output = await runCommand('docker', ['image', 'prune', '-f'], { timeoutMs: 60000 });
                results.push({ type: 'images', success: true, output: output.slice(0, 200) });
            } catch (err) {
                results.push({ type: 'images', success: false, output: getErrorMessage(err) });
            }
        }

        if (all || volumes) {
            try {
                const output = await runCommand('docker', ['volume', 'prune', '-f'], { timeoutMs: 30000 });
                results.push({ type: 'volumes', success: true, output: output.slice(0, 200) });
            } catch (err) {
                results.push({ type: 'volumes', success: false, output: getErrorMessage(err) });
            }
        }

        if (all || networks) {
            try {
                const output = await runCommand('docker', ['network', 'prune', '-f'], { timeoutMs: 30000 });
                results.push({ type: 'networks', success: true, output: output.slice(0, 200) });
            } catch (err) {
                results.push({ type: 'networks', success: false, output: getErrorMessage(err) });
            }
        }

        return {
            success: results.every(r => r.success),
            data: { results }
        };
    } catch (err) {
        logger.error({ err }, 'cleanupDocker failed');
        return { success: false, error: getErrorMessage(err) };
    }
}

/**
 * Check and report service dependencies
 */
export async function checkDependencies(service: string): Promise<ToolResult> {
    const deps = SERVICE_DEPENDENCIES[service] || [];

    if (deps.length === 0) {
        return { success: true, data: { service, dependencies: [], message: 'No dependencies' } };
    }

    const results: Array<{ dependency: string; running: boolean; healthy: boolean }> = [];

    for (const dep of deps) {
        try {
            const output = await runCommand('docker', ['ps', '--filter', `name=${dep}`, '--format', '{{.Names}}\t{{.Status}}'], { timeoutMs: 5000 });
            const lines = output.split('\n').filter(l => l.includes(dep));

            if (lines.length === 0) {
                results.push({ dependency: dep, running: false, healthy: false });
            } else {
                const status = lines[0].split('\t')[1] || '';
                const running = status.toLowerCase().includes('up');
                const healthy = !status.toLowerCase().includes('unhealthy');
                results.push({ dependency: dep, running, healthy });
            }
        } catch {
            results.push({ dependency: dep, running: false, healthy: false });
        }
    }

    const allRunning = results.every(r => r.running);
    const allHealthy = results.every(r => r.healthy);

    return {
        success: allRunning,
        data: {
            service,
            dependencies: results,
            allRunning,
            allHealthy,
            canStart: allRunning && allHealthy
        }
    };
}

/**
 * Execute container command
 */
export async function execInContainer(
    containerName: string,
    command: string[],
    options: { timeout?: number; workdir?: string } = {}
): Promise<ToolResult> {
    const { timeout = 30000, workdir } = options;

    // Security: block dangerous commands
    const dangerous = ['rm -rf', 'mkfs', 'dd if=', ':(){', 'chmod 777', 'curl | sh', 'wget | sh'];
    const cmdStr = command.join(' ');
    if (dangerous.some(d => cmdStr.includes(d))) {
        return { success: false, error: 'Command blocked for security reasons' };
    }

    try {
        const args = ['exec'];
        if (workdir) {
            args.push('-w', workdir);
        }
        args.push(containerName, ...command);

        logger.info({ container: containerName, command: command.slice(0, 3) }, 'Executing in container');
        const output = await runCommand('docker', args, { timeoutMs: timeout });

        return {
            success: true,
            data: { container: containerName, output: output.slice(0, 5000) }
        };
    } catch (err) {
        logger.error({ err, container: containerName }, 'execInContainer failed');
        return { success: false, error: getErrorMessage(err) };
    }
}

/**
 * Get container logs with filtering
 */
export async function getContainerLogs(
    containerName: string,
    options: { tail?: number; since?: string; grep?: string } = {}
): Promise<ToolResult> {
    const { tail = 100, since, grep } = options;

    try {
        const args = ['logs', '--tail', tail.toString()];
        if (since) {
            args.push('--since', since);
        }
        args.push(containerName);

        let output = await runCommand('docker', args, { timeoutMs: 15000 });

        if (grep) {
            const lines = output.split('\n');
            const filtered = lines.filter(line => line.toLowerCase().includes(grep.toLowerCase()));
            output = filtered.join('\n');
        }

        return {
            success: true,
            data: {
                container: containerName,
                logs: output.slice(0, 10000),
                lineCount: output.split('\n').length
            }
        };
    } catch (err) {
        logger.error({ err, container: containerName }, 'getContainerLogs failed');
        return { success: false, error: getErrorMessage(err) };
    }
}

/**
 * Backup service configuration
 */
export async function backupServiceConfig(containerName: string, configPath: string): Promise<ToolResult> {
    try {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupDir = join(PROJECT_ROOT, 'backups');
        const backupPath = join(backupDir, `${containerName}-${timestamp}`);

        // Ensure backup directory exists
        await runCommand('mkdir', ['-p', backupDir], { timeoutMs: 5000 });

        // Copy config from container
        await runCommand('docker', ['cp', `${containerName}:${configPath}`, backupPath], { timeoutMs: 30000 });

        logger.info({ container: containerName, backup: backupPath }, 'Config backed up');

        return {
            success: true,
            data: { container: containerName, backupPath, timestamp }
        };
    } catch (err) {
        logger.error({ err, container: containerName }, 'backupServiceConfig failed');
        return { success: false, error: getErrorMessage(err) };
    }
}

// Helper: Topological sort for dependency ordering
function topologicalSort(services: string[]): string[] {
    const result: string[] = [];
    const visited = new Set<string>();
    const visiting = new Set<string>();

    function visit(service: string) {
        if (visited.has(service)) return;
        if (visiting.has(service)) return; // Circular dependency, skip

        visiting.add(service);

        const deps = SERVICE_DEPENDENCIES[service] || [];
        for (const dep of deps) {
            if (services.includes(dep)) {
                visit(dep);
            }
        }

        visiting.delete(service);
        visited.add(service);
        result.push(service);
    }

    for (const service of services) {
        visit(service);
    }

    return result;
}

// Export all orchestrator tools
export const orchestratorTools = {
    start_container: startContainer,
    stop_container: stopContainer,
    pull_image: pullImage,
    docker_compose: dockerCompose,
    manage_env: manageEnvVar,
    start_category: startServiceCategory,
    stop_category: stopServiceCategory,
    deploy_stack: deployStack,
    system_resources: getSystemResources,
    cleanup_docker: cleanupDocker,
    check_dependencies: checkDependencies,
    exec_container: execInContainer,
    container_logs: getContainerLogs,
    backup_config: backupServiceConfig,
};

// Tool metadata for orchestrator planning
export const ORCHESTRATOR_TOOL_METADATA: Record<string, {
    name: string;
    description: string;
    category: 'lifecycle' | 'config' | 'deploy' | 'monitor' | 'maintenance';
    estimatedDurationMs: number;
    sideEffects: boolean;
    riskLevel: 'low' | 'medium' | 'high';
}> = {
    start_container: {
        name: 'start_container',
        description: 'Start a stopped Docker container',
        category: 'lifecycle',
        estimatedDurationMs: 5000,
        sideEffects: true,
        riskLevel: 'low',
    },
    stop_container: {
        name: 'stop_container',
        description: 'Stop a running Docker container',
        category: 'lifecycle',
        estimatedDurationMs: 10000,
        sideEffects: true,
        riskLevel: 'medium',
    },
    pull_image: {
        name: 'pull_image',
        description: 'Pull latest Docker image',
        category: 'maintenance',
        estimatedDurationMs: 60000,
        sideEffects: true,
        riskLevel: 'low',
    },
    docker_compose: {
        name: 'docker_compose',
        description: 'Run docker-compose commands (up, down, restart, pull, logs, ps)',
        category: 'deploy',
        estimatedDurationMs: 30000,
        sideEffects: true,
        riskLevel: 'medium',
    },
    manage_env: {
        name: 'manage_env',
        description: 'Get, set, list, or delete environment variables',
        category: 'config',
        estimatedDurationMs: 500,
        sideEffects: true,
        riskLevel: 'medium',
    },
    start_category: {
        name: 'start_category',
        description: 'Start all services in a category (media, pvr, download, etc.)',
        category: 'lifecycle',
        estimatedDurationMs: 30000,
        sideEffects: true,
        riskLevel: 'medium',
    },
    stop_category: {
        name: 'stop_category',
        description: 'Stop all services in a category',
        category: 'lifecycle',
        estimatedDurationMs: 30000,
        sideEffects: true,
        riskLevel: 'medium',
    },
    deploy_stack: {
        name: 'deploy_stack',
        description: 'Deploy full media stack with optional pull and recreate',
        category: 'deploy',
        estimatedDurationMs: 120000,
        sideEffects: true,
        riskLevel: 'high',
    },
    system_resources: {
        name: 'system_resources',
        description: 'Get system disk, memory, and Docker resource usage',
        category: 'monitor',
        estimatedDurationMs: 5000,
        sideEffects: false,
        riskLevel: 'low',
    },
    cleanup_docker: {
        name: 'cleanup_docker',
        description: 'Clean up unused Docker resources (containers, images, volumes)',
        category: 'maintenance',
        estimatedDurationMs: 30000,
        sideEffects: true,
        riskLevel: 'medium',
    },
    check_dependencies: {
        name: 'check_dependencies',
        description: 'Check if all dependencies for a service are running',
        category: 'monitor',
        estimatedDurationMs: 3000,
        sideEffects: false,
        riskLevel: 'low',
    },
    exec_container: {
        name: 'exec_container',
        description: 'Execute a command inside a running container',
        category: 'maintenance',
        estimatedDurationMs: 10000,
        sideEffects: true,
        riskLevel: 'high',
    },
    container_logs: {
        name: 'container_logs',
        description: 'Get filtered container logs',
        category: 'monitor',
        estimatedDurationMs: 5000,
        sideEffects: false,
        riskLevel: 'low',
    },
    backup_config: {
        name: 'backup_config',
        description: 'Backup service configuration from container',
        category: 'maintenance',
        estimatedDurationMs: 10000,
        sideEffects: true,
        riskLevel: 'low',
    },
};
