import { motion } from 'motion/react'
import { CheckCircle2, AlertTriangle, HelpCircle } from 'lucide-react'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger
} from './tooltip'

export type ConfidenceLevel = 'high' | 'medium' | 'low'

interface ConfidenceBadgeProps {
  level: ConfidenceLevel
  reasoning?: string
  className?: string
  showLabel?: boolean
}

const confidenceConfig = {
  high: {
    icon: CheckCircle2,
    label: 'High Confidence',
    description: 'AI is confident in this response',
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/20 border-emerald-500/40',
    pulse: false
  },
  medium: {
    icon: AlertTriangle,
    label: 'Medium Confidence',
    description: 'AI is moderately confident - verify if important',
    color: 'text-amber-400',
    bg: 'bg-amber-500/20 border-amber-500/40',
    pulse: true
  },
  low: {
    icon: HelpCircle,
    label: 'Low Confidence',
    description: 'AI is uncertain - manual verification recommended',
    color: 'text-red-400',
    bg: 'bg-red-500/20 border-red-500/40',
    pulse: true
  }
}

export function ConfidenceBadge({
  level,
  reasoning,
  className = '',
  showLabel = false
}: ConfidenceBadgeProps) {
  const config = confidenceConfig[level]
  const Icon = config.icon

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className={`
              inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium
              border ${config.bg} ${config.color} ${className}
              ${config.pulse ? 'animate-pulse' : ''}
            `}
          >
            <Icon className="w-3 h-3" />
            {showLabel && <span>{config.label}</span>}
          </motion.div>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs">
          <div className="space-y-1">
            <p className="font-medium">{config.label}</p>
            <p className="text-xs text-muted-foreground">{config.description}</p>
            {reasoning && (
              <p className="text-xs text-muted-foreground/80 pt-1 border-t border-border/50">
                {reasoning}
              </p>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

// Utility function to determine confidence level from various signals
export function calculateConfidence(signals: {
  hasExamples?: boolean
  isValidated?: boolean
  matchScore?: number
  isRecommended?: boolean
}): ConfidenceLevel {
  const { hasExamples, isValidated, matchScore, isRecommended } = signals

  // High confidence: validated and has examples, or high match score
  if ((isValidated && hasExamples) || (matchScore && matchScore > 0.9) || isRecommended) {
    return 'high'
  }

  // Medium confidence: some validation or examples
  if (isValidated || hasExamples || (matchScore && matchScore > 0.6)) {
    return 'medium'
  }

  // Low confidence: limited information
  return 'low'
}
