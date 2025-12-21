import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
    MessageCircle, Send, X, Loader2, Bot,
    Sparkles, Copy, Check, User, HelpCircle
} from 'lucide-react'
import { buildControlServerUrl, controlServerAuthHeaders } from '../utils/controlServer'
import { useSetupStore } from '../store/setupStore'
import { wizardStepAssistantData, wizardStepNames } from '../data/wizardAssistant'
import { useShallow } from 'zustand/react/shallow'
import { useControlServerOpenAIKeyStatus } from '../hooks/useControlServerOpenAIKeyStatus'

interface Message {
    role: 'user' | 'assistant'
    content: string
    agent?: { id: string; name: string; icon: string }
    aiPowered?: boolean
    toolUsed?: { command: string }
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

type AgentStatus = 'idle' | 'thinking' | 'using-computer' | 'responding'

const STATUS_LABELS: Record<AgentStatus, { text: string; color: string }> = {
    idle: { text: 'Ready', color: 'bg-gray-500' },
    thinking: { text: 'Thinking...', color: 'bg-yellow-500' },
    'using-computer': { text: 'Using computer...', color: 'bg-blue-500' },
    responding: { text: 'Responding...', color: 'bg-green-500' },
}

type Suggestion = { text: string; agent: string; label?: string }

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
    const messagesEndRef = useRef<HTMLDivElement>(null)
    const inputRef = useRef<HTMLInputElement>(null)
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

    const sendMessage = async (text?: string) => {
        const messageText = text || input.trim()
        if (!messageText || isLoading) return

        setInput('')
        const userMsg: Message = { role: 'user', content: messageText }
        setMessages(prev => [...prev, userMsg])
        setIsLoading(true)
        setStatus('thinking')
        setProactiveNudge(null)

        try {
            const payload: {
                message: string
                history: Message[]
                context: {
                    currentApp?: string
                    wizardStep: number
                    wizardStepName: string
                    selectedServices: string[]
                    userProgress: {
                        step: number
                        envComplete: boolean
                        hasDomain: boolean
                    }
                }
                agentId?: string
            } = {
                message: messageText,
                history: messages.slice(-8),
                context: {
                    currentApp,
                    wizardStep,
                    wizardStepName,
                    selectedServices,
                    userProgress: {
                        step: wizardStep,
                        envComplete: Boolean(hasRemoteKey),
                        hasDomain: Boolean(config.domain),
                    },
                },
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
                toolUsed: data.toolUsed
            }
            setMessages(prev => [...prev, assistantMsg])

            // Show proactive nudge if available
            if (data.nudges?.length > 0) {
                setProactiveNudge(data.nudges[0].message)
            }

        } catch (err) {
            console.warn('AIAssistant chat request failed:', err)
            setMessages(prev => [...prev, {
                role: 'assistant',
                content: "I'm having trouble connecting. Make sure the control server is running (`npm start` in control-server/).",
                agent: { id: 'general', name: 'System', icon: '⚠️' }
            }])
        } finally {
            setIsLoading(false)
            setStatus('idle')
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
                                        {/* Status Chip */}
                                        <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-medium ${STATUS_LABELS[status].color} text-white`}>
                                            {status !== 'idle' && <Loader2 className="w-2 h-2 animate-spin" />}
                                            {STATUS_LABELS[status].text}
                                        </span>
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-center gap-1">
                                {messages.length > 0 && (
                                    <button
                                        onClick={clearChat}
                                        className="p-1.5 hover:bg-muted/60 rounded-lg text-muted-foreground hover:text-foreground text-xs"
                                        title="Clear chat"
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
                                                <p className="text-[10px] text-muted-foreground mb-0.5 flex items-center gap-1">
                                                    {msg.agent.name}
                                                    {msg.aiPowered && <Sparkles className="w-2.5 h-2.5 text-primary" />}
                                                </p>
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

                            {isLoading && (
                                <div className="flex gap-2 items-center">
                                    <div className="w-7 h-7 rounded-full bg-gradient-to-r from-emerald-500 via-cyan-500 to-lime-400 flex items-center justify-center">
                                        <Loader2 className="w-4 h-4 animate-spin text-white" />
                                    </div>
                                    <div className="px-3 py-2 bg-muted/60 rounded-2xl rounded-bl-md">
                                        <span className="text-sm text-muted-foreground">Thinking...</span>
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
                                        <button
                                            onClick={() => {
                                                sendMessage(proactiveNudge.replace(/^💡\s*(Tip:\s*)?/i, ''))
                                                setProactiveNudge(null)
                                            }}
                                            className="mt-1 text-[10px] text-primary/80 hover:text-primary"
                                        >
                                            Ask about this →
                                        </button>
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
                            <div className="flex items-center gap-2">
                                <input
                                    ref={inputRef}
                                    type="text"
                                    value={input}
                                    onChange={e => setInput(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
                                    placeholder={selectedAgent ? `Ask ${agents.find(a => a.id === selectedAgent)?.name}...` : "Ask anything..."}
                                    className="flex-1 bg-background/60 border border-border rounded-xl px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/60"
                                    disabled={isLoading}
                                />
                                <button
                                    onClick={() => sendMessage()}
                                    disabled={!input.trim() || isLoading}
                                    className="p-2.5 bg-gradient-to-r from-emerald-500 via-cyan-500 to-lime-400 rounded-xl text-white disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90 transition-opacity"
                                    title="Send message"
                                    aria-label="Send message"
                                >
                                    <Send className="w-4 h-4" />
                                </button>
                            </div>
                            {!hasRemoteKey && (
                                <p className="text-[10px] text-muted-foreground mt-2 text-center">
                                    💡 Add an OpenAI key in Settings for smarter responses
                                </p>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    )
}
