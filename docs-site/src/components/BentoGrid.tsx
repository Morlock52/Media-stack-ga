import { motion } from 'framer-motion'
import { Shield, Globe, Layers, Terminal, Waves, Bell } from 'lucide-react'

const features = [
    {
        title: "Secure by Default",
        description: "Authelia SSO & 2FA integrated out of the box.",
        icon: Shield,
        className: "md:col-span-2",
        gradient: "from-blue-500/20 to-cyan-500/20"
    },
    {
        title: "Global Access",
        description: "Cloudflare Tunnel for secure remote access without open ports.",
        icon: Globe,
        className: "md:col-span-1",
        gradient: "from-purple-500/20 to-pink-500/20"
    },
    {
        title: "Automated Media",
        description: "Sonarr, Radarr, Prowlarr, Bazarr, and Overseerr orchestrated per TRaSH guides.",
        icon: Layers,
        className: "md:col-span-1",
        gradient: "from-orange-500/20 to-red-500/20"
    },
    {
        title: "Beautiful TUI",
        description: "Interactive setup script with Gum for a premium experience.",
        icon: Terminal,
        className: "md:col-span-2",
        gradient: "from-green-500/20 to-emerald-500/20"
    },
    {
        title: "Smart Transcoding",
        description: "Tdarr pipelines keep storage lean with GPU-friendly H.265 recipes.",
        icon: Waves,
        className: "md:col-span-1",
        gradient: "from-teal-500/20 to-blue-500/20"
    },
    {
        title: "Signal Everywhere",
        description: "Notifiarr pushes Discord/Slack/Telegram alerts for every Arr action.",
        icon: Bell,
        className: "md:col-span-1",
        gradient: "from-pink-500/20 to-yellow-500/20"
    },
]

export function BentoGrid() {
    return (
        <section id="features" className="py-24 container mx-auto px-4">
            <div className="text-center mb-16 space-y-4">
                <h2 className="text-3xl md:text-5xl font-bold">Everything you need</h2>
                <p className="text-muted-foreground max-w-2xl mx-auto">
                    A complete, production-ready stack designed for performance, security, and ease of use.
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-6xl mx-auto">
                {features.map((feature, index) => (
                    <motion.div
                        key={index}
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ delay: index * 0.1 }}
                        className={`relative group overflow-hidden rounded-3xl border border-white/10 bg-secondary/30 backdrop-blur-sm p-8 hover:border-primary/50 transition-colors ${feature.className}`}
                    >
                        <div className={`absolute inset-0 bg-gradient-to-br ${feature.gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-500`} />

                        <div className="relative z-10 h-full flex flex-col justify-between">
                            <div className="mb-4 p-3 bg-white/5 w-fit rounded-2xl border border-white/10">
                                <feature.icon className="w-6 h-6 text-white" />
                            </div>

                            <div>
                                <h3 className="text-xl font-bold mb-2">{feature.title}</h3>
                                <p className="text-muted-foreground">{feature.description}</p>
                            </div>
                        </div>
                    </motion.div>
                ))}
            </div>
        </section>
    )
}
