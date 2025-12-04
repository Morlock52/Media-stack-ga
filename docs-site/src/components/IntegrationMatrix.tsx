import { motion } from 'framer-motion'
import { ShieldCheck, Cloud, Layers, Download, MessageSquare, Gauge, MonitorSmartphone, Workflow } from 'lucide-react'

const functions = [
    {
        icon: ShieldCheck,
        title: 'Authelia + Cloudflare',
        status: 'SSO + 2FA enforced',
        details: [
            'Every hostname sits behind Cloudflare Tunnel',
            'Two-factor policies mapped to hub, media, and ops apps',
            'Redis-backed sessions survive restarts',
        ],
        badge: 'Security baseline',
    },
    {
        icon: Cloud,
        title: 'Domain & Tunnel',
        status: 'Full ingress map',
        details: [
            'hub/auth/plex/jellyfin/arr/qbt/request all published',
            'Notifiarr + Tdarr + Bazarr + Tautulli now covered',
            'Homepage links remain in sync with tunnel config',
        ],
        badge: 'Remote reach',
    },
    {
        icon: Layers,
        title: 'Arr Automation Fabric',
        status: 'Hardlinks verified',
        details: [
            'Shared /tv + /movies + /downloads paths',
            'Prowlarr feeds Sonarr/Radarr via FlareSolverr proxy',
            'Quality, naming, and root folders follow TRaSH guides',
        ],
        badge: 'Content flow',
    },
    {
        icon: Download,
        title: 'qBittorrent + Gluetun',
        status: 'VPN enforced',
        details: [
            'Service shares network namespace with Gluetun',
            '6881/UDP-TCP forwarded through provider ports',
            'Kill-switch prevents leaks if tunnel drops',
        ],
        badge: 'Private transport',
    },
    {
        icon: MonitorSmartphone,
        title: 'Homepage + UX',
        status: 'Unified control surface',
        details: [
            'Live stats, service tiles, health indicators',
            'Docs viewer now syncs README + Quick Reference automatically',
            'New social proof + roadmap storytelling',
        ],
        badge: 'Single entry',
    },
    {
        icon: MessageSquare,
        title: 'Notifiarr Broadcasts',
        status: 'Multi-channel alerts',
        details: [
            'Discord, Slack, and Telegram templates ready',
            'Hooks to Sonarr/Radarr/Prowlarr/Tautulli included in plan',
            'Test delivery checklist in plan.md',
        ],
        badge: 'User delight',
    },
    {
        icon: Workflow,
        title: 'Tdarr Workflows',
        status: 'Space-saving transcodes',
        details: [
            'Shared media mount with servers and nodes',
            'H.264 → H.265 pipelines suggested',
            'GPU passthrough guidance in verification steps',
        ],
        badge: 'Efficiency',
    },
    {
        icon: Gauge,
        title: 'Observability',
        status: 'Ops in one glance',
        details: [
            'Dozzle + Watchtower schedule documented',
            'Portainer restricted via Authelia SSO',
            'Checklist in plan.md for health + uptime',
        ],
        badge: 'Always-on',
    },
]

export function IntegrationMatrix() {
    return (
        <section className="py-24 bg-gradient-to-b from-transparent via-white/5 to-transparent">
            <div className="container mx-auto px-4">
                <div className="max-w-4xl mx-auto text-center mb-12 space-y-4">
                    <p className="text-primary uppercase tracking-[0.3em] text-xs">Integration Map</p>
                    <h2 className="text-4xl md:text-5xl font-bold">Every function in <span className="text-gradient-primary">plan.md</span> covered</h2>
                    <p className="text-muted-foreground">
                        We translated each verification step into tangible UI, automation, and documentation updates so you can review, deploy, and trust the entire media stack without hunting through tickets.
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-6xl mx-auto">
                    {functions.map((fn, index) => (
                        <motion.div
                            key={fn.title}
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ delay: index * 0.05 }}
                            className="glass border border-white/10 rounded-3xl p-6 backdrop-blur group hover:border-primary/40 transition-colors"
                        >
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-11 h-11 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center">
                                        <fn.icon className="w-5 h-5 text-primary" />
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-semibold">{fn.title}</h3>
                                        <p className="text-sm text-emerald-300">{fn.status}</p>
                                    </div>
                                </div>
                                <span className="text-xs uppercase tracking-widest text-white/70 bg-primary/20 text-primary px-3 py-1 rounded-full">
                                    {fn.badge}
                                </span>
                            </div>
                            <ul className="space-y-2 text-sm text-muted-foreground">
                                {fn.details.map(detail => (
                                    <li key={detail} className="flex items-start gap-2">
                                        <span className="text-primary mt-1">•</span>
                                        <span>{detail}</span>
                                    </li>
                                ))}
                            </ul>
                        </motion.div>
                    ))}
                </div>
            </div>
        </section>
    )
}
