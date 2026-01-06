import { useState, useEffect, useRef } from 'react'
import { motion } from 'motion/react'
import { Home } from 'lucide-react'
import { controlServer } from '../../../../utils/controlServer'

const ACCESS_HOST_STORAGE_KEY = 'mediastack.accessHost'

export const isLoopbackHost = (host: string) => {
    const normalized = String(host || '').trim().toLowerCase()
    return normalized === 'localhost' || normalized === '127.0.0.1' || normalized === '::1'
}

export const hostForUrl = (host: string) => {
    const trimmed = String(host || '').trim()
    if (!trimmed) return 'localhost'
    if (trimmed.includes(':') && !trimmed.startsWith('[') && !trimmed.endsWith(']')) return `[${trimmed}]`
    return trimmed
}

export const buildLocalHttpUrl = (host: string, port: number, path = '') => {
    const normalizedPath = path ? (path.startsWith('/') ? path : `/${path}`) : ''
    return `http://${hostForUrl(host)}:${port}${normalizedPath}`
}

export type LocalAccessApp = {
    id: string
    label: string
    description: string
    port: number
    path?: string
    showWhenSelected: (selected: string[]) => boolean
    containerNames: string[]
}

export const LOCAL_ACCESS_APPS: LocalAccessApp[] = [
    {
        id: 'homepage',
        label: 'Dashboard',
        description: 'Links to all your apps',
        port: 3000,
        showWhenSelected: () => true,
        containerNames: ['homepage'],
    },
    {
        id: 'plex',
        label: 'Plex',
        description: 'Stream your media',
        port: 32400,
        path: '/web',
        showWhenSelected: (s) => s.includes('plex'),
        containerNames: ['plex'],
    },
    {
        id: 'jellyfin',
        label: 'Jellyfin',
        description: 'Stream your media (free)',
        port: 8096,
        showWhenSelected: (s) => s.includes('jellyfin'),
        containerNames: ['jellyfin'],
    },
    {
        id: 'sonarr',
        label: 'Sonarr',
        description: 'TV show automation',
        port: 8989,
        showWhenSelected: (s) => s.includes('arr') || s.includes('sonarr'),
        containerNames: ['sonarr'],
    },
    {
        id: 'radarr',
        label: 'Radarr',
        description: 'Movie automation',
        port: 7878,
        showWhenSelected: (s) => s.includes('arr') || s.includes('radarr'),
        containerNames: ['radarr'],
    },
    {
        id: 'prowlarr',
        label: 'Prowlarr',
        description: 'Indexer management',
        port: 9696,
        showWhenSelected: (s) => s.includes('arr') || s.includes('prowlarr'),
        containerNames: ['prowlarr'],
    },
    {
        id: 'bazarr',
        label: 'Bazarr',
        description: 'Subtitle automation',
        port: 6767,
        showWhenSelected: (s) => s.includes('arr') || s.includes('bazarr'),
        containerNames: ['bazarr'],
    },
    {
        id: 'overseerr',
        label: 'Overseerr',
        description: 'Requests & discovery',
        port: 5055,
        showWhenSelected: (s) => s.includes('arr') || s.includes('overseerr'),
        containerNames: ['overseerr'],
    },
    {
        id: 'qbittorrent',
        label: 'qBittorrent',
        description: 'Download client',
        port: 8081,
        showWhenSelected: (s) => s.includes('torrent'),
        containerNames: ['qbittorrent'],
    },
    {
        id: 'tautulli',
        label: 'Tautulli',
        description: 'Plex statistics',
        port: 8181,
        showWhenSelected: (s) => s.includes('stats'),
        containerNames: ['tautulli'],
    },
    {
        id: 'grafana',
        label: 'Grafana',
        description: 'Logs & metrics',
        port: 3003,
        showWhenSelected: () => false,
        containerNames: ['grafana'],
    },
]

interface LocalAccessGuideProps {
    selectedServices: string[]
}

/**
 * Displays the local mode access guide with a table of app URLs.
 * Shows server IP/hostname input and quick-select buttons for localhost/LAN IP.
 * Automatically detects LAN IPv4 address when accessed via localhost.
 */
