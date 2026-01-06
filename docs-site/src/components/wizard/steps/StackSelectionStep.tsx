import { motion, AnimatePresence } from 'motion/react'
import { Zap, Settings, ChevronRight, Check, AlertCircle, Lightbulb, Plus } from 'lucide-react'
import { ServiceOption, getServiceRecommendations } from '../../../data/services'

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
            className="space-y-4 sm:space-y-6 px-4 sm:px-0"
        >
            <div className="mb-4 sm:mb-6">
                <h2 className="text-xl sm:text-2xl font-bold text-foreground mb-2">Choose Your Stack</h2>
                <p className="text-sm sm:text-base text-muted-foreground">Select the services you want to install</p>
            </div>

            {/* Mode Selection */}
            {!mode && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4 mb-6 sm:mb-8">
                    <button
                        onClick={() => setMode('newbie')}
                        className="group relative p-4 sm:p-5 md:p-6 rounded-xl border border-border bg-gradient-to-br from-green-500/10 to-emerald-500/5 hover:from-green-500/20 hover:to-emerald-500/10 transition-all btn-lift touch-target-44"
                    >
                        <div className="flex items-start gap-3 sm:gap-4">
                            <div className="p-2 sm:p-3 bg-green-500/20 rounded-lg flex-shrink-0">
                                <Zap className="w-5 h-5 sm:w-6 sm:h-6 text-green-400" />
                            </div>
                            <div className="flex-1 text-left min-w-0 pr-8">
                                <h3 className="text-base sm:text-lg font-semibold text-foreground mb-1">Newbie Mode</h3>
                                <p className="text-xs sm:text-sm text-muted-foreground mb-2 sm:mb-3 break-words">
                                    Recommended stack with sensible defaults
                                </p>
                                <div className="text-xs text-muted-foreground/80 break-words">
                                    Includes: Plex, *Arr Stack, Torrent+VPN, Notifications, Stats
                                </div>
                            </div>
                        </div>
                        <ChevronRight className="absolute right-3 sm:right-4 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-muted-foreground group-hover:text-green-400 transition-colors flex-shrink-0" />
                    </button>

                    <button
                        onClick={() => setMode('expert')}
                        className="group relative p-4 sm:p-5 md:p-6 rounded-xl border border-border bg-gradient-to-br from-emerald-500/10 via-cyan-500/10 to-lime-500/10 hover:from-emerald-500/20 hover:to-lime-500/15 transition-all btn-lift touch-target-44"
                    >
                        <div className="flex items-start gap-3 sm:gap-4">
                            <div className="p-2 sm:p-3 bg-primary/20 rounded-lg flex-shrink-0">
                                <Settings className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
                            </div>
                            <div className="flex-1 text-left min-w-0 pr-8">
                                <h3 className="text-base sm:text-lg font-semibold text-foreground mb-1">Expert Mode</h3>
                                <p className="text-xs sm:text-sm text-muted-foreground mb-2 sm:mb-3 break-words">
                                    Choose exactly what you need
                                </p>
                                <div className="text-xs text-muted-foreground/80 break-words">
                                    Granular control over every service
                                </div>
                            </div>
                        </div>
                        <ChevronRight className="absolute right-3 sm:right-4 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-muted-foreground group-hover:text-primary transition-colors flex-shrink-0" />
                    </button>
                </div>
            )}

            {/* Service Selection */}
            {mode && (
                <div>
                    <div className="flex items-center justify-between mb-3 sm:mb-4">
                        <div className="text-xs sm:text-sm text-muted-foreground">
                            {mode === 'newbie' ? 'Recommended services selected' : 'Select services to install'}
                        </div>
                        {mode === 'newbie' && (
                            <button
                                onClick={() => setMode('expert')}
                                className="text-xs sm:text-sm text-primary hover:text-primary/80 transition-colors touch-target-44"
                            >
                                Customize →
                            </button>
                        )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
                        {services.map((service: ServiceOption) => {
                            const isSelected = selectedServices.includes(service.profile)
                            const Icon = service.icon
                            const isDisabled = mode === 'newbie'

                            return (
                                <motion.button
                                    key={service.id}
                                    onClick={() => !isDisabled && toggleService(service.profile)}
                                    disabled={isDisabled}
                                    className={`relative p-3 sm:p-4 rounded-xl border transition-all touch-target-44 min-h-[44px] ${isSelected
                                        ? 'bg-primary/10 border-primary/50'
                                        : 'bg-card/40 border-border hover:border-border/80'
                                        } ${isDisabled ? 'cursor-default' : 'cursor-pointer btn-lift'}`}
                                    whileTap={!isDisabled ? { scale: 0.95 } : {}}
                                >
                                    <div className="flex items-start justify-between mb-2">
                                        <div className={`p-1.5 sm:p-2 rounded-lg flex-shrink-0 ${isSelected ? 'bg-primary/20 text-primary' : 'bg-white/5 text-gray-400'
                                        }`}>
                                            <Icon className="w-4 h-4" />
                                        </div>
                                        {isSelected && (
                                            <motion.div
                                                initial={{ scale: 0 }}
                                                animate={{ scale: 1 }}
                                                className="bg-green-500/20 text-green-400 p-1 rounded-full flex-shrink-0"
                                            >
                                                <Check className="w-3 h-3" />
                                            </motion.div>
                                        )}
                                    </div>
                                    <h4 className={`text-sm font-semibold mb-1 break-words ${isSelected ? 'text-white' : 'text-gray-300'
                                        }`}>
                                        {service.name}
                                    </h4>
                                    <p className="text-xs text-gray-500 break-words">
                                        {service.description}
                                    </p>
                                </motion.button>
                            )
                        })}
                    </div>

                    {selectedServices.length === 0 && (
                        <p className="mt-3 sm:mt-4 text-xs sm:text-sm text-red-400 flex items-center gap-1 sm:gap-2">
                            <AlertCircle className="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0" />
                            <span>Please select at least one service</span>
                        </p>
                    )}

                    {/* Smart Recommendations */}
                    {mode === 'expert' && selectedServices.length > 0 && (
                        <ServiceRecommendations
                            selectedServices={selectedServices}
                            toggleService={toggleService}
                        />
                    )}
                </div>
            )}
        </motion.div>
    )
}

