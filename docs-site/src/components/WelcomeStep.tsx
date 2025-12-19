import { motion } from 'framer-motion'
import { Sparkles, ArrowRight, Shield, Settings } from 'lucide-react'
import { useSetupStore } from '../store/setupStore'
import { Link } from 'react-router-dom'
import { useControlServerOpenAIKeyStatus } from '../hooks/useControlServerOpenAIKeyStatus'

export function WelcomeStep() {
    const { nextStep } = useSetupStore()
    const { serverOnline, hasKey, refresh } = useControlServerOpenAIKeyStatus()

    const handleStart = () => {
        nextStep()
    }

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="text-center space-y-8 py-8"
        >
            <div className="flex justify-center mb-6">
                <div className="w-24 h-24 bg-gradient-to-br from-purple-500/20 to-pink-500/20 rounded-3xl flex items-center justify-center border border-border relative overflow-hidden group">
                    <div className="absolute inset-0 bg-gradient-to-tr from-purple-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    <Sparkles className="w-12 h-12 text-purple-400 animate-pulse-glow" />
                </div>
            </div>

            <div className="max-w-2xl mx-auto space-y-4">
                <h2 className="text-3xl md:text-4xl font-bold text-foreground">
                    Welcome to the <span className="bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-pink-400">Next-Gen Setup</span>
                </h2>
                <p className="text-lg text-muted-foreground">
                    Configure your entire media stack with intelligent defaults and AI-powered suggestions.
                </p>
            </div>

            <div className="max-w-md mx-auto glass-card rounded-2xl p-6">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2 text-purple-300">
                        <Sparkles className="w-4 h-4" />
                        <span className="font-medium">AI Assistant (Optional)</span>
                    </div>
                    <Link
                        to="/settings"
                        className="text-xs text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-1"
                    >
                        <Settings className="w-3.5 h-3.5" />
                        Settings
                    </Link>
                </div>

                <div className="space-y-3">
                    <p className="text-xs text-muted-foreground text-left">
                        Add an OpenAI API key to enable higher-quality AI guidance and voice output.
                        Keys are stored by the local control server (not in the browser).
                    </p>
                    <div className="flex items-center justify-between gap-3 text-sm text-muted-foreground bg-muted/60 rounded-lg p-3 border border-border">
                        <div className="flex items-center gap-2">
                            <Shield className="w-4 h-4 text-green-400" />
                            <span>
                                {serverOnline === false
                                    ? 'Control server offline'
                                    : hasKey
                                        ? 'Key stored on control server'
                                        : 'No key stored yet'}
                            </span>
                        </div>
                        <button
                            onClick={refresh}
                            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                            type="button"
                        >
                            Refresh
                        </button>
                    </div>
                </div>
            </div>

            <div className="pt-4">
                <button
                    onClick={handleStart}
                    className="group relative inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-purple-600 to-pink-600 rounded-xl font-semibold text-white shadow-lg shadow-purple-500/25 hover:shadow-purple-500/40 hover:scale-105 transition-all duration-300"
                >
                    Start Configuration
                    <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </button>
            </div>
        </motion.div>
    )
}
