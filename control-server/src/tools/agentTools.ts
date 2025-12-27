/**
 * Extended Agent Tools for Media Stack
 * Tools: check_service_health, restart_service, generate_env_diff,
 *        run_post_deploy_check, list_running_services, analyze_logs,
 *        network_diagnostics, optimize_config
 *
 * Security: Input validation with allowlists to prevent injection
 * Updated: December 2025
 */

import { runCommand } from '../utils/docker.js';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { PROJECT_ROOT } from '../utils/env.js';
import pino from 'pino';

const logger = pino({
    level: process.env.LOG_LEVEL || 'info',
    transport: { target: 'pino-pretty', options: { colorize: true } }
});

// Security: Allowlist of valid service names to prevent injection
const ALLOWED_SERVICES = new Set([
    'plex', 'jellyfin', 'emby', 'sonarr', 'radarr', 'prowlarr', 'lidarr',
    'readarr', 'bazarr', 'overseerr', 'tautulli', 'qbittorrent', 'sabnzbd',
    'nzbget', 'transmission', 'deluge', 'gluetun', 'traefik', 'nginx',
    'authelia', 'cloudflared', 'portainer', 'watchtower', 'homepage',
    'homarr', 'organizr', 'flaresolverr', 'recyclarr', 'notifiarr',
    'autobrr', 'unpackerr', 'tdarr', 'handbrake', 'makemkv'
]);

// Validate service name against allowlist
function validateServiceName(name: string | undefined): { valid: boolean; sanitized?: string; error?: string } {
    if (!name || typeof name !== 'string') {
        return { valid: false, error: 'Service name is required' };
    }

    const sanitized = name.toLowerCase().trim().replace(/[^a-z0-9_-]/g, '');

    if (sanitized.length === 0) {
        return { valid: false, error: 'Invalid service name format' };
    }

    if (sanitized.length > 64) {
        return { valid: false, error: 'Service name too long' };
    }

    // Check if it matches a known service or follows valid Docker naming
    const isAllowed = ALLOWED_SERVICES.has(sanitized) ||
                      Array.from(ALLOWED_SERVICES).some(s => sanitized.startsWith(s + '_') || sanitized.startsWith(s + '-'));

    if (!isAllowed) {
        // Allow custom names but log a warning
        logger.warn({ serviceName: sanitized }, 'Service name not in allowlist, proceeding with caution');
    }

    return { valid: true, sanitized };
}

// Validate file path to prevent directory traversal
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function validateFilePath(filePath: string | undefined): { valid: boolean; sanitized?: string; error?: string } {
    if (!filePath || typeof filePath !== 'string') {
        return { valid: false, error: 'File path is required' };
    }

    // Prevent directory traversal attacks
    if (filePath.includes('..') || filePath.includes('\0')) {
        return { valid: false, error: 'Invalid file path: directory traversal not allowed' };
    }

    const sanitized = filePath.trim();

    // Only allow relative paths within project
    if (sanitized.startsWith('/') && !sanitized.startsWith(PROJECT_ROOT)) {
        return { valid: false, error: 'Absolute paths outside project root not allowed' };
    }

    return { valid: true, sanitized };
}

export interface ToolResult {
    success: boolean;
    data?: any;
    error?: string;
}

export interface ServiceHealth {
    name: string;
    status: 'running' | 'stopped' | 'restarting' | 'unhealthy' | 'unknown';
    uptime?: string;
    cpu?: string;
    memory?: string;
    ports?: string[];
}

export interface EnvDiff {
    missing: string[];
    extra: string[];
    different: string[];
}

