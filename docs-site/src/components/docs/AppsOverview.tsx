import { appCards, type AppId } from './appData'

interface AppsOverviewProps {
    onSelectApp?: (id: AppId) => void
}
export function AppsOverview({ onSelectApp }: AppsOverviewProps) {
    return (
        <section id="apps" className="py-20 border-t border-white/10 bg-slate-950/40">
            <div className="container mx-auto px-4 max-w-5xl">
                <div className="text-center mb-10">
                    <p className="text-xs uppercase tracking-[0.3em] text-purple-300/80 mb-3">Apps & Guides</p>
                    <h2 className="text-3xl md:text-4xl font-bold text-white mb-3">Learn how to use each app</h2>
                    <p className="text-sm text-gray-400 max-w-2xl mx-auto">
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
                                className="group text-left rounded-2xl border border-white/10 bg-slate-900/70 hover:border-purple-500/40 hover:bg-slate-900/90 transition-all p-4 flex flex-col h-full"
                            >
                                <div className="flex items-center gap-3 mb-3">
                                    <div className="w-9 h-9 rounded-xl bg-purple-500/20 flex items-center justify-center">
                                        <Icon className="w-5 h-5 text-purple-100" />
                                    </div>
                                    <div>
                                        <p className="text-xs uppercase tracking-wide text-gray-500">{app.category}</p>
                                        <h3 className="text-sm font-semibold text-white group-hover:text-purple-100">
                                            {app.name}
                                        </h3>
                                    </div>
                                </div>
                                <p className="text-xs text-gray-400 mb-3 flex-1">{app.description}</p>
                                <div className="flex items-center justify-between text-[11px] text-gray-400 mt-auto">
                                    <span>
                                        Difficulty: <span className="text-gray-200">{app.difficulty}</span>
                                    </span>
                                    <span>
                                        Setup: <span className="text-gray-200">{app.time}</span>
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
