import { FastifyInstance } from 'fastify';
import * as arrService from '../services/arrService.js';

export async function arrRoutes(fastify: FastifyInstance) {
    fastify.post('/api/arr/bootstrap', async (_request, reply) => {
        try {
            const results = await arrService.bootstrapArrKeys();
            return { success: true, keys: results };
        } catch (error: any) {
            fastify.log.error({ err: error }, '[arr/bootstrap] failed');
            return reply.status(500).send({ success: false, error: error?.message || 'Bootstrap failed' });
        }
    });
}

