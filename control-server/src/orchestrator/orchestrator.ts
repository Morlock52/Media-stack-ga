/**
 * Core Orchestrator - Supervisor Pattern Multi-Agent System
 * Analyzes requests, creates plans, and coordinates specialist agents
 */

import { randomUUID } from 'crypto';
import { createLogger } from '../utils/logger.js';
import { getErrorMessage } from '../utils/errors.js';
import { getCompletion, selectModelForQuery, estimateComplexity } from '../services/aiProviders.js';
import { AGENTS, AGENT_CAPABILITIES, ExtendedAgent, buildAgentMessages } from '../agents.js';
import { agentTools } from '../tools/agentTools.js';
import { orchestratorTools } from '../tools/orchestratorTools.js';
import { sharedMemoryManager } from './sharedMemory.js';
import { mcpBridge } from './mcpBridge.js';
import type {
    RequestAnalysis,
    ExecutionPlan,
    OrchestratorTask,
    TaskResult,
    PlanResult,
    OrchestratorContext,
    OrchestrationRequest,
    OrchestrationResponse,
    IntentCategory,
    ExecutionStrategy,
} from './types.js';

const logger = createLogger('orchestrator');

// Orchestrator configuration
const CONFIG = {
    maxTasks: 10,
    maxParallelTasks: 4,
    defaultTimeout: 60000,
    analysisModel: 'gpt-4o',
    delegationModel: 'gpt-4o',
};

// Intent detection keywords
const INTENT_KEYWORDS: Record<IntentCategory, string[]> = {
    setup: ['setup', 'install', 'configure', 'first', 'start', 'begin', 'new', 'create', 'init'],
    troubleshoot: ['error', 'issue', 'problem', 'fix', 'debug', 'crash', 'fail', 'not working', 'broken', 'help'],
    configure: ['setting', 'config', 'change', 'update', 'modify', 'adjust', 'tweak'],
    deploy: ['deploy', 'server', 'remote', 'ssh', 'production', 'cloud', 'vps', 'host'],
    query: ['what', 'how', 'why', 'explain', 'tell', 'show', 'list', 'describe'],
    multi: [], // Determined by analysis
};

// Agent to intent mapping (used for future routing extensions)
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _AGENT_INTENT_MAP: Record<string, IntentCategory> = {
    setup: 'setup',
    troubleshoot: 'troubleshoot',
    apps: 'configure',
    deploy: 'deploy',
    general: 'query',
};

// Tool to category mapping (used for future planning extensions)
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _TOOL_CATEGORIES: Record<string, string[]> = {
    diagnostic: ['check_service_health', 'analyze_logs', 'run_post_deploy_check'],
    action: ['restart_service'],
    config: ['generate_env_diff', 'optimize_config'],
    network: ['network_diagnostics'],
    info: ['list_running_services'],
};

/**
 * Main Orchestrator Class
 */
export class Orchestrator {
    private activePlans: Map<string, ExecutionPlan> = new Map();