interface ServiceRecommendationsProps {
    selectedServices: string[]
    toggleService: (service: string) => void
}

function ServiceRecommendations({ selectedServices, toggleService }: ServiceRecommendationsProps) {
    const recommendations = getServiceRecommendations(selectedServices)

    if (recommendations.length === 0) return null

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-4 sm:mt-6 p-3 sm:p-4 bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-amber-500/10 border border-amber-500/20 rounded-xl"
        >
            <div className="flex items-center gap-2 mb-2 sm:mb-3">
                <Lightbulb className="w-4 h-4 text-amber-400 flex-shrink-0" />
                <span className="text-xs sm:text-sm font-medium text-amber-200">Recommended additions</span>
            </div>

            <div className="flex flex-wrap gap-2">
                <AnimatePresence mode="popLayout">
                    {recommendations.map(({ service, reason }) => {
                        const Icon = service.icon
                        return (
                            <motion.button
                                key={service.id}
                                layout
                                initial={{ opacity: 0, scale: 0.8 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.8 }}
                                onClick={() => toggleService(service.profile)}
                                className="group flex items-center gap-2 px-2 sm:px-3 py-2 bg-card/60 hover:bg-primary/20 border border-border hover:border-primary/40 rounded-lg transition-all touch-target-44 min-h-[44px]"
                                title={reason}
                            >
                                <Icon className="w-4 h-4 text-muted-foreground group-hover:text-primary flex-shrink-0" />
                                <div className="text-left min-w-0 flex-1">
                                    <div className="text-xs sm:text-sm font-medium text-foreground group-hover:text-primary break-words">
                                        {service.name}
                                    </div>
                                    <div className="text-xs text-muted-foreground break-words">
                                        {reason}
                                    </div>
                                </div>
                                <Plus className="w-4 h-4 text-muted-foreground group-hover:text-primary flex-shrink-0" />
                            </motion.button>
                        )
                    })}
                </AnimatePresence>
            </div>
        </motion.div>
    )
}
