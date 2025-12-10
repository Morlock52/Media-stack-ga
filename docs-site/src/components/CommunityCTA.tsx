import { motion } from 'framer-motion'
import { MessageSquare, Github, MessageCircle, Rss } from 'lucide-react'

const channels = [
    {
        icon: MessageSquare,
        title: 'Discord Office Hours',
        description: 'Weekly stage with Authelia + Cloudflare maintainers answering setup questions.',
        cta: 'Join 8k+ members',
        href: 'https://discord.gg/mediastack',
    },
    {
        icon: Github,
        title: 'GitHub Discussions',
        description: 'Roadmap voting, release previews, and automation snippets straight from contributors.',
        cta: 'Star the repo',
        href: 'https://github.com',
    },
    {
        icon: MessageCircle,
        title: 'Reddit Megathread',
        description: 'Pinned post on r/selfhosted covering hardware picks, Tdarr recipes, and VPN tips.',
        cta: 'Read the recap',
        href: 'https://www.reddit.com/r/selfhosted/',
    },
    {
        icon: Rss,
        title: 'Newsletter pulse',
        description: 'Monthly digest featuring stack upgrades, TRaSH guide updates, and social highlights.',
        cta: 'Subscribe',
        href: '#',
    },
]

export function CommunityCTA() {
    return (
        <section className="py-24 container mx-auto px-4">
            <div className="max-w-3xl mx-auto text-center mb-14 space-y-4">
                <p className="text-primary uppercase tracking-[0.4em] text-xs">Community</p>
                <h2 className="text-4xl md:text-5xl font-bold">Stay in the loop</h2>
                <p className="text-muted-foreground">
                    Feedback sourced from Discord AMAs, Reddit recaps, GitHub issues, and Twitter polls shaped this release. Plug into the same channels to keep leveling up.
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-5xl mx-auto">
                {channels.map((channel, index) => (
                    <motion.a
                        key={channel.title}
                        href={channel.href}
                        target="_blank"
                        rel="noreferrer"
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ delay: index * 0.05 }}
                        className="glass border border-white/10 rounded-3xl p-6 hover:border-primary/40 transition-colors flex flex-col gap-3"
                    >
                        <div className="flex items-center gap-3">
                            <div className="w-11 h-11 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center">
                                <channel.icon className="w-5 h-5 text-primary" />
                            </div>
                            <div>
                                <h3 className="text-lg font-semibold">{channel.title}</h3>
                                <p className="text-sm text-muted-foreground">{channel.description}</p>
                            </div>
                        </div>
                        <span className="mt-auto text-sm font-semibold text-primary">{channel.cta} →</span>
                    </motion.a>
                ))}
            </div>
        </section>
    )
}
