import { useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { templates, Template, serviceInfo } from '../data/templates'
import { Check, X, Sparkles, ArrowRight, Layers } from 'lucide-react'

interface TemplateSelectorProps {
    onSelectTemplate: (template: Template) => void
    onSkip: () => void
}

export function TemplateSelector({ onSelectTemplate, onSkip }: TemplateSelectorProps) {
    const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null)

    const handleTemplateClick = (template: Template) => {
        setSelectedTemplate(template)
    }

    const handleUseTemplate = () => {
        if (selectedTemplate) {
            onSelectTemplate(selectedTemplate)
            setSelectedTemplate(null)
        }
    }

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4 sm:space-y-6 px-4 sm:px-0"
        >
            <div className="text-center mb-4 sm:mb-8">
                <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-foreground mb-2 sm:mb-3 break-words">Choose a Template</h2>
                <p className="text-xs sm:text-sm md:text-base text-muted-foreground break-words">Quick start with a pre-configured setup, or customize from scratch</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                {templates.map((template) => (
                    <motion.button
                        key={template.id}
                        onClick={() => handleTemplateClick(template)}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        className="group relative p-4 sm:p-5 md:p-6 rounded-lg sm:rounded-xl border border-border bg-gradient-to-br from-muted/40 to-transparent hover:from-primary/10 hover:border-primary/40 transition-all text-left touch-target-44"
                    >
                        {/* Difficulty badge */}
                        <div className="absolute top-3 sm:top-4 right-3 sm:right-4">
                            <span className={`text-[10px] sm:text-xs px-2 py-1 rounded-full break-words ${template.difficulty === 'beginner' ? 'bg-green-500/20 text-green-300' :
                                template.difficulty === 'intermediate' ? 'bg-yellow-500/20 text-yellow-300' :
                                    'bg-red-500/20 text-red-300'
                                }`}>
                                {template.difficulty}
                            </span>
                        </div>

                        {/* Icon */}
                        <div className="text-3xl sm:text-4xl mb-3 sm:mb-4 flex-shrink-0">{template.icon}</div>

                        {/* Name */}
                        <h3 className="text-base sm:text-lg font-semibold text-foreground mb-2 group-hover:text-primary transition-colors break-words pr-16">
                            {template.name}
                        </h3>

                        {/* Description */}
                        <p className="text-xs sm:text-sm text-muted-foreground mb-3 sm:mb-4 break-words">{template.description}</p>

                        {/* Services count */}
                        <div className="flex items-center gap-2 text-[10px] sm:text-xs text-muted-foreground">
                            <Check className="w-3 h-3 flex-shrink-0" />
                            <span className="break-words">{template.services.length} services • Click for details</span>
                        </div>
                    </motion.button>
                ))}
            </div>

            {/* Skip button */}
            <div className="flex justify-center pt-4 sm:pt-6">
                <button
                    onClick={onSkip}
                    className="w-full sm:w-auto px-4 sm:px-6 py-3 rounded-lg border border-border text-xs sm:text-sm text-muted-foreground hover:text-foreground hover:border-primary/50 transition-all touch-target-44 break-words"
                >
                    Skip - Customize from Scratch
                </button>
            </div>

            {/* Template Detail Modal */}
            <AnimatePresence>
                {selectedTemplate && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-background/80 backdrop-blur-sm"
                        onClick={() => setSelectedTemplate(null)}
                    >
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            onClick={(e) => e.stopPropagation()}
                            className="relative w-full max-w-2xl max-h-[100dvh] sm:max-h-[calc(100dvh-2rem)] bg-card border border-border rounded-lg sm:rounded-2xl shadow-2xl overflow-hidden flex flex-col"
                            style={{
                                maxHeight: 'calc(100dvh - env(safe-area-inset-top) - env(safe-area-inset-bottom))',
                            }}
                        >
                            {/* Header */}
                            <div className="sticky top-0 z-10 bg-card/95 backdrop-blur-sm border-b border-border p-3 sm:p-4 md:p-6 flex items-start justify-between gap-2">
                                <div className="flex items-center gap-2 sm:gap-3 md:gap-4 min-w-0">
                                    <span className="text-3xl sm:text-4xl md:text-5xl flex-shrink-0">{selectedTemplate.icon}</span>
                                    <div className="min-w-0">
                                        <h3 className="text-base sm:text-lg md:text-2xl font-bold text-foreground break-words">{selectedTemplate.name}</h3>
                                        <span className={`inline-block mt-1 text-[10px] sm:text-xs px-2 py-1 rounded-full break-words ${
                                            selectedTemplate.difficulty === 'beginner' ? 'bg-green-500/20 text-green-300' :
                                            selectedTemplate.difficulty === 'intermediate' ? 'bg-yellow-500/20 text-yellow-300' :
                                            'bg-red-500/20 text-red-300'
                                        }`}>
                                            {selectedTemplate.difficulty}
                                        </span>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setSelectedTemplate(null)}
                                    className="-m-2 p-2 hover:bg-muted/60 rounded-lg transition-colors touch-target-44 flex-shrink-0"
                                    aria-label="Close modal"
                                >
                                    <X className="w-4 h-4 sm:w-5 sm:h-5 text-muted-foreground flex-shrink-0" />
                                </button>
                            </div>

                            {/* Content */}
                            <div className="p-3 sm:p-4 md:p-6 space-y-3 sm:space-y-4 md:space-y-6 min-h-0 overflow-y-auto">
                                {/* Detailed Description */}
                                <div>
                                    <p className="text-xs sm:text-sm md:text-base text-muted-foreground leading-relaxed break-words">
                                        {selectedTemplate.detailedDescription}
                                    </p>
                                </div>

                                {/* Highlights */}
                                <div className="bg-primary/10 border border-primary/30 rounded-lg sm:rounded-xl p-3 sm:p-4">
                                    <div className="flex items-center gap-2 mb-2 sm:mb-3">
                                        <Sparkles className="w-3 h-3 sm:w-4 sm:h-4 text-primary flex-shrink-0" />
                                        <h4 className="text-xs sm:text-sm md:text-base font-semibold text-primary break-words">Key Features</h4>
                                    </div>
                                    <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                        {selectedTemplate.highlights.map((highlight, i) => (
                                            <li key={i} className="flex items-start gap-2 text-xs sm:text-sm text-muted-foreground">
                                                <Check className="w-3 h-3 sm:w-4 sm:h-4 text-green-400 mt-0.5 flex-shrink-0" />
                                                <span className="break-words">{highlight}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>

                                {/* Apps Included */}
                                <div>
                                    <div className="flex items-center gap-2 mb-3 sm:mb-4">
                                        <Layers className="w-3 h-3 sm:w-4 sm:h-4 text-blue-400 flex-shrink-0" />
                                        <h4 className="text-xs sm:text-sm md:text-base font-semibold text-foreground break-words">Apps Included ({selectedTemplate.services.length})</h4>
                                    </div>
                                    <div className="grid gap-2 sm:gap-3">
                                        {selectedTemplate.services.map((serviceId) => {
                                            const info = serviceInfo[serviceId]
                                            return (
                                                <div
                                                    key={serviceId}
                                                    className="flex items-start gap-2 sm:gap-3 p-2 sm:p-3 bg-muted/40 border border-border rounded-lg min-h-[44px]"
                                                >
                                                    <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 border border-primary/40 flex items-center justify-center flex-shrink-0">
                                                        <span className="text-[10px] sm:text-xs font-bold text-primary">
                                                            {(info?.name || serviceId).charAt(0).toUpperCase()}
                                                        </span>
                                                    </div>
                                                    <div className="min-w-0">
                                                        <h5 className="text-xs sm:text-sm font-medium text-foreground break-words">
                                                            {info?.name || serviceId}
                                                        </h5>
                                                        <p className="text-[10px] sm:text-xs md:text-sm text-muted-foreground break-words">
                                                            {info?.description || 'Service for your media stack'}
                                                        </p>
                                                    </div>
                                                </div>
                                            )
                                        })}
                                    </div>
                                </div>
                            </div>

                            {/* Footer */}
                            <div className="sticky bottom-0 bg-card/95 backdrop-blur-sm border-t border-border p-3 sm:p-4 md:p-6 flex flex-col-reverse sm:flex-row gap-2 sm:gap-3">
                                <button
                                    onClick={() => setSelectedTemplate(null)}
                                    className="flex-1 px-4 py-3 rounded-lg border border-border text-xs sm:text-sm text-muted-foreground hover:text-foreground hover:border-border transition-all touch-target-44 break-words"
                                >
                                    Back to Templates
                                </button>
                                <button
                                    onClick={handleUseTemplate}
                                    className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-emerald-500 via-cyan-500 to-lime-400 hover:from-emerald-400 hover:via-cyan-400 hover:to-lime-300 text-white text-xs sm:text-sm font-medium rounded-lg transition-all touch-target-44 break-words"
                                >
                                    Use This Template
                                    <ArrowRight className="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0" />
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    )
}
