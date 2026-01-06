import { motion } from 'motion/react'
import { Check, LucideIcon } from 'lucide-react'
import { useSetupStore } from '../../store/setupStore'

interface Step {
    title: string
    icon: LucideIcon
}

interface WizardStepIndicatorProps {
    steps: Step[]
}

export function WizardStepIndicator({ steps }: WizardStepIndicatorProps) {
    const currentStep = useSetupStore((state) => state.currentStep)
    const setCurrentStep = useSetupStore((state) => state.setCurrentStep)

    return (
        <div className="mb-12">
            <div className="flex items-center justify-between max-w-3xl mx-auto">
                {steps.map((step, index) => {
                    const Icon = step.icon
                    const isActive = index === currentStep
                    const isComplete = index < currentStep
                    const isClickable = isComplete // Can click on completed steps

                    return (
                        <div key={index} className="flex items-center flex-1">
                            <div className="flex flex-col items-center flex-1">
                                <motion.button
                                    type="button"
                                    onClick={() => isClickable && setCurrentStep(index)}
                                    disabled={!isClickable}
                                    className={`w-12 h-12 rounded-full flex items-center justify-center border-2 transition-all ${isActive
                                        ? 'bg-primary/20 border-primary text-primary animate-pulse-glow'
                                        : isComplete
                                            ? 'bg-green-500/20 border-green-500 text-green-300 hover:bg-green-500/30 hover:scale-105 cursor-pointer'
                                            : 'bg-muted/40 border-border text-muted-foreground cursor-not-allowed'
                                        }`}
                                    animate={isComplete ? { scale: [1, 1.1, 1] } : {}}
                                    transition={{ duration: 0.3 }}
                                    title={isClickable ? `Go back to ${step.title}` : isActive ? 'Current step' : 'Complete previous steps first'}
                                    aria-label={isClickable ? `Navigate to ${step.title}` : step.title}
                                >
                                    {isComplete ? <Check className="w-5 h-5" /> : <Icon className="w-5 h-5" />}
                                </motion.button>
                                <button
                                    type="button"
                                    onClick={() => isClickable && setCurrentStep(index)}
                                    disabled={!isClickable}
                                    className={`mt-2 text-xs font-medium hidden md:block transition-colors ${isActive ? 'text-primary' : isComplete ? 'text-green-300 hover:text-green-200 cursor-pointer' : 'text-muted-foreground cursor-not-allowed'
                                    }`}
                                >
                                    {step.title}
                                </button>
                            </div>
                            {index < steps.length - 1 && (
                                <motion.div
                                    className={`h-0.5 flex-1 mx-2 ${isComplete ? 'bg-green-500/50' : 'bg-border'}`}
                                    initial={{ scaleX: 0 }}
                                    animate={{ scaleX: isComplete ? 1 : 0 }}
                                    transition={{ duration: 0.5 }}
                                />
                            )}
                        </div>
                    )
                })}
            </div>
        </div>
    )
}