    /**
     * Process an orchestration request
     */
    async processRequest(request: OrchestrationRequest, context: OrchestratorContext = { history: [] }): Promise<OrchestrationResponse> {
        const startTime = Date.now();
        const planId = randomUUID();

        logger.info({ planId, messageLength: request.message.length }, 'Starting orchestration request');

        try {
            // Step 1: Analyze the request
            const analysis = await this.analyzeRequest(request.message, context);
            logger.info({ planId, analysis }, 'Request analysis complete');

            // Step 2: Decide if orchestration is needed
            if (analysis.complexity === 'simple' && analysis.requiredAgents.length <= 1) {
                // Simple request - route directly to agent without full orchestration
                return await this.handleSimpleRequest(request, analysis, context);
            }

            // Step 3: Create execution plan
            const plan = await this.createPlan(planId, request.message, analysis, request.strategy);
            this.activePlans.set(planId, plan);

            // Step 4: Initialize shared memory
            await sharedMemoryManager.create(planId, {
                userRequest: request.message,
                analysis,
            });

            // Step 5: Execute the plan
            const result = await this.executePlan(plan);

            // Step 6: Build response
            const response: OrchestrationResponse = {
                response: result.response,
                agent: 'orchestrator',
                plan: {
                    id: planId,
                    status: plan.status,
                    tasks: plan.tasks.map(t => ({
                        id: t.id,
                        description: t.description,
                        status: t.status,
                        agent: t.targetAgent,
                        tool: t.tool,
                    })),
                    duration: Date.now() - startTime,
                },
                executionDetails: {
                    totalTasks: plan.tasks.length,
                    completedTasks: result.completedTasks,
                    failedTasks: result.failedTasks,
                    parallelTasks: plan.tasks.filter(t => t.dependencies.length === 0).length,
                    sequentialTasks: plan.tasks.filter(t => t.dependencies.length > 0).length,
                    tokensUsed: result.totalTokens,
                },
            };

            logger.info({
                planId,
                duration: Date.now() - startTime,
                success: result.success,
                tasks: plan.tasks.length,
            }, 'Orchestration complete');

            return response;

        } catch (error) {
            const errorMsg = getErrorMessage(error);
            logger.error({ planId, error: errorMsg }, 'Orchestration failed');

            return {
                response: `I encountered an error while processing your request: ${errorMsg}`,
                agent: 'orchestrator',
                error: errorMsg,
            };
        } finally {
            // Cleanup
            this.activePlans.delete(planId);
            await sharedMemoryManager.delete(planId);
        }
    }

    /**
     * Analyze the user's request to determine intent and requirements
     */
    async analyzeRequest(message: string, _context: OrchestratorContext): Promise<RequestAnalysis> {
        const lower = message.toLowerCase();

        // Quick keyword-based analysis first
        let primaryIntent: IntentCategory = 'query';
        let maxScore = 0;

        for (const [intent, keywords] of Object.entries(INTENT_KEYWORDS)) {
            const score = keywords.filter(k => lower.includes(k)).length;
            if (score > maxScore) {
                maxScore = score;
                primaryIntent = intent as IntentCategory;
            }
        }

        // Detect required agents based on content
        const requiredAgents: string[] = [];
        for (const [agentId, agent] of Object.entries(AGENTS)) {
            if (agentId === 'general') continue;
            if (agent.expertise.some(e => lower.includes(e))) {
                requiredAgents.push(agentId);
            }
        }

        // If no specific agents detected, use general
        if (requiredAgents.length === 0) {
            requiredAgents.push('general');
        }

        // Detect if tools might be needed
        const requiredTools: string[] = [];
        if (lower.includes('health') || lower.includes('status') || lower.includes('running')) {
            requiredTools.push('check_service_health', 'list_running_services');
        }
        if (lower.includes('log') || lower.includes('error')) {
            requiredTools.push('analyze_logs');
        }
        if (lower.includes('restart')) {
            requiredTools.push('restart_service');
        }
        if (lower.includes('network') || lower.includes('dns') || lower.includes('vpn')) {
            requiredTools.push('network_diagnostics');
        }
        if (lower.includes('optimize') || lower.includes('performance')) {
            requiredTools.push('optimize_config');
        }

        // Determine complexity
        const complexity = this.assessComplexity(message, requiredAgents, requiredTools);

        // Check if multi-intent (needs multiple agents)
        if (requiredAgents.length > 1 || requiredTools.length > 2) {
            primaryIntent = 'multi';
        }

        // Extract entities (service names, etc.)
        const entities = this.extractEntities(message);

        return {
            intent: primaryIntent,
            complexity,
            requiredAgents,
            requiredTools,
            parallelizable: requiredTools.length > 1 && !requiredTools.includes('restart_service'),
            entities,
            confidence: maxScore > 0 ? Math.min(0.9, 0.5 + maxScore * 0.1) : 0.5,
        };
    }

    /**
     * Assess request complexity
     */
    private assessComplexity(message: string, agents: string[], tools: string[]): 'simple' | 'moderate' | 'complex' {
        const wordCount = message.split(/\s+/).length;

        if (agents.length <= 1 && tools.length <= 1 && wordCount < 20) {
            return 'simple';
        }
        if (agents.length > 2 || tools.length > 3 || wordCount > 100) {
            return 'complex';
        }
        return 'moderate';
    }

