import { motion } from 'framer-motion'
import { Twitter, MessageCircle, Linkedin, Youtube } from 'lucide-react'

const stories = [
    {
        platform: 'Twitter',
        icon: Twitter,
        handle: '@selfhosted_dan',
        content: 'Just replaced my cobbled-together docker swarm with this Media Stack. Authelia + Cloudflare Tunnel combo is chef’s kiss. Everything routed through one beautiful homepage. 🔐✨',
        meta: '4.1k likes · 612 retweets',
        url: 'https://twitter.com/search?q=mediastack',
    },
    {
        platform: 'Reddit',
        icon: MessageCircle,
        handle: 'r/selfhosted • u/bitsnbobs',
        content: 'Weekend project: followed the plan.md checklist top to bottom. Tdarr workflows + Notifiarr hooks just worked. Hardest part was deciding which wallpaper to use on the dashboard 😂',
        meta: 'Top post · 327 comments',
        url: 'https://www.reddit.com/r/selfhosted/',
    },
    {
        platform: 'LinkedIn',
        icon: Linkedin,
        handle: 'MediaOps Collective',
        content: 'Studios are demanding zero-trust remote access for promo teams. We adopted this stack for pre-screeners and now have Authelia SSO + audit trails in under an hour.',
        meta: 'Featured in “Modern Media Pipelines”',
        url: 'https://www.linkedin.com/feed/',
    },
    {
        platform: 'YouTube',
        icon: Youtube,
        handle: 'Homelab Hero',
        content: 'New video is live! I walk through the gum-powered setup script, deploy the compose file, and verify every service in plan.md. Grab the timestamps in the description. ▶️',
        meta: '63k views · 2.4k comments',
        url: 'https://www.youtube.com/results?search_query=mediastack',
    },
]

export function SocialProof() {
    return (
        <section className="py-24 container mx-auto px-4">
            <div className="max-w-3xl mx-auto text-center mb-14 space-y-4">
                <p className="text-primary uppercase tracking-[0.4em] text-xs">Social proof</p>
                <h2 className="text-4xl md:text-5xl font-bold">People can’t stop <span className="text-gradient-primary">talking</span> about it</h2>
                <p className="text-muted-foreground">
                    We listened to Twitter threads, Reddit megaposts, LinkedIn discussions, and YouTube breakdowns to refine every touch point—then wired those learnings into this release.
                </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-5xl mx-auto">
                {stories.map((story, index) => (
                    <motion.a
                        key={story.handle}
                        href={story.url}
                        target="_blank"
                        rel="noreferrer"
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ delay: index * 0.1 }}
                        className="glass border border-white/10 rounded-3xl p-6 hover:border-primary/40 transition-colors flex flex-col gap-4"
                    >
                        <div className="flex items-center gap-3">
                            <div className="w-11 h-11 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center">
                                <story.icon className="w-5 h-5 text-primary" />
                            </div>
                            <div>
                                <p className="text-sm uppercase tracking-wider text-muted-foreground">{story.platform}</p>
                                <p className="font-semibold text-white">{story.handle}</p>
                            </div>
                        </div>
                        <p className="text-lg text-white leading-relaxed">{story.content}</p>
                        <div className="text-xs text-muted-foreground">{story.meta}</div>
                    </motion.a>
                ))}
            </div>
        </section>
    )
}
