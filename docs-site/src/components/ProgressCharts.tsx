import { useState } from 'react'
import { motion } from 'framer-motion'
import { BarChart3, TrendingUp, CheckCircle } from 'lucide-react'

interface ChartData {
  label: string
  value: number
  color: string
}

export function ProgressCharts() {
  const [selectedChart, setSelectedChart] = useState<'completion' | 'timeline' | 'health'>('completion')

  const completionData: ChartData[] = [
    { label: 'Core Infrastructure', value: 100, color: 'bg-emerald-500' },
    { label: 'Media Services', value: 85, color: 'bg-blue-500' },
    { label: 'Security Setup', value: 92, color: 'bg-purple-500' },
    { label: 'Automation', value: 78, color: 'bg-orange-500' },
    { label: 'Monitoring', value: 95, color: 'bg-cyan-500' },
  ]

  const timelineData: ChartData[] = [
    { label: 'Week 1', value: 65, color: 'bg-primary' },
    { label: 'Week 2', value: 82, color: 'bg-primary' },
    { label: 'Week 3', value: 91, color: 'bg-primary' },
    { label: 'Week 4', value: 88, color: 'bg-primary' },
  ]

  const healthData: ChartData[] = [
    { label: 'Services Online', value: 12, color: 'bg-emerald-500' },
    { label: 'Services Pending', value: 2, color: 'bg-yellow-500' },
    { label: 'Services Issues', value: 1, color: 'bg-red-500' },
  ]

  const renderChart = (data: ChartData[], type: 'bar' | 'pie' = 'bar') => {
    if (type === 'pie') {
      const total = data.reduce((sum, item) => sum + item.value, 0)
      
      return (
        <div className="flex justify-center mb-6">
          <div className="relative w-48 h-48">
            <svg className="w-full h-full transform -rotate-90">
              {data.map((item) => {
                const percentage = (item.value / total) * 100
                const radius = 80
                const circumference = 2 * Math.PI * radius
                
                return (
                  <circle
                    key={item.label}
                    cx="96"
                    cy="96"
                    r={radius}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="16"
                    className={`${item.color} transition-all duration-1000`}
                    strokeDasharray={`${percentage * circumference / 100} ${circumference}`}
                  />
                )
              })}
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <p className="text-2xl font-bold text-white">{total}</p>
                <p className="text-xs text-muted-foreground">Total</p>
              </div>
            </div>
          </div>
        </div>
      )
    }

    return (
      <div className="space-y-4">
        {data.map((item, index) => (
          <div key={item.label} className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm text-white">{item.label}</span>
              <span className="text-sm font-mono text-muted-foreground">{item.value}%</span>
            </div>
            <div className="w-full bg-white/10 rounded-full h-3 overflow-hidden">
              <motion.div
                className={`h-full ${item.color} rounded-full`}
                initial={{ width: 0 }}
                animate={{ width: `${item.value}%` }}
                transition={{ duration: 1, delay: index * 0.1 }}
              />
            </div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <section className="py-16 bg-black/30" id="analytics">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold mb-4">Progress Analytics</h2>
          <p className="text-muted-foreground">Visual insights into your deployment progress</p>
        </div>

        <div className="flex justify-center gap-4 mb-8">
          {[
            { id: 'completion', label: 'Completion Status', icon: CheckCircle },
            { id: 'timeline', label: 'Timeline Progress', icon: TrendingUp },
            { id: 'health', label: 'Service Health', icon: BarChart3 },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setSelectedChart(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
                selectedChart === tab.id
                  ? 'bg-primary/20 border border-primary/30'
                  : 'glass border border-white/10 hover:border-primary/30'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              <span className="text-sm">{tab.label}</span>
            </button>
          ))}
        </div>

        <motion.div
          key={selectedChart}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass border border-white/10 rounded-2xl p-8"
        >
          {selectedChart === 'completion' && renderChart(completionData)}
          {selectedChart === 'timeline' && renderChart(timelineData)}
          {selectedChart === 'health' && renderChart(healthData, 'pie')}

          <div className="mt-6 pt-6 border-t border-white/10">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-emerald-400">87%</p>
                <p className="text-xs text-muted-foreground">Overall Progress</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-blue-400">12/15</p>
                <p className="text-xs text-muted-foreground">Services Online</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-purple-400">2.3s</p>
                <p className="text-xs text-muted-foreground">Avg Response</p>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  )
}