    /**
     * Extract entities from message (service names, etc.)
     */
    private extractEntities(message: string): Record<string, string> {
        const entities: Record<string, string> = {};
        const lower = message.toLowerCase();

        // Known service names
        const services = [
            'plex', 'jellyfin', 'sonarr', 'radarr', 'prowlarr', 'lidarr', 'readarr',
            'bazarr', 'overseerr', 'tautulli', 'qbittorrent', 'gluetun', 'cloudflared',
            'authelia', 'traefik', 'portainer', 'homepage',
        ];

        for (const service of services) {
            if (lower.includes(service)) {
                entities.service = service;
                break;
            }
        }

        return entities;
    }

    /**
     * Create an execution plan
     */
    async createPlan(
        planId: string,
        userRequest: string,
        analysis: RequestAnalysis,
        preferredStrategy?: ExecutionStrategy
    ): Promise<ExecutionPlan> {
        const tasks: OrchestratorTask[] = [];
        let taskOrder = 0;

        // Determine strategy
        const strategy: ExecutionStrategy = preferredStrategy ||
            (analysis.parallelizable ? 'parallel' : 'sequential');

        // Create tasks for each required tool
        for (const toolName of analysis.requiredTools) {
            const task: OrchestratorTask = {
                id: `task-${++taskOrder}`,
                type: 'tool_execution',
                description: `Execute ${toolName}`,
                tool: toolName,
                toolParams: this.buildToolParams(toolName, analysis.entities),
                dependencies: [],
                priority: this.getToolPriority(toolName),
                status: 'pending',
            };

            // Some tools need results from others
            if (toolName === 'optimize_config' && tasks.some(t => t.tool === 'check_service_health')) {
                task.dependencies.push(tasks.find(t => t.tool === 'check_service_health')!.id);
            }

            tasks.push(task);
        }

        // Create aggregation task to combine results and generate response
        if (tasks.length > 0) {
            tasks.push({
                id: `task-${++taskOrder}`,
                type: 'aggregation',
                description: 'Aggregate results and generate response',
                targetAgent: analysis.requiredAgents[0] || 'general',
                agentMessage: userRequest,
                dependencies: tasks.filter(t => t.type === 'tool_execution').map(t => t.id),
                priority: 'high',
                status: 'pending',
            });
        } else {
            // No tools needed, just delegate to agent
            tasks.push({
                id: `task-${++taskOrder}`,
                type: 'agent_delegation',
                description: `Consult ${analysis.requiredAgents[0] || 'general'} agent`,
                targetAgent: analysis.requiredAgents[0] || 'general',
                agentMessage: userRequest,
                dependencies: [],
                priority: 'high',
                status: 'pending',
            });
        }

        const plan: ExecutionPlan = {
            id: planId,
            userRequest,
            analysis,
            tasks,
            strategy,
            estimatedDuration: tasks.length * 5000, // Rough estimate
            status: 'planning',
            createdAt: Date.now(),
        };

        logger.info({ planId, taskCount: tasks.length, strategy }, 'Execution plan created');

        return plan;
    }

    /**
     * Build tool parameters based on entities
     */
    private buildToolParams(toolName: string, entities: Record<string, string>): Record<string, unknown> {
        const params: Record<string, unknown> = {};

        switch (toolName) {
            case 'check_service_health':
            case 'analyze_logs':
            case 'restart_service':
            case 'optimize_config':
                if (entities.service) {
                    params.serviceName = entities.service;
                }
                break;
            case 'network_diagnostics':
                params.checkDns = true;
                params.checkVpn = true;
                params.checkInternet = true;
                break;
        }

        return params;
    }

    /**
     * Get tool priority
     */
    private getToolPriority(toolName: string): 'critical' | 'high' | 'medium' | 'low' {
        if (toolName === 'restart_service') return 'critical';
        if (['check_service_health', 'analyze_logs'].includes(toolName)) return 'high';
        if (['network_diagnostics', 'optimize_config'].includes(toolName)) return 'medium';
        return 'low';
    }