export function LocalAccessGuide({ selectedServices }: LocalAccessGuideProps) {
    const [accessHost, setAccessHost] = useState(() => {
        if (typeof window === 'undefined') return 'localhost'
        try {
            const stored = window.localStorage.getItem(ACCESS_HOST_STORAGE_KEY)
            if (stored && stored.trim()) return stored.trim()
        } catch {
            // ignore storage failures
        }
        return window.location.hostname || 'localhost'
    })
    const [lanIpv4, setLanIpv4] = useState<string | null>(null)
    const hasAccessHostOverride = useRef(false)

    useEffect(() => {
        if (typeof window === 'undefined') return

        try {
            const stored = window.localStorage.getItem(ACCESS_HOST_STORAGE_KEY)
            hasAccessHostOverride.current = Boolean(stored && stored.trim())
        } catch {
            hasAccessHostOverride.current = false
        }

        const host = window.location.hostname || 'localhost'
        if (!isLoopbackHost(host)) {
            if (!hasAccessHostOverride.current) setAccessHost(host)
            return
        }

        let cancelled = false
        void (async () => {
            try {
                const info = await controlServer.getNetworkInfo()
                if (cancelled) return

                if (info?.success && info.lanIpv4) {
                    setLanIpv4(info.lanIpv4)
                    if (!hasAccessHostOverride.current) setAccessHost(info.lanIpv4)
                    return
                }

                if (info?.success && Array.isArray(info.ipv4) && info.ipv4.length) {
                    setLanIpv4(info.ipv4[0] || null)
                }
            } catch {
                // best-effort only
            }
        })()

        return () => {
            cancelled = true
        }
    }, [])

    const updateAccessHost = (nextHost: string) => {
        const normalized = String(nextHost || '').trim()
        setAccessHost(normalized || 'localhost')
        if (typeof window === 'undefined') return
        try {
            if (!normalized) window.localStorage.removeItem(ACCESS_HOST_STORAGE_KEY)
            else window.localStorage.setItem(ACCESS_HOST_STORAGE_KEY, normalized)
            hasAccessHostOverride.current = Boolean(normalized)
        } catch {
            // ignore storage failures
        }
    }

    return (
        <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-5 rounded-2xl bg-gradient-to-br from-emerald-500/10 to-cyan-500/10 border border-emerald-500/30 mb-6"
        >
            <div className="flex items-start gap-3 mb-4">
                <div className="p-2 bg-emerald-500/20 rounded-lg">
                    <Home className="w-5 h-5 text-emerald-400" />
                </div>
                <div>
                    <h3 className="font-semibold text-foreground">After Setup: How to Access Your Apps</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                        Open your browser and go to your server's IP address. Here's what you'll find:
                    </p>
                </div>
            </div>

            <div className="mb-3 flex flex-col sm:flex-row sm:items-end gap-2">
                <div className="flex-1">
                    <label className="block text-[11px] text-muted-foreground mb-1">Server address for links</label>
                    <input
                        value={accessHost}
                        onChange={(e) => updateAccessHost(e.target.value)}
                        className="w-full bg-background/60 border border-border rounded-lg py-2 px-3 text-xs font-mono text-foreground placeholder:text-muted-foreground"
                        placeholder="192.168.1.100"
                        inputMode="url"
                        autoComplete="off"
                    />
                </div>
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={() => updateAccessHost('localhost')}
                        className="px-3 py-2 text-xs rounded-lg bg-muted/60 hover:bg-muted/80 border border-border text-foreground transition-colors"
                    >
                        Use localhost
                    </button>
                    {lanIpv4 && (
                        <button
                            type="button"
                            onClick={() => updateAccessHost(lanIpv4)}
                            className="px-3 py-2 text-xs rounded-lg bg-muted/60 hover:bg-muted/80 border border-border text-foreground transition-colors"
                        >
                            Use {lanIpv4}
                        </button>
                    )}
                </div>
            </div>

            <div className="bg-background/60 rounded-xl p-4 border border-border">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="text-left text-muted-foreground border-b border-border">
                            <th className="pb-2 font-medium">App</th>
                            <th className="pb-2 font-medium">Address</th>
                            <th className="pb-2 font-medium hidden sm:table-cell">What it does</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border/50">
                        {LOCAL_ACCESS_APPS.filter((app) => app.showWhenSelected(selectedServices)).map((app) => {
                            const url = buildLocalHttpUrl(accessHost, app.port, app.path)
                            return (
                                <tr key={app.id}>
                                    <td className="py-2 font-medium text-foreground">{app.label}</td>
                                    <td className="py-2 font-mono text-primary text-xs">
                                        <a
                                            href={url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="hover:underline"
                                        >
                                            {url}
                                        </a>
                                    </td>
                                    <td className="py-2 text-muted-foreground hidden sm:table-cell">{app.description}</td>
                                </tr>
                            )
                        })}
                    </tbody>
                </table>
            </div>

            <p className="text-xs text-muted-foreground mt-3 flex items-center gap-1">
                <span className="text-emerald-400">💡</span>
                {isLoopbackHost(accessHost)
                    ? 'Links use localhost. To access from other devices, use your server LAN IP (like 192.168.1.100).'
                    : `Links use ${accessHost}${lanIpv4 && lanIpv4 !== accessHost ? ` (LAN: ${lanIpv4})` : ''}.`}
            </p>
        </motion.div>
    )
}
