import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import { PROJECT_ROOT } from './utils/env.js';
import pino from 'pino';

import { dockerRoutes } from './routes/docker.js';
import { aiRoutes } from './routes/ai.js';

export const buildApp = async (): Promise<FastifyInstance> => {
    const app = Fastify({
        logger: {
            level: process.env.LOG_LEVEL || 'info',
            transport: {
                target: 'pino-pretty',
                options: {
                    colorize: true
                }
            }
        }
    });

    await app.register(cors, {
        origin: '*' // Configure appropriately for production
    });

    // Health Check
    app.get('/api/health', async (request, reply) => {
        return { status: 'online', version: '2.0.0', backend: 'fastify' };
    });

    // Register Routes
    await app.register(dockerRoutes);
    await app.register(aiRoutes);

    return app;
};