    /**
     * Execute the plan
     */
    async executePlan(plan: ExecutionPlan): Promise<PlanResult> {
        plan.status = 'executing';
        plan.startedAt = Date.now();

        const taskResults = new Map<string, TaskResult>();
        let completedTasks = 0;
        let failedTasks = 0;
        const totalTokens = { input: 0, output: 0 };

        logger.info({ planId: plan.id, strategy: plan.strategy }, 'Starting plan execution');

        // Get tasks in execution order
        const executionOrder = plan.strategy === 'sequential'
            ? plan.tasks.map(task => [task])
            : this.getExecutionOrder(plan.tasks);

        for (const batch of executionOrder) {
            // Execute batch (parallel if multiple tasks with no dependencies on each other)
            const results = await Promise.allSettled(
                batch.map(task => this.executeTask(plan.id, task, taskResults))
            );

            for (let i = 0; i < results.length; i++) {
                const result = results[i];
                const task = batch[i];

                if (result.status === 'fulfilled') {
                    task.result = result.value;
                    task.status = result.value.success ? 'completed' : 'failed';
                    taskResults.set(task.id, result.value);

                    if (result.value.success) {
                        completedTasks++;
                    } else {
                        failedTasks++;
                    }

                    if (result.value.tokens) {
                        totalTokens.input += result.value.tokens.input;
                        totalTokens.output += result.value.tokens.output;
                    }
                } else {
                    task.status = 'failed';
                    task.error = getErrorMessage(result.reason);
                    failedTasks++;
                    taskResults.set(task.id, {
                        success: false,
                        error: task.error,
                    });
                }

                task.completedAt = Date.now();

                // Update shared memory
                await sharedMemoryManager.addTaskResult(plan.id, task.id, taskResults.get(task.id)!);
            }
        }

        plan.status = failedTasks === 0 ? 'completed' : 'failed';
        plan.completedAt = Date.now();

        // Build final response
        const aggregationTask = plan.tasks.find(t => t.type === 'aggregation');
        const response = aggregationTask?.result?.message ||
            this.buildDefaultResponse(plan, taskResults);

        return {
            success: failedTasks === 0,
            response,
            taskResults,
            completedTasks,
            failedTasks,
            totalDuration: Date.now() - plan.startedAt,
            totalTokens,
        };
    }

    /**
     * Get tasks in execution order (batched by dependencies)
     */
    private getExecutionOrder(tasks: OrchestratorTask[]): OrchestratorTask[][] {
        const batches: OrchestratorTask[][] = [];
        const completed = new Set<string>();

        while (completed.size < tasks.length) {
            const batch = tasks.filter(t =>
                !completed.has(t.id) &&
                t.dependencies.every(d => completed.has(d))
            );

            if (batch.length === 0) {
                // Deadlock - add remaining tasks
                batches.push(tasks.filter(t => !completed.has(t.id)));
                break;
            }

            batches.push(batch);
            batch.forEach(t => completed.add(t.id));
        }

        return batches;
    }

    /**
     * Execute a single task
     */
    private async executeTask(
        planId: string,
        task: OrchestratorTask,
        previousResults: Map<string, TaskResult>
    ): Promise<TaskResult> {
        const startTime = Date.now();
        task.status = 'running';
        task.startedAt = startTime;

        logger.info({ planId, taskId: task.id, type: task.type }, 'Executing task');

        try {
            switch (task.type) {
                case 'tool_execution':
                    return await this.executeTool(task);

                case 'agent_delegation':
                    return await this.delegateToAgent(task);

                case 'aggregation':
                    return await this.aggregateResults(task, previousResults);

                case 'mcp_spawn':
                    return await this.executeMcpSpawn(task);

                default:
                    return { success: false, error: `Unknown task type: ${task.type}` };
            }
        } catch (error) {
            logger.error({ planId, taskId: task.id, error: getErrorMessage(error) }, 'Task execution failed');
            return {
                success: false,
                error: getErrorMessage(error),
                duration: Date.now() - startTime,
            };
        }
    }

