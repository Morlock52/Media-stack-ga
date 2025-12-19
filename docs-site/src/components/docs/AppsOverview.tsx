import { appCards, type AppId } from './appData'

interface AppsOverviewProps {
    onSelectApp?: (id: AppId) => void
}

export function AppsOverview({ onSelectApp }: AppsOverviewProps) {
    const allApps = appCards

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

                    <div className="flex items-center gap-2 px-5 py-2.5 bg-purple-600/10 border border-purple-500/20 text-purple-300 rounded-xl text-sm font-medium">
                        Guides included
                    </div>
                </div>

                <div className="grid md:grid-cols-3 gap-5">
                    {allApps.map((app, idx) => {
                        const Icon = app.icon
                        return (
                            <button
                                key={`${app.id}-${idx}`}
                                onClick={() => onSelectApp?.(app.id)}
                                className="group relative text-left rounded-2xl border border-border bg-card/40 hover:border-purple-500/30 hover:bg-card/60 transition-all p-5 flex flex-col h-full backdrop-blur-sm"
                            >
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
                        <p className="text-muted-foreground">No apps found.</p>
                    </div>
                )}
            </div>
        </section>
    )
}
