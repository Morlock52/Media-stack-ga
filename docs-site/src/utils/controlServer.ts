import { Container, Agent, AiChatRequest, AiChatResponse } from '../types/api';

const getWindowOrigin = () =>
    typeof window !== 'undefined' ? window.location.origin.replace(/\/$/, '') : ''

const envUrl =
    typeof import.meta !== 'undefined' && import.meta.env?.VITE_CONTROL_SERVER_URL
        ? String(import.meta.env.VITE_CONTROL_SERVER_URL).trim().replace(/\/$/, '')
        : ''

const explicitBase = envUrl

export const controlServerBaseUrl = explicitBase

const envToken =
    typeof import.meta !== 'undefined' && import.meta.env?.VITE_CONTROL_SERVER_TOKEN
        ? String(import.meta.env.VITE_CONTROL_SERVER_TOKEN).trim()
        : ''

export const controlServerAuthHeaders = (): Record<string, string> =>
    envToken ? { Authorization: `Bearer ${envToken}` } : {}

export const buildControlServerUrl = (path: string) => {
    const normalized = path.startsWith('/') ? path : `/${path}`
    const origin = controlServerBaseUrl || getWindowOrigin()
    if (!origin) return normalized

    const sameOrigin = origin === getWindowOrigin()
    return sameOrigin ? normalized : `${origin}${normalized}`
}

// API Client
export const controlServer = {
    getContainers: async (): Promise<Container[]> => {
        const res = await fetch(buildControlServerUrl('/api/containers'), {
            headers: { ...controlServerAuthHeaders() },
        });
        if (!res.ok) throw new Error('Failed to fetch containers');
        return res.json();
    },

    serviceAction: async (serviceName: string, action: 'start' | 'stop' | 'restart') => {
        const res = await fetch(buildControlServerUrl(`/api/service/${action}`), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...controlServerAuthHeaders() },
            body: JSON.stringify({ serviceName })
        });
        if (!res.ok) throw new Error(`Failed to ${action} ${serviceName}`);
        return res.json();
    },

    getAgents: async (): Promise<{ agents: Agent[] }> => {
        const res = await fetch(buildControlServerUrl('/api/agents'), {
            headers: { ...controlServerAuthHeaders() },
        });
        if (!res.ok) throw new Error('Failed to fetch agents');
        return res.json();
    },

    chat: async (payload: AiChatRequest): Promise<AiChatResponse> => {
        const res = await fetch(buildControlServerUrl('/api/agent/chat'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...controlServerAuthHeaders() },
            body: JSON.stringify(payload)
        });
        if (!res.ok) throw new Error('Chat request failed');
        return res.json();
    },

    bootstrapArr: async (): Promise<{ success: boolean; keys: Record<string, string> }> => {
        const res = await fetch(buildControlServerUrl('/api/arr/bootstrap'), {
            method: 'POST',
            headers: { ...controlServerAuthHeaders() },
        });
        if (!res.ok) throw new Error('Failed to bootstrap Arr keys');
        return res.json();
    }
};
