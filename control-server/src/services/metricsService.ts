/**
 * Metrics and Observability Service
 * Tracks AI agent performance, costs, and usage patterns
 * Updated: December 2025
 */

import { writeFile, readFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { PROJECT_ROOT } from '../utils/env.js';
import pino from 'pino';

const logger = pino({
    level: process.env.LOG_LEVEL || 'info',
    transport: { target: 'pino-pretty', options: { colorize: true } }
});

const METRICS_DIR = join(PROJECT_ROOT, 'data', 'metrics');
const METRICS_FILE = join(METRICS_DIR, 'agent_metrics.json');

// Model pricing (per 1M tokens, as of December 2025)
const MODEL_PRICING: Record<string, { input: number; output: number }> = {
    'gpt-4o': { input: 2.50, output: 10.00 },
    'gpt-4o-mini': { input: 0.15, output: 0.60 },
    'claude-sonnet-4-5-20250929': { input: 3.00, output: 15.00 },
    'tts-1': { input: 15.00, output: 0 },
    'tts-1-hd': { input: 30.00, output: 0 }
};

export interface RequestMetric {
    timestamp: string;
    requestId: string;
    agent: string;
    model: string;
    provider: 'openai' | 'claude';
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    latencyMs: number;
    success: boolean;
    error?: string;
    toolsUsed: string[];
    fallbackUsed: boolean;
}

export interface AggregatedMetrics {
    period: 'hour' | 'day' | 'week' | 'month';
    startTime: string;
    endTime: string;
    totalRequests: number;
    successfulRequests: number;
    failedRequests: number;
    totalTokens: number;
    totalPromptTokens: number;
    totalCompletionTokens: number;
    averageLatencyMs: number;
    p95LatencyMs: number;
    estimatedCostUsd: number;
    requestsByAgent: Record<string, number>;
    requestsByModel: Record<string, number>;
    toolUsage: Record<string, number>;
    fallbackRate: number;
    errorRate: number;
}

interface MetricsStore {
    version: number;
    lastUpdated: string;
    requests: RequestMetric[];
    aggregated: {
        hourly: AggregatedMetrics[];
        daily: AggregatedMetrics[];
    };
}

let metricsStore: MetricsStore = {
    version: 1,
    lastUpdated: new Date().toISOString(),
    requests: [],
    aggregated: { hourly: [], daily: [] }
};

// In-memory buffer for high-frequency writes
const requestBuffer: RequestMetric[] = [];
const BUFFER_FLUSH_INTERVAL = 30000; // 30 seconds
const MAX_BUFFER_SIZE = 100;
const MAX_STORED_REQUESTS = 10000;

async function ensureDir(): Promise<void> {
    try {
        await mkdir(METRICS_DIR, { recursive: true });
    } catch { /* exists */ }
}

async function loadMetrics(): Promise<void> {
    try {
        await ensureDir();
        const data = await readFile(METRICS_FILE, 'utf-8');
        metricsStore = JSON.parse(data);
        logger.info({ requestCount: metricsStore.requests.length }, 'Loaded metrics');
    } catch {
        // Start fresh
        metricsStore = {
            version: 1,
            lastUpdated: new Date().toISOString(),
            requests: [],
            aggregated: { hourly: [], daily: [] }
        };
    }
}

async function saveMetrics(): Promise<void> {
    try {
        await ensureDir();

        // Add buffered requests
        metricsStore.requests.push(...requestBuffer);
        requestBuffer.length = 0;

        // Trim old requests
        if (metricsStore.requests.length > MAX_STORED_REQUESTS) {
            metricsStore.requests = metricsStore.requests.slice(-MAX_STORED_REQUESTS);
        }

        metricsStore.lastUpdated = new Date().toISOString();
        await writeFile(METRICS_FILE, JSON.stringify(metricsStore, null, 2));
    } catch (err) {
        logger.error({ err }, 'Failed to save metrics');
    }
}

// Periodic flush
setInterval(() => {
    if (requestBuffer.length > 0) {
        saveMetrics();
    }
}, BUFFER_FLUSH_INTERVAL);

/**
 * Record a request metric
 */
export function recordRequest(metric: Omit<RequestMetric, 'timestamp' | 'requestId'>): void {
    const fullMetric: RequestMetric = {
        ...metric,
        timestamp: new Date().toISOString(),
        requestId: `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
    };

    requestBuffer.push(fullMetric);

    // Flush if buffer is full
    if (requestBuffer.length >= MAX_BUFFER_SIZE) {
        saveMetrics();
    }

    // Log for real-time observability
    logger.info({
        event: 'ai_request',
        agent: metric.agent,
        model: metric.model,
        tokens: metric.totalTokens,
        latencyMs: metric.latencyMs,
        success: metric.success,
        fallback: metric.fallbackUsed
    });
}

/**
 * Calculate estimated cost for tokens
 */
export function estimateCost(model: string, promptTokens: number, completionTokens: number): number {
    const pricing = MODEL_PRICING[model] || MODEL_PRICING['gpt-4o'];
    return (promptTokens * pricing.input + completionTokens * pricing.output) / 1_000_000;
}

/**
 * Get aggregated metrics for a time period
 */
export function aggregateMetrics(
    requests: RequestMetric[],
    period: AggregatedMetrics['period']
): AggregatedMetrics {
    if (requests.length === 0) {
        return {
            period,
            startTime: new Date().toISOString(),
            endTime: new Date().toISOString(),
            totalRequests: 0,
            successfulRequests: 0,
            failedRequests: 0,
            totalTokens: 0,
            totalPromptTokens: 0,
            totalCompletionTokens: 0,
            averageLatencyMs: 0,
            p95LatencyMs: 0,
            estimatedCostUsd: 0,
            requestsByAgent: {},
            requestsByModel: {},
            toolUsage: {},
            fallbackRate: 0,
            errorRate: 0
        };
    }

    const sorted = [...requests].sort((a, b) =>
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    const successful = requests.filter(r => r.success);
    const failed = requests.filter(r => !r.success);
    const withFallback = requests.filter(r => r.fallbackUsed);

    const latencies = requests.map(r => r.latencyMs).sort((a, b) => a - b);
    const p95Index = Math.floor(latencies.length * 0.95);

    const requestsByAgent: Record<string, number> = {};
    const requestsByModel: Record<string, number> = {};
    const toolUsage: Record<string, number> = {};

    let totalCost = 0;

    for (const req of requests) {
        requestsByAgent[req.agent] = (requestsByAgent[req.agent] || 0) + 1;
        requestsByModel[req.model] = (requestsByModel[req.model] || 0) + 1;

        for (const tool of req.toolsUsed) {
            toolUsage[tool] = (toolUsage[tool] || 0) + 1;
        }

        totalCost += estimateCost(req.model, req.promptTokens, req.completionTokens);
    }

    return {
        period,
        startTime: sorted[0].timestamp,
        endTime: sorted[sorted.length - 1].timestamp,
        totalRequests: requests.length,
        successfulRequests: successful.length,
        failedRequests: failed.length,
        totalTokens: requests.reduce((sum, r) => sum + r.totalTokens, 0),
        totalPromptTokens: requests.reduce((sum, r) => sum + r.promptTokens, 0),
        totalCompletionTokens: requests.reduce((sum, r) => sum + r.completionTokens, 0),
        averageLatencyMs: Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length),
        p95LatencyMs: latencies[p95Index] || 0,
        estimatedCostUsd: Math.round(totalCost * 10000) / 10000,
        requestsByAgent,
        requestsByModel,
        toolUsage,
        fallbackRate: requests.length > 0 ? withFallback.length / requests.length : 0,
        errorRate: requests.length > 0 ? failed.length / requests.length : 0
    };
}

/**
 * Get metrics for a specific time range
 */
export function getMetrics(options: {
    from?: Date;
    to?: Date;
    agent?: string;
    model?: string;
    limit?: number;
} = {}): {
    requests: RequestMetric[];
    aggregated: AggregatedMetrics;
} {
    const { from, to, agent, model, limit = 100 } = options;

    let filtered = [...metricsStore.requests, ...requestBuffer];

    if (from) {
        filtered = filtered.filter(r => new Date(r.timestamp) >= from);
    }
    if (to) {
        filtered = filtered.filter(r => new Date(r.timestamp) <= to);
    }
    if (agent) {
        filtered = filtered.filter(r => r.agent === agent);
    }
    if (model) {
        filtered = filtered.filter(r => r.model === model);
    }

    // Sort by timestamp descending
    filtered.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return {
        requests: filtered.slice(0, limit),
        aggregated: aggregateMetrics(filtered, 'day')
    };
}

/**
 * Get current health status
 */
export function getHealthStatus(): {
    status: 'healthy' | 'degraded' | 'unhealthy';
    recentErrorRate: number;
    recentFallbackRate: number;
    averageLatencyMs: number;
    lastHourRequests: number;
} {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recentRequests = [...metricsStore.requests, ...requestBuffer]
        .filter(r => new Date(r.timestamp) >= oneHourAgo);

    if (recentRequests.length === 0) {
        return {
            status: 'healthy',
            recentErrorRate: 0,
            recentFallbackRate: 0,
            averageLatencyMs: 0,
            lastHourRequests: 0
        };
    }

    const errorRate = recentRequests.filter(r => !r.success).length / recentRequests.length;
    const fallbackRate = recentRequests.filter(r => r.fallbackUsed).length / recentRequests.length;
    const avgLatency = recentRequests.reduce((sum, r) => sum + r.latencyMs, 0) / recentRequests.length;

    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    if (errorRate > 0.5 || avgLatency > 10000) {
        status = 'unhealthy';
    } else if (errorRate > 0.1 || fallbackRate > 0.3 || avgLatency > 5000) {
        status = 'degraded';
    }

    return {
        status,
        recentErrorRate: Math.round(errorRate * 100) / 100,
        recentFallbackRate: Math.round(fallbackRate * 100) / 100,
        averageLatencyMs: Math.round(avgLatency),
        lastHourRequests: recentRequests.length
    };
}

/**
 * Get cost breakdown by model
 */
export function getCostBreakdown(from?: Date, to?: Date): {
    totalCost: number;
    byModel: Record<string, { cost: number; requests: number; tokens: number }>;
    byAgent: Record<string, number>;
} {
    let requests = [...metricsStore.requests, ...requestBuffer];

    if (from) {
        requests = requests.filter(r => new Date(r.timestamp) >= from);
    }
    if (to) {
        requests = requests.filter(r => new Date(r.timestamp) <= to);
    }

    const byModel: Record<string, { cost: number; requests: number; tokens: number }> = {};
    const byAgent: Record<string, number> = {};
    let totalCost = 0;

    for (const req of requests) {
        const cost = estimateCost(req.model, req.promptTokens, req.completionTokens);
        totalCost += cost;

        if (!byModel[req.model]) {
            byModel[req.model] = { cost: 0, requests: 0, tokens: 0 };
        }
        byModel[req.model].cost += cost;
        byModel[req.model].requests++;
        byModel[req.model].tokens += req.totalTokens;

        byAgent[req.agent] = (byAgent[req.agent] || 0) + cost;
    }

    return {
        totalCost: Math.round(totalCost * 10000) / 10000,
        byModel,
        byAgent
    };
}

// Load metrics on startup
loadMetrics().catch(() => { /* ignore */ });

// Cleanup on exit
process.on('beforeExit', () => {
    saveMetrics();
});
