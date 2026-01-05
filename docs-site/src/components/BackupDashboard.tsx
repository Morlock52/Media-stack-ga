import { useCallback, useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
    Database, RefreshCw, Clock, HardDrive, Shield, ShieldOff,
    CheckCircle, AlertCircle, XCircle, Loader2, ChevronDown, ChevronUp,
    Plus, RotateCcw, Settings, Calendar, TrendingUp, AlertTriangle
} from 'lucide-react'
import { useBackupStore } from '../store/backupStore'
import { useBackupList, useBackupProgress } from '../hooks/useBackup'
import { usePageVisibility } from '../hooks/usePageVisibility'
import { log } from '../utils/logging'
import { Button } from './ui/button'
import { BackupProgress } from './backup/BackupProgress'
import { useNavigate } from 'react-router-dom'

/** Polling interval for backup dashboard (30 seconds) */
const DASHBOARD_POLL_INTERVAL_MS = 30_000

// Utility function to format bytes to human-readable sizes
function formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`
}

// Utility function to format relative time
function formatRelativeTime(dateString: string): string {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffSeconds = Math.floor(diffMs / 1000)
    const diffMinutes = Math.floor(diffSeconds / 60)
    const diffHours = Math.floor(diffMinutes / 60)
    const diffDays = Math.floor(diffHours / 24)

    if (diffDays > 0) {
        return diffDays === 1 ? '1 day ago' : `${diffDays} days ago`
    } else if (diffHours > 0) {
        return diffHours === 1 ? '1 hour ago' : `${diffHours} hours ago`
    } else if (diffMinutes > 0) {
        return diffMinutes === 1 ? '1 minute ago' : `${diffMinutes} minutes ago`
    } else {
        return 'Just now'
    }
}

// Utility function to format next run time
function formatNextRun(nextRunString: string | undefined): string {
    if (!nextRunString) return 'Not scheduled'

    const nextRun = new Date(nextRunString)
    const now = new Date()
    const diffMs = nextRun.getTime() - now.getTime()

    if (diffMs <= 0) return 'Soon'

    const diffSeconds = Math.floor(diffMs / 1000)
    const diffMinutes = Math.floor(diffSeconds / 60)
    const diffHours = Math.floor(diffMinutes / 60)
    const diffDays = Math.floor(diffHours / 24)

    if (diffDays > 0) {
        return diffDays === 1 ? 'in 1 day' : `in ${diffDays} days`
    } else if (diffHours > 0) {
        return diffHours === 1 ? 'in 1 hour' : `in ${diffHours} hours`
    } else if (diffMinutes > 0) {
        return diffMinutes === 1 ? 'in 1 minute' : `in ${diffMinutes} minutes`
    } else {
        return 'in a moment'
    }
}

export function BackupDashboard() {
    const navigate = useNavigate()
    const destination = useBackupStore((state) => state.destination)
    const schedule = useBackupStore((state) => state.schedule)
    const activeBackupProgress = useBackupStore((state) => state.activeBackupProgress)
    const activeRestoreProgress = useBackupStore((state) => state.activeRestoreProgress)

    const { listBackups, loading: loadingBackups, error: backupsError } = useBackupList()
    const { progress: polledBackupProgress, startPolling, stopPolling, isPolling } = useBackupProgress()

    const [backups, setBackups] = useState<any[]>([])
    const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
    const [expanded, setExpanded] = useState(true)
    const [historyExpanded, setHistoryExpanded] = useState(true)
    const [showAllHistory, setShowAllHistory] = useState(false)
    const isVisible = usePageVisibility()

    // Combine active backup progress from store and polling
    const currentBackupProgress = activeBackupProgress || polledBackupProgress

    const fetchBackupList = useCallback(async () => {
        if (!destination) {
            log('info', 'No destination configured, skipping backup list fetch')
            return
        }

        try {
            const result = await listBackups({ destination, limit: 100, offset: 0 })
            setBackups(result.backups || [])
            setLastUpdated(new Date())
        } catch (err) {
            const msg = err instanceof Error ? err.message : 'Unknown error'
            log('error', 'BackupDashboard fetch failed', { error: msg })
        }
    }, [destination, listBackups])

    // Initial fetch
    useEffect(() => {
        if (destination) {
            fetchBackupList()
        }
    }, [fetchBackupList, destination])

    // Visibility-aware polling
    useEffect(() => {
        if (!isVisible || !destination) return
        const interval = setInterval(fetchBackupList, DASHBOARD_POLL_INTERVAL_MS)
        return () => clearInterval(interval)
    }, [isVisible, destination, fetchBackupList])

    // Poll active backup progress if there's one
    useEffect(() => {
        if (activeBackupProgress && activeBackupProgress.status !== 'completed' && activeBackupProgress.status !== 'failed' && !isPolling) {
            startPolling(activeBackupProgress.id, 2000)
        }

        return () => {
            if (isPolling) {
                stopPolling()
            }
        }
    }, [activeBackupProgress, isPolling, startPolling, stopPolling])

    // Calculate statistics
    const lastBackup = backups.length > 0 ? backups[0] : null
    const totalBackups = backups.length
    const successfulBackups = backups.filter(b => b.status === 'completed').length
    const failedBackups = backups.filter(b => b.status === 'failed').length
    const totalStorageUsed = backups.reduce((sum, b) => sum + (b.compressedSize || 0), 0)

    // Quick action handlers
    const handleBackupNow = () => {
        navigate('/backup/new')
    }

    const handleRestore = () => {
        navigate('/backup/restore')
    }

    const handleManageSchedules = () => {
        navigate('/backup/schedules')
    }

    const handleRefresh = () => {
        fetchBackupList()
    }

    // Display limited history items
    const displayedBackups = showAllHistory ? backups : backups.slice(0, 5)

    if (!destination) {
        return (
            <div className="rounded-lg border border-border/50 bg-card/50 p-6">
                <div className="flex flex-col items-center gap-4 text-center">
                    <Database className="w-12 h-12 text-muted-foreground" />
                    <div>
                        <h3 className="font-semibold text-foreground mb-2">No Backup Destination Configured</h3>
                        <p className="text-sm text-muted-foreground mb-4">
                            Configure a backup destination to start creating and managing backups
                        </p>
                        <Button onClick={() => navigate('/backup/new')} className="gap-2">
                            <Plus className="w-4 h-4" />
                            Configure Backup
                        </Button>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="space-y-4">
            {/* Main Dashboard Card */}
            <div className="rounded-lg border border-border/50 bg-card/50 overflow-hidden">
                {/* Header */}
                <button
                    onClick={() => setExpanded(!expanded)}
                    className="w-full flex items-center justify-between p-4 hover:bg-muted/30 transition-colors"
                >
                    <div className="flex items-center gap-3">
                        <Database className="w-5 h-5 text-primary" />
                        <h3 className="font-semibold text-foreground">Backup Overview</h3>

                        {/* Summary badges */}
                        <div className="flex items-center gap-2 ml-2">
                            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-primary/20 text-primary-foreground border border-primary/30">
                                {totalBackups} total
                            </span>
                            {successfulBackups > 0 && (
                                <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                                    {successfulBackups} successful
                                </span>
                            )}
                            {failedBackups > 0 && (
                                <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-500/20 text-red-300 border border-red-500/30">
                                    {failedBackups} failed
                                </span>
                            )}
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        {lastUpdated && (
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {lastUpdated.toLocaleTimeString()}
                            </span>
                        )}
                        <button
                            onClick={(e) => {
                                e.stopPropagation()
                                handleRefresh()
                            }}
                            className="p-1.5 rounded hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors"
                            title="Refresh"
                        >
                            <RefreshCw className={`w-4 h-4 ${loadingBackups ? 'animate-spin' : ''}`} />
                        </button>
                        {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </div>
                </button>

                <AnimatePresence>
                    {expanded && (
                        <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                        >
                            {/* Stats Grid */}
                            <div className="px-4 pb-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 border-b border-border/30">
                                {/* Last Backup Status */}
                                <div className={`p-3 rounded-lg border ${
                                    lastBackup?.status === 'completed'
                                        ? 'border-emerald-500/30 bg-emerald-500/5'
                                        : lastBackup?.status === 'failed'
                                        ? 'border-red-500/30 bg-red-500/5'
                                        : 'border-border/50 bg-muted/20'
                                }`}>
                                    <div className="flex items-center gap-2 mb-1">
                                        {lastBackup?.status === 'completed' && <CheckCircle className="w-4 h-4 text-emerald-400" />}
                                        {lastBackup?.status === 'failed' && <XCircle className="w-4 h-4 text-red-400" />}
                                        {!lastBackup && <AlertCircle className="w-4 h-4 text-muted-foreground" />}
                                        <span className="text-xs font-medium text-muted-foreground">Last Backup</span>
                                    </div>
                                    <p className="text-sm font-semibold text-foreground">
                                        {lastBackup ? formatRelativeTime(lastBackup.createdAt) : 'No backups yet'}
                                    </p>
                                    {lastBackup && (
                                        <p className="text-xs text-muted-foreground mt-1">
                                            {lastBackup.itemCount} items • {formatBytes(lastBackup.compressedSize)}
                                        </p>
                                    )}
                                </div>

                                {/* Next Scheduled Backup */}
                                <div className={`p-3 rounded-lg border ${
                                    schedule?.enabled
                                        ? 'border-cyan-500/30 bg-cyan-500/5'
                                        : 'border-border/50 bg-muted/20'
                                }`}>
                                    <div className="flex items-center gap-2 mb-1">
                                        <Calendar className={`w-4 h-4 ${schedule?.enabled ? 'text-cyan-400' : 'text-muted-foreground'}`} />
                                        <span className="text-xs font-medium text-muted-foreground">Next Backup</span>
                                    </div>
                                    <p className="text-sm font-semibold text-foreground">
                                        {schedule?.enabled ? formatNextRun(schedule.nextRun) : 'Not scheduled'}
                                    </p>
                                    {schedule?.enabled && (
                                        <p className="text-xs text-muted-foreground mt-1 capitalize">
                                            {schedule.frequency} at {schedule.time}
                                        </p>
                                    )}
                                </div>

                                {/* Total Storage Used */}
                                <div className="p-3 rounded-lg border border-border/50 bg-muted/20">
                                    <div className="flex items-center gap-2 mb-1">
                                        <HardDrive className="w-4 h-4 text-muted-foreground" />
                                        <span className="text-xs font-medium text-muted-foreground">Storage Used</span>
                                    </div>
                                    <p className="text-sm font-semibold text-foreground">
                                        {formatBytes(totalStorageUsed)}
                                    </p>
                                    <p className="text-xs text-muted-foreground mt-1">
                                        Across {totalBackups} backup{totalBackups !== 1 ? 's' : ''}
                                    </p>
                                </div>

                                {/* Success Rate */}
                                <div className="p-3 rounded-lg border border-border/50 bg-muted/20">
                                    <div className="flex items-center gap-2 mb-1">
                                        <TrendingUp className="w-4 h-4 text-muted-foreground" />
                                        <span className="text-xs font-medium text-muted-foreground">Success Rate</span>
                                    </div>
                                    <p className="text-sm font-semibold text-foreground">
                                        {totalBackups > 0
                                            ? `${Math.round((successfulBackups / totalBackups) * 100)}%`
                                            : 'N/A'
                                        }
                                    </p>
                                    <p className="text-xs text-muted-foreground mt-1">
                                        {successfulBackups} of {totalBackups} successful
                                    </p>
                                </div>
                            </div>

                            {/* Quick Actions */}
                            <div className="px-4 py-3 flex flex-wrap items-center gap-2 border-b border-border/30 bg-muted/10">
                                <Button
                                    onClick={handleBackupNow}
                                    size="sm"
                                    className="gap-2"
                                >
                                    <Plus className="w-4 h-4" />
                                    Backup Now
                                </Button>
                                <Button
                                    onClick={handleRestore}
                                    size="sm"
                                    variant="secondary"
                                    className="gap-2"
                                >
                                    <RotateCcw className="w-4 h-4" />
                                    Restore
                                </Button>
                                <Button
                                    onClick={handleManageSchedules}
                                    size="sm"
                                    variant="secondary"
                                    className="gap-2"
                                >
                                    <Settings className="w-4 h-4" />
                                    Manage Schedules
                                </Button>
                            </div>

                            {/* Active Backup/Restore Progress */}
                            {currentBackupProgress && currentBackupProgress.status !== 'completed' && currentBackupProgress.status !== 'failed' && (
                                <div className="px-4 py-3 border-b border-border/30">
                                    <div className="flex items-center gap-2 mb-3">
                                        <Loader2 className="w-4 h-4 animate-spin text-primary" />
                                        <span className="text-sm font-medium text-foreground">Backup in Progress</span>
                                    </div>
                                    <BackupProgress progress={currentBackupProgress} />
                                </div>
                            )}

                            {activeRestoreProgress && activeRestoreProgress.status !== 'completed' && activeRestoreProgress.status !== 'failed' && (
                                <div className="px-4 py-3 border-b border-border/30">
                                    <div className="flex items-center gap-2 mb-3">
                                        <Loader2 className="w-4 h-4 animate-spin text-amber-400" />
                                        <span className="text-sm font-medium text-foreground">Restore in Progress</span>
                                    </div>
                                    <div className="p-3 rounded-lg border border-amber-500/30 bg-amber-500/5">
                                        <p className="text-sm text-amber-200">
                                            Restore operation is currently running. Check the Restore Wizard for details.
                                        </p>
                                    </div>
                                </div>
                            )}

                            {/* Error banner */}
                            {backupsError && (
                                <div className="px-4 py-3 border-b border-border/30">
                                    <div className="flex items-center gap-2 p-2 rounded bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
                                        <AlertCircle className="w-4 h-4 flex-shrink-0" />
                                        <span>{backupsError}</span>
                                    </div>
                                </div>
                            )}
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* Backup History */}
            <div className="rounded-lg border border-border/50 bg-card/50 overflow-hidden">
                <button
                    onClick={() => setHistoryExpanded(!historyExpanded)}
                    className="w-full flex items-center justify-between p-4 hover:bg-muted/30 transition-colors"
                >
                    <div className="flex items-center gap-3">
                        <Clock className="w-5 h-5 text-primary" />
                        <h3 className="font-semibold text-foreground">Backup History</h3>
                        <span className="text-xs text-muted-foreground">
                            ({backups.length} backup{backups.length !== 1 ? 's' : ''})
                        </span>
                    </div>
                    {historyExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>

                <AnimatePresence>
                    {historyExpanded && (
                        <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                        >
                            <div className="p-4 space-y-2 max-h-[500px] overflow-y-auto">
                                {loadingBackups && backups.length === 0 ? (
                                    <div className="flex items-center justify-center gap-2 text-muted-foreground py-8">
                                        <Loader2 className="w-5 h-5 animate-spin" />
                                        <span>Loading backups...</span>
                                    </div>
                                ) : backups.length === 0 ? (
                                    <div className="text-center py-8">
                                        <Database className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                                        <p className="text-sm text-muted-foreground mb-4">
                                            No backups found
                                        </p>
                                        <Button onClick={handleBackupNow} size="sm" className="gap-2">
                                            <Plus className="w-4 h-4" />
                                            Create Your First Backup
                                        </Button>
                                    </div>
                                ) : (
                                    <>
                                        {displayedBackups.map((backup) => (
                                            <div
                                                key={backup.id}
                                                className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${
                                                    backup.status === 'completed'
                                                        ? 'border-emerald-500/30 bg-emerald-500/5'
                                                        : 'border-red-500/30 bg-red-500/5'
                                                }`}
                                            >
                                                <div className="flex items-center gap-3 min-w-0 flex-1">
                                                    {backup.status === 'completed' ? (
                                                        <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                                                    ) : (
                                                        <XCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                                                    )}
                                                    <div className="min-w-0 flex-1">
                                                        <div className="flex items-center gap-2">
                                                            <p className="font-medium text-sm text-foreground truncate" title={backup.name || backup.id}>
                                                                {backup.name || backup.id}
                                                            </p>
                                                            {backup.encrypted && (
                                                                <Shield className="w-3 h-3 text-primary flex-shrink-0" title="Encrypted" />
                                                            )}
                                                            {!backup.encrypted && (
                                                                <ShieldOff className="w-3 h-3 text-muted-foreground flex-shrink-0" title="Not encrypted" />
                                                            )}
                                                        </div>
                                                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                                            <span>{formatRelativeTime(backup.createdAt)}</span>
                                                            <span>•</span>
                                                            <span>{backup.itemCount} items</span>
                                                            <span>•</span>
                                                            <span>{formatBytes(backup.compressedSize)}</span>
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="flex items-center gap-2">
                                                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                                                        backup.status === 'completed'
                                                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                                            : 'bg-red-500/20 text-red-300 border border-red-500/30'
                                                    }`}>
                                                        {backup.status === 'completed' ? 'Success' : 'Failed'}
                                                    </span>
                                                </div>
                                            </div>
                                        ))}

                                        {backups.length > 5 && !showAllHistory && (
                                            <button
                                                onClick={() => setShowAllHistory(true)}
                                                className="w-full py-2 text-sm text-primary hover:underline"
                                            >
                                                Show all {backups.length} backups
                                            </button>
                                        )}

                                        {showAllHistory && backups.length > 5 && (
                                            <button
                                                onClick={() => setShowAllHistory(false)}
                                                className="w-full py-2 text-sm text-primary hover:underline"
                                            >
                                                Show less
                                            </button>
                                        )}
                                    </>
                                )}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* Warning if no schedule configured */}
            {!schedule?.enabled && backups.length > 0 && (
                <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4">
                    <div className="flex items-start gap-3">
                        <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
                        <div className="flex-1">
                            <h4 className="font-medium text-amber-200 mb-1">No Automated Backups Configured</h4>
                            <p className="text-sm text-amber-200/80 mb-3">
                                Consider setting up a backup schedule to automatically backup your data on a regular basis.
                            </p>
                            <Button
                                onClick={handleManageSchedules}
                                size="sm"
                                variant="secondary"
                                className="gap-2"
                            >
                                <Calendar className="w-4 h-4" />
                                Configure Schedule
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
