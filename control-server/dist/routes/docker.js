import { runCommand } from '../utils/docker.js';
export async function dockerRoutes(fastify) {
    const cacheMs = Math.max(0, parseInt(process.env.DOCKER_STATUS_CACHE_MS || '1500', 10) || 0);
    let containersCache = null;
    let containersCacheAt = 0;
    let containersInFlight = null;
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
                const output = await runCommand('docker', [
                    'ps',
                    '-a',
                    '--format',
                    '"{{.ID}}|{{.Names}}|{{.Status}}|{{.State}}|{{.Ports}}"'
                ]);
                const containers = output
                    .split('\n')
                    .filter(line => line)
                    .map(line => {
                    const [id, name, status, state, ports] = line.replace(/"/g, '').split('|');
                    return { id, name, status, state, ports };
                });
                if (cacheMs > 0) {
                    containersCache = containers;
                    containersCacheAt = Date.now();
                }
                return containers;
            })();
            try {
                return await containersInFlight;
            }
            finally {
                containersInFlight = null;
            }
        }
        catch (error) {
            fastify.log.error('Error fetching containers:', error);
            reply.status(500).send({ error: 'Failed to fetch container status' });
        }
    });
    // Start/Stop/Restart a Service
    fastify.post('/api/service/:action', async (request, reply) => {
        const { action } = request.params;
        const { serviceName } = request.body;
        if (!['start', 'stop', 'restart', 'up'].includes(action)) {
            return reply.status(400).send({ error: 'Invalid action' });
        }
        try {
            let cmdArgs = [];
            if (action === 'up') {
                cmdArgs = ['compose', 'up', '-d', serviceName];
            }
            else if (action === 'start') {
                cmdArgs = ['compose', 'start', serviceName];
            }
            else if (action === 'stop') {
                cmdArgs = ['compose', 'stop', serviceName];
            }
            else if (action === 'restart') {
                cmdArgs = ['compose', 'restart', serviceName];
            }
            await runCommand('docker', cmdArgs);
            return { success: true, message: `Service ${serviceName} ${action}ed successfully` };
        }
        catch (error) {
            fastify.log.error(`Error performing ${action} on ${serviceName}:`, error);
            reply.status(500).send({ error: error.message });
        }
    });
    // Run Updates
    fastify.post('/api/system/update', async (request, reply) => {
        try {
            await runCommand('docker', ['compose', 'pull']);
            await runCommand('docker', ['compose', 'up', '-d', '--remove-orphans']);
            await runCommand('docker', ['image', 'prune', '-f']);
            return { success: true, message: 'System updated successfully' };
        }
        catch (error) {
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
                const output = await runCommand('docker', [
                    'ps', '-a', '--format', '"{{.Names}}|{{.Status}}|{{.State}}"'
                ]);
                return output.split('\n').filter(l => l).map(line => {
                    const [name, status, state] = line.replace(/"/g, '').split('|');
                    return { name, status, state };
                });
            })();
            const stopped = containers.filter(c => c.state !== 'running');
            const unhealthy = containers.filter(c => c.status?.includes('unhealthy'));
            const restarting = containers.filter(c => c.state === 'restarting');
            const issues = [];
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
            }
            else if (issues.length === 1) {
                summary = `1 issue detected: ${issues[0].message}`;
            }
            else {
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
        }
        catch (error) {
            fastify.log.error({ err: error }, '[health-snapshot] Failed to gather docker status');
            reply.status(500).send({
                healthy: false,
                summary: 'Unable to fetch container status',
                issues: [],
                suggestions: [],
                containerCount: 0,
                runningCount: 0,
                error: error?.message || 'unknown'
            });
        }
    });
}