export async function checkServiceHealth(serviceName?: string): Promise<ToolResult> {
    try {
        // Validate service name if provided
        if (serviceName) {
            const validation = validateServiceName(serviceName);
            if (!validation.valid) {
                return { success: false, error: validation.error };
            }
            serviceName = validation.sanitized;
        }

        const format = '{{.Names}}\t{{.Status}}\t{{.State}}';
        const args = serviceName
            ? ['ps', '-a', '--filter', `name=${serviceName}`, '--format', format]
            : ['ps', '-a', '--format', format];

      const output = await runCommand('docker', args, { timeoutMs: 10000 });

      if (!output.trim()) {
              return { 
                        success: true, 
                        data: serviceName 
                          ? { message: `Service "${serviceName}" not found` }
                                    : { services: [], message: 'No services running' }
              };
      }

      const services: ServiceHealth[] = [];
          const lines = output.trim().split('\n');

      for (const line of lines) {
              const [name, status, state] = line.split('\t');
              let stats: Partial<ServiceHealth> = {};

            if (state === 'running') {
                      try {
                                  const statsOutput = await runCommand('docker', [
                                                'stats', name, '--no-stream', '--format', '{{.CPUPerc}}\t{{.MemUsage}}'
                                              ], { timeoutMs: 5000 });
                                  const [cpu, memory] = statsOutput.split('\t');
                                  stats = { cpu, memory };
                      } catch { /* continue */ }

                try {
                            const portsOutput = await runCommand('docker', ['port', name], { timeoutMs: 3000 });
                            stats.ports = portsOutput.split('\n').filter(Boolean);
                } catch { /* continue */ }
            }

            services.push({
                      name,
                      status: mapDockerState(state),
                      uptime: extractUptime(status),
                      ...stats
            });
      }

      return { success: true, data: { services } };
    } catch (err: any) {
          logger.error({ err, serviceName }, 'check_service_health failed');
          return { success: false, error: err.message };
    }
}

export async function restartService(serviceName: string, mode: 'graceful' | 'hard' = 'graceful'): Promise<ToolResult> {
    // Validate service name (required for restart)
    const validation = validateServiceName(serviceName);
    if (!validation.valid) {
        return { success: false, error: validation.error };
    }
    const validatedName = validation.sanitized!;

    try {
        logger.info({ serviceName: validatedName, mode }, 'Restarting service');

        if (mode === 'hard') {
            await runCommand('docker', ['kill', validatedName], { timeoutMs: 10000 });
            await runCommand('docker', ['start', validatedName], { timeoutMs: 30000 });
        } else {
            await runCommand('docker', ['restart', validatedName], { timeoutMs: 60000 });
        }

      const health = await checkServiceHealth(serviceName);
          return { 
                  success: true, 
                  data: { message: `Service "${serviceName}" restarted (${mode})`, currentStatus: health.data }
          };
    } catch (err: any) {
          logger.error({ err, serviceName, mode }, 'restart_service failed');
          return { success: false, error: err.message };
    }
}

                              export async function generateEnvDiff(): Promise<ToolResult> {
                                  try {
                                        const envPath = join(PROJECT_ROOT, '.env');
                                        const examplePath = join(PROJECT_ROOT, '.env.example');

                                    let envContent: string, exampleContent: string;

                                    try { envContent = await readFile(envPath, 'utf-8'); } 
                                    catch { return { success: false, error: '.env file not found' }; }

                                    try { exampleContent = await readFile(examplePath, 'utf-8'); } 
                                    catch { return { success: false, error: '.env.example file not found' }; }

                                    const envVars = parseEnvFile(envContent);
                                        const exampleVars = parseEnvFile(exampleContent);
                                        const diff: EnvDiff = { missing: [], extra: [], different: [] };

                                    for (const key of Object.keys(exampleVars)) {
                                            if (!(key in envVars)) diff.missing.push(key);
                                    }
                                        for (const key of Object.keys(envVars)) {
                                                if (!(key in exampleVars)) diff.extra.push(key);
                                        }

                                    return { 
                                            success: true, 
                                            data: { diff, summary: { missingCount: diff.missing.length, extraCount: diff.extra.length, isComplete: diff.missing.length === 0 } }
                                    };
                                  } catch (err: any) {
                                        logger.error({ err }, 'generate_env_diff failed');
                                        return { success: false, error: err.message };
                                  }
                              }

