import { ReactNode } from 'react'
import { TopRightActions } from '../layout/TopRightActions'

interface AppGuideLayoutProps {
    icon: ReactNode
    title: string
    subtitle: string
    category: string
    estimatedTime: string
    children: ReactNode
}

export function AppGuideLayout({ icon, title, subtitle, category, estimatedTime, children }: AppGuideLayoutProps) {
    return (
        <section id="apps" className="py-20 border-t border-white/10 bg-background">
            <div className="container mx-auto px-4 max-w-5xl">
                <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
                    <div className="flex items-center gap-4">
                        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-500/30 to-pink-500/30 border border-purple-500/40 flex items-center justify-center">
                            {icon}
                        </div>
                        <div>
                            <p className="text-xs uppercase tracking-[0.2em] text-purple-300/80 mb-1">{category}</p>
                            <h2 className="text-2xl md:text-3xl font-bold text-foreground">{title}</h2>
                            <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-6">
                        <div className="text-right text-sm text-muted-foreground">
                            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground/60">Estimated time</p>
                            <p className="text-base text-foreground font-medium">{estimatedTime}</p>
                        </div>
                        <TopRightActions />
                    </div>
                </div>

                <div className="grid md:grid-cols-[2fr,1fr] gap-8 items-start">
                    <div className="space-y-8">
                        {children}
                    </div>

                    <div className="space-y-4">
                        <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-4">
                            <h3 className="text-sm font-semibold text-white mb-2">How to read this guide</h3>
                            <ol className="list-decimal list-inside text-xs text-gray-400 space-y-1">
                                <li>Follow the steps in order after you have run <code>docker compose up -d</code>.</li>
                                <li>Keep this page open while you click through the app UI.</li>
                                <li>If you get stuck, use the AI assistant inside the wizard for extra help.</li>
                            </ol>
                        </div>

                        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-4 text-xs text-emerald-100">
                            <p className="font-semibold mb-1">Non‑technical friendly</p>
                            <p>No jargon, just clear click‑by‑click instructions. If anything feels confusing, you can safely skip it now and come back later.</p>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    )
}
