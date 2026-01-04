/**
 * MCP Bridge - Integration with claude-flow and ruv-swarm MCP servers
 * Provides swarm initialization, agent spawning, and task orchestration
 *
 * Fallback chain: claude-flow -> ruv-swarm -> direct execution
 */

import { createLogger } from '../utils/logger.js';
import { getErrorMessage } from '../utils/errors.js';
import type {
    MCPSwarmConfig,
    SwarmInitResult,
    SpawnedAgent,
    SwarmStatus,
    MCPAgentType,
} from './types.js';

const logger = createLogger('mcpBridge');

// MCP connection state
interface MCPState {
    initialized: boolean;
    provider: 'claude-flow' | 'ruv-swarm' | 'direct' | null;
    swarmId: string | null;
    lastHealthCheck: number;
    healthStatus: 'healthy' | 'degraded' | 'unhealthy';
}

// Agent type mapping from local to MCP
const AGENT_TYPE_MAP: Record<string, MCPAgentType> = {
    setup: 'coordinator',
    troubleshoot: 'analyst',
    apps: 'researcher',
    deploy: 'coder',
    general: 'coordinator',
    orchestrator: 'coordinator',
};

// Default swarm configuration
const DEFAULT_SWARM_CONFIG: MCPSwarmConfig = {
    topology: 'hierarchical',
    maxAgents: 8,
    strategy: 'adaptive',
};

/**
 * MCP Bridge Class
 * Manages connections to MCP servers and provides unified interface
 */
export class MCPBridge {
    private state: MCPState = {
        initialized: false,
        provider: null,
        swarmId: null,
        lastHealthCheck: 0,
        healthStatus: 'unhealthy',
    };

    private spawnedAgents: Map<string, SpawnedAgent> = new Map();

    /**
     * Initialize swarm with preferred provider
     */
    async initializeSwarm(config: Partial<MCPSwarmConfig> = {}): Promise<SwarmInitResult> {
        const fullConfig = { ...DEFAULT_SWARM_CONFIG, ...config };

        logger.info({ config: fullConfig }, 'Initializing MCP swarm');

        // Try claude-flow first
        try {
            const result = await this.tryClaudeFlow(fullConfig);
            if (result.success) {
                this.state = {
                    initialized: true,
                    provider: 'claude-flow',
                    swarmId: result.swarmId || null,
                    lastHealthCheck: Date.now(),
                    healthStatus: 'healthy',
                };
                logger.info({ provider: 'claude-flow', swarmId: result.swarmId }, 'Swarm initialized with claude-flow');
                return result;
            }
        } catch (error) {
            logger.warn({ error: getErrorMessage(error) }, 'claude-flow initialization failed, trying ruv-swarm');
        }

        // Fallback to ruv-swarm
        try {
            const result = await this.tryRuvSwarm(fullConfig);
            if (result.success) {
                this.state = {
                    initialized: true,
                    provider: 'ruv-swarm',
                    swarmId: result.swarmId || null,
                    lastHealthCheck: Date.now(),
                    healthStatus: 'healthy',
                };
                logger.info({ provider: 'ruv-swarm', swarmId: result.swarmId }, 'Swarm initialized with ruv-swarm');
                return result;
            }
        } catch (error) {
            logger.warn({ error: getErrorMessage(error) }, 'ruv-swarm initialization failed, using direct mode');
        }

        // Final fallback - direct execution without MCP
        this.state = {
            initialized: true,
            provider: 'direct',
            swarmId: null,
            lastHealthCheck: Date.now(),
            healthStatus: 'healthy',
        };

        logger.info('Using direct execution mode (no MCP swarm available)');

        return {
            success: true,
            provider: 'direct',
            swarmId: undefined,
        };
    }

    /**
     * Try initializing with claude-flow
     */
    private async tryClaudeFlow(_config: MCPSwarmConfig): Promise<SwarmInitResult> {
        // Check if MCP tool is available by attempting a simple operation
        // In a real implementation, this would call the MCP server

        // For now, simulate the MCP call structure
        // The actual MCP tools would be injected at runtime if available
        const mcpAvailable = this.checkMCPAvailability('claude-flow');

        if (!mcpAvailable) {
            return { success: false, error: 'claude-flow MCP server not available' };
        }

        // Simulate swarm initialization
        // In production, this would call: mcp__claude-flow__swarm_init
        const swarmId = `cf-swarm-${Date.now()}`;

        return {
            success: true,
            swarmId,
            provider: 'claude-flow',
        };
    }

