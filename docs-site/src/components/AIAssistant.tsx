import { useState, useRef, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import {
    MessageCircle, Send, X, Loader2, Bot,
    Sparkles, Copy, Check, User, HelpCircle, Brain,
    Mic, MicOff, Volume2, VolumeX
} from 'lucide-react'
import { buildControlServerUrl, controlServerAuthHeaders } from '../utils/controlServer'
import { ConfidenceBadge, type ConfidenceLevel, calculateConfidence } from './ui/confidence-badge'
import { useVoice } from '../contexts/VoiceContext'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip'
import { useSetupStore } from '../store/setupStore'
import { wizardStepAssistantData, wizardStepNames } from '../data/wizardAssistant'
import { useShallow } from 'zustand/react/shallow'
import { useControlServerOpenAIKeyStatus } from '../hooks/useControlServerOpenAIKeyStatus'
import { useStreamingChat } from '../hooks/useStreamingChat'

interface SourceAttribution {
    type: 'documentation' | 'logs' | 'config' | 'tool' | 'knowledge';
    name: string;
    description?: string;
}

interface Message {
    role: 'user' | 'assistant'
    content: string
    agent?: { id: string; name: string; icon: string }
    aiPowered?: boolean
    toolUsed?: { command: string }
    confidence?: ConfidenceLevel
    sources?: SourceAttribution[]
    nextSteps?: string[]
}

interface AIAssistantProps {
    currentApp?: string
}

interface Agent {
    id: string
    name: string
    icon: string
    color?: string
    description: string
}

const AGENT_COLORS: Record<string, string> = {
    setup: 'from-emerald-500 to-cyan-500',
    troubleshoot: 'from-red-500 to-red-600',
    apps: 'from-blue-500 to-blue-600',
    deploy: 'from-green-500 to-green-600',
    general: 'from-emerald-500 to-cyan-500',
}

// Agent icons - using emoji from server response instead
// const AGENT_REACT_ICONS kept for potential future use

// Enhanced agent status types for better UX transparency
type AgentStatus =
    | 'idle'
    | 'listening'      // Voice input active
    | 'thinking'       // LLM processing
    | 'searching'      // RAG retrieval
    | 'tool:check'     // Running health check
    | 'tool:docker'    // Docker operation
    | 'tool:network'   // Network diagnostics
    | 'using-computer' // Generic tool use
    | 'generating'     // Streaming response
    | 'responding'     // Sending response
    | 'speaking'       // TTS output
    | 'error'          // Recoverable error
    | 'offline'        // No connectivity

// Estimate tokens (roughly 4 chars per token for English text)
function estimateTokens(messages: Message[]): number {
    return Math.ceil(
        messages.reduce((total, msg) => total + msg.content.length, 0) / 4
    )
}

const STATUS_LABELS: Record<AgentStatus, { text: string; color: string }> = {
    idle: { text: 'Ready', color: 'bg-gray-500' },
    listening: { text: 'Listening...', color: 'bg-purple-500' },
    thinking: { text: 'Thinking...', color: 'bg-yellow-500' },
    searching: { text: 'Searching docs...', color: 'bg-cyan-500' },
    'tool:check': { text: 'Checking health...', color: 'bg-blue-500' },
    'tool:docker': { text: 'Docker operation...', color: 'bg-blue-600' },
    'tool:network': { text: 'Network check...', color: 'bg-indigo-500' },
    'using-computer': { text: 'Using computer...', color: 'bg-blue-500' },
    generating: { text: 'Generating...', color: 'bg-emerald-500' },
    responding: { text: 'Responding...', color: 'bg-green-500' },
    speaking: { text: 'Speaking...', color: 'bg-violet-500' },
    error: { text: 'Error - Retry?', color: 'bg-red-500' },
    offline: { text: 'Offline', color: 'bg-gray-600' },
}

type Suggestion = { text: string; agent: string; label?: string }

// LocalStorage key for dismissed nudges
const DISMISSED_NUDGES_KEY = 'ai-assistant-dismissed-nudges'

function getDismissedNudges(): Set<string> {
    try {
        const stored = localStorage.getItem(DISMISSED_NUDGES_KEY)
        return stored ? new Set(JSON.parse(stored)) : new Set()
    } catch {
        return new Set()
    }
}

function saveDismissedNudge(nudge: string): void {
    try {
        const dismissed = getDismissedNudges()
        dismissed.add(nudge)
        localStorage.setItem(DISMISSED_NUDGES_KEY, JSON.stringify([...dismissed]))
    } catch {
        // Ignore storage errors
    }
}

export function AIAssistant({ currentApp }: AIAssistantProps) {
    const [isOpen, setIsOpen] = useState(false)
    const [messages, setMessages] = useState<Message[]>([])
    const [input, setInput] = useState('')
    const [isLoading, setIsLoading] = useState(false)
    const [agents, setAgents] = useState<Agent[]>([])
    const [selectedAgent, setSelectedAgent] = useState<string | null>(null)
    const [status, setStatus] = useState<AgentStatus>('idle')
    const [suggestions, setSuggestions] = useState<Suggestion[]>([])
    const [copiedIdx, setCopiedIdx] = useState<number | null>(null)
    const [proactiveNudge, setProactiveNudge] = useState<string | null>(null)
    const [dismissedNudges, setDismissedNudges] = useState<Set<string>>(() => getDismissedNudges())
    const [streamingContent, setStreamingContent] = useState<string>('')
    const [streamingAgent, setStreamingAgent] = useState<{ id: string; name: string; icon: string } | null>(null)
    const [lastFailedMessage, setLastFailedMessage] = useState<string | null>(null)
    const [voiceEnabled, setVoiceEnabled] = useState(false) // Auto-speak responses
    const messagesEndRef = useRef<HTMLDivElement>(null)
    const inputRef = useRef<HTMLInputElement>(null)
    const sendMessageRef = useRef<(text: string) => void>(() => {})
    const spokenTextRef = useRef('') // Track what's been spoken for streaming TTS
    const streamMetaRef = useRef<{ nudges?: Array<{ message: string }>; nextSteps?: string[] } | null>(null)

    // Voice I/O integration
    const voice = useVoice()

    // Streaming chat hook with TTS sync
    const { streamChat, isStreaming, cancelStream } = useStreamingChat({
        onToken: (token) => {
            setStreamingContent(prev => {
                const newContent = prev + token

                // Streaming TTS: speak complete sentences as they arrive
                if (voiceEnabled && !voice.isSpeaking) {
                    const unspoken = newContent.slice(spokenTextRef.current.length)
                    // Check for sentence boundaries (., !, ?, or newline followed by more text)
                    const sentenceMatch = unspoken.match(/^(.+?[.!?\n])\s*/s)
                    if (sentenceMatch) {
                        const sentence = sentenceMatch[1].trim()
                        if (sentence.length > 5) { // Skip very short fragments
                            spokenTextRef.current = newContent.slice(0, spokenTextRef.current.length + sentenceMatch[0].length)
                            voice.speak(sentence)
                        }
                    }
                }

                return newContent
            })
        },
        onAgentInfo: (agent) => {
            setStreamingAgent(agent)
        },
        onMeta: (meta) => {
            streamMetaRef.current = meta
            if (meta?.nudges?.length) {
                const availableNudge = meta.nudges.find(
                    (n) => n?.message && !dismissedNudges.has(n.message)
                )
                if (availableNudge) {
                    setProactiveNudge(availableNudge.message)
                }
            }
        },
        onComplete: () => {
            setStatus('idle')
            // Speak any remaining text that wasn't spoken during streaming
            if (voiceEnabled) {
                setStreamingContent(prev => {
                    const unspoken = prev.slice(spokenTextRef.current.length).trim()
                    if (unspoken.length > 0) {
                        voice.speak(unspoken)
                    }
                    return prev
                })
            }
            spokenTextRef.current = ''
        },
        onError: () => {
            setStatus('error')
            spokenTextRef.current = ''
        }
    })
    const { currentStep: wizardStep, config, selectedServices } = useSetupStore(
        useShallow((state) => ({
            currentStep: state.currentStep,
            config: state.config,
            selectedServices: state.selectedServices,
        }))
    )
    const { hasKey: hasRemoteKey } = useControlServerOpenAIKeyStatus()
    const wizardStepInfo = wizardStepAssistantData[wizardStep]
    const wizardStepName = wizardStepNames[wizardStep] || `Step ${wizardStep + 1}`

    // Fetch available agents on mount (fronted by a single friendly orchestrator)
    useEffect(() => {
        const fallbackAgents: Agent[] = [
            {
                id: 'general',
                name: 'Stack Guide',
                icon: '🤝',
                description: 'Friendly orchestrator for your whole media stack',
            },
        ]

        const applyAgents = (agentList: Agent[]) => {
            if (!agentList || agentList.length === 0) {
                setAgents(fallbackAgents)
                setSelectedAgent(fallbackAgents[0]?.id ?? null)
                return
            }

            const orchestrator = agentList.find(agent => agent.id === 'general')
            const specialists = agentList.filter(agent => agent.id !== 'general')
            const orderedAgents = orchestrator ? [orchestrator, ...specialists] : agentList

            setAgents(orderedAgents)
            setSelectedAgent(orderedAgents.length > 1 ? null : orderedAgents[0]?.id ?? null)
        }

        fetch(buildControlServerUrl('/api/agents'), { headers: { ...controlServerAuthHeaders() } })
            .then(r => (r.ok ? r.json() : null))
            .then(data => {
                const serverAgents: Agent[] = data?.agents?.length ? data.agents : fallbackAgents
                applyAgents(serverAgents)
            })
            .catch(() => {
                applyAgents(fallbackAgents)
            })
    }, [])

    // Fetch remote suggestions for docs, otherwise fall back to wizard quick actions
    useEffect(() => {
        if (currentApp) {
            fetch(buildControlServerUrl('/api/agent/suggestions'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...controlServerAuthHeaders() },
                body: JSON.stringify({ currentApp })
            })
                .then(r => r.ok ? r.json() : null)
                .then(data => setSuggestions(data?.suggestions || []))
                .catch(() => setSuggestions([]))
        } else if (wizardStepInfo?.quickActions) {
            setSuggestions(
                wizardStepInfo.quickActions.map(action => ({
                    text: action.prompt,
                    agent: 'setup',
                    label: action.label
                }))
            )
        } else {
            setSuggestions([])
        }
    }, [currentApp, wizardStepInfo])

    // Scroll to bottom on new messages
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [messages])

    // Focus input when opened
    useEffect(() => {
        if (isOpen) {
            setTimeout(() => inputRef.current?.focus(), 100)
        }
    }, [isOpen])

    // Voice transcript handler - send transcribed speech as messages
    // Use ref to avoid stale closure issues with sendMessage
    useEffect(() => {
        voice.onTranscript((text) => {
            if (text.trim() && isOpen) {
                console.log('[Voice] Transcript received:', text)
                sendMessageRef.current(text)
            }
        })
    }, [isOpen, voice])

    // Sync voice status with component status
    useEffect(() => {
        if (voice.isListening) {
            setStatus('listening')
        } else if (voice.isSpeaking) {
            setStatus('speaking')
        }
    }, [voice.isListening, voice.isSpeaking])

    // Toggle voice listening
    const toggleVoiceListening = useCallback(async () => {
        if (voice.isListening) {
            voice.stopListening()
        } else {
            await voice.startListening()
        }
    }, [voice])

    // Toggle voice output (auto-speak responses)
    const toggleVoiceOutput = useCallback(() => {
        if (voiceEnabled) {
            voice.stopSpeaking()
        }
        setVoiceEnabled(!voiceEnabled)
    }, [voiceEnabled, voice])

    const sendMessage = useCallback(async (text?: string) => {
        const messageText = text || input.trim()
        if (!messageText || isLoading || isStreaming) return

        setInput('')
        setLastFailedMessage(null) // Clear any previous failed message
        const userMsg: Message = { role: 'user', content: messageText }
        setMessages(prev => [...prev, userMsg])
        setIsLoading(true)
        setStatus('thinking')
        setProactiveNudge(null)
        streamMetaRef.current = null
        setStreamingContent('')
        spokenTextRef.current = '' // Reset spoken text tracking
        setStreamingAgent(null)

        const recentTopics = [...messages, userMsg]
            .filter((msg) => msg.role === 'user')
            .slice(-4)
            .map((msg) => msg.content.toLowerCase())

        const vpnEnabled = selectedServices.includes('vpn')
        const envComplete = Boolean(config.timezone && config.puid && config.pgid && config.password)
        const hasDomain = Boolean(config.domain)
        const shouldOrchestrate = wizardStep >= 0

        const contextPayload = {
            currentApp,
            wizardStep,
            wizardStepName,
            selectedServices,
            recentTopics,
            userProgress: {
                step: wizardStep,
                envComplete,
                hasDomain,
            },
            config: {
                deploymentMode: config.deploymentMode,
                domain: config.domain,
                vpnEnabled,
            }
        }

        // Try streaming first for real-time feedback
        try {
            setStatus('generating')
            const response = await streamChat(messageText, selectedAgent || undefined, {
                history: messages.slice(-8),
                context: contextPayload,
                orchestrate: shouldOrchestrate,
                strategy: shouldOrchestrate ? 'sequential' : undefined,
            })

            // Streaming complete - add the final message
            const assistantMsg: Message = {
                role: 'assistant',
                content: response || 'Sorry, I could not respond.',
                agent: streamingAgent || { id: 'general', name: 'AI Assistant', icon: '🤖' },
                aiPowered: true,
                nextSteps: streamMetaRef.current?.nextSteps,
                confidence: calculateConfidence({
                    isValidated: Boolean(response),
                    hasExamples: true, // Streaming implies LLM processing
                    isRecommended: true
                })
            }
            setMessages(prev => [...prev, assistantMsg])
            setStreamingContent('')
            setStreamingAgent(null)
            setIsLoading(false)
            setStatus('idle')
            streamMetaRef.current = null

            // Auto-speak response if voice output is enabled
            if (voiceEnabled && response) {
                voice.speak(response)
            }
            return
        } catch (streamErr) {
            console.warn('Streaming failed, falling back to non-streaming:', streamErr)
            setStreamingContent('')
            setStreamingAgent(null)
        }

        // Fallback to non-streaming for richer context
        try {
            setStatus('thinking')
            const payload: {
                message: string
                history: Message[]
                context: {
                    currentApp?: string
                    wizardStep: number
                    wizardStepName: string
                    selectedServices: string[]
                    recentTopics: string[]
                    userProgress: {
                        step: number
                        envComplete: boolean
                        hasDomain: boolean
                    }
                    config: {
                        deploymentMode: string
                        domain: string
                        vpnEnabled: boolean
                    }
                }
                agentId?: string
                orchestrate?: boolean
                strategy?: 'parallel' | 'sequential' | 'adaptive'
            } = {
                message: messageText,
                history: messages.slice(-8),
                context: {
                    currentApp,
                    wizardStep,
                    wizardStepName,
                    selectedServices,
                    recentTopics,
                    userProgress: {
                        step: wizardStep,
                        envComplete,
                        hasDomain,
                    },
                    config: {
                        deploymentMode: config.deploymentMode,
                        domain: config.domain,
                        vpnEnabled,
                    }
                },
                orchestrate: shouldOrchestrate,
                strategy: shouldOrchestrate ? 'sequential' : undefined,
            }

            if (selectedAgent) {
                payload.agentId = selectedAgent
            }

            const res = await fetch(buildControlServerUrl('/api/agent/chat'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...controlServerAuthHeaders() },
                body: JSON.stringify(payload),
            })

            setStatus('responding')
            if (!res.ok) {
                throw new Error(`Chat request failed (${res.status})`)
            }

            const data = await res.json()

            const assistantMsg: Message = {
                role: 'assistant',
                content: data.answer || 'Sorry, I could not respond.',
                agent: data.agent,
                aiPowered: data.aiPowered,
                toolUsed: data.toolUsed,
                nextSteps: data.nextSteps,
                confidence: calculateConfidence({
                    isValidated: Boolean(data.answer),
                    hasExamples: data.aiPowered,
                    isRecommended: Boolean(data.toolUsed) // Tool usage increases confidence
                })
            }
            setMessages(prev => [...prev, assistantMsg])

            // Auto-speak response if voice output is enabled
            if (voiceEnabled && data.answer) {
                voice.speak(data.answer)
            }

            // Show proactive nudge if available (filter out dismissed ones)
            if (data.nudges?.length > 0) {
                const availableNudge = data.nudges.find(
                    (n: { message: string }) => !dismissedNudges.has(n.message)
                )
                if (availableNudge) {
                    setProactiveNudge(availableNudge.message)
                }
            }

        } catch (err) {
            console.warn('AIAssistant chat request failed:', err)
            setLastFailedMessage(messageText) // Store for retry
            setMessages(prev => [...prev, {
                role: 'assistant',
                content: "I'm having trouble connecting. Make sure the control server is running (`npm start` in control-server/).",
                agent: { id: 'general', name: 'System', icon: '⚠️' }
            }])
            setStatus('error')
        } finally {
            setIsLoading(false)
        }
    }, [input, isLoading, isStreaming, selectedAgent, messages, wizardStep, wizardStepName, selectedServices, hasRemoteKey, config.domain, config.deploymentMode, config.timezone, config.puid, config.pgid, config.password, currentApp, streamChat, streamingAgent, voiceEnabled, voice, dismissedNudges])

    // Keep sendMessageRef updated so voice callbacks can use latest version
    useEffect(() => {
        sendMessageRef.current = sendMessage
    }, [sendMessage])

    const retryLastMessage = () => {
        if (lastFailedMessage) {
            // Remove the last error message before retrying
            setMessages(prev => prev.slice(0, -1))
            setStatus('idle')
            sendMessage(lastFailedMessage)
        }
    }

    const copyToClipboard = (text: string, idx: number) => {
        navigator.clipboard.writeText(text)
        setCopiedIdx(idx)
        setTimeout(() => setCopiedIdx(null), 2000)
    }

    const clearChat = () => {
        setMessages([])
        setSelectedAgent(null)
    }

    return (
        <>
            {/* Floating Action Button */}
            <AnimatePresence>
                {!isOpen && (
                    <motion.button
                        initial={{ scale: 0, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0, opacity: 0 }}
                        onClick={() => setIsOpen(true)}
                        className="fixed bottom-4 right-4 z-50 w-14 h-14 rounded-full bg-gradient-to-r from-emerald-500 via-cyan-500 to-lime-400 text-white shadow-lg hover:shadow-emerald-500/30 hover:scale-110 transition-all flex items-center justify-center"
                        title="Ask AI Assistant"
                    >
                        <MessageCircle className="w-6 h-6" />
                        {hasRemoteKey && (
                            <span className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full flex items-center justify-center">
                                <Sparkles className="w-2.5 h-2.5" />
                            </span>
                        )}
                    </motion.button>
                )}
            </AnimatePresence>

            {/* Chat Panel - Modal Style */}
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: 20, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 20, scale: 0.95 }}
                        className="fixed bottom-4 right-4 z-50 w-[380px] max-w-[calc(100vw-2rem)] h-[500px] max-h-[calc(100vh-6rem)] bg-card border border-border rounded-2xl shadow-2xl overflow-hidden flex flex-col"
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between p-3 border-b border-border bg-gradient-to-r from-emerald-500/10 via-cyan-500/10 to-lime-500/10">
                            <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-full bg-gradient-to-r from-emerald-500 via-cyan-500 to-lime-400 flex items-center justify-center">
                                    <Bot className="w-4 h-4 text-white" />
                                </div>
                                <div>
                                    <h3 className="font-semibold text-sm">AI Stack Guide</h3>
                                    <div className="flex items-center gap-2">
                                        <p className="text-[10px] text-muted-foreground">
                                            {hasRemoteKey ? '✨ AI-powered' : 'Basic mode'}
                                        </p>
                                        {/* Status Chip - clickable when error */}
                                        {status === 'error' && lastFailedMessage ? (
                                            <button
                                                onClick={retryLastMessage}
                                                className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-medium ${STATUS_LABELS[status].color} text-white hover:opacity-80 transition-opacity cursor-pointer`}
                                                title="Click to retry"
                                            >
                                                ↻ Retry
                                            </button>
                                        ) : (
                                            <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-medium ${STATUS_LABELS[status].color} text-white`}>
                                                {status !== 'idle' && status !== 'error' && <Loader2 className="w-2 h-2 animate-spin" />}
                                                {STATUS_LABELS[status].text}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-center gap-1">
                                {/* Memory indicator */}
                                {messages.length > 0 && (
                                    <div className="flex items-center gap-1 text-[10px] text-muted-foreground mr-1" title="Conversation memory">
                                        <Brain className="w-3 h-3" />
                                        <span>{messages.length} msgs</span>
                                        <span className={estimateTokens(messages) > 3000 ? 'text-amber-500' : ''}>
                                            ({estimateTokens(messages)} tokens)
                                        </span>
                                    </div>
                                )}

                                {/* Voice output toggle */}
                                <TooltipProvider>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <button
                                                onClick={toggleVoiceOutput}
                                                className={`p-1.5 rounded-lg transition-colors ${
                                                    voiceEnabled
                                                        ? 'bg-violet-500/20 text-violet-400 hover:bg-violet-500/30'
                                                        : 'hover:bg-muted/60 text-muted-foreground hover:text-foreground'
                                                }`}
                                                title={voiceEnabled ? 'Disable voice responses' : 'Enable voice responses'}
                                            >
                                                {voiceEnabled ? (
                                                    <Volume2 className="w-4 h-4" />
                                                ) : (
                                                    <VolumeX className="w-4 h-4" />
                                                )}
                                            </button>
                                        </TooltipTrigger>
                                        <TooltipContent side="bottom">
                                            <p className="text-xs">{voiceEnabled ? 'Voice responses on' : 'Voice responses off'}</p>
                                        </TooltipContent>
                                    </Tooltip>
                                </TooltipProvider>

                                {messages.length > 0 && (
                                    <button
                                        onClick={clearChat}
                                        className={`p-1.5 hover:bg-muted/60 rounded-lg text-xs ${estimateTokens(messages) > 3000 ? 'text-amber-500 hover:text-amber-400' : 'text-muted-foreground hover:text-foreground'}`}
                                        title={estimateTokens(messages) > 3000 ? "Clear to save tokens" : "Clear chat"}
                                    >
                                        Clear
                                    </button>
                                )}
                                <button
                                    onClick={() => setIsOpen(false)}
                                    className="p-1.5 hover:bg-muted/60 rounded-lg"
                                    title="Close"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                        </div>

                        {/* Agent Selector (hidden when only one friendly orchestrator is used) */}
                        {agents.length > 1 && (
                            <div className="p-2 border-b border-border/50 bg-background/50">
                                <div className="flex items-center gap-1 overflow-x-auto pb-1 scrollbar-hide">
                                    <button
                                        onClick={() => setSelectedAgent(null)}
                                        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs whitespace-nowrap transition-all ${!selectedAgent
                                            ? 'bg-muted/60 text-foreground'
                                            : 'text-muted-foreground hover:text-foreground hover:bg-muted/40'
                                            }`}
                                    >
                                        <HelpCircle className="w-3.5 h-3.5" />
                                        Auto
                                    </button>
                                    {agents.map(agent => (
                                        <button
                                            key={agent.id}
                                            onClick={() => setSelectedAgent(agent.id)}
                                            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs whitespace-nowrap transition-all ${selectedAgent === agent.id
                                                ? `bg-gradient-to-r ${AGENT_COLORS[agent.id] || AGENT_COLORS.general} text-white`
                                                : 'text-muted-foreground hover:text-foreground hover:bg-muted/40'
                                                }`}
                                            title={agent.description}
                                        >
                                            <span>{agent.icon}</span>
                                            {agent.name.split(' ')[0]}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Messages */}
                        <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-3">
                            {messages.length === 0 ? (
                                <div className="text-center py-6 space-y-4">
                                    <div className="text-3xl">👋</div>
                                    <p className="text-sm text-muted-foreground">
                                        {wizardStepInfo?.greeting || "Hi! I'm here to help with your media stack. Ask me anything about setup, troubleshooting, or app configuration!"}
                                    </p>

                                    {wizardStepInfo?.proactiveTips && (
                                        <div className="mx-2 p-3 bg-muted/60 border border-border rounded-xl text-left">
                                            <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Tips for this step</p>
                                            <ul className="list-disc list-inside text-xs text-muted-foreground space-y-1">
                                                {wizardStepInfo.proactiveTips.map((tip, idx) => (
                                                    <li key={idx}>{tip}</li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}

                                    {/* API Key prompt when not configured */}
                                    {!hasRemoteKey && (
                                        <div className="mx-2 p-2 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                                            <p className="text-xs text-yellow-400">
                                                💡 <strong>Tip:</strong> Add your OpenAI API key in Settings for AI-powered responses!
                                            </p>
                                        </div>
                                    )}

                                    {/* Quick Suggestions */}
                                    <div className="space-y-2">
                                        <p className="text-xs text-muted-foreground">Try asking:</p>
                                        {(suggestions.length > 0 ? suggestions.slice(0, 3) : [
                                            { text: 'How do I set up Plex?', agent: 'apps' },
                                            { text: 'Help me get started', agent: 'setup' },
                                            { text: 'My containers keep restarting', agent: 'troubleshoot' }
                                        ]).map((s, i) => (
                                            <button
                                                key={i}
                                                onClick={() => sendMessage(s.text)}
                                                className="block w-full text-left px-3 py-2 text-xs bg-muted/60 hover:bg-muted/80 rounded-lg transition-colors"
                                            >
                                                <span className="text-muted-foreground mr-2">
                                                    {agents.find(a => a.id === s.agent)?.icon || '💬'}
                                                </span>
                                                <span className="font-medium text-foreground">{s.label || s.text}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            ) : (
                                messages.map((msg, idx) => (
                                    <div
                                        key={idx}
                                        className={`flex gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                                    >
                                        {msg.role === 'assistant' && (
                                            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-sm shrink-0 ${msg.agent?.id
                                                ? `bg-gradient-to-r ${AGENT_COLORS[msg.agent.id] || AGENT_COLORS.general}`
                                                : 'bg-gray-600'
                                                }`}>
                                                {msg.agent?.icon || '🤖'}
                                            </div>
                                        )}
                                        <div className={`max-w-[80%] ${msg.role === 'user' ? 'order-first' : ''}`}>
                                            {msg.role === 'assistant' && msg.agent && (
                                                <div className="flex items-center gap-1.5 mb-0.5">
                                                    <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                                                        {msg.agent.name}
                                                        {msg.aiPowered && <Sparkles className="w-2.5 h-2.5 text-primary" />}
                                                    </p>
                                                    {msg.confidence && (
                                                        <ConfidenceBadge level={msg.confidence} />
                                                    )}
                                                </div>
                                            )}
                                            <div className={`px-3 py-2 rounded-2xl text-sm ${msg.role === 'user'
                                                ? 'bg-gradient-to-r from-emerald-500 via-cyan-500 to-lime-400 text-white rounded-br-md'
                                                : 'bg-muted/60 text-foreground rounded-bl-md'
                                                }`}>
                                                <div className="whitespace-pre-wrap">{msg.content}</div>
                                            </div>
                                            {msg.toolUsed && (
                                                <div className="mt-1 mx-1 p-1.5 rounded bg-muted/60 border border-border text-[10px] font-mono text-primary flex items-center gap-1.5 opacity-80">
                                                    <span className="shrink-0">💻</span>
                                                    <span className="truncate">Executed: {msg.toolUsed.command}</span>
                                                </div>
                                            )}
                                                                                        {/* Source attribution for AI transparency */}
                                            {msg.sources && msg.sources.length > 0 && (
                                                <div className="mt-1.5 flex flex-wrap gap-1">
                                                    {msg.sources.map((source, sIdx) => (
                                                        <TooltipProvider key={sIdx}>
                                                            <Tooltip>
                                                                <TooltipTrigger asChild>
                                                                    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-medium cursor-help ${
                                                                        source.type === 'logs' ? 'bg-blue-500/20 text-blue-300' :
                                                                        source.type === 'config' ? 'bg-amber-500/20 text-amber-300' :
                                                                        source.type === 'tool' ? 'bg-purple-500/20 text-purple-300' :
                                                                        source.type === 'documentation' ? 'bg-cyan-500/20 text-cyan-300' :
                                                                        'bg-muted/60 text-muted-foreground'
                                                                    }`}>
                                                                        {source.type === 'logs' && '📋'}
                                                                        {source.type === 'config' && '⚙️'}
                                                                        {source.type === 'tool' && '🔧'}
                                                                        {source.type === 'documentation' && '📖'}
                                                                        {source.type === 'knowledge' && '🧠'}
                                                                        {source.name}
                                                                    </span>
                                                                </TooltipTrigger>
                                                                <TooltipContent side="top" className="text-xs">
                                                                    {source.description || `Source: ${source.name}`}
                                                                </TooltipContent>
                                                            </Tooltip>
                                                        </TooltipProvider>
                                                    ))}
                                                </div>
                                            )}
                                            {msg.nextSteps && msg.nextSteps.length > 0 && (
                                                <div className="mt-2 mx-1 p-2 rounded-lg bg-muted/40 border border-border">
                                                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">Next steps</p>
                                                    <ul className="list-disc list-inside text-xs text-muted-foreground space-y-1">
                                                        {msg.nextSteps.slice(0, 5).map((step, sIdx) => (
                                                            <li key={sIdx}>{step}</li>
                                                        ))}
                                                    </ul>
                                                </div>
                                            )}
                                            {msg.role === 'assistant' && (
                                                <button
                                                    onClick={() => copyToClipboard(msg.content, idx)}
                                                    className="mt-1 text-[10px] text-muted-foreground hover:text-foreground flex items-center gap-1"
                                                >
                                                    {copiedIdx === idx ? (
                                                        <><Check className="w-3 h-3" /> Copied</>
                                                    ) : (
                                                        <><Copy className="w-3 h-3" /> Copy</>
                                                    )}
                                                </button>
                                            )}
                                        </div>
                                        {msg.role === 'user' && (
                                            <div className="w-7 h-7 rounded-full bg-gray-600 flex items-center justify-center shrink-0">
                                                <User className="w-4 h-4" />
                                            </div>
                                        )}
                                    </div>
                                ))
                            )}

                            {/* Streaming response display */}
                            {(isLoading || isStreaming) && (
                                <div className="flex gap-2 items-start">
                                    <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
                                        streamingAgent?.id
                                            ? `bg-gradient-to-r ${AGENT_COLORS[streamingAgent.id] || AGENT_COLORS.general}`
                                            : 'bg-gradient-to-r from-emerald-500 via-cyan-500 to-lime-400'
                                    }`}>
                                        {streamingContent ? (
                                            <span className="text-sm">{streamingAgent?.icon || '🤖'}</span>
                                        ) : (
                                            <Loader2 className="w-4 h-4 animate-spin text-white" />
                                        )}
                                    </div>
                                    <div className="max-w-[80%]">
                                        {streamingAgent && (
                                            <p className="text-[10px] text-muted-foreground mb-0.5 flex items-center gap-1">
                                                {streamingAgent.name}
                                                <Sparkles className="w-2.5 h-2.5 text-primary" />
                                            </p>
                                        )}
                                        <div className="px-3 py-2 bg-muted/60 rounded-2xl rounded-bl-md">
                                            {streamingContent ? (
                                                <div className="text-sm whitespace-pre-wrap">
                                                    {streamingContent}
                                                    <span className="inline-block w-1 h-4 bg-primary/50 animate-pulse ml-0.5" />
                                                </div>
                                            ) : (
                                                <span className="text-sm text-muted-foreground">
                                                    {status === 'generating' ? 'Generating...' : 'Thinking...'}
                                                </span>
                                            )}
                                        </div>
                                        {isStreaming && (
                                            <button
                                                onClick={() => {
                                                    cancelStream()
                                                    setIsLoading(false)
                                                    setStatus('idle')
                                                    setStreamingContent('')
                                                }}
                                                className="mt-1 text-[10px] text-muted-foreground hover:text-foreground"
                                            >
                                                Cancel
                                            </button>
                                        )}
                                    </div>
                                </div>
                            )}
                            <div ref={messagesEndRef} />
                        </div>

                        {/* Proactive Nudge */}
                        {proactiveNudge && (
                            <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="mx-3 mb-2 p-2 bg-primary/10 border border-primary/30 rounded-xl"
                            >
                                <div className="flex items-start gap-2">
                                    <Sparkles className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                                    <div className="flex-1">
                                        <p className="text-xs text-primary/80">{proactiveNudge}</p>
                                        <div className="flex items-center gap-3 mt-1">
                                            <button
                                                onClick={() => {
                                                    sendMessage(proactiveNudge.replace(/^💡\s*(Tip:\s*)?/i, ''))
                                                    setProactiveNudge(null)
                                                }}
                                                className="text-[10px] text-primary/80 hover:text-primary"
                                            >
                                                Ask about this →
                                            </button>
                                            <button
                                                onClick={() => {
                                                    saveDismissedNudge(proactiveNudge)
                                                    setDismissedNudges(prev => new Set([...prev, proactiveNudge]))
                                                    setProactiveNudge(null)
                                                }}
                                                className="text-[10px] text-muted-foreground hover:text-primary/60"
                                            >
                                                Don't show again
                                            </button>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => setProactiveNudge(null)}
                                        className="text-primary/80 hover:text-primary"
                                        title="Dismiss suggestion"
                                    >
                                        <X className="w-3 h-3" />
                                    </button>
                                </div>
                            </motion.div>
                        )}

                        {/* Input */}
                        <div className="p-3 border-t border-border bg-background/50">
                            {/* Show partial transcript while listening */}
                            {voice.partialTranscript && (
                                <div className="mb-2 px-3 py-2 bg-purple-500/10 border border-purple-500/20 rounded-lg">
                                    <p className="text-xs text-purple-400 flex items-center gap-2">
                                        <span className="inline-block w-2 h-2 bg-purple-500 rounded-full animate-pulse" />
                                        {voice.partialTranscript}
                                    </p>
                                </div>
                            )}
                            <div className="flex items-center gap-2">
                                <input
                                    ref={inputRef}
                                    type="text"
                                    value={input}
                                    onChange={e => setInput(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
                                    placeholder={voice.isListening ? 'Listening...' : selectedAgent ? `Ask ${agents.find(a => a.id === selectedAgent)?.name}...` : "Ask anything..."}
                                    className="flex-1 bg-background/60 border border-border rounded-xl px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/60"
                                    disabled={isLoading || voice.isListening}
                                />

                                {/* Microphone button */}
                                <TooltipProvider>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <button
                                                onClick={toggleVoiceListening}
                                                disabled={isLoading}
                                                className={`p-2.5 rounded-xl transition-all ${
                                                    voice.isListening
                                                        ? 'bg-purple-500 text-white animate-pulse hover:bg-purple-600'
                                                        : 'bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground'
                                                } disabled:opacity-50 disabled:cursor-not-allowed`}
                                                title={voice.isListening ? 'Stop listening' : 'Start voice input'}
                                                aria-label={voice.isListening ? 'Stop listening' : 'Start voice input'}
                                            >
                                                {voice.isListening ? (
                                                    <MicOff className="w-4 h-4" />
                                                ) : (
                                                    <Mic className="w-4 h-4" />
                                                )}
                                            </button>
                                        </TooltipTrigger>
                                        <TooltipContent side="top">
                                            <p className="text-xs">
                                                {voice.isListening ? 'Stop listening' : 'Speak your message'}
                                            </p>
                                        </TooltipContent>
                                    </Tooltip>
                                </TooltipProvider>

                                <button
                                    onClick={() => sendMessage()}
                                    disabled={!input.trim() || isLoading || voice.isListening}
                                    className="p-2.5 bg-gradient-to-r from-emerald-500 via-cyan-500 to-lime-400 rounded-xl text-white disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90 transition-opacity"
                                    title="Send message"
                                    aria-label="Send message"
                                >
                                    <Send className="w-4 h-4" />
                                </button>
                            </div>
                            {!hasRemoteKey && !voice.isListening && (
                                <p className="text-[10px] text-muted-foreground mt-2 text-center">
                                    💡 Add an OpenAI key in Settings for smarter responses
                                </p>
                            )}
                            {voice.error && (
                                <p className="text-[10px] text-red-400 mt-2 text-center">
                                    {voice.error}
                                </p>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    )
}
