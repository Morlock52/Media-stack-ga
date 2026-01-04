/**
 * Shared Memory Manager for Multi-Agent Orchestration
 * Provides inter-agent communication and state sharing
 */

import { createLogger } from '../utils/logger.js';
import type {
    SharedMemory,
    AgentState,
    TaskResult,
    ExecutionMetadata,
} from './types.js';

const logger = createLogger('sharedMemory');

// In-memory store for active plan memories
const memoryStore = new Map<string, SharedMemory>();

// Cleanup interval for stale memories (30 minutes)
const MEMORY_TTL_MS = 30 * 60 * 1000;
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;

// Start cleanup interval
let cleanupInterval: NodeJS.Timeout | null = null;

function startCleanupInterval() {
    if (cleanupInterval) return;
    cleanupInterval = setInterval(() => {
        const now = Date.now();
        let cleaned = 0;
        for (const [planId, memory] of memoryStore.entries()) {
            if (now - memory.metadata.lastUpdate > MEMORY_TTL_MS) {
                memoryStore.delete(planId);
                cleaned++;
            }
        }
        if (cleaned > 0) {
            logger.info({ cleaned }, 'Cleaned up stale shared memories');
        }
    }, CLEANUP_INTERVAL_MS);
}

function stopCleanupInterval() {
    if (cleanupInterval) {
        clearInterval(cleanupInterval);
        cleanupInterval = null;
    }
}

/**
 * Shared Memory Manager
 * Thread-safe operations for concurrent agent access
 */
export class SharedMemoryManager {
    constructor() {
        startCleanupInterval();
    }

    /**
     * Create a new shared memory for a plan
     */
    async create(planId: string, initialContext?: Record<string, unknown>): Promise<SharedMemory> {
        const now = Date.now();

        const memory: SharedMemory = {
            planId,
            context: initialContext || {},
            agentStates: new Map(),
            taskResults: new Map(),
            metadata: {
                startTime: now,
                lastUpdate: now,
                totalTasks: 0,
                completedTasks: 0,
                failedTasks: 0,
                currentPhase: 'initializing',
            },
        };

        memoryStore.set(planId, memory);
        logger.debug({ planId }, 'Created shared memory for plan');

        return memory;
    }

    /**
     * Get shared memory for a plan
     */
    async get(planId: string): Promise<SharedMemory | null> {
        return memoryStore.get(planId) || null;
    }

    /**
     * Check if memory exists for a plan
     */
    async exists(planId: string): Promise<boolean> {
        return memoryStore.has(planId);
    }

    /**
     * Update shared memory
     */
    async update(planId: string, updates: Partial<SharedMemory>): Promise<void> {
        const memory = memoryStore.get(planId);
        if (!memory) {
            logger.warn({ planId }, 'Attempted to update non-existent memory');
            return;
        }

        // Merge updates
        if (updates.context) {
            memory.context = { ...memory.context, ...updates.context };
        }
        if (updates.metadata) {
            memory.metadata = { ...memory.metadata, ...updates.metadata };
        }

        memory.metadata.lastUpdate = Date.now();
        logger.debug({ planId }, 'Updated shared memory');
    }

    /**
     * Update execution metadata
     */
    async updateMetadata(planId: string, updates: Partial<ExecutionMetadata>): Promise<void> {
        const memory = memoryStore.get(planId);
        if (!memory) return;

        memory.metadata = {
            ...memory.metadata,
            ...updates,
            lastUpdate: Date.now(),
        };
    }

    /**
     * Set current phase
     */
    async setPhase(planId: string, phase: string): Promise<void> {
        await this.updateMetadata(planId, { currentPhase: phase });
    }

    /**
     * Add or update a task result
     */
    async addTaskResult(planId: string, taskId: string, result: TaskResult): Promise<void> {
        const memory = memoryStore.get(planId);
        if (!memory) {
            logger.warn({ planId, taskId }, 'Attempted to add result to non-existent memory');
            return;
        }

        memory.taskResults.set(taskId, result);
        memory.metadata.lastUpdate = Date.now();

        if (result.success) {
            memory.metadata.completedTasks++;
        } else {
            memory.metadata.failedTasks++;
        }

        logger.debug({ planId, taskId, success: result.success }, 'Added task result to shared memory');
    }

    /**
     * Get a specific task result
     */
    async getTaskResult(planId: string, taskId: string): Promise<TaskResult | null> {
        const memory = memoryStore.get(planId);
        if (!memory) return null;
        return memory.taskResults.get(taskId) || null;
    }

