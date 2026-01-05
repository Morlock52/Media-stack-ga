import { useCallback, useMemo, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { useReducedMotion } from '../hooks/useReducedMotion'
import { toast } from 'sonner'
import {
    ArrowRight, ArrowLeft, Check, Database, Shield, Clock, FileCheck, HardDrive
} from 'lucide-react'
import { useBackupStore } from '../store/backupStore'
import { Button } from './ui/button'
import { GlassCard } from './ui/glass-card'

// Step components will be imported here as they are created in subsequent tasks
import { DestinationStep } from './backup/DestinationStep'
import { SelectionStep } from './backup/SelectionStep'
import { EncryptionStep } from './backup/EncryptionStep'
import { ScheduleStep } from './backup/ScheduleStep'
// TODO: Import ReviewStep (3.6)

const steps = [
    { title: 'Destination', icon: HardDrive },
    { title: 'Selection', icon: Database },
    { title: 'Encryption', icon: Shield },
    { title: 'Schedule', icon: Clock },
    { title: 'Review', icon: FileCheck }
]

export function BackupWizard() {
    const {
        currentStep,
        destination,
        selectedItems,
        encryption,
        schedule,
        setCurrentStep,
        nextStep,
        prevStep
    } = useBackupStore()

    // Accessibility: Respect user's reduced motion preference
    const prefersReducedMotion = useReducedMotion()

    // Animation variants that respect reduced motion
    const fadeInUp = useMemo(() => prefersReducedMotion
        ? { initial: {}, animate: {}, transition: { duration: 0 } }
        : { initial: { opacity: 0, y: 20 }, animate: { opacity: 1, y: 0 } },
        [prefersReducedMotion]
    )

    // Ref for the main content area
    const mainContentRef = useRef<HTMLDivElement>(null)

    // Scroll to content area when step changes
    useEffect(() => {
        if (mainContentRef.current) {
            mainContentRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
        }

        // Focus first input after animation completes
        setTimeout(() => {
            const firstInput = document.querySelector('input:not([type="hidden"]), select, textarea') as HTMLElement
            if (firstInput && firstInput instanceof HTMLInputElement) {
                firstInput.focus()
            }
        }, 400) // Wait for framer-motion animation
    }, [currentStep])

    const handleNextStep = useCallback(async () => {
        if (currentStep === 0) {
            // Destination step validation
            if (!destination) {
                toast.error('Please configure a backup destination')
                return
            }
            nextStep()
        } else if (currentStep === 1) {
            // Selection step validation
            if (selectedItems.length === 0) {
                toast.error('Please select at least one item to backup')
                return
            }
            nextStep()
        } else if (currentStep === 2) {
            // Encryption step validation
            if (encryption.enabled && !encryption.password) {
                toast.error('Please provide an encryption password')
                return
            }
            nextStep()
        } else if (currentStep === 3) {
            // Schedule step - no validation required
            nextStep()
        }
    }, [currentStep, destination, selectedItems, encryption, nextStep])

    const progress = ((currentStep + 1) / steps.length) * 100

    return (
        <div className="min-h-screen pt-24 pb-28 px-4 sm:px-6 lg:px-8">
            <div className="max-w-5xl mx-auto">
                {/* Header */}
                <div className="text-center mb-12">
                    <motion.div
                        {...fadeInUp}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/30 mb-6"
                    >
                        <Database className="w-4 h-4 text-primary" />
                        <span className="text-sm text-primary">Backup & Restore Wizard</span>
                    </motion.div>
                    <motion.h1
                        {...fadeInUp}
                        transition={prefersReducedMotion ? { duration: 0 } : { delay: 0.1 }}
                        className="text-4xl md:text-5xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-emerald-400 via-cyan-400 to-lime-400 mb-4"
                    >
                        Backup Wizard
                    </motion.h1>
                    <motion.p
                        {...fadeInUp}
                        transition={prefersReducedMotion ? { duration: 0 } : { delay: 0.2 }}
                        className="text-lg text-muted-foreground max-w-2xl mx-auto"
                    >
                        Secure your media stack with automated backups to local, S3, or rclone destinations
                    </motion.p>
                </div>

                {/* Progress Bar */}
                <div className="mb-8">
                    <div className="h-2 bg-muted/40 rounded-full overflow-hidden">
                        <motion.div
                            className="progress-bar h-full"
                            initial={{ width: 0 }}
                            animate={{ width: `${progress}%` }}
                            transition={{ duration: 0.5, ease: 'easeOut' }}
                        />
                    </div>
                    <p className="text-center mt-2 text-sm text-muted-foreground">
                        Step {currentStep + 1} of {steps.length} • {Math.round(progress)}% Complete
                    </p>
                </div>

                {/* Progress Steps - Click to navigate to completed steps */}
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

                {/* Main Content */}
                <div ref={mainContentRef} className="scroll-mt-24">
                    <GlassCard
                        blur="lg"
                        variant="default"
                        className="p-8 min-h-[500px] transition-all duration-300 hover:bg-white/20"
                    >
                        <AnimatePresence mode="wait">
                            {/* Step 0: Destination */}
                            {currentStep === 0 && <DestinationStep />}

                            {/* Step 1: Selection */}
                            {currentStep === 1 && <SelectionStep />}

                            {/* Step 2: Encryption */}
                            {currentStep === 2 && <EncryptionStep />}

                            {/* Step 3: Schedule */}
                            {currentStep === 3 && <ScheduleStep />}

                            {/* Step 4: Review (TODO: Implement in 3.6) */}
                            {currentStep === 4 && (
                                <motion.div
                                    key="review"
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -20 }}
                                    transition={{ duration: 0.3 }}
                                >
                                    <div className="text-center py-12">
                                        <FileCheck className="w-16 h-16 mx-auto mb-4 text-primary" />
                                        <h2 className="text-2xl font-bold mb-2">Review & Execute</h2>
                                        <p className="text-muted-foreground">Step component will be implemented in subtask 3.6</p>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </GlassCard>
                </div>

                {/* Navigation Buttons */}
                <div className="sticky bottom-4 z-30 mt-8">
                    <div className="flex justify-between items-center glass-ultra rounded-2xl border border-border/60 px-4 py-3 backdrop-blur">
                        <Button
                            type="button"
                            onClick={prevStep}
                            variant="glass"
                            className="btn-lift px-6 py-3"
                            disabled={currentStep === 0}
                        >
                            <ArrowLeft className="w-4 h-4" />
                            Back
                        </Button>

                        {currentStep < 4 ? (
                            <Button
                                type="button"
                                onClick={handleNextStep}
                                variant="gradient"
                                className="btn-lift px-6 py-3"
                            >
                                Next
                                <ArrowRight className="w-4 h-4" />
                            </Button>
                        ) : (
                            <Button
                                type="button"
                                onClick={() => toast.info('Backup execution will be implemented in step component')}
                                variant="gradient"
                                className="btn-lift px-6 py-3"
                            >
                                <Database className="w-4 h-4" />
                                Start Backup
                            </Button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}