    /**
     * Try initializing with ruv-swarm
     */
    private async tryRuvSwarm(_config: MCPSwarmConfig): Promise<SwarmInitResult> {
        const mcpAvailable = this.checkMCPAvailability('ruv-swarm');

        if (!mcpAvailable) {
            return { success: false, error: 'ruv-swarm MCP server not available' };
        }

        // Simulate swarm initialization
        // In production, this would call: mcp__ruv-swarm__swarm_init
        const swarmId = `rv-swarm-${Date.now()}`;

        return {
            success: true,
            swarmId,
            provider: 'ruv-swarm',
        };
    }

    /**
     * Check if MCP server is available
     */
    private checkMCPAvailability(provider: 'claude-flow' | 'ruv-swarm'): boolean {
        // In a real implementation, check if the MCP server is connected
        // For now, check environment or return false to use direct mode
        const envKey = provider === 'claude-flow' ? 'MCP_CLAUDE_FLOW_ENABLED' : 'MCP_RUV_SWARM_ENABLED';
        return process.env[envKey] === 'true';
    }

    /**
     * Spawn an agent in the swarm
     */
    async spawnAgent(
        localAgentType: string,
        capabilities: string[] = [],
        name?: string
    ): Promise<{ success: boolean; agent?: SpawnedAgent; error?: string }> {
        if (!this.state.initialized) {
            await this.initializeSwarm();
        }

        const mcpAgentType = AGENT_TYPE_MAP[localAgentType] || 'coordinator';
        const agentName = name || `${localAgentType}-${Date.now()}`;

        logger.info({ localAgentType, mcpAgentType, name: agentName }, 'Spawning agent');

        try {
            if (this.state.provider === 'claude-flow') {
                return await this.spawnClaudeFlowAgent(mcpAgentType, capabilities, agentName);
            } else if (this.state.provider === 'ruv-swarm') {
                return await this.spawnRuvSwarmAgent(mcpAgentType, capabilities, agentName);
            } else {
                // Direct mode - create virtual agent
                return this.createVirtualAgent(localAgentType, capabilities, agentName);
            }
        } catch (error) {
            logger.error({ error: getErrorMessage(error) }, 'Agent spawn failed');
            return { success: false, error: getErrorMessage(error) };
        }
    }

    /**
     * Spawn agent via claude-flow
     */
    private async spawnClaudeFlowAgent(
        type: MCPAgentType,
        capabilities: string[],
        name: string
    ): Promise<{ success: boolean; agent?: SpawnedAgent; error?: string }> {
        // In production, call: mcp__claude-flow__agent_spawn
        const agent: SpawnedAgent = {
            agentId: `cf-agent-${Date.now()}`,
            type,
            capabilities,
            name,
        };

        this.spawnedAgents.set(agent.agentId, agent);

        return { success: true, agent };
    }

    /**
     * Spawn agent via ruv-swarm
     */
    private async spawnRuvSwarmAgent(
        type: MCPAgentType,
        capabilities: string[],
        name: string
    ): Promise<{ success: boolean; agent?: SpawnedAgent; error?: string }> {
        // In production, call: mcp__ruv-swarm__agent_spawn
        const agent: SpawnedAgent = {
            agentId: `rv-agent-${Date.now()}`,
            type,
            capabilities,
            name,
        };

        this.spawnedAgents.set(agent.agentId, agent);

        return { success: true, agent };
    }

    /**
     * Create virtual agent for direct mode
     */
    private createVirtualAgent(
        localType: string,
        capabilities: string[],
        name: string
    ): { success: boolean; agent?: SpawnedAgent; error?: string } {
        const agent: SpawnedAgent = {
            agentId: `local-${localType}-${Date.now()}`,
            type: AGENT_TYPE_MAP[localType] || 'coordinator',
            capabilities,
            name,
        };

        this.spawnedAgents.set(agent.agentId, agent);

        return { success: true, agent };
    }

    /**
     * Orchestrate a task via MCP
     */
    async orchestrateTask(
        task: string,
        options: {
            strategy?: 'parallel' | 'sequential' | 'adaptive';
            priority?: 'low' | 'medium' | 'high' | 'critical';
            maxAgents?: number;
        } = {}
    ): Promise<{ success: boolean; result?: unknown; error?: string }> {
        const { strategy = 'adaptive', priority = 'medium', maxAgents = 4 } = options;

        logger.info({ task: task.slice(0, 100), strategy, priority, maxAgents }, 'Orchestrating task via MCP');

        if (this.state.provider === 'direct') {
            // Direct mode - no MCP orchestration available
            return { success: true, result: { mode: 'direct', message: 'Task queued for direct execution' } };
        }

        try {
            if (this.state.provider === 'claude-flow') {
                // In production, call: mcp__claude-flow__task_orchestrate
                return {
                    success: true,
                    result: {
                        provider: 'claude-flow',
                        taskId: `task-${Date.now()}`,
                        status: 'queued',
                    },
                };
            } else if (this.state.provider === 'ruv-swarm') {
                // In production, call: mcp__ruv-swarm__task_orchestrate
                return {
                    success: true,
                    result: {
                        provider: 'ruv-swarm',
                        taskId: `task-${Date.now()}`,
                        status: 'queued',
                    },
                };
            }

            return { success: false, error: 'No MCP provider available' };
        } catch (error) {
            logger.error({ error: getErrorMessage(error) }, 'Task orchestration failed');
            return { success: false, error: getErrorMessage(error) };
        }
    }

