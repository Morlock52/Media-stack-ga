import { useEffect, useState } from 'react'
import { CheckCircle, AlertCircle, Clock } from 'lucide-react'
import { buildControlServerUrl, controlServerAuthHeaders } from '../utils/controlServer'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip'

interface Container {
    id: string
    name: string
    status: string
    state: string
}

type StatusBadgeProps = {
    iconClassName?: string
    forceFullColor?: boolean
    hideText?: boolean
}

export function StatusBadge({ iconClassName, forceFullColor, hideText }: StatusBadgeProps) {
    const [stats, setStats] = useState({ total: 0, running: 0, loading: true, controlServerOnline: true })
    const [lastChecked, setLastChecked] = useState<Date | null>(null)

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const headers = { ...controlServerAuthHeaders() }

                // Compose service list (authoritative total)
                let composeServices: string[] = []
                try {
                    const svcRes = await fetch(buildControlServerUrl('/api/compose/services'), { headers })
                    if (svcRes.ok) {
                        const data = await svcRes.json()
                        composeServices = Array.isArray(data.services) ? data.services : []
                    }
                } catch {
                    // ignore, fall back to other signals
                }

                // Current containers
                const containersRes = await fetch(buildControlServerUrl('/api/containers'), { headers })
                if (!containersRes.ok) throw new Error('Failed to fetch containers')
                const containers: Container[] = await containersRes.json()

                const isMatch = (service: string, name: string) =>
                    name === service || name.endsWith(`-${service}`) || name.endsWith(`_${service}_1`) || name.includes(`_${service}`)

                const total = composeServices.length > 0 ? composeServices.length : containers.length
                const running = composeServices.length > 0
                    ? composeServices.reduce((acc, svc) => acc + (containers.some((c) => c.state === 'running' && isMatch(svc, c.name)) ? 1 : 0), 0)
                    : containers.filter((c) => c.state === 'running').length

                setStats({ total, running, loading: false, controlServerOnline: true })
                setLastChecked(new Date())
            } catch {
                try {
                    const healthRes = await fetch(buildControlServerUrl('/api/health'), {
                        headers: { ...controlServerAuthHeaders() },
                    })
                    setStats((s) => ({ ...s, loading: false, controlServerOnline: healthRes.ok }))
                } catch {
                    setStats((s) => ({ ...s, loading: false, controlServerOnline: false }))
                }
                setLastChecked(new Date())
            }
        }

        fetchStats()
        const interval = setInterval(fetchStats, 10000)
        return () => clearInterval(interval)
    }, [])

    if (stats.loading) return null

    const isHealthy = stats.controlServerOnline && stats.running === stats.total && stats.total > 0
    const uptime = stats.total > 0 ? ((stats.running / stats.total) * 100).toFixed(1) : '0.0'

    const iconSizeClass = iconClassName ?? 'w-4 h-4'
    const iconColorClass = isHealthy ? 'text-emerald-300' : 'text-amber-300'
    const iconOpacityClass = forceFullColor ? 'opacity-100' : ''

    return (
        <TooltipProvider>
            <Tooltip delayDuration={200}>
                <TooltipTrigger asChild>
                    <div className={`
                        inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs sm:text-sm font-semibold border backdrop-blur-md cursor-help
                        ${isHealthy
                            ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-200'
                            : 'bg-amber-500/10 border-amber-500/25 text-amber-200'}
                    `} data-testid="status-badge">
                        {isHealthy ? (
                            <CheckCircle className={`${iconSizeClass} ${iconColorClass} ${iconOpacityClass}`} />
                        ) : (
                            <AlertCircle className={`${iconSizeClass} ${iconColorClass} ${iconOpacityClass}`} />
                        )}
                        {!hideText && (
                            <span>
                                {stats.controlServerOnline ? `${stats.running}/${stats.total} Services Online` : 'Control server offline'}
                            </span>
                        )}
                        <span className="relative flex h-2 w-2 ml-1">
                            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${isHealthy ? 'bg-emerald-400' : 'bg-amber-400'}`}></span>
                            <span className={`relative inline-flex rounded-full h-2 w-2 ${isHealthy ? 'bg-emerald-400' : 'bg-amber-400'}`}></span>
                        </span>
                    </div>
                </TooltipTrigger>
                <TooltipContent className="bg-popover text-popover-foreground border-border">
                    <div className="space-y-2">
                        <p className="font-semibold text-sm">System Status</p>
                        <div className="text-xs space-y-1">
                            <div className="flex justify-between gap-4">
                                <span className="text-muted-foreground">Running:</span>
                                <span className="font-mono">{stats.running} services</span>
                            </div>
                            <div className="flex justify-between gap-4">
                                <span className="text-muted-foreground">Total:</span>
                                <span className="font-mono">{stats.total} services</span>
                            </div>
                            <div className="flex justify-between gap-4">
                                <span className="text-muted-foreground">Uptime:</span>
                                <span className="font-mono">{uptime}%</span>
                            </div>
                            {lastChecked && (
                                <div className="flex items-center gap-2 text-muted-foreground pt-1 mt-1 border-t border-border">
                                    <Clock className="w-3 h-3" />
                                    <span>Checked {new Date(lastChecked).toLocaleTimeString()}</span>
                                </div>
                            )}
                        </div>
                    </div>
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    )
}
