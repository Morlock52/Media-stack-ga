import { FastifyInstance } from 'fastify';
import * as arrService from '../services/arrService.js';
import { getErrorMessage } from '../utils/errors.js';

export async function arrRoutes(fastify: FastifyInstance) {
    // Get list of all supported services
    fastify.get('/api/arr/services', async (_request, reply) => {
        return reply.status(200).send({
            success: true,
            services: arrService.ARR_SERVICES.map(s => ({
                id: s.id,
                envKey: s.envKey,
                configType: s.configType,
                aliases: s.aliases || [],
            })),
            count: arrService.ARR_SERVICES.length,
        });
    });

    // Get all running Docker containers
    fastify.get('/api/arr/containers', async (_request, reply) => {
        try {
            const containers = await arrService.getRunningContainers();
            const discovered = await arrService.discoverAdditionalContainers();
            return reply.status(200).send({
                success: true,
                containers,
                discovered, // Unknown containers that might have API keys
                count: containers.length,
            });
        } catch (error: unknown) {
            fastify.log.error({ err: error }, '[arr/containers] failed');
            return reply.status(200).send({
                success: false,
                containers: [],
                discovered: [],
                count: 0,
                error: getErrorMessage(error),
            });
        }
    });

    // Get status of all *arr services
    fastify.get('/api/arr/status', async (_request, reply) => {
        try {
            const services = await arrService.getArrServicesStatus();
            return reply.status(200).send({ success: true, services });
        } catch (error: unknown) {
            fastify.log.error({ err: error }, '[arr/status] failed');
            return reply.status(200).send({
                success: false,
                services: [],
                error: getErrorMessage(error),
            });
        }
    });

    // Wait for *arr services to be ready
    fastify.post<{ Body: { timeout?: number; pollInterval?: number } }>('/api/arr/wait-ready', async (request, reply) => {
        const { timeout = 120000, pollInterval = 5000 } = request.body || {};
        try {
            const result = await arrService.waitForArrServices(timeout, pollInterval);
            return reply.status(200).send({
                success: result.ready,
                ...result,
            });
        } catch (error: unknown) {
            fastify.log.error({ err: error }, '[arr/wait-ready] failed');
            return reply.status(200).send({
                success: false,
                ready: false,
                services: [],
                error: getErrorMessage(error),
            });
        }
    });

    // Bootstrap: extract API keys and write to .env
    fastify.post('/api/arr/bootstrap', async (_request, reply) => {
        let keys: Record<string, string> = {};
        try {
            keys = await arrService.extractArrKeys();

            if (Object.keys(keys).length === 0) {
                return reply.status(200).send({
                    success: false,
                    keys: {},
                    error: 'No keys were found. Make sure your containers are running and initialized (config.xml must exist).',
                });
            }

            try {
                arrService.writeArrKeysToEnv(keys);
                return reply.status(200).send({ success: true, keys });
            } catch (error: unknown) {
                return reply.status(200).send({
                    success: false,
                    keys,
                    error: getErrorMessage(error),
                });
            }
        } catch (error: unknown) {
            fastify.log.error({ err: error }, '[arr/bootstrap] failed');
            return reply.status(200).send({
                success: false,
                keys,
                error: getErrorMessage(error),
            });
        }
    });

    // Get detailed extraction results (without writing to .env)
    fastify.get('/api/arr/extract', async (_request, reply) => {
        try {
            const keys = await arrService.extractArrKeysDetailed();
            return reply.status(200).send({
                success: true,
                keys,
                count: keys.length,
            });
        } catch (error: unknown) {
            fastify.log.error({ err: error }, '[arr/extract] failed');
            return reply.status(200).send({
                success: false,
                keys: [],
                count: 0,
                error: getErrorMessage(error),
            });
        }
    });

    // Full bootstrap: wait for services, extract keys, write to .env
    fastify.post<{ Body: { timeout?: number; pollInterval?: number } }>('/api/arr/auto-bootstrap', async (request, reply) => {
        const { timeout = 120000, pollInterval = 5000 } = request.body || {};

        try {
            // Step 1: Wait for services to be ready
            fastify.log.info('[arr/auto-bootstrap] Waiting for *arr services to initialize...');
            const waitResult = await arrService.waitForArrServices(timeout, pollInterval);

            if (!waitResult.ready) {
                const notReady = waitResult.services.filter(s => s.running && !s.ready);
                return reply.status(200).send({
                    success: false,
                    step: 'wait',
                    keys: {},
                    services: waitResult.services,
                    error: `Timeout: Some services not ready: ${notReady.map(s => s.id).join(', ')}`,
                });
            }

            // Step 2: Extract API keys
            fastify.log.info('[arr/auto-bootstrap] Extracting API keys...');
            const keys = await arrService.extractArrKeys();

            if (Object.keys(keys).length === 0) {
                return reply.status(200).send({
                    success: false,
                    step: 'extract',
                    keys: {},
                    services: waitResult.services,
                    error: 'No API keys found in running services.',
                });
            }

            // Step 2b: Validate keys (best-effort) before returning them to the UI
            fastify.log.info('[arr/auto-bootstrap] Validating extracted keys...');
            const validations = await arrService.validateArrKeys(keys, waitResult.services);

            // Step 3: Write to .env
            fastify.log.info('[arr/auto-bootstrap] Writing keys to .env...');
            try {
                arrService.writeArrKeysToEnv(keys);
            } catch (error: unknown) {
                return reply.status(200).send({
                    success: false,
                    step: 'write',
                    keys,
                    validations,
                    services: waitResult.services,
                    error: getErrorMessage(error),
                });
            }

            fastify.log.info({ keys: Object.keys(keys) }, '[arr/auto-bootstrap] Complete!');
            return reply.status(200).send({
                success: true,
                step: 'complete',
                keys,
                validations,
                services: waitResult.services,
            });
        } catch (error: unknown) {
            fastify.log.error({ err: error }, '[arr/auto-bootstrap] failed');
            return reply.status(200).send({
                success: false,
                step: 'error',
                keys: {},
                services: [],
                error: getErrorMessage(error),
            });
        }
    });
}
