import { motion } from 'framer-motion'
import { Github, Users, Shield, Activity } from 'lucide-react'

const stats = [
    {
        icon: Github,
        label: 'GitHub stars',
        value: '4.2k',
        subtext: 'Open-source community love',
    },
    {
        icon: Users,
        label: 'Discord members',
        value: '8.1k',
        subtext: 'Real-time support & ops chat',
    },
    {
        icon: Shield,
        label: 'Protected services',
        value: '22',
        subtext: 'Behind Authelia + Cloudflare',
    },
    {
        icon: Activity,
        label: 'Verified deployments',
        value: '12k+',
        subtext: 'Across homelabs & studios',
    },
]

export function StatsBar() {
    return (
        <section className="container mx-auto px-4 -mt-16 mb-16">
            <div className="glass border border-white/10 rounded-3xl p-6 md:p-8 backdrop-blur">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    {stats.map((stat, index) => (
                        <motion.div
                            key={stat.label}
                            initial={{ opacity: 0, y: 10 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ delay: index * 0.1 }}
                            className="flex items-center gap-4"
                        >
                            <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center">
                                <stat.icon className="w-6 h-6 text-primary" />
                            </div>
                            <div>
                                <p className="text-3xl font-bold text-white leading-none">{stat.value}</p>
                                <p className="text-sm uppercase tracking-widest text-muted-foreground">{stat.label}</p>
                                <p className="text-xs text-muted-foreground/80">{stat.subtext}</p>
                            </div>
                        </motion.div>
                    ))}
                </div>
            </div>
        </section>
    )
}
