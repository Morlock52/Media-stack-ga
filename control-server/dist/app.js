import Fastify from 'fastify';
import cors from '@fastify/cors';
import { dockerRoutes } from './routes/docker.js';
import multipart from '@fastify/multipart';
import { aiRoutes } from './routes/ai.js';
import { remoteRoutes } from './routes/remote.js';
import { generatorRoutes } from './routes/generator.js';
import { registryRoutes } from './routes/registry.js';
export const buildApp = async () => {
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
    await app.register(multipart);
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
    await app.register(generatorRoutes);
    await app.register(registryRoutes);
    return app;
};