    /**
     * Execute a tool (supports both agent tools and orchestrator tools)
     */
    private async executeTool(task: OrchestratorTask): Promise<TaskResult> {
        const startTime = Date.now();

        if (!task.tool) {
            return { success: false, error: 'No tool specified' };
        }

        // Check both tool sets
        const agentToolFn = agentTools[task.tool as keyof typeof agentTools];
        const orchestratorToolFn = orchestratorTools[task.tool as keyof typeof orchestratorTools];

        if (!agentToolFn && !orchestratorToolFn) {
            return { success: false, error: `Unknown tool: ${task.tool}` };
        }

        logger.info({ tool: task.tool, params: task.toolParams }, 'Executing tool');

        // Call the tool with appropriate parameters
        let result;
        switch (task.tool) {
            // === Agent Tools ===
            case 'check_service_health':
                result = await agentTools.check_service_health(
                    task.toolParams?.serviceName as string | undefined
                );
                break;
            case 'restart_service':
                result = await agentTools.restart_service(
                    task.toolParams?.serviceName as string,
                    task.toolParams?.mode as 'graceful' | 'hard' | undefined
                );
                break;
            case 'analyze_logs':
                result = await agentTools.analyze_logs(
                    task.toolParams?.serviceName as string,
                    {
                        pattern: task.toolParams?.pattern as string | undefined,
                        severity: task.toolParams?.severity as 'error' | 'warning' | 'info' | undefined,
                        lines: task.toolParams?.lines as number | undefined,
                    }
                );
                break;
            case 'network_diagnostics':
                result = await agentTools.network_diagnostics(
                    task.toolParams as Parameters<typeof agentTools.network_diagnostics>[0]
                );
                break;
            case 'optimize_config':
                result = await agentTools.optimize_config(
                    task.toolParams?.serviceName as string,
                    task.toolParams?.focus as 'memory' | 'cpu' | 'network' | 'storage' | 'general' | undefined
                );
                break;
            case 'list_running_services':
                result = await agentTools.list_running_services();
                break;
            case 'generate_env_diff':
                result = await agentTools.generate_env_diff();
                break;
            case 'run_post_deploy_check':
                result = await agentTools.run_post_deploy_check();
                break;

            // === Orchestrator Tools - Docker Lifecycle ===
            case 'start_container':
                result = await orchestratorTools.start_container(
                    task.toolParams?.containerName as string
                );
                break;
            case 'stop_container':
                result = await orchestratorTools.stop_container(
                    task.toolParams?.containerName as string,
                    task.toolParams?.force as boolean | undefined
                );
                break;
            case 'pull_image':
                result = await orchestratorTools.pull_image(
                    task.toolParams?.imageName as string
                );
                break;
            case 'docker_compose':
                result = await orchestratorTools.docker_compose(
                    task.toolParams?.action as 'up' | 'down' | 'restart' | 'pull' | 'logs' | 'ps',
                    {
                        services: task.toolParams?.services as string[] | undefined,
                        detach: task.toolParams?.detach as boolean | undefined,
                        composeFile: task.toolParams?.composeFile as string | undefined,
                    }
                );
                break;

            // === Orchestrator Tools - Configuration ===
            case 'manage_env':
                result = await orchestratorTools.manage_env(
                    task.toolParams?.action as 'get' | 'set' | 'list' | 'delete',
                    task.toolParams?.key as string | undefined,
                    task.toolParams?.value as string | undefined
                );
                break;

            // === Orchestrator Tools - Category Operations ===
            case 'start_category':
                result = await orchestratorTools.start_category(
                    task.toolParams?.category as string
                );
                break;
            case 'stop_category':
                result = await orchestratorTools.stop_category(
                    task.toolParams?.category as string,
                    task.toolParams?.force as boolean | undefined
                );
                break;

            // === Orchestrator Tools - Deployment ===
            case 'deploy_stack':
                result = await orchestratorTools.deploy_stack({
                    services: task.toolParams?.services as string[] | undefined,
                    pull: task.toolParams?.pull as boolean | undefined,
                    recreate: task.toolParams?.recreate as boolean | undefined,
                });
                break;

            // === Orchestrator Tools - Monitoring ===
            case 'system_resources':
                result = await orchestratorTools.system_resources();
                break;
            case 'check_dependencies':
                result = await orchestratorTools.check_dependencies(
                    task.toolParams?.service as string
                );
                break;
            case 'container_logs':
                result = await orchestratorTools.container_logs(
                    task.toolParams?.containerName as string,
                    {
                        tail: task.toolParams?.tail as number | undefined,
                        since: task.toolParams?.since as string | undefined,
                        grep: task.toolParams?.grep as string | undefined,
                    }
                );
                break;

            // === Orchestrator Tools - Maintenance ===
            case 'cleanup_docker':
                result = await orchestratorTools.cleanup_docker({
                    containers: task.toolParams?.containers as boolean | undefined,
                    images: task.toolParams?.images as boolean | undefined,
                    volumes: task.toolParams?.volumes as boolean | undefined,
                    all: task.toolParams?.all as boolean | undefined,
                });
                break;
            case 'exec_container':
                result = await orchestratorTools.exec_container(
                    task.toolParams?.containerName as string,
                    task.toolParams?.command as string[],
                    { timeout: task.toolParams?.timeout as number | undefined }
                );
                break;
            case 'backup_config':
                result = await orchestratorTools.backup_config(
                    task.toolParams?.containerName as string,
                    task.toolParams?.configPath as string
                );
                break;

            default:
                // Try calling as a generic tool
                if (agentToolFn) {
                    result = await (agentToolFn as () => Promise<{ success: boolean; data?: unknown; error?: string }>)();
                } else {
                    result = { success: false, error: `No handler for tool: ${task.tool}` };
                }
        }

        return {
            success: result.success,
            data: result.data,
            error: result.error,
            duration: Date.now() - startTime,
        };
    }

