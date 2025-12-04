const rows = [
    {
        feature: 'Authelia SSO + 2FA',
        mediastack: 'Pre-wired, plan-backed policies',
        diy: 'Manual config, no tunnel parity',
    },
    {
        feature: 'Cloudflare Tunnel',
        mediastack: 'Ingress map + homepage links kept in sync',
        diy: 'Ad-hoc hostnames, no QA checklist',
    },
    {
        feature: 'Arr automation',
        mediastack: 'TRaSH defaults, FlareSolverr proxy hints, Notifiarr hooks',
        diy: 'Docs hunting / fragile webhooks',
    },
    {
        feature: 'VPN-enforced downloads',
        mediastack: 'Gluetun network_mode + port guidance',
        diy: 'Custom iptables, risk of leaks',
    },
    {
        feature: 'Transcoding & storage',
        mediastack: 'Tdarr recipes + GPU tips + checklist',
        diy: 'Manual queue mgmt',
    },
    {
        feature: 'Monitoring & comms',
        mediastack: 'Homepage, Dozzle, Watchtower, Discord roadmap',
        diy: 'SSH only, no social proof',
    },
]

export function ComparisonTable() {
    return (
        <section className="py-24 bg-black/30">
            <div className="container mx-auto px-4">
                <div className="max-w-3xl mx-auto text-center mb-8 space-y-3">
                    <p className="text-primary uppercase tracking-[0.4em] text-xs">Why this stack</p>
                    <h2 className="text-4xl font-bold">State-of-the-art vs DIY</h2>
                    <p className="text-muted-foreground">Borrowed from the most upvoted comparison threads on r/selfhosted and LinkedIn devops posts.</p>
                </div>
                <div className="overflow-x-auto rounded-3xl border border-white/10">
                    <table className="w-full text-left text-sm">
                        <thead>
                            <tr className="bg-white/5">
                                <th className="p-4 uppercase tracking-widest text-xs text-muted-foreground">Function</th>
                                <th className="p-4 uppercase tracking-widest text-xs text-muted-foreground">Media Stack</th>
                                <th className="p-4 uppercase tracking-widest text-xs text-muted-foreground">DIY Compose</th>
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map(row => (
                                <tr key={row.feature} className="border-t border-white/5">
                                    <td className="p-4 font-semibold text-white">{row.feature}</td>
                                    <td className="p-4 text-emerald-200">{row.mediastack}</td>
                                    <td className="p-4 text-muted-foreground">{row.diy}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </section>
    )
}
