/**
 * Shared Type Definitions
 * Used by both control-server and docs-site
 */

export interface Container {
    id: string;
    name: string;
    status: string;
    state: string;
    ports: string;
}

export interface ServiceIssue {
    type: 'stopped' | 'unhealthy' | 'restarting';
    service: string;
    message: string;
}

export interface Agent {
    id: string;
    name: string;
    icon: string;
    color: string;
    description: string;
    systemPrompt?: string;
}

export interface RemoteDeployRequest {
    host: string;
    port?: number;
    username: string;
    authType?: 'key' | 'password';
    privateKey?: string;
    password?: string;
    deployPath?: string;
    autoRemoveConflictingContainers?: boolean;
    autoDisableVpnOnTunMissing?: boolean;
    /** Optional: allow the UI to send generated outputs directly */
    composeYml?: string;
    envFile?: string;
}

export interface RemoteArrBootstrapRequest {
    host: string;
    port?: number;
    username: string;
    authType?: 'key' | 'password';
    privateKey?: string;
    password?: string;
    envHost?: string;
    envPort?: number;
    envUsername?: string;
    envAuthType?: 'key' | 'password';
    envPrivateKey?: string;
    envPassword?: string;
    envPath?: string;
}

export interface ChatMessage {
    role: 'system' | 'user' | 'assistant' | 'tool';
    content: string;
    tool_call_id?: string;
}

export interface AiChatRequest {
    message: string;
    agentId?: string;
    history?: ChatMessage[];
    context?: Record<string, unknown>;
}

export interface AiChatResponse {
    answer: string;
    agent: {
        id: string;
        name: string;
        icon: string;
    };
    nudges: string[];
    aiPowered: boolean;
    toolUsed?: {
        command: string;
        type?: string;
    } | null;
}

/** Voice agent request */
export interface VoiceAgentRequest {
    transcript: string;
    history?: ChatMessage[];
    context?: Record<string, unknown>;
}

/** Voice agent response with plan extraction */
export interface VoiceAgentResponse {
    agentResponse: string;
    plan: {
        services: string[];
        hosting: string | null;
        vpn: boolean;
    };
    meta: {
        model: string;
        usedFallback: boolean;
        reason?: string;
    };
}

/** TTS request */
export interface TtsRequest {
    text: string;
    provider?: 'openai';
    voice?: string;
    speed?: number;
}

/** STT (Speech-to-Text) status */
export interface SttStatus {
    hasKey: boolean;
    model: string;
    supportedFormats: string[];
}

/** TTS status */
export interface TtsStatus {
    provider: 'openai';
    hasKey: boolean;
    ttsModel?: string;
    ttsVoice?: string;
}

/** Realtime voice status */
export interface RealtimeStatus {
    available: boolean;
    configured: boolean;
    model: string;
    features: string[];
}
