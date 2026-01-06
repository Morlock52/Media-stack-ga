/**
 * Port Conflict Validator
 * Checks for port conflicts between services and with running processes
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import { createLogger } from '../../utils/logger.js';
import { runCommand } from '../../utils/docker.js';
import type {
    ValidationResult,
    ValidationIssue,
    PortValidationOptions
} from '../../types/validation.js';

const logger = createLogger('portValidator');
const execAsync = promisify(exec);

/**
 * Well-known service ports from docker-compose.yml
 */
const SERVICE_PORT_MAP: Record<string, number[]> = {
    traefik: [80],
    gluetun: [8888, 8388, 8080, 6881],
    qbittorrent: [8080, 6881], // Routed through gluetun
    tdarr: [8265, 8266],
    notifiarr: [5454],
    dozzle: [8080],
    homepage: [3000],
    portainer: [9000],
    authelia: [9091],
    redis: [6379],
    jellyfin: [8096],
    plex: [32400],
    sonarr: [8989],
    radarr: [7878],
    prowlarr: [9696],
    flaresolverr: [8191],
    overseerr: [5055],
    bazarr: [6767],
    tautulli: [8181],
    mealie: [9000],
    kavita: [5000],
    audiobookshelf: [13378],
    photoprism: [2342],
    grafana: [3000],
    loki: [3100],
    promtail: [9080],
    'postgres-backup': [8080],
    watchtower: [8080]
};

/**
 * Check if a port is in use on the host system
 */
async function checkHostPortUsage(port: number): Promise<{
    inUse: boolean;
    processInfo?: string;
}> {
    try {
        // Try different methods based on OS
        const platform = process.platform;

        if (platform === 'linux' || platform === 'darwin') {
            // Try lsof first (more reliable if available)
            try {
                const { stdout } = await execAsync(`lsof -i :${port} -sTCP:LISTEN -t`);
                if (stdout.trim()) {
                    // Get process info
                    const pid = stdout.trim().split('\n')[0];
                    try {
                        const { stdout: psOut } = await execAsync(`ps -p ${pid} -o comm=`);
                        return {
                            inUse: true,
                            processInfo: `PID ${pid} (${psOut.trim()})`
                        };
                    } catch {
                        return {
                            inUse: true,
                            processInfo: `PID ${pid}`
                        };
                    }
                }
            } catch {
                // lsof not available or port not in use, try ss/netstat
            }

            // Try ss (modern replacement for netstat)
            try {
                const { stdout } = await execAsync(`ss -ltn | grep :${port}`);
                if (stdout.trim()) {
                    return {
                        inUse: true,
                        processInfo: 'Unknown process (detected via ss)'
                    };
                }
            } catch {
                // ss failed, try netstat
            }

            // Try netstat as fallback
            try {
                const { stdout } = await execAsync(`netstat -ln | grep :${port}`);
                if (stdout.trim()) {
                    return {
                        inUse: true,
                        processInfo: 'Unknown process (detected via netstat)'
                    };
                }
            } catch {
                // All methods failed, assume port is free
            }
        } else if (platform === 'win32') {
            // Windows: use netstat
            try {
                const { stdout } = await execAsync(`netstat -ano | findstr :${port}`);
                if (stdout.trim()) {
                    return {
                        inUse: true,
                        processInfo: 'Unknown process (detected via netstat)'
                    };
                }
            } catch {
                // Port not in use or netstat failed
            }
        }

        return { inUse: false };
    } catch (error) {
        logger.warn({ port, error }, 'Failed to check host port usage');
        return { inUse: false };
    }
}

/**
 * Get ports used by running Docker containers
 */
async function getDockerPortUsage(): Promise<Map<number, string[]>> {
    const portMap = new Map<number, string[]>();

    try {
        // Get all running containers with their port mappings
        const output = await runCommand(
            'docker',
            ['ps', '--format', '{{.Names}}\t{{.Ports}}'],
            { timeoutMs: 10000, label: 'docker-ps-ports' }
        );

        const lines = output.split('\n').filter(Boolean);
        for (const line of lines) {
            const [containerName, portsStr] = line.split('\t');
            if (!portsStr) continue;

            // Parse port mappings like "0.0.0.0:8080->8080/tcp, 0.0.0.0:6881->6881/udp"
            const portMatches = portsStr.matchAll(/0\.0\.0\.0:(\d+)->/g);
            for (const match of portMatches) {
                const port = parseInt(match[1], 10);
                if (!portMap.has(port)) {
                    portMap.set(port, []);
                }
                portMap.get(port)!.push(containerName);
            }
        }
    } catch (error) {
        logger.warn({ error }, 'Failed to get Docker port usage');
    }

    return portMap;
}

/**
 * Validate port configuration for conflicts
 */
