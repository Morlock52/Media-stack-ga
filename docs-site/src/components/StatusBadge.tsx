import { useEffect, useState } from 'react'
import { CheckCircle, AlertCircle, Clock } from 'lucide-react'
import { buildControlServerUrl } from '../utils/controlServer'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip'

interface Container {
    id: string
    name: string
    status: string
    state: string
}

export function StatusBadge() {
    const [stats, setStats] = useState({ total: 0, running: 0, loading: true })
    const [lastChecked, setLastChecked] = useState<Date | null>(null)

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const res = await fetch(buildControlServerUrl('/api/containers'))
                if (!res.ok) throw new Error('Failed to fetch')
                const data: Container[] = await res.json()

                const running = data.filter(c => c.state === 'running').length
                setStats({ total: data.length, running, loading: false })
                setLastChecked(new Date())
            } catch {
                setStats(s => ({ ...s, loading: false }))
                setLastChecked(new Date())
            }
        }

        fetchStats()
        const interval = setInterval(fetchStats, 10000)
        return () => clearInterval(interval)
    }, [])

    if (stats.loading) return null

    const isHealthy = stats.running === stats.total && stats.total > 0
    const uptime = stats.total > 0 ? ((stats.running / stats.total) * 100).toFixed(1) : '0.0'

    return (
        <TooltipProvider>
            <Tooltip delayDuration={200}>
                <TooltipTrigger asChild>
                    <div className={`
                        inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium border backdrop-blur-md cursor-help
                        ${isHealthy
                            ? 'bg-green-500/10 border-green-500/20 text-green-500'
                            : 'bg-amber-500/10 border-amber-500/20 text-amber-500'}
                    `}>
                        {isHealthy ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                        <span>
                            {stats.running}/{stats.total} Services Online
                        </span>
                        <span className="relative flex h-2 w-2 ml-1">
                            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${isHealthy ? 'bg-green-500' : 'bg-amber-500'}`}></span>
                            <span className={`relative inline-flex rounded-full h-2 w-2 ${isHealthy ? 'bg-green-500' : 'bg-amber-500'}`}></span>
                        </span>
                    </div>
                </TooltipTrigger>
                <TooltipContent className="bg-gray-900 text-white border-gray-700">
                    <div className="space-y-2">
                        <p className="font-semibold text-sm">System Status</p>
                        <div className="text-xs space-y-1">
                            <div className="flex justify-between gap-4">
                                <span className="text-gray-400">Running:</span>
                                <span className="font-mono">{stats.running} services</span>
                            </div>
                            <div className="flex justify-between gap-4">
                                <span className="text-gray-400">Total:</span>
                                <span className="font-mono">{stats.total} services</span>
                            </div>
                            <div className="flex justify-between gap-4">
                                <span className="text-gray-400">Uptime:</span>
                                <span className="font-mono">{uptime}%</span>
                            </div>
                            {lastChecked && (
                                <div className="flex items-center gap-2 text-gray-500 pt-1 mt-1 border-t border-gray-700">
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