    /**
     * Delegate to an agent
     */
    private async delegateToAgent(task: OrchestratorTask): Promise<TaskResult> {
        const startTime = Date.now();

        if (!task.targetAgent || !task.agentMessage) {
            return { success: false, error: 'Agent or message not specified' };
        }

        const agent = AGENTS[task.targetAgent] as ExtendedAgent | undefined;
        if (!agent) {
            return { success: false, error: `Unknown agent: ${task.targetAgent}` };
        }

        logger.info({ agent: task.targetAgent }, 'Delegating to agent');

        // Build messages for the agent
        const messages = buildAgentMessages(agent, task.agentMessage);

        // Get completion from AI
        const complexity = estimateComplexity(task.agentMessage);
        const model = selectModelForQuery(task.agentMessage, complexity);

        const completion = await getCompletion(messages, { model });

        return {
            success: true,
            message: completion.content,
            data: { agent: task.targetAgent },
            duration: Date.now() - startTime,
            tokens: completion.usage ? {
                input: completion.usage.promptTokens,
                output: completion.usage.completionTokens,
            } : undefined,
        };
    }

    /**
     * Aggregate results and generate final response
     */
    private async aggregateResults(
        task: OrchestratorTask,
        previousResults: Map<string, TaskResult>
    ): Promise<TaskResult> {
        const startTime = Date.now();

        // Collect tool results
        const toolResultsSummary = Array.from(previousResults.entries())
            .filter(([id]) => id.startsWith('task-') && id !== task.id)
            .map(([id, result]) => ({
                taskId: id,
                success: result.success,
                summary: result.success
                    ? JSON.stringify(result.data).slice(0, 500)
                    : result.error || 'Failed',
            }));

        // Get agent to synthesize response
        const agent = AGENTS[task.targetAgent || 'general'] as ExtendedAgent;

        const synthesisPrompt = `Based on the following tool execution results, provide a helpful response to the user's question: "${task.agentMessage}"

Tool Results:
${toolResultsSummary.map(r => `- ${r.taskId}: ${r.success ? 'Success' : 'Failed'} - ${r.summary}`).join('\n')}

Synthesize these results into a clear, helpful response.`;

        const messages = buildAgentMessages(agent, synthesisPrompt);
        const completion = await getCompletion(messages, { model: CONFIG.delegationModel });

        return {
            success: true,
            message: completion.content,
            data: { aggregated: true, sourceResults: toolResultsSummary.length },
            duration: Date.now() - startTime,
            tokens: completion.usage ? {
                input: completion.usage.promptTokens,
                output: completion.usage.completionTokens,
            } : undefined,
        };
    }

