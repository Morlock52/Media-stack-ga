import { FastifyInstance } from 'fastify';
import { AGENTS, detectAgent, buildAgentMessages, getFallbackResponse, getProactiveNudges } from '../agents.js';
import { readEnvFile, setEnvValue, removeEnvKey, PROJECT_ROOT } from '../utils/env.js';
import { runCommand } from '../utils/docker.js';
import { selectModelForQuery, estimateComplexity } from '../services/aiProviders.js';
import { recordRequest } from '../services/metricsService.js';
import fs from 'fs';
import path from 'path';
import { AiChatRequest } from '../types/index.js';
import * as arrService from '../services/arrService.js';

// Model configuration - Updated December 2025 for production-ready models
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o';
// TTS: gpt-4o-mini-tts is the latest with better steerability and new voices (marin, cedar)
const OPENAI_TTS_MODEL = process.env.OPENAI_TTS_MODEL || 'gpt-4o-mini-tts';
const OPENAI_TTS_FALLBACK_MODEL = process.env.OPENAI_TTS_FALLBACK_MODEL || 'tts-1-hd';
// New recommended voices: marin, cedar (best quality), also: alloy, ash, ballad, coral, echo, fable, onyx, nova, sage, shimmer, verse
const OPENAI_TTS_VOICE = process.env.OPENAI_TTS_VOICE || 'coral';
// STT: gpt-4o-transcribe is the most accurate transcription model (Dec 2025)
// It has significantly lower Word Error Rate (WER) than whisper-1 or gpt-4o-mini-transcribe
const OPENAI_STT_MODEL = process.env.OPENAI_STT_MODEL || 'gpt-4o-transcribe';

// Rate limiting configuration
const RATE_LIMIT_WINDOW_MS = 60000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 30; // 30 requests per minute per IP
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

// Circuit breaker state
interface CircuitBreakerState {
    failures: number;
    lastFailure: number | null;
    state: 'closed' | 'open' | 'half-open';
}
const circuitBreaker: CircuitBreakerState = { failures: 0, lastFailure: null, state: 'closed' };
const CIRCUIT_BREAKER_THRESHOLD = 5;
const CIRCUIT_BREAKER_RESET_MS = 30000;

interface RateLimitResult {
    allowed: boolean;
    retryAfter?: number;
    remaining: number;
    resetAt: number;
}

function checkRateLimit(ip: string): RateLimitResult {
    const now = Date.now();
    const record = rateLimitMap.get(ip);

    if (!record || now > record.resetAt) {
        rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
        return { allowed: true, remaining: RATE_LIMIT_MAX_REQUESTS - 1, resetAt: now + RATE_LIMIT_WINDOW_MS };
    }

    if (record.count >= RATE_LIMIT_MAX_REQUESTS) {
        return {
            allowed: false,
            retryAfter: Math.ceil((record.resetAt - now) / 1000),
            remaining: 0,
            resetAt: record.resetAt
        };
    }

    record.count++;
    return { allowed: true, remaining: RATE_LIMIT_MAX_REQUESTS - record.count, resetAt: record.resetAt };
}

function addRateLimitHeaders(reply: any, rateLimit: RateLimitResult): void {
    reply.header('X-RateLimit-Limit', RATE_LIMIT_MAX_REQUESTS);
    reply.header('X-RateLimit-Remaining', rateLimit.remaining);
    reply.header('X-RateLimit-Reset', Math.ceil(rateLimit.resetAt / 1000));
}

function checkCircuitBreaker(): { allowed: boolean } {
    const now = Date.now();

    if (circuitBreaker.state === 'open') {
        if (circuitBreaker.lastFailure && (now - circuitBreaker.lastFailure) > CIRCUIT_BREAKER_RESET_MS) {
            circuitBreaker.state = 'half-open';
            return { allowed: true };
        }
        return { allowed: false };
    }
    return { allowed: true };
}

function recordCircuitBreakerSuccess() {
    circuitBreaker.failures = 0;
    circuitBreaker.lastFailure = null;
    circuitBreaker.state = 'closed';
}

function recordCircuitBreakerFailure() {
    circuitBreaker.failures++;
    circuitBreaker.lastFailure = Date.now();
    if (circuitBreaker.failures >= CIRCUIT_BREAKER_THRESHOLD) {
        circuitBreaker.state = 'open';
    }
}
const TTS_PROVIDER = process.env.TTS_PROVIDER || 'openai';
// ElevenLabs Flash v2.5 provides ~75ms latency vs ~300ms for multilingual_v2
// This is 4x faster and ideal for real-time voice applications
const ELEVENLABS_TTS_MODEL = process.env.ELEVENLABS_TTS_MODEL || 'eleven_flash_v2_5';
const ELEVENLABS_VOICE_ID = process.env.ELEVENLABS_VOICE_ID || '';

// Claude/Anthropic settings (December 2025: Claude Sonnet 4.5)
const CLAUDE_MODEL = process.env.CLAUDE_MODEL || 'claude-sonnet-4-5-20250929';

type VoiceAgentHistoryItem = { role: 'user' | 'assistant'; content: string };

type VoicePlanSummary = {
    services: string[];
    hosting?: string;
    storagePaths?: Record<string, string>;
    domain?: string;
    notes?: string;
};

const getOpenAIKey = () => {
    if (process.env.OPENAI_API_KEY) return process.env.OPENAI_API_KEY;
    const envContent = readEnvFile();
    const match = envContent.match(/^OPENAI_API_KEY=(.+)$/m);
    return match ? match[1].trim() : null;
};

const getElevenLabsKey = () => {
    if (process.env.ELEVENLABS_API_KEY) return process.env.ELEVENLABS_API_KEY;
    const envContent = readEnvFile();
    const match = envContent.match(/^ELEVENLABS_API_KEY=(.+)$/m);
    return match ? match[1].trim() : null;
};

const getAnthropicKey = () => {
    if (process.env.ANTHROPIC_API_KEY) return process.env.ANTHROPIC_API_KEY;
    const envContent = readEnvFile();
    const match = envContent.match(/^ANTHROPIC_API_KEY=(.+)$/m);
    return match ? match[1].trim() : null;
};

const assertValidTtsFormat = (format: unknown): 'mp3' | 'wav' | 'opus' => {
    if (format === 'wav' || format === 'opus' || format === 'mp3') return format;
    return 'mp3';
};

// Error context interface for structured error handling
interface ErrorContext {
    code: string;
    provider: string;
    retryable: boolean;
    message: string;
}

// Format user-friendly error messages based on error type
function formatUserFriendlyError(context: ErrorContext): string {
    if (context.code === 'rate_limit_exceeded' || context.retryable) {
        return "I'm getting too many requests right now. Please wait a moment and try again.";
    }
    if (context.code === 'invalid_api_key' || context.code === 'authentication_error') {
        return "There's an issue with the API configuration. Please check your API keys in Settings.";
    }
    if (context.code === 'context_length_exceeded') {
        return "The conversation is too long. Please clear the chat and start fresh.";
    }
    if (context.code === 'timeout' || context.message.includes('timeout')) {
        return "The request took too long. Please try again with a simpler question.";
    }
    if (context.code === 'service_unavailable' || context.code === '503') {
        return "The AI service is temporarily unavailable. Please try again in a few moments.";
    }
    return "I encountered an issue processing your request. Please try again.";
}

// Parse error into structured context
function parseErrorContext(err: unknown, provider: string = 'openai'): ErrorContext {
    const error = err instanceof Error ? err : new Error('Unknown error');
    const message = error.message || 'Unknown error';

    // Detect error codes from message
    let code = 'unknown';
    let retryable = false;

    if (message.includes('429') || message.includes('rate')) {
        code = 'rate_limit_exceeded';
        retryable = true;
    } else if (message.includes('401') || message.includes('api_key') || message.includes('auth')) {
        code = 'authentication_error';
    } else if (message.includes('context_length') || message.includes('token')) {
        code = 'context_length_exceeded';
    } else if (message.includes('timeout') || message.includes('ETIMEDOUT')) {
        code = 'timeout';
        retryable = true;
    } else if (message.includes('503') || message.includes('unavailable')) {
        code = 'service_unavailable';
        retryable = true;
    }

    return { code, provider, retryable, message };
}

