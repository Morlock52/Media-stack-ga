import { Container, Agent, AiChatRequest, AiChatResponse } from '../types/api';
import { getErrorMessage, log } from './logging';

const getWindowOrigin = () =>
    typeof window !== 'undefined' ? window.location.origin.replace(/\/$/, '') : ''

const CONTROL_SERVER_URL_STORAGE_KEY = 'mediastack.controlServerUrl'
const CONTROL_SERVER_TOKEN_STORAGE_KEY = 'mediastack.controlServerToken'

const envUrl =
    typeof import.meta !== 'undefined' && import.meta.env?.VITE_CONTROL_SERVER_URL
        ? String(import.meta.env.VITE_CONTROL_SERVER_URL).trim().replace(/\/$/, '')
        : ''

const envToken =
    typeof import.meta !== 'undefined' && import.meta.env?.VITE_CONTROL_SERVER_TOKEN
        ? String(import.meta.env.VITE_CONTROL_SERVER_TOKEN).trim()
        : ''

export const getControlServerBaseUrl = (): string => {
    if (envUrl) return envUrl
    if (typeof window === 'undefined') return ''
    try {
        const stored = window.localStorage.getItem(CONTROL_SERVER_URL_STORAGE_KEY)
        return stored ? stored.trim().replace(/\/$/, '') : ''
    } catch {
        return ''
    }
}

export const setControlServerBaseUrl = (nextUrl: string) => {
    if (typeof window === 'undefined') return
    const trimmed = String(nextUrl || '').trim().replace(/\/$/, '')
    try {
        if (!trimmed) window.localStorage.removeItem(CONTROL_SERVER_URL_STORAGE_KEY)
        else window.localStorage.setItem(CONTROL_SERVER_URL_STORAGE_KEY, trimmed)
    } catch {
        // ignore storage failures
    }
}

export const getControlServerToken = (): string => {
    if (envToken) return envToken
    if (typeof window === 'undefined') return ''
    try {
        return (window.localStorage.getItem(CONTROL_SERVER_TOKEN_STORAGE_KEY) || '').trim()
    } catch {
        return ''
    }
}

export const setControlServerToken = (token: string) => {
    if (typeof window === 'undefined') return
    const trimmed = String(token || '').trim()
    try {
        if (!trimmed) window.localStorage.removeItem(CONTROL_SERVER_TOKEN_STORAGE_KEY)
        else window.localStorage.setItem(CONTROL_SERVER_TOKEN_STORAGE_KEY, trimmed)
    } catch {
        // ignore storage failures
    }
}

export const controlServerAuthHeaders = (): Record<string, string> => {
    const token = getControlServerToken()
    if (!token) return {}
    return { Authorization: `Bearer ${token}` }
}

export const buildControlServerUrl = (path: string) => {
    const normalized = path.startsWith('/') ? path : `/${path}`
    const origin = getControlServerBaseUrl() || getWindowOrigin()
    if (!origin) return normalized

    const sameOrigin = origin === getWindowOrigin()
    return sameOrigin ? normalized : `${origin}${normalized}`
}

// API Client
export const controlServer = {
    getContainers: async (): Promise<Container[]> => {
        try {
            const res = await fetch(buildControlServerUrl('/api/containers'), {
                headers: { ...controlServerAuthHeaders() },
            });
            if (!res.ok) {
                const body = await res.text().catch(() => '')
                throw new Error(`Failed to fetch containers (HTTP ${res.status}): ${body || res.statusText}`)
            }
            return res.json();
        } catch (err) {
            log('error', 'controlServer.getContainers failed', err)
            throw new Error(getErrorMessage(err))
        }
    },

    serviceAction: async (serviceName: string, action: 'start' | 'stop' | 'restart') => {
        try {
            const res = await fetch(buildControlServerUrl(`/api/service/${action}`), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...controlServerAuthHeaders() },
                body: JSON.stringify({ serviceName })
            });
            if (!res.ok) {
                const body = await res.text().catch(() => '')
                throw new Error(`Failed to ${action} ${serviceName} (HTTP ${res.status}): ${body || res.statusText}`);
            }
            return res.json();
        } catch (err) {
            log('error', 'controlServer.serviceAction failed', { serviceName, action, error: err })
            throw new Error(getErrorMessage(err))
        }
    },

    getAgents: async (): Promise<{ agents: Agent[] }> => {
        try {
            const res = await fetch(buildControlServerUrl('/api/agents'), {
                headers: { ...controlServerAuthHeaders() },
            });
            if (!res.ok) {
                const body = await res.text().catch(() => '')
                throw new Error(`Failed to fetch agents (HTTP ${res.status}): ${body || res.statusText}`)
            }
            return res.json();
        } catch (err) {
            log('error', 'controlServer.getAgents failed', err)
            throw new Error(getErrorMessage(err))
        }
    },

    chat: async (payload: AiChatRequest): Promise<AiChatResponse> => {
        try {
            const res = await fetch(buildControlServerUrl('/api/agent/chat'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...controlServerAuthHeaders() },
                body: JSON.stringify(payload)
            });
            if (!res.ok) {
                const body = await res.text().catch(() => '')
                throw new Error(`Chat request failed (HTTP ${res.status}): ${body || res.statusText}`)
            }
            return res.json();
        } catch (err) {
            log('error', 'controlServer.chat failed', { error: err })
            throw new Error(getErrorMessage(err))
        }
    },

    bootstrapArr: async (): Promise<{ success: boolean; keys: Record<string, string>; error?: string }> => {
        try {
            const res = await fetch(buildControlServerUrl('/api/arr/bootstrap'), {
                method: 'POST',
                headers: { ...controlServerAuthHeaders() },
            });
            const text = await res.text().catch(() => '')
            const parsed = text ? (JSON.parse(text) as any) : null

            if (!res.ok) {
                const message = parsed?.error || text || res.statusText
                throw new Error(`Failed to bootstrap Arr keys (HTTP ${res.status}): ${message}`)
            }

            if (parsed && typeof parsed === 'object') return parsed
            return res.json();
        } catch (err) {
            log('error', 'controlServer.bootstrapArr failed', err)
            throw new Error(getErrorMessage(err))
        }
    },

    bootstrapArrRemote: async (payload: {
        host: string
        port?: number | string
        username: string
        authType?: 'key' | 'password'
        privateKey?: string
        password?: string
        envHost?: string
        envPort?: number | string
        envUsername?: string
        envAuthType?: 'key' | 'password'
        envPrivateKey?: string
        envPassword?: string
        envPath?: string
    }): Promise<{
        success: boolean
        keys: Record<string, string>
        env?: { host: string; path: string }
        scan?: { host: string }
        error?: string
    }> => {
        try {
            const res = await fetch(buildControlServerUrl('/api/arr/bootstrap-remote'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...controlServerAuthHeaders() },
                body: JSON.stringify(payload),
            })
            const text = await res.text().catch(() => '')
            const parsed = text ? (JSON.parse(text) as any) : null

            if (!res.ok) {
                if (parsed && typeof parsed === 'object') return parsed
                throw new Error(`Failed to bootstrap Arr keys remotely (HTTP ${res.status}): ${text || res.statusText}`)
            }

            if (parsed && typeof parsed === 'object') return parsed
            return res.json()
        } catch (err) {
            log('error', 'controlServer.bootstrapArrRemote failed', err)
            throw new Error(getErrorMessage(err))
        }
    },
};
