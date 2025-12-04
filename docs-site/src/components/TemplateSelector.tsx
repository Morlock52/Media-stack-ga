import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
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
            className="space-y-6"
        >
            <div className="text-center mb-8">
                <h2 className="text-3xl font-bold text-white mb-3">Choose a Template</h2>
                <p className="text-gray-400">Quick start with a pre-configured setup, or customize from scratch</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {templates.map((template) => (
                    <motion.button
                        key={template.id}
                        onClick={() => handleTemplateClick(template)}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        className="group relative p-6 rounded-xl border border-white/10 bg-gradient-to-br from-white/5 to-transparent hover:from-purple-500/10 hover:border-purple-500/30 transition-all text-left"
                    >
                        {/* Difficulty badge */}
                        <div className="absolute top-4 right-4">
                            <span className={`text-xs px-2 py-1 rounded-full ${template.difficulty === 'beginner' ? 'bg-green-500/20 text-green-300' :
                                template.difficulty === 'intermediate' ? 'bg-yellow-500/20 text-yellow-300' :
                                    'bg-red-500/20 text-red-300'
                                }`}>
                                {template.difficulty}
                            </span>
                        </div>

                        {/* Icon */}
                        <div className="text-4xl mb-4">{template.icon}</div>

                        {/* Name */}
                        <h3 className="text-lg font-semibold text-white mb-2 group-hover:text-purple-300 transition-colors">
                            {template.name}
                        </h3>

                        {/* Description */}
                        <p className="text-sm text-gray-400 mb-4">{template.description}</p>

                        {/* Services count */}
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                            <Check className="w-3 h-3" />
                            <span>{template.services.length} services • Click for details</span>
                        </div>
                    </motion.button>
                ))}
            </div>

            {/* Skip button */}
            <div className="flex justify-center pt-6">
                <button
                    onClick={onSkip}
                    className="px-6 py-3 rounded-lg border border-white/20 text-gray-300 hover:text-white hover:border-purple-500/50 transition-all"
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
                        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
                        onClick={() => setSelectedTemplate(null)}
                    >
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            onClick={(e) => e.stopPropagation()}
                            className="relative w-full max-w-2xl max-h-[85vh] overflow-y-auto bg-slate-900 border border-white/10 rounded-2xl shadow-2xl"
                        >
                            {/* Header */}
                            <div className="sticky top-0 z-10 bg-slate-900/95 backdrop-blur-sm border-b border-white/10 p-6 flex items-start justify-between">
                                <div className="flex items-center gap-4">
                                    <span className="text-5xl">{selectedTemplate.icon}</span>
                                    <div>
                                        <h3 className="text-2xl font-bold text-white">{selectedTemplate.name}</h3>
                                        <span className={`inline-block mt-1 text-xs px-2 py-1 rounded-full ${
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
                                    className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                                    aria-label="Close modal"
                                >
                                    <X className="w-5 h-5 text-gray-400" />
                                </button>
                            </div>

                            {/* Content */}
                            <div className="p-6 space-y-6">
                                {/* Detailed Description */}
                                <div>
                                    <p className="text-gray-300 leading-relaxed">
                                        {selectedTemplate.detailedDescription}
                                    </p>
                                </div>

                                {/* Highlights */}
                                <div className="bg-purple-500/5 border border-purple-500/20 rounded-xl p-4">
                                    <div className="flex items-center gap-2 mb-3">
                                        <Sparkles className="w-4 h-4 text-purple-400" />
                                        <h4 className="font-semibold text-purple-300">Key Features</h4>
                                    </div>
                                    <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                        {selectedTemplate.highlights.map((highlight, i) => (
                                            <li key={i} className="flex items-start gap-2 text-sm text-gray-300">
                                                <Check className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" />
                                                <span>{highlight}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>

                                {/* Apps Included */}
                                <div>
                                    <div className="flex items-center gap-2 mb-4">
                                        <Layers className="w-4 h-4 text-blue-400" />
                                        <h4 className="font-semibold text-white">Apps Included ({selectedTemplate.services.length})</h4>
                                    </div>
                                    <div className="grid gap-3">
                                        {selectedTemplate.services.map((serviceId) => {
                                            const info = serviceInfo[serviceId]
                                            return (
                                                <div
                                                    key={serviceId}
                                                    className="flex items-start gap-3 p-3 bg-white/5 border border-white/5 rounded-lg"
                                                >
                                                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500/20 to-pink-500/20 border border-purple-500/30 flex items-center justify-center flex-shrink-0">
                                                        <span className="text-xs font-bold text-purple-300">
                                                            {(info?.name || serviceId).charAt(0).toUpperCase()}
                                                        </span>
                                                    </div>
                                                    <div>
                                                        <h5 className="font-medium text-white">
                                                            {info?.name || serviceId}
                                                        </h5>
                                                        <p className="text-sm text-gray-400">
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
                            <div className="sticky bottom-0 bg-slate-900/95 backdrop-blur-sm border-t border-white/10 p-6 flex gap-3">
                                <button
                                    onClick={() => setSelectedTemplate(null)}
                                    className="flex-1 px-4 py-3 rounded-lg border border-white/20 text-gray-300 hover:text-white hover:border-white/40 transition-all"
                                >
                                    Back to Templates
                                </button>
                                <button
                                    onClick={handleUseTemplate}
                                    className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-medium rounded-lg transition-all"
                                >
                                    Use This Template
                                    <ArrowRight className="w-4 h-4" />
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    )
}
