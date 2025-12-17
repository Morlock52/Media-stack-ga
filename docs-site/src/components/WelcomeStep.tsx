import { motion } from 'framer-motion'
import { Sparkles, Key, ArrowRight, Shield } from 'lucide-react'
import { useSetupStore } from '../store/setupStore'
import { useState } from 'react'

export function WelcomeStep() {
    const { config, updateConfig, nextStep } = useSetupStore()
    const [apiKey, setApiKey] = useState(config.openaiApiKey || '')
    const [showKeyInput, setShowKeyInput] = useState(false)

    const handleStart = () => {
        if (apiKey) {
            updateConfig({ openaiApiKey: apiKey })
        }
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
                    <button
                        onClick={() => setShowKeyInput(!showKeyInput)}
                        className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                    >
                        {showKeyInput ? 'Hide' : 'Add Key'}
                    </button>
                </div>

                {showKeyInput ? (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        className="space-y-3"
                    >
                        <p className="text-xs text-muted-foreground text-left">
                            Add your OpenAI API Key to enable smart configuration suggestions.
                            Your key is stored locally and never sent to our servers.
                        </p>
                        <div className="relative">
                            <Key className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
                            <input
                                type="password"
                                value={apiKey}
                                onChange={(e) => setApiKey(e.target.value)}
                                placeholder="sk-..."
                                className="w-full bg-background/60 border border-border rounded-lg py-2 pl-9 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/25 transition-all outline-none"
                            />
                        </div>
                    </motion.div>
                ) : (
                    <div className="flex items-center gap-3 text-sm text-muted-foreground bg-muted/60 rounded-lg p-3 border border-border">
                        <Shield className="w-4 h-4 text-green-400" />
                        <span>Privacy First: Keys are never stored on our servers.</span>
                    </div>
                )}
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