export async function runPostDeployCheck(): Promise<ToolResult> {
    const checks: Array<{ name: string; status: 'pass' | 'fail' | 'skip'; message?: string }> = [];

  try {
        await runCommand('docker', ['info'], { timeoutMs: 5000 });
        checks.push({ name: 'Docker Daemon', status: 'pass' });
  } catch (err: any) {
        checks.push({ name: 'Docker Daemon', status: 'fail', message: err.message });
  }

  const coreServices = ['plex', 'sonarr', 'radarr', 'prowlarr'];
    for (const service of coreServices) {
          try {
                  const result = await checkServiceHealth(service);
                  if (result.success && result.data?.services?.length > 0) {
                            const svc = result.data.services[0];
                            checks.push({ 
                                                  name: `Service: ${service}`, 
                                        status: svc.status === 'running' ? 'pass' : 'fail',
                                        message: svc.status !== 'running' ? `Status: ${svc.status}` : undefined
                            });
                  } else {
                            checks.push({ name: `Service: ${service}`, status: 'skip', message: 'Not deployed' });
                  }
          } catch (err: any) {
                  checks.push({ name: `Service: ${service}`, status: 'fail', message: err.message });
          }
    }

  try {
        const vpnHealth = await checkServiceHealth('gluetun');
        if (vpnHealth.success && vpnHealth.data?.services?.length > 0 && vpnHealth.data.services[0].status === 'running') {
                const vpnIp = await runCommand('docker', ['exec', 'gluetun', 'wget', '-qO-', 'ifconfig.me'], { timeoutMs: 10000 });
                checks.push({ name: 'VPN Connectivity', status: 'pass', message: `External IP: ${vpnIp.trim()}` });
        } else {
                checks.push({ name: 'VPN Connectivity', status: 'skip', message: 'Gluetun not deployed or not running' });
        }
  } catch (err: any) {
        checks.push({ name: 'VPN Connectivity', status: 'fail', message: err.message });
  }

  const passed = checks.filter(c => c.status === 'pass').length;
    const failed = checks.filter(c => c.status === 'fail').length;
    const skipped = checks.filter(c => c.status === 'skip').length;

  return { success: failed === 0, data: { checks, summary: { passed, failed, skipped, total: checks.length }, healthy: failed === 0 } };
}

export async function listRunningServices(): Promise<ToolResult> {
    try {
          const format = '{{.Names}}\t{{.Status}}\t{{.Image}}\t{{.Ports}}';
          const output = await runCommand('docker', ['ps', '--format', format], { timeoutMs: 10000 });

      if (!output.trim()) return { success: true, data: { services: [], count: 0 } };

      const services = output.trim().split('\n').map(line => {
              const [name, status, image, ports] = line.split('\t');
              return { name, status, image: image.split(':')[0], imageTag: image.split(':')[1] || 'latest', ports: ports || 'none' };
      });

      return { success: true, data: { services, count: services.length, categories: categorizeServices(services) } };
    } catch (err: any) {
          logger.error({ err }, 'list_running_services failed');
          return { success: false, error: err.message };
    }
}

function mapDockerState(state: string): ServiceHealth['status'] {
    const s = state?.toLowerCase() || '';
    if (s === 'running') return 'running';
    if (s === 'exited' || s === 'dead') return 'stopped';
    if (s === 'restarting') return 'restarting';
    if (s.includes('unhealthy')) return 'unhealthy';
    return 'unknown';
}

function extractUptime(status: string): string {
    const match = status.match(/Up\s+(.+?)(?:\s+\(|$)/);
    return match ? match[1] : 'unknown';
}

function parseEnvFile(content: string): Record<string, string> {
    const vars: Record<string, string> = {};
    for (const line of content.split('\n')) {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith('#')) continue;
          const eqIndex = trimmed.indexOf('=');
          if (eqIndex > 0) vars[trimmed.slice(0, eqIndex).trim()] = trimmed.slice(eqIndex + 1).trim();
    }
    return vars;
}

