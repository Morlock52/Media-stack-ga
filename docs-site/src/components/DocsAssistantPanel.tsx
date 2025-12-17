import { useState, useRef, useEffect } from 'react'
import { MessageCircle, Send, Bot, User, AlertCircle, Loader2, Zap, Copy, CheckCircle, RefreshCw, ChevronDown } from 'lucide-react'
import { buildControlServerUrl } from '../utils/controlServer'

interface Message {
    role: 'user' | 'assistant'
    content: string
    checklist?: string[]
}

interface AssistantResponse {
    answer: string
    action?: { type: string; appId?: string; items?: string[] }
    inScope: boolean
    error?: string
}

interface DocsAssistantPanelProps {
    currentAppId: string
    onSwitchApp?: (appId: string) => void
    /** When true, the assistant panel will open (used by search buttons on docs page) */
    forceOpen?: boolean
}

// Quick actions based on current app
const getQuickActions = (appId: string): { label: string; query: string }[] => {
    const common = [
        { label: 'Setup steps', query: `What are the setup steps for ${appId}?` },
        { label: 'Default port', query: `What port does ${appId} use?` },
        { label: 'Common issues', query: `What are common issues with ${appId}?` },
    ]
    
    const appSpecific: Record<string, { label: string; query: string }[]> = {
        plex: [
            { label: 'Add library', query: 'How do I add a media library in Plex?' },
            { label: 'Remote access', query: 'How do I enable remote access in Plex?' },
        ],
        jellyfin: [
            { label: 'Create user', query: 'How do I create users in Jellyfin?' },
            { label: 'Customize UI', query: 'How do I customize the Jellyfin interface?' },
        ],
        arr: [
            { label: 'Add indexer', query: 'How do I add indexers to Prowlarr?' },
            { label: 'Download client', query: 'How do I connect a download client to Sonarr/Radarr?' },
        ],
        overseerr: [
            { label: 'Connect Plex', query: 'How do I connect Overseerr to Plex?' },
            { label: 'User requests', query: 'How do users request media in Overseerr?' },
        ],
        mealie: [
            { label: 'Import recipe', query: 'How do I import a recipe from a URL in Mealie?' },
            { label: 'Meal plan', query: 'How do I create a meal plan in Mealie?' },
        ],
        tautulli: [
            { label: 'View stats', query: 'How do I view watching statistics in Tautulli?' },
            { label: 'Notifications', query: 'How do I set up notifications in Tautulli?' },
        ],
        audiobookshelf: [
            { label: 'Add books', query: 'How do I add audiobooks to Audiobookshelf?' },
            { label: 'Mobile app', query: 'Is there a mobile app for Audiobookshelf?' },
        ],
        photoprism: [
            { label: 'Import photos', query: 'How do I import photos into PhotoPrism?' },
            { label: 'Auto tagging', query: 'How does AI tagging work in PhotoPrism?' },
        ],
    }
    
    return [...common, ...(appSpecific[appId] || [])]
}

// App display names
const APP_NAMES: Record<string, string> = {
    plex: 'Plex',
    jellyfin: 'Jellyfin', 
    emby: 'Emby',
    arr: '*Arr Stack',
    overseerr: 'Overseerr',
    mealie: 'Mealie',
    tautulli: 'Tautulli',
    audiobookshelf: 'Audiobookshelf',
    photoprism: 'PhotoPrism',
}

