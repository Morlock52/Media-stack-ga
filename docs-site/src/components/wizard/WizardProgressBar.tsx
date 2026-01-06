import { useMemo } from 'react'
import { motion } from 'motion/react'
import { useSetupStore } from '../../store/setupStore'
import { useReducedMotion } from '../../hooks/useReducedMotion'
import { LucideIcon } from 'lucide-react'

interface Step {
    title: string
    icon: LucideIcon
}

interface WizardProgressBarProps {
    steps: Step[]
}

export function WizardProgressBar({ steps }: WizardProgressBarProps) {
    const currentStep = useSetupStore((state) => state.currentStep)
    const prefersReducedMotion = useReducedMotion()

    const progress = useMemo(
        () => ((currentStep + 1) / steps.length) * 100,
        [currentStep, steps.length]
    )

    return (
        <div className="mb-8">
            <div className="h-2 bg-muted/40 rounded-full overflow-hidden">
                <motion.div
                    className="progress-bar h-full"
                    initial={{ width: 0 }}
                    animate={{ width: `${progress}%` }}
                    transition={prefersReducedMotion
                        ? { duration: 0 }
                        : { duration: 0.5, ease: 'easeOut' }
                    }
                />
            </div>
            <p className="text-center mt-2 text-sm text-muted-foreground">
                Step {currentStep + 1} of {steps.length} • {Math.round(progress)}% Complete
            </p>
        </div>
    )
}