const contentTypeForTtsFormat = (format: 'mp3' | 'wav' | 'opus') => {
    switch (format) {
        case 'wav':
            return 'audio/wav';
        case 'opus':
            return 'audio/ogg';
        case 'mp3':
        default:
            return 'audio/mpeg';
    }
};

const requestOpenAiTts = async (options: {
    apiKey: string;
    text: string;
    model: string;
    voice: string;
    format: 'mp3' | 'wav' | 'opus';
    speed?: number;
}) => {
    const response = await fetch('https://api.openai.com/v1/audio/speech', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${options.apiKey}`,
        },
        body: JSON.stringify({
            model: options.model,
            voice: options.voice,
            input: options.text,
            response_format: options.format,
            ...(typeof options.speed === 'number' ? { speed: options.speed } : {}),
        }),
    });

    return response;
};

const requestElevenLabsTts = async (options: {
    apiKey: string;
    text: string;
    voiceId: string;
    model: string;
}) => {
    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${options.voiceId}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'xi-api-key': options.apiKey,
            Accept: 'audio/mpeg',
        },
        body: JSON.stringify({
            text: options.text,
            model_id: options.model,
            voice_settings: {
                stability: 0.35,
                similarity_boost: 0.85,
                style: 0.25,
                use_speaker_boost: true,
            },
        }),
    });

    return response;
};

const sendTtsUpstreamError = async (
    reply: any,
    response: Response,
    fallbackMessage: string,
    providerLabel: string
) => {
    let upstreamBody = '';
    try {
        upstreamBody = await response.text();
    } catch {
        upstreamBody = '';
    }

    const upstreamStatus = response.status;
    const isAuthError = upstreamStatus === 401 || upstreamStatus === 403;
    const isRateLimited = upstreamStatus === 429;

    if (isAuthError) {
        return reply.status(401).send({
            error: `${providerLabel} authentication failed`,
            reason: 'invalid_api_key',
            upstreamStatus,
        });
    }

    if (isRateLimited) {
        return reply.status(429).send({
            error: `${providerLabel} rate limited`,
            reason: 'rate_limited',
            upstreamStatus,
        });
    }

    return reply.status(502).send({
        error: fallbackMessage,
        reason: 'upstream_error',
        upstreamStatus,
        upstreamBody: upstreamBody ? upstreamBody.slice(0, 500) : undefined,
    });
};

const openAiErrorPayload = (status: number, fallbackMessage: string) => {
    const isAuthError = status === 401 || status === 403;
    const isRateLimited = status === 429;

    if (isAuthError) {
        return { httpStatus: 401, payload: { error: 'OpenAI authentication failed', reason: 'invalid_api_key' } };
    }

    if (isRateLimited) {
        return { httpStatus: 429, payload: { error: 'OpenAI rate limited', reason: 'rate_limited' } };
    }

    return { httpStatus: 502, payload: { error: fallbackMessage, reason: 'upstream_error', upstreamStatus: status } };
};

export async function aiRoutes(fastify: FastifyInstance) {
    // Get list of available agents
    fastify.get('/api/agents', async (_request, _reply) => {
        const agentList = Object.values(AGENTS).map((a: any) => ({
            id: a.id,
            name: a.name,
            icon: a.icon,
            color: a.color,
            description: a.description
        }));
        return { agents: agentList };
    });

    // Voice companion endpoint (used by docs-site VoiceCompanion)
    fastify.post<{ Body: { transcript?: string; history?: VoiceAgentHistoryItem[] } }>(
        '/api/voice-agent',
        async (request, reply) => {
            const { transcript, history = [] } = request.body || {};
            const effectiveApiKey = getOpenAIKey();

            if (!transcript || typeof transcript !== 'string') {
                return reply.status(400).send({ error: 'transcript is required' });
            }

            const normalized = transcript.toLowerCase();

            const serviceKeywords: Array<{ key: string; match: RegExp }> = [
                { key: 'plex', match: /\bplex\b/ },
                { key: 'jellyfin', match: /\bjellyfin\b/ },
                { key: 'emby', match: /\bemby\b/ },
                { key: 'sonarr', match: /\bsonarr\b/ },
                { key: 'radarr', match: /\bradarr\b/ },
                { key: 'prowlarr', match: /\bprowlarr\b/ },
                { key: 'bazarr', match: /\bbazarr\b/ },
                { key: 'overseerr', match: /\boverseerr\b/ },
                { key: 'tautulli', match: /\btautulli\b/ },
                { key: 'qbittorrent', match: /\b(qbittorrent|qbit|qbitorrent)\b/ },
                { key: 'portainer', match: /\bportainer\b/ },
                { key: 'authelia', match: /\bauthelia\b/ },
                { key: 'traefik', match: /\btraefik\b/ },
                { key: 'cloudflared', match: /\bcloudflared\b/ },
            ];

            const services = serviceKeywords.filter(s => s.match.test(normalized)).map(s => s.key);

            let hosting: string | undefined;
            if (/\b(vps|linode|digitalocean|hetzner|aws|gcp|azure)\b/.test(normalized)) hosting = 'vps';
            else if (/\b(nas|synology|qnap|unraid|truenas)\b/.test(normalized)) hosting = 'nas';
            else if (/\b(raspberry\s*pi|raspi|pi\s*4|pi\s*5)\b/.test(normalized)) hosting = 'raspberry-pi';
            else if (/\bmini\s*pc|nuc\b/.test(normalized)) hosting = 'mini-pc';

            const domainMatch = transcript.match(/\b([a-z0-9-]+\.)+[a-z]{2,}\b/i);
            const plan: VoicePlanSummary | null = services.length || hosting || domainMatch
                ? {
                    services,
                    hosting,
                    domain: domainMatch ? domainMatch[0] : undefined,
                }
                : null;

            // Provide a helpful response even without OpenAI
            if (!effectiveApiKey) {
                const response = getFallbackResponse('setup', transcript);
                return {
                    agentResponse: response,
                    plan,
                };
            }

            try {
                const agent = detectAgent(transcript);
                const messages: any[] = buildAgentMessages(agent, transcript, history, { voice: true });

                const response = await fetch('https://api.openai.com/v1/chat/completions', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${effectiveApiKey}`
                    },
                    body: JSON.stringify({
                        model: OPENAI_MODEL,
                        messages,
                        max_tokens: 600,
                        temperature: 0.7,
                        store: true
                    })
                });

                if (!response.ok) {
                    fastify.log.warn({ status: response.status }, 'Voice agent OpenAI error; returning fallback');
                    return {
                        agentResponse: getFallbackResponse(agent.id, transcript),
                        plan,
                    };
                }

                const data: any = await response.json();
                const agentResponse = data.choices?.[0]?.message?.content || getFallbackResponse(agent.id, transcript);

                return {
                    agentResponse,
                    plan,
                };
            } catch (error) {
                fastify.log.warn({ err: error }, 'Voice agent failed; returning fallback response');
                return {
                    agentResponse: getFallbackResponse('setup', transcript),
                    plan,
                };
            }
        }
    );

    // High-quality TTS endpoint (used by docs-site VoiceCompanion when an OpenAI key is available)
    fastify.post<{
        Body: {
            text?: string;
            provider?: 'openai' | 'elevenlabs';
            voice?: string;
            voiceId?: string;
            speed?: number;
            format?: 'mp3' | 'wav' | 'opus';
        };
    }>('/api/tts', async (request, reply) => {
        const { text, voice, voiceId, speed, format, provider } = request.body || {};

        if (!text || typeof text !== 'string') {
            return reply.status(400).send({ error: 'text is required' });
        }

        const normalizedText = text.trim();
        if (!normalizedText) {
            return reply.status(400).send({ error: 'text is required' });
        }

        // Keep this endpoint safe/cheap by default (assistant responses should be short).
        if (normalizedText.length > 4000) {
            return reply.status(413).send({ error: 'text is too long' });
        }

        const requestedProvider =
            provider === 'elevenlabs' || provider === 'openai'
                ? provider
                : (TTS_PROVIDER === 'elevenlabs' ? 'elevenlabs' : 'openai');

        const requestedSpeed = typeof speed === 'number' && Number.isFinite(speed) ? speed : undefined;
        const safeSpeed =
            typeof requestedSpeed === 'number' && requestedSpeed >= 0.25 && requestedSpeed <= 4
                ? requestedSpeed
                : undefined;

        if (requestedProvider === 'elevenlabs') {
            const elevenKey = getElevenLabsKey();
            if (!elevenKey) {
                return reply.status(400).send({ error: 'ElevenLabs API key is required for TTS', reason: 'missing_elevenlabs_key' });
            }

            const resolvedVoiceId =
                typeof voiceId === 'string' && voiceId.trim().length > 0 ? voiceId.trim() : ELEVENLABS_VOICE_ID;
            if (!resolvedVoiceId) {
                return reply.status(400).send({ error: 'ElevenLabs voiceId is required for TTS', reason: 'missing_voice_id' });
            }

            try {
                const response = await requestElevenLabsTts({
                    apiKey: elevenKey,
                    text: normalizedText,
                    voiceId: resolvedVoiceId,
                    model: ELEVENLABS_TTS_MODEL,
                });

                if (!response.ok) {
                    fastify.log.warn({ status: response.status }, 'ElevenLabs TTS error');
                    return sendTtsUpstreamError(reply, response, 'TTS failed', 'ElevenLabs');
                }

                const audioBuffer = Buffer.from(await response.arrayBuffer());
                reply.header('Cache-Control', 'no-store');
                reply.header('Content-Type', 'audio/mpeg');
                reply.header('X-TTS-Provider', 'elevenlabs');
                reply.header('X-TTS-Model', ELEVENLABS_TTS_MODEL);
                return reply.send(audioBuffer);
            } catch (error: any) {
                fastify.log.warn({ err: error }, 'ElevenLabs TTS failed');
                return reply.status(502).send({ error: 'TTS failed', reason: 'server_error' });
            }
        }

        const effectiveApiKey = getOpenAIKey();
        if (!effectiveApiKey) {
            return reply.status(400).send({ error: 'OpenAI API key is required for TTS', reason: 'missing_api_key' });
        }

        const requestedVoice =
            typeof voice === 'string' && voice.trim().length > 0 ? voice.trim() : OPENAI_TTS_VOICE;
        const requestedFormat = assertValidTtsFormat(format);

        try {
            const primary = await requestOpenAiTts({
                apiKey: effectiveApiKey,
                text: normalizedText,
                model: OPENAI_TTS_MODEL,
                voice: requestedVoice,
                format: requestedFormat,
                speed: safeSpeed,
            });

            let response = primary;
            if (!primary.ok && OPENAI_TTS_FALLBACK_MODEL && OPENAI_TTS_FALLBACK_MODEL !== OPENAI_TTS_MODEL) {
                // Some deployments may not have the newest model enabled; fall back gracefully.
                response = await requestOpenAiTts({
                    apiKey: effectiveApiKey,
                    text: normalizedText,
                    model: OPENAI_TTS_FALLBACK_MODEL,
                    voice: requestedVoice,
                    format: requestedFormat,
                    speed: safeSpeed,
                });
            }

            if (!response.ok) {
                fastify.log.warn({ status: response.status }, 'OpenAI TTS error');
                return sendTtsUpstreamError(reply, response, 'TTS failed', 'OpenAI');
            }

            const audioBuffer = Buffer.from(await response.arrayBuffer());
            reply.header('Cache-Control', 'no-store');
            reply.header('Content-Type', contentTypeForTtsFormat(requestedFormat));
            reply.header('X-TTS-Provider', 'openai');
            reply.header('X-TTS-Model', response === primary ? OPENAI_TTS_MODEL : OPENAI_TTS_FALLBACK_MODEL);
            return reply.send(audioBuffer);
        } catch (error: any) {
            fastify.log.warn({ err: error }, 'TTS failed');
            return reply.status(502).send({ error: 'TTS failed', reason: 'server_error' });
        }
    });

    // ═══════════════════════════════════════════════════════════════════════════
    // Speech-to-Text (Transcription) Endpoint - Using OpenAI gpt-4o-transcribe
    // ═══════════════════════════════════════════════════════════════════════════
    fastify.post('/api/transcribe', async (request, reply) => {
        const effectiveApiKey = getOpenAIKey();
        if (!effectiveApiKey) {
            return reply.status(400).send({ error: 'OpenAI API key is required for transcription', reason: 'missing_api_key' });
        }

        const contentType = request.headers['content-type'] || '';

        // Helper to call OpenAI transcription API
        const transcribeWithOpenAI = async (audioBuffer: Buffer, filename: string, model: string): Promise<Response> => {
            const formData = new FormData();
            // Create ArrayBuffer view for Blob compatibility - use type assertion for strict TS
            const arrayBuffer = audioBuffer.buffer.slice(
                audioBuffer.byteOffset,
                audioBuffer.byteOffset + audioBuffer.byteLength
            ) as ArrayBuffer;

            // Determine MIME type from filename extension
            const ext = filename.split('.').pop()?.toLowerCase() || 'webm';
            const mimeTypes: Record<string, string> = {
                'mp3': 'audio/mpeg',
                'mp4': 'audio/mp4',
                'mpeg': 'audio/mpeg',
                'mpga': 'audio/mpeg',
                'm4a': 'audio/mp4',
                'wav': 'audio/wav',
                'webm': 'audio/webm',
                'ogg': 'audio/ogg',
            };
            const mimeType = mimeTypes[ext] || 'audio/webm';

            formData.append('file', new Blob([arrayBuffer], { type: mimeType }), filename);
            formData.append('model', model);
            formData.append('language', 'en');

            return fetch('https://api.openai.com/v1/audio/transcriptions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${effectiveApiKey}`,
                },
                body: formData,
            });
        };

        // Handle multipart form data
        if (contentType.includes('multipart/form-data')) {
            try {
                // Use type assertion for multipart - the plugin adds this method
                const data = await (request as any).file();
                if (!data) {
                    return reply.status(400).send({ error: 'No audio file provided' });
                }

                const audioBuffer: Buffer = await data.toBuffer();
                const filename = data.filename || 'audio.webm';

                // Validate audio buffer size
                if (audioBuffer.length < 100) {
                    fastify.log.warn({ size: audioBuffer.length }, 'Audio buffer too small');
                    return reply.status(400).send({ error: 'Audio recording too short', reason: 'audio_too_short' });
                }

                fastify.log.info({ filename, size: audioBuffer.length, model: OPENAI_STT_MODEL }, 'Transcribing audio');

                let response = await transcribeWithOpenAI(audioBuffer, filename, OPENAI_STT_MODEL);

                // Fallback to whisper-1 if gpt-4o-transcribe fails (any 4xx or 5xx error)
                if (!response.ok) {
                    const errorText = await response.text();
                    fastify.log.warn({ status: response.status, error: errorText, model: OPENAI_STT_MODEL }, 'Primary STT model failed, trying fallback');

                    response = await transcribeWithOpenAI(audioBuffer, filename, 'whisper-1');
                    if (response.ok) {
                        const result = await response.json() as { text: string };
                        fastify.log.info({ model: 'whisper-1', textLength: result.text?.length }, 'Transcription succeeded with fallback');
                        return { text: result.text, model: 'whisper-1', fallback: true };
                    }

                    // Both models failed
                    const fallbackError = await response.text();
                    fastify.log.error({ status: response.status, error: fallbackError }, 'Both STT models failed');

                    // Parse error for user-friendly message
                    let reason = 'upstream_error';
                    let userMessage = 'Transcription failed';
                    if (response.status === 401) {
                        reason = 'invalid_api_key';
                        userMessage = 'Invalid OpenAI API key';
                    } else if (response.status === 429) {
                        reason = 'rate_limited';
                        userMessage = 'Rate limit exceeded, try again shortly';
                    } else if (response.status === 400 && fallbackError.includes('format')) {
                        reason = 'invalid_format';
                        userMessage = 'Audio format not supported';
                    }

                    return reply.status(response.status).send({ error: userMessage, reason });
                }

                const result = await response.json() as { text: string };
                fastify.log.info({ model: OPENAI_STT_MODEL, textLength: result.text?.length }, 'Transcription succeeded');
                return { text: result.text, model: OPENAI_STT_MODEL };
            } catch (error: any) {
                fastify.log.error({ err: error }, 'Transcription error');
                return reply.status(500).send({ error: 'Transcription failed', reason: 'server_error', details: error.message });
            }
        }

        // Handle raw audio body (for simpler clients)
        try {
            const rawBody = request.body;
            if (!rawBody || (rawBody instanceof Buffer && rawBody.length === 0)) {
                return reply.status(400).send({ error: 'No audio data provided' });
            }

            const audioBuffer = rawBody instanceof Buffer ? rawBody : Buffer.from(rawBody as string, 'binary');
            const format = contentType.includes('wav') ? 'wav' :
                           contentType.includes('mp3') ? 'mp3' :
                           contentType.includes('webm') ? 'webm' :
                           contentType.includes('ogg') ? 'ogg' : 'webm';

            const response = await transcribeWithOpenAI(audioBuffer, `audio.${format}`, OPENAI_STT_MODEL);

            if (!response.ok) {
                const errorText = await response.text();
                fastify.log.warn({ status: response.status, error: errorText }, 'Transcription failed');
                return reply.status(response.status).send({ error: 'Transcription failed', reason: 'upstream_error' });
            }

            const result = await response.json() as { text: string };
            return { text: result.text, model: OPENAI_STT_MODEL };
        } catch (error: any) {
            fastify.log.error({ err: error }, 'Transcription error');
            return reply.status(500).send({ error: 'Transcription failed', reason: 'server_error' });
        }
    });

    // Settings: Get available STT models and status
    fastify.get('/api/settings/stt', async (_request, _reply) => {
        const openaiKey = getOpenAIKey();
        return {
            hasKey: Boolean(openaiKey && openaiKey.length > 0),
            model: OPENAI_STT_MODEL,
            fallbackModel: 'whisper-1',
            supportedFormats: ['mp3', 'mp4', 'mpeg', 'mpga', 'm4a', 'wav', 'webm', 'ogg'],
        };
    });

    fastify.get('/api/settings/tts', async (_request, _reply) => {
        const openaiKey = getOpenAIKey();
        const elevenKey = getElevenLabsKey();
        return {
            defaultProvider: TTS_PROVIDER,
            openai: {
                hasKey: Boolean(openaiKey && openaiKey.length > 0),
                ttsModel: OPENAI_TTS_MODEL,
                ttsVoice: OPENAI_TTS_VOICE,
            },
            elevenlabs: {
                hasKey: Boolean(elevenKey && elevenKey.length > 0),
                ttsModel: ELEVENLABS_TTS_MODEL,
                voiceId: ELEVENLABS_VOICE_ID,
            },
        };
    });

    fastify.post<{ Body: { key?: string } }>('/api/settings/elevenlabs-key', async (request, reply) => {
        const { key } = request.body || {};
        if (!key || typeof key !== 'string' || key.trim().length < 10) {
            return reply.status(400).send({ error: 'ElevenLabs API key is required and must be at least 10 characters.' });
        }
        try {
            setEnvValue('ELEVENLABS_API_KEY', key.trim());
            process.env.ELEVENLABS_API_KEY = key.trim();
            return { success: true };
        } catch (error) {
            fastify.log.error({ err: error }, 'Failed to save ElevenLabs key');
            reply.status(500).send({ error: 'Failed to save ElevenLabs key' });
        }
    });

    fastify.delete('/api/settings/elevenlabs-key', async (_request, reply) => {
        try {
            removeEnvKey('ELEVENLABS_API_KEY');
            delete process.env.ELEVENLABS_API_KEY;
            return { success: true };
        } catch (error) {
            fastify.log.error({ err: error }, 'Failed to remove ElevenLabs key');
            reply.status(500).send({ error: 'Failed to remove ElevenLabs key' });
        }
    });

    fastify.get('/api/settings/elevenlabs-voice', async (_request, _reply) => {
        return {
            voiceId: ELEVENLABS_VOICE_ID || null,
            model: ELEVENLABS_TTS_MODEL,
        };
    });

    fastify.post<{ Body: { voiceId?: string } }>('/api/settings/elevenlabs-voice', async (request, reply) => {
        const { voiceId: nextVoiceId } = request.body || {};
        if (!nextVoiceId || typeof nextVoiceId !== 'string' || !nextVoiceId.trim()) {
            return reply.status(400).send({ error: 'voiceId is required.' });
        }
        try {
            setEnvValue('ELEVENLABS_VOICE_ID', nextVoiceId.trim());
            process.env.ELEVENLABS_VOICE_ID = nextVoiceId.trim();
            return { success: true };
        } catch (error) {
            fastify.log.error({ err: error }, 'Failed to save ElevenLabs voiceId');
            reply.status(500).send({ error: 'Failed to save ElevenLabs voiceId' });
        }
    });

    // Settings: OpenAI key management
    fastify.get('/api/settings/openai-key', async (_request, _reply) => {
        const key = getOpenAIKey();
        const hasKey = Boolean(key && key.length > 0);
        return {
            hasKey,
            model: OPENAI_MODEL,
            ttsModel: OPENAI_TTS_MODEL,
            ttsVoice: OPENAI_TTS_VOICE,
        };
    });

    fastify.post<{ Body: { key?: string, openaiKey?: string } }>('/api/settings/openai-key', async (request, reply) => {
        const { key, openaiKey } = request.body || {};
        const apiKey = key || openaiKey;

        if (!apiKey || typeof apiKey !== 'string' || apiKey.trim().length < 10) {
            return reply.status(400).send({ error: 'OpenAI API key is required and must be at least 10 characters.' });
        }

        try {
            setEnvValue('OPENAI_API_KEY', apiKey.trim());
            process.env.OPENAI_API_KEY = apiKey.trim();
            return { success: true };
        } catch (error) {
            fastify.log.error({ err: error }, 'Failed to save OpenAI key');
            reply.status(500).send({ error: 'Failed to save OpenAI key' });
        }
    });

    fastify.delete('/api/settings/openai-key', async (_request, reply) => {
        try {
            removeEnvKey('OPENAI_API_KEY');
            delete process.env.OPENAI_API_KEY;
            return { success: true };
        } catch (error) {
            fastify.log.error({ err: error }, 'Failed to remove OpenAI key');
            reply.status(500).send({ error: 'Failed to remove OpenAI key' });
        }
    });

    // Settings: Claude/Anthropic key management
    fastify.get('/api/settings/claude-key', async (_request, _reply) => {
        const key = getAnthropicKey();
        const hasKey = Boolean(key && key.length > 0);
        return {
            hasKey,
            model: CLAUDE_MODEL,
        };
    });

    fastify.post<{ Body: { key?: string, anthropicKey?: string } }>('/api/settings/claude-key', async (request, reply) => {
        const { key, anthropicKey } = request.body || {};
        const apiKey = key || anthropicKey;

        if (!apiKey || typeof apiKey !== 'string' || apiKey.trim().length < 10) {
            return reply.status(400).send({ error: 'Claude API key is required and must be at least 10 characters.' });
        }

        try {
            setEnvValue('ANTHROPIC_API_KEY', apiKey.trim());
            process.env.ANTHROPIC_API_KEY = apiKey.trim();
            return { success: true };
        } catch (error) {
            fastify.log.error({ err: error }, 'Failed to save Claude key');
            reply.status(500).send({ error: 'Failed to save Claude key' });
        }
    });

    fastify.delete('/api/settings/claude-key', async (_request, reply) => {
        try {
            removeEnvKey('ANTHROPIC_API_KEY');
            delete process.env.ANTHROPIC_API_KEY;
            return { success: true };
        } catch (error) {
            fastify.log.error({ err: error }, 'Failed to remove Claude key');
            reply.status(500).send({ error: 'Failed to remove Claude key' });
        }
    });

    // Status endpoints used by stress/load checks
    fastify.get('/api/settings/openai-key/status', async (_request, _reply) => {
        const key = getOpenAIKey();
        return {
            hasKey: Boolean(key && key.length > 0),
            model: OPENAI_MODEL,
        };
    });

    fastify.get('/api/settings/tts/status', async (_request, _reply) => {
        const provider = (TTS_PROVIDER || 'openai').toLowerCase();
        const openaiKey = getOpenAIKey();
        const elevenKey = getElevenLabsKey();

        if (provider === 'elevenlabs') {
            return {
                provider: 'elevenlabs',
                hasKey: Boolean(elevenKey && elevenKey.length > 0),
                voiceId: ELEVENLABS_VOICE_ID || null,
                model: ELEVENLABS_TTS_MODEL,
            };
        }

        return {
            provider: 'openai',
            hasKey: Boolean(openaiKey && openaiKey.length > 0),
            model: OPENAI_TTS_MODEL,
            voice: OPENAI_TTS_VOICE || null,
        };
    });

    // Wizard AI helper: generate service config suggestions
    fastify.post<{
        Body: {
            serviceId?: string;
            userContext?: string;
            config?: { domain?: string; timezone?: string; puid?: string; pgid?: string };
        }
    }>('/api/ai/service-config', async (request, reply) => {
        const { serviceId, userContext, config } = request.body || {};
        const effectiveApiKey = getOpenAIKey();

        if (!serviceId || typeof serviceId !== 'string') {
            return reply.status(400).send({ error: 'serviceId is required' });
        }

        if (!effectiveApiKey) {
            return reply.status(400).send({ error: 'OpenAI API key is required', reason: 'missing_api_key' });
        }

        const prompt = `You are an expert DevOps engineer configuring a media stack.
The user is setting up ${serviceId}.

Current Global Config:
- Domain: ${config?.domain || ''}
- Timezone: ${config?.timezone || ''}
- PUID/PGID: ${config?.puid || ''}/${config?.pgid || ''}

User Context: ${userContext || 'None provided'}

Please suggest optimal environment variables and configuration settings for ${serviceId}.

Return ONLY a JSON object with the following structure:
{
  "suggestion": "Brief explanation of the suggestion",
  "reasoning": "Why this is recommended",
  "config": {
    "KEY": "VALUE"
  }
}`;

        try {
            const response = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${effectiveApiKey}`
                },
                body: JSON.stringify({
                    model: OPENAI_MODEL,
                    messages: [
                        { role: 'system', content: 'You are a helpful DevOps assistant.' },
                        { role: 'user', content: prompt }
                    ],
                    temperature: 0.7,
                    response_format: { type: 'json_object' },
                    store: true
                })
            });

            if (!response.ok) {
                const status = response.status;
                const { httpStatus, payload } = openAiErrorPayload(status, 'AI request failed');
                fastify.log.warn({ status, serviceId }, 'Service config OpenAI error');
                return reply.status(httpStatus).send(payload);
            }

            const data: any = await response.json();
            const content = data?.choices?.[0]?.message?.content;
            if (!content || typeof content !== 'string') {
                throw new Error('OpenAI response missing content');
            }

            const parsed = JSON.parse(content);
            return parsed;
        } catch (error: any) {
            fastify.log.warn({ err: error, serviceId }, 'Service config AI generation failed');
            return reply.status(502).send({
                error: 'AI request failed',
                reason: 'server_error',
            });
        }
    });

    // Main agent chat endpoint
    fastify.post<{ Body: AiChatRequest }>('/api/agent/chat', async (request, reply) => {
        const clientIp = request.ip || 'unknown';
        const startTime = Date.now();

        // Rate limiting check
        const rateLimit = checkRateLimit(clientIp);
        addRateLimitHeaders(reply, rateLimit);
        if (!rateLimit.allowed) {
            reply.header('Retry-After', rateLimit.retryAfter);
            return reply.status(429).send({
                error: 'Rate limit exceeded',
                retryAfter: rateLimit.retryAfter
            });
        }

        // Circuit breaker check
        const circuitCheck = checkCircuitBreaker();
        if (!circuitCheck.allowed) {
            return reply.status(503).send({
                error: 'Service temporarily unavailable',
                reason: 'circuit_breaker_open',
                retryAfter: Math.ceil(CIRCUIT_BREAKER_RESET_MS / 1000)
            });
        }

        const { message, agentId, history = [], context = {} } = request.body;
        const effectiveApiKey = getOpenAIKey();

        if (!message) {
            return reply.status(400).send({ error: 'Message is required' });
        }

        let agent = agentId ? (AGENTS as any)[agentId] : undefined;
        if (!agent) {
            agent = detectAgent(message);
        }

        const nudges = getProactiveNudges(context);

        // Intelligent model routing based on query complexity
        const complexity = estimateComplexity(message);
        const selectedModel = selectModelForQuery(message, complexity);
        // Use OpenAI models only for direct OpenAI API calls, fall back to default for Claude
        const modelToUse = selectedModel.startsWith('claude') ? OPENAI_MODEL : selectedModel;
        fastify.log.info({ complexity, selectedModel, modelToUse }, 'Selected model for query');

        if (effectiveApiKey) {
            try {
                const messages: any[] = buildAgentMessages(agent, message, history, context);
                const tools = [
                    {
                        type: "function",
                        function: {
                            name: "analyze_logs",
                            description: "Fetch logs from a service for analysis",
                            parameters: {
                                type: "object",
                                properties: {
                                    serviceName: {
                                        type: "string",
                                        description: "The name of the service (e.g. 'sonarr', 'radarr', 'authelia')"
                                    },
                                    lines: {
                                        type: "integer",
                                        description: "Number of lines to fetch (default 50)"
                                    }
                                },
                                required: ["serviceName"]
                            }
                        }
                    },
                    {
                        type: "function",
                        function: {
                            name: "validate_config",
                            description: "Check a configuration file for syntax errors",
                            parameters: {
                                type: "object",
                                properties: {
                                    filePath: {
                                        type: "string",
                                        description: "Path to the config file (relative to project root)"
                                    },
                                    type: {
                                        type: "string",
                                        enum: ["yaml", "json", "env"],
                                        description: "Type of file to validate"
                                    }
                                },
                                required: ["filePath", "type"]
                            }
                        }
                    },
                    {
                        type: "function",
                        function: {
                            name: "bootstrap_arr",
                            description: "Automatically extract API keys from running *arr containers (Sonarr, Radarr, Prowlarr, Readarr, Lidarr) and save them to .env",
                            parameters: {
                                type: "object",
                                properties: {}
                            }
                        }
                    }
                ];

                const response = await fetch('https://api.openai.com/v1/chat/completions', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${effectiveApiKey}`
                    },
                    body: JSON.stringify({
                        model: modelToUse,
                        messages,
                        tools,
                        tool_choice: "auto",
                        max_tokens: 1000,
                        temperature: 0.7,
                        store: true
                    })
                });

                if (!response.ok) {
                    const status = response.status;
                    const { httpStatus, payload } = openAiErrorPayload(status, 'Chat request failed');
                    fastify.log.warn({ status }, 'Chat OpenAI error');
                    return reply.status(httpStatus).send(payload);
                }

                const data: any = await response.json();
                const choice = data.choices?.[0];
                const messageData = choice?.message;

                let answer = messageData?.content;
                let toolUsed = null;
                const toolsUsed: string[] = [];

                // Track token usage across all API calls
                let totalPromptTokens = data.usage?.prompt_tokens || 0;
                let totalCompletionTokens = data.usage?.completion_tokens || 0;

                if (messageData?.tool_calls?.length > 0) {
                    const toolCall = messageData.tool_calls[0];
                    if (toolCall.function.name === 'analyze_logs') {
                        const args = JSON.parse(toolCall.function.arguments);
                        const service = args.serviceName;
                        const lines = args.lines || 50;
                        const command = `docker logs --tail ${lines} ${service}`;

                        fastify.log.info({ service, lines }, 'AI analyzing logs');
                        toolUsed = { command, type: 'logs' };
                        toolsUsed.push('analyze_logs');

                        try {
                            const output = await runCommand('docker', ['logs', '--tail', lines.toString(), service]);

                            messages.push(messageData);
                            messages.push({
                                role: "tool",
                                tool_call_id: toolCall.id,
                                content: output || "(No logs found)"
                            });

                            const secondResponse = await fetch('https://api.openai.com/v1/chat/completions', {
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/json',
                                    'Authorization': `Bearer ${effectiveApiKey}`
                                },
                                body: JSON.stringify({
                                    model: OPENAI_MODEL,
                                    messages,
                                    max_tokens: 1000,
                                    temperature: 0.7,
                                    store: true
                                })
                            });

                            const secondData: any = await secondResponse.json();
                            answer = secondData.choices?.[0]?.message?.content;
                            // Accumulate tokens from follow-up call
                            totalPromptTokens += secondData.usage?.prompt_tokens || 0;
                            totalCompletionTokens += secondData.usage?.completion_tokens || 0;

                        } catch (err: unknown) {
                            const errMsg = err instanceof Error ? err.message : 'Unknown error';
                            answer = `I tried to check logs for ${service} but failed: ${errMsg}`;
                        }
                    } else if (toolCall.function.name === 'validate_config') {
                        const args = JSON.parse(toolCall.function.arguments);
                        const filePath = path.join(PROJECT_ROOT, args.filePath);
                        const type = args.type;

                        fastify.log.info({ filePath, type }, 'AI validating config');
                        toolUsed = { command: `validate ${args.filePath}`, type: 'validation' };
                        toolsUsed.push('validate_config');

                        try {
                            if (!fs.existsSync(filePath)) {
                                throw new Error(`File not found: ${args.filePath}`);
                            }

                            const content = fs.readFileSync(filePath, 'utf-8');
                            let result = "Valid";

                            if (type === 'json') {
                                JSON.parse(content);
                                result = "✅ JSON Syntax Valid";
                            } else if (type === 'yaml') {
                                if (content.includes(':')) {
                                    result = "✅ YAML Structure seems okay (basic check)";
                                } else {
                                    result = "⚠️ YAML might be invalid (no key-value pairs found)";
                                }
                            } else if (type === 'env') {
                                if (content.includes('=')) {
                                    result = "✅ .env format seems valid";
                                } else {
                                    result = "⚠️ .env might be invalid (no KEY=VALUE pairs found)";
                                }
                            }

                            messages.push(messageData);
                            messages.push({
                                role: "tool",
                                tool_call_id: toolCall.id,
                                content: result
                            });

                            const secondResponse = await fetch('https://api.openai.com/v1/chat/completions', {
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/json',
                                    'Authorization': `Bearer ${effectiveApiKey}`
                                },
                                body: JSON.stringify({
                                    model: OPENAI_MODEL,
                                    messages,
                                    max_tokens: 1000,
                                    temperature: 0.7,
                                    store: true
                                })
                            });

                            const secondData: any = await secondResponse.json();
                            answer = secondData.choices?.[0]?.message?.content;
                            // Accumulate tokens from follow-up call
                            totalPromptTokens += secondData.usage?.prompt_tokens || 0;
                            totalCompletionTokens += secondData.usage?.completion_tokens || 0;

                        } catch (err: unknown) {
                            const errMsg = err instanceof Error ? err.message : 'Unknown error';
                            answer = `Validation failed for ${args.filePath}: ${errMsg}`;
                        }
                    } else if (toolCall.function.name === 'bootstrap_arr') {
                        fastify.log.info('AI bootstrapping *arr keys');
                        toolUsed = { command: 'bootstrap-arr-keys', type: 'setup' };
                        toolsUsed.push('bootstrap_arr');

                        try {
                            const results = await arrService.bootstrapArrKeys();
                            const count = Object.keys(results).length;
                            const resultContent = count > 0
                                ? `Successfully extracted ${count} keys: ${Object.keys(results).join(', ')}`
                                : "No API keys could be extracted. Make sure the containers are running and initialized (config.xml must exist).";

                            messages.push(messageData);
                            messages.push({
                                role: "tool",
                                tool_call_id: toolCall.id,
                                content: resultContent
                            });

                            const secondResponse = await fetch('https://api.openai.com/v1/chat/completions', {
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/json',
                                    'Authorization': `Bearer ${effectiveApiKey}`
                                },
                                body: JSON.stringify({
                                    model: OPENAI_MODEL,
                                    messages,
                                    max_tokens: 1000,
                                    temperature: 0.7,
                                    store: true
                                })
                            });

                            const secondData: any = await secondResponse.json();
                            answer = secondData.choices?.[0]?.message?.content;
                            // Accumulate tokens from follow-up call
                            totalPromptTokens += secondData.usage?.prompt_tokens || 0;
                            totalCompletionTokens += secondData.usage?.completion_tokens || 0;
                        } catch (err: unknown) {
                            const errMsg = err instanceof Error ? err.message : 'Unknown error';
                            answer = `Bootstrap failed: ${errMsg}`;
                        }
                    }
                }

                // Record circuit breaker success
                recordCircuitBreakerSuccess();

                const latencyMs = Date.now() - startTime;

                // Record request metrics for cost tracking
                recordRequest({
                    agent: agent.id,
                    model: modelToUse,
                    provider: 'openai',
                    promptTokens: totalPromptTokens,
                    completionTokens: totalCompletionTokens,
                    totalTokens: totalPromptTokens + totalCompletionTokens,
                    latencyMs,
                    success: true,
                    toolsUsed,
                    fallbackUsed: false
                });

                // Log metrics
                fastify.log.info({
                    event: 'agent_chat_success',
                    agent: agent.id,
                    latencyMs,
                    toolUsed: toolUsed?.command,
                    aiPowered: true,
                    tokens: totalPromptTokens + totalCompletionTokens
                });

                return {
                    answer: answer || 'Sorry, I could not generate a response.',
                    agent: { id: agent.id, name: agent.name, icon: agent.icon },
                    nudges,
                    aiPowered: true,
                    toolUsed,
                    model: modelToUse,
                    complexity
                };

            } catch (error: unknown) {
                // Record circuit breaker failure
                recordCircuitBreakerFailure();

                // Parse error into structured context
                const errorContext = parseErrorContext(error, 'openai');
                const errorLatencyMs = Date.now() - startTime;

                // Record failed request for metrics
                recordRequest({
                    agent: agent.id,
                    model: modelToUse,
                    provider: 'openai',
                    promptTokens: 0,
                    completionTokens: 0,
                    totalTokens: 0,
                    latencyMs: errorLatencyMs,
                    success: false,
                    error: errorContext.message,
                    toolsUsed: [],
                    fallbackUsed: false
                });

                fastify.log.error({
                    errorContext,
                    agent: agent?.id,
                    latencyMs: errorLatencyMs,
                    circuitState: circuitBreaker.state
                }, '[agent/chat] OpenAI error, falling back to canned response');

                // Return user-friendly error with debug info in development
                const userFriendlyError = formatUserFriendlyError(errorContext);
                return {
                    answer: userFriendlyError,
                    agent: { id: agent.id, name: agent.name, icon: agent.icon },
                    nudges,
                    aiPowered: false,
                    error: {
                        retryable: errorContext.retryable,
                        ...(process.env.NODE_ENV === 'development' ? { debug: errorContext } : {})
                    }
                };
            }
        }

        const answer = getFallbackResponse(agent.id, message);
        return {
            answer,
            agent: { id: agent.id, name: agent.name, icon: agent.icon },
            nudges,
            aiPowered: false
        };
    });

    // Suggestions endpoint for docs site
    fastify.post<{ Body: { currentApp: string } }>('/api/agent/suggestions', async (request, _reply) => {
        const { currentApp } = request.body;
        const suggestions: any[] = [];

        const appSuggestions: any = {
            plex: ['How do I add libraries?', 'Enable remote access', 'Set up users'],
            jellyfin: ['Create admin user', 'Add media libraries', 'Configure transcoding'],
            sonarr: ['Connect to Prowlarr', 'Add download client', 'Set quality profiles'],
            radarr: ['Connect to Prowlarr', 'Add download client', 'Configure lists'],
            prowlarr: ['Add indexers', 'Sync with Sonarr/Radarr', 'Test connections'],
            overseerr: ['Connect to Plex', 'Set up users', 'Configure notifications'],
            qbittorrent: ['Change default password', 'Set download path', 'Configure VPN'],
        };

        if (currentApp && appSuggestions[currentApp]) {
            suggestions.push(...appSuggestions[currentApp].map((s: string) => ({
                text: s,
                agent: 'apps'
            })));
        }

        return { suggestions: suggestions.slice(0, 5) };
    });

    // ═══════════════════════════════════════════════════════════════════════════
    // SSE Streaming Chat Endpoint
    // ═══════════════════════════════════════════════════════════════════════════
    fastify.get<{ Querystring: { message: string; agentId?: string } }>(
        '/api/agent/chat/stream',
        async (request, reply) => {
            const clientIp = request.ip || 'unknown';

            // Rate limiting
            const rateLimit = checkRateLimit(clientIp);
            addRateLimitHeaders(reply, rateLimit);
            if (!rateLimit.allowed) {
                reply.header('Retry-After', rateLimit.retryAfter);
                return reply.status(429).send({ error: 'Rate limit exceeded', retryAfter: rateLimit.retryAfter });
            }

            // Circuit breaker
            const circuitCheck = checkCircuitBreaker();
            if (!circuitCheck.allowed) {
                return reply.status(503).send({ error: 'Service temporarily unavailable' });
            }

            const { message, agentId } = request.query;
            const effectiveApiKey = getOpenAIKey();

            if (!message) {
                return reply.status(400).send({ error: 'Message is required' });
            }

            if (!effectiveApiKey) {
                return reply.status(400).send({ error: 'OpenAI API key not configured' });
            }

            let agent = agentId ? (AGENTS as any)[agentId] : undefined;
            if (!agent) {
                agent = detectAgent(message);
            }

            const messages = buildAgentMessages(agent, message, [], {});

            // Intelligent model routing for streaming
            const complexity = estimateComplexity(message);
            const selectedModel = selectModelForQuery(message, complexity);
            // Use OpenAI for streaming (Claude doesn't support same SSE format)
            const streamingModel = selectedModel.startsWith('claude') ? OPENAI_MODEL : selectedModel;

            // Set SSE headers (including CORS since we bypass Fastify's reply)
            const origin = request.headers.origin;
            if (origin) {
                reply.raw.setHeader('Access-Control-Allow-Origin', origin);
                reply.raw.setHeader('Access-Control-Allow-Credentials', 'true');
            }
            reply.raw.setHeader('Content-Type', 'text/event-stream');
            reply.raw.setHeader('Cache-Control', 'no-cache');
            reply.raw.setHeader('Connection', 'keep-alive');
            reply.raw.setHeader('X-Accel-Buffering', 'no');

            try {
                // Send agent info first
                reply.raw.write(`data: ${JSON.stringify({ type: 'agent', agent: { id: agent.id, name: agent.name, icon: agent.icon } })}\n\n`);

                const response = await fetch('https://api.openai.com/v1/chat/completions', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${effectiveApiKey}`
                    },
                    body: JSON.stringify({
                        model: streamingModel,
                        messages,
                        max_tokens: 1000,
                        temperature: 0.7,
                        stream: true,
                        store: true
                    })
                });

                if (!response.ok || !response.body) {
                    recordCircuitBreakerFailure();
                    reply.raw.write(`data: ${JSON.stringify({ type: 'error', error: 'API request failed' })}\n\n`);
                    reply.raw.end();
                    return;
                }

                const reader = response.body.getReader();
                const decoder = new TextDecoder();
                let buffer = '';

                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;

                    buffer += decoder.decode(value, { stream: true });
                    const lines = buffer.split('\n');
                    buffer = lines.pop() || '';

                    for (const line of lines) {
                        if (line.startsWith('data: ')) {
                            const data = line.slice(6);
                            if (data === '[DONE]') {
                                reply.raw.write('data: [DONE]\n\n');
                                continue;
                            }
                            try {
                                const parsed = JSON.parse(data);
                                const delta = parsed.choices?.[0]?.delta;
                                if (delta?.content) {
                                    reply.raw.write(`data: ${JSON.stringify({ type: 'text', content: delta.content })}\n\n`);
                                }
                            } catch {
                                // Skip invalid JSON
                            }
                        }
                    }
                }

                recordCircuitBreakerSuccess();
                reply.raw.write('data: [DONE]\n\n');
                reply.raw.end();
            } catch (error: any) {
                recordCircuitBreakerFailure();
                fastify.log.error({ err: error }, 'Streaming chat error');
                reply.raw.write(`data: ${JSON.stringify({ type: 'error', error: error.message })}\n\n`);
                reply.raw.end();
            }
        }
    );

    // ═══════════════════════════════════════════════════════════════════════════
    // NEW: Agent Tools API Routes
    // ═══════════════════════════════════════════════════════════════════════════

          // Import the new modules (add these imports at the top of the file)
          // import { agentTools } from '../tools/agentTools.js';
          // import { getCompletion, getAvailableProviders } from '../services/aiProviders.js';
          // import * as conversationStore from '../services/conversationStore.js';

    // List available tools
    fastify.get('/api/ai/tools', async (_request, reply) => {
        const { agentTools } = await import('../tools/agentTools.js');
        return reply.send({
            tools: Object.keys(agentTools),
            descriptions: {
                check_service_health: 'Check Docker service status, uptime, and resources',
                restart_service: 'Restart a Docker service (graceful or hard)',
                generate_env_diff: 'Compare .env with .env.example',
                run_post_deploy_check: 'Run health checks on VPN, services, etc.',
                list_running_services: 'List all running Docker services with status',
                analyze_logs: 'Search and analyze container logs for errors/patterns',
                network_diagnostics: 'Check DNS, internet connectivity, VPN, and ports',
                optimize_config: 'Get optimization suggestions for a service'
            }
        });
    });

    // Execute a tool
    fastify.post<{ Params: { toolName: string }; Body: Record<string, any> }>('/api/ai/tools/:toolName', async (request, reply) => {
        const { toolName } = request.params;
        const params = request.body || {};
        const { agentTools } = await import('../tools/agentTools.js');

        const tool = agentTools[toolName as keyof typeof agentTools];
        if (!tool) {
            return reply.code(404).send({ error: `Tool "${toolName}" not found` });
        }

        try {
            let result;
            switch (toolName) {
                case 'check_service_health':
                    result = await agentTools.check_service_health(params?.serviceName);
                    break;
                case 'restart_service':
                    result = await agentTools.restart_service(params?.serviceName, params?.mode);
                    break;
                case 'generate_env_diff':
                    result = await agentTools.generate_env_diff();
                    break;
                case 'run_post_deploy_check':
                    result = await agentTools.run_post_deploy_check();
                    break;
                case 'list_running_services':
                    result = await agentTools.list_running_services();
                    break;
                case 'analyze_logs':
                    result = await agentTools.analyze_logs(params?.serviceName, {
                        pattern: params?.pattern,
                        severity: params?.severity,
                        lines: params?.lines
                    });
                    break;
                case 'network_diagnostics':
                    result = await agentTools.network_diagnostics({
                        checkDns: params?.checkDns,
                        checkPorts: params?.checkPorts,
                        checkVpn: params?.checkVpn,
                        checkInternet: params?.checkInternet
                    });
                    break;
                case 'optimize_config':
                    result = await agentTools.optimize_config(params?.serviceName, params?.focus);
                    break;
                default:
                    return reply.code(404).send({ error: `Tool "${toolName}" not implemented` });
            }
            return reply.send(result);
        } catch (err: any) {
            return reply.code(500).send({ error: err.message });
        }
    });

          // ═══════════════════════════════════════════════════════════════════════════
          // NEW: Conversation API Routes
          // ═══════════════════════════════════════════════════════════════════════════

          fastify.get('/api/ai/conversations', async (request, reply) => {
                  const conversationStore = await import('../services/conversationStore.js');
                  const { limit } = request.query as { limit?: string };
                  const conversations = await conversationStore.listConversations(limit ? parseInt(limit, 10) : 20);
                  return reply.send({ conversations });
          });

          fastify.get<{ Params: { id: string } }>('/api/ai/conversations/:id', async (request, reply) => {
                  const conversationStore = await import('../services/conversationStore.js');
                  const conversation = await conversationStore.getConversation(request.params.id);
                  if (!conversation) return reply.code(404).send({ error: 'Conversation not found' });
                  return reply.send(conversation);
          });

          fastify.post('/api/ai/conversations', async (request, reply) => {
                  const conversationStore = await import('../services/conversationStore.js');
                  const { message, metadata } = request.body as { message?: string; metadata?: any };
                  const initialMessage = message ? { role: 'user' as const, content: message, timestamp: new Date().toISOString() } : undefined;
                  const conversation = await conversationStore.createConversation(initialMessage, metadata);
                  return reply.send(conversation);
          });

          fastify.delete<{ Params: { id: string } }>('/api/ai/conversations/:id', async (request, reply) => {
                  const conversationStore = await import('../services/conversationStore.js');
                  const deleted = await conversationStore.deleteConversation(request.params.id);
                  return reply.send({ deleted });
          });

          // ═══════════════════════════════════════════════════════════════════════════
          // NEW: AI Provider Status
          // ═══════════════════════════════════════════════════════════════════════════

    fastify.get('/api/ai/providers', async (_request, reply) => {
        const { getAvailableProviders } = await import('../services/aiProviders.js');
        const providers = getAvailableProviders();
        return reply.send({ providers, primary: process.env.PRIMARY_AI_PROVIDER || 'openai' });
    });

    // ═══════════════════════════════════════════════════════════════════════════
    // Metrics and Observability API
    // ═══════════════════════════════════════════════════════════════════════════

    // Get metrics summary
    fastify.get<{ Querystring: { from?: string; to?: string; agent?: string; model?: string } }>(
        '/api/ai/metrics',
        async (request, reply) => {
            const { getMetrics } = await import('../services/metricsService.js');
            const { from, to, agent, model } = request.query;

            const metrics = getMetrics({
                from: from ? new Date(from) : undefined,
                to: to ? new Date(to) : undefined,
                agent,
                model
            });

            return reply.send(metrics);
        }
    );

    // Get health status
    fastify.get('/api/ai/health', async (_request, reply) => {
        const { getHealthStatus } = await import('../services/metricsService.js');
        return reply.send(getHealthStatus());
    });

    // Get cost breakdown
    fastify.get<{ Querystring: { from?: string; to?: string } }>(
        '/api/ai/costs',
        async (request, reply) => {
            const { getCostBreakdown } = await import('../services/metricsService.js');
            const { from, to } = request.query;
            return reply.send(getCostBreakdown(
                from ? new Date(from) : undefined,
                to ? new Date(to) : undefined
            ));
        }
    );

    // ═══════════════════════════════════════════════════════════════════════════
    // RAG Knowledge Base API
    // ═══════════════════════════════════════════════════════════════════════════

    // Search knowledge base
    fastify.get<{ Querystring: { q: string; limit?: number } }>(
        '/api/ai/knowledge/search',
        async (request, reply) => {
            const { searchLocalKnowledge } = await import('../services/ragService.js');
            const { q, limit = 5 } = request.query;

            if (!q) {
                return reply.status(400).send({ error: 'Query parameter q is required' });
            }

            const results = searchLocalKnowledge(q, limit);
            return reply.send({ results, query: q });
        }
    );

    // Get document by ID
    fastify.get<{ Params: { id: string } }>(
        '/api/ai/knowledge/:id',
        async (request, reply) => {
            const { getDocument } = await import('../services/ragService.js');
            const doc = getDocument(request.params.id);

            if (!doc) {
                return reply.status(404).send({ error: 'Document not found' });
            }

            return reply.send(doc);
        }
    );

    // ═══════════════════════════════════════════════════════════════════════════
    // Realtime Voice API Status
    // ═══════════════════════════════════════════════════════════════════════════

    // Get Realtime API status and configuration
    fastify.get('/api/ai/realtime/status', async (_request, reply) => {
        const { getRealtimeStatus, getRealtimeConfig } = await import('../services/realtimeVoice.js');
        const status = getRealtimeStatus();
        const config = getRealtimeConfig();

        return reply.send({
            ...status,
            // Don't expose the full auth headers, just indicate if configured
            configured: !!config
        });
    });

    // Get session configuration for client-side WebSocket
    fastify.post<{ Body: { voice?: string; instructions?: string } }>(
        '/api/ai/realtime/session',
        async (request, reply) => {
            const { createSessionConfig, getRealtimeConfig } = await import('../services/realtimeVoice.js');
            const config = getRealtimeConfig();

            if (!config) {
                return reply.status(400).send({ error: 'OpenAI API key not configured' });
            }

            const sessionConfig = createSessionConfig({
                voice: request.body.voice as any,
                instructions: request.body.instructions
            });

            return reply.send({
                websocketUrl: config.url,
                model: config.model,
                apiVersion: config.apiVersion,
                sessionConfig
            });
        }
    );

    // ═══════════════════════════════════════════════════════════════════════════
    // WebRTC Ephemeral Key API (for browser-based Realtime connections)
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * Generate ephemeral API key for WebRTC Realtime connections
     *
     * OpenAI recommends WebRTC for browser apps for lower latency.
     * Ephemeral keys are valid for ~1 minute and used only to establish connection.
     *
     * Client flow:
     * 1. Call this endpoint to get ephemeral key
     * 2. Create RTCPeerConnection
     * 3. Get user media (microphone)
     * 4. Create SDP offer
     * 5. Send offer to OpenAI with ephemeral key
     * 6. Set answer as remote description
     * 7. Connect and stream audio
     */
    fastify.post<{ Body: { voice?: string; model?: string } }>(
        '/api/ai/realtime/ephemeral-key',
        async (request, reply) => {
            const openaiKey = getOpenAIKey();
            if (!openaiKey) {
                return reply.status(400).send({ error: 'OpenAI API key not configured' });
            }

            const { getRealtimeConfig } = await import('../services/realtimeVoice.js');
            const config = getRealtimeConfig();
            if (!config) {
                return reply.status(400).send({ error: 'Realtime API not available' });
            }

            try {
                // Request ephemeral token from OpenAI
                const response = await fetch('https://api.openai.com/v1/realtime/sessions', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${openaiKey}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        model: request.body.model || config.model,
                        voice: request.body.voice || 'cedar',
                    }),
                });

                if (!response.ok) {
                    const errorText = await response.text();
                    fastify.log.error({ status: response.status, error: errorText }, 'Failed to get ephemeral key');
                    return reply.status(response.status).send({
                        error: 'Failed to generate ephemeral key',
                        reason: response.status === 401 ? 'invalid_api_key' : 'upstream_error'
                    });
                }

                const data = await response.json() as {
                    id: string;
                    client_secret: { value: string; expires_at: number };
                    model: string;
                    voice: string;
                };

                fastify.log.info({ sessionId: data.id, model: data.model, voice: data.voice }, 'Generated ephemeral key for WebRTC');

                return reply.send({
                    ephemeralKey: data.client_secret.value,
                    expiresAt: data.client_secret.expires_at,
                    sessionId: data.id,
                    model: data.model,
                    voice: data.voice,
                    // Client needs this URL for WebRTC SDP exchange
                    sdpUrl: 'https://api.openai.com/v1/realtime/sdp',
                });
            } catch (error: any) {
                fastify.log.error({ err: error }, 'Error generating ephemeral key');
                return reply.status(500).send({
                    error: 'Failed to generate ephemeral key',
                    reason: 'server_error'
                });
            }
        }
    );

    // ═══════════════════════════════════════════════════════════════════════════
    // Streaming TTS API (ElevenLabs WebSocket proxy info)
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * Get ElevenLabs WebSocket streaming configuration
     *
     * Returns the WebSocket URL and configuration for client-side streaming TTS.
     * Client connects directly to ElevenLabs for lowest latency (~75ms with Flash v2.5).
     */
    fastify.get('/api/tts/streaming/config', async (_request, reply) => {
        const elevenLabsKey = getElevenLabsKey();
        if (!elevenLabsKey) {
            return reply.status(400).send({
                error: 'ElevenLabs API key not configured',
                available: false
            });
        }

        const voiceId = ELEVENLABS_VOICE_ID || 'EXAVITQu4vr4xnSDxMaL'; // Default: Sarah

        return reply.send({
            available: true,
            websocketUrl: `wss://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream-input`,
            model: ELEVENLABS_TTS_MODEL,
            voiceId,
            // Recommended chunk schedule for optimal latency/quality balance
            chunkLengthSchedule: [120, 160, 250, 290],
            // Client must include this in the initial WebSocket message
            authHeader: `xi-api-key: ${elevenLabsKey}`,
            // Best practices
            recommendations: {
                model: 'eleven_flash_v2_5',
                latency: '~75ms TTFB',
                format: 'mp3_44100_128',
                flush: 'Use flush:true at end of sentences',
            }
        });
    });
}
