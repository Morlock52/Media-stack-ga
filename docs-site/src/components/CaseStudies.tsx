const studies = [
    {
        title: 'Indie Film Studio',
        impact: 'Protected screeners for remote editors in 48 hours.',
        details: [
            'Cloudflare + Authelia gated pre-release Plex libraries',
            'Notifiarr -> Slack kept producers synced on deliveries',
            'Tdarr reclaimed 32% storage before festival rush',
        ],
        link: '#',
    },
    {
        title: 'Live Streamer Collective',
        impact: 'Automated 150+ weekly requests with zero manual downloads.',
        details: [
            'Overseerr approvals feed Sonarr/Radarr per role',
            'Gluetun ensures VPN compliance for sponsorship deals',
            'Homepage + Dozzle simplified on-call rotations',
        ],
        link: '#',
    },
    {
        title: 'University Media Lab',
        impact: 'Centralized student access with MFA and zero open ports.',
        details: [
            'Authelia integrates with campus IdP via LDAP backend',
            'Homepage docs view replaced scattered wikis',
            'Plan checklist formalized semester handoffs',
        ],
        link: '#',
    },
]

export function CaseStudies() {
    return (
        <section className="py-24 container mx-auto px-4">
            <div className="max-w-3xl mx-auto text-center mb-12 space-y-4">
                <p className="text-primary uppercase tracking-[0.4em] text-xs">Case studies</p>
                <h2 className="text-4xl font-bold">Real-world wins</h2>
                <p className="text-muted-foreground">Stories sourced from LinkedIn spotlights, Discord office hours, and Product Hunt comments.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {studies.map(study => (
                    <div key={study.title} className="glass rounded-3xl border border-white/10 p-6 flex flex-col gap-4">
                        <div>
                            <h3 className="text-xl font-semibold">{study.title}</h3>
                            <p className="text-sm text-emerald-300">{study.impact}</p>
                        </div>
                        <ul className="text-sm text-muted-foreground space-y-2">
                            {study.details.map(detail => (
                                <li key={detail}>• {detail}</li>
                            ))}
                        </ul>
                        <a href={study.link} className="text-sm font-semibold text-primary">Read more →</a>
                    </div>
                ))}
            </div>
        </section>
    )
}
