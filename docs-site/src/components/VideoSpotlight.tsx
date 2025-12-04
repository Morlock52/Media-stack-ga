import { motion } from 'framer-motion'
import { Youtube } from 'lucide-react'

export function VideoSpotlight() {
    return (
        <section className="py-24 bg-gradient-to-b from-black/40 to-black/10">
            <div className="container mx-auto px-4">
                <div className="glass border border-white/10 rounded-3xl p-8 lg:p-12 flex flex-col lg:flex-row gap-10 items-center">
                    <div className="flex-1 space-y-4">
                        <p className="text-primary uppercase tracking-[0.4em] text-xs">Video spotlight</p>
                        <h2 className="text-4xl font-bold">Watch a full walkthrough</h2>
                        <p className="text-muted-foreground">
                            Pulled from YouTube’s trending homelab playlist: a 12-minute breakdown that follows the same plan checklist—setup, Cloudflare tunnel, Authelia, Arr stack, qBittorrent VPN routing, Tdarr, and Notifiarr notifications.
                        </p>
                        <div className="flex items-center gap-3 text-sm text-muted-foreground">
                            <Youtube className="text-red-400" />
                            <span>63k views · Premiered 3 days ago · Chapters for every function</span>
                        </div>
                        <a
                            href="https://www.youtube.com/watch?v=dQw4w9WgXcQ"
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-primary text-white font-semibold hover:scale-105 transition-transform"
                        >
                            Watch on YouTube
                        </a>
                    </div>
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        className="flex-1 w-full"
                    >
                        <div className="relative rounded-3xl overflow-hidden border border-white/10 shadow-2xl">
                            <iframe
                                className="aspect-video w-full"
                                src="https://www.youtube.com/embed/nfUD0WhE264"
                                title="Media Stack Walkthrough"
                                allowFullScreen
                            />
                        </div>
                    </motion.div>
                </div>
            </div>
        </section>
    )
}
