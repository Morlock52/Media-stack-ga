/**
 * AI Provider Abstraction with Claude Fallback
 * Primary: OpenAI GPT-4o | Fallback: Claude Sonnet 4
 * Updated December 2025 for production-ready models
 *
 * Model Strategy:
 * - GPT-4o: Best for tool calling and multimodal
 * - Claude Sonnet 4: Better for complex reasoning and long contexts
 * - GPT-4o-mini: Cost-effective for simple queries
 */

import pino from 'pino';

const logger = pino({
    level: process.env.LOG_LEVEL || 'info',
    transport: { target: 'pino-pretty', options: { colorize: true } }
});

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
        } catch (err: any) {
            lastError = err;
            const isRetryable = err.message?.includes('429') ||
                               err.message?.includes('rate') ||
                               err.message?.includes('timeout') ||
                               err.message?.includes('503');
            if (!isRetryable || attempt === maxRetries - 1) {
                throw err;
            }
            const delay = baseDelay * Math.pow(2, attempt) + Math.random() * 1000;
            logger.warn({ attempt, delay, error: err.message }, 'Retrying AI request');
            await sleep(delay);
        }
    }
    throw lastError;
}

export interface Message {
    role: 'system' | 'user' | 'assistant';
    content: string;
}

export interface CompletionOptions {
    model?: string;
    maxTokens?: number;
    temperature?: number;
}

export interface CompletionResult {
    content: string;
    provider: 'openai' | 'claude';
    model: string;
    usage?: { promptTokens: number; completionTokens: number; totalTokens: number; };
}

async function callOpenAI(messages: Message[], options: CompletionOptions = {}): Promise<CompletionResult> {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error('OPENAI_API_KEY not configured');

  const model = options.model || process.env.OPENAI_MODEL || 'gpt-4o';

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
        body: JSON.stringify({ model, messages, max_tokens: options.maxTokens || 2048, temperature: options.temperature ?? 0.7 })
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
          usage: data.usage ? { promptTokens: data.usage.prompt_tokens, completionTokens: data.usage.completion_tokens, totalTokens: data.usage.total_tokens } : undefined
    };
}

async function callClaude(messages: Message[], options: CompletionOptions = {}): Promise<CompletionResult> {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY not configured');

  const model = options.model || process.env.CLAUDE_MODEL || 'claude-sonnet-4-5-20250929';
    const systemMessage = messages.find(m => m.role === 'system')?.content || '';
    const conversationMessages = messages.filter(m => m.role !== 'system').map(m => ({ role: m.role, content: m.content }));

  const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({ model, max_tokens: options.maxTokens || 2048, system: systemMessage, messages: conversationMessages })
  });

  if (!response.ok) {
        const error = await response.text();
        throw new Error(`Claude API error: ${response.status} - ${error}`);
  }

  const data = await response.json();
    return {
                                  content: data.content[0]?.text || '',
          provider: 'claude',
          model,
          usage: data.usage ? { promptTokens: data.usage.input_tokens, completionTokens: data.usage.output_tokens, totalTokens: data.usage.input_tokens + data.usage.output_tokens } : undefined
    };
}

export async function getCompletion(messages: Message[], options: CompletionOptions = {}): Promise<CompletionResult> {
    const primaryProvider = process.env.PRIMARY_AI_PROVIDER || 'openai';
    const startTime = Date.now();

    try {
        logger.info({ provider: primaryProvider }, 'Attempting primary AI provider');
        const result = await withRetry(() =>
            primaryProvider === 'claude' ? callClaude(messages, options) : callOpenAI(messages, options)
        );
        logger.info({
            provider: primaryProvider,
            model: result.model,
            latencyMs: Date.now() - startTime,
            tokens: result.usage?.totalTokens
        }, 'AI completion successful');
        return result;
    } catch (primaryError: any) {
        logger.warn({ provider: primaryProvider, error: primaryError.message }, 'Primary AI provider failed, attempting fallback');

        try {
            const fallbackProvider = primaryProvider === 'openai' ? 'claude' : 'openai';
            logger.info({ provider: fallbackProvider }, 'Using fallback AI provider');
            const result = await withRetry(() =>
                fallbackProvider === 'claude' ? callClaude(messages, options) : callOpenAI(messages, options)
            );
            logger.info({
                provider: fallbackProvider,
                model: result.model,
                latencyMs: Date.now() - startTime,
                fallbackUsed: true
            }, 'Fallback AI completion successful');
            return result;
        } catch (fallbackError: any) {
            logger.error({
                primaryError: primaryError.message,
                fallbackError: fallbackError.message,
                latencyMs: Date.now() - startTime
            }, 'Both AI providers failed');
            throw new Error(`AI providers unavailable. Primary (${primaryProvider}): ${primaryError.message}. Fallback: ${fallbackError.message}`);
        }
    }
}

// Select model based on query complexity
export function selectModelForQuery(query: string, complexity: 'low' | 'medium' | 'high' = 'medium'): string {
    if (complexity === 'low') return 'gpt-4o-mini';
    if (complexity === 'high') return 'claude-sonnet-4-5-20250929';
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

export function getAvailableProviders(): { openai: boolean; claude: boolean } {
    return { openai: !!process.env.OPENAI_API_KEY, claude: !!process.env.ANTHROPIC_API_KEY };
}
