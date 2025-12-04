import { motion } from 'framer-motion';
import { Activity, Box, RefreshCw, Power } from 'lucide-react';

interface ServiceCardProps {
    name: string;
    status: string;
    state: string;
    ports: string;
    onAction: (action: string) => void;
}

export function ServiceCard({ name, state, ports, onAction }: ServiceCardProps) {
    const isRunning = state === 'running';


    return (
        <motion.div
            whileHover={{ scale: 1.02, rotateX: 2, rotateY: 2 }}
            className={`
                relative overflow-hidden rounded-3xl p-6
                backdrop-blur-xl border border-white/10
                bg-gradient-to-br from-white/5 to-white/0
                shadow-[0_8px_32px_0_rgba(31,38,135,0.37)]
                group transition-all duration-300
                ${isRunning ? 'hover:border-emerald-500/30' : 'hover:border-red-500/30'}
            `}
        >
            {/* Dynamic Background Gradient */}
            <div className={`
                absolute inset-0 opacity-0 group-hover:opacity-20 transition-opacity duration-500
                bg-gradient-to-br ${isRunning ? 'from-emerald-500 to-cyan-500' : 'from-red-500 to-orange-500'}
            `} />

            {/* Content */}
            <div className="relative z-10 flex flex-col h-full justify-between">
                <div className="flex justify-between items-start mb-4">
                    <div className="p-3 rounded-2xl bg-white/5 border border-white/10 group-hover:scale-110 transition-transform">
                        <Box className={`w-6 h-6 ${isRunning ? 'text-emerald-400' : 'text-red-400'}`} />
                    </div>
                    <div className={`
                        px-3 py-1 rounded-full text-xs font-mono border
                        ${isRunning
                            ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                            : 'bg-red-500/10 border-red-500/20 text-red-400'}
                    `}>
                        {state.toUpperCase()}
                    </div>
                </div>

                <div>
                    <h3 className="text-xl font-bold text-white mb-1 capitalize">{name}</h3>
                    <p className="text-xs text-muted-foreground font-mono truncate" title={ports}>
                        {ports || 'No ports exposed'}
                    </p>
                </div>

                {/* Micro-interactions / Actions */}
                <div className="mt-6 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300 transform translate-y-2 group-hover:translate-y-0">
                    <button
                        onClick={(e) => { e.stopPropagation(); onAction('restart'); }}
                        className="p-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/20 transition-colors"
                        title="Restart"
                    >
                        <RefreshCw className="w-4 h-4 text-blue-400" />
                    </button>
                    <button
                        onClick={(e) => { e.stopPropagation(); onAction(isRunning ? 'stop' : 'start'); }}
                        className="p-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/20 transition-colors"
                        title={isRunning ? 'Stop' : 'Start'}
                    >
                        <Power className={`w-4 h-4 ${isRunning ? 'text-red-400' : 'text-emerald-400'}`} />
                    </button>
                    <button
                        onClick={(e) => { e.stopPropagation(); onAction('logs'); }}
                        className="p-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/20 transition-colors"
                        title="View Logs"
                    >
                        <Activity className="w-4 h-4 text-yellow-400" />
                    </button>
                </div>
            </div>
        </motion.div>
    );
}
