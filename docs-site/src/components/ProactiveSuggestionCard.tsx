import { motion, AnimatePresence } from 'motion/react'
import { X, Sparkles, Shield, BarChart3, Zap, Server, Info, ChevronRight } from 'lucide-react'
import { Button } from './ui/button'
import type { ProactiveSuggestion } from '../hooks/useProactiveSuggestions'

interface ProactiveSuggestionCardProps {
  suggestions: ProactiveSuggestion[]
  onDismiss: (id: string) => void
  onAction: (suggestion: ProactiveSuggestion) => void
}

const iconMap = {
  sparkles: Sparkles,
  shield: Shield,
  chart: BarChart3,
  zap: Zap,
  server: Server,
  info: Info
}

const priorityColors = {
  high: 'from-amber-500/20 to-orange-500/20 border-amber-500/40',
  medium: 'from-cyan-500/20 to-blue-500/20 border-cyan-500/40',
  low: 'from-slate-500/20 to-gray-500/20 border-slate-500/40'
}

const priorityIconColors = {
  high: 'text-amber-400',
  medium: 'text-cyan-400',
  low: 'text-slate-400'
}

export function ProactiveSuggestionCard({
  suggestions,
  onDismiss,
  onAction
}: ProactiveSuggestionCardProps) {
  if (suggestions.length === 0) return null

  return (
    <div className="fixed z-40 flex flex-col gap-2 max-w-xs sm:max-w-sm mx-4 sm:mx-0 right-0 sm:right-4" style={{ bottom: 'calc(7rem + max(1rem, var(--safe-area-inset-bottom)))' }}>
      <AnimatePresence mode="popLayout">
        {suggestions.slice(0, 3).map((suggestion, index) => {
          const Icon = iconMap[suggestion.icon]

          return (
            <motion.div
              key={suggestion.id}
              initial={{ opacity: 0, x: 100, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 100, scale: 0.9 }}
              transition={{ delay: index * 0.1 }}
              className={`
                relative bg-gradient-to-r ${priorityColors[suggestion.priority]}
                border rounded-lg sm:rounded-xl p-3 sm:p-4 shadow-lg backdrop-blur-sm
              `}
            >
              {/* Dismiss button */}
              {suggestion.dismissible && (
                <button
                  onClick={() => onDismiss(suggestion.id)}
                  className="absolute top-1 right-1 sm:top-2 sm:right-2 rounded-lg hover:bg-white/10 transition-colors touch-target-44 -m-2 p-2"
                  aria-label="Dismiss suggestion"
                >
                  <X className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                </button>
              )}

              <div className="flex items-start gap-2 sm:gap-3">
                {/* Icon */}
                <div className={`p-1.5 sm:p-2 rounded-lg bg-background/40 flex-shrink-0 ${priorityIconColors[suggestion.priority]}`}>
                  <Icon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0 pr-6 sm:pr-4">
                  <p className="text-xs sm:text-sm font-medium text-foreground break-words">
                    {suggestion.text}
                  </p>
                  {suggestion.description && (
                    <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5 line-clamp-2 break-words">
                      {suggestion.description}
                    </p>
                  )}
                </div>
              </div>

              {/* Action button */}
              <div className="mt-2 sm:mt-3 flex justify-end">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    onAction(suggestion)
                    if (suggestion.dismissible) {
                      onDismiss(suggestion.id)
                    }
                  }}
                  className="text-[10px] sm:text-xs gap-1 h-7 px-2 touch-target-44"
                >
                  Do it <ChevronRight className="w-3 h-3 flex-shrink-0" />
                </Button>
              </div>

              {/* Priority indicator */}
              {suggestion.priority === 'high' && (
                <div className="absolute -top-1 -left-1 w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
              )}
            </motion.div>
          )
        })}
      </AnimatePresence>

      {/* More suggestions indicator */}
      {suggestions.length > 3 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center text-[10px] sm:text-xs text-muted-foreground"
        >
          +{suggestions.length - 3} more suggestions
        </motion.div>
      )}
    </div>
  )
}