    /**
     * Execute MCP spawn task
     */
    private async executeMcpSpawn(task: OrchestratorTask): Promise<TaskResult> {
        const startTime = Date.now();

        try {
            // Try to spawn via MCP bridge
            const spawnResult = await mcpBridge.spawnAgent(
                task.targetAgent || 'coordinator',
                task.toolParams?.capabilities as string[] || []
            );

            if (spawnResult.success) {
                return {
                    success: true,
                    data: spawnResult,
                    duration: Date.now() - startTime,
                };
            } else {
                // Fallback to direct agent delegation
                logger.warn({ task: task.id }, 'MCP spawn failed, falling back to direct delegation');
                return await this.delegateToAgent({
                    ...task,
                    type: 'agent_delegation',
                });
            }
        } catch (error) {
            logger.error({ error: getErrorMessage(error) }, 'MCP spawn failed');
            return {
                success: false,
                error: getErrorMessage(error),
                duration: Date.now() - startTime,
            };
        }
    }

    /**
     * Build default response when no aggregation task
     */
    private buildDefaultResponse(plan: ExecutionPlan, results: Map<string, TaskResult>): string {
        const successCount = Array.from(results.values()).filter(r => r.success).length;
        const totalCount = results.size;

        if (successCount === totalCount) {
            return `Completed ${totalCount} task(s) successfully for your request.`;
        } else {
            return `Completed ${successCount}/${totalCount} tasks. Some tasks encountered issues.`;
        }
    }

    /**
     * Handle simple requests without full orchestration
     */
    private async handleSimpleRequest(
        request: OrchestrationRequest,
        analysis: RequestAnalysis,
        context: OrchestratorContext
    ): Promise<OrchestrationResponse> {
        const startTime = Date.now();
        const agentId = analysis.requiredAgents[0] || 'general';
        const agent = AGENTS[agentId] as ExtendedAgent;

        logger.info({ agentId }, 'Handling simple request directly');

        const messages = buildAgentMessages(agent, request.message, context.history);
        const complexity = estimateComplexity(request.message);
        const model = selectModelForQuery(request.message, complexity);

        const completion = await getCompletion(messages, { model });

        return {
            response: completion.content,
            agent: agentId,
            executionDetails: {
                totalTasks: 1,
                completedTasks: 1,
                failedTasks: 0,
                parallelTasks: 0,
                sequentialTasks: 1,
                executionTimeMs: Date.now() - startTime,
                tokensUsed: completion.usage ? {
                    input: completion.usage.promptTokens,
                    output: completion.usage.completionTokens,
                } : { input: 0, output: 0 },
            },
        };
    }

    /**
     * Get active plan by ID
     */
    getPlan(planId: string): ExecutionPlan | undefined {
        return this.activePlans.get(planId);
    }

    /**
     * Abort a running plan
     */
    async abortPlan(planId: string): Promise<boolean> {
        const plan = this.activePlans.get(planId);
        if (!plan) return false;

        plan.status = 'aborted';
        for (const task of plan.tasks) {
            if (task.status === 'pending' || task.status === 'running') {
                task.status = 'aborted';
            }
        }

        logger.info({ planId }, 'Plan aborted');
        return true;
    }

