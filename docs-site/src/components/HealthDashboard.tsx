import { useCallback, useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
    Activity, RefreshCw, Play, Square, RotateCcw, Clock, Cpu, HardDrive,
    CheckCircle, AlertCircle, XCircle, Loader2, ChevronDown, ChevronUp,
    Database, Plus, Calendar, Shield, ShieldOff
} from 'lucide-react'
import { buildControlServerUrl, controlServerAuthHeaders } from '../utils/controlServer'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip'
import { usePageVisibility } from '../hooks/usePageVisibility'
import { log } from '../utils/logging'
import { useBackupStore } from '../store/backupStore'
import { useBackupList } from '../hooks/useBackup'
import { useNavigate } from 'react-router-dom'
import { Button } from './ui/button'

/** Polling interval for health dashboard (15 seconds) */
const HEALTH_POLL_INTERVAL_MS = 15_000

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

interface ContainerHealth {
    id: string
    name: string
    status: string
    state: 'running' | 'exited' | 'paused' | 'restarting' | string
    health?: 'healthy' | 'unhealthy' | 'starting' | 'none'
    uptime?: string
    cpu?: string
    memory?: string
    restartCount?: number
}

interface HealthDashboardData {
    timestamp: string
    summary: {
        total: number
        running: number
        healthy: number
        unhealthy: number
        stopped: number
    }
    containers: ContainerHealth[]
    systemStats?: {
        cpuUsage?: string
        memoryUsage?: string
        diskUsage?: string
    }
    actions: string[]
}

type ContainerAction = 'start' | 'stop' | 'restart'

