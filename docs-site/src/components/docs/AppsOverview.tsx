import { useState, useEffect } from 'react'
import { Plus, Github, Trash2, Loader2, Link as LinkIcon, X } from 'lucide-react'
import { appCards, ICON_MAP, type AppId, type AppInfo } from './appData'
import { controlServer, type AppRegistryItem } from '../../utils/controlServer'

interface AppsOverviewProps {
    onSelectApp?: (id: AppId) => void
}

export function AppsOverview({ onSelectApp }: AppsOverviewProps) {
    const [customApps, setCustomApps] = useState<AppInfo[]>([])
    const [isAdding, setIsAdding] = useState(false)
    const [githubUrl, setGithubUrl] = useState('')
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        loadCustomApps()
    }, [])

    const loadCustomApps = async () => {
        try {
            const registry = await controlServer.getRegistry()
            const mapped: AppInfo[] = registry.map((app: AppRegistryItem) => ({
                id: app.id as AppId,
                name: app.name,
                description: app.description,
                category: app.category || 'Custom',
                icon: ICON_MAP[app.icon || 'Github'] || ICON_MAP['Film'],
                difficulty: (app.difficulty as any) || 'Medium',
                time: app.time || '15 min'
            }))
            setCustomApps(mapped)
        } catch (err) {
            console.error('Failed to load custom apps:', err)
        }
    }

    const handleAddRepo = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!githubUrl.trim() || isLoading) return

        setIsLoading(true)
        setError(null)

        try {
            await controlServer.scrapeRepo(githubUrl)
            setGithubUrl('')
            setIsAdding(false)
            await loadCustomApps()
        } catch (err: any) {
            setError(err.message || 'Failed to add repository')
        } finally {
            setIsLoading(false)
        }
    }

    const handleRemoveApp = async (e: React.MouseEvent, id: string) => {
        e.stopPropagation()
        if (!confirm('Are you sure you want to remove this app and its guide?')) return

        try {
            await controlServer.removeRegistryApp(id)
            await loadCustomApps()
        } catch (err) {
            console.error('Failed to remove app:', err)
        }
    }

    const allApps = [...appCards, ...customApps]

    return (
        <section id="apps" className="py-20 border-t border-border bg-background/40">
            <div className="container mx-auto px-4 max-w-5xl">
                <div className="flex flex-col md:flex-row md:items-end justify-between mb-10 gap-6">
                    <div className="text-left">
                        <p className="text-xs uppercase tracking-[0.3em] text-purple-400/80 mb-3">Apps & Guides</p>
                        <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-3 font-display tracking-tight">Learn how to use each app</h2>
                        <p className="text-sm text-muted-foreground max-w-2xl leading-relaxed">
                            After you run your stack, come back here to get click‑by‑click help for each app. Start with your
                            media server, then add automation, requests, and utilities.
                        </p>
                    </div>

                    {!isAdding ? (
                        <button
                            onClick={() => setIsAdding(true)}
                            className="flex items-center gap-2 px-5 py-2.5 bg-purple-600/10 border border-purple-500/20 text-purple-300 rounded-xl hover:bg-purple-600/20 hover:border-purple-500/40 transition-all text-sm font-medium group"
                        >
                            <Plus className="w-4 h-4 group-hover:rotate-90 transition-transform" />
                            Add Custom App
                        </button>
                    ) : (
                        <div className="w-full md:w-auto bg-card/60 border border-border rounded-2xl p-4 animate-in fade-in slide-in-from-right-4 duration-300">
                            <div className="flex items-center justify-between mb-3">
                                <h4 className="text-xs font-semibold text-purple-300 uppercase tracking-wider flex items-center gap-2">
                                    <Github className="w-3.5 h-3.5" />
                                    Add from GitHub
                                </h4>
                                <button onClick={() => setIsAdding(false)} className="text-muted-foreground hover:text-foreground">
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                            <form onSubmit={handleAddRepo} className="flex gap-2">
                                <div className="relative flex-1">
                                    <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                                    <input
                                        type="url"
                                        placeholder="https://github.com/owner/repo"
                                        value={githubUrl}
                                        onChange={(e) => setGithubUrl(e.target.value)}
                                        className="w-full md:w-80 pl-9 pr-3 py-2 bg-background/60 border border-border rounded-xl text-sm focus:outline-none focus:border-purple-500/50"
                                        disabled={isLoading}
                                    />
                                </div>
                                <button
                                    type="submit"
                                    disabled={isLoading || !githubUrl}
                                    className="px-4 py-2 bg-purple-600 text-white rounded-xl text-sm font-medium hover:bg-purple-500 disabled:bg-slate-700 disabled:cursor-not-allowed flex items-center gap-2"
                                >
                                    {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Scrape'}
                                </button>
                            </form>
                            {error && <p className="text-[11px] text-red-400 mt-2">{error}</p>}
                        </div>
                    )}
                </div>

                <div className="grid md:grid-cols-3 gap-5">
                    {allApps.map((app, idx) => {
                        const Icon = app.icon
                        const isCustom = idx >= appCards.length
                        return (
                            <button
                                key={`${app.id}-${idx}`}
                                onClick={() => onSelectApp?.(app.id)}
                                className="group relative text-left rounded-2xl border border-border bg-card/40 hover:border-purple-500/30 hover:bg-card/60 transition-all p-5 flex flex-col h-full backdrop-blur-sm"
                            >
                                {isCustom && (
                                    <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <div className="px-1.5 py-0.5 bg-purple-500/20 text-purple-300 rounded text-[9px] uppercase font-bold tracking-wider border border-purple-500/20">
                                            Custom
                                        </div>
                                        <button
                                            onClick={(e) => handleRemoveApp(e, app.id)}
                                            className="p-1.5 bg-red-500/10 text-red-400 hover:bg-red-500/20 rounded-lg transition-colors"
                                            title="Remove app"
                                        >
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                )}
                                <div className="flex items-center gap-4 mb-4">
                                    <div className="w-11 h-11 rounded-2xl bg-purple-500/10 flex items-center justify-center border border-purple-500/20 group-hover:bg-purple-500/20 transition-colors">
                                        <Icon className="w-6 h-6 text-purple-300/90" />
                                    </div>
                                    <div>
                                        <p className="text-[10px] uppercase tracking-widest text-purple-400/70 font-bold mb-0.5">{app.category}</p>
                                        <h3 className="text-base font-bold text-foreground group-hover:text-purple-100 transition-colors">
                                            {app.name}
                                        </h3>
                                    </div>
                                </div>
                                <p className="text-xs text-muted-foreground/90 leading-relaxed mb-5 flex-1 line-clamp-2">{app.description}</p>
                                <div className="flex items-center justify-between text-[11px] text-muted-foreground/70 pt-4 border-t border-border/40">
                                    <span className="flex items-center gap-1">
                                        Difficulty: <span className="text-foreground/90 font-medium">{app.difficulty}</span>
                                    </span>
                                    <span className="flex items-center gap-1">
                                        Time: <span className="text-foreground/90 font-medium">{app.time}</span>
                                    </span>
                                </div>
                            </button>
                        )
                    })}
                </div>

                {allApps.length === 0 && (
                    <div className="text-center py-20 border-2 border-dashed border-border rounded-3xl">
                        <p className="text-muted-foreground">No apps found. Add your first custom app from GitHub!</p>
                    </div>
                )}
            </div>
        </section>
    )
}
