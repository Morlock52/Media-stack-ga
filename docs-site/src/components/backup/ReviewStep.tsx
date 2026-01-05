import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import {
    CheckCircle2,
    Database,
    HardDrive,
    Shield,
    Clock,
    AlertCircle,
    Loader2,
    FolderSync,
    Cloud,
    FileCheck,
    Gauge,
    Timer,
    TrendingUp,
    XCircle
} from 'lucide-react'
import { useBackupStore } from '../../store/backupStore'
import { useBackupCreate, useBackupProgress, type BackupConfig } from '../../hooks/useBackup'
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

// Utility function to get destination display name
function getDestinationName(destination: BackupConfig['destination']): string {
    switch (destination.type) {
        case 'local':
            return `Local: ${destination.path}`
        case 's3':
            return `S3: ${destination.bucket}`
        case 'rclone':
            return `Rclone: ${destination.remoteName}:${destination.remotePath}`
        default:
            return 'Unknown'
    }
}

// Utility function to get destination icon
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

export function ReviewStep() {
    const {
        destination,
        selectedItems,
        encryption,
        schedule,
        backupName,
        setActiveBackupProgress,
    } = useBackupStore()

    const { createBackup, loading: creatingBackup } = useBackupCreate()
    const { progress, startPolling, stopPolling, isPolling } = useBackupProgress()

    const [backupStarted, setBackupStarted] = useState(false)
    const [backupId, setBackupId] = useState<string | null>(null)

    // Calculate total size of selected items
    const totalSize = selectedItems.reduce((sum, item) => sum + (item.estimatedSize || 0), 0)

    // Update store when progress changes
    useEffect(() => {
        if (progress) {
            setActiveBackupProgress(progress)
        }
    }, [progress, setActiveBackupProgress])

    // Cleanup polling on unmount
    useEffect(() => {
        return () => {
            stopPolling()
        }
    }, [stopPolling])

    const handleStartBackup = async () => {
        if (!destination) {
            toast.error('No destination configured')
            return
        }

        if (selectedItems.length === 0) {
            toast.error('No items selected for backup')
            return
        }

        try {
            setBackupStarted(true)

            const config: BackupConfig = {
                destination,
                items: selectedItems,
                encryption: {
                    enabled: encryption.enabled,
                    password: encryption.password,
                },
                name: backupName || undefined,
                schedule: schedule ? {
                    enabled: schedule.enabled,
                    frequency: schedule.frequency,
                    time: schedule.time,
                    retentionCount: schedule.retentionCount,
                } : undefined,
            }

            const result = await createBackup(config)
            setBackupId(result.backupId)

            toast.success('Backup started successfully')

            // Start polling for progress
            startPolling(result.backupId, 1000)
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error'
            toast.error(`Failed to start backup: ${errorMessage}`)
            setBackupStarted(false)
        }
    }

    // Calculate progress percentage
    const progressPercentage = progress
        ? Math.round((progress.bytesProcessed / progress.bytesTotal) * 100)
        : 0

    return (
        <motion.div
            key="review"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-6"
        >
            <div className="mb-6">
                <h2 className="text-2xl font-bold text-foreground mb-2">Review & Execute</h2>
                <p className="text-muted-foreground">
                    {backupStarted
                        ? 'Your backup is in progress. Please wait while we secure your data.'
                        : 'Review your backup configuration and start the backup process.'}
                </p>
            </div>

            <AnimatePresence mode="wait">
                {!backupStarted ? (
                    /* Configuration Summary */
                    <motion.div
                        key="summary"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="space-y-4"
                    >
                        {/* Destination Summary */}
                        <InteractiveCard>
                            <div className="flex items-start gap-4">
                                {destination && (() => {
                                    const Icon = getDestinationIcon(destination.type)
                                    return <Icon className="w-6 h-6 text-primary mt-1 flex-shrink-0" />
                                })()}
                                <div className="flex-1">
                                    <h3 className="text-lg font-semibold text-foreground mb-1">Backup Destination</h3>
                                    <p className="text-sm text-muted-foreground mb-2">
                                        {destination ? getDestinationName(destination) : 'Not configured'}
                                    </p>
                                    {destination?.type === 's3' && (
                                        <div className="text-xs text-muted-foreground space-y-1">
                                            <p>Endpoint: {destination.endpoint}</p>
                                            <p>Region: {destination.region || 'auto'}</p>
                                            {destination.pathPrefix && <p>Prefix: {destination.pathPrefix}</p>}
                                        </div>
                                    )}
                                </div>
                                <CheckCircle2 className="w-5 h-5 text-green-400" />
                            </div>
                        </InteractiveCard>

                        {/* Selected Items Summary */}
                        <InteractiveCard>
                            <div className="flex items-start gap-4">
                                <Database className="w-6 h-6 text-primary mt-1 flex-shrink-0" />
                                <div className="flex-1">
                                    <h3 className="text-lg font-semibold text-foreground mb-1">Backup Items</h3>
                                    <p className="text-sm text-muted-foreground mb-2">
                                        {selectedItems.length} item{selectedItems.length !== 1 ? 's' : ''} selected • {formatBytes(totalSize)} total
                                    </p>
                                    <div className="mt-3 max-h-48 overflow-y-auto space-y-1">
                                        {selectedItems.map((item, index) => (
                                            <div
                                                key={index}
                                                className="flex items-center gap-2 text-xs text-muted-foreground py-1 px-2 bg-muted/20 rounded border border-border/40"
                                            >
                                                <CheckCircle2 className="w-3 h-3 text-green-400 flex-shrink-0" />
                                                <span className="flex-1 truncate">
                                                    {item.service && <strong className="text-foreground">{item.service}:</strong>} {item.name}
                                                </span>
                                                <span className="text-muted-foreground/70">
                                                    {formatBytes(item.estimatedSize || 0)}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                <CheckCircle2 className="w-5 h-5 text-green-400" />
                            </div>
                        </InteractiveCard>

                        {/* Encryption Summary */}
                        <InteractiveCard>
                            <div className="flex items-start gap-4">
                                <Shield className="w-6 h-6 text-primary mt-1 flex-shrink-0" />
                                <div className="flex-1">
                                    <h3 className="text-lg font-semibold text-foreground mb-1">Encryption</h3>
                                    <p className="text-sm text-muted-foreground">
                                        {encryption.enabled ? (
                                            <>
                                                <span className="text-green-400 font-semibold">Enabled</span> — Backup will be encrypted with AES-256-GCM
                                            </>
                                        ) : (
                                            <>
                                                <span className="text-muted-foreground font-semibold">Disabled</span> — Backup will be stored without encryption
                                            </>
                                        )}
                                    </p>
                                </div>
                                {encryption.enabled ? (
                                    <CheckCircle2 className="w-5 h-5 text-green-400" />
                                ) : (
                                    <AlertCircle className="w-5 h-5 text-amber-400" />
                                )}
                            </div>
                        </InteractiveCard>

                        {/* Schedule Summary */}
                        <InteractiveCard>
                            <div className="flex items-start gap-4">
                                <Clock className="w-6 h-6 text-primary mt-1 flex-shrink-0" />
                                <div className="flex-1">
                                    <h3 className="text-lg font-semibold text-foreground mb-1">Backup Schedule</h3>
                                    <p className="text-sm text-muted-foreground">
                                        {schedule?.enabled ? (
                                            <>
                                                <span className="text-green-400 font-semibold capitalize">{schedule.frequency}</span> backups at {schedule.time}
                                                <span className="ml-2">• Keep {schedule.retentionCount} backup{schedule.retentionCount !== 1 ? 's' : ''}</span>
                                            </>
                                        ) : (
                                            <>
                                                <span className="text-muted-foreground font-semibold">Disabled</span> — One-time manual backup
                                            </>
                                        )}
                                    </p>
                                </div>
                                {schedule?.enabled ? (
                                    <CheckCircle2 className="w-5 h-5 text-green-400" />
                                ) : (
                                    <AlertCircle className="w-5 h-5 text-muted-foreground" />
                                )}
                            </div>
                        </InteractiveCard>

                        {/* Backup Name (if provided) */}
                        {backupName && (
                            <InteractiveCard>
                                <div className="flex items-start gap-4">
                                    <FileCheck className="w-6 h-6 text-primary mt-1 flex-shrink-0" />
                                    <div className="flex-1">
                                        <h3 className="text-lg font-semibold text-foreground mb-1">Backup Name</h3>
                                        <p className="text-sm text-muted-foreground">
                                            {backupName}
                                        </p>
                                    </div>
                                    <CheckCircle2 className="w-5 h-5 text-green-400" />
                                </div>
                            </InteractiveCard>
                        )}

                        {/* Start Backup Button */}
                        <div className="pt-6">
                            <Button
                                onClick={handleStartBackup}
                                disabled={creatingBackup}
                                variant="gradient"
                                className="w-full btn-lift py-6 text-lg"
                            >
                                {creatingBackup ? (
                                    <>
                                        <Loader2 className="w-5 h-5 animate-spin" />
                                        Starting Backup...
                                    </>
                                ) : (
                                    <>
                                        <Database className="w-5 h-5" />
                                        Start Backup
                                    </>
                                )}
                            </Button>
                        </div>
                    </motion.div>
                ) : (
                    /* Backup Progress */
                    <motion.div
                        key="progress"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="space-y-6"
                    >
                        {progress && (
                            <>
                                {/* Overall Progress Bar */}
                                <div>
                                    <div className="flex items-center justify-between mb-3">
                                        <h3 className="text-lg font-semibold text-foreground">Backup Progress</h3>
                                        <span className="text-2xl font-bold text-primary">
                                            {progressPercentage}%
                                        </span>
                                    </div>
                                    <div className="h-3 bg-muted/40 rounded-full overflow-hidden border border-border/40">
                                        <motion.div
                                            className="progress-bar h-full"
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
                                        className={`inline-flex items-center gap-2 px-4 py-2 rounded-full border-2 ${progress.status === 'completed'
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
                                                    Backup Completed Successfully!
                                                </h3>
                                                <p className="text-sm text-green-200/90">
                                                    Your backup has been created and uploaded to the destination. All {progress.itemsTotal} items have been processed successfully.
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
                                                    Backup Failed
                                                </h3>
                                                <p className="text-sm text-red-200/90 font-mono">
                                                    {progress.error}
                                                </p>
                                            </div>
                                        </div>
                                    </motion.div>
                                )}
                            </>
                        )}

                        {/* Loading state when waiting for progress */}
                        {!progress && (
                            <div className="text-center py-12">
                                <Loader2 className="w-12 h-12 mx-auto mb-4 text-primary animate-spin" />
                                <p className="text-muted-foreground">Initializing backup...</p>
                            </div>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    )
}
