import { Container, Agent, AiChatRequest, AiChatResponse } from '../types/api';
import { getErrorMessage, log } from './logging';

const getWindowOrigin = () =>
    typeof window !== 'undefined' ? window.location.origin.replace(/\/$/, '') : ''

const isLoopbackHost = (hostname: string) => {
    const normalized = String(hostname || '').trim().toLowerCase()
    return normalized === 'localhost' || normalized === '127.0.0.1' || normalized === '::1'
}

const isPrivateIpv4Host = (hostname: string) => {
    const parts = String(hostname || '').trim().split('.')
    if (parts.length !== 4) return false
    const nums = parts.map((p) => parseInt(p, 10))
    if (nums.some((n) => !Number.isFinite(n) || n < 0 || n > 255)) return false
    const [a, b] = nums
    if (a === 10) return true
    if (a === 192 && b === 168) return true
    if (a === 172 && b >= 16 && b <= 31) return true
    if (a === 100 && b >= 64 && b <= 127) return true // CGNAT
    if (a === 169 && b === 254) return true // link-local
    return false
}

const isLocalNetworkHost = (hostname: string) => {
    const lower = String(hostname || '').trim().toLowerCase()
    if (isLoopbackHost(lower)) return true
    if (isPrivateIpv4Host(lower)) return true
    if (lower.startsWith('fd') || lower.startsWith('fc') || lower.startsWith('fe80:')) return true
    if (lower.endsWith('.local') || lower.endsWith('.lan')) return true
    return false
}

const tryParseJson = (text: string) => {
    if (!text?.trim()) return null
    try {
        return JSON.parse(text)
    } catch {
        return null
    }
}

