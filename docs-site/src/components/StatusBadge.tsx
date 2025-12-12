import { useEffect, useState } from 'react'
import { CheckCircle, AlertCircle } from 'lucide-react'
import { buildControlServerUrl } from '../utils/controlServer'

interface Container {
    id: string
    name: string
    status: string
    state: string
}

export function StatusBadge() {
    const [stats, setStats] = useState({ total: 0, running: 0, loading: true })

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const res = await fetch(buildControlServerUrl('/api/containers'))
                if (!res.ok) throw new Error('Failed to fetch')
                const data: Container[] = await res.json()

                const running = data.filter(c => c.state === 'running').length
                setStats({ total: data.length, running, loading: false })
            } catch {
                setStats(s => ({ ...s, loading: false }))
            }
        }

        fetchStats()
        const interval = setInterval(fetchStats, 10000)
        return () => clearInterval(interval)
    }, [])

    if (stats.loading) return null

    const isHealthy = stats.running === stats.total && stats.total > 0

    return (
        <div className={`
            inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium border backdrop-blur-md
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
    )
}
