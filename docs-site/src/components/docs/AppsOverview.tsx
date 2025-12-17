import { appCards, type AppId } from './appData'

interface AppsOverviewProps {
    onSelectApp?: (id: AppId) => void
}
export function AppsOverview({ onSelectApp }: AppsOverviewProps) {
    return (
        <section id="apps" className="py-20 border-t border-border bg-background">
            <div className="container mx-auto px-4 max-w-5xl">
                <div className="text-center mb-10">
                    <p className="text-xs uppercase tracking-[0.3em] text-purple-300/80 mb-3">Apps & Guides</p>
                    <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-3">Learn how to use each app</h2>
                    <p className="text-sm text-muted-foreground max-w-2xl mx-auto">
                        After you run your stack, come back here to get click‑by‑click help for each app. Start with your
                        media server, then add automation, requests, and utilities at your own pace.
                    </p>
                </div>

                <div className="grid md:grid-cols-3 gap-5">
                    {appCards.map((app) => {
                        const Icon = app.icon
                        return (
                            <button
                                key={app.id}
                                onClick={() => onSelectApp?.(app.id as AppId)}
                                className="group text-left rounded-2xl border border-border bg-card/60 hover:border-purple-500/40 hover:bg-card/80 transition-all p-4 flex flex-col h-full"
                            >
                                <div className="flex items-center gap-3 mb-3">
                                    <div className="w-9 h-9 rounded-xl bg-purple-500/20 flex items-center justify-center">
                                        <Icon className="w-5 h-5 text-purple-100" />
                                    </div>
                                    <div>
                                        <p className="text-xs uppercase tracking-wide text-muted-foreground">{app.category}</p>
                                        <h3 className="text-sm font-semibold text-foreground group-hover:text-purple-100">
                                            {app.name}
                                        </h3>
                                    </div>
                                </div>
                                <p className="text-xs text-muted-foreground mb-3 flex-1">{app.description}</p>
                                <div className="flex items-center justify-between text-[11px] text-muted-foreground mt-auto">
                                    <span>
                                        Difficulty: <span className="text-foreground">{app.difficulty}</span>
                                    </span>
                                    <span>
                                        Setup: <span className="text-foreground">{app.time}</span>
                                    </span>
                                </div>
                            </button>
                        )
                    })}
                </div>
            </div>
        </section>
    )
}
