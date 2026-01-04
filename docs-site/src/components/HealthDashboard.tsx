import { useCallback, useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
    Activity, RefreshCw, Play, Square, RotateCcw, Clock, Cpu, HardDrive,
    CheckCircle, AlertCircle, XCircle, Loader2, ChevronDown, ChevronUp
} from 'lucide-react'
import { buildControlServerUrl, controlServerAuthHeaders } from '../utils/controlServer'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip'
import { usePageVisibility } from '../hooks/usePageVisibility'
import { log } from '../utils/logging'

/** Polling interval for health dashboard (15 seconds) */
const HEALTH_POLL_INTERVAL_MS = 15_000

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
    const [data, setData] = useState<HealthDashboardData | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
    const [actionInProgress, setActionInProgress] = useState<Record<string, ContainerAction | null>>({})
    const [expanded, setExpanded] = useState(true)
    const isVisible = usePageVisibility()

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

    // Initial fetch
    useEffect(() => {
        fetchHealthData()
    }, [fetchHealthData])

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
    )
}