const getDefaultControlServerBaseUrl = (): string => {
    if (typeof window === 'undefined') return ''

    const isDev = typeof import.meta !== 'undefined' && Boolean(import.meta.env?.DEV)
    const { hostname, port, protocol } = window.location
    const isLoopback = isLoopbackHost(hostname)
    const portNum = parseInt(port || '', 10)

    // Dev default: point the SPA to the local API unless explicitly configured.
    if (isDev && isLoopback) return 'http://127.0.0.1:3001'

    // If the UI is accessed via a LAN IP / .local hostname, default the API to the same host on port 3001.
    // This supports opening the wizard from another device (phone/tablet) while the control-server runs on the host.
    if (!isLoopback) {
        if (isLocalNetworkHost(hostname)) {
            if (Number.isFinite(portNum) && portNum === 3001) return ''
            return `${protocol}//${hostname}:3001`
        }
        return ''
    }

    // For any loopback-hosted UI (including IDE browser preview proxy ports),
    // default API calls to the local control-server.
    // This avoids sending /api requests to the UI origin, which commonly returns
    // SPA HTML with a 200 and can break JSON parsing in startup hooks.
    if (!Number.isFinite(portNum)) return 'http://127.0.0.1:3001'
    if (portNum === 3001) return ''
    return 'http://127.0.0.1:3001'
}

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
    if (envUrl) {
        if (typeof window !== 'undefined') {
            try {
                const parsed = new URL(envUrl)
                const envHost = parsed.hostname
                const envPort = parsed.port || '3001'
                const pageHost = window.location.hostname
                if (isLoopbackHost(envHost) && !isLoopbackHost(pageHost) && isLocalNetworkHost(pageHost)) {
                    return `${parsed.protocol}//${pageHost}:${envPort}`
                }
            } catch {
                // ignore parse failures and use envUrl as-is
            }
        }
        return envUrl
    }
    if (typeof window === 'undefined') return ''
    try {
        const stored = window.localStorage.getItem(CONTROL_SERVER_URL_STORAGE_KEY)
        if (stored) return stored.trim().replace(/\/$/, '')
    } catch {
        // ignore storage failures
    }
    return getDefaultControlServerBaseUrl()
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
    const configuredOrigin = getControlServerBaseUrl()

    if (configuredOrigin) {
        const sameOrigin = configuredOrigin === getWindowOrigin()
        return sameOrigin ? normalized : `${configuredOrigin}${normalized}`
    }

    const fallbackOrigin = getDefaultControlServerBaseUrl() || getWindowOrigin()
    if (!fallbackOrigin) return normalized

    const sameOrigin = fallbackOrigin === getWindowOrigin()
    return sameOrigin ? normalized : `${fallbackOrigin}${normalized}`
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

    systemRestart: async () => {
        try {
            const res = await fetch(buildControlServerUrl('/api/system/restart'), {
                method: 'POST',
                headers: { ...controlServerAuthHeaders() },
            })
            if (!res.ok) {
                const body = await res.text().catch(() => '')
                throw new Error(`Failed to restart system (HTTP ${res.status}): ${body || res.statusText}`)
            }
            return res.json()
        } catch (err) {
            log('error', 'controlServer.systemRestart failed', err)
            throw new Error(getErrorMessage(err))
        }
    },

    getNetworkInfo: async (): Promise<{
        success: boolean
        inContainer: boolean
        hostname: string
        ipv4: string[]
        ipv6: string[]
        lanIpv4: string | null
        error?: string
    }> => {
        try {
            const res = await fetch(buildControlServerUrl('/api/system/network'), {
                headers: { ...controlServerAuthHeaders() },
            })
            const text = await res.text().catch(() => '')
            const parsed = tryParseJson(text) as any

            if (!res.ok) {
                const message = parsed?.error || text || res.statusText
                throw new Error(`Failed to get network info (HTTP ${res.status}): ${message}`)
            }

            if (parsed && typeof parsed === 'object') return parsed
            return { success: false, inContainer: false, hostname: '', ipv4: [], ipv6: [], lanIpv4: null, error: 'Invalid response' }
        } catch (err) {
            log('error', 'controlServer.getNetworkInfo failed', err)
            throw new Error(getErrorMessage(err))
        }
    },

    localDeploy: async (payload: {
        envContent: string
        profiles: string[]
        composeFile?: string
    }): Promise<{
        success: boolean
        steps: Array<{ step: string; status: 'done' | 'error' }>
        containers?: Array<{ name: string; on: boolean }>
        message?: string
        error?: string
    }> => {
        try {
            const res = await fetch(buildControlServerUrl('/api/local-deploy'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...controlServerAuthHeaders() },
                body: JSON.stringify(payload),
            })
            const text = await res.text().catch(() => '')
            const parsed = tryParseJson(text) as any

            if (!res.ok) {
                const message = parsed?.error || text || res.statusText
                throw new Error(`Local deploy failed (HTTP ${res.status}): ${message}`)
            }

            if (parsed && typeof parsed === 'object') return parsed
            return { success: false, steps: [], error: 'Invalid response' }
        } catch (err) {
            log('error', 'controlServer.localDeploy failed', err)
            throw new Error(getErrorMessage(err))
        }
    },

    composeServices: async (): Promise<{ services: string[] }> => {
        try {
            const res = await fetch(buildControlServerUrl('/api/compose/services'), {
                headers: { ...controlServerAuthHeaders() },
            })
            if (!res.ok) {
                const body = await res.text().catch(() => '')
                throw new Error(`Failed to list compose services (HTTP ${res.status}): ${body || res.statusText}`)
            }
            return res.json()
        } catch (err) {
            log('error', 'controlServer.composeServices failed', err)
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

    bootstrapArr: async (options?: { signal?: AbortSignal }): Promise<{ success: boolean; keys: Record<string, string>; error?: string }> => {
        try {
            const res = await fetch(buildControlServerUrl('/api/arr/bootstrap'), {
                method: 'POST',
                headers: { ...controlServerAuthHeaders() },
                signal: options?.signal,
            });
            const text = await res.text().catch(() => '')
            const parsed = tryParseJson(text) as any

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

    // Get status of all *arr services
    getArrStatus: async (): Promise<{
        success: boolean;
        services: Array<{ id: string; running: boolean; ready: boolean }>;
        error?: string;
    }> => {
        try {
            const res = await fetch(buildControlServerUrl('/api/arr/status'), {
                headers: { ...controlServerAuthHeaders() },
            });
            const text = await res.text().catch(() => '');
            const parsed = tryParseJson(text) as any;

            if (!res.ok) {
                const message = parsed?.error || text || res.statusText;
                throw new Error(`Failed to get Arr status (HTTP ${res.status}): ${message}`);
            }

            if (parsed && typeof parsed === 'object') return parsed;
            return { success: false, services: [], error: 'Invalid response' };
        } catch (err) {
            log('error', 'controlServer.getArrStatus failed', err);
            throw new Error(getErrorMessage(err));
        }
    },

    // Auto-bootstrap: wait for services, extract keys, write to .env
    autoBootstrapArr: async (options?: {
        timeout?: number;
        pollInterval?: number;
    }): Promise<{
        success: boolean;
        step: string;
        keys: Record<string, string>;
        services: Array<{ id: string; running: boolean; ready: boolean }>;
        validations?: Record<string, { ok: boolean; tested: boolean; status?: number; error?: string }>;
        error?: string;
    }> => {
        try {
            const res = await fetch(buildControlServerUrl('/api/arr/auto-bootstrap'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...controlServerAuthHeaders() },
                body: JSON.stringify(options || {}),
            });
            const text = await res.text().catch(() => '');
            const parsed = tryParseJson(text) as any;

            if (!res.ok) {
                const message = parsed?.error || text || res.statusText;
                throw new Error(`Auto-bootstrap failed (HTTP ${res.status}): ${message}`);
            }

            if (parsed && typeof parsed === 'object') return parsed;
            return { success: false, step: 'error', keys: {}, services: [], error: 'Invalid response' };
        } catch (err) {
            log('error', 'controlServer.autoBootstrapArr failed', err);
            throw new Error(getErrorMessage(err));
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
            const parsed = tryParseJson(text) as any

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

    autoBootstrapArrRemote: async (payload: {
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
        timeout?: number
        pollInterval?: number
    }): Promise<{
        success: boolean
        step: string
        keys: Record<string, string>
        services: Array<{ id: string; running: boolean; ready: boolean }>
        env?: { host: string; path: string }
        scan?: { host: string }
        error?: string
    }> => {
        try {
            const res = await fetch(buildControlServerUrl('/api/arr/auto-bootstrap-remote'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...controlServerAuthHeaders() },
                body: JSON.stringify(payload),
            })
            const text = await res.text().catch(() => '')
            const parsed = tryParseJson(text) as any

            if (!res.ok) {
                if (parsed && typeof parsed === 'object') return parsed
                throw new Error(`Failed to auto-bootstrap Arr keys remotely (HTTP ${res.status}): ${text || res.statusText}`)
            }

            if (parsed && typeof parsed === 'object') return parsed
            return { success: false, step: 'error', keys: {}, services: [], error: 'Invalid response' }
        } catch (err) {
            log('error', 'controlServer.autoBootstrapArrRemote failed', err)
            throw new Error(getErrorMessage(err))
        }
    },
};