    /**
     * Get orchestrator capabilities - tools, agents, and metadata
     */
    getCapabilities(): {
        agents: Array<{ id: string; name: string; expertise: string[]; tools: string[] }>;
        tools: {
            agent: string[];
            orchestrator: string[];
            all: string[];
        };
        categories: Record<string, string[]>;
    } {
        const agentInfo = Object.entries(AGENTS).map(([id, agent]) => ({
            id,
            name: agent.name,
            expertise: agent.expertise,
            tools: AGENT_CAPABILITIES[id]?.tools || [],
        }));

        const agentToolList = Object.keys(agentTools);
        const orchestratorToolList = Object.keys(orchestratorTools);

        return {
            agents: agentInfo,
            tools: {
                agent: agentToolList,
                orchestrator: orchestratorToolList,
                all: [...agentToolList, ...orchestratorToolList],
            },
            categories: {
                media: ['plex', 'jellyfin', 'emby'],
                pvr: ['sonarr', 'radarr', 'lidarr', 'readarr', 'whisparr', 'bazarr', 'prowlarr'],
                download: ['qbittorrent', 'transmission', 'deluge', 'sabnzbd', 'nzbget'],
                network: ['gluetun', 'cloudflared', 'traefik'],
                management: ['overseerr', 'tautulli', 'homepage', 'homarr', 'portainer'],
            },
        };
    }

    /**
     * Execute a tool directly without orchestration
     */
    async executeToolDirect(
        toolName: string,
        params: Record<string, unknown>
    ): Promise<{ success: boolean; data?: unknown; error?: string }> {
        logger.info({ tool: toolName, params }, 'Executing tool directly');

        // Create a minimal task for the execution
        const task: OrchestratorTask = {
            id: `direct-${Date.now()}`,
            type: 'tool_execution',
            description: `Direct execution of ${toolName}`,
            status: 'pending',
            priority: 'high',
            tool: toolName,
            toolParams: params,
            dependencies: [],
        };

        const result = await this.executeTool(task);

        return {
            success: result.success,
            data: result.data,
            error: result.error,
        };
    }

    /**
     * Deploy the full stack with dependency ordering
     */
    async deployStack(options: {
        services?: string[];
        profile?: string;
    }): Promise<{
        success: boolean;
        deployed: string[];
        failed: string[];
        message: string;
    }> {
        const { services, profile } = options;

        logger.info({ services, profile }, 'Deploying stack');

        try {
            // Use the deploy_stack orchestrator tool
            const result = await orchestratorTools.deploy_stack({
                services,
                pull: true,
                recreate: false,
            });

            if (result.success) {
                const deployed = services || [];
                const data = (result.data as any) || {};
                const containersRunning = typeof data.containersRunning === 'number' ? data.containersRunning : null;
                return {
                    success: true,
                    deployed,
                    failed: [],
                    message: `Stack deployed successfully${containersRunning !== null ? ` (${containersRunning} containers running)` : ''}${deployed.length ? `: ${deployed.join(', ')}` : ''}`,
                };
            } else {
                return {
                    success: false,
                    deployed: [],
                    failed: services || [],
                    message: result.error || 'Deployment failed',
                };
            }
        } catch (error) {
            logger.error({ error: getErrorMessage(error) }, 'Stack deployment failed');
            return {
                success: false,
                deployed: [],
                failed: services || [],
                message: getErrorMessage(error),
            };
        }
    }

    /**
     * Start or stop services in a category
     */
    async manageCategoryServices(
        action: 'start' | 'stop',
        category: string
    ): Promise<{
        success: boolean;
        services: string[];
        message: string;
    }> {
        logger.info({ action, category }, 'Managing category services');

        try {
            let result;
            if (action === 'start') {
                result = await orchestratorTools.start_category(category);
            } else {
                result = await orchestratorTools.stop_category(category);
            }

            if (result.success) {
                const data = (result.data as any) || {};
                const results = Array.isArray(data.results) ? data.results : [];
                const services = results
                    .filter((r: any) => r && r.success && typeof r.service === 'string')
                    .map((r: any) => r.service);
                return {
                    success: true,
                    services,
                    message: `${action === 'start' ? 'Started' : 'Stopped'} ${category} category: ${services.join(', ')}`,
                };
            } else {
                return {
                    success: false,
                    services: [],
                    message: result.error || `Failed to ${action} ${category} category`,
                };
            }
        } catch (error) {
            logger.error({ error: getErrorMessage(error), action, category }, 'Category management failed');
            return {
                success: false,
                services: [],
                message: getErrorMessage(error),
            };
        }
    }
}

// Singleton instance
export const orchestrator = new Orchestrator();
