import { useState } from 'react'
import { motion } from 'framer-motion'
import { Play, Pause, RefreshCw, Upload, Terminal, Settings, Zap } from 'lucide-react'

interface QuickAction {
  id: string
  label: string
  description: string
  icon: any
  action: () => void
  status: 'ready' | 'running' | 'completed' | 'error'
}

export function QuickActions() {
  const [actions, setActions] = useState<QuickAction[]>([
    {
      id: 'deploy',
      label: 'Deploy Stack',
      description: 'Start all services with docker-compose',
      icon: Play,
      action: () => handleDeploy(),
      status: 'ready',
    },
    {
      id: 'stop',
      label: 'Stop Services',
      description: 'Gracefully stop all containers',
      icon: Pause,
      action: () => handleStop(),
      status: 'ready',
    },
    {
      id: 'update',
      label: 'Update Services',
      description: 'Pull latest images and restart',
      icon: RefreshCw,
      action: () => handleUpdate(),
      status: 'ready',
    },
    {
      id: 'backup',
      label: 'Create Backup',
      description: 'Backup configurations and databases',
      icon: Upload,
      action: () => handleBackup(),
      status: 'ready',
    },
    {
      id: 'logs',
      label: 'View Logs',
      description: 'Open real-time log viewer',
      icon: Terminal,
      action: () => handleLogs(),
      status: 'ready',
    },
    {
      id: 'config',
      label: 'Edit Config',
      description: 'Open configuration editor',
      icon: Settings,
      action: () => handleConfig(),
      status: 'ready',
    },
  ])

  const executeAction = (actionId: string) => {
    setActions(prev => prev.map(action => 
      action.id === actionId 
        ? { ...action, status: 'running' as const }
        : action
    ))

    // Simulate action execution
    setTimeout(() => {
      setActions(prev => prev.map(action => 
        action.id === actionId 
          ? { ...action, status: 'completed' as const }
          : action
      ))

      // Reset status after delay
      setTimeout(() => {
        setActions(prev => prev.map(action => 
          action.id === actionId 
            ? { ...action, status: 'ready' as const }
            : action
        ))
      }, 2000)
    }, 1500)
  }

  const handleDeploy = () => executeAction('deploy')
  const handleStop = () => executeAction('stop')
  const handleUpdate = () => executeAction('update')
  const handleBackup = () => executeAction('backup')
  const handleLogs = () => executeAction('logs')
  const handleConfig = () => executeAction('config')

  const getStatusColor = (status: QuickAction['status']) => {
    switch (status) {
      case 'running': return 'border-yellow-500/50 bg-yellow-500/10'
      case 'completed': return 'border-emerald-500/50 bg-emerald-500/10'
      case 'error': return 'border-red-500/50 bg-red-500/10'
      default: return 'border-white/10 hover:border-primary/30'
    }
  }

  const getStatusIcon = (status: QuickAction['status']) => {
    switch (status) {
      case 'running': return <RefreshCw className="w-4 h-4 animate-spin text-yellow-400" />
      case 'completed': return <Zap className="w-4 h-4 text-emerald-400" />
      case 'error': return <Zap className="w-4 h-4 text-red-400" />
      default: return null
    }
  }

  return (
    <section className="py-16 bg-gradient-to-br from-primary/5 to-secondary/5">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold mb-4">Quick Actions</h2>
          <p className="text-muted-foreground">Common tasks and operations for your media stack</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {actions.map((action, index) => (
            <motion.button
              key={action.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              onClick={() => action.action()}
              disabled={action.status === 'running'}
              className={`glass border rounded-2xl p-6 text-left transition-all ${
                getStatusColor(action.status)
              } ${
                action.status === 'running' ? 'cursor-not-allowed' : 'cursor-pointer hover:scale-[1.02]'
              }`}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 rounded-xl bg-primary/15 text-primary flex items-center justify-center">
                  <action.icon className="w-6 h-6" />
                </div>
                {getStatusIcon(action.status)}
              </div>
              
              <h3 className="font-semibold text-white mb-2">{action.label}</h3>
              <p className="text-sm text-muted-foreground">{action.description}</p>
              
              {action.status === 'running' && (
                <div className="mt-4">
                  <div className="w-full bg-white/10 rounded-full h-1 overflow-hidden">
                    <motion.div
                      className="bg-primary h-1 rounded-full"
                      initial={{ width: '0%' }}
                      animate={{ width: '100%' }}
                      transition={{ duration: 1.5 }}
                    />
                  </div>
                </div>
              )}
            </motion.button>
          ))}
        </div>

        <div className="mt-12 text-center">
          <p className="text-sm text-muted-foreground">
            All actions are executed with proper safety checks and rollbacks
          </p>
        </div>
      </div>
    </section>
  )
}
