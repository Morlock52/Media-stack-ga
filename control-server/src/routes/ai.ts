import { FastifyInstance } from 'fastify';
import { AGENTS, detectAgent, buildAgentMessages, getFallbackResponse, getProactiveNudges } from '../agents.js';
import { readEnvFile, setEnvValue, removeEnvKey, PROJECT_ROOT } from '../utils/env.js';
import { runCommand } from '../utils/docker.js';
import fs from 'fs';
import path from 'path';
import { AiChatRequest } from '../types/index.js';
import * as registryService from '../services/registryService.js';
import * as docService from '../services/docService.js';
import * as arrService from '../services/arrService.js';

const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o';
const OPENAI_TTS_MODEL = process.env.OPENAI_TTS_MODEL || 'gpt-4o-mini-tts';
const OPENAI_TTS_FALLBACK_MODEL = process.env.OPENAI_TTS_FALLBACK_MODEL || 'tts-1';
const OPENAI_TTS_VOICE = process.env.OPENAI_TTS_VOICE || 'alloy';

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

const assertValidTtsFormat = (format: unknown): 'mp3' | 'wav' | 'opus' => {
    if (format === 'wav' || format === 'opus' || format === 'mp3') return format;
    return 'mp3';
};

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
        }),
    });

    return response;
};

