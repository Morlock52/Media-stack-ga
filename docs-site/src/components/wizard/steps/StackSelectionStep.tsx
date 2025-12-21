import { motion } from 'framer-motion'
import { Zap, Settings, ChevronRight, Check, AlertCircle } from 'lucide-react'
import { ServiceOption } from '../../../data/services'

interface StackSelectionStepProps {
    mode: 'newbie' | 'expert' | null
    setMode: (mode: 'newbie' | 'expert') => void
    selectedServices: string[]
    services: ServiceOption[]
    toggleService: (service: string) => void
}

export function StackSelectionStep({ mode, setMode, selectedServices, services, toggleService }: StackSelectionStepProps) {
    return (
        <motion.div
            key="step2"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-6"
        >
            <div className="mb-6">
                <h2 className="text-2xl font-bold text-foreground mb-2">Choose Your Stack</h2>
                <p className="text-muted-foreground">Select the services you want to install</p>
            </div>

            {/* Mode Selection */}
            {!mode && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                    <button
                        onClick={() => setMode('newbie')}
                        className="group relative p-6 rounded-xl border border-border bg-gradient-to-br from-green-500/10 to-emerald-500/5 hover:from-green-500/20 hover:to-emerald-500/10 transition-all btn-lift"
                    >
                        <div className="flex items-start gap-4">
                            <div className="p-3 bg-green-500/20 rounded-lg">
                                <Zap className="w-6 h-6 text-green-400" />
                            </div>
                            <div className="flex-1 text-left">
                                <h3 className="text-lg font-semibold text-foreground mb-1">Newbie Mode</h3>
                                <p className="text-sm text-muted-foreground mb-3">
                                    Recommended stack with sensible defaults
                                </p>
                                <div className="text-xs text-muted-foreground/80">
                                    Includes: Plex, *Arr Stack, Torrent+VPN, Notifications, Stats
                                </div>
                            </div>
                        </div>
                        <ChevronRight className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground group-hover:text-green-400 transition-colors" />
                    </button>

                    <button
                        onClick={() => setMode('expert')}
                        className="group relative p-6 rounded-xl border border-border bg-gradient-to-br from-emerald-500/10 via-cyan-500/10 to-lime-500/10 hover:from-emerald-500/20 hover:to-lime-500/15 transition-all btn-lift"
                    >
                        <div className="flex items-start gap-4">
                            <div className="p-3 bg-primary/20 rounded-lg">
                                <Settings className="w-6 h-6 text-primary" />
                            </div>
                            <div className="flex-1 text-left">
                                <h3 className="text-lg font-semibold text-foreground mb-1">Expert Mode</h3>
                                <p className="text-sm text-muted-foreground mb-3">
                                    Choose exactly what you need
                                </p>
                                <div className="text-xs text-muted-foreground/80">
                                    Granular control over every service
                                </div>
                            </div>
                        </div>
                        <ChevronRight className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
                    </button>
                </div>
            )}

            {/* Service Selection */}
            {mode && (
                <div>
                    <div className="flex items-center justify-between mb-4">
                        <div className="text-sm text-muted-foreground">
                            {mode === 'newbie' ? 'Recommended services selected' : 'Select services to install'}
                        </div>
                        {mode === 'newbie' && (
                            <button
                                onClick={() => setMode('expert')}
                                className="text-sm text-primary hover:text-primary/80 transition-colors"
                            >
                                Customize →
                            </button>
                        )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                        {services.map((service: ServiceOption) => {
                            const isSelected = selectedServices.includes(service.profile)
                            const Icon = service.icon
                            const isDisabled = mode === 'newbie'

                            return (
                                <motion.button
                                    key={service.id}
                                    onClick={() => !isDisabled && toggleService(service.profile)}
                                    disabled={isDisabled}
                                    className={`relative p-4 rounded-xl border transition-all ${isSelected
                                        ? 'bg-primary/10 border-primary/50'
                                        : 'bg-card/40 border-border hover:border-border/80'
                                        } ${isDisabled ? 'cursor-default' : 'cursor-pointer btn-lift'}`}
                                    whileTap={!isDisabled ? { scale: 0.95 } : {}}
                                >
                                    <div className="flex items-start justify-between mb-2">
                                        <div className={`p-2 rounded-lg ${isSelected ? 'bg-primary/20 text-primary' : 'bg-white/5 text-gray-400'
                                        }`}>
                                            <Icon className="w-4 h-4" />
                                        </div>
                                        {isSelected && (
                                            <motion.div
                                                initial={{ scale: 0 }}
                                                animate={{ scale: 1 }}
                                                className="bg-green-500/20 text-green-400 p-1 rounded-full"
                                            >
                                                <Check className="w-3 h-3" />
                                            </motion.div>
                                        )}
                                    </div>
                                    <h4 className={`text-sm font-semibold mb-1 ${isSelected ? 'text-white' : 'text-gray-300'
                                        }`}>
                                        {service.name}
                                    </h4>
                                    <p className="text-xs text-gray-500">
                                        {service.description}
                                    </p>
                                </motion.button>
                            )
                        })}
                    </div>

                    {selectedServices.length === 0 && (
                        <p className="mt-4 text-sm text-red-400 flex items-center gap-1">
                            <AlertCircle className="w-3 h-3" /> Please select at least one service
                        </p>
                    )}
                </div>
            )}
        </motion.div>
    )
}
