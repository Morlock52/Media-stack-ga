/**
 * OpenAI Realtime API Integration
 * Provides low-latency voice-to-voice AI interactions
 * Updated: December 2025
 *
 * Note: This requires WebSocket support in the client.
 * The Realtime API provides sub-200ms latency for voice interactions.
 */

import pino from 'pino';

const logger = pino({
    level: process.env.LOG_LEVEL || 'info',
    transport: { target: 'pino-pretty', options: { colorize: true } }
});

const REALTIME_API_URL = 'wss://api.openai.com/v1/realtime';
const REALTIME_MODEL = process.env.OPENAI_REALTIME_MODEL || 'gpt-4o-realtime-preview';

export interface RealtimeSession {
    id: string;
    status: 'connecting' | 'connected' | 'disconnected' | 'error';
    createdAt: Date;
    lastActivity: Date;
}

export interface RealtimeConfig {
    voice?: 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer';
    instructions?: string;
    tools?: Array<{
        type: 'function';
        name: string;
        description: string;
        parameters: Record<string, unknown>;
    }>;
    inputAudioFormat?: 'pcm16' | 'g711_ulaw' | 'g711_alaw';
    outputAudioFormat?: 'pcm16' | 'g711_ulaw' | 'g711_alaw';
    turnDetection?: {
        type: 'server_vad' | 'none';
        threshold?: number;
        prefixPaddingMs?: number;
        silenceDurationMs?: number;
    };
}

export interface RealtimeEvent {
    type: string;
    event_id?: string;
    [key: string]: unknown;
}

export type RealtimeEventHandler = (event: RealtimeEvent) => void;

/**
 * Create WebSocket connection configuration for Realtime API
 * This returns the configuration needed for client-side WebSocket connection
 */
export function getRealtimeConfig(): {
    url: string;
    model: string;
    headers: Record<string, string>;
} | null {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
        logger.warn('OpenAI API key not configured for Realtime API');
        return null;
    }

    return {
        url: `${REALTIME_API_URL}?model=${REALTIME_MODEL}`,
        model: REALTIME_MODEL,
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'OpenAI-Beta': 'realtime=v1'
        }
    };
}

/**
 * Generate session configuration message
 */
export function createSessionConfig(config: RealtimeConfig = {}): RealtimeEvent {
    const defaultInstructions = `You are a helpful AI assistant for Media Stack, a self-hosted media server platform.
You help users set up and configure Plex, Jellyfin, Sonarr, Radarr, and other media services.
Be concise and friendly. When discussing technical topics, provide clear step-by-step guidance.
If you don't know something specific about a service, say so and suggest checking the documentation.`;

    return {
        type: 'session.update',
        session: {
            modalities: ['text', 'audio'],
            voice: config.voice || 'alloy',
            instructions: config.instructions || defaultInstructions,
            input_audio_format: config.inputAudioFormat || 'pcm16',
            output_audio_format: config.outputAudioFormat || 'pcm16',
            turn_detection: config.turnDetection || {
                type: 'server_vad',
                threshold: 0.5,
                prefix_padding_ms: 300,
                silence_duration_ms: 500
            },
            tools: config.tools || getDefaultTools()
        }
    };
}

/**
 * Get default tools for voice agent
 */
function getDefaultTools() {
    return [
        {
            type: 'function',
            name: 'check_service_status',
            description: 'Check the status of a Docker service',
            parameters: {
                type: 'object',
                properties: {
                    serviceName: {
                        type: 'string',
                        description: 'Name of the service (e.g., plex, sonarr, radarr)'
                    }
                },
                required: ['serviceName']
            }
        },
        {
            type: 'function',
            name: 'get_setup_help',
            description: 'Get help with setting up a specific service',
            parameters: {
                type: 'object',
                properties: {
                    serviceName: {
                        type: 'string',
                        description: 'Name of the service to get help with'
                    },
                    topic: {
                        type: 'string',
                        description: 'Specific topic (e.g., installation, configuration, troubleshooting)'
                    }
                },
                required: ['serviceName']
            }
        },
        {
            type: 'function',
            name: 'run_diagnostic',
            description: 'Run a diagnostic check on the system',
            parameters: {
                type: 'object',
                properties: {
                    checkType: {
                        type: 'string',
                        enum: ['network', 'vpn', 'services', 'all'],
                        description: 'Type of diagnostic to run'
                    }
                },
                required: ['checkType']
            }
        }
    ];
}

