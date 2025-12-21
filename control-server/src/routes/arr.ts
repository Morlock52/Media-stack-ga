import { FastifyInstance } from 'fastify';
import * as arrService from '../services/arrService.js';

export async function arrRoutes(fastify: FastifyInstance) {
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
}

