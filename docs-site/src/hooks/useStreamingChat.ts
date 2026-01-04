/**
 * useStreamingChat - Hook for SSE streaming chat with the AI agent
 * Provides real-time token-by-token response streaming
 * Updated: December 2025
 */

import { useState, useCallback, useRef } from 'react'
import { buildControlServerUrl, controlServerAuthHeaders } from '../utils/controlServer'

export type StreamingStatus =
    | 'idle'
    | 'connecting'
    | 'streaming'
    | 'complete'
    | 'error'

export interface StreamingChatOptions {
    onToken?: (token: string) => void
    onComplete?: (fullResponse: string) => void
    onError?: (error: Error) => void
    onAgentInfo?: (agent: { id: string; name: string; icon: string }) => void
    onMeta?: (meta: StreamingMeta) => void
}

export interface StreamingMeta {
    nudges?: Array<{ message: string; agent?: string }>
    nextSteps?: string[]
    plan?: unknown
    executionDetails?: unknown
    orchestrated?: boolean
}

export interface StreamChatRequest {
    history?: Array<{ role: 'user' | 'assistant'; content: string }>
    context?: Record<string, unknown>
    orchestrate?: boolean
    strategy?: 'parallel' | 'sequential' | 'adaptive'
}

export interface StreamingChatResult {
    streamChat: (message: string, agentId?: string, request?: StreamChatRequest) => Promise<string>
    cancelStream: () => void
    status: StreamingStatus
    currentResponse: string
    isStreaming: boolean
    error: Error | null
}

export function useStreamingChat(options: StreamingChatOptions = {}): StreamingChatResult {
    const [status, setStatus] = useState<StreamingStatus>('idle')
    const [currentResponse, setCurrentResponse] = useState('')
    const [error, setError] = useState<Error | null>(null)
    const eventSourceRef = useRef<EventSource | null>(null)
    const responseRef = useRef('')

    const cancelStream = useCallback(() => {
        if (eventSourceRef.current) {
            eventSourceRef.current.close()
            eventSourceRef.current = null
        }
        setStatus('idle')
    }, [])

    const streamChat = useCallback(async (message: string, agentId?: string, request?: StreamChatRequest): Promise<string> => {
        // Cancel any existing stream
        cancelStream()

        // Reset state
        setStatus('connecting')
        setCurrentResponse('')
        setError(null)
        responseRef.current = ''

        return new Promise((resolve, reject) => {
            try {
                const url = new URL(buildControlServerUrl('/api/agent/chat/stream'))
                const authHeaders = controlServerAuthHeaders()
                const needsBody = Boolean(request && (request.history || request.context || request.orchestrate || request.strategy))
                const body = needsBody
                    ? JSON.stringify({
                        message,
                        agentId,
                        history: request?.history,
                        context: request?.context,
                        orchestrate: request?.orchestrate,
                        strategy: request?.strategy
                    })
                    : undefined

                if (!needsBody) {
                    url.searchParams.set('message', message)
                    if (agentId) {
                        url.searchParams.set('agentId', agentId)
                    }
                }

                // Add auth headers via fetch first to check, then use EventSource
                // Note: EventSource doesn't support custom headers, so we use fetch for auth check
                if (needsBody || Object.keys(authHeaders).length > 0) {
                    const headers = {
                        ...authHeaders,
                        ...(needsBody ? { 'Content-Type': 'application/json' } : {})
                    }
                    streamWithFetch(url.toString(), headers, resolve, reject, needsBody ? 'POST' : 'GET', body)
                    return
                }

                // Use native EventSource if no auth needed
                const eventSource = new EventSource(url.toString())
                eventSourceRef.current = eventSource

                eventSource.onopen = () => {
                    setStatus('streaming')
                }

                eventSource.onmessage = (event) => {
                    if (event.data === '[DONE]') {
                        eventSource.close()
                        eventSourceRef.current = null
                        setStatus('complete')
                        options.onComplete?.(responseRef.current)
                        resolve(responseRef.current)
                        return
                    }

                    try {
                        const data = JSON.parse(event.data)

                        if (data.type === 'agent') {
                            options.onAgentInfo?.(data.agent)
                        } else if (data.type === 'text') {
                            responseRef.current += data.content
                            setCurrentResponse(responseRef.current)
                            options.onToken?.(data.content)
                        } else if (data.type === 'meta') {
                            options.onMeta?.(data.meta || data)
                        } else if (data.type === 'error') {
                            throw new Error(data.error)
                        }
                    } catch {
                        console.warn('Failed to parse SSE data:', event.data)
                    }
                }

                eventSource.onerror = (err) => {
                    console.error('SSE error:', err)
                    eventSource.close()
                    eventSourceRef.current = null
                    const error = new Error('Stream connection failed')
                    setError(error)
                    setStatus('error')
                    options.onError?.(error)
                    reject(error)
                }
            } catch (err) {
                const error = err instanceof Error ? err : new Error('Unknown error')
                setError(error)
                setStatus('error')
                options.onError?.(error)
                reject(error)
            }
        })

        // Helper for fetch-based streaming (supports auth headers)
        async function streamWithFetch(
            url: string,
            headers: Record<string, string>,
            resolve: (value: string) => void,
            reject: (reason: Error) => void,
            method: 'GET' | 'POST',
            body?: string
        ) {
            try {
                const response = await fetch(url, {
                    method,
                    headers: {
                        Accept: 'text/event-stream',
                        ...headers
                    },
                    body
                })

                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`)
                }

                if (!response.body) {
                    throw new Error('No response body')
                }

                setStatus('streaming')

                const reader = response.body.getReader()
                const decoder = new TextDecoder()
                let buffer = ''

                while (true) {
                    const { done, value } = await reader.read()
                    if (done) break

                    buffer += decoder.decode(value, { stream: true })
                    const lines = buffer.split('\n')
                    buffer = lines.pop() || ''

                    for (const line of lines) {
                        if (line.startsWith('data: ')) {
                            const data = line.slice(6)
                            if (data === '[DONE]') {
                                setStatus('complete')
                                options.onComplete?.(responseRef.current)
                                resolve(responseRef.current)
                                return
                            }

                            try {
                                const parsed = JSON.parse(data)
                                if (parsed.type === 'agent') {
                                    options.onAgentInfo?.(parsed.agent)
                                } else if (parsed.type === 'text') {
                                    responseRef.current += parsed.content
                                    setCurrentResponse(responseRef.current)
                                    options.onToken?.(parsed.content)
                                } else if (parsed.type === 'meta') {
                                    options.onMeta?.(parsed.meta || parsed)
                                } else if (parsed.type === 'error') {
                                    throw new Error(parsed.error)
                                }
                            } catch {
                                // Skip invalid JSON
                            }
                        }
                    }
                }

                setStatus('complete')
                options.onComplete?.(responseRef.current)
                resolve(responseRef.current)
            } catch (err) {
                const error = err instanceof Error ? err : new Error('Stream failed')
                setError(error)
                setStatus('error')
                options.onError?.(error)
                reject(error)
            }
        }
    }, [cancelStream, options])

    return {
        streamChat,
        cancelStream,
        status,
        currentResponse,
        isStreaming: status === 'streaming' || status === 'connecting',
        error
    }
}
