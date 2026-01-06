import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { getErrorMessage } from '../utils/errors.js';
import {
    validateConfiguration,
    runSpecificValidators,
    quickValidation,
    clearValidationCache
} from '../services/validationService.js';
import type {
    ValidationRequest,
    ValidatorType
} from '../types/index.js';

/**
 * Validation Routes
 * Endpoints for running configuration validation
 */
export async function validationRoutes(fastify: FastifyInstance) {
    /**
     * POST /api/validate
     * Run full validation with config payload
     */
    fastify.post<{ Body: ValidationRequest }>(
        '/api/validate',
        async (request, reply) => {
            try {
                // Validate request body schema
                const parseBody = z.object({
                    config: z.record(z.unknown()),
                    validators: z.array(z.enum(['path', 'port', 'vpn', 'cloudflare', 'docker', 'environment'])).optional(),
                    validatorConfigs: z.record(z.object({
                        enabled: z.boolean(),
                        timeout: z.number().optional(),
                        options: z.record(z.unknown()).optional()
                    })).optional()
                }).safeParse(request.body);

                if (!parseBody.success) {
                    return reply.status(400).send({
                        error: 'Invalid request body',
                        details: parseBody.error.issues
                    });
                }

                const validationRequest = parseBody.data;

                // Check if cache should be bypassed
                const useCache = request.headers['x-bypass-cache'] !== 'true';

                fastify.log.info({
                    validators: validationRequest.validators || 'all',
                    useCache
                }, '[validate] Running configuration validation');

                // Run validation
                const result = await validateConfiguration(validationRequest, useCache);

                return reply.status(200).send(result);
            } catch (error: unknown) {
                fastify.log.error({ err: error }, '[validate] Validation failed');
                return reply.status(500).send({
                    error: 'Validation failed',
                    message: getErrorMessage(error)
                });
            }
        }
    );

    /**
     * POST /api/validate/paths
     * Validate paths only
     */
    fastify.post<{ Body: { config: Record<string, unknown> } }>(
        '/api/validate/paths',
        async (request, reply) => {
            try {
                const parseBody = z.object({
                    config: z.record(z.unknown())
                }).safeParse(request.body);

                if (!parseBody.success) {
                    return reply.status(400).send({
                        error: 'Invalid request body',
                        details: parseBody.error.issues
                    });
                }

                const { config } = parseBody.data;

                fastify.log.debug('[validate/paths] Running path validation');

                const result = await runSpecificValidators(['path'], config);

                return reply.status(200).send(result);
            } catch (error: unknown) {
                fastify.log.error({ err: error }, '[validate/paths] Path validation failed');
                return reply.status(500).send({
                    error: 'Path validation failed',
                    message: getErrorMessage(error)
                });
            }
        }
    );

    /**
     * POST /api/validate/ports
     * Check port conflicts
     */
    fastify.post<{ Body: { config: Record<string, unknown> } }>(
        '/api/validate/ports',
        async (request, reply) => {
            try {
                const parseBody = z.object({
                    config: z.record(z.unknown())
                }).safeParse(request.body);

                if (!parseBody.success) {
                    return reply.status(400).send({
                        error: 'Invalid request body',
                        details: parseBody.error.issues
                    });
                }

                const { config } = parseBody.data;

                fastify.log.debug('[validate/ports] Running port validation');

                const result = await runSpecificValidators(['port'], config);

                return reply.status(200).send(result);
            } catch (error: unknown) {
                fastify.log.error({ err: error }, '[validate/ports] Port validation failed');
                return reply.status(500).send({
                    error: 'Port validation failed',
                    message: getErrorMessage(error)
                });
            }
        }
    );

    /**
     * POST /api/validate/vpn
     * Validate VPN credentials
     */
    fastify.post<{ Body: { config: Record<string, unknown> } }>(
        '/api/validate/vpn',
        async (request, reply) => {
            try {
                const parseBody = z.object({
                    config: z.record(z.unknown())
                }).safeParse(request.body);

                if (!parseBody.success) {
                    return reply.status(400).send({
                        error: 'Invalid request body',
                        details: parseBody.error.issues
                    });
                }

                const { config } = parseBody.data;

                fastify.log.debug('[validate/vpn] Running VPN validation');

                const result = await runSpecificValidators(['vpn'], config);

                return reply.status(200).send(result);
            } catch (error: unknown) {
                fastify.log.error({ err: error }, '[validate/vpn] VPN validation failed');
                return reply.status(500).send({
                    error: 'VPN validation failed',
                    message: getErrorMessage(error)
                });
            }
        }
    );

    /**
     * POST /api/validate/cloudflare
     * Validate Cloudflare tunnel configuration
     */
    fastify.post<{ Body: { config: Record<string, unknown> } }>(
        '/api/validate/cloudflare',
        async (request, reply) => {
            try {
                const parseBody = z.object({
                    config: z.record(z.unknown())
                }).safeParse(request.body);

                if (!parseBody.success) {
                    return reply.status(400).send({
                        error: 'Invalid request body',
                        details: parseBody.error.issues
                    });
                }

                const { config } = parseBody.data;

                fastify.log.debug('[validate/cloudflare] Running Cloudflare validation');

                const result = await runSpecificValidators(['cloudflare'], config);

                return reply.status(200).send(result);
            } catch (error: unknown) {
                fastify.log.error({ err: error }, '[validate/cloudflare] Cloudflare validation failed');
                return reply.status(500).send({
                    error: 'Cloudflare validation failed',
                    message: getErrorMessage(error)
                });
            }
        }
    );

    /**
     * POST /api/validate/docker
     * Check Docker environment
     */
    fastify.post<{ Body: { config: Record<string, unknown> } }>(
        '/api/validate/docker',
        async (request, reply) => {
            try {
                const parseBody = z.object({
                    config: z.record(z.unknown())
                }).safeParse(request.body);

                if (!parseBody.success) {
                    return reply.status(400).send({
                        error: 'Invalid request body',
                        details: parseBody.error.issues
                    });
                }

                const { config } = parseBody.data;

                fastify.log.debug('[validate/docker] Running Docker validation');

                const result = await runSpecificValidators(['docker'], config);

                return reply.status(200).send(result);
            } catch (error: unknown) {
                fastify.log.error({ err: error }, '[validate/docker] Docker validation failed');
                return reply.status(500).send({
                    error: 'Docker validation failed',
                    message: getErrorMessage(error)
                });
            }
        }
    );

    /**
     * GET /api/validate/quick
     * Quick environment health check (Docker + paths only)
     */
    fastify.get<{ Querystring: { dataRoot?: string; configRoot?: string } }>(
        '/api/validate/quick',
        async (request, reply) => {
            try {
                const parseQuery = z.object({
                    dataRoot: z.string().optional(),
                    configRoot: z.string().optional()
                }).safeParse(request.query);

                if (!parseQuery.success) {
                    return reply.status(400).send({
                        error: 'Invalid query parameters',
                        details: parseQuery.error.issues
                    });
                }

                const { dataRoot, configRoot } = parseQuery.data;

                fastify.log.debug('[validate/quick] Running quick validation');

                // Build minimal config for quick check
                const config: Record<string, unknown> = {};
                if (dataRoot) config.dataRoot = dataRoot;
                if (configRoot) config.configRoot = configRoot;

                const result = await quickValidation(config);

                return reply.status(200).send(result);
            } catch (error: unknown) {
                fastify.log.error({ err: error }, '[validate/quick] Quick validation failed');
                return reply.status(500).send({
                    error: 'Quick validation failed',
                    message: getErrorMessage(error)
                });
            }
        }
    );

    /**
     * POST /api/validate/clear-cache
     * Clear validation cache
     */
    fastify.post(
        '/api/validate/clear-cache',
        async (_request, reply) => {
            try {
                fastify.log.debug('[validate/clear-cache] Clearing validation cache');

                clearValidationCache();

                return reply.status(200).send({
                    success: true,
                    message: 'Validation cache cleared'
                });
            } catch (error: unknown) {
                fastify.log.error({ err: error }, '[validate/clear-cache] Failed to clear cache');
                return reply.status(500).send({
                    error: 'Failed to clear cache',
                    message: getErrorMessage(error)
                });
            }
        }
    );
}
