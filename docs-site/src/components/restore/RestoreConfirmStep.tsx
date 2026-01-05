import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import {
    AlertTriangle,
    CheckCircle2,
    XCircle,
    Shield,
    Database,
    Power,
    Clock,
    Info,
    Loader2,
    TrendingUp,
    Timer,
    HardDrive,
    Cloud,
    FolderSync,
} from 'lucide-react'
import { useBackupStore } from '../../store/backupStore'
import { useRestoreExecute, useRestoreProgress, type RestoreConfig } from '../../hooks/useBackup'
import { InteractiveCard } from '../ui/interactive-card'
import { Button } from '../ui/button'
import { toast } from 'sonner'

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
    if (!bytesPerSecond) return 'Calculating...'
    return `${formatBytes(bytesPerSecond)}/s`
}

// Utility function to format estimated time remaining
function formatETA(estimatedCompletionAt: string | undefined, startedAt: string): string {
    if (!estimatedCompletionAt) return 'Calculating...'

    const now = new Date()
    const eta = new Date(estimatedCompletionAt)
    const started = new Date(startedAt)
    const totalSeconds = Math.floor((eta.getTime() - now.getTime()) / 1000)

    if (totalSeconds <= 0) return 'Almost done...'

    const hours = Math.floor(totalSeconds / 3600)
    const minutes = Math.floor((totalSeconds % 3600) / 60)
    const seconds = totalSeconds % 60

    if (hours > 0) {
        return `~${hours}h ${minutes}m`
    } else if (minutes > 0) {
        return `~${minutes}m ${seconds}s`
    } else {
        return `~${seconds}s`
    }
}

// Get icon for destination type
function getDestinationIcon(type: string) {
    switch (type) {
        case 'local':
            return HardDrive
        case 's3':
            return Cloud
        case 'rclone':
            return FolderSync
        default:
            return Database
    }
}

