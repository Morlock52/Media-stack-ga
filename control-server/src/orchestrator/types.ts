/**
 * Multi-Agent Orchestration System Types
 * Supervisor Pattern with Full Auto autonomy and MCP swarm integration
 */

// ============================================================================
// Request Analysis Types
// ============================================================================

export type IntentCategory = 'setup' | 'troubleshoot' | 'configure' | 'deploy' | 'query' | 'multi';

export type ComplexityLevel = 'simple' | 'moderate' | 'complex';

export interface RequestAnalysis {
    /** Primary user intent */
    intent: IntentCategory;
    /** Complexity assessment */
    complexity: ComplexityLevel;
    /** Agents needed to fulfill the request */
    requiredAgents: string[];
    /** Tools that may be invoked */
    requiredTools: string[];
    /** Whether tasks can run in parallel */
    parallelizable: boolean;
    /** Extracted entities (service names, paths, etc.) */
    entities: Record<string, string>;
    /** Confidence score 0-1 */
    confidence: number;
}

// ============================================================================
// Task Types
// ============================================================================

export type TaskType = 'agent_delegation' | 'tool_execution' | 'mcp_spawn' | 'aggregation';

export type TaskStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped' | 'aborted';

export type TaskPriority = 'critical' | 'high' | 'medium' | 'low';

export interface OrchestratorTask {
    /** Unique task identifier */
    id: string;
    /** Task type determines execution method */
    type: TaskType;
    /** Human-readable description */
    description: string;
    /** Target agent for delegation tasks */
    targetAgent?: string;
    /** Tool name for tool execution tasks */
    tool?: string;
    /** Parameters for tool execution */
    toolParams?: Record<string, unknown>;
    /** Message to send to agent */
    agentMessage?: string;
    /** Task IDs that must complete before this task */
    dependencies: string[];
    /** Execution priority */
    priority: TaskPriority;
    /** Current status */
    status: TaskStatus;
    /** Execution result */
    result?: TaskResult;
    /** Error message if failed */
    error?: string;
    /** Start timestamp */
    startedAt?: number;
    /** Completion timestamp */
    completedAt?: number;
    /** Estimated duration in ms */
    estimatedDuration?: number;
}

export interface TaskResult {
    /** Whether task succeeded */
    success: boolean;
    /** Output data */
    data?: unknown;
    /** Response message */
    message?: string;
    /** Error details */
    error?: string;
    /** Execution duration in ms */
    duration?: number;
    /** Token usage if applicable */
    tokens?: { input: number; output: number };
}

// ============================================================================
// Execution Plan Types
// ============================================================================

export type ExecutionStrategy = 'parallel' | 'sequential' | 'adaptive';

export type PlanStatus = 'planning' | 'executing' | 'completed' | 'failed' | 'aborted';

export interface ExecutionPlan {
    /** Unique plan identifier */
    id: string;
    /** Original user request */
    userRequest: string;
    /** Request analysis results */
    analysis: RequestAnalysis;
    /** Ordered list of tasks */
    tasks: OrchestratorTask[];
    /** Execution strategy */
    strategy: ExecutionStrategy;
    /** Estimated total duration in ms */
    estimatedDuration: number;
    /** Plan status */
    status: PlanStatus;
    /** Creation timestamp */
    createdAt: number;
    /** Start timestamp */
    startedAt?: number;
    /** Completion timestamp */
    completedAt?: number;
    /** Final aggregated result */
    result?: PlanResult;
}

export interface PlanResult {
    /** Overall success */
    success: boolean;
    /** Aggregated response message */
    response: string;
    /** Per-task results */
    taskResults: Map<string, TaskResult>;
    /** Tasks that completed successfully */
    completedTasks: number;
    /** Tasks that failed */
    failedTasks: number;
    /** Total execution time in ms */
    totalDuration: number;
    /** Total token usage */
    totalTokens: { input: number; output: number };
}

// ============================================================================
// Shared Memory Types
// ============================================================================

export interface AgentState {
    /** Agent identifier */
    agentId: string;
    /** Whether agent is currently busy */
    busy: boolean;
    /** Current task if busy */
    currentTask?: string;
    /** Tasks completed in this plan */
    tasksCompleted: number;
    /** Last activity timestamp */
    lastActivity: number;
}

export interface SharedMemory {
    /** Plan this memory belongs to */
    planId: string;
    /** Shared context data */
    context: Record<string, unknown>;
    /** Agent states */
    agentStates: Map<string, AgentState>;
    /** Task results for inter-task dependency resolution */
    taskResults: Map<string, TaskResult>;
    /** Execution metadata */
    metadata: ExecutionMetadata;
}

export interface ExecutionMetadata {
    /** Start timestamp */
    startTime: number;
    /** Last update timestamp */
    lastUpdate: number;
    /** Total tasks */
    totalTasks: number;
    /** Completed tasks */
    completedTasks: number;
    /** Failed tasks */
    failedTasks: number;
    /** Current phase description */
    currentPhase: string;
}

