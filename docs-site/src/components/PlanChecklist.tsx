import { motion } from 'framer-motion'
import { CheckCircle2, ServerCog, ShieldHalf, Rss, Download, Activity, GlobeLock, BellRing, Workflow, FileCheck2 } from 'lucide-react'

const checklist = [
    {
        icon: ShieldHalf,
        label: '.env hardened & Authelia secrets rotated',
        subtext: 'Timezones, domains, Redis password, JWT/session/storage keys',
    },
    {
        icon: GlobeLock,
        label: 'Cloudflare tunnel + hostnames deployed',
        subtext: 'hub/auth/media/ops/notifiarr/tdarr all published & protected',
    },
    {
        icon: ServerCog,
        label: 'Compose + volumes verified',
        subtext: 'Shared /movies, /tv, /downloads for Plex/Jellyfin/*Arr/Tdarr',
    },
    {
        icon: Rss,
        label: 'Prowlarr ↔ Sonarr/Radarr ↔ FlareSolverr wired',
        subtext: 'Tagging + proxy assignments follow TRaSH guides',
    },
    {
        icon: Download,
        label: 'qBittorrent routed through Gluetun',
        subtext: 'External IP matches VPN endpoint; 6881 TCP/UDP mapped',
    },
    {
        icon: Activity,
        label: 'Monitoring & updates online',
        subtext: 'Watchtower cadence, Dozzle logs, Portainer hardened via SSO',
    },
    {
        icon: BellRing,
        label: 'Notifiarr broadcasts tested',
        subtext: 'Discord/Slack/Telegram pipes for Sonarr, Radarr, Tautulli',
    },
    {
        icon: Workflow,
        label: 'Tdarr workflows exercised',
        subtext: 'GPU pass-through + H.264→H.265 recipe validated',
    },
    {
        icon: FileCheck2,
        label: 'Plan verification completed',
        subtext: 'Docker healthcheck, manual service review, integration tests',
    },
]

const roadmapList = [
    { label: 'Audiobookshelf', category: 'Library', subtext: 'Dedicated audiobook & podcast server' },
    { label: 'Recyclarr', category: 'Automation', subtext: 'Sync TRaSH guides to Sonarr/Radarr' },
    { label: 'Cross-Seed', category: 'Automation', subtext: 'Ratio building across trackers' },
    { label: 'Uptime Kuma', category: 'System', subtext: 'Sophisticated service monitoring' },
    { label: 'ErsatzTV', category: 'Streaming', subtext: 'Custom live channels from library' },
    { label: 'Threadfin', category: 'Streaming', subtext: 'IPTV management proxy' },
]

export function PlanChecklist() {
    return (
        <section className="py-24 bg-black/20" id="checklist">
            <div className="container mx-auto px-4">
                <div className="flex flex-col lg:flex-row items-start gap-10 mb-16">
                    <div className="lg:w-1/3 space-y-4">
                        <p className="text-primary uppercase tracking-[0.3em] text-xs">Plan-driven QA</p>
                        <h2 className="text-4xl font-bold">Verification built from <span className="text-gradient-primary">plan.md</span></h2>
                        <p className="text-muted-foreground">
                            Every improvement on this page mirrors a requirement inside <code>plan.md</code>. Use this checklist as you ship your stack or coach your team.
                        </p>
                        <a
                            href="https://github.com"
                            className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-primary text-white font-semibold hover:scale-105 transition-transform"
                        >
                            Open plan.md
                        </a>
                    </div>
                    <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4">
                        {checklist.map((item, index) => (
                            <motion.div
                                key={item.label}
                                initial={{ opacity: 0, y: 12 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={{ delay: index * 0.05 }}
                                className="glass border border-white/10 rounded-2xl p-5 flex gap-4"
                            >
                                <div className="flex-shrink-0 w-12 h-12 rounded-2xl bg-primary/15 text-primary flex items-center justify-center">
                                    <item.icon className="w-5 h-5" />
                                </div>
                                <div>
                                    <p className="font-semibold text-white">{item.label}</p>
                                    <p className="text-sm text-muted-foreground">{item.subtext}</p>
                                </div>
                                <CheckCircle2 className="w-5 h-5 text-emerald-400 ml-auto" />
                            </motion.div>
                        ))}
                    </div>
                </div>

                {/* Roadmap Section */}
                <div className="border-t border-white/10 pt-16">
                    <div className="text-center mb-12">
                        <h3 className="text-2xl font-bold mb-4">🚀 Roadmap 2025 Preview</h3>
                        <p className="text-muted-foreground">Upcoming functional updates from the plan</p>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {roadmapList.map((item, index) => (
                            <motion.div
                                key={item.label}
                                initial={{ opacity: 0, scale: 0.95 }}
                                whileInView={{ opacity: 1, scale: 1 }}
                                viewport={{ once: true }}
                                transition={{ delay: index * 0.1 }}
                                className="glass p-6 rounded-xl border border-white/5 hover:border-primary/30 transition-colors"
                            >
                                <span className="text-xs font-mono text-primary bg-primary/10 px-2 py-1 rounded mb-3 inline-block">
                                    {item.category}
                                </span>
                                <h4 className="text-lg font-bold text-white mb-1">{item.label}</h4>
                                <p className="text-sm text-muted-foreground">{item.subtext}</p>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </div>
        </section>
    )
}
