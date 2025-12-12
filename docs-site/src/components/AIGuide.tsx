import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Sparkles, Send, Loader2, X, Bot, ChevronDown, ChevronUp, Lightbulb, AlertTriangle, CheckCircle } from 'lucide-react'
import { useSetupStore } from '../store/setupStore'

interface Message {
    role: 'assistant' | 'user'
    content: string
    type?: 'tip' | 'warning' | 'success'
}

interface AIGuideProps {
    currentStep: number
    context?: string
}

// Pre-written guidance for each step (works without API key)
const stepGuidance: Record<number, { title: string; tips: string[]; warnings?: string[] }> = {
    0: {
        title: "Welcome! Let's get your media server running.",
        tips: [
            "This wizard will create all the config files you need.",
            "You only need to answer a few questions - we'll handle the technical stuff.",
            "Adding an OpenAI API key is optional but gives you smarter help.",
            "Don't worry about API keys or tokens now - we'll guide you through those AFTER installation."
        ]
    },
    1: {
        title: "Basic Settings",
        tips: [
            "**Domain**: Enter the domain you'll use to access your services (like 'myserver.com'). If you don't have one yet, you can use 'localhost' for now.",
            "**Timezone**: Auto-detected for you! Only change if it's wrong.",
            "**Password**: This secures your services. Use something strong but memorable.",
            "PUID/PGID are auto-set to 1000 which works for most systems."
        ],
        warnings: [
            "Don't use 'example.com' - enter your real domain or 'localhost'."
        ]
    },
    2: {
        title: "Choosing Your Services",
        tips: [
            "**Newbie Mode**: Perfect for first-timers! We've pre-selected the essentials.",
            "**Plex**: Your media library with a beautiful interface (requires free Plex account).",
            "**Arr Stack**: Automates finding and organizing your media.",
            "**Torrent + VPN**: Downloads protected by VPN for privacy.",
            "Start simple - you can always add more services later!"
        ]
    },
    3: {
        title: "Service Configuration",
        tips: [
            "Most fields here can be left empty for now.",
            "API keys are generated AFTER services are running - skip them!",
            "We'll show you exactly how to get each key in the post-install guide.",
            "The AI Suggest button can help if you have an OpenAI key."
        ],
        warnings: [
            "Don't try to fill in API keys now - they don't exist yet!"
        ]
    },
    4: {
        title: "Advanced Settings (Optional)",
        tips: [
            "**Cloudflare Tunnel**: Only needed for remote access. Skip if unsure.",
            "**Plex Claim**: Get this from plex.tv/claim right before running docker-compose.",
            "**VPN Settings**: Your VPN provider gives you these. Skip if not using VPN.",
            "Everything here can be added to your .env file later!"
        ],
        warnings: [
            "Plex claim tokens expire in 4 minutes - don't get one until you're ready to deploy."
        ]
    },
    5: {
        title: "You're Ready!",
        tips: [
            "Download all files and place them in your server directory.",
            "Follow the Post-Install Checklist we've created for you.",
            "Each service will generate API keys once it's running.",
            "Come back if you need help - the AI assistant is here for you!"
        ]
    }
}

