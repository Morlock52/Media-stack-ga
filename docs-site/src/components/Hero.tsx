import { motion } from 'framer-motion'
import { ArrowRight, Play, Copy, Check } from 'lucide-react'
import { useState } from 'react'

export function Hero() {
    const [copied, setCopied] = useState(false)

    const copyCommand = () => {
        navigator.clipboard.writeText('./setup.sh')
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
    }

    const scrollToDocs = () => {
        document.getElementById('docs')?.scrollIntoView({ behavior: 'smooth' })
    }

    const scrollToTerminal = () => {
        document.getElementById('terminal')?.scrollIntoView({ behavior: 'smooth' })
    }

    return (
        <section className="relative min-h-screen flex items-center justify-center overflow-hidden pt-20">
            {/* Background Effects */}
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-primary/20 via-background to-background z-0" />
            <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 z-0 mix-blend-overlay" />

            <div className="container mx-auto px-4 relative z-10 grid lg:grid-cols-2 gap-12 items-center">
                {/* Text Content */}
                <motion.div
                    initial={{ opacity: 0, x: -50 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.8, ease: "easeOut" }}
                    className="space-y-8"
                >
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-background/60 border border-border backdrop-blur-sm">
                        <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                        </span>
                        <span className="text-xs font-medium text-muted-foreground">#1 on r/selfhosted · Featured on Product Hunt</span>
                    </div>

                    <h1 className="text-5xl md:text-7xl font-bold tracking-tight leading-tight">
                        The Ultimate <br />
                        <span className="text-gradient-primary">Media Stack</span>
                    </h1>

                    <p className="text-lg text-muted-foreground max-w-xl leading-relaxed">
                        Deploy a complete, secure, and automated media server in minutes.
                        Featuring Authelia SSO, Cloudflare Tunnel, Tdarr workflows, Notifiarr broadcasts, and a beautiful gum-powered TUI.
                        Everything inside mirrors the verification flow in <code>plan.md</code>.
                    </p>

                    <div className="flex flex-wrap gap-4">
                        <button
                            onClick={scrollToDocs}
                            className="group relative px-8 py-4 bg-primary text-white rounded-xl font-semibold overflow-hidden transition-all hover:scale-105 hover:shadow-[0_0_40px_-10px_var(--primary)]"
                        >
                            <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
                            <span className="relative flex items-center gap-2">
                                Get Started <ArrowRight className="w-4 h-4" />
                            </span>
                        </button>

                        <button
                            onClick={scrollToTerminal}
                            className="px-8 py-4 bg-background/60 border border-border text-foreground rounded-xl font-medium hover:bg-muted/80 transition-colors flex items-center gap-2"
                        >
                            <Play className="w-4 h-4 fill-current" /> Watch Demo
                        </button>
                        <a
                            href="https://discord.gg/mediastack"
                            target="_blank"
                            rel="noreferrer noopener"
                            className="px-8 py-4 border border-border text-foreground rounded-xl font-medium hover:bg-muted/80 transition-colors flex items-center gap-2"
                        >
                            Join Discord
                        </a>
                    </div>

                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <div className="flex -space-x-2">
                            {['PH', 'R/', 'GH'].map((label) => (
                                <div key={label} className="w-8 h-8 rounded-full bg-background/60 border border-border flex items-center justify-center text-[10px] font-semibold text-foreground">
                                    {label}
                                </div>
                            ))}
                        </div>
                        <p>Trending on Product Hunt, r/selfhosted, and GitHub Discussions this week.</p>
                    </div>
                </motion.div>

                {/* Interactive Terminal */}
                <motion.div
                    id="terminal"
                    initial={{ opacity: 0, y: 50 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8, delay: 0.2 }}
                    className="relative"
                >
                    <div className="absolute -inset-1 bg-gradient-to-r from-primary to-purple-600 rounded-2xl blur-2xl opacity-30 animate-pulse-glow" />
                    <div className="relative bg-card border border-border rounded-xl overflow-hidden shadow-2xl">
                        {/* Terminal Header */}
                        <div className="flex items-center gap-2 px-4 py-3 bg-muted/60 border-b border-border">
                            <div className="flex gap-2">
                                <div className="w-3 h-3 rounded-full bg-red-500/80" />
                                <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
                                <div className="w-3 h-3 rounded-full bg-green-500/80" />
                            </div>
                            <div className="flex-1 text-center text-xs text-muted-foreground font-mono">setup.sh — bash — 80x24</div>
                        </div>

                        {/* Terminal Body */}
                        <div className="p-6 font-mono text-sm space-y-2 min-h-[300px]">
                            <div className="flex items-center justify-between group">
                                <div className="flex gap-2">
                                    <span className="text-green-500">➜</span>
                                    <span className="text-blue-400">~</span>
                                    <span className="text-foreground/80">./setup.sh</span>
                                </div>
                                <button
                                    onClick={copyCommand}
                                    className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground"
                                    title="Copy command"
                                >
                                    {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                                </button>
                            </div>

                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ delay: 1 }}
                                className="text-muted-foreground"
                            >
                                Installing 'gum' for a beautiful setup experience...
                            </motion.div>

                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ delay: 2 }}
                                className="border-2 border-pink-500/50 p-4 rounded-lg mt-4 text-center"
                            >
                                <div className="text-pink-500 font-bold text-lg mb-2">Media Stack Setup</div>
                                <div className="text-gray-300">Initial Configuration</div>
                            </motion.div>

                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ delay: 3 }}
                                className="mt-4"
                            >
                                <div className="text-purple-400">Configuration</div>
                                <div className="flex items-center gap-2 mt-2">
                                    <span className="text-muted-foreground">Domain Name:</span>
                                    <span className="text-foreground bg-muted/60 border border-border px-2 py-0.5 rounded animate-pulse">example.com|</span>
                                </div>
                            </motion.div>
                        </div>
                    </div>
                </motion.div>
            </div>
        </section>
    )
}
