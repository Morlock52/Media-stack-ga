import { useState } from 'react'
import { motion } from 'framer-motion'
import { Bell, X, CheckCircle, AlertTriangle, Info, Settings } from 'lucide-react'

interface Notification {
  id: string
  type: 'success' | 'warning' | 'info' | 'error'
  title: string
  message: string
  timestamp: Date
  read: boolean
}

export function NotificationCenter() {
  const [isOpen, setIsOpen] = useState(false)
  const [notifications, setNotifications] = useState<Notification[]>([
    {
      id: '1',
      type: 'success',
      title: 'Authelia Configuration Complete',
      message: 'SSO authentication has been successfully configured with 2FA enabled.',
      timestamp: new Date(Date.now() - 1000 * 60 * 5),
      read: false,
    },
    {
      id: '2',
      type: 'info',
      title: 'New Service Available',
      message: 'Audiobookshelf has been added to the roadmap for Q2 2025.',
      timestamp: new Date(Date.now() - 1000 * 60 * 30),
      read: false,
    },
    {
      id: '3',
      type: 'warning',
      title: 'VPN Connection Alert',
      message: 'qBittorrent external IP verification required - please confirm VPN routing.',
      timestamp: new Date(Date.now() - 1000 * 60 * 60),
      read: true,
    },
    {
      id: '4',
      type: 'success',
      title: 'Watchtower Update Complete',
      message: '3 containers updated successfully: Plex, Sonarr, Radarr.',
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2),
      read: true,
    },
  ])

  const unreadCount = notifications.filter(n => !n.read).length

  const markAsRead = (id: string) => {
    setNotifications(prev => prev.map(n => 
      n.id === id ? { ...n, read: true } : n
    ))
  }

  const markAllAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })))
  }

  const getIcon = (type: Notification['type']) => {
    switch (type) {
      case 'success': return CheckCircle
      case 'warning': return AlertTriangle
      case 'error': return AlertTriangle
      case 'info': return Info
      default: return Bell
    }
  }

  const getIconColor = (type: Notification['type']) => {
    switch (type) {
      case 'success': return 'text-emerald-400'
      case 'warning': return 'text-yellow-400'
      case 'error': return 'text-red-400'
      case 'info': return 'text-blue-400'
      default: return 'text-gray-400'
    }
  }

  const formatTimestamp = (date: Date) => {
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const minutes = Math.floor(diff / 60000)
    const hours = Math.floor(diff / 3600000)
    
    if (minutes < 60) return `${minutes}m ago`
    if (hours < 24) return `${hours}h ago`
    return date.toLocaleDateString()
  }

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-lg glass border border-white/10 hover:border-primary/30 transition-all"
        aria-label="Notifications"
        title="View notifications"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-primary text-white text-xs rounded-full flex items-center justify-center">
            {unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <motion.div
          initial={{ opacity: 0, y: 10, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          className="absolute top-full mt-2 right-0 w-96 max-w-[calc(100vw-2rem)] glass border border-white/20 rounded-xl z-50 max-h-[calc(100dvh-6rem)] overflow-hidden flex flex-col"
        >
          <div className="p-4 border-b border-white/10">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-white">Notifications</h3>
              <div className="flex items-center gap-2">
                {unreadCount > 0 && (
                  <button
                    onClick={markAllAsRead}
                    className="text-xs text-primary hover:text-primary/80 transition-colors"
                  >
                    Mark all read
                  </button>
                )}
                <button
                  onClick={() => setIsOpen(false)}
                  aria-label="Close notifications"
                  title="Close notifications"
                  className="p-1 rounded hover:bg-white/10 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          <div className="min-h-0 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                <Bell className="w-8 h-8 mx-auto mb-4 opacity-50" />
                <p>No notifications</p>
              </div>
            ) : (
              notifications.map((notification) => {
                const Icon = getIcon(notification.type)
                return (
                  <motion.div
                    key={notification.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className={`p-4 border-b border-white/5 hover:bg-white/5 transition-colors cursor-pointer ${
                      !notification.read ? 'bg-primary/5' : ''
                    }`}
                    onClick={() => markAsRead(notification.id)}
                  >
                    <div className="flex gap-3">
                      <Icon className={`w-5 h-5 mt-0.5 flex-shrink-0 ${getIconColor(notification.type)}`} />
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-white text-sm">{notification.title}</h4>
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                          {notification.message}
                        </p>
                        <p className="text-xs text-muted-foreground mt-2 font-mono">
                          {formatTimestamp(notification.timestamp)}
                        </p>
                      </div>
                      {!notification.read && (
                        <div className="w-2 h-2 bg-primary rounded-full flex-shrink-0 mt-2" />
                      )}
                    </div>
                  </motion.div>
                )
              })
            )}
          </div>

          <div className="p-3 border-t border-white/10">
            <button className="w-full flex items-center justify-center gap-2 text-xs text-muted-foreground hover:text-white transition-colors">
              <Settings className="w-3 h-3" />
              <span>Notification Settings</span>
            </button>
          </div>
        </motion.div>
      )}
    </div>
  )
}