export function HealthDashboard() {
    const navigate = useNavigate()
    const [data, setData] = useState<HealthDashboardData | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
    const [actionInProgress, setActionInProgress] = useState<Record<string, ContainerAction | null>>({})
    const [expanded, setExpanded] = useState(true)
    const [backupExpanded, setBackupExpanded] = useState(true)
    const isVisible = usePageVisibility()

    // Backup state
    const destination = useBackupStore((state) => state.destination)
    const schedule = useBackupStore((state) => state.schedule)
    const { listBackups, loading: loadingBackups } = useBackupList()
    const [backups, setBackups] = useState<any[]>([])
    const [backupsFetched, setBackupsFetched] = useState(false)

    const fetchHealthData = useCallback(async () => {
        try {
            const res = await fetch(buildControlServerUrl('/api/health-dashboard'), {
                headers: { ...controlServerAuthHeaders() },
            })
            if (!res.ok) {
                throw new Error(`Failed to fetch health data (HTTP ${res.status})`)
            }
            const json: HealthDashboardData = await res.json()
            setData(json)
            setError(null)
            setLastUpdated(new Date())
        } catch (err) {
            const msg = err instanceof Error ? err.message : 'Unknown error'
            setError(msg)
            log('error', 'HealthDashboard fetch failed', { error: msg })
        } finally {
            setLoading(false)
        }
    }, [])

    const performContainerAction = useCallback(async (containerName: string, action: ContainerAction) => {
        setActionInProgress(prev => ({ ...prev, [containerName]: action }))
        try {
            const res = await fetch(buildControlServerUrl(`/api/containers/${action}/${encodeURIComponent(containerName)}`), {
                method: 'POST',
                headers: { ...controlServerAuthHeaders() },
            })
            if (!res.ok) {
                const body = await res.text().catch(() => '')
                throw new Error(body || `Failed to ${action} container`)
            }
            // Refresh data after action
            await fetchHealthData()
        } catch (err) {
            const msg = err instanceof Error ? err.message : 'Action failed'
            log('error', `Container ${action} failed`, { containerName, error: msg })
            setError(msg)
        } finally {
            setActionInProgress(prev => ({ ...prev, [containerName]: null }))
        }
    }, [fetchHealthData])

    // Fetch backup list
    const fetchBackupList = useCallback(async () => {
        if (!destination) {
            log('info', 'No destination configured, skipping backup list fetch')
            setBackupsFetched(true)
            return
        }

        try {
            const result = await listBackups({
                destination,
                limit: 5, // Only fetch last 5 backups for the widget
                offset: 0,
            })

            if (result) {
                setBackups(result.backups || [])
                setBackupsFetched(true)
            }
        } catch (err) {
            log('error', 'Failed to fetch backup list for widget', { error: err })
            setBackupsFetched(true)
        }
    }, [destination, listBackups])

    // Initial fetch
    useEffect(() => {
        fetchHealthData()
    }, [fetchHealthData])

    // Initial backup list fetch
    useEffect(() => {
        if (!backupsFetched && destination) {
            fetchBackupList()
        }
    }, [backupsFetched, destination, fetchBackupList])

    // Visibility-aware polling
    useEffect(() => {
        if (!isVisible) return
        const interval = setInterval(fetchHealthData, HEALTH_POLL_INTERVAL_MS)
        return () => clearInterval(interval)
    }, [isVisible, fetchHealthData])

    const getStateIcon = (state: string, health?: string) => {
        if (state === 'running') {
            if (health === 'healthy') return <CheckCircle className="w-4 h-4 text-emerald-400" />
            if (health === 'unhealthy') return <AlertCircle className="w-4 h-4 text-red-400" />
            if (health === 'starting') return <Loader2 className="w-4 h-4 text-amber-400 animate-spin" />
            return <CheckCircle className="w-4 h-4 text-emerald-400" />
        }
        if (state === 'exited') return <XCircle className="w-4 h-4 text-red-400" />
        if (state === 'paused') return <Square className="w-4 h-4 text-amber-400" />
        if (state === 'restarting') return <RotateCcw className="w-4 h-4 text-amber-400 animate-spin" />
        return <AlertCircle className="w-4 h-4 text-gray-400" />
    }

    const getStateColor = (state: string, health?: string) => {
        if (state === 'running') {
            if (health === 'unhealthy') return 'border-red-500/30 bg-red-500/5'
            return 'border-emerald-500/30 bg-emerald-500/5'
        }
        if (state === 'exited') return 'border-red-500/30 bg-red-500/5'
        if (state === 'paused') return 'border-amber-500/30 bg-amber-500/5'
        return 'border-gray-500/30 bg-gray-500/5'
    }

    if (loading && !data) {
        return (
            <div className="rounded-lg border border-border/50 bg-card/50 p-6">
                <div className="flex items-center justify-center gap-2 text-muted-foreground">
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Loading health data...</span>
                </div>
            </div>
        )
    }

    if (error && !data) {
        return (
            <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-6">
                <div className="flex items-center gap-2 text-red-400">
                    <AlertCircle className="w-5 h-5" />
                    <span>{error}</span>
                </div>
                <button
                    onClick={fetchHealthData}
                    className="mt-3 flex items-center gap-2 text-sm text-primary hover:underline"
                >
                    <RefreshCw className="w-4 h-4" /> Retry
                </button>
            </div>
        )
    }

    if (!data) return null

    const { summary, containers, systemStats } = data

    return (
        <div className="space-y-4">
        <div className="rounded-lg border border-border/50 bg-card/50 overflow-hidden">
            {/* Header */}
            <button
                onClick={() => setExpanded(!expanded)}
                className="w-full flex items-center justify-between p-4 hover:bg-muted/30 transition-colors"
            >
                <div className="flex items-center gap-3">
                    <Activity className="w-5 h-5 text-primary" />
                    <h3 className="font-semibold text-foreground">Container Health</h3>

                    {/* Summary badges */}
                    <div className="flex items-center gap-2 ml-2">
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                            {summary.running} running
                        </span>
                        {summary.unhealthy > 0 && (
                            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-500/20 text-red-300 border border-red-500/30">
                                {summary.unhealthy} unhealthy
                            </span>
                        )}
                        {summary.stopped > 0 && (
                            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-500/20 text-gray-300 border border-gray-500/30">
                                {summary.stopped} stopped
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
                            fetchHealthData()
                        }}
                        className="p-1.5 rounded hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors"
                        title="Refresh"
                    >
                        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
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
                        {/* System Stats */}
                        {systemStats && (
                            <div className="px-4 pb-3 flex items-center gap-4 text-xs text-muted-foreground border-b border-border/30">
                                {systemStats.cpuUsage && (
                                    <div className="flex items-center gap-1">
                                        <Cpu className="w-3 h-3" />
                                        <span>CPU: {systemStats.cpuUsage}</span>
                                    </div>
                                )}
                                {systemStats.memoryUsage && (
                                    <div className="flex items-center gap-1">
                                        <HardDrive className="w-3 h-3" />
                                        <span>Memory: {systemStats.memoryUsage}</span>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Container List */}
                        <div className="p-4 space-y-2 max-h-[400px] overflow-y-auto">
                            {containers.length === 0 ? (
                                <p className="text-sm text-muted-foreground text-center py-4">
                                    No containers found
                                </p>
                            ) : (
                                containers.map((container) => {
                                    const actionPending = actionInProgress[container.name]
                                    const isRunning = container.state === 'running'

                                    return (
                                        <div
                                            key={container.id}
                                            className={`flex items-center justify-between p-3 rounded-lg border ${getStateColor(container.state, container.health)} transition-colors`}
                                        >
                                            <div className="flex items-center gap-3 min-w-0 flex-1">
                                                {getStateIcon(container.state, container.health)}
                                                <div className="min-w-0">
                                                    <p className="font-medium text-sm text-foreground truncate" title={container.name}>
                                                        {container.name}
                                                    </p>
                                                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                                        <span className="capitalize">{container.state}</span>
                                                        {container.health && container.health !== 'none' && (
                                                            <>
                                                                <span>•</span>
                                                                <span className="capitalize">{container.health}</span>
                                                            </>
                                                        )}
                                                        {container.uptime && (
                                                            <>
                                                                <span>•</span>
                                                                <span>{container.uptime}</span>
                                                            </>
                                                        )}
                                                        {container.restartCount !== undefined && container.restartCount > 0 && (
                                                            <>
                                                                <span>•</span>
                                                                <span className="text-amber-400">{container.restartCount} restarts</span>
                                                            </>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Resource usage */}
                                            {(container.cpu || container.memory) && (
                                                <div className="hidden sm:flex items-center gap-3 text-xs text-muted-foreground">
                                                    {container.cpu && (
                                                        <span className="flex items-center gap-1">
                                                            <Cpu className="w-3 h-3" />
                                                            {container.cpu}
                                                        </span>
                                                    )}
                                                    {container.memory && (
                                                        <span className="flex items-center gap-1">
                                                            <HardDrive className="w-3 h-3" />
                                                            {container.memory}
                                                        </span>
                                                    )}
                                                </div>
                                            )}

                                            {/* Actions */}
                                            <div className="flex items-center gap-1 ml-2">
                                                <TooltipProvider>
                                                    {isRunning ? (
                                                        <>
                                                            <Tooltip>
                                                                <TooltipTrigger asChild>
                                                                    <button
                                                                        onClick={() => performContainerAction(container.name, 'restart')}
                                                                        disabled={!!actionPending}
                                                                        className="p-1.5 rounded hover:bg-amber-500/20 text-amber-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                                                    >
                                                                        {actionPending === 'restart' ? (
                                                                            <Loader2 className="w-4 h-4 animate-spin" />
                                                                        ) : (
                                                                            <RotateCcw className="w-4 h-4" />
                                                                        )}
                                                                    </button>
                                                                </TooltipTrigger>
                                                                <TooltipContent>Restart</TooltipContent>
                                                            </Tooltip>
                                                            <Tooltip>
                                                                <TooltipTrigger asChild>
                                                                    <button
                                                                        onClick={() => performContainerAction(container.name, 'stop')}
                                                                        disabled={!!actionPending}
                                                                        className="p-1.5 rounded hover:bg-red-500/20 text-red-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                                                    >
                                                                        {actionPending === 'stop' ? (
                                                                            <Loader2 className="w-4 h-4 animate-spin" />
                                                                        ) : (
                                                                            <Square className="w-4 h-4" />
                                                                        )}
                                                                    </button>
                                                                </TooltipTrigger>
                                                                <TooltipContent>Stop</TooltipContent>
                                                            </Tooltip>
                                                        </>
                                                    ) : (
                                                        <Tooltip>
                                                            <TooltipTrigger asChild>
                                                                <button
                                                                    onClick={() => performContainerAction(container.name, 'start')}
                                                                    disabled={!!actionPending}
                                                                    className="p-1.5 rounded hover:bg-emerald-500/20 text-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                                                >
                                                                    {actionPending === 'start' ? (
                                                                        <Loader2 className="w-4 h-4 animate-spin" />
                                                                    ) : (
                                                                        <Play className="w-4 h-4" />
                                                                    )}
                                                                </button>
                                                            </TooltipTrigger>
                                                            <TooltipContent>Start</TooltipContent>
                                                        </Tooltip>
                                                    )}
                                                </TooltipProvider>
                                            </div>
                                        </div>
                                    )
                                })
                            )}
                        </div>

                        {/* Error banner */}
                        {error && (
                            <div className="px-4 pb-4">
                                <div className="flex items-center gap-2 p-2 rounded bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
                                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                                    <span>{error}</span>
                                </div>
                            </div>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>

        {/* Backup Status Widget */}
        <div className="rounded-lg border border-border/50 bg-card/50 overflow-hidden mt-4">
            {/* Header */}
            <button
                onClick={() => setBackupExpanded(!backupExpanded)}
                className="w-full flex items-center justify-between p-4 hover:bg-muted/30 transition-colors"
            >
                <div className="flex items-center gap-3">
                    <Database className="w-5 h-5 text-primary" />
                    <h3 className="font-semibold text-foreground">Backup Status</h3>

                    {/* Status badges */}
                    {destination && (
                        <div className="flex items-center gap-2 ml-2">
                            {backups.length > 0 && (
                                <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                                    {backups.length} backup{backups.length !== 1 ? 's' : ''}
                                </span>
                            )}
                            {schedule?.enabled && (
                                <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                                    scheduled
                                </span>
                            )}
                        </div>
                    )}
                </div>

                <div className="flex items-center gap-3">
                    <button
                        onClick={(e) => {
                            e.stopPropagation()
                            navigate('/backup')
                        }}
                        className="p-1.5 rounded hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors"
                        title="Go to Backup Dashboard"
                    >
                        <RefreshCw className="w-4 h-4" />
                    </button>
                    {backupExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </div>
            </button>

            <AnimatePresence>
                {backupExpanded && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                    >
                        <div className="p-4">
                            {!destination ? (
                                /* No destination configured */
                                <div className="text-center py-6">
                                    <Database className="w-12 h-12 mx-auto mb-3 text-muted-foreground" />
                                    <p className="text-sm text-muted-foreground mb-4">
                                        No backup destination configured
                                    </p>
                                    <Button
                                        onClick={() => navigate('/backup/new')}
                                        variant="default"
                                        size="sm"
                                    >
                                        <Plus className="w-4 h-4 mr-2" />
                                        Configure Backup
                                    </Button>
                                </div>
                            ) : (
                                /* Backup information grid */
                                <div className="space-y-3">
                                    {/* Stats grid */}
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        {/* Last Backup */}
                                        <div className={`p-3 rounded-lg border ${backups.length > 0 && backups[0]?.status === 'completed'
                                            ? 'border-emerald-500/30 bg-emerald-500/5'
                                            : backups.length > 0 && backups[0]?.status === 'failed'
                                            ? 'border-red-500/30 bg-red-500/5'
                                            : 'border-gray-500/30 bg-gray-500/5'}`}>
                                            <div className="flex items-center gap-2 mb-1">
                                                {backups.length > 0 && backups[0]?.status === 'completed' ? (
                                                    <CheckCircle className="w-4 h-4 text-emerald-400" />
                                                ) : backups.length > 0 && backups[0]?.status === 'failed' ? (
                                                    <XCircle className="w-4 h-4 text-red-400" />
                                                ) : (
                                                    <Clock className="w-4 h-4 text-gray-400" />
                                                )}
                                                <span className="text-xs font-medium text-muted-foreground">Last Backup</span>
                                            </div>
                                            {backups.length > 0 ? (
                                                <>
                                                    <p className="text-sm font-semibold text-foreground">
                                                        {formatRelativeTime(backups[0].createdAt)}
                                                    </p>
                                                    <p className="text-xs text-muted-foreground mt-1">
                                                        {backups[0].itemCount || 0} items • {formatBytes(backups[0].compressedSize || 0)}
                                                        {backups[0].encrypted && (
                                                            <Shield className="inline w-3 h-3 ml-1 text-amber-400" title="Encrypted" />
                                                        )}
                                                    </p>
                                                </>
                                            ) : (
                                                <p className="text-sm text-muted-foreground">No backups yet</p>
                                            )}
                                        </div>

                                        {/* Next Scheduled Backup */}
                                        <div className={`p-3 rounded-lg border ${schedule?.enabled
                                            ? 'border-cyan-500/30 bg-cyan-500/5'
                                            : 'border-gray-500/30 bg-gray-500/5'}`}>
                                            <div className="flex items-center gap-2 mb-1">
                                                <Calendar className={`w-4 h-4 ${schedule?.enabled ? 'text-cyan-400' : 'text-gray-400'}`} />
                                                <span className="text-xs font-medium text-muted-foreground">Next Scheduled</span>
                                            </div>
                                            {schedule?.enabled ? (
                                                <>
                                                    <p className="text-sm font-semibold text-foreground">
                                                        {formatNextRun(schedule.nextRun)}
                                                    </p>
                                                    <p className="text-xs text-muted-foreground mt-1 capitalize">
                                                        {schedule.frequency} at {schedule.time}
                                                    </p>
                                                </>
                                            ) : (
                                                <p className="text-sm text-muted-foreground">Not scheduled</p>
                                            )}
                                        </div>
                                    </div>

                                    {/* Quick Actions */}
                                    <div className="flex items-center gap-2 pt-2 border-t border-border/30">
                                        <Button
                                            onClick={() => navigate('/backup/new')}
                                            variant="default"
                                            size="sm"
                                            className="flex-1"
                                        >
                                            <Plus className="w-4 h-4 mr-2" />
                                            Backup Now
                                        </Button>
                                        <Button
                                            onClick={() => navigate('/backup/restore')}
                                            variant="outline"
                                            size="sm"
                                            className="flex-1"
                                        >
                                            <RotateCcw className="w-4 h-4 mr-2" />
                                            Restore
                                        </Button>
                                    </div>

                                    {/* Warning when backups exist but no schedule */}
                                    {backups.length > 0 && !schedule?.enabled && (
                                        <div className="flex items-start gap-2 p-2 rounded bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs">
                                            <AlertCircle className="w-3 h-3 flex-shrink-0 mt-0.5" />
                                            <div>
                                                <p className="font-medium">No backup schedule configured</p>
                                                <p className="text-amber-400/80 mt-0.5">
                                                    Set up automatic backups in{' '}
                                                    <button
                                                        onClick={() => navigate('/backup/schedules')}
                                                        className="underline hover:text-amber-300"
                                                    >
                                                        backup schedules
                                                    </button>
                                                </p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    </div>
    )
}
