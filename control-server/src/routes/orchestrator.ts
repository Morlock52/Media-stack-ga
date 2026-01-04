/**
 * Orchestrator API Routes
 * Provides endpoints for multi-agent orchestration system
 */

import { FastifyInstance } from 'fastify';
import { orchestrator } from '../orchestrator/orchestrator.js';
import { mcpBridge } from '../orchestrator/mcpBridge.js';
import { sharedMemoryManager } from '../orchestrator/sharedMemory.js';
import { getErrorMessage } from '../utils/errors.js';
import type { OrchestrationRequest, ExecutionStrategy, SwarmTopology, SwarmStrategy } from '../orchestrator/types.js';

// Request body types
interface ChatRequestBody {
    message: string;
    history?: Array<{ role: 'user' | 'assistant'; content: string }>;
    orchestrate?: boolean;
    maxAgents?: number;
    timeout?: number;
    strategy?: ExecutionStrategy;
}

interface SwarmInitBody {
    topology?: SwarmTopology;
    maxAgents?: number;
    strategy?: SwarmStrategy;
}

export async function orchestratorRoutes(fastify: FastifyInstance) {
    /**
     * POST /api/orchestrator/chat
     * Main orchestrated chat endpoint
     */
    fastify.post<{ Body: ChatRequestBody }>('/api/orchestrator/chat', async (request, reply) => {
        const {
            message,
            history = [],
            orchestrate = true,
            maxAgents,
            timeout,
            strategy,
        } = request.body;

        if (!message || typeof message !== 'string') {
            return reply.status(400).send({
                success: false,
                error: 'Message is required and must be a string',
            });
        }

        try {
            const orchestrationRequest: OrchestrationRequest = {
                message,
                history,
                orchestrate,
                maxAgents,
                timeout,
                strategy,
            };

            const result = await orchestrator.processRequest(orchestrationRequest, { history });

            return reply.status(200).send({
                success: !result.error,
                ...result,
            });
        } catch (error) {
            fastify.log.error({ err: error }, '[orchestrator/chat] failed');
            return reply.status(500).send({
                success: false,
                error: getErrorMessage(error),
            });
        }
    });

    /**
     * GET /api/orchestrator/plan/:planId
     * Get execution plan status
     */
    fastify.get<{ Params: { planId: string } }>('/api/orchestrator/plan/:planId', async (request, reply) => {
        const { planId } = request.params;

        if (!planId) {
            return reply.status(400).send({
                success: false,
                error: 'Plan ID is required',
            });
        }

        try {
            const plan = orchestrator.getPlan(planId);

            if (!plan) {
                return reply.status(404).send({
                    success: false,
                    error: 'Plan not found',
                });
            }

            return reply.status(200).send({
                success: true,
                plan: {
                    id: plan.id,
                    status: plan.status,
                    strategy: plan.strategy,
                    taskCount: plan.tasks.length,
                    completedTasks: plan.tasks.filter(t => t.status === 'completed').length,
                    failedTasks: plan.tasks.filter(t => t.status === 'failed').length,
                    createdAt: plan.createdAt,
                    startedAt: plan.startedAt,
                    completedAt: plan.completedAt,
                    estimatedDuration: plan.estimatedDuration,
                },
            });
        } catch (error) {
            fastify.log.error({ err: error, planId }, '[orchestrator/plan] failed');
            return reply.status(500).send({
                success: false,
                error: getErrorMessage(error),
            });
        }
    });

    /**
     * GET /api/orchestrator/tasks/:planId
     * List tasks for a plan
     */
    fastify.get<{ Params: { planId: string } }>('/api/orchestrator/tasks/:planId', async (request, reply) => {
        const { planId } = request.params;

        if (!planId) {
            return reply.status(400).send({
                success: false,
                error: 'Plan ID is required',
            });
        }

        try {
            const plan = orchestrator.getPlan(planId);

            if (!plan) {
                return reply.status(404).send({
                    success: false,
                    error: 'Plan not found',
                });
            }

            return reply.status(200).send({
                success: true,
                planId,
                tasks: plan.tasks.map(task => ({
                    id: task.id,
                    type: task.type,
                    description: task.description,
                    status: task.status,
                    priority: task.priority,
                    targetAgent: task.targetAgent,
                    tool: task.tool,
                    dependencies: task.dependencies,
                    startedAt: task.startedAt,
                    completedAt: task.completedAt,
                    error: task.error,
                })),
                summary: {
                    total: plan.tasks.length,
                    pending: plan.tasks.filter(t => t.status === 'pending').length,
                    running: plan.tasks.filter(t => t.status === 'running').length,
                    completed: plan.tasks.filter(t => t.status === 'completed').length,
                    failed: plan.tasks.filter(t => t.status === 'failed').length,
                },
            });
        } catch (error) {
            fastify.log.error({ err: error, planId }, '[orchestrator/tasks] failed');
            return reply.status(500).send({
                success: false,
                error: getErrorMessage(error),
            });
        }
    });

    /**
     * POST /api/orchestrator/swarm/init
     * Initialize MCP swarm
     */
    fastify.post<{ Body: SwarmInitBody }>('/api/orchestrator/swarm/init', async (request, reply) => {
        const { topology = 'hierarchical', maxAgents = 8, strategy = 'adaptive' } = request.body || {};

        try {
            const result = await mcpBridge.initializeSwarm({
                topology,
                maxAgents,
                strategy,
            });

            return reply.status(200).send({
                success: result.success,
                provider: result.provider,
                swarmId: result.swarmId,
                error: result.error,
            });
        } catch (error) {
            fastify.log.error({ err: error }, '[orchestrator/swarm/init] failed');
            return reply.status(500).send({
                success: false,
                error: getErrorMessage(error),
            });
        }
    });

    /**
     * GET /api/orchestrator/swarm/status
     * Get swarm health and status
     */
    fastify.get('/api/orchestrator/swarm/status', async (request, reply) => {
        try {
            const status = await mcpBridge.getSwarmStatus();
            const health = await mcpBridge.healthCheck();
            const memory = await mcpBridge.getMemoryUsage();
            const agents = mcpBridge.getSpawnedAgents();

            return reply.status(200).send({
                success: true,
                initialized: mcpBridge.isInitialized(),
                provider: mcpBridge.getProvider(),
                swarm: status,
                health: {
                    healthy: health.healthy,
                    details: health.details,
                },
                memory,
                agents: agents.map(a => ({
                    id: a.agentId,
                    type: a.type,
                    name: a.name,
                    capabilities: a.capabilities,
                })),
            });
        } catch (error) {
            fastify.log.error({ err: error }, '[orchestrator/swarm/status] failed');
            return reply.status(500).send({
                success: false,
                error: getErrorMessage(error),
            });
        }
    });

    /**
     * POST /api/orchestrator/abort/:planId
     * Abort a running plan
     */
    fastify.post<{ Params: { planId: string } }>('/api/orchestrator/abort/:planId', async (request, reply) => {
        const { planId } = request.params;

        if (!planId) {
            return reply.status(400).send({
                success: false,
                error: 'Plan ID is required',
            });
        }

        try {
            const aborted = await orchestrator.abortPlan(planId);

            if (!aborted) {
                return reply.status(404).send({
                    success: false,
                    error: 'Plan not found or already completed',
                });
            }

            return reply.status(200).send({
                success: true,
                message: `Plan ${planId} has been aborted`,
            });
        } catch (error) {
            fastify.log.error({ err: error, planId }, '[orchestrator/abort] failed');
            return reply.status(500).send({
                success: false,
                error: getErrorMessage(error),
            });
        }
    });

    /**
     * POST /api/orchestrator/swarm/spawn
     * Spawn a new agent in the swarm
     */
    fastify.post<{ Body: { type: string; capabilities?: string[]; name?: string } }>('/api/orchestrator/swarm/spawn', async (request, reply) => {
        const { type, capabilities = [], name } = request.body || {};

        if (!type) {
            return reply.status(400).send({
                success: false,
                error: 'Agent type is required',
            });
        }

        try {
            const result = await mcpBridge.spawnAgent(type, capabilities, name);

            return reply.status(200).send({
                success: result.success,
                agent: result.agent,
                error: result.error,
            });
        } catch (error) {
            fastify.log.error({ err: error }, '[orchestrator/swarm/spawn] failed');
            return reply.status(500).send({
                success: false,
                error: getErrorMessage(error),
            });
        }
    });

    /**
     * GET /api/orchestrator/memory/stats
     * Get shared memory statistics
     */
    fastify.get('/api/orchestrator/memory/stats', async (request, reply) => {
        try {
            const stats = await sharedMemoryManager.getStats();

            return reply.status(200).send({
                success: true,
                ...stats,
            });
        } catch (error) {
            fastify.log.error({ err: error }, '[orchestrator/memory/stats] failed');
            return reply.status(500).send({
                success: false,
                error: getErrorMessage(error),
            });
        }
    });

    /**
     * POST /api/orchestrator/cleanup
     * Cleanup all orchestrator resources
     */
    fastify.post('/api/orchestrator/cleanup', async (request, reply) => {
        try {
            await mcpBridge.cleanup();
            await sharedMemoryManager.clearAll();

            return reply.status(200).send({
                success: true,
                message: 'Orchestrator resources cleaned up',
            });
        } catch (error) {
            fastify.log.error({ err: error }, '[orchestrator/cleanup] failed');
            return reply.status(500).send({
                success: false,
                error: getErrorMessage(error),
            });
        }
    });

    /**
     * GET /api/orchestrator/capabilities
     * List all available tools, agents, and their metadata
     */
    fastify.get('/api/orchestrator/capabilities', async (_request, reply) => {
        try {
            const capabilities = orchestrator.getCapabilities();

            return reply.status(200).send({
                success: true,
                ...capabilities,
            });
        } catch (error) {
            fastify.log.error({ err: error }, '[orchestrator/capabilities] failed');
            return reply.status(500).send({
                success: false,
                error: getErrorMessage(error),
            });
        }
    });

    /**
     * POST /api/orchestrator/tools/execute
     * Direct tool execution for automation
     */
    fastify.post<{ Body: { tool: string; params?: Record<string, unknown> } }>(
        '/api/orchestrator/tools/execute',
        async (request, reply) => {
            const { tool, params = {} } = request.body;

            if (!tool || typeof tool !== 'string') {
                return reply.status(400).send({
                    success: false,
                    error: 'Tool name is required',
                });
            }

            try {
                const result = await orchestrator.executeToolDirect(tool, params);

                return reply.status(200).send({
                    success: result.success,
                    tool,
                    result: result.data,
                    error: result.error,
                });
            } catch (error) {
                fastify.log.error({ err: error, tool }, '[orchestrator/tools/execute] failed');
                return reply.status(500).send({
                    success: false,
                    error: getErrorMessage(error),
                });
            }
        }
    );

    /**
     * POST /api/orchestrator/deploy
     * Deploy the full stack with dependency ordering
     */
    fastify.post<{ Body: { services?: string[]; profile?: string } }>(
        '/api/orchestrator/deploy',
        async (request, reply) => {
            const { services, profile } = request.body || {};

            try {
                const result = await orchestrator.deployStack({ services, profile });

                return reply.status(200).send({
                    success: result.success,
                    deployed: result.deployed,
                    failed: result.failed,
                    message: result.message,
                });
            } catch (error) {
                fastify.log.error({ err: error }, '[orchestrator/deploy] failed');
                return reply.status(500).send({
                    success: false,
                    error: getErrorMessage(error),
                });
            }
        }
    );

    /**
     * POST /api/orchestrator/category/:action
     * Start or stop a service category
     */
    fastify.post<{ Params: { action: string }; Body: { category: string } }>(
        '/api/orchestrator/category/:action',
        async (request, reply) => {
            const { action } = request.params;
            const { category } = request.body;

            if (!['start', 'stop'].includes(action)) {
                return reply.status(400).send({
                    success: false,
                    error: 'Action must be "start" or "stop"',
                });
            }

            if (!category || typeof category !== 'string') {
                return reply.status(400).send({
                    success: false,
                    error: 'Category is required',
                });
            }

            try {
                const result = await orchestrator.manageCategoryServices(action as 'start' | 'stop', category);

                return reply.status(200).send({
                    success: result.success,
                    category,
                    action,
                    services: result.services,
                    message: result.message,
                });
            } catch (error) {
                fastify.log.error({ err: error, action, category }, '[orchestrator/category] failed');
                return reply.status(500).send({
                    success: false,
                    error: getErrorMessage(error),
                });
            }
        }
    );
}
