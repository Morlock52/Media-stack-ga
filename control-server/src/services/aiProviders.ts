/**
 * AI Provider - OpenAI Only
 * Updated January 2026 - Simplified to single provider
 *
 * Model Strategy:
 * - GPT-4o: Best for tool calling and multimodal (default)
 * - GPT-4o-mini: Cost-effective for simple queries
 */

import { createLogger } from '../utils/logger.js';
import { getErrorMessage } from '../utils/errors.js';
import { getEnvValue, getOpenAIKey } from '../utils/env.js';

const logger = createLogger('aiProviders');

// Retry configuration with exponential backoff
const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1000;

async function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function withRetry<T>(
    fn: () => Promise<T>,
    maxRetries: number = MAX_RETRIES,
    baseDelay: number = BASE_DELAY_MS
): Promise<T> {
    let lastError: Error | null = null;
    for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
            return await fn();
        } catch (err: unknown) {
            lastError = err instanceof Error ? err : new Error(getErrorMessage(err));
            const errMsg = getErrorMessage(err);
            const isRetryable = errMsg.includes('429') ||
                               errMsg.includes('rate') ||
                               errMsg.includes('timeout') ||
                               errMsg.includes('503');
            if (!isRetryable || attempt === maxRetries - 1) {
                throw err;
            }
            const delay = baseDelay * Math.pow(2, attempt) + Math.random() * 1000;
            logger.warn({ attempt, delay, error: errMsg }, 'Retrying AI request');
            await sleep(delay);
        }
    }
    throw lastError;
}

export interface Message {
    role: 'system' | 'user' | 'assistant' | 'tool';
    content: string;
    tool_call_id?: string;
}

export interface CompletionOptions {
    model?: string;
    maxTokens?: number;
    temperature?: number;
}

export interface CompletionResult {
    content: string;
    provider: 'openai';
    model: string;
    usage?: { promptTokens: number; completionTokens: number; totalTokens: number; };
}

async function callOpenAI(messages: Message[], options: CompletionOptions = {}): Promise<CompletionResult> {
    const apiKey = getOpenAIKey();
    if (!apiKey) throw new Error('OPENAI_API_KEY not configured');

    const model = options.model || getEnvValue('OPENAI_MODEL') || 'gpt-4o';

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
        body: JSON.stringify({
            model,
            messages,
            max_tokens: options.maxTokens || 2048,
            temperature: options.temperature ?? 0.7,
            store: true  // Enable prompt caching for 40-80% cost reduction
        })
    });

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`OpenAI API error: ${response.status} - ${error}`);
    }

    const data = await response.json();
    return {
        content: data.choices[0]?.message?.content || '',
        provider: 'openai',
        model,
        usage: data.usage ? {
            promptTokens: data.usage.prompt_tokens,
            completionTokens: data.usage.completion_tokens,
            totalTokens: data.usage.total_tokens
        } : undefined
    };
}

export async function getCompletion(messages: Message[], options: CompletionOptions = {}): Promise<CompletionResult> {
    const startTime = Date.now();

    try {
        logger.info({ provider: 'openai' }, 'Attempting OpenAI completion');
        const result = await withRetry(() => callOpenAI(messages, options));
        logger.info({
            provider: 'openai',
            model: result.model,
            latencyMs: Date.now() - startTime,
            tokens: result.usage?.totalTokens
        }, 'AI completion successful');
        return result;
    } catch (error: unknown) {
        const errorMsg = getErrorMessage(error);
        logger.error({
            provider: 'openai',
            error: errorMsg,
            latencyMs: Date.now() - startTime
        }, 'AI completion failed');
        throw new Error(`OpenAI unavailable: ${errorMsg}`);
    }
}

// Select model based on query complexity
export function selectModelForQuery(query: string, complexity: 'low' | 'medium' | 'high' = 'medium'): string {
    if (complexity === 'low') return 'gpt-4o-mini';
    // For high complexity, still use gpt-4o as our best model
    return 'gpt-4o';
}

// Estimate query complexity based on length and keywords
export function estimateComplexity(query: string): 'low' | 'medium' | 'high' {
    const lowComplexityKeywords = ['what is', 'how to', 'simple', 'quick', 'help'];
    const highComplexityKeywords = ['analyze', 'debug', 'optimize', 'architecture', 'troubleshoot', 'complex'];

    const lowerQuery = query.toLowerCase();
    if (query.length < 50 && lowComplexityKeywords.some(k => lowerQuery.includes(k))) return 'low';
    if (query.length > 200 || highComplexityKeywords.some(k => lowerQuery.includes(k))) return 'high';
    return 'medium';
}

export function getAvailableProviders(): { openai: boolean } {
    return { openai: !!getOpenAIKey() };
}
