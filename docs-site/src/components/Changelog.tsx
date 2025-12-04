const entries = [
    {
        version: 'v2.1',
        highlights: [
            'Plan-driven checklist + integration matrix shipped',
            'Homepage docs viewer syncs README + Quick Reference automatically',
            'Hero + awards + stats sourced from Product Hunt & Reddit feedback',
        ],
    },
    {
        version: 'v2.0',
        highlights: [
            'Tdarr + Notifiarr + Gluetun routed through Cloudflare + Authelia',
            'Docs site rebuilt with Vite + Tailwind + shadcn styling cues',
            'Setup.sh TUI, Windows support, Cloudflare instructions expanded',
        ],
    },
    {
        version: 'v1.9',
        highlights: [
            'qBittorrent VPN enforcement, Watchtower schedule, Dozzle logging',
            'Homepage tiles align with ingress map and Authelia policies',
            'README + plan.md reorganized for verification-first workflow',
        ],
    },
]

export function Changelog() {
    return (
        <section className="py-24 container mx-auto px-4">
            <div className="max-w-3xl mx-auto text-center mb-10 space-y-3">
                <p className="text-primary uppercase tracking-[0.4em] text-xs">Changelog</p>
                <h2 className="text-4xl font-bold">Built in public</h2>
                <p className="text-muted-foreground">Release notes reflect what the community demanded on GitHub, Discord, Product Hunt, and r/selfhosted.</p>
            </div>
            <div className="space-y-6">
                {entries.map(entry => (
                    <div key={entry.version} className="glass border border-white/10 rounded-3xl p-6">
                        <div className="flex items-center justify-between">
                            <h3 className="text-2xl font-semibold text-white">{entry.version}</h3>
                            <span className="text-xs uppercase tracking-widest text-muted-foreground">Community-driven</span>
                        </div>
                        <ul className="mt-4 text-sm text-muted-foreground space-y-2">
                            {entry.highlights.map(highlight => (
                                <li key={highlight}>• {highlight}</li>
                            ))}
                        </ul>
                    </div>
                ))}
            </div>
        </section>
    )
}