export async function validatePorts(options: PortValidationOptions): Promise<ValidationResult> {
    const startTime = Date.now();
    logger.debug({
        ports: options.ports,
        servicePortMap: options.servicePortMap
    }, 'Starting port validation');

    const allIssues: ValidationIssue[] = [];
    const servicePortMap = options.servicePortMap || {};

    // Build a map of ports to services for internal conflict detection
    const portToServices = new Map<number, string[]>();

    // Use provided service port map or fall back to well-known ports
    const effectiveServiceMap = Object.keys(servicePortMap).length > 0
        ? servicePortMap
        : SERVICE_PORT_MAP;

    // Check which services are being validated based on ports provided
    const selectedServices = new Set<string>();
    for (const [service, servicePorts] of Object.entries(effectiveServiceMap)) {
        if (servicePorts.some(p => options.ports.includes(p))) {
            selectedServices.add(service);
        }
    }

    // Collect all ports from selected services
    const allSelectedPorts = new Set<number>();
    for (const service of selectedServices) {
        const ports = effectiveServiceMap[service] || [];
        for (const port of ports) {
            allSelectedPorts.add(port);
            if (!portToServices.has(port)) {
                portToServices.set(port, []);
            }
            portToServices.get(port)!.push(service);
        }
    }

    // Check for port conflicts between selected services
    for (const [port, services] of portToServices.entries()) {
        if (services.length > 1) {
            // Special case: qbittorrent and gluetun share ports (qbittorrent routes through gluetun)
            const isQbitGluetunSharing = services.length === 2 &&
                services.includes('qbittorrent') &&
                services.includes('gluetun');

            if (!isQbitGluetunSharing) {
                allIssues.push({
                    code: 'PORT_CONFLICT_SERVICES',
                    severity: 'error',
                    message: `Port ${port} is used by multiple services: ${services.join(', ')}`,
                    affectedField: `port_${port}`,
                    fixSuggestion: `Change the port mapping for one of these services in docker-compose.yml or disable one of the conflicting services`,
                    details: {
                        port,
                        conflictingServices: services
                    }
                });
            }
        }
    }

    // Get Docker container port usage
    const dockerPorts = await getDockerPortUsage();

    // Check each port against Docker containers and host
    for (const port of allSelectedPorts) {
        // Check if port is used by running containers
        const dockerContainers = dockerPorts.get(port);
        if (dockerContainers && dockerContainers.length > 0) {
            // Filter out containers that are part of this stack (likely OK)
            const externalContainers = dockerContainers.filter(name =>
                !Array.from(selectedServices).some(service =>
                    name.toLowerCase().includes(service.toLowerCase())
                )
            );

            if (externalContainers.length > 0) {
                allIssues.push({
                    code: 'PORT_IN_USE_DOCKER',
                    severity: 'error',
                    message: `Port ${port} is already in use by Docker container(s): ${externalContainers.join(', ')}`,
                    affectedField: `port_${port}`,
                    fixSuggestion: `Stop the conflicting container(s) or change the port mapping for your service`,
                    details: {
                        port,
                        containers: externalContainers
                    }
                });
            }
        }

        // Check if port is bound on the host system
        const hostUsage = await checkHostPortUsage(port);
        if (hostUsage.inUse) {
            allIssues.push({
                code: 'PORT_IN_USE_HOST',
                severity: 'error',
                message: `Port ${port} is already bound on the host system${hostUsage.processInfo ? ' by ' + hostUsage.processInfo : ''}`,
                affectedField: `port_${port}`,
                fixSuggestion: `Stop the process using port ${port} or change the port mapping for your service`,
                details: {
                    port,
                    processInfo: hostUsage.processInfo
                }
            });
        }
    }

    // Check for common port conflict warnings
    if (allSelectedPorts.has(80)) {
        allIssues.push({
            code: 'PORT_PRIVILEGED',
            severity: 'info',
            message: 'Port 80 requires elevated privileges (root/sudo) on Linux/macOS',
            affectedField: 'port_80',
            fixSuggestion: 'Ensure Docker has permission to bind to port 80, or use a higher port like 8080 and set up port forwarding',
            details: { port: 80 }
        });
    }

    if (allSelectedPorts.has(443)) {
        allIssues.push({
            code: 'PORT_PRIVILEGED',
            severity: 'info',
            message: 'Port 443 requires elevated privileges (root/sudo) on Linux/macOS',
            affectedField: 'port_443',
            fixSuggestion: 'Ensure Docker has permission to bind to port 443, or use a higher port like 8443',
            details: { port: 443 }
        });
    }

    // Check for commonly conflicting ports with well-known services
    const commonConflicts: Record<number, string> = {
        3000: 'Node.js/React development servers',
        5000: 'Flask/Python development servers',
        8000: 'Django/Python development servers',
        8080: 'Common alternative HTTP port, often used by development tools',
        9000: 'PHP-FPM, Portainer, and other services',
        5432: 'PostgreSQL default port',
        3306: 'MySQL default port',
        6379: 'Redis default port',
        27017: 'MongoDB default port'
    };

    for (const [port, service] of Object.entries(commonConflicts)) {
        const portNum = parseInt(port, 10);
        if (allSelectedPorts.has(portNum)) {
            allIssues.push({
                code: 'PORT_COMMON_CONFLICT',
                severity: 'warning',
                message: `Port ${portNum} is commonly used by ${service}`,
                affectedField: `port_${portNum}`,
                fixSuggestion: `If you're running ${service}, you may encounter conflicts`,
                details: {
                    port: portNum,
                    commonService: service
                }
            });
        }
    }

    const passed = allIssues.every(issue => issue.severity !== 'error');
    const duration = Date.now() - startTime;

    logger.debug({
        passed,
        issueCount: allIssues.length,
        durationMs: duration
    }, 'Port validation complete');

    return {
        validator: 'port',
        passed,
        issues: allIssues,
        timestamp: new Date(),
        metadata: {
            portsChecked: allSelectedPorts.size,
            servicesChecked: selectedServices.size,
            durationMs: duration
        }
    };
}