    /**
     * Get all task results
     */
    async getAllTaskResults(planId: string): Promise<Map<string, TaskResult>> {
        const memory = memoryStore.get(planId);
        if (!memory) return new Map();
        return new Map(memory.taskResults);
    }

    /**
     * Update agent state
     */
    async updateAgentState(planId: string, agentId: string, state: Partial<AgentState>): Promise<void> {
        const memory = memoryStore.get(planId);
        if (!memory) return;

        const existing = memory.agentStates.get(agentId) || {
            agentId,
            busy: false,
            tasksCompleted: 0,
            lastActivity: Date.now(),
        };

        memory.agentStates.set(agentId, {
            ...existing,
            ...state,
            lastActivity: Date.now(),
        });

        memory.metadata.lastUpdate = Date.now();
    }

    /**
     * Mark agent as busy with a task
     */
    async markAgentBusy(planId: string, agentId: string, taskId: string): Promise<void> {
        await this.updateAgentState(planId, agentId, {
            busy: true,
            currentTask: taskId,
        });
    }

    /**
     * Mark agent as available
     */
    async markAgentAvailable(planId: string, agentId: string): Promise<void> {
        const memory = memoryStore.get(planId);
        if (!memory) return;

        const existing = memory.agentStates.get(agentId);
        if (existing) {
            await this.updateAgentState(planId, agentId, {
                busy: false,
                currentTask: undefined,
                tasksCompleted: existing.tasksCompleted + 1,
            });
        }
    }

    /**
     * Get agent state
     */
    async getAgentState(planId: string, agentId: string): Promise<AgentState | null> {
        const memory = memoryStore.get(planId);
        if (!memory) return null;
        return memory.agentStates.get(agentId) || null;
    }

    /**
     * Get all available (non-busy) agents
     */
    async getAvailableAgents(planId: string): Promise<string[]> {
        const memory = memoryStore.get(planId);
        if (!memory) return [];

        const available: string[] = [];
        for (const [agentId, state] of memory.agentStates.entries()) {
            if (!state.busy) {
                available.push(agentId);
            }
        }
        return available;
    }

    /**
     * Set a context value
     */
    async setContext(planId: string, key: string, value: unknown): Promise<void> {
        const memory = memoryStore.get(planId);
        if (!memory) return;

        memory.context[key] = value;
        memory.metadata.lastUpdate = Date.now();
    }

    /**
     * Get a context value
     */
    async getContext(planId: string, key: string): Promise<unknown> {
        const memory = memoryStore.get(planId);
        if (!memory) return undefined;
        return memory.context[key];
    }

    /**
     * Get context for a specific agent (filtered view)
     */
    async getAgentContext(planId: string, agentId: string): Promise<Record<string, unknown>> {
        const memory = memoryStore.get(planId);
        if (!memory) return {};

        // Build agent-specific context from shared state
        return {
            planId,
            agentId,
            context: memory.context,
            completedTasks: Array.from(memory.taskResults.entries())
                .filter(([, result]) => result.success)
                .map(([taskId, result]) => ({ taskId, result })),
            phase: memory.metadata.currentPhase,
        };
    }

    /**
     * Delete shared memory for a plan
     */
    async delete(planId: string): Promise<void> {
        memoryStore.delete(planId);
        logger.debug({ planId }, 'Deleted shared memory for plan');
    }

    /**
     * Get memory statistics
     */
    async getStats(): Promise<{
        totalPlans: number;
        totalMemoryKB: number;
        oldestPlan?: { id: string; age: number };
    }> {
        const now = Date.now();
        let oldestId: string | undefined;
        let oldestAge = 0;

        for (const [planId, memory] of memoryStore.entries()) {
            const age = now - memory.metadata.startTime;
            if (age > oldestAge) {
                oldestAge = age;
                oldestId = planId;
            }
        }

        // Rough memory estimation
        const totalMemoryKB = Math.round(JSON.stringify(Array.from(memoryStore.values())).length / 1024);

        return {
            totalPlans: memoryStore.size,
            totalMemoryKB,
            oldestPlan: oldestId ? { id: oldestId, age: oldestAge } : undefined,
        };
    }

    /**
     * Clear all memories (for testing/cleanup)
     */
    async clearAll(): Promise<void> {
        memoryStore.clear();
        logger.info('Cleared all shared memories');
    }

    /**
     * Shutdown and cleanup
     */
    shutdown(): void {
        stopCleanupInterval();
        memoryStore.clear();
    }
}

// Singleton instance
export const sharedMemoryManager = new SharedMemoryManager();
