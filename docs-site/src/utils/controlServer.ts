import { Container, Agent, AiChatRequest, AiChatResponse } from '../types/api';

const envUrl =
    typeof import.meta !== 'undefined' && import.meta.env?.VITE_CONTROL_SERVER_URL
        ? String(import.meta.env.VITE_CONTROL_SERVER_URL).trim().replace(/\/$/, '')
        : ''



const inferredLocal = 'http://127.0.0.1:3001' // Direct connection to local backend

const explicitBase = envUrl || inferredLocal

export const controlServerBaseUrl = explicitBase

export const buildControlServerUrl = (path: string) => {
    const normalized = path.startsWith('/') ? path : `/${path}`
    // If explicit base is set (e.g. production URL), use it. Otherwise relative.
    if (controlServerBaseUrl) {
        return `${controlServerBaseUrl}${normalized}`
    }
    return normalized
}

// API Client
export const controlServer = {
    getContainers: async (): Promise<Container[]> => {
        const res = await fetch(buildControlServerUrl('/api/containers'));
        if (!res.ok) throw new Error('Failed to fetch containers');
        return res.json();
    },

    serviceAction: async (serviceName: string, action: 'start' | 'stop' | 'restart') => {
        const res = await fetch(buildControlServerUrl(`/api/service/${action}`), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ serviceName })
        });
        if (!res.ok) throw new Error(`Failed to ${action} ${serviceName}`);
        return res.json();
    },

    getAgents: async (): Promise<{ agents: Agent[] }> => {
        const res = await fetch(buildControlServerUrl('/api/agents'));
        if (!res.ok) throw new Error('Failed to fetch agents');
        return res.json();
    },

    chat: async (payload: AiChatRequest): Promise<AiChatResponse> => {
        const res = await fetch(buildControlServerUrl('/api/agent/chat'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        if (!res.ok) throw new Error('Chat request failed');
        return res.json();
    }
};