export function AIGuide({ currentStep, context: _context }: AIGuideProps) {
    const { config } = useSetupStore()
    const [isExpanded, setIsExpanded] = useState(true)
    const [messages, setMessages] = useState<Message[]>([])
    const [input, setInput] = useState('')
    const [isLoading, setIsLoading] = useState(false)
    const [showChat, setShowChat] = useState(false)
    const messagesEndRef = useRef<HTMLDivElement>(null)

    const hasApiKey = !!config.openaiApiKey

    const openAiModel = import.meta.env?.VITE_OPENAI_MODEL
        ? String(import.meta.env.VITE_OPENAI_MODEL)
        : 'gpt-4o-mini'

    // Update guidance when step changes
    useEffect(() => {
        const guidance = stepGuidance[currentStep]
        if (guidance) {
            setMessages([{
                role: 'assistant',
                content: guidance.title,
                type: 'tip'
            }])
        }
    }, [currentStep])

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }

    useEffect(() => {
        scrollToBottom()
    }, [messages])

    const sendMessage = async () => {
        if (!input.trim() || !hasApiKey) return

        const userMessage: Message = { role: 'user', content: input }
        setMessages(prev => [...prev, userMessage])
        setInput('')
        setIsLoading(true)

        try {
            const currentGuidance = stepGuidance[currentStep]
            const systemPrompt = `You are a friendly AI assistant helping a non-technical user set up a media server stack.
            
Current Step: ${currentStep + 1} - ${currentGuidance?.title}
User's Domain: ${config.domain}
Selected Services: ${Object.keys(config.serviceConfigs).join(', ') || 'Not yet selected'}

Guidelines:
- Use simple, non-technical language
- Give short, actionable answers
- If they ask about API keys, explain they're generated AFTER services are running
- Be encouraging and patient
- Format responses with markdown for clarity`

            const response = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${config.openaiApiKey}`
                },
                body: JSON.stringify({
                    model: openAiModel,
                    messages: [
                        { role: 'system', content: systemPrompt },
                        ...messages.map(m => ({ role: m.role, content: m.content })),
                        { role: 'user', content: input }
                    ],
                    temperature: 0.7,
                    max_tokens: 500
                })
            })

            if (!response.ok) throw new Error('API request failed')

            const data = await response.json()
            const assistantMessage: Message = {
                role: 'assistant',
                content: data.choices[0].message.content
            }
            setMessages(prev => [...prev, assistantMessage])
        } catch (err) {
            console.error('AIGuide OpenAI call failed:', err)
            setMessages(prev => [...prev, {
                role: 'assistant',
                content: "Sorry, I couldn't process that. Please check your API key or try again.",
                type: 'warning'
            }])
        } finally {
            setIsLoading(false)
        }
    }

    const guidance = stepGuidance[currentStep]

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="fixed bottom-4 right-4 z-50 w-80 md:w-96"
        >
            {/* Collapsed State */}
            {!isExpanded && (
                <motion.button
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    onClick={() => setIsExpanded(true)}
                    className="w-14 h-14 bg-gradient-to-r from-purple-600 to-pink-600 rounded-full flex items-center justify-center shadow-lg shadow-purple-500/30 hover:shadow-purple-500/50 transition-all hover:scale-110"
                    title="Open AI Guide"
                    aria-label="Open AI Setup Guide"
                >
                    <Sparkles className="w-6 h-6 text-white" />
                </motion.button>
            )}

            {/* Expanded State */}
            <AnimatePresence>
                {isExpanded && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: 20 }}
                        className="bg-gray-900/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl overflow-hidden"
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-purple-600/20 to-pink-600/20 border-b border-white/10">
                            <div className="flex items-center gap-2">
                                <div className="w-8 h-8 bg-purple-500/20 rounded-lg flex items-center justify-center">
                                    <Bot className="w-4 h-4 text-purple-400" />
                                </div>
                                <div>
                                    <h3 className="text-sm font-semibold text-white">AI Setup Guide</h3>
                                    <p className="text-xs text-gray-400">Step {currentStep + 1} of 6</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setIsExpanded(false)}
                                className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"
                                title="Close guide"
                                aria-label="Close AI guide"
                            >
                                <X className="w-4 h-4 text-gray-400" />
                            </button>
                        </div>

                        {/* Tips Section */}
                        {guidance && !showChat && (
                            <div className="p-4 max-h-80 overflow-y-auto custom-scrollbar">
                                <div className="flex items-center gap-2 mb-3">
                                    <Lightbulb className="w-4 h-4 text-yellow-400" />
                                    <span className="text-sm font-medium text-yellow-300">Tips for this step</span>
                                </div>
                                <ul className="space-y-2">
                                    {guidance.tips.map((tip, i) => (
                                        <li key={i} className="flex items-start gap-2 text-sm text-gray-300">
                                            <CheckCircle className="w-3 h-3 text-green-400 mt-1 flex-shrink-0" />
                                            <span dangerouslySetInnerHTML={{ 
                                                __html: tip.replace(/\*\*(.*?)\*\*/g, '<strong class="text-white">$1</strong>') 
                                            }} />
                                        </li>
                                    ))}
                                </ul>
                                {guidance.warnings && (
                                    <div className="mt-4 space-y-2">
                                        {guidance.warnings.map((warning, i) => (
                                            <div key={i} className="flex items-start gap-2 p-2 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                                                <AlertTriangle className="w-4 h-4 text-yellow-400 flex-shrink-0 mt-0.5" />
                                                <span className="text-xs text-yellow-200">{warning}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Chat Section */}
                        {showChat && (
                            <div className="h-64 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                                {messages.map((msg, i) => (
                                    <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                        <div className={`max-w-[85%] px-3 py-2 rounded-xl text-sm ${
                                            msg.role === 'user'
                                                ? 'bg-purple-500/20 text-white'
                                                : msg.type === 'warning'
                                                    ? 'bg-yellow-500/10 text-yellow-200 border border-yellow-500/20'
                                                    : 'bg-white/5 text-gray-300'
                                        }`}>
                                            {msg.content}
                                        </div>
                                    </div>
                                ))}
                                {isLoading && (
                                    <div className="flex justify-start">
                                        <div className="bg-white/5 px-3 py-2 rounded-xl">
                                            <Loader2 className="w-4 h-4 animate-spin text-purple-400" />
                                        </div>
                                    </div>
                                )}
                                <div ref={messagesEndRef} />
                            </div>
                        )}

                        {/* Toggle & Input */}
                        <div className="border-t border-white/10">
                            <button
                                onClick={() => setShowChat(!showChat)}
                                className="w-full px-4 py-2 text-xs text-gray-400 hover:text-white hover:bg-white/5 transition-colors flex items-center justify-center gap-1"
                            >
                                {showChat ? (
                                    <>Show Tips <ChevronUp className="w-3 h-3" /></>
                                ) : (
                                    <>Ask a Question <ChevronDown className="w-3 h-3" /></>
                                )}
                            </button>

                            {showChat && (
                                <div className="p-3 border-t border-white/10">
                                    {hasApiKey ? (
                                        <div className="flex gap-2">
                                            <input
                                                type="text"
                                                value={input}
                                                onChange={(e) => setInput(e.target.value)}
                                                onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
                                                placeholder="Ask anything..."
                                                className="flex-1 bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-purple-500/50 outline-none"
                                            />
                                            <button
                                                onClick={sendMessage}
                                                disabled={!input.trim() || isLoading}
                                                className="p-2 bg-purple-500 hover:bg-purple-600 rounded-lg transition-colors disabled:opacity-50"
                                                title="Send message"
                                                aria-label="Send message"
                                            >
                                                <Send className="w-4 h-4 text-white" />
                                            </button>
                                        </div>
                                    ) : (
                                        <p className="text-xs text-gray-500 text-center">
                                            Add an OpenAI API key on the Welcome step to enable chat.
                                        </p>
                                    )}
                                </div>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    )
}
