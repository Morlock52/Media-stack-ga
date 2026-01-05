import { useCallback, useMemo, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { useReducedMotion } from '../hooks/useReducedMotion'
import { toast } from 'sonner'
import {
    ArrowRight, ArrowLeft, Check, HardDrive, ShieldCheck, ListChecks, AlertTriangle, Play
} from 'lucide-react'
import { useBackupStore } from '../store/backupStore'
import { Button } from './ui/button'
import { GlassCard } from './ui/glass-card'

// Step components
import { BackupSelector } from './restore/BackupSelector'
import { ValidationStep } from './restore/ValidationStep'
// TODO: Remaining step components will be implemented in subsequent subtasks (4.4-4.6)
// import { RestoreSelectionStep } from './restore/RestoreSelectionStep'
// import { RestoreConfirmStep } from './restore/RestoreConfirmStep'
// import { RestoreExecutionStep } from './restore/RestoreExecutionStep'

const steps = [
    { title: 'Select Backup', icon: HardDrive },
    { title: 'Validate', icon: ShieldCheck },
    { title: 'Choose Items', icon: ListChecks },
    { title: 'Confirm', icon: AlertTriangle },
    { title: 'Execute', icon: Play }
]

export function RestoreWizard() {
    const {
        restoreCurrentStep,
        selectedBackupForRestore,
        restoreValidationResult,
        restoreSelectedItems,
        restoreDecryptionPassword,
        setRestoreCurrentStep,
        restoreNextStep,
        restorePrevStep
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
    }, [restoreCurrentStep])

    const handleNextStep = useCallback(async () => {
        if (restoreCurrentStep === 0) {
            // Select Backup step validation
            if (!selectedBackupForRestore) {
                toast.error('Please select a backup to restore')
                return
            }
            restoreNextStep()
        } else if (restoreCurrentStep === 1) {
            // Validation step validation
            if (restoreValidationResult === null) {
                toast.error('Please validate the backup before proceeding')
                return
            }
            if (restoreValidationResult === false) {
                toast.error('Backup validation failed. Cannot proceed with restore.')
                return
            }
            // Check if backup is encrypted and password is required
            if (selectedBackupForRestore?.encrypted && !restoreDecryptionPassword) {
                toast.error('This backup is encrypted. Please provide the decryption password.')
                return
            }
            restoreNextStep()
        } else if (restoreCurrentStep === 2) {
            // Choose Items step validation
            // Allow proceeding with no items selected (means restore all)
            restoreNextStep()
        } else if (restoreCurrentStep === 3) {
            // Confirm step - no validation required
            restoreNextStep()
        }
    }, [restoreCurrentStep, selectedBackupForRestore, restoreValidationResult, restoreDecryptionPassword, restoreNextStep])

    const progress = ((restoreCurrentStep + 1) / steps.length) * 100

    return (
        <div className="min-h-screen pt-24 pb-28 px-4 sm:px-6 lg:px-8">
            <div className="max-w-5xl mx-auto">
                {/* Header */}
                <div className="text-center mb-12">
                    <motion.div
                        {...fadeInUp}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-amber-500/10 border border-amber-500/30 mb-6"
                    >
                        <AlertTriangle className="w-4 h-4 text-amber-400" />
                        <span className="text-sm text-amber-400">Restore Wizard</span>
                    </motion.div>
                    <motion.h1
                        {...fadeInUp}
                        transition={prefersReducedMotion ? { duration: 0 } : { delay: 0.1 }}
                        className="text-4xl md:text-5xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-amber-400 via-orange-400 to-red-400 mb-4"
                    >
                        Restore from Backup
                    </motion.h1>
                    <motion.p
                        {...fadeInUp}
                        transition={prefersReducedMotion ? { duration: 0 } : { delay: 0.2 }}
                        className="text-lg text-muted-foreground max-w-2xl mx-auto"
                    >
                        Restore your media stack configuration from a previous backup with integrity validation
                    </motion.p>

                    {/* Safety Warning Banner */}
                    <motion.div
                        {...fadeInUp}
                        transition={prefersReducedMotion ? { duration: 0 } : { delay: 0.3 }}
                        className="mt-6 max-w-2xl mx-auto"
                    >
                        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4">
                            <div className="flex items-start gap-3">
                                <AlertTriangle className="w-5 h-5 text-amber-400 mt-0.5 flex-shrink-0" />
                                <div className="text-left">
                                    <h3 className="text-sm font-semibold text-amber-400 mb-1">
                                        Important: Read Before Proceeding
                                    </h3>
                                    <ul className="text-xs text-amber-200/80 space-y-1">
                                        <li>• Restoring will <strong>overwrite</strong> existing configurations</li>
                                        <li>• Services may be stopped during the restore process</li>
                                        <li>• Consider creating a pre-restore backup for safety</li>
                                        <li>• Validate backup integrity before restoring</li>
                                    </ul>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                </div>

                {/* Progress Bar */}
                <div className="mb-8">
                    <div className="h-2 bg-muted/40 rounded-full overflow-hidden">
                        <motion.div
                            className="h-full bg-gradient-to-r from-amber-500 via-orange-500 to-red-500"
                            initial={{ width: 0 }}
                            animate={{ width: `${progress}%` }}
                            transition={{ duration: 0.5, ease: 'easeOut' }}
                        />
                    </div>
                    <p className="text-center mt-2 text-sm text-muted-foreground">
                        Step {restoreCurrentStep + 1} of {steps.length} • {Math.round(progress)}% Complete
                    </p>
                </div>

                {/* Progress Steps - Click to navigate to completed steps */}
                <div className="mb-12">
                    <div className="flex items-center justify-between max-w-3xl mx-auto">
                        {steps.map((step, index) => {
                            const Icon = step.icon
                            const isActive = index === restoreCurrentStep
                            const isComplete = index < restoreCurrentStep
                            const isClickable = isComplete // Can click on completed steps

                            return (
                                <div key={index} className="flex items-center flex-1">
                                    <div className="flex flex-col items-center flex-1">
                                        <motion.button
                                            type="button"
                                            onClick={() => isClickable && setRestoreCurrentStep(index)}
                                            disabled={!isClickable}
                                            className={`w-12 h-12 rounded-full flex items-center justify-center border-2 transition-all ${isActive
                                                ? 'bg-amber-500/20 border-amber-500 text-amber-400 animate-pulse-glow'
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
                                            onClick={() => isClickable && setRestoreCurrentStep(index)}
                                            disabled={!isClickable}
                                            className={`mt-2 text-xs font-medium hidden md:block transition-colors ${isActive ? 'text-amber-400' : isComplete ? 'text-green-300 hover:text-green-200 cursor-pointer' : 'text-muted-foreground cursor-not-allowed'
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
                            {/* Step 0: Select Backup */}
                            {restoreCurrentStep === 0 && (
                                <motion.div
                                    key="select-backup"
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -20 }}
                                    transition={{ duration: 0.3 }}
                                >
                                    <BackupSelector />
                                </motion.div>
                            )}

                            {/* Step 1: Validate Integrity */}
                            {restoreCurrentStep === 1 && (
                                <motion.div
                                    key="validate"
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -20 }}
                                    transition={{ duration: 0.3 }}
                                >
                                    <ValidationStep />
                                </motion.div>
                            )}

                            {/* Step 2: Choose Items */}
                            {restoreCurrentStep === 2 && (
                                <motion.div
                                    key="choose-items"
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -20 }}
                                    transition={{ duration: 0.3 }}
                                >
                                    <div className="text-center py-12">
                                        <ListChecks className="w-16 h-16 text-primary mx-auto mb-4" />
                                        <h2 className="text-2xl font-bold mb-2">Choose Items to Restore</h2>
                                        <p className="text-muted-foreground">
                                            TODO: RestoreSelectionStep component will be implemented in subtask 4.4
                                        </p>
                                        <p className="text-sm text-muted-foreground mt-4">
                                            This step will allow selective restore of specific items
                                        </p>
                                    </div>
                                </motion.div>
                            )}

                            {/* Step 3: Confirm */}
                            {restoreCurrentStep === 3 && (
                                <motion.div
                                    key="confirm"
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -20 }}
                                    transition={{ duration: 0.3 }}
                                >
                                    <div className="text-center py-12">
                                        <AlertTriangle className="w-16 h-16 text-amber-400 mx-auto mb-4" />
                                        <h2 className="text-2xl font-bold mb-2">Confirm Restore</h2>
                                        <p className="text-muted-foreground">
                                            TODO: RestoreConfirmStep component will be implemented in subtask 4.5
                                        </p>
                                        <p className="text-sm text-muted-foreground mt-4">
                                            This step will show warnings and restore options
                                        </p>
                                    </div>
                                </motion.div>
                            )}

                            {/* Step 4: Execute */}
                            {restoreCurrentStep === 4 && (
                                <motion.div
                                    key="execute"
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -20 }}
                                    transition={{ duration: 0.3 }}
                                >
                                    <div className="text-center py-12">
                                        <Play className="w-16 h-16 text-primary mx-auto mb-4" />
                                        <h2 className="text-2xl font-bold mb-2">Execute Restore</h2>
                                        <p className="text-muted-foreground">
                                            TODO: RestoreExecutionStep component will be implemented in subtask 4.6
                                        </p>
                                        <p className="text-sm text-muted-foreground mt-4">
                                            This step will show real-time restore progress
                                        </p>
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
                            onClick={restorePrevStep}
                            variant="glass"
                            className="btn-lift px-6 py-3"
                            disabled={restoreCurrentStep === 0}
                        >
                            <ArrowLeft className="w-4 h-4" />
                            Back
                        </Button>

                        {restoreCurrentStep < 4 && (
                            <Button
                                type="button"
                                onClick={handleNextStep}
                                variant="gradient"
                                className="btn-lift px-6 py-3"
                            >
                                Next
                                <ArrowRight className="w-4 h-4" />
                            </Button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}
