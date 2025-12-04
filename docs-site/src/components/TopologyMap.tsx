import { motion } from 'framer-motion'
import { Cloud, Lock, Server, Database, Globe, Shield } from 'lucide-react'

export function TopologyMap() {
    const nodes = [
        { id: 'internet', label: 'Internet', icon: Globe, x: 100, y: 150, color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/20' },
        // Top Path (Secure Access)
        { id: 'cf', label: 'Cloudflare', icon: Cloud, x: 250, y: 80, color: 'text-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-500/20' },
        { id: 'auth', label: 'Authelia', icon: Lock, x: 400, y: 80, color: 'text-indigo-400', bg: 'bg-indigo-500/10', border: 'border-indigo-500/20' },
        { id: 'traefik', label: 'Traefik', icon: Server, x: 550, y: 80, color: 'text-purple-400', bg: 'bg-purple-500/10', border: 'border-purple-500/20' },
        // Bottom Path (Privacy)
        { id: 'vpn', label: 'VPN', icon: Shield, x: 400, y: 220, color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
        // Destination
        { id: 'apps', label: 'Media Apps', icon: Database, x: 700, y: 150, color: 'text-pink-400', bg: 'bg-pink-500/10', border: 'border-pink-500/20' },
    ]

    const edges = [
        // User Access Flow
        { from: 'internet', to: 'cf', label: 'User Traffic' },
        { from: 'cf', to: 'auth' },
        { from: 'auth', to: 'traefik' },
        { from: 'traefik', to: 'apps' },
        // Content Flow
        { from: 'internet', to: 'vpn', label: 'Encrypted Content', dashed: true },
        { from: 'vpn', to: 'apps', dashed: true },
    ]

    return (
        <div className="w-full overflow-x-auto pb-4">
            <div className="min-w-[800px] h-[350px] relative bg-[#0a0a0a] rounded-xl border border-white/10 overflow-hidden shadow-2xl">
                {/* Background Grid */}
                <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]" />
                <div className="absolute inset-0 bg-[radial-gradient(circle_800px_at_50%_50%,rgba(120,119,198,0.1),transparent)]" />

                {/* Flow Labels */}
                <div className="absolute top-4 left-0 right-0 flex justify-center gap-16 text-xs font-medium uppercase tracking-wider">
                    <div className="flex items-center gap-2 text-indigo-400/80">
                        <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
                        Secure User Access
                    </div>
                    <div className="flex items-center gap-2 text-emerald-400/80">
                        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                        Private Downloads
                    </div>
                </div>

                <svg className="absolute inset-0 w-full h-full pointer-events-none">
                    <defs>
                        <linearGradient id="access-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                            <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.2" />
                            <stop offset="50%" stopColor="#8b5cf6" stopOpacity="0.8" />
                            <stop offset="100%" stopColor="#ec4899" stopOpacity="0.2" />
                        </linearGradient>
                        <linearGradient id="privacy-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                            <stop offset="0%" stopColor="#10b981" stopOpacity="0.2" />
                            <stop offset="50%" stopColor="#34d399" stopOpacity="0.8" />
                            <stop offset="100%" stopColor="#10b981" stopOpacity="0.2" />
                        </linearGradient>
                    </defs>

                    {edges.map((edge, i) => {
                        const start = nodes.find(n => n.id === edge.from)!
                        const end = nodes.find(n => n.id === edge.to)!
                        const isPrivacy = edge.from === 'vpn' || edge.to === 'vpn'

                        return (
                            <g key={i}>
                                {/* Base Line */}
                                <motion.line
                                    x1={start.x}
                                    y1={start.y}
                                    x2={end.x}
                                    y2={end.y}
                                    stroke={isPrivacy ? "url(#privacy-gradient)" : "url(#access-gradient)"}
                                    strokeWidth="2"
                                    strokeDasharray={edge.dashed ? "4,4" : "0"}
                                    initial={{ pathLength: 0, opacity: 0 }}
                                    animate={{ pathLength: 1, opacity: 0.4 }}
                                    transition={{ duration: 1.5, delay: i * 0.2 }}
                                />
                                {/* Animated Particle */}
                                <circle r="3" fill={isPrivacy ? "#34d399" : "#8b5cf6"}>
                                    <animateMotion
                                        dur={isPrivacy ? "3s" : "2s"}
                                        repeatCount="indefinite"
                                        path={`M${start.x},${start.y} L${end.x},${end.y}`}
                                    />
                                </circle>
                            </g>
                        )
                    })}
                </svg>

                {nodes.map((node, i) => {
                    const Icon = node.icon
                    return (
                        <motion.div
                            key={node.id}
                            className="absolute transform -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-3 group"
                            style={{ left: node.x, top: node.y }}
                            initial={{ scale: 0, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            transition={{ delay: i * 0.1, type: "spring", stiffness: 200, damping: 20 }}
                        >
                            <div className={`
                                relative p-4 rounded-2xl backdrop-blur-md shadow-lg transition-all duration-300
                                ${node.bg} ${node.border} border
                                group-hover:scale-110 group-hover:shadow-[0_0_30px_-5px_rgba(255,255,255,0.3)]
                            `}>
                                <div className={`absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 bg-gradient-to-br from-white/10 to-transparent`} />
                                <Icon className={`w-8 h-8 ${node.color}`} />

                                {/* Pulse Effect for Internet and Apps */}
                                {(node.id === 'internet' || node.id === 'apps') && (
                                    <div className={`absolute inset-0 rounded-2xl animate-ping opacity-20 ${node.bg}`} />
                                )}
                            </div>

                            <span className={`
                                text-xs font-semibold tracking-wide px-3 py-1 rounded-full 
                                bg-[#0a0a0a]/80 border border-white/10 backdrop-blur-sm
                                ${node.color}
                            `}>
                                {node.label}
                            </span>
                        </motion.div>
                    )
                })}
            </div>
        </div>
    )
}
