import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { Search, Star, Zap, ChevronRight, Check, Shield, X } from 'lucide-react'
import { vpnProviders, type VPNProvider } from '@/data/vpnProviders'
import { useSetupStore } from '@/store/setupStore'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

interface VPNProviderSelectorProps {
    onProviderSelected?: (provider: VPNProvider) => void
    className?: string
}

export function VPNProviderSelector({ onProviderSelected, className }: VPNProviderSelectorProps) {
    const [searchQuery, setSearchQuery] = useState('')
    const [selectedFilter, setSelectedFilter] = useState<'all' | 'recommended' | 'port-forwarding'>('all')
    const [selectedProvider, setSelectedProvider] = useState<VPNProvider | null>(null)

    const { config, updateVpnConfig } = useSetupStore()
    const currentProviderId = config.selectedVpnProvider

    // Filter and search providers
    const filteredProviders = useMemo(() => {
        let providers = [...vpnProviders]

        // Apply filter
        if (selectedFilter === 'recommended') {
            providers = providers.filter(p => p.popular)
        } else if (selectedFilter === 'port-forwarding') {
            providers = providers.filter(p => p.portForwarding.supported)
        }

        // Apply search
        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase()
            providers = providers.filter(
                p =>
                    p.name.toLowerCase().includes(query) ||
                    p.description.toLowerCase().includes(query) ||
                    p.id.toLowerCase().includes(query)
            )
        }

        return providers
    }, [searchQuery, selectedFilter])

    const handleProviderClick = (provider: VPNProvider) => {
        setSelectedProvider(provider)
    }

    const handleSelectProvider = () => {
        if (selectedProvider) {
            updateVpnConfig({
                selectedVpnProvider: selectedProvider.id,
                vpnProtocol: selectedProvider.recommendedProtocol,
                portForwardingEnabled: false, // User can enable later
            })
            onProviderSelected?.(selectedProvider)
            setSelectedProvider(null)
        }
    }

    const getDifficultyColor = (difficulty: string) => {
        switch (difficulty) {
            case 'easy':
                return 'bg-green-500/20 text-green-300 border-green-500/30'
            case 'moderate':
                return 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30'
            case 'advanced':
                return 'bg-red-500/20 text-red-300 border-red-500/30'
            default:
                return 'bg-gray-500/20 text-gray-300 border-gray-500/30'
        }
    }

    return (
        <div className={cn('space-y-6', className)}>
            {/* Header */}
            <div>
                <h3 className="text-2xl font-bold text-foreground mb-2">Select Your VPN Provider</h3>
                <p className="text-muted-foreground">
                    Choose from {vpnProviders.length} supported VPN providers
                </p>
            </div>

            {/* Search and Filters */}
            <div className="space-y-3">
                {/* Search Input */}
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                    <Input
                        type="text"
                        placeholder="Search providers..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-10"
                        aria-label="Search VPN providers"
                    />
                </div>

                {/* Filter Buttons */}
                <div className="flex flex-wrap gap-2">
                    <button
                        onClick={() => setSelectedFilter('all')}
                        className={cn(
                            'px-4 py-2 rounded-lg text-sm font-medium transition-all',
                            selectedFilter === 'all'
                                ? 'bg-primary/20 text-primary border border-primary/40'
                                : 'bg-muted/40 text-muted-foreground border border-border hover:border-border/80'
                        )}
                        aria-pressed={selectedFilter === 'all'}
                    >
                        All Providers
                    </button>
                    <button
                        onClick={() => setSelectedFilter('recommended')}
                        className={cn(
                            'px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-1.5',
                            selectedFilter === 'recommended'
                                ? 'bg-primary/20 text-primary border border-primary/40'
                                : 'bg-muted/40 text-muted-foreground border border-border hover:border-border/80'
                        )}
                        aria-pressed={selectedFilter === 'recommended'}
                    >
                        <Star className="w-3.5 h-3.5" />
                        Recommended
                    </button>
                    <button
                        onClick={() => setSelectedFilter('port-forwarding')}
                        className={cn(
                            'px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-1.5',
                            selectedFilter === 'port-forwarding'
                                ? 'bg-primary/20 text-primary border border-primary/40'
                                : 'bg-muted/40 text-muted-foreground border border-border hover:border-border/80'
                        )}
                        aria-pressed={selectedFilter === 'port-forwarding'}
                    >
                        <Zap className="w-3.5 h-3.5" />
                        Port Forwarding
                    </button>
                </div>
            </div>

            {/* Results count */}
            <div className="text-sm text-muted-foreground">
                Showing {filteredProviders.length} {filteredProviders.length === 1 ? 'provider' : 'providers'}
            </div>

            {/* Provider Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <AnimatePresence mode="popLayout">
                    {filteredProviders.map((provider) => {
                        const Icon = provider.icon
                        const isSelected = currentProviderId === provider.id

                        return (
                            <motion.button
                                key={provider.id}
                                layout
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.9 }}
                                onClick={() => handleProviderClick(provider)}
                                className={cn(
                                    'group relative p-5 rounded-xl border transition-all text-left',
                                    'focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background',
                                    isSelected
                                        ? 'bg-primary/10 border-primary/50'
                                        : 'bg-card/40 border-border hover:border-primary/40 hover:bg-card/60'
                                )}
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                aria-label={`Select ${provider.name}`}
                                aria-pressed={isSelected}
                            >
                                {/* Badges Row */}
                                <div className="flex items-start justify-between mb-3">
                                    <div className="flex flex-wrap gap-1.5">
                                        {/* Recommended Badge */}
                                        {provider.popular && (
                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-500/20 text-amber-300 border border-amber-500/30">
                                                <Star className="w-3 h-3" />
                                                Recommended
                                            </span>
                                        )}
                                        {/* Port Forwarding Badge */}
                                        {provider.portForwarding.supported && (
                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                                                <Zap className="w-3 h-3" />
                                                Port Forwarding
                                            </span>
                                        )}
                                    </div>

                                    {/* Selected Checkmark */}
                                    {isSelected && (
                                        <motion.div
                                            initial={{ scale: 0 }}
                                            animate={{ scale: 1 }}
                                            className="flex-shrink-0 bg-green-500/20 text-green-400 p-1 rounded-full"
                                        >
                                            <Check className="w-3.5 h-3.5" />
                                        </motion.div>
                                    )}
                                </div>

                                {/* Icon and Name */}
                                <div className="flex items-center gap-3 mb-3">
                                    <div
                                        className={cn(
                                            'p-3 rounded-lg transition-colors',
                                            isSelected
                                                ? 'bg-primary/20 text-primary'
                                                : 'bg-muted/60 text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary'
                                        )}
                                    >
                                        <Icon className="w-6 h-6" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h4 className="text-base font-semibold text-foreground group-hover:text-primary transition-colors truncate">
                                            {provider.name}
                                        </h4>
                                    </div>
                                </div>

                                {/* Description */}
                                <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                                    {provider.description}
                                </p>

                                {/* Footer Info */}
                                <div className="flex items-center justify-between pt-3 border-t border-border/50">
                                    {/* Difficulty Badge */}
                                    <span
                                        className={cn(
                                            'text-xs px-2 py-1 rounded-full border font-medium',
                                            getDifficultyColor(provider.difficulty)
                                        )}
                                    >
                                        {provider.difficulty.charAt(0).toUpperCase() + provider.difficulty.slice(1)}
                                    </span>

                                    {/* View Details Arrow */}
                                    <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                                </div>

                                {/* Hover Glow Effect */}
                                <motion.div
                                    className="pointer-events-none absolute inset-0 rounded-xl bg-gradient-to-br from-primary/5 via-transparent to-primary/5 opacity-0 group-hover:opacity-100 transition-opacity"
                                    aria-hidden="true"
                                />
                            </motion.button>
                        )
                    })}
                </AnimatePresence>
            </div>

            {/* No Results Message */}
            {filteredProviders.length === 0 && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="text-center py-12"
                >
                    <Shield className="w-12 h-12 text-muted-foreground/50 mx-auto mb-3" />
                    <p className="text-muted-foreground">No providers found matching your criteria</p>
                    <button
                        onClick={() => {
                            setSearchQuery('')
                            setSelectedFilter('all')
                        }}
                        className="mt-3 text-sm text-primary hover:text-primary/80 transition-colors"
                    >
                        Clear filters
                    </button>
                </motion.div>
            )}

            {/* Provider Detail Modal */}
            <AnimatePresence>
                {selectedProvider && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm"
                        onClick={() => setSelectedProvider(null)}
                    >
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            onClick={(e) => e.stopPropagation()}
                            className="relative w-full max-w-2xl max-h-[calc(100dvh-2rem)] bg-card border border-border rounded-2xl shadow-2xl overflow-hidden flex flex-col"
                        >
                            {/* Header */}
                            <div className="sticky top-0 z-10 bg-card/95 backdrop-blur-sm border-b border-border p-6 flex items-start justify-between">
                                <div className="flex items-center gap-4">
                                    <div className="p-3 rounded-lg bg-primary/20">
                                        {(() => {
                                            const Icon = selectedProvider.icon
                                            return <Icon className="w-8 h-8 text-primary" />
                                        })()}
                                    </div>
                                    <div>
                                        <h3 className="text-2xl font-bold text-foreground">{selectedProvider.name}</h3>
                                        <div className="flex flex-wrap gap-2 mt-2">
                                            {selectedProvider.popular && (
                                                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-amber-500/20 text-amber-300 border border-amber-500/30">
                                                    <Star className="w-3 h-3" />
                                                    Recommended
                                                </span>
                                            )}
                                            <span
                                                className={cn(
                                                    'text-xs px-2 py-1 rounded-full border font-medium',
                                                    getDifficultyColor(selectedProvider.difficulty)
                                                )}
                                            >
                                                {selectedProvider.difficulty.charAt(0).toUpperCase() +
                                                    selectedProvider.difficulty.slice(1)}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setSelectedProvider(null)}
                                    className="p-2 hover:bg-muted/60 rounded-lg transition-colors"
                                    aria-label="Close modal"
                                >
                                    <X className="w-5 h-5 text-muted-foreground" />
                                </button>
                            </div>

                            {/* Content */}
                            <div className="p-6 space-y-6 min-h-0 overflow-y-auto">
                                {/* Description */}
                                <div>
                                    <p className="text-muted-foreground leading-relaxed">{selectedProvider.description}</p>
                                </div>

                                {/* Key Features */}
                                <div className="bg-primary/10 border border-primary/30 rounded-xl p-4">
                                    <h4 className="font-semibold text-foreground mb-3">Key Features</h4>
                                    <div className="grid gap-3">
                                        {/* Protocols */}
                                        <div className="flex items-start gap-2 text-sm">
                                            <Check className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" />
                                            <div>
                                                <span className="text-foreground font-medium">Protocols: </span>
                                                <span className="text-muted-foreground">
                                                    {selectedProvider.protocols.join(', ')} (
                                                    {selectedProvider.recommendedProtocol} recommended)
                                                </span>
                                            </div>
                                        </div>

                                        {/* Port Forwarding */}
                                        <div className="flex items-start gap-2 text-sm">
                                            {selectedProvider.portForwarding.supported ? (
                                                <>
                                                    <Zap className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" />
                                                    <div>
                                                        <span className="text-foreground font-medium">Port Forwarding: </span>
                                                        <span className="text-emerald-300">
                                                            Supported
                                                            {selectedProvider.portForwarding.automatic && ' (automatic)'}
                                                        </span>
                                                        {selectedProvider.portForwarding.notes && (
                                                            <p className="text-muted-foreground mt-1">
                                                                {selectedProvider.portForwarding.notes}
                                                            </p>
                                                        )}
                                                    </div>
                                                </>
                                            ) : (
                                                <>
                                                    <X className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
                                                    <div>
                                                        <span className="text-foreground font-medium">Port Forwarding: </span>
                                                        <span className="text-red-300">Not supported</span>
                                                    </div>
                                                </>
                                            )}
                                        </div>

                                        {/* Authentication */}
                                        <div className="flex items-start gap-2 text-sm">
                                            <Check className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" />
                                            <div>
                                                <span className="text-foreground font-medium">Authentication: </span>
                                                <span className="text-muted-foreground">
                                                    {selectedProvider.authMethod.description}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Setup Instructions Link */}
                                {selectedProvider.setupInstructionsUrl && (
                                    <div>
                                        <a
                                            href={selectedProvider.setupInstructionsUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="inline-flex items-center gap-2 text-sm text-primary hover:text-primary/80 transition-colors"
                                        >
                                            View setup instructions
                                            <ChevronRight className="w-4 h-4" />
                                        </a>
                                    </div>
                                )}
                            </div>

                            {/* Footer */}
                            <div className="sticky bottom-0 bg-card/95 backdrop-blur-sm border-t border-border p-6 flex gap-3">
                                <button
                                    onClick={() => setSelectedProvider(null)}
                                    className="flex-1 px-4 py-3 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:border-border/80 transition-all"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleSelectProvider}
                                    className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-emerald-500 via-cyan-500 to-lime-400 hover:from-emerald-400 hover:via-cyan-400 hover:to-lime-300 text-white font-medium rounded-lg transition-all"
                                >
                                    Select {selectedProvider.name}
                                    <ChevronRight className="w-4 h-4" />
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}
