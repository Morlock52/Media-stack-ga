import { FastifyInstance } from 'fastify';
import { runCommand } from '../utils/docker.js';
import { Container, ServiceIssue } from '../types/index.js';
import { PROJECT_ROOT } from '../utils/env.js';
import { z } from 'zod';

export async function dockerRoutes(fastify: FastifyInstance) {
    const cacheMs = Math.max(0, parseInt(process.env.DOCKER_STATUS_CACHE_MS || '1500', 10) || 0);

    let containersCache: Container[] | null = null;
    let containersCacheAt = 0;
    let containersInFlight: Promise<Container[]> | null = null;
    let composeServicesCache: string[] | null = null;
    let composeServicesCacheAt = 0;
    let composeServicesInFlight: Promise<string[]> | null = null;

    const isDockerUnavailable = (error: any) => {
        const msg = String(error?.message || '').toLowerCase();
        return msg.includes('docker daemon is not running')
            || msg.includes('docker: command not found')
            || msg.includes('required cli')
            || msg.includes('docker cli is not available')
            || msg.includes('connect to the docker daemon')
            || msg.includes('no such file or directory') && msg.includes('docker');
    };

    const getComposeServices = async (): Promise<string[]> => {
        const now = Date.now();
        if (cacheMs > 0 && composeServicesCache && now - composeServicesCacheAt < cacheMs) {
            return composeServicesCache;
        }
        if (composeServicesInFlight) return composeServicesInFlight;

        composeServicesInFlight = (async () => {
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
        } catch (error: any) {
            fastify.log.error('Error fetching containers:', error);
            if (isDockerUnavailable(error)) {
                return reply.status(503).send({
                    error: 'docker_unavailable',
                    message: error?.message || 'Docker is not running or not installed',
                    containers: []
                });
            }
            reply.status(500).send({ error: error?.message || 'Failed to fetch container status' });
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
            } catch (error: any) {
                fastify.log.error(`Error performing ${action} on ${serviceName}:`, error);
                reply.status(500).send({ error: error.message });
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
        } catch (error: any) {
            reply.status(500).send({ error: error.message });
        }
    });

    fastify.post('/api/system/restart', async (_request, reply) => {
        try {
            await runCommand('docker', composeActionArgs(['restart']), { timeoutMs: 30_000, label: 'compose:restart' });
            return { success: true, message: 'System restarted successfully' };
        } catch (error: any) {
            reply.status(500).send({ error: error.message });
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
        } catch (error: any) {
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
                error: error?.message || 'unknown'
            });
        }
    });

    // Compose services (from docker compose config --services)
    fastify.get('/api/compose/services', async (_request, reply) => {
        try {
            const services = await getComposeServices();
            return { services };
        } catch (error: any) {
            fastify.log.error({ err: error }, '[compose-services] Failed to list compose services');
            const unavailable = isDockerUnavailable(error);
            reply
                .status(unavailable ? 503 : 500)
                .send({ error: unavailable ? 'Docker is not running or not installed' : error?.message || 'Failed to list compose services' });
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
}
