/**
 * AI Provider Abstraction with Claude Fallback
 * Primary: OpenAI GPT-4o | Fallback: Claude 3.5 Sonnet
 */

import pino from 'pino';

const logger = pino({
    level: process.env.LOG_LEVEL || 'info',
    transport: { target: 'pino-pretty', options: { colorize: true } }
});

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

  const model = options.model || process.env.CLAUDE_MODEL || 'claude-3-5-sonnet-20241022';
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

  try {
        logger.info({ provider: primaryProvider }, 'Attempting primary AI provider');
        return primaryProvider === 'claude' ? await callClaude(messages, options) : await callOpenAI(messages, options);
  } catch (primaryError: any) {
        logger.warn({ provider: primaryProvider, error: primaryError.message }, 'Primary AI provider failed, attempting fallback');

      try {
              const fallbackProvider = primaryProvider === 'openai' ? 'claude' : 'openai';
              logger.info({ provider: fallbackProvider }, 'Using fallback AI provider');
                return fallbackProvider === 'claude' ? await callClaude(messages, options) : await callOpenAI(messages, options);
      } catch (fallbackError: any) {
              logger.error({ primaryError: primaryError.message, fallbackError: fallbackError.message }, 'Both AI providers failed');
              throw new Error(`AI providers unavailable. Primary (${primaryProvider}): ${primaryError.message}. Fallback: ${fallbackError.message}`);
      }
  }
}

export function getAvailableProviders(): { openai: boolean; claude: boolean } {
    return { openai: !!process.env.OPENAI_API_KEY, claude: !!process.env.ANTHROPIC_API_KEY };
}
