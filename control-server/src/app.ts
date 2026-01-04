import Fastify, { FastifyInstance, FastifyRequest } from 'fastify';
import cors from '@fastify/cors';
import compress from '@fastify/compress';
import multipart from '@fastify/multipart';
import rateLimit, { RateLimitPluginOptions } from '@fastify/rate-limit';
import { PROJECT_ROOT } from './utils/env.js';

// Rate limit context type
interface RateLimitContext {
    after: string;
    max: number;
    ttl: number;
}

import { dockerRoutes } from './routes/docker.js';
import { aiRoutes } from './routes/ai.js';
import { remoteRoutes } from './routes/remote.js';
import { arrRoutes } from './routes/arr.js';
import { orchestratorRoutes } from './routes/orchestrator.js';

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

    const parsePositiveInt = (value: string | undefined): number | null => {
        if (!value) return null;
        const trimmed = value.trim();
        if (!trimmed) return null;
        const parsed = Number.parseInt(trimmed, 10);
        if (!Number.isFinite(parsed) || parsed <= 0) return null;
        return parsed;
    };

    const parseTimeWindow = (value: string | undefined, fallback: string | number): string | number => {
        if (!value) return fallback;
        const trimmed = value.trim();
        if (!trimmed) return fallback;
        if (/^\d+$/.test(trimmed)) {
            const ms = Number.parseInt(trimmed, 10);
            if (Number.isFinite(ms) && ms > 0) return ms;
        }
        return trimmed;
    };

    const rawCorsOrigins = (process.env.CONTROL_SERVER_CORS_ORIGINS || '').trim();
    const allowedOrigins = rawCorsOrigins
        ? rawCorsOrigins.split(',').map((o) => o.trim()).filter(Boolean)
        : [
            'http://localhost:5173', // Vite dev server (docs-site)
            'http://127.0.0.1:5173',
            'http://[::1]:5173',
            'http://localhost:3000', // common local UI port
            'http://127.0.0.1:3000',
            'http://[::1]:3000',
            'http://localhost:3002', // dockerized wizard-web default
            'http://127.0.0.1:3002',
            'http://[::1]:3002',
        ];

    const isLoopbackHost = (hostname: string) =>
        hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';

    const isPrivateIpv4Host = (hostname: string) => {
        const parts = hostname.split('.');
        if (parts.length !== 4) return false;
        const nums = parts.map((p) => parseInt(p, 10));
        if (nums.some((n) => !Number.isFinite(n) || n < 0 || n > 255)) return false;
        const [a, b] = nums;
        if (a === 10) return true;
        if (a === 192 && b === 168) return true;
        if (a === 172 && b >= 16 && b <= 31) return true;
        if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
        if (a === 169 && b === 254) return true; // link-local
        return false;
    };

    const isLocalNetworkHost = (hostname: string) => {
        const lower = hostname.toLowerCase();
        if (isLoopbackHost(lower)) return true;
        if (isPrivateIpv4Host(lower)) return true;
        if (lower.startsWith('fd') || lower.startsWith('fc') || lower.startsWith('fe80:')) return true; // IPv6 ULA/link-local
        if (lower.endsWith('.local') || lower.endsWith('.lan')) return true;
        return false;
    };

    const isLocalNetworkOrigin = (origin: string) => {
        try {
            const url = new URL(origin);
            return isLocalNetworkHost(url.hostname);
        } catch {
            return false;
        }
    };

    await app.register(cors, {
        origin: (origin, cb) => {
            // Non-browser requests often have no Origin (curl, server-to-server).
            if (!origin) return cb(null, true);

            // If CONTROL_SERVER_CORS_ORIGINS is set, only allow explicitly listed origins.
            if (rawCorsOrigins) {
                if (allowedOrigins.includes(origin)) return cb(null, true);
                return cb(new Error('Not allowed by CORS'), false);
            }

            // Default dev behavior: allow local network origins (loopback, LAN IPs, .local).
            // This supports accessing the UI from another device on the same network.
            if (isLocalNetworkOrigin(origin)) return cb(null, true);
            if (allowedOrigins.includes(origin)) return cb(null, true);
            return cb(new Error('Not allowed by CORS'), false);
        }
    });

    // Response compression (gzip/brotli) for reduced payload sizes
    await app.register(compress, {
        global: true,
        encodings: ['gzip', 'deflate'],
        threshold: 1024, // Only compress responses > 1KB
    });

    const rateLimitDisabled =
        ['1', 'true', 'yes'].includes(String(process.env.CONTROL_SERVER_RATE_LIMIT_DISABLED || '').toLowerCase());

    const globalRateLimitMax = parsePositiveInt(process.env.CONTROL_SERVER_RATE_LIMIT_MAX) ?? 1000;
    const globalRateLimitWindow = parseTimeWindow(process.env.CONTROL_SERVER_RATE_LIMIT_WINDOW, '1 minute');

    // Global rate limiting with stricter limits for AI endpoints
    if (!rateLimitDisabled) {
        await app.register(rateLimit, {
            max: globalRateLimitMax, // Default: 1000 requests per minute
            timeWindow: globalRateLimitWindow,
            errorResponseBuilder: (_request: FastifyRequest, context: RateLimitContext) => ({
                statusCode: 429,
                error: 'Too Many Requests',
                message: `Rate limit exceeded. Try again in ${Math.ceil(context.ttl / 1000)} seconds.`,
                retryAfter: Math.ceil(context.ttl / 1000)
            }),
            // Skip rate limiting for health checks
            allowList: (request: FastifyRequest) => request.url === '/api/health',
            // Stricter limits for AI endpoints (10 req/min for expensive operations)
            keyGenerator: (request: FastifyRequest) => {
                const clientIp = request.ip || 'unknown';
                // Different rate limit buckets for different endpoint types
                if (request.url?.startsWith('/api/agent/chat') ||
                    request.url?.startsWith('/api/tts') ||
                    request.url?.startsWith('/api/transcribe') ||
                    request.url?.startsWith('/api/voice-agent') ||
                    request.url?.startsWith('/api/ai/') ||
                    request.url?.startsWith('/api/orchestrator/chat')) {
                    return `ai:${clientIp}`;
                }
                return clientIp;
            },
            // Override max for AI endpoints
            hook: 'preHandler',
            onExceeding: (request: FastifyRequest, key: string) => {
                // Only log at debug level - approaching is informational, not a problem
                app.log.debug({ key, url: request.url }, 'Rate limit approaching');
            },
            onExceeded: (request: FastifyRequest, key: string) => {
                app.log.warn({ key, url: request.url }, 'Rate limit exceeded');
            }
        } as RateLimitPluginOptions);
    }

    // Stricter rate limits for AI-intensive endpoints
    app.register(async (aiApp) => {
        await aiApp.register(rateLimit, {
            max: 15, // 15 AI requests per minute (prevents cost overrun)
            timeWindow: '1 minute',
            keyGenerator: (request: FastifyRequest) => `ai:${request.ip || 'unknown'}`,
            errorResponseBuilder: (_request: FastifyRequest, context: RateLimitContext) => ({
                statusCode: 429,
                error: 'AI Rate Limit Exceeded',
                message: `Too many AI requests. Try again in ${Math.ceil(context.ttl / 1000)} seconds.`,
                retryAfter: Math.ceil(context.ttl / 1000)
            })
        } as RateLimitPluginOptions);
    }, { prefix: '/api/agent' });

    app.register(async (ttsApp) => {
        await ttsApp.register(rateLimit, {
            max: 20, // 20 TTS requests per minute
            timeWindow: '1 minute',
            keyGenerator: (request: FastifyRequest) => `tts:${request.ip || 'unknown'}`,
            errorResponseBuilder: (_request: FastifyRequest, context: RateLimitContext) => ({
                statusCode: 429,
                error: 'TTS Rate Limit Exceeded',
                message: `Too many TTS requests. Try again in ${Math.ceil(context.ttl / 1000)} seconds.`,
                retryAfter: Math.ceil(context.ttl / 1000)
            })
        } as RateLimitPluginOptions);
    }, { prefix: '/api/tts' });

    // Rate limits for orchestrator endpoints (multi-agent orchestration is expensive)
    app.register(async (orchestratorApp) => {
        await orchestratorApp.register(rateLimit, {
            max: 10, // 10 orchestration requests per minute
            timeWindow: '1 minute',
            keyGenerator: (request: FastifyRequest) => `orchestrator:${request.ip || 'unknown'}`,
            errorResponseBuilder: (_request: FastifyRequest, context: RateLimitContext) => ({
                statusCode: 429,
                error: 'Orchestrator Rate Limit Exceeded',
                message: `Too many orchestration requests. Try again in ${Math.ceil(context.ttl / 1000)} seconds.`,
                retryAfter: Math.ceil(context.ttl / 1000)
            })
        } as RateLimitPluginOptions);
    }, { prefix: '/api/orchestrator' });

    // Register multipart for file uploads (audio transcription)
    await app.register(multipart, {
        limits: {
            fileSize: 25 * 1024 * 1024, // 25MB max file size for audio
        },
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
                '/api/agents',
                '/api/orchestrator'
            ]
        };
    });

    // Register Routes
    await app.register(dockerRoutes);
    await app.register(aiRoutes);
    await app.register(remoteRoutes);
    await app.register(arrRoutes);
    await app.register(orchestratorRoutes);

    return app;
};
