import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ServiceCard } from './ServiceCard';
import { RefreshCw, Server, Cpu, Activity } from 'lucide-react';
import { controlServer } from '../../utils/controlServer';

interface Container {
    id: string;
    name: string;
    status: string;
    state: string;
    ports: string;
}

export function DashboardBentoGrid() {
    const [containers, setContainers] = useState<Container[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchData = async () => {
        try {
            const data = await controlServer.getContainers();
            setContainers(data);
            setError(null);
        } catch (err) {
            console.error('Failed to fetch containers:', err);
            setError('Failed to connect to Control Server');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
        const interval = setInterval(fetchData, 5000); // Poll every 5s
        return () => clearInterval(interval);
    }, []);

    const handleAction = async (serviceName: string, action: string) => {
        try {
            if (action === 'logs') {
                // TODO: Open logs modal
                console.log('View logs for', serviceName);
                return;
            }
            await controlServer.serviceAction(serviceName, action as any);
            fetchData(); // Refresh immediately
        } catch (err) {
            console.error(`Failed to ${action} ${serviceName}:`, err);
        }
    };

    // Calculate stats
    const runningCount = containers.filter(c => c.state === 'running').length;
    const totalCount = containers.length;
    const healthScore = totalCount > 0 ? Math.round((runningCount / totalCount) * 100) : 0;

    return (
        <section className="py-8 container mx-auto px-4">
            {/* Header Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                <StatCard label="Services Online" value={`${runningCount}/${totalCount}`} icon={Server} color="text-emerald-400" />
                <StatCard label="System Health" value={`${healthScore}%`} icon={Activity} color={healthScore > 80 ? "text-emerald-400" : "text-yellow-400"} />
                <StatCard label="CPU Usage" value="12%" icon={Cpu} color="text-blue-400" />
                <StatCard label="Last Updated" value="Just now" icon={RefreshCw} color="text-gray-400" />
            </div>

            {/* Bento Grid */}
            {loading ? (
                <div className="flex justify-center py-20">
                    <RefreshCw className="w-8 h-8 animate-spin text-primary" />
                </div>
            ) : error ? (
                <div className="text-center py-20 text-red-400 bg-red-500/10 rounded-3xl border border-red-500/20">
                    <p>{error}</p>
                    <button onClick={fetchData} className="mt-4 px-4 py-2 bg-red-500/20 rounded-lg hover:bg-red-500/30 transition">Retry Connection</button>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 auto-rows-[200px]">
                    <AnimatePresence>
                        {containers.map((container, index) => (
                            <motion.div
                                key={container.id}
                                layout
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.9 }}
                                transition={{ duration: 0.2 }}
                                className={getGridSpan(index)}
                            >
                                <ServiceCard
                                    name={container.name}
                                    status={container.status}
                                    state={container.state}
                                    ports={container.ports}
                                    onAction={(action) => handleAction(container.name, action)}
                                />
                            </motion.div>
                        ))}
                    </AnimatePresence>
                </div>
            )}
        </section>
    );
}

function StatCard({ label, value, icon: Icon, color }: any) {
    return (
        <div className="glass p-4 rounded-2xl border border-white/5 flex items-center gap-4">
            <div className={`p-3 rounded-xl bg-white/5 ${color}`}>
                <Icon className="w-5 h-5" />
            </div>
            <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">{label}</p>
                <p className="text-xl font-bold">{value}</p>
            </div>
        </div>
    );
}

// Helper to make the grid interesting (some cards span 2 cols)
function getGridSpan(index: number) {
    // Every 7th item spans 2 cols
    if ((index + 1) % 7 === 0) return "md:col-span-2";
    return "col-span-1";
}