// ============================================================================
// MCP Swarm Types
// ============================================================================

export type SwarmTopology = 'mesh' | 'hierarchical' | 'ring' | 'star';

export type SwarmStrategy = 'balanced' | 'specialized' | 'adaptive';

export type MCPAgentType = 'coordinator' | 'researcher' | 'coder' | 'analyst' | 'optimizer';

export interface MCPSwarmConfig {
    /** Swarm topology */
    topology: SwarmTopology;
    /** Maximum agents to spawn */
    maxAgents: number;
    /** Distribution strategy */
    strategy: SwarmStrategy;
}

export interface SwarmInitResult {
    /** Whether initialization succeeded */
    success: boolean;
    /** Swarm identifier */
    swarmId?: string;
    /** Provider used (claude-flow or ruv-swarm) */
    provider?: 'claude-flow' | 'ruv-swarm' | 'direct';
    /** Error message if failed */
    error?: string;
}

export interface SpawnedAgent {
    /** Agent identifier */
    agentId: string;
    /** Agent type */
    type: MCPAgentType;
    /** Agent capabilities */
    capabilities: string[];
    /** Agent name */
    name: string;
}

export interface SwarmStatus {
    /** Whether swarm is active */
    active: boolean;
    /** Number of active agents */
    agentCount: number;
    /** Swarm health 0-1 */
    health: number;
    /** Active task count */
    activeTasks: number;
    /** Memory usage percentage */
    memoryUsage: number;
}

// ============================================================================
// Agent Capability Types
// ============================================================================

export interface AgentCapability {
    /** Agent identifier */
    id: string;
    /** Areas of expertise */
    expertise: string[];
    /** Tools this agent can use effectively */
    tools: string[];
    /** Whether agent can handle parallel tasks */
    canParallelize: boolean;
    /** Maximum concurrent tasks */
    maxConcurrentTasks: number;
    /** Average response time in ms */
    avgResponseTime: number;
}

// ============================================================================
// Tool Metadata Types
// ============================================================================

export type ToolCategory = 'diagnostic' | 'action' | 'config' | 'network' | 'analysis';

export interface ToolMetadata {
    /** Tool name */
    name: string;
    /** Tool category */
    category: ToolCategory;
    /** Estimated execution time in ms */
    estimatedDuration: number;
    /** Whether tool requires user confirmation */
    requiresConfirmation: boolean;
    /** Whether tool can run in parallel with others */
    parallelizable: boolean;
    /** Risk level 1-5 */
    riskLevel: number;
}

// ============================================================================
// API Request/Response Types
// ============================================================================

export interface OrchestrationRequest {
    /** User message */
    message: string;
    /** Conversation history */
    history?: Array<{ role: 'user' | 'assistant'; content: string }>;
    /** Enable orchestration mode */
    orchestrate: boolean;
    /** Maximum agents to use */
    maxAgents?: number;
    /** Request timeout in ms */
    timeout?: number;
    /** Preferred execution strategy */
    strategy?: ExecutionStrategy;
}

export interface OrchestrationResponse {
    /** Response message */
    response: string;
    /** Agent that handled the request */
    agent: string;
    /** Execution plan summary */
    plan?: {
        id: string;
        status: PlanStatus;
        tasks: Array<{
            id: string;
            description: string;
            status: TaskStatus;
            agent?: string;
            tool?: string;
        }>;
        duration: number;
    };
    /** Detailed execution information */
    executionDetails?: {
        totalTasks: number;
        completedTasks: number;
        failedTasks: number;
        parallelTasks: number;
        sequentialTasks: number;
        executionTimeMs?: number;
        tokensUsed: { input: number; output: number };
    };
    /** Error if request failed */
    error?: string;
}

// ============================================================================
// Context Types
// ============================================================================

export interface OrchestratorContext {
    /** Conversation ID */
    conversationId?: string;
    /** Previous conversation history */
    history: Array<{ role: 'user' | 'assistant'; content: string }>;
    /** User preferences */
    preferences?: {
        verbosity?: 'minimal' | 'normal' | 'detailed';
        confirmActions?: boolean;
    };
    /** Available system state */
    systemState?: {
        runningContainers?: string[];
        configuredServices?: string[];
    };
}

// ============================================================================
// Event Types (for logging and monitoring)
// ============================================================================

export type OrchestratorEvent =
    | { type: 'plan_created'; planId: string; taskCount: number }
    | { type: 'plan_started'; planId: string }
    | { type: 'plan_completed'; planId: string; success: boolean; duration: number }
    | { type: 'task_started'; planId: string; taskId: string; taskType: TaskType }
    | { type: 'task_completed'; planId: string; taskId: string; success: boolean; duration: number }
    | { type: 'agent_delegated'; planId: string; taskId: string; agentId: string }
    | { type: 'tool_executed'; planId: string; taskId: string; toolName: string }
    | { type: 'swarm_initialized'; provider: string; swarmId: string }
    | { type: 'error'; planId?: string; taskId?: string; error: string };