    /**
     * Get swarm status
     */
    async getSwarmStatus(): Promise<SwarmStatus> {
        if (!this.state.initialized || this.state.provider === 'direct') {
            return {
                active: this.state.initialized,
                agentCount: this.spawnedAgents.size,
                health: 1,
                activeTasks: 0,
                memoryUsage: 0,
            };
        }

        try {
            if (this.state.provider === 'claude-flow') {
                // In production, call: mcp__claude-flow__swarm_status
                return {
                    active: true,
                    agentCount: this.spawnedAgents.size,
                    health: 0.95,
                    activeTasks: 0,
                    memoryUsage: 0.3,
                };
            } else if (this.state.provider === 'ruv-swarm') {
                // In production, call: mcp__ruv-swarm__swarm_status
                return {
                    active: true,
                    agentCount: this.spawnedAgents.size,
                    health: 0.95,
                    activeTasks: 0,
                    memoryUsage: 0.3,
                };
            }
        } catch (error) {
            logger.warn({ error: getErrorMessage(error) }, 'Failed to get swarm status');
        }

        return {
            active: this.state.initialized,
            agentCount: this.spawnedAgents.size,
            health: 0.5,
            activeTasks: 0,
            memoryUsage: 0,
        };
    }

    /**
     * Get memory usage from MCP
     */
    async getMemoryUsage(): Promise<{ used: number; available: number; percentage: number }> {
        if (this.state.provider === 'direct') {
            return { used: 0, available: 0, percentage: 0 };
        }

        try {
            // In production, call appropriate MCP memory_usage tool
            return { used: 100, available: 500, percentage: 20 };
        } catch {
            return { used: 0, available: 0, percentage: 0 };
        }
    }

    /**
     * Cleanup and destroy swarm
     */
    async cleanup(): Promise<void> {
        logger.info({ provider: this.state.provider, swarmId: this.state.swarmId }, 'Cleaning up MCP swarm');

        // Clear local state
        this.spawnedAgents.clear();

        // In production, call swarm destroy if available
        if (this.state.provider === 'claude-flow' && this.state.swarmId) {
            // mcp__claude-flow__swarm_destroy
        }

        this.state = {
            initialized: false,
            provider: null,
            swarmId: null,
            lastHealthCheck: 0,
            healthStatus: 'unhealthy',
        };
    }

    /**
     * Get current provider
     */
    getProvider(): 'claude-flow' | 'ruv-swarm' | 'direct' | null {
        return this.state.provider;
    }

    /**
     * Check if bridge is initialized
     */
    isInitialized(): boolean {
        return this.state.initialized;
    }

    /**
     * Get spawned agents
     */
    getSpawnedAgents(): SpawnedAgent[] {
        return Array.from(this.spawnedAgents.values());
    }

    /**
     * Health check
     */
    async healthCheck(): Promise<{ healthy: boolean; provider: string | null; details: unknown }> {
        const now = Date.now();

        // Skip if checked recently
        if (now - this.state.lastHealthCheck < 30000) {
            return {
                healthy: this.state.healthStatus === 'healthy',
                provider: this.state.provider,
                details: { cached: true, lastCheck: this.state.lastHealthCheck },
            };
        }

        try {
            const status = await this.getSwarmStatus();
            this.state.lastHealthCheck = now;
            this.state.healthStatus = status.health > 0.7 ? 'healthy' : status.health > 0.3 ? 'degraded' : 'unhealthy';

            return {
                healthy: this.state.healthStatus === 'healthy',
                provider: this.state.provider,
                details: status,
            };
        } catch (error) {
            this.state.healthStatus = 'unhealthy';
            return {
                healthy: false,
                provider: this.state.provider,
                details: { error: getErrorMessage(error) },
            };
        }
    }
}

// Singleton instance
export const mcpBridge = new MCPBridge();