/**
 * Create a text input event
 */
export function createTextInput(text: string): RealtimeEvent {
    return {
        type: 'conversation.item.create',
        item: {
            type: 'message',
            role: 'user',
            content: [
                {
                    type: 'input_text',
                    text
                }
            ]
        }
    };
}

/**
 * Create audio input event (for appending audio chunks)
 */
export function createAudioInput(base64Audio: string): RealtimeEvent {
    return {
        type: 'input_audio_buffer.append',
        audio: base64Audio
    };
}

/**
 * Commit audio buffer to trigger response
 */
export function createAudioCommit(): RealtimeEvent {
    return {
        type: 'input_audio_buffer.commit'
    };
}

/**
 * Request a response from the assistant
 */
export function createResponseRequest(): RealtimeEvent {
    return {
        type: 'response.create'
    };
}

/**
 * Cancel an in-progress response
 */
export function createResponseCancel(): RealtimeEvent {
    return {
        type: 'response.cancel'
    };
}

/**
 * Truncate audio playback
 */
export function createAudioTruncate(itemId: string, audioEndMs: number): RealtimeEvent {
    return {
        type: 'conversation.item.truncate',
        item_id: itemId,
        content_index: 0,
        audio_end_ms: audioEndMs
    };
}

/**
 * Parse realtime event and extract useful information
 */
export function parseRealtimeEvent(event: RealtimeEvent): {
    type: 'audio' | 'text' | 'tool_call' | 'error' | 'status' | 'other';
    data: unknown;
} {
    switch (event.type) {
        case 'response.audio.delta':
            return {
                type: 'audio',
                data: {
                    delta: event.delta,
                    itemId: event.item_id
                }
            };

        case 'response.audio_transcript.delta':
        case 'response.text.delta':
            return {
                type: 'text',
                data: {
                    delta: event.delta,
                    itemId: event.item_id
                }
            };

        case 'response.function_call_arguments.delta':
        case 'response.function_call_arguments.done':
            return {
                type: 'tool_call',
                data: {
                    name: event.name,
                    arguments: event.arguments,
                    callId: event.call_id
                }
            };

        case 'error': {
            const errorObj = event.error as { message?: string; code?: string } | undefined;
            return {
                type: 'error',
                data: {
                    message: errorObj?.message || 'Unknown error',
                    code: errorObj?.code
                }
            };
        }

        case 'session.created':
        case 'session.updated':
        case 'response.created':
        case 'response.done':
        case 'input_audio_buffer.committed':
        case 'input_audio_buffer.cleared':
            return {
                type: 'status',
                data: {
                    status: event.type
                }
            };

        default:
            return {
                type: 'other',
                data: event
            };
    }
}

/**
 * Handle tool call result
 */
export function createToolResult(callId: string, result: unknown): RealtimeEvent {
    return {
        type: 'conversation.item.create',
        item: {
            type: 'function_call_output',
            call_id: callId,
            output: JSON.stringify(result)
        }
    };
}

/**
 * Check if Realtime API is available
 */
export function isRealtimeAvailable(): boolean {
    return !!process.env.OPENAI_API_KEY;
}

/**
 * Get Realtime API status
 */
export function getRealtimeStatus(): {
    available: boolean;
    model: string;
    features: string[];
} {
    return {
        available: isRealtimeAvailable(),
        model: REALTIME_MODEL,
        features: [
            'voice-to-voice',
            'text-to-speech',
            'speech-to-text',
            'tool-calling',
            'server-vad',
            'interruption-handling'
        ]
    };
}

logger.info({ model: REALTIME_MODEL, available: isRealtimeAvailable() }, 'Realtime API service initialized');