export function RestoreConfirmStep() {
    const {
        selectedBackupForRestore,
        restorePreviewData,
        restoreSelectedItems,
        restoreOptions,
        restoreDecryptionPassword,
        destination,
        setRestoreOptions,
        setActiveRestoreProgress,
    } = useBackupStore()

    const { executeRestore, loading: executingRestore } = useRestoreExecute()
    const { progress, startPolling, stopPolling, isPolling } = useRestoreProgress()

    const [restoreStarted, setRestoreStarted] = useState(false)
    const [restoreId, setRestoreId] = useState<string | null>(null)

    // Update store when progress changes
    useEffect(() => {
        if (progress) {
            setActiveRestoreProgress(progress)
        }
    }, [progress, setActiveRestoreProgress])

    // Cleanup polling on unmount
    useEffect(() => {
        return () => {
            stopPolling()
        }
    }, [stopPolling])

    const handleStartRestore = async () => {
        if (!selectedBackupForRestore) {
            toast.error('No backup selected')
            return
        }

        if (!destination) {
            toast.error('No destination configured')
            return
        }

        if (!restorePreviewData) {
            toast.error('Backup not validated')
            return
        }

        try {
            // Build restore config
            const config: RestoreConfig = {
                backupId: selectedBackupForRestore.id,
                destination,
                items: restoreSelectedItems.length > 0 ? restoreSelectedItems : undefined,
                decryptionPassword: restoreDecryptionPassword || undefined,
                stopServices: restoreOptions.stopServices,
                createPreRestoreBackup: restoreOptions.createPreRestoreBackup,
            }

            // Start restore
            const result = await executeRestore(config)
            setRestoreId(result.restoreId)
            setRestoreStarted(true)

            // Start polling for progress
            startPolling(result.restoreId, 1000) // Poll every second

            toast.success('Restore started successfully')
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Failed to start restore')
        }
    }

    // Calculate progress percentage
    const progressPercentage = progress?.bytesTotal
        ? Math.round((progress.bytesProcessed / progress.bytesTotal) * 100)
        : 0

    // Determine if restore is complete or failed
    const isComplete = progress?.status === 'completed'
    const isFailed = progress?.status === 'failed'

    if (!selectedBackupForRestore || !restorePreviewData) {
        return (
            <div className="text-center py-12">
                <Info className="w-16 h-16 text-amber-400 mx-auto mb-4" />
                <h2 className="text-2xl font-bold mb-2">No Backup Selected</h2>
                <p className="text-muted-foreground">
                    Please go back and select a backup first.
                </p>
            </div>
        )
    }

    // Determine what's being restored
    const itemsToRestore = restoreSelectedItems.length > 0
        ? restorePreviewData.items.filter(item => restoreSelectedItems.includes(item.name))
        : restorePreviewData.items
    const totalItems = itemsToRestore.length
    const totalSize = itemsToRestore.reduce((sum, item) => sum + item.size, 0)

    return (
        <div className="space-y-6">
            <AnimatePresence mode="wait">
                {!restoreStarted ? (
                    // Configuration Summary Phase
                    <motion.div
                        key="summary"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        transition={{ duration: 0.3 }}
                        className="space-y-6"
                    >
                        {/* Header */}
                        <div className="text-center">
                            <AlertTriangle className="w-12 h-12 text-amber-400 mx-auto mb-4" />
                            <h2 className="text-3xl font-bold mb-2">Confirm Restore</h2>
                            <p className="text-muted-foreground">
                                Review the restore settings and start the restoration process
                            </p>
                        </div>

                        {/* Critical Warning Banner */}
                        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4">
                            <div className="flex items-start gap-3">
                                <AlertTriangle className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0" />
                                <div className="text-left">
                                    <h3 className="text-sm font-semibold text-red-400 mb-2">
                                        ⚠️ Critical Warning: Service Interruption Expected
                                    </h3>
                                    <ul className="text-xs text-red-200/80 space-y-1.5">
                                        <li>• Restoring will <strong>OVERWRITE</strong> all existing configurations and data</li>
                                        <li>• Services will be <strong>STOPPED</strong> during the restore process (if enabled)</li>
                                        <li>• Database connections will be <strong>INTERRUPTED</strong></li>
                                        <li>• Your media stack may be <strong>UNAVAILABLE</strong> for several minutes</li>
                                        <li>• This action <strong>CANNOT BE UNDONE</strong> without another backup</li>
                                    </ul>
                                </div>
                            </div>
                        </div>

                        {/* Restore Options */}
                        <InteractiveCard className="p-6">
                            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                                <Power className="w-5 h-5 text-primary" />
                                Restore Options
                            </h3>

                            <div className="space-y-4">
                                {/* Stop Services Option */}
                                <label className="flex items-start gap-3 cursor-pointer group">
                                    <input
                                        type="checkbox"
                                        checked={restoreOptions.stopServices}
                                        onChange={(e) => setRestoreOptions({
                                            ...restoreOptions,
                                            stopServices: e.target.checked
                                        })}
                                        className="mt-1 w-5 h-5 rounded border-2 border-border bg-background/50 text-primary focus:ring-2 focus:ring-primary/50 cursor-pointer"
                                    />
                                    <div className="flex-1">
                                        <div className="text-sm font-medium group-hover:text-primary transition-colors">
                                            Stop services before restore
                                        </div>
                                        <div className="text-xs text-muted-foreground mt-1">
                                            Recommended: Stops all affected services to prevent data corruption during restore.
                                            Services will automatically restart after restore completes.
                                        </div>
                                    </div>
                                </label>

                                {/* Create Pre-Restore Backup Option */}
                                <label className="flex items-start gap-3 cursor-pointer group">
                                    <input
                                        type="checkbox"
                                        checked={restoreOptions.createPreRestoreBackup}
                                        onChange={(e) => setRestoreOptions({
                                            ...restoreOptions,
                                            createPreRestoreBackup: e.target.checked
                                        })}
                                        className="mt-1 w-5 h-5 rounded border-2 border-border bg-background/50 text-primary focus:ring-2 focus:ring-primary/50 cursor-pointer"
                                    />
                                    <div className="flex-1">
                                        <div className="text-sm font-medium group-hover:text-primary transition-colors">
                                            Backup current state before restore
                                        </div>
                                        <div className="text-xs text-muted-foreground mt-1">
                                            Highly recommended: Creates a safety backup of your current configuration before restoring.
                                            This allows you to rollback if something goes wrong.
                                        </div>
                                    </div>
                                </label>
                            </div>

                            {/* Recommendations */}
                            <div className="mt-4 pt-4 border-t border-border/50">
                                <div className="flex items-start gap-2 text-xs text-cyan-400">
                                    <Info className="w-4 h-4 mt-0.5 flex-shrink-0" />
                                    <div>
                                        <strong>Best Practice:</strong> Keep both options enabled for maximum safety.
                                        The pre-restore backup acts as a safety net in case of restore failures.
                                    </div>
                                </div>
                            </div>
                        </InteractiveCard>

                        {/* Restore Summary */}
                        <InteractiveCard className="p-6">
                            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                                <Database className="w-5 h-5 text-primary" />
                                What Will Be Restored
                            </h3>

                            <div className="space-y-3">
                                {/* Backup Info */}
                                <div className="flex items-center justify-between text-sm">
                                    <span className="text-muted-foreground">Backup:</span>
                                    <span className="font-mono text-xs">{selectedBackupForRestore.id}</span>
                                </div>

                                <div className="flex items-center justify-between text-sm">
                                    <span className="text-muted-foreground">Created:</span>
                                    <span>{new Date(selectedBackupForRestore.createdAt).toLocaleString()}</span>
                                </div>

                                <div className="flex items-center justify-between text-sm">
                                    <span className="text-muted-foreground">Items:</span>
                                    <span className="font-semibold">{totalItems} item{totalItems !== 1 ? 's' : ''}</span>
                                </div>

                                <div className="flex items-center justify-between text-sm">
                                    <span className="text-muted-foreground">Total Size:</span>
                                    <span className="font-semibold">{formatBytes(totalSize)}</span>
                                </div>

                                <div className="flex items-center justify-between text-sm">
                                    <span className="text-muted-foreground">Restore Mode:</span>
                                    <span className="font-semibold text-primary">
                                        {restoreSelectedItems.length === 0 ? 'Full Restore' : 'Selective Restore'}
                                    </span>
                                </div>

                                {selectedBackupForRestore.encrypted && (
                                    <div className="flex items-center justify-between text-sm">
                                        <span className="text-muted-foreground">Encryption:</span>
                                        <div className="flex items-center gap-1.5 text-green-400">
                                            <Shield className="w-4 h-4" />
                                            <span className="font-semibold">Encrypted (AES-256-GCM)</span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </InteractiveCard>

                        {/* Affected Services Info */}
                        {restoreOptions.stopServices && (
                            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4">
                                <div className="flex items-start gap-3">
                                    <Clock className="w-5 h-5 text-amber-400 mt-0.5 flex-shrink-0" />
                                    <div className="text-left">
                                        <h3 className="text-sm font-semibold text-amber-400 mb-1">
                                            Expected Downtime
                                        </h3>
                                        <p className="text-xs text-amber-200/80">
                                            Services will be stopped during restore and automatically restarted afterwards.
                                            Expect {Math.ceil(totalSize / (10 * 1024 * 1024))} - {Math.ceil(totalSize / (5 * 1024 * 1024))} minutes of downtime depending on system performance.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Execute Button */}
                        <div className="flex justify-center pt-4">
                            <Button
                                type="button"
                                onClick={handleStartRestore}
                                disabled={executingRestore}
                                variant="gradient"
                                className="btn-lift px-8 py-4 text-lg bg-gradient-to-r from-amber-500 via-orange-500 to-red-500 hover:from-amber-600 hover:via-orange-600 hover:to-red-600"
                            >
                                {executingRestore ? (
                                    <>
                                        <Loader2 className="w-5 h-5 animate-spin" />
                                        Starting Restore...
                                    </>
                                ) : (
                                    <>
                                        <Database className="w-5 h-5" />
                                        Execute Restore
                                    </>
                                )}
                            </Button>
                        </div>

                        {/* Final Warning */}
                        <div className="text-center text-xs text-muted-foreground">
                            <p>By clicking "Execute Restore", you confirm that you understand the risks</p>
                            <p>and have verified that this is the correct backup to restore.</p>
                        </div>
                    </motion.div>
                ) : (
                    // Progress Display Phase
                    <motion.div
                        key="progress"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        transition={{ duration: 0.3 }}
                        className="space-y-6"
                    >
                        {/* Header */}
                        <div className="text-center">
                            <Database className="w-12 h-12 text-primary mx-auto mb-4" />
                            <h2 className="text-3xl font-bold mb-2">Restore In Progress</h2>
                            <p className="text-muted-foreground">
                                Please wait while your backup is being restored
                            </p>
                        </div>

                        {progress ? (
                            <>
                                {/* Overall Progress Bar */}
                                <div>
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-sm font-medium">Overall Progress</span>
                                        <span className="text-sm font-mono font-semibold text-primary">
                                            {progressPercentage}%
                                        </span>
                                    </div>
                                    <div className="h-3 bg-muted/40 rounded-full overflow-hidden">
                                        <motion.div
                                            className="h-full bg-gradient-to-r from-amber-500 via-orange-500 to-red-500"
                                            initial={{ width: 0 }}
                                            animate={{ width: `${progressPercentage}%` }}
                                            transition={{ duration: 0.5, ease: 'easeOut' }}
                                        />
                                    </div>
                                    <p className="text-xs text-muted-foreground mt-1 text-center">
                                        {formatBytes(progress.bytesProcessed)} / {formatBytes(progress.bytesTotal)}
                                    </p>
                                </div>

                                {/* Status Badge */}
                                <div className="flex justify-center">
                                    <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full border ${
                                        isComplete
                                            ? 'bg-green-500/20 border-green-500 text-green-300'
                                            : isFailed
                                            ? 'bg-red-500/20 border-red-500 text-red-300'
                                            : 'bg-primary/20 border-primary text-primary'
                                    }`}>
                                        {isComplete ? (
                                            <CheckCircle2 className="w-4 h-4" />
                                        ) : isFailed ? (
                                            <XCircle className="w-4 h-4" />
                                        ) : (
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                        )}
                                        <span className="text-sm font-semibold capitalize">{progress.status}</span>
                                    </div>
                                </div>

                                {/* Current Operation */}
                                <InteractiveCard className="p-4">
                                    <div className="text-sm text-muted-foreground mb-1">Current Operation</div>
                                    <div className="text-lg font-semibold">{progress.currentOperation}</div>
                                    {progress.currentItem && (
                                        <div className="text-sm text-muted-foreground mt-2 font-mono truncate">
                                            {progress.currentItem}
                                        </div>
                                    )}
                                </InteractiveCard>

                                {/* Progress Stats */}
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    {/* Items Processed */}
                                    <InteractiveCard className="p-4">
                                        <div className="flex items-center gap-3">
                                            <Database className="w-8 h-8 text-primary" />
                                            <div className="flex-1">
                                                <div className="text-xs text-muted-foreground">Items Processed</div>
                                                <div className="text-xl font-bold">
                                                    {progress.itemsProcessed}/{progress.itemsTotal}
                                                </div>
                                            </div>
                                        </div>
                                    </InteractiveCard>

                                    {/* Transfer Speed */}
                                    <InteractiveCard className="p-4">
                                        <div className="flex items-center gap-3">
                                            <TrendingUp className="w-8 h-8 text-primary" />
                                            <div className="flex-1">
                                                <div className="text-xs text-muted-foreground">Transfer Speed</div>
                                                <div className="text-xl font-bold">
                                                    {formatSpeed(progress.transferSpeed)}
                                                </div>
                                            </div>
                                        </div>
                                    </InteractiveCard>

                                    {/* Estimated Time */}
                                    <InteractiveCard className="p-4">
                                        <div className="flex items-center gap-3">
                                            <Timer className="w-8 h-8 text-primary" />
                                            <div className="flex-1">
                                                <div className="text-xs text-muted-foreground">Estimated Time</div>
                                                <div className="text-xl font-bold">
                                                    {formatETA(progress.estimatedCompletionAt, progress.startedAt)}
                                                </div>
                                            </div>
                                        </div>
                                    </InteractiveCard>
                                </div>

                                {/* Success Banner */}
                                {isComplete && (
                                    <motion.div
                                        initial={{ opacity: 0, scale: 0.95 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        className="rounded-lg border border-green-500/30 bg-green-500/10 p-4"
                                    >
                                        <div className="flex items-center gap-3">
                                            <CheckCircle2 className="w-6 h-6 text-green-400 flex-shrink-0" />
                                            <div>
                                                <h3 className="text-sm font-semibold text-green-400">
                                                    Restore Completed Successfully!
                                                </h3>
                                                <p className="text-xs text-green-200/80 mt-1">
                                                    Successfully restored {progress.itemsProcessed} item{progress.itemsProcessed !== 1 ? 's' : ''}
                                                    {' '}({formatBytes(progress.bytesProcessed)})
                                                </p>
                                            </div>
                                        </div>
                                    </motion.div>
                                )}

                                {/* Error Banner */}
                                {isFailed && progress.error && (
                                    <motion.div
                                        initial={{ opacity: 0, scale: 0.95 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        className="rounded-lg border border-red-500/30 bg-red-500/10 p-4"
                                    >
                                        <div className="flex items-start gap-3">
                                            <XCircle className="w-6 h-6 text-red-400 flex-shrink-0 mt-0.5" />
                                            <div className="flex-1">
                                                <h3 className="text-sm font-semibold text-red-400">
                                                    Restore Failed
                                                </h3>
                                                <p className="text-xs text-red-200/80 mt-1 font-mono">
                                                    {progress.error}
                                                </p>
                                            </div>
                                        </div>
                                    </motion.div>
                                )}
                            </>
                        ) : (
                            // Loading state
                            <div className="flex flex-col items-center justify-center py-12">
                                <Loader2 className="w-12 h-12 animate-spin text-primary mb-4" />
                                <p className="text-sm text-muted-foreground">Initializing restore...</p>
                            </div>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}