const sendTtsUpstreamError = async (reply: any, response: Response, fallbackMessage: string) => {
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
            error: 'OpenAI authentication failed',
            reason: 'invalid_api_key',
            upstreamStatus,
        });
    }

    if (isRateLimited) {
        return reply.status(429).send({
            error: 'OpenAI rate limited',
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
                        temperature: 0.7
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
            voice?: string;
            format?: 'mp3' | 'wav' | 'opus';
        };
    }>('/api/tts', async (request, reply) => {
        const { text, voice, format } = request.body || {};
        const effectiveApiKey = getOpenAIKey();

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
                });
            }

            if (!response.ok) {
                fastify.log.warn({ status: response.status }, 'OpenAI TTS error');
                return sendTtsUpstreamError(reply, response, 'TTS failed');
            }

            const audioBuffer = Buffer.from(await response.arrayBuffer());
            reply.header('Cache-Control', 'no-store');
            reply.header('Content-Type', contentTypeForTtsFormat(requestedFormat));
            reply.header('X-TTS-Model', response === primary ? OPENAI_TTS_MODEL : OPENAI_TTS_FALLBACK_MODEL);
            return reply.send(audioBuffer);
        } catch (error: any) {
            fastify.log.warn({ err: error }, 'TTS failed');
            return reply.status(502).send({ error: 'TTS failed', reason: 'server_error' });
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
                    response_format: { type: 'json_object' }
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
                            name: "manage_app",
                            description: "Manage applications in the registry (list, add, remove, update)",
                            parameters: {
                                type: "object",
                                properties: {
                                    action: {
                                        type: "string",
                                        enum: ["list", "add", "remove", "update"],
                                        description: "Action to perform"
                                    },
                                    app: {
                                        type: "object",
                                        properties: {
                                            id: { type: "string" },
                                            name: { type: "string" },
                                            description: { type: "string" },
                                            repoUrl: { type: "string" },
                                            category: { type: "string" },
                                            icon: { type: "string" },
                                            guideComponent: { type: "string" }
                                        },
                                        description: "App details for add/update"
                                    },
                                    appId: {
                                        type: "string",
                                        description: "App ID for remove/update"
                                    }
                                },
                                required: ["action"]
                            }
                        }
                    },
                    {
                        type: "function",
                        function: {
                            name: "manage_doc",
                            description: "Manage documentation components (list, read, create, update)",
                            parameters: {
                                type: "object",
                                properties: {
                                    action: {
                                        type: "string",
                                        enum: ["list", "read", "create", "update"],
                                        description: "Action to perform"
                                    },
                                    name: {
                                        type: "string",
                                        description: "Name of the documentation component (e.g. 'PlexGuide')"
                                    },
                                    content: {
                                        type: "string",
                                        description: "Content for create/update (TSX code)"
                                    }
                                },
                                required: ["action"]
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
                        model: OPENAI_MODEL,
                        messages,
                        tools,
                        tool_choice: "auto",
                        max_tokens: 1000,
                        temperature: 0.7
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

                if (messageData?.tool_calls?.length > 0) {
                    const toolCall = messageData.tool_calls[0];
                    if (toolCall.function.name === 'analyze_logs') {
                        const args = JSON.parse(toolCall.function.arguments);
                        const service = args.serviceName;
                        const lines = args.lines || 50;
                        const command = `docker logs --tail ${lines} ${service}`;

                        fastify.log.info({ service, lines }, 'AI analyzing logs');
                        toolUsed = { command, type: 'logs' };

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
                                    temperature: 0.7
                                })
                            });

                            const secondData: any = await secondResponse.json();
                            answer = secondData.choices?.[0]?.message?.content;

                        } catch (err: any) {
                            answer = `I tried to check logs for ${service} but failed: ${err.message}`;
                        }
                    } else if (toolCall.function.name === 'validate_config') {
                        const args = JSON.parse(toolCall.function.arguments);
                        const filePath = path.join(PROJECT_ROOT, args.filePath);
                        const type = args.type;

                        fastify.log.info({ filePath, type }, 'AI validating config');
                        toolUsed = { command: `validate ${args.filePath}`, type: 'validation' };

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
                                    temperature: 0.7
                                })
                            });

                            const secondData: any = await secondResponse.json();
                            answer = secondData.choices?.[0]?.message?.content;

                        } catch (err: any) {
                            answer = `Validation failed for ${args.filePath}: ${err.message}`;
                        }
                    } else if (toolCall.function.name === 'manage_app') {
                        const args = JSON.parse(toolCall.function.arguments);
                        let result;
                        try {
                            switch (args.action) {
                                case 'list':
                                    result = JSON.stringify(registryService.loadRegistry());
                                    break;
                                case 'add':
                                    result = JSON.stringify(registryService.addApp(args.app));
                                    break;
                                case 'remove':
                                    result = JSON.stringify(registryService.removeApp(args.appId));
                                    break;
                                case 'update':
                                    result = JSON.stringify(registryService.updateApp(args.appId, args.app));
                                    break;
                                default:
                                    result = `Unknown action: ${args.action}`;
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
                                    temperature: 0.7
                                })
                            });

                            const secondData: any = await secondResponse.json();
                            answer = secondData.choices?.[0]?.message?.content;
                        } catch (err: any) {
                            answer = `App management failed: ${err.message}`;
                        }
                    } else if (toolCall.function.name === 'manage_doc') {
                        const args = JSON.parse(toolCall.function.arguments);
                        let result;
                        try {
                            switch (args.action) {
                                case 'list':
                                    result = JSON.stringify(docService.listDocs());
                                    break;
                                case 'read':
                                    result = docService.readDoc(args.name);
                                    break;
                                case 'create':
                                    result = JSON.stringify(docService.createDoc(args.name, args.content));
                                    break;
                                case 'update':
                                    result = JSON.stringify(docService.updateDoc(args.name, args.content));
                                    break;
                                default:
                                    result = `Unknown action: ${args.action}`;
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
                                    temperature: 0.7
                                })
                            });

                            const secondData: any = await secondResponse.json();
                            answer = secondData.choices?.[0]?.message?.content;
                        } catch (err: any) {
                            answer = `Doc management failed: ${err.message}`;
                        }
                    } else if (toolCall.function.name === 'bootstrap_arr') {
                        fastify.log.info('AI bootstrapping *arr keys');
                        toolUsed = { command: 'bootstrap-arr-keys', type: 'setup' };

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
                                    temperature: 0.7
                                })
                            });

                            const secondData: any = await secondResponse.json();
                            answer = secondData.choices?.[0]?.message?.content;
                        } catch (err: any) {
                            answer = `Bootstrap failed: ${err.message}`;
                        }
                    }
                }

                return {
                    answer: answer || 'Sorry, I could not generate a response.',
                    agent: { id: agent.id, name: agent.name, icon: agent.icon },
                    nudges,
                    aiPowered: true,
                    toolUsed
                };

            } catch (error: any) {
                fastify.log.error({ err: error, agent: agent?.id }, '[agent/chat] OpenAI error, falling back to canned response');
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
}