function categorizeServices(services: Array<{ name: string; image: string }>) {
    const categories: Record<string, string[]> = { media: [], download: [], network: [], management: [], other: [] };
    const mediaApps = ['plex', 'jellyfin', 'emby', 'overseerr', 'tautulli'];
    const downloadApps = ['sonarr', 'radarr', 'prowlarr', 'qbittorrent', 'sabnzbd', 'nzbget', 'lidarr', 'readarr', 'bazarr'];
    const networkApps = ['gluetun', 'traefik', 'nginx', 'authelia', 'cloudflared'];
    const mgmtApps = ['portainer', 'watchtower', 'homepage', 'homarr'];

  for (const svc of services) {
        const name = svc.name.toLowerCase();
        if (mediaApps.some(app => name.includes(app))) categories.media.push(svc.name);
        else if (downloadApps.some(app => name.includes(app))) categories.download.push(svc.name);
        else if (networkApps.some(app => name.includes(app))) categories.network.push(svc.name);
        else if (mgmtApps.some(app => name.includes(app))) categories.management.push(svc.name);
        else categories.other.push(svc.name);
  }
    return categories;
}

// NEW: Analyze logs with pattern matching
export async function analyzeLogs(
    serviceName: string,
    options: { pattern?: string; severity?: 'error' | 'warning' | 'info'; lines?: number } = {}
): Promise<ToolResult> {
    const validation = validateServiceName(serviceName);
    if (!validation.valid) {
        return { success: false, error: validation.error };
    }
    const validatedName = validation.sanitized!;

    const { pattern, severity, lines = 100 } = options;
    const safeLines = Math.min(Math.max(lines, 10), 500); // Limit to 10-500 lines

    try {
        logger.info({ serviceName: validatedName, pattern, severity, lines: safeLines }, 'Analyzing logs');

        const output = await runCommand('docker', ['logs', '--tail', safeLines.toString(), validatedName], { timeoutMs: 15000 });

        if (!output.trim()) {
            return { success: true, data: { logs: [], message: 'No logs found', count: 0 } };
        }

        let logLines = output.split('\n').filter(Boolean);

        // Filter by severity if specified
        if (severity) {
            const severityPatterns: Record<string, RegExp> = {
                error: /error|exception|fatal|fail|critical/i,
                warning: /warn|warning|caution/i,
                info: /info|notice|debug/i
            };
            const severityPattern = severityPatterns[severity];
            if (severityPattern) {
                logLines = logLines.filter(line => severityPattern.test(line));
            }
        }

        // Filter by custom pattern if specified
        if (pattern) {
            try {
                const regex = new RegExp(pattern, 'i');
                logLines = logLines.filter(line => regex.test(line));
            } catch {
                return { success: false, error: 'Invalid regex pattern' };
            }
        }

        // Categorize findings
        const errors = logLines.filter(line => /error|exception|fatal|fail/i.test(line));
        const warnings = logLines.filter(line => /warn/i.test(line));

        return {
            success: true,
            data: {
                logs: logLines.slice(0, 50), // Return max 50 matching lines
                count: logLines.length,
                summary: {
                    total: logLines.length,
                    errors: errors.length,
                    warnings: warnings.length,
                    hasIssues: errors.length > 0 || warnings.length > 0
                },
                service: validatedName
            }
        };
    } catch (err: any) {
        logger.error({ err, serviceName: validatedName }, 'analyze_logs failed');
        return { success: false, error: err.message };
    }
}

