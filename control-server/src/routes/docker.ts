import { FastifyInstance } from 'fastify';
import fs from 'fs';
import os from 'os';
import { runCommand } from '../utils/docker.js';
import { Container, ServiceIssue } from '../types/index.js';
import { PROJECT_ROOT } from '../utils/env.js';
import { z } from 'zod';
import { getErrorMessage } from '../utils/errors.js';

export async function dockerRoutes(fastify: FastifyInstance) {
    const cacheMs = Math.max(0, parseInt(process.env.DOCKER_STATUS_CACHE_MS || '1500', 10) || 0);

    let containersCache: Container[] | null = null;
    let containersCacheAt = 0;
    let containersInFlight: Promise<Container[]> | null = null;
    let composeServicesCache: string[] | null = null;
    let composeServicesCacheAt = 0;
    let composeServicesInFlight: Promise<string[]> | null = null;

    const isDockerUnavailable = (error: unknown) => {
        const msg = getErrorMessage(error).toLowerCase();
        return msg.includes('docker daemon is not running')
            || msg.includes('docker: command not found')
            || msg.includes('required cli')
            || msg.includes('docker cli is not available')
            || msg.includes('connect to the docker daemon')
            || msg.includes('no such file or directory') && msg.includes('docker');
    };

    // Detect compose configuration errors (missing env vars, invalid yaml, etc.)
    const isComposeConfigError = (error: unknown) => {
        const msg = getErrorMessage(error).toLowerCase();
        return msg.includes('required variable')
            || msg.includes('is missing a value')
            || msg.includes('error while interpolating')
            || msg.includes('yaml:')
            || msg.includes('invalid compose');
    };

    const getComposeServices = async (): Promise<string[]> => {
        const now = Date.now();
        if (cacheMs > 0 && composeServicesCache && now - composeServicesCacheAt < cacheMs) {
            return composeServicesCache;
        }
        if (composeServicesInFlight) return composeServicesInFlight;

        composeServicesInFlight = (async () => {
            try {
                const output = await runCommand('docker', ['compose', '--project-directory', PROJECT_ROOT, 'config', '--services'], {
                    timeoutMs: 10_000,
                    label: 'compose:services',
                });
                const services = output
                    .split('\n')
                    .map((s) => s.trim())
                    .filter(Boolean);
                if (cacheMs > 0) {
                    composeServicesCache = services;
                    composeServicesCacheAt = Date.now();
                }
                return services;
            } catch (err) {
                // If compose config fails (missing .env, etc.), return empty and cache briefly
                if (isComposeConfigError(err)) {
                    if (cacheMs > 0) {
                        composeServicesCache = [];
                        composeServicesCacheAt = Date.now();
                    }
                    return [];
                }
                throw err;
            }
        })();

        try {
            return await composeServicesInFlight;
        } finally {
            composeServicesInFlight = null;
        }
    };

    const composeActionArgs = (extra: string[] = []) => ['compose', '--project-directory', PROJECT_ROOT, ...extra];

    // Get Container Status
    fastify.get('/api/containers', async (request, reply) => {
        try {
            const now = Date.now();
            if (cacheMs > 0 && containersCache && now - containersCacheAt < cacheMs) {
                return containersCache;
            }

            if (containersInFlight) {
                return await containersInFlight;
            }

            containersInFlight = (async () => {
                const output = await runCommand(
                    'docker',
                    ['ps', '-a', '--format', '"{{.ID}}|{{.Names}}|{{.Status}}|{{.State}}|{{.Ports}}"'],
                    { timeoutMs: 12_000, label: 'docker ps' }
                );

                const containers: Container[] = output
                    .split('\n')
                    .map((line) => line.replace(/"/g, '').trim())
                    .filter((line) => Boolean(line))
                    .map((line) => {
                        const [id, name, status, state, ports] = line.split('|');
                        if (!name || !name.trim()) return null;
                        return {
                            id: (id || '').trim(),
                            name: name.trim(),
                            status: (status || '').trim(),
                            state: (state || '').trim(),
                            ports: (ports || '').trim(),
                        };
                    })
                    .filter((c): c is Container => Boolean(c));

                if (cacheMs > 0) {
                    containersCache = containers;
                    containersCacheAt = Date.now();
                }

                return containers;
            })();

            try {
                return await containersInFlight;
            } finally {
                containersInFlight = null;
            }
        } catch (error: unknown) {
            fastify.log.error({ err: error }, 'Error fetching containers');
            if (isDockerUnavailable(error)) {
                return reply.status(503).send({
                    error: 'docker_unavailable',
                    message: getErrorMessage(error),
                    containers: []
                });
            }
            reply.status(500).send({ error: getErrorMessage(error) });
        }
    });

    // Start/Stop/Restart a Service
    fastify.post<{ Params: { action: string }, Body: { serviceName: string } }>(
        '/api/service/:action',
        async (request, reply) => {
            const { action } = request.params;
            const parseBody = z.object({ serviceName: z.string().min(1) }).safeParse(request.body);
            if (!parseBody.success) {
                return reply.status(400).send({ error: 'Invalid service name' });
            }
            const { serviceName } = parseBody.data;

            if (!['start', 'stop', 'restart', 'up'].includes(action)) {
                return reply.status(400).send({ error: 'Invalid action' });
            }

            try {
                const services = await getComposeServices();
                if (!services.includes(serviceName)) {
                    return reply
                        .status(400)
                        .send({ error: `Unknown service "${serviceName}". Known services: ${services.join(', ') || 'none'}` });
                }

                let cmdArgs: string[] = [];
                if (action === 'up') {
                    cmdArgs = composeActionArgs(['up', '-d', serviceName]);
                } else if (action === 'start') {
                    cmdArgs = composeActionArgs(['start', serviceName]);
                } else if (action === 'stop') {
                    cmdArgs = composeActionArgs(['stop', serviceName]);
                } else if (action === 'restart') {
                    cmdArgs = composeActionArgs(['restart', serviceName]);
                }

                await runCommand('docker', cmdArgs, { timeoutMs: 20_000, label: `compose:${action}:${serviceName}` });
                return { success: true, message: `Service ${serviceName} ${action}ed successfully` };
            } catch (error: unknown) {
                fastify.log.error({ err: error, action, serviceName }, 'Error performing action on service');
                reply.status(500).send({ error: getErrorMessage(error) });
            }
        },
    );

    // Run Updates
    fastify.post('/api/system/update', async (request, reply) => {
        try {
            await runCommand('docker', composeActionArgs(['pull']), { timeoutMs: 60_000, label: 'compose:pull' });
            await runCommand('docker', composeActionArgs(['up', '-d', '--remove-orphans']), {
                timeoutMs: 60_000,
                label: 'compose:up',
            });
            await runCommand('docker', ['image', 'prune', '-f'], { timeoutMs: 30_000, label: 'docker:image-prune' });
            return { success: true, message: 'System updated successfully' };
        } catch (error: unknown) {
            reply.status(500).send({ error: getErrorMessage(error) });
        }
    });

    fastify.post('/api/system/restart', async (_request, reply) => {
        try {
            await runCommand('docker', composeActionArgs(['restart']), { timeoutMs: 30_000, label: 'compose:restart' });
            return { success: true, message: 'System restarted successfully' };
        } catch (error: unknown) {
            reply.status(500).send({ error: getErrorMessage(error) });
        }
    });

    // Health Snapshot
    fastify.get('/api/health-snapshot', async (request, reply) => {
        try {
            // Re-use the containers cache when possible since this endpoint is derived data.
            const containers = await (async () => {
                if (cacheMs > 0 && containersCache && Date.now() - containersCacheAt < cacheMs) {
                    return containersCache.map((c) => ({ name: c.name, status: c.status, state: c.state }));
                }
                const output = await runCommand(
                    'docker',
                    ['ps', '-a', '--format', '"{{.Names}}|{{.Status}}|{{.State}}"'],
                    { timeoutMs: 12_000, label: 'docker ps (health)' }
                );
                return output
                    .split('\n')
                    .map((line) => line.replace(/"/g, '').trim())
                    .filter((line) => Boolean(line))
                    .map((line) => {
                        const [name, status, state] = line.split('|');
                        if (!name || !name.trim()) return null;
                        return {
                            name: name.trim(),
                            status: (status || '').trim(),
                            state: (state || '').trim(),
                        };
                    })
                    .filter((c): c is { name: string; status: string; state: string } => Boolean(c));
            })();

            const stopped = containers.filter(c => c.state !== 'running');
            const unhealthy = containers.filter(c => c.status?.includes('unhealthy'));
            const restarting = containers.filter(c => c.state === 'restarting');

            const issues: ServiceIssue[] = [];
            stopped.forEach(c => issues.push({ type: 'stopped', service: c.name, message: `${c.name} is stopped` }));
            unhealthy.forEach(c => issues.push({ type: 'unhealthy', service: c.name, message: `${c.name} is unhealthy` }));
            restarting.forEach(c => issues.push({ type: 'restarting', service: c.name, message: `${c.name} is restart-looping` }));

            const suggestions = issues.slice(0, 3).map(issue => {
                if (issue.type === 'stopped') {
                    return { action: 'start', service: issue.service, label: `Start ${issue.service}` };
                }
                if (issue.type === 'restarting') {
                    return { action: 'logs', service: issue.service, label: `Check ${issue.service} logs` };
                }
                return { action: 'restart', service: issue.service, label: `Restart ${issue.service}` };
            });

            let summary = '';
            if (issues.length === 0) {
                summary = 'All services healthy ✅';
            } else if (issues.length === 1) {
                summary = `1 issue detected: ${issues[0].message}`;
            } else {
                summary = `${issues.length} issues detected`;
            }

            return {
                healthy: issues.length === 0,
                summary,
                issues,
                suggestions,
                containerCount: containers.length,
                runningCount: containers.filter(c => c.state === 'running').length
            };
        } catch (error: unknown) {
            fastify.log.error({ err: error }, '[health-snapshot] Failed to gather docker status');
            const unavailable = isDockerUnavailable(error);
            const statusCode = unavailable ? 503 : 500;
            reply.status(statusCode).send({
                healthy: false,
                summary: unavailable ? 'Docker is not running or not installed' : 'Unable to fetch container status',
                issues: [],
                suggestions: [],
                containerCount: 0,
                runningCount: 0,
                error: getErrorMessage(error)
            });
        }
    });

    // Compose services (from docker compose config --services)
    fastify.get('/api/compose/services', async (_request, reply) => {
        try {
            const services = await getComposeServices();
            return { services };
        } catch (error: unknown) {
            // Handle compose config errors gracefully (missing .env, etc.)
            if (isComposeConfigError(error)) {
                fastify.log.debug({ err: error }, '[compose-services] Compose config incomplete (missing .env?)');
                return { services: [], configError: true, message: 'Compose configuration incomplete - generate .env first' };
            }
            const unavailable = isDockerUnavailable(error);
            if (unavailable) {
                fastify.log.debug('[compose-services] Docker not available');
                return reply.status(503).send({ error: 'Docker is not running or not installed', services: [] });
            }
            fastify.log.error({ err: error }, '[compose-services] Failed to list compose services');
            reply.status(500).send({ error: getErrorMessage(error), services: [] });
        }
    });

    // System status (cached signals + compose target)
    fastify.get('/api/system/status', async (_request, _reply) => {
        const now = Date.now();
        const cacheAge = containersCache ? now - containersCacheAt : null;
        const composeAge = composeServicesCache ? now - composeServicesCacheAt : null;
        return {
            projectRoot: PROJECT_ROOT,
            composeFile: `${PROJECT_ROOT}/docker-compose.yml`,
            cache: {
                containersMs: cacheAge,
                containersCount: containersCache?.length ?? 0,
                composeServicesMs: composeAge,
                composeServicesCount: composeServicesCache?.length ?? 0,
            },
            limits: {
                maxParallel: process.env.DOCKER_STATUS_MAX_PARALLEL || '4',
                cacheMs,
            },
        };
    });

    // Optional self-reload hook for process managers (disabled by default)
    fastify.post('/api/system/reload', async (request, _reply) => {
        const allowed = ['1', 'true', 'yes'].includes(
            String(process.env.CONTROL_SERVER_ALLOW_SELF_RELOAD || '').toLowerCase(),
        );
        if (!allowed) {
            return _reply.status(405).send({ error: 'self-reload disabled (set CONTROL_SERVER_ALLOW_SELF_RELOAD=1 to enable)' });
        }
        request.log.warn('Control server reload requested via API');
        _reply.send({ success: true, message: 'Reloading control-server process' });
        // Give the response a moment to flush
        setTimeout(() => process.exit(0), 250);
    });

    // Basic network info for building local UI links (best-effort)
    fastify.get('/api/system/network', async (_request, reply) => {
        const isContainer = (() => {
            try {
                if (fs.existsSync('/.dockerenv')) return true;
            } catch {
                // ignore
            }
            try {
                const cgroup = fs.readFileSync('/proc/1/cgroup', 'utf-8');
                return /docker|containerd|kubepods/i.test(cgroup);
            } catch {
                return false;
            }
        })();

        const interfaces = os.networkInterfaces();
        const ipv4: string[] = [];
        const ipv6: string[] = [];

        for (const infos of Object.values(interfaces)) {
            for (const info of infos || []) {
                if (!info || info.internal) continue;
                const address = (info.address || '').trim();
                if (!address) continue;
                if (info.family === 'IPv4') {
                    if (address.startsWith('169.254.')) continue;
                    ipv4.push(address);
                } else if (info.family === 'IPv6') {
                    if (address === '::1') continue;
                    if (address.toLowerCase().startsWith('fe80:')) continue;
                    ipv6.push(address);
                }
            }
        }

        const pickLanIpv4 = () => {
            const unique = Array.from(new Set(ipv4));
            const preferred =
                unique.find((ip) => ip.startsWith('192.168.')) ||
                unique.find((ip) => ip.startsWith('10.')) ||
                unique.find((ip) => ip.startsWith('172.')) ||
                unique[0] ||
                null;
            return preferred;
        };

        return reply.send({
            success: true,
            inContainer: isContainer,
            hostname: os.hostname(),
            ipv4: Array.from(new Set(ipv4)),
            ipv6: Array.from(new Set(ipv6)),
            lanIpv4: isContainer ? null : pickLanIpv4(),
        });
    });

    // Local Deploy - writes .env and runs docker-compose up
    fastify.post<{
        Body: {
            envContent: string;
            profiles: string[];
            composeFile?: string;
        };
    }>('/api/local-deploy', async (request, reply) => {
        const parseBody = z
            .object({
                envContent: z.string().min(1),
                profiles: z.array(z.string()).min(1),
                composeFile: z.string().optional(),
            })
            .safeParse(request.body);

        if (!parseBody.success) {
            return reply.status(400).send({
                success: false,
                error: 'Invalid request body',
                details: parseBody.error.issues,
            });
        }

        const { envContent, profiles, composeFile } = parseBody.data;
        const steps: Array<{ step: string; status: 'done' | 'error' }> = [];

        try {
            // Step 1: Write .env file
            const fs = await import('fs/promises');
            const path = await import('path');
            const envPath = path.join(PROJECT_ROOT, '.env');

            await fs.writeFile(envPath, envContent, 'utf-8');
            steps.push({ step: 'Wrote .env file', status: 'done' });
            fastify.log.info({ envPath }, '[local-deploy] Wrote .env file');

            // Step 2: Create required directories
            const dataRoot = envContent.match(/DATA_ROOT=(.+)/)?.[1]?.trim() || '/opt/media-stack';
            const configRoot = envContent.match(/CONFIG_ROOT=(.+)/)?.[1]?.trim() || `${dataRoot}/config`;
            const dirs = [
                configRoot,
                `${configRoot}/loki`,
                `${configRoot}/promtail`,
                `${configRoot}/grafana/provisioning/datasources`,
                `${configRoot}/grafana/provisioning/dashboards`,
                `${configRoot}/grafana/dashboards`,
                `${configRoot}/homepage`,
                `${dataRoot}/media/movies`,
                `${dataRoot}/media/tv`,
                `${dataRoot}/media/music`,
                `${dataRoot}/downloads`,
                `${dataRoot}/transcode`,
            ];

            for (const dir of dirs) {
                try {
                    await fs.mkdir(dir, { recursive: true });
                } catch {
                    // Ignore mkdir errors - may not have permissions
                }
            }
            steps.push({ step: 'Created data directories', status: 'done' });

            // Step 2b: Copy bundled config files
            const configsDir = path.join(PROJECT_ROOT, 'configs');
            const copyConfigs = async (src: string, dest: string) => {
                try {
                    const entries = await fs.readdir(src, { withFileTypes: true });
                    for (const entry of entries) {
                        const srcPath = path.join(src, entry.name);
                        const destPath = path.join(dest, entry.name);
                        if (entry.isDirectory()) {
                            await fs.mkdir(destPath, { recursive: true });
                            await copyConfigs(srcPath, destPath);
                        } else {
                            // Only copy if destination doesn't exist (don't overwrite user customizations)
                            try {
                                await fs.access(destPath);
                            } catch {
                                await fs.copyFile(srcPath, destPath);
                            }
                        }
                    }
                } catch (err) {
                    fastify.log.warn({ err, src, dest }, '[local-deploy] Config copy failed');
                }
            };

            try {
                await copyConfigs(path.join(configsDir, 'loki'), `${configRoot}/loki`);
                await copyConfigs(path.join(configsDir, 'promtail'), `${configRoot}/promtail`);
                await copyConfigs(path.join(configsDir, 'grafana'), `${configRoot}/grafana`);
                await copyConfigs(path.join(configsDir, 'homepage'), `${configRoot}/homepage`);
                steps.push({ step: 'Copied monitoring and dashboard configs', status: 'done' });
            } catch (err) {
                fastify.log.warn({ err }, '[local-deploy] Some config files could not be copied');
            }

            // Step 3: Run docker-compose up
            const composeFileName = composeFile || 'docker-compose.local.yml';

            // Set COMPOSE_PROFILES environment variable
            const env = { ...process.env, COMPOSE_PROFILES: profiles.join(',') };

            fastify.log.info({ profiles, composeFileName }, '[local-deploy] Starting docker-compose up');

            await runCommand(
                'docker',
                ['compose', '--project-directory', PROJECT_ROOT, '-f', composeFileName, 'up', '-d', '--remove-orphans'],
                { timeoutMs: 120_000, label: 'local-deploy:up', env }
            );
            steps.push({ step: 'Started containers with docker-compose', status: 'done' });

            // Step 4: Get container status
            const output = await runCommand(
                'docker',
                ['ps', '-a', '--format', '"{{.Names}}|{{.State}}"'],
                { timeoutMs: 10_000, label: 'local-deploy:ps' }
            );

            const containers = output
                .split('\n')
                .map((line) => line.replace(/"/g, '').trim())
                .filter(Boolean)
                .map((line) => {
                    const [name, state] = line.split('|');
                    return { name: name?.trim() || '', on: state?.trim() === 'running' };
                })
                .filter((c) => c.name);

            steps.push({ step: 'Verified container status', status: 'done' });

            return reply.status(200).send({
                success: true,
                steps,
                containers,
                message: `Deployed ${profiles.length} service profiles`,
            });
        } catch (error: unknown) {
            fastify.log.error({ err: error }, '[local-deploy] failed');
            const errMsg = getErrorMessage(error);
            steps.push({ step: errMsg, status: 'error' });
            return reply.status(200).send({
                success: false,
                steps,
                error: errMsg,
            });
        }
    });
}