export function DocsAssistantPanel({ currentAppId, onSwitchApp, forceOpen }: DocsAssistantPanelProps) {
    const [isOpen, setIsOpen] = useState(false)
    const [messages, setMessages] = useState<Message[]>([])
    const [input, setInput] = useState('')
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [copiedId, setCopiedId] = useState<number | null>(null)
    const messagesEndRef = useRef<HTMLDivElement>(null)
    
    const quickActions = getQuickActions(currentAppId)
    
    // Open panel when forceOpen is toggled on from parent
    useEffect(() => {
        if (forceOpen) {
            setIsOpen(true)
        }
    }, [forceOpen])

    // Copy text to clipboard
    const copyToClipboard = async (text: string, msgIndex: number) => {
        try {
            await navigator.clipboard.writeText(text)
            setCopiedId(msgIndex)
            setTimeout(() => setCopiedId(null), 2000)
        } catch (err) {
            console.error('Failed to copy:', err)
        }
    }
    
    // Scroll to bottom when new messages arrive
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [messages])

    const sendMessage = async () => {
        if (!input.trim() || isLoading) return

        const userMessage = input.trim()
        setInput('')
        setError(null)

        // Add user message to chat
        const newMessages: Message[] = [...messages, { role: 'user', content: userMessage }]
        setMessages(newMessages)
        setIsLoading(true)

        try {
            // Try local control server first, then Netlify function
            const endpoints = [
                buildControlServerUrl('/api/assistant'),
                '/.netlify/functions/assistant'
            ]
            
            let response: Response | null = null
            let lastError: Error | null = null
            
            for (const endpoint of endpoints) {
                try {
                    response = await fetch(endpoint, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            message: userMessage,
                            currentAppId,
                            history: messages.slice(-10),
                        }),
                    })
                    
                    if (response.ok) break
                } catch (e) {
                    lastError = e as Error
                    response = null
                }
            }

            if (!response || !response.ok) {
                throw lastError || new Error('All assistant endpoints failed')
            }

            const text = await response.text()
            if (!text) {
                throw new Error('Empty response from assistant')
            }
            
            const data: AssistantResponse = JSON.parse(text)

            if (data.error) {
                setError(data.error)
                setIsLoading(false)
                return
            }

            // Add assistant response with optional checklist
            const newMessage: Message = { role: 'assistant', content: data.answer }
            if (data.action?.type === 'checklist' && data.action.items) {
                newMessage.checklist = data.action.items as string[]
            }
            setMessages([...newMessages, newMessage])

            // Handle actions
            if (data.action?.type === 'switchApp' && data.action.appId && onSwitchApp) {
                onSwitchApp(data.action.appId)
            }
        } catch (err) {
            console.error('Assistant error:', err)
            setError('Assistant is offline. Run the control server or deploy to Netlify.')
        } finally {
            setIsLoading(false)
        }
    }

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            sendMessage()
        }
    }

    if (!isOpen) {
        return (
            <button
                onClick={() => setIsOpen(true)}
                className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-full shadow-lg shadow-purple-500/25 hover:shadow-purple-500/40 hover:scale-105 transition-all"
            >
                <MessageCircle className="w-5 h-5" />
                <span className="font-medium">Ask AI</span>
            </button>
        )
    }

    return (
        <div className="fixed bottom-6 right-6 z-50 w-96 max-w-[calc(100vw-3rem)] bg-card border border-border rounded-2xl shadow-2xl flex flex-col max-h-[calc(100vh-3rem)]">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-border">
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-purple-500/30 to-pink-500/30 border border-purple-500/40 flex items-center justify-center">
                        <Bot className="w-5 h-5 text-purple-300" />
                    </div>
                    <div>
                        <h3 className="font-semibold text-foreground text-sm">Docs Assistant</h3>
                        <p className="text-[10px] text-muted-foreground">Media Stack help only</p>
                    </div>
                </div>
                <div className="flex items-center gap-1">
                    <button
                        onClick={() => setMessages([])}
                        className="p-1.5 hover:bg-muted/60 rounded-lg transition-colors"
                        title="Clear chat"
                    >
                        <RefreshCw className="w-4 h-4 text-muted-foreground" />
                    </button>
                    <button
                        onClick={() => setIsOpen(false)}
                        aria-label="Minimize assistant"
                        className="p-1.5 hover:bg-muted/60 rounded-lg transition-colors"
                    >
                        <ChevronDown className="w-4 h-4 text-muted-foreground" />
                    </button>
                </div>
            </div>

            {/* Current context badge */}
            <div className="px-4 py-2 bg-muted/40 border-b border-border flex items-center justify-between">
                <p className="text-[10px] text-muted-foreground">
                    <span className="text-purple-400 font-medium">Viewing:</span> {APP_NAMES[currentAppId] || currentAppId} guide
                </p>
                <span className="text-[10px] px-2 py-0.5 bg-green-500/20 text-green-300 rounded-full flex items-center gap-1">
                    <Zap className="w-2.5 h-2.5" /> Agentic
                </span>
            </div>

            {/* Messages */}
            <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4">
                {messages.length === 0 && (
                    <div className="space-y-4">
                        <div className="text-center py-4">
                            <Bot className="w-8 h-8 text-purple-400/50 mx-auto mb-2" />
                            <p className="text-sm text-muted-foreground">How can I help with {APP_NAMES[currentAppId] || 'your media stack'}?</p>
                        </div>
                        
                        {/* Quick Actions */}
                        <div className="space-y-2">
                            <p className="text-[10px] text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                                <Zap className="w-3 h-3" /> Quick Actions
                            </p>
                            <div className="flex flex-wrap gap-1.5">
                                {quickActions.slice(0, 5).map((action, i) => (
                                    <button
                                        key={i}
                                        onClick={() => {
                                            setInput(action.query)
                                            setTimeout(() => sendMessage(), 100)
                                        }}
                                        className="chip-muted"
                                    >
                                        {action.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {messages.map((msg, i) => (
                    <div
                        key={i}
                        className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                        {msg.role === 'assistant' && (
                            <div className="w-7 h-7 rounded-lg bg-purple-500/20 flex items-center justify-center flex-shrink-0">
                                <Bot className="w-4 h-4 text-purple-300" />
                            </div>
                        )}
                        <div
                            className={`max-w-[80%] rounded-xl text-sm ${
                                msg.role === 'user'
                                    ? 'bg-purple-600 text-white px-3 py-2'
                                    : 'bg-muted/60 text-foreground border border-border'
                            }`}
                        >
                            {msg.role === 'assistant' ? (
                                <div className="group">
                                    <p className="whitespace-pre-wrap px-3 py-2">{msg.content}</p>
                                    
                                    {/* Render checklist if present */}
                                    {msg.checklist && msg.checklist.length > 0 && (
                                        <div className="mx-3 mb-2 p-2 bg-green-500/10 border border-green-500/20 rounded-lg">
                                            <p className="text-[10px] text-green-400 font-medium mb-1.5 flex items-center gap-1">
                                                <CheckCircle className="w-3 h-3" /> Checklist
                                            </p>
                                            <ul className="space-y-1">
                                                {msg.checklist.map((item, idx) => (
                                                    <li key={idx} className="flex items-start gap-2 text-xs text-muted-foreground">
                                                        <span className="text-green-400 mt-0.5">•</span>
                                                        <span>{item}</span>
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}
                                    
                                    <div className="flex items-center gap-1 px-2 pb-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button
                                            onClick={() => copyToClipboard(msg.content, i)}
                                            className="p-1 hover:bg-muted/60 rounded text-muted-foreground hover:text-foreground transition-colors"
                                            aria-label="Copy response"
                                        >
                                            {copiedId === i ? (
                                                <CheckCircle className="w-3 h-3 text-green-400" />
                                            ) : (
                                                <Copy className="w-3 h-3" />
                                            )}
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <p className="whitespace-pre-wrap">{msg.content}</p>
                            )}
                        </div>
                        {msg.role === 'user' && (
                            <div className="w-7 h-7 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                                <User className="w-4 h-4 text-muted-foreground" />
                            </div>
                        )}
                    </div>
                ))}

                {isLoading && (
                    <div className="flex gap-3 justify-start">
                        <div className="w-7 h-7 rounded-lg bg-purple-500/20 flex items-center justify-center flex-shrink-0">
                            <Bot className="w-4 h-4 text-purple-300" />
                        </div>
                        <div className="px-3 py-2 rounded-xl bg-muted/60 border border-border">
                            <Loader2 className="w-4 h-4 text-purple-400 animate-spin" />
                        </div>
                    </div>
                )}

                <div ref={messagesEndRef} />
            </div>

            {/* Error */}
            {error && (
                <div className="mx-4 mb-2 px-3 py-2 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                    <p className="text-xs text-red-300">{error}</p>
                </div>
            )}

            {/* Suggested follow-ups after conversation */}
            {messages.length > 0 && !isLoading && (
                <div className="px-4 py-2 border-t border-border">
                    <div className="flex items-center gap-2 mb-2">
                        <RefreshCw className="w-3 h-3 text-muted-foreground" />
                        <span className="text-[10px] text-muted-foreground">Continue with:</span>
                    </div>
                    <div className="flex flex-wrap gap-1">
                        {quickActions.slice(0, 3).map((action, i) => (
                            <button
                                key={i}
                                onClick={() => {
                                    setInput(action.query)
                                    setTimeout(sendMessage, 50)
                                }}
                                className="chip-muted"
                            >
                                {action.label}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Input */}
            <div className="p-4 border-t border-border">
                <div className="flex gap-2">
                    <textarea
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder={`Ask about ${APP_NAMES[currentAppId] || 'your media stack'}...`}
                        rows={1}
                        className="flex-1 px-3 py-2 bg-background/60 border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground resize-none focus:outline-none focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/25"
                    />
                    <button
                        onClick={sendMessage}
                        disabled={!input.trim() || isLoading}
                        aria-label="Send message"
                        className="px-3 py-2 bg-purple-600 hover:bg-purple-500 disabled:bg-slate-700 disabled:cursor-not-allowed text-white rounded-xl transition-colors"
                    >
                        <Send className="w-4 h-4" />
                    </button>
                </div>
                <p className="text-[10px] text-muted-foreground mt-2 text-center">
                    I can switch guides, explain setup steps, and more
                </p>
            </div>
        </div>
    )
}
