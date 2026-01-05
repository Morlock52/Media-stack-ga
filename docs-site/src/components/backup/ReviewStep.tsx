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
    FileCheck
} from 'lucide-react'
import { useBackupStore } from '../../store/backupStore'
import { useBackupCreate, useBackupProgress, type BackupConfig } from '../../hooks/useBackup'
import { InteractiveCard } from '../ui/interactive-card'
import { Button } from '../ui/button'
import { toast } from 'sonner'
import { BackupProgress } from './BackupProgress'

// Utility function to format bytes to human-readable sizes
function formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`
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
                    /* Backup Progress - Use the reusable BackupProgress component */
                    <motion.div
                        key="progress"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                    >
                        <BackupProgress
                            progress={progress}
                            loading={!progress}
                            loadingMessage="Initializing backup..."
                        />
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    )
}
