/**
 * Extended Agent Tools for Media Stack
 * New tools: check_service_health, restart_service, generate_env_diff, 
 *            run_post_deploy_check, list_running_services
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
    try {
          logger.info({ serviceName, mode }, 'Restarting service');

      if (mode === 'hard') {
              await runCommand('docker', ['kill', serviceName], { timeoutMs: 10000 });
              await runCommand('docker', ['start', serviceName], { timeoutMs: 30000 });
      } else {
              await runCommand('docker', ['restart', serviceName], { timeoutMs: 60000 });
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

export const agentTools = {
    check_service_health: checkServiceHealth,
    restart_service: restartService,
    generate_env_diff: generateEnvDiff,
    run_post_deploy_check: runPostDeployCheck,
    list_running_services: listRunningServices
};
