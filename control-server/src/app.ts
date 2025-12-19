import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import { PROJECT_ROOT } from './utils/env.js';

import { dockerRoutes } from './routes/docker.js';
import { aiRoutes } from './routes/ai.js';
import { remoteRoutes } from './routes/remote.js';
import { arrRoutes } from './routes/arr.js';

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

    const rawCorsOrigins = (process.env.CONTROL_SERVER_CORS_ORIGINS || '').trim();
    const allowedOrigins = rawCorsOrigins
        ? rawCorsOrigins.split(',').map((o) => o.trim()).filter(Boolean)
        : [
            'http://localhost:5173', // Vite dev server (docs-site)
            'http://localhost:3000', // common local UI port
            'http://localhost:3002', // dockerized wizard-web default
        ];

    await app.register(cors, {
        origin: (origin, cb) => {
            // Non-browser requests often have no Origin (curl, server-to-server).
            if (!origin) return cb(null, true);
            if (allowedOrigins.includes(origin)) return cb(null, true);
            return cb(new Error('Not allowed by CORS'), false);
        }
    });

    // Optional API auth (recommended when control-server is reachable beyond localhost)
    app.addHook('onRequest', async (request, reply) => {
        const token = (process.env.CONTROL_SERVER_TOKEN || '').trim();
        if (!token) return;

        const url = request.raw.url || '';
        if (url === '/api/health') return;

        const authHeader = request.headers.authorization || '';
        const expected = `Bearer ${token}`;
        if (authHeader !== expected) {
            return reply.status(401).send({ error: 'Unauthorized' });
        }
    });

    // Health Check
    app.get('/api/health', async (request, reply) => {
        return { status: 'online', version: '2.0.0', backend: 'fastify' };
    });

    // Root Request (Friendly Message)
    app.get('/', async (request, reply) => {
        return {
            service: 'Media Stack Control Server',
            status: 'running',
            version: '2.0.0',
            endpoints: [
                '/api/health',
                '/api/containers',
                '/api/agents'
            ]
        };
    });

    // Register Routes
    await app.register(dockerRoutes);
    await app.register(aiRoutes);
    await app.register(remoteRoutes);
    await app.register(arrRoutes);

    return app;
};
