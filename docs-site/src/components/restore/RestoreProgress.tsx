import { motion } from 'motion/react'
import {
    CheckCircle2,
    Database,
    FileCheck,
    Loader2,
    Timer,
    TrendingUp,
    XCircle
} from 'lucide-react'
import { InteractiveCard } from '../ui/interactive-card'
import type { RestoreProgress as RestoreProgressType } from '../../store/backupStore'

/**
 * RestoreProgress Component
 *
 * Displays real-time restore progress with animated progress bar, current operation label,
 * file counts, size transferred, speed indicator, and ETA. Shows stopping services,
 * extracting files, applying configs, and restarting services phases.
 *
 * Used in RestoreConfirmStep and can be reused in RestoreDashboard or other components
 * that need to display ongoing restore progress.
 */

// Utility function to format bytes to human-readable sizes
function formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`
}

// Utility function to format transfer speed
function formatSpeed(bytesPerSecond: number | undefined): string {
    if (!bytesPerSecond || bytesPerSecond === 0) return '0 B/s'
    return `${formatBytes(bytesPerSecond)}/s`
}

// Utility function to format estimated time remaining
function formatETA(estimatedCompletionAt: string | undefined, startedAt: string): string {
    if (!estimatedCompletionAt) return 'Calculating...'

    const now = new Date()
    const completion = new Date(estimatedCompletionAt)
    const diffMs = completion.getTime() - now.getTime()

    if (diffMs <= 0) return 'Almost done...'

    const diffSeconds = Math.floor(diffMs / 1000)
    const diffMinutes = Math.floor(diffSeconds / 60)
    const diffHours = Math.floor(diffMinutes / 60)

    if (diffHours > 0) {
        return `~${diffHours}h ${diffMinutes % 60}m remaining`
    } else if (diffMinutes > 0) {
        return `~${diffMinutes}m ${diffSeconds % 60}s remaining`
    } else {
        return `~${diffSeconds}s remaining`
    }
}

interface RestoreProgressProps {
    /** Restore progress data from the API */
    progress: RestoreProgressType | null
    /** Optional loading state when waiting for initial progress */
    loading?: boolean
    /** Optional custom loading message */
    loadingMessage?: string
}

export function RestoreProgress({
    progress,
    loading = false,
    loadingMessage = 'Initializing restore...'
}: RestoreProgressProps) {
    // Calculate progress percentage
    const progressPercentage = progress
        ? Math.round((progress.bytesProcessed / progress.bytesTotal) * 100)
        : 0

    // Loading state when waiting for progress
    if (loading || !progress) {
        return (
            <div className="text-center py-12">
                <Loader2 className="w-12 h-12 mx-auto mb-4 text-primary animate-spin" />
                <p className="text-muted-foreground">{loadingMessage}</p>
            </div>
        )
    }

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="space-y-6"
        >
            {/* Overall Progress Bar */}
            <div>
                <div className="flex items-center justify-between mb-3">
                    <h3 className="text-lg font-semibold text-foreground">Restore Progress</h3>
                    <span className="text-2xl font-bold text-primary">
                        {progressPercentage}%
                    </span>
                </div>
                <div className="h-3 bg-muted/40 rounded-full overflow-hidden border border-border/40">
                    <motion.div
                        className="h-full bg-gradient-to-r from-amber-500 via-orange-500 to-red-500"
                        initial={{ width: 0 }}
                        animate={{ width: `${progressPercentage}%` }}
                        transition={{ duration: 0.5, ease: 'easeOut' }}
                    />
                </div>
                <p className="text-xs text-muted-foreground mt-2 text-center">
                    {formatBytes(progress.bytesProcessed)} / {formatBytes(progress.bytesTotal)}
                </p>
            </div>

            {/* Status Badge */}
            <div className="flex justify-center">
                <div
                    className={`inline-flex items-center gap-2 px-4 py-2 rounded-full border-2 ${
                        progress.status === 'completed'
                            ? 'bg-green-500/10 border-green-500/40 text-green-300'
                            : progress.status === 'failed'
                                ? 'bg-red-500/10 border-red-500/40 text-red-300'
                                : 'bg-primary/10 border-primary/40 text-primary'
                    }`}
                >
                    {progress.status === 'completed' ? (
                        <CheckCircle2 className="w-5 h-5" />
                    ) : progress.status === 'failed' ? (
                        <XCircle className="w-5 h-5" />
                    ) : (
                        <Loader2 className="w-5 h-5 animate-spin" />
                    )}
                    <span className="font-semibold capitalize">
                        {progress.status.replace(/([A-Z])/g, ' $1').trim()}
                    </span>
                </div>
            </div>

            {/* Current Operation */}
            <InteractiveCard>
                <div className="flex items-start gap-4">
                    <FileCheck className="w-6 h-6 text-primary mt-1 flex-shrink-0" />
                    <div className="flex-1">
                        <h3 className="text-sm font-semibold text-muted-foreground mb-1">Current Operation</h3>
                        <p className="text-lg text-foreground font-medium">
                            {progress.currentOperation}
                        </p>
                        {progress.currentItem && (
                            <p className="text-sm text-muted-foreground mt-1 truncate">
                                {progress.currentItem}
                            </p>
                        )}
                    </div>
                </div>
            </InteractiveCard>

            {/* Progress Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* Items Progress */}
                <InteractiveCard>
                    <div className="text-center">
                        <Database className="w-8 h-8 text-primary mx-auto mb-2" />
                        <div className="text-2xl font-bold text-foreground">
                            {progress.itemsProcessed}/{progress.itemsTotal}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                            Items Processed
                        </div>
                    </div>
                </InteractiveCard>

                {/* Transfer Speed */}
                <InteractiveCard>
                    <div className="text-center">
                        <TrendingUp className="w-8 h-8 text-primary mx-auto mb-2" />
                        <div className="text-2xl font-bold text-foreground">
                            {formatSpeed(progress.transferSpeed)}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                            Transfer Speed
                        </div>
                    </div>
                </InteractiveCard>

                {/* ETA */}
                <InteractiveCard>
                    <div className="text-center">
                        <Timer className="w-8 h-8 text-primary mx-auto mb-2" />
                        <div className="text-lg font-bold text-foreground">
                            {formatETA(progress.estimatedCompletionAt, progress.startedAt)}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                            Estimated Time
                        </div>
                    </div>
                </InteractiveCard>
            </div>

            {/* Completion Message */}
            {progress.status === 'completed' && (
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-5 bg-green-500/10 border-2 border-green-500/40 rounded-xl"
                >
                    <div className="flex gap-3">
                        <CheckCircle2 className="w-6 h-6 text-green-400 flex-shrink-0 mt-0.5" />
                        <div className="flex-1">
                            <h3 className="text-lg font-semibold text-green-300 mb-2">
                                Restore Completed Successfully!
                            </h3>
                            <p className="text-sm text-green-200/90">
                                Your backup has been restored successfully. All {progress.itemsTotal} items have been processed. Services have been restarted and should be available now.
                            </p>
                        </div>
                    </div>
                </motion.div>
            )}

            {/* Error Message */}
            {progress.status === 'failed' && progress.error && (
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-5 bg-red-500/10 border-2 border-red-500/40 rounded-xl"
                >
                    <div className="flex gap-3">
                        <XCircle className="w-6 h-6 text-red-400 flex-shrink-0 mt-0.5" />
                        <div className="flex-1">
                            <h3 className="text-lg font-semibold text-red-300 mb-2">
                                Restore Failed
                            </h3>
                            <p className="text-sm text-red-200/90 font-mono">
                                {progress.error}
                            </p>
                        </div>
                    </div>
                </motion.div>
            )}
        </motion.div>
    )
}