// NEW: Network diagnostics
export async function networkDiagnostics(options: {
    checkDns?: boolean;
    checkPorts?: number[];
    checkVpn?: boolean;
    checkInternet?: boolean;
} = {}): Promise<ToolResult> {
    const { checkDns = true, checkPorts = [], checkVpn = true, checkInternet = true } = options;
    const results: Array<{ check: string; status: 'pass' | 'fail' | 'skip'; message?: string; data?: any }> = [];

    try {
        // Check internet connectivity
        if (checkInternet) {
            try {
                const pingResult = await runCommand('curl', ['-s', '-o', '/dev/null', '-w', '%{http_code}', '--max-time', '5', 'https://api.ipify.org'], { timeoutMs: 10000 });
                if (pingResult.trim() === '200') {
                    const ipResult = await runCommand('curl', ['-s', '--max-time', '5', 'https://api.ipify.org'], { timeoutMs: 10000 });
                    results.push({ check: 'Internet Connectivity', status: 'pass', message: `External IP: ${ipResult.trim()}`, data: { externalIp: ipResult.trim() } });
                } else {
                    results.push({ check: 'Internet Connectivity', status: 'fail', message: 'Cannot reach external services' });
                }
            } catch (err: any) {
                results.push({ check: 'Internet Connectivity', status: 'fail', message: err.message });
            }
        }

        // Check DNS resolution
        if (checkDns) {
            const dnsTargets = ['google.com', 'cloudflare.com', 'github.com'];
            for (const target of dnsTargets) {
                try {
                    await runCommand('nslookup', [target], { timeoutMs: 5000 });
                    results.push({ check: `DNS: ${target}`, status: 'pass' });
                } catch {
                    results.push({ check: `DNS: ${target}`, status: 'fail', message: 'DNS resolution failed' });
                }
            }
        }

        // Check VPN connectivity via Gluetun
        if (checkVpn) {
            try {
                const vpnHealth = await checkServiceHealth('gluetun');
                if (vpnHealth.success && vpnHealth.data?.services?.length > 0 && vpnHealth.data.services[0].status === 'running') {
                    const vpnIp = await runCommand('docker', ['exec', 'gluetun', 'wget', '-qO-', 'ifconfig.me'], { timeoutMs: 10000 });
                    results.push({ check: 'VPN Connectivity', status: 'pass', message: `VPN IP: ${vpnIp.trim()}`, data: { vpnIp: vpnIp.trim() } });
                } else {
                    results.push({ check: 'VPN Connectivity', status: 'skip', message: 'Gluetun not running' });
                }
            } catch (err: any) {
                results.push({ check: 'VPN Connectivity', status: 'fail', message: err.message });
            }
        }

        // Check specific ports
        for (const port of checkPorts.slice(0, 10)) { // Limit to 10 ports
            if (typeof port !== 'number' || port < 1 || port > 65535) continue;
            try {
                await runCommand('nc', ['-z', '-w', '2', 'localhost', port.toString()], { timeoutMs: 5000 });
                results.push({ check: `Port ${port}`, status: 'pass' });
            } catch {
                results.push({ check: `Port ${port}`, status: 'fail', message: `Port ${port} not accessible` });
            }
        }

        const passed = results.filter(r => r.status === 'pass').length;
        const failed = results.filter(r => r.status === 'fail').length;

        return {
            success: failed === 0,
            data: {
                results,
                summary: { passed, failed, skipped: results.filter(r => r.status === 'skip').length, total: results.length },
                healthy: failed === 0
            }
        };
    } catch (err: any) {
        logger.error({ err }, 'network_diagnostics failed');
        return { success: false, error: err.message };
    }
}

