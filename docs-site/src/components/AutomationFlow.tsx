import { motion } from 'framer-motion'
import { CalendarCheck, ArrowRight, Cpu, Link, Zap, Sparkles, Gauge, Rocket } from 'lucide-react'

const flow = [
    {
        step: 'Request',
        title: 'Overseerr',
        description: 'Users request a title, Authelia handles auth, Overseerr applies approval and pushes to Radarr/Sonarr.',
        icon: Sparkles,
    },
    {
        step: 'Index',
        title: 'Prowlarr + FlareSolverr',
        description: 'Prowlarr fans out to indexers, FlareSolverr bypasses Cloudflare, and passes clean results downstream.',
        icon: Link,
    },
    {
        step: 'Download',
        title: 'qBittorrent via Gluetun',
        description: 'Categories auto-assigned, routed through VPN, enforcing kill switch + port forwarding.',
        icon: Zap,
    },
    {
        step: 'Organize',
        title: 'Sonarr / Radarr',
        description: 'Hardlinks into media libraries, metadata normalized per TRaSH guides, subtitles queued for Bazarr.',
        icon: CalendarCheck,
    },
    {
        step: 'Transcode',
        title: 'Tdarr',
        description: 'GPU-enabled pipelines re-encode to H.265, reclaiming storage while preserving quality.',
        icon: Cpu,
    },
    {
        step: 'Notify',
        title: 'Notifiarr + Tautulli',
        description: 'Discord, Slack, Telegram pings fans, while Tautulli tracks watch stats via Authelia-protected API.',
        icon: Gauge,
    },
    {
        step: 'Serve',
        title: 'Plex / Jellyfin',
        description: 'Libraries stay in sync and protected behind Cloudflare Tunnel + Authelia.',
        icon: Rocket,
    },
]

export function AutomationFlow() {
    return (
        <section className="py-24 container mx-auto px-4" id="flow">
            <div className="max-w-3xl mx-auto text-center mb-12 space-y-4">
                <p className="text-primary uppercase tracking-[0.4em] text-xs">Media automation</p>
                <h2 className="text-4xl md:text-5xl font-bold">A flow social media won’t stop sharing</h2>
                <p className="text-muted-foreground">
                    Inspired by favorite walkthroughs from YouTube homelabbers, r/selfhosted megathreads, and Discord office hours.
                </p>
            </div>

            <div className="glass rounded-3xl border border-white/10 p-8">
                <div className="flex flex-col gap-8">
                    {flow.map((item, index) => (
                        <motion.div
                            key={item.title}
                            initial={{ opacity: 0, x: -20 }}
                            whileInView={{ opacity: 1, x: 0 }}
                            viewport={{ once: true }}
                            transition={{ delay: index * 0.05 }}
                            className="flex flex-col md:flex-row md:items-center gap-4"
                        >
                            <div className="flex items-center gap-3">
                                <div className="w-12 h-12 rounded-2xl bg-primary/15 text-primary flex items-center justify-center">
                                    <item.icon className="w-5 h-5" />
                                </div>
                                <div>
                                    <p className="text-xs uppercase tracking-widest text-muted-foreground">{item.step}</p>
                                    <h3 className="text-xl font-semibold text-white">{item.title}</h3>
                                </div>
                            </div>
                            <p className="flex-1 text-muted-foreground">{item.description}</p>
                            {index !== flow.length - 1 && (
                                <ArrowRight className="hidden md:block text-white/40" />
                            )}
                        </motion.div>
                    ))}
                </div>
            </div>
        </section>
    )
}
