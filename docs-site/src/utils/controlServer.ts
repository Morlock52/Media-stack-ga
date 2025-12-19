import { Container, Agent, AiChatRequest, AiChatResponse } from '../types/api';

export interface AppRegistryItem {
    id: string;
    name: string;
    description: string;
    repoUrl?: string;
    guideComponent?: string;
    category?: string;
    icon?: string;
    difficulty?: string;
    time?: string;
}

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

    getRegistry: async (): Promise<AppRegistryItem[]> => {
        const res = await fetch(buildControlServerUrl('/api/registry/apps'), {
            headers: { ...controlServerAuthHeaders() },
        });
        if (!res.ok) throw new Error('Failed to fetch registry');
        return res.json();
    },

    scrapeRepo: async (url: string): Promise<{ success: boolean; app: AppRegistryItem }> => {
        const res = await fetch(buildControlServerUrl('/api/registry/scrape'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...controlServerAuthHeaders() },
            body: JSON.stringify({ url })
        });
        if (!res.ok) {
            const error = await res.json();
            throw new Error(error.error || 'Failed to scrape repository');
        }
        return res.json();
    },

    removeRegistryApp: async (id: string): Promise<{ success: boolean }> => {
        const res = await fetch(buildControlServerUrl(`/api/registry/apps/${id}`), {
            method: 'DELETE',
            headers: { ...controlServerAuthHeaders() },
        });
        if (!res.ok) throw new Error('Failed to remove app from registry');
        return res.json();
    },

    bootstrapArr: async (): Promise<{ success: boolean; keys: Record<string, string> }> => {
        const res = await fetch(buildControlServerUrl('/api/registry/bootstrap-arr'), {
            method: 'POST',
            headers: { ...controlServerAuthHeaders() },
        });
        if (!res.ok) throw new Error('Failed to bootstrap Arr keys');
        return res.json();
    }
};
