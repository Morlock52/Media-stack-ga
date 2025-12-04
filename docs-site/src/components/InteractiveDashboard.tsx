import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { CheckCircle, Users, Activity, Zap } from 'lucide-react'

interface KPIMetric {
  label: string
  value: number
  total: number
  trend: 'up' | 'down' | 'stable'
  icon: any
}

export function InteractiveDashboard() {
  const [metrics, setMetrics] = useState<KPIMetric[]>([
    { label: 'Services Online', value: 12, total: 15, trend: 'up', icon: CheckCircle },
    { label: 'Integration Tests', value: 8, total: 10, trend: 'up', icon: Zap },
    { label: 'Active Users', value: 3, total: 5, trend: 'stable', icon: Users },
    { label: 'Health Score', value: 85, total: 100, trend: 'up', icon: Activity },
  ])

  const [selectedMetric, setSelectedMetric] = useState<string | null>(null)

  useEffect(() => {
    const interval = setInterval(() => {
      setMetrics(prev => prev.map(metric => ({
        ...metric,
        value: Math.min(metric.total, Math.max(0, metric.value + (Math.random() > 0.5 ? 1 : -1)))
      })))
    }, 5000)
    return () => clearInterval(interval)
  }, [])

  return (
    <section className="py-16 bg-gradient-to-br from-primary/5 to-secondary/5">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold mb-4">Real-Time Stack Dashboard</h2>
          <p className="text-muted-foreground">Live monitoring of your media stack deployment</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {metrics.map((metric, index) => (
            <motion.div
              key={metric.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className={`glass border rounded-2xl p-6 cursor-pointer transition-all ${
                selectedMetric === metric.label ? 'border-primary/50 bg-primary/10' : 'border-white/10 hover:border-primary/30'
              }`}
              onClick={() => setSelectedMetric(selectedMetric === metric.label ? null : metric.label)}
            >
              <div className="flex items-center justify-between mb-4">
                <metric.icon className="w-8 h-8 text-primary" />
                <span className={`text-xs font-mono px-2 py-1 rounded ${
                  metric.trend === 'up' ? 'bg-emerald-500/20 text-emerald-400' :
                  metric.trend === 'down' ? 'bg-red-500/20 text-red-400' :
                  'bg-gray-500/20 text-gray-400'
                }`}>
                  {metric.trend === 'up' ? '↗' : metric.trend === 'down' ? '↘' : '→'}
                </span>
              </div>
              <div className="space-y-2">
                <p className="text-2xl font-bold text-white">{metric.value}/{metric.total}</p>
                <p className="text-sm text-muted-foreground">{metric.label}</p>
                <div className="w-full bg-white/10 rounded-full h-2">
                  <motion.div
                    className="bg-primary h-2 rounded-full"
                    initial={{ width: 0 }}
                    animate={{ width: `${(metric.value / metric.total) * 100}%` }}
                    transition={{ duration: 1, delay: index * 0.1 }}
                  />
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {selectedMetric && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass border border-white/10 rounded-2xl p-6"
          >
            <h3 className="text-xl font-bold mb-4">{selectedMetric} Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="text-center">
                <p className="text-3xl font-bold text-primary">85%</p>
                <p className="text-sm text-muted-foreground">Completion Rate</p>
              </div>
              <div className="text-center">
                <p className="text-3xl font-bold text-emerald-400">2.3s</p>
                <p className="text-sm text-muted-foreground">Avg Response Time</p>
              </div>
              <div className="text-center">
                <p className="text-3xl font-bold text-blue-400">99.9%</p>
                <p className="text-sm text-muted-foreground">Uptime</p>
              </div>
            </div>
          </motion.div>
        )}
      </div>
    </section>
  )
}