// NEW: Get optimization suggestions for a service
export async function optimizeConfig(
    serviceName: string,
    focus: 'memory' | 'cpu' | 'network' | 'storage' | 'general' = 'general'
): Promise<ToolResult> {
    const validation = validateServiceName(serviceName);
    if (!validation.valid) {
        return { success: false, error: validation.error };
    }
    const validatedName = validation.sanitized!;

    try {
        // Get current resource usage
        const health = await checkServiceHealth(validatedName);
        if (!health.success || !health.data?.services?.length) {
            return { success: false, error: `Service ${validatedName} not found or not running` };
        }

        const service = health.data.services[0];
        const suggestions: Array<{ category: string; suggestion: string; priority: 'high' | 'medium' | 'low' }> = [];

        // Service-specific optimization suggestions
        const serviceOptimizations: Record<string, Array<{ category: string; suggestion: string; priority: 'high' | 'medium' | 'low' }>> = {
            plex: [
                { category: 'memory', suggestion: 'Enable hardware transcoding to reduce CPU/memory usage', priority: 'high' },
                { category: 'storage', suggestion: 'Store transcoding temp files on SSD for better performance', priority: 'medium' },
                { category: 'network', suggestion: 'Set remote streaming quality limits to reduce bandwidth', priority: 'low' }
            ],
            sonarr: [
                { category: 'memory', suggestion: 'Reduce concurrent download slots if memory is constrained', priority: 'medium' },
                { category: 'storage', suggestion: 'Use hardlinks instead of copies when possible', priority: 'high' },
                { category: 'general', suggestion: 'Enable automatic metadata refresh only for new content', priority: 'low' }
            ],
            radarr: [
                { category: 'memory', suggestion: 'Reduce concurrent download slots if memory is constrained', priority: 'medium' },
                { category: 'storage', suggestion: 'Use hardlinks instead of copies when possible', priority: 'high' },
                { category: 'general', suggestion: 'Limit list sync frequency to reduce API calls', priority: 'low' }
            ],
            qbittorrent: [
                { category: 'memory', suggestion: 'Limit maximum active torrents to reduce memory usage', priority: 'high' },
                { category: 'network', suggestion: 'Adjust connection limits based on available bandwidth', priority: 'medium' },
                { category: 'storage', suggestion: 'Use sequential downloading for better disk access patterns', priority: 'low' }
            ],
            jellyfin: [
                { category: 'memory', suggestion: 'Enable hardware acceleration for transcoding', priority: 'high' },
                { category: 'cpu', suggestion: 'Use GPU transcoding if available to reduce CPU load', priority: 'high' },
                { category: 'storage', suggestion: 'Store metadata and thumbnails on SSD', priority: 'medium' }
            ]
        };

        // Add service-specific suggestions
        const baseService = validatedName.split(/[_-]/)[0];
        if (serviceOptimizations[baseService]) {
            const relevant = focus === 'general'
                ? serviceOptimizations[baseService]
                : serviceOptimizations[baseService].filter(s => s.category === focus || s.category === 'general');
            suggestions.push(...relevant);
        }

        // Add general suggestions based on current resource usage
        if (service.cpu && parseFloat(service.cpu) > 80) {
            suggestions.push({ category: 'cpu', suggestion: 'CPU usage is high. Consider increasing resources or limiting concurrent tasks.', priority: 'high' });
        }
        if (service.memory && service.memory.includes('GiB')) {
            const memUsed = parseFloat(service.memory.split('/')[0]);
            if (memUsed > 4) {
                suggestions.push({ category: 'memory', suggestion: 'Memory usage is high. Consider setting container memory limits.', priority: 'medium' });
            }
        }

        return {
            success: true,
            data: {
                service: validatedName,
                currentStatus: service,
                focus,
                suggestions,
                recommendedActions: suggestions.filter(s => s.priority === 'high').map(s => s.suggestion)
            }
        };
    } catch (err: any) {
        logger.error({ err, serviceName: validatedName }, 'optimize_config failed');
        return { success: false, error: err.message };
    }
}

export const agentTools = {
    check_service_health: checkServiceHealth,
    restart_service: restartService,
    generate_env_diff: generateEnvDiff,
    run_post_deploy_check: runPostDeployCheck,
    list_running_services: listRunningServices,
    analyze_logs: analyzeLogs,
    network_diagnostics: networkDiagnostics,
    optimize_config: optimizeConfig
};
