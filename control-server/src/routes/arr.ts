import { FastifyInstance } from 'fastify';
import * as arrService from '../services/arrService.js';

export async function arrRoutes(fastify: FastifyInstance) {
    // Get status of all *arr services
    fastify.get('/api/arr/status', async (_request, reply) => {
        try {
            const services = await arrService.getArrServicesStatus();
            return reply.status(200).send({ success: true, services });
        } catch (error: any) {
            fastify.log.error({ err: error }, '[arr/status] failed');
            return reply.status(200).send({
                success: false,
                services: [],
                error: error?.message || 'Failed to get status',
            });
        }
    });

    // Wait for *arr services to be ready
    fastify.post('/api/arr/wait-ready', async (request, reply) => {
        const { timeout = 120000, pollInterval = 5000 } = (request.body as any) || {};
        try {
            const result = await arrService.waitForArrServices(timeout, pollInterval);
            return reply.status(200).send({
                success: result.ready,
                ...result,
            });
        } catch (error: any) {
            fastify.log.error({ err: error }, '[arr/wait-ready] failed');
            return reply.status(200).send({
                success: false,
                ready: false,
                services: [],
                error: error?.message || 'Wait failed',
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
            } catch (error: any) {
                return reply.status(200).send({
                    success: false,
                    keys,
                    error: error?.message || 'Failed to write keys to .env',
                });
            }
        } catch (error: any) {
            fastify.log.error({ err: error }, '[arr/bootstrap] failed');
            return reply.status(200).send({
                success: false,
                keys,
                error: error?.message || 'Bootstrap failed',
            });
        }
    });

    // Full bootstrap: wait for services, extract keys, write to .env
    fastify.post('/api/arr/auto-bootstrap', async (request, reply) => {
        const { timeout = 120000, pollInterval = 5000 } = (request.body as any) || {};

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

            // Step 3: Write to .env
            fastify.log.info('[arr/auto-bootstrap] Writing keys to .env...');
            try {
                arrService.writeArrKeysToEnv(keys);
            } catch (error: any) {
                return reply.status(200).send({
                    success: false,
                    step: 'write',
                    keys,
                    services: waitResult.services,
                    error: error?.message || 'Failed to write keys to .env',
                });
            }

            fastify.log.info({ keys: Object.keys(keys) }, '[arr/auto-bootstrap] Complete!');
            return reply.status(200).send({
                success: true,
                step: 'complete',
                keys,
                services: waitResult.services,
            });
        } catch (error: any) {
            fastify.log.error({ err: error }, '[arr/auto-bootstrap] failed');
            return reply.status(200).send({
                success: false,
                step: 'error',
                keys: {},
                services: [],
                error: error?.message || 'Auto-bootstrap failed',
            });
        }
    });
}

