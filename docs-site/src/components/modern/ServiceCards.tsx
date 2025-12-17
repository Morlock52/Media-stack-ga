import { motion } from 'framer-motion'
import { Server, Play, Music, Tv, Shield, Globe, ChevronRight } from 'lucide-react'

const services = [
  {
    icon: Server,
    title: 'Core Infrastructure',
    description: 'Docker, Authelia SSO, Cloudflare Tunnel',
    status: 'critical',
    config: '.env, authelia.yml, cloudflared.yml',
    commands: [
      'cp .env.fixed.template .env',
      'docker-compose config',
      'docker-compose up -d'
    ],
    color: 'from-red-500 to-orange-500'
  },
  {
    icon: Play,
    title: 'Media Servers',
    description: 'Plex & Jellyfin for streaming',
    status: 'essential',
    config: 'PLEX_CLAIM, hardware acceleration',
    commands: [
      'curl -k http://localhost:32400/web',
      'curl -k http://localhost:8096'
    ],
    color: 'from-blue-500 to-purple-500'
  },
  {
    icon: Tv,
    title: 'Automation Stack',
    description: 'Sonarr, Radarr, Prowlarr',
    status: 'essential',
    config: 'Volume mappings, indexer setup',
    commands: [
      'docker-compose logs sonarr',
      'docker-compose logs radarr'
    ],
    color: 'from-green-500 to-teal-500'
  },
  {
    icon: Music,
    title: 'Music & Books',
    description: 'Lidarr, Readarr, Audiobookshelf',
    status: 'optional',
    config: 'Audio quality, library paths',
    commands: [
      'docker-compose logs lidarr',
      'docker-compose logs readarr'
    ],
    color: 'from-purple-500 to-pink-500'
  },
  {
    icon: Shield,
    title: 'Security & VPN',
    description: 'Gluetun VPN, secure passwords',
    status: 'critical',
    config: 'VPN endpoint, credentials',
    commands: [
      'docker-compose logs gluetun',
      'curl ipinfo.io'
    ],
    color: 'from-emerald-500 to-green-500'
  },
  {
    icon: Globe,
    title: 'Remote Access',
    description: 'Cloudflare Tunnel, domain setup',
    status: 'critical',
    config: 'Domain, tunnel token',
    commands: [
      'docker-compose logs cloudflared',
      'nslookup yourdomain.com'
    ],
    color: 'from-cyan-500 to-blue-500'
  }
]

const statusConfig: Record<string, { color: string; bg: string; border: string }> = {
  critical: { color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/30' },
  essential: { color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/30' },
  optional: { color: 'text-muted-foreground', bg: 'bg-muted/40', border: 'border-border' }
}

export function ServiceCards() {
  const copyCommand = async (command: string) => {
    await navigator.clipboard.writeText(command)
    // In a real app, show a toast notification
    console.log('Copied:', command)
  }

  const configureService = (serviceName: string) => {
    // In a real app, navigate to service configuration or open modal
    console.log('Configuring:', serviceName)
    // Could scroll to implementation section or open config modal
    document.getElementById('implementation')?.scrollIntoView({ behavior: 'smooth' })
  }
  return (
    <section className="py-24 bg-background">
      <div className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          className="text-center mb-16"
        >
          <h2 className="text-4xl md:text-5xl font-bold mb-6">
            <span className="bg-gradient-to-r from-white to-blue-200 bg-clip-text text-transparent">
              Service Architecture
            </span>
          </h2>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            Every service, configuration, and command you need to deploy a complete media stack.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-7xl mx-auto">
          {services.map((service, index) => {
            const Icon = service.icon
            const status = statusConfig[service.status]

            return (
              <motion.div
                key={service.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className="group"
              >
                <div className="h-full glass-card rounded-2xl overflow-hidden">
                  {/* Header */}
                  <div className={`p-6 bg-gradient-to-r ${service.color}`}>
                    <div className="flex items-center justify-between mb-4">
                      <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center">
                        <Icon className="w-6 h-6 text-white" />
                      </div>
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${status.bg} ${status.border} ${status.color}`}>
                        {service.status}
                      </span>
                    </div>

                    <h3 className="text-xl font-bold text-white mb-2">{service.title}</h3>
                    <p className="text-white/80 text-sm">{service.description}</p>
                  </div>

                  {/* Content */}
                  <div className="p-6 space-y-4">
                    {/* Configuration */}
                    <div>
                      <h4 className="text-sm font-semibold text-foreground/80 mb-2">Configuration</h4>
                      <div className="bg-muted/60 rounded-lg p-3 border border-border">
                        <code className="text-xs text-muted-foreground font-mono">{service.config}</code>
                      </div>
                    </div>

                    {/* Commands */}
                    <div>
                      <h4 className="text-sm font-semibold text-foreground/80 mb-2">Verification Commands</h4>
                      <div className="space-y-2">
                        {service.commands.map((cmd, cmdIndex) => (
                          <div key={cmdIndex} className="bg-muted/60 border border-border rounded-lg p-2 flex items-center justify-between group hover:bg-muted/80 transition-colors">
                            <code className="text-xs text-muted-foreground font-mono truncate flex-1">{cmd}</code>
                            <button
                              onClick={() => copyCommand(cmd)}
                              className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-muted/80"
                              title="Copy command"
                            >
                              <ChevronRight className="w-3 h-3 text-muted-foreground" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Action button */}
                    <button
                      onClick={() => configureService(service.title)}
                      className="w-full py-3 rounded-xl bg-gradient-to-r from-purple-600/20 to-blue-600/20 border border-purple-500/30 text-purple-300 font-medium hover:from-purple-600/30 hover:to-blue-600/30 hover:border-purple-500/50 transition-all duration-300"
                      title="Configure this service"
                    >
                      Configure Service
                    </button>
                  </div>
                </div>
              </motion.div>
            )
          })}
        </div>

        {/* Status overview */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="mt-16 max-w-4xl mx-auto"
        >
          <div className="glass-panel rounded-2xl p-8">
            <h3 className="text-2xl font-bold text-foreground mb-6">Deployment Status</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="text-center">
                <div className="w-16 h-16 rounded-full bg-red-500/20 border-2 border-red-500/50 flex items-center justify-center mx-auto mb-3">
                  <Server className="w-8 h-8 text-red-400" />
                </div>
                <h4 className="font-semibold text-foreground mb-1">Critical Services</h4>
                <p className="text-sm text-muted-foreground">Core infrastructure & security</p>
              </div>

              <div className="text-center">
                <div className="w-16 h-16 rounded-full bg-blue-500/20 border-2 border-blue-500/50 flex items-center justify-center mx-auto mb-3">
                  <Play className="w-8 h-8 text-blue-400" />
                </div>
                <h4 className="font-semibold text-foreground mb-1">Essential Services</h4>
                <p className="text-sm text-muted-foreground">Media servers & automation</p>
              </div>

              <div className="text-center">
                <div className="w-16 h-16 rounded-full bg-gray-500/20 border-2 border-gray-500/50 flex items-center justify-center mx-auto mb-3">
                  <Music className="w-8 h-8 text-gray-400" />
                </div>
                <h4 className="font-semibold text-foreground mb-1">Optional Services</h4>
                <p className="text-sm text-muted-foreground">Music, books & extras</p>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  )
}
