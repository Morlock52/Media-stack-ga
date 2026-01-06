import { motion, AnimatePresence } from 'motion/react'
import { Save, RotateCcw } from 'lucide-react'
import { Button } from '../ui/button'

interface DraftRecoveryModalProps {
    isOpen: boolean
    draftInfo: { savedAt: number; serviceCount: number } | null
    onRestore: () => void
    onDismiss: () => void
}

/**
 * Modal that prompts users to restore an auto-saved draft configuration.
 * Appears when the wizard detects an unsaved configuration from a previous session.
 */
export function DraftRecoveryModal({
    isOpen,
    draftInfo,
    onRestore,
    onDismiss
}: DraftRecoveryModalProps) {
    return (
        <AnimatePresence>
            {isOpen && draftInfo && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm"
                >
                    <motion.div
                        initial={{ scale: 0.9, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.9, opacity: 0 }}
                        className="bg-card border border-border rounded-2xl shadow-2xl max-w-md w-full p-6"
                    >
                        <div className="flex items-start gap-4">
                            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                                <Save className="w-6 h-6 text-primary" />
                            </div>
                            <div className="flex-1">
                                <h3 className="text-lg font-semibold text-foreground mb-1">
                                    Resume Your Setup?
                                </h3>
                                <p className="text-sm text-muted-foreground mb-4">
                                    We found an unsaved configuration from{' '}
                                    {new Date(draftInfo.savedAt).toLocaleDateString(undefined, {
                                        month: 'short',
                                        day: 'numeric',
                                        hour: 'numeric',
                                        minute: '2-digit'
                                    })}
                                    {draftInfo.serviceCount > 0 && (
                                        <> with <strong>{draftInfo.serviceCount} services</strong> selected</>
                                    )}.
                                </p>
                                <div className="flex gap-2">
                                    <Button
                                        onClick={onRestore}
                                        className="flex-1"
                                    >
                                        <RotateCcw className="w-4 h-4 mr-2" />
                                        Resume
                                    </Button>
                                    <Button
                                        variant="outline"
                                        onClick={onDismiss}
                                        className="flex-1"
                                    >
                                        Start Fresh
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    )
}
