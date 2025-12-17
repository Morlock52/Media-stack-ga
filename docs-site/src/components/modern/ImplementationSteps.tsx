import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Check, Copy, Terminal, FileText, Shield, ChevronRight, AlertTriangle, Info } from 'lucide-react'

interface Step {
  id: string
  title: string
  description: string
  type: 'code' | 'config' | 'verify'
  content: string // Expert/Full content
  newbieContent?: string // Simplified content for newbies
  completed: boolean
}

const steps: Step[] = [
  {
    id: 'env',
    title: 'Core: Environment Setup',
    description: 'Secure secrets and domain configuration',
    type: 'config',
    content: `# 1. Copy the template
cp .env.fixed.template .env

# 2. Generate secure secrets
# Run these commands to generate strong keys:
openssl rand -base64 32 # For JWT_SECRET, SESSION_SECRET, etc.

# 3. Edit .env file
nano .env

# REQUIRED CHANGES:
# - DOMAIN=yourdomain.com
# - TIMEZONE=America/New_York
# - AUTHELIA_IDENTITY_VALIDATION_RESET_PASSWORD_JWT_SECRET=<generated_key>
# - AUTHELIA_SESSION_SECRET=<generated_key>
# - AUTHELIA_STORAGE_ENCRYPTION_KEY=<generated_key>
# - REDIS_PASSWORD=<generated_key>
# - CLOUDFLARE_TUNNEL_TOKEN=<your_token>`,
    newbieContent: `# 1. Copy the configuration template
cp .env.fixed.template .env

# 2. Open the configuration file
nano .env

# 3. Fill in your Domain and Cloudflare Token
# (The file has comments to help you!)`,
    completed: false
  },
  {
    id: 'authelia',
    title: 'Core: Authentication',
    description: 'Configure Authelia SSO & 2FA',
    type: 'config',
    content: `# Edit Authelia configuration
nano config/authelia/configuration.yml

# CRITICAL UPDATES:
# 1. Update domain references:
#    default_redirection_url: https://auth.yourdomain.com
# 2. Update CORS origins:
#    - https://yourdomain.com
#    - https://auth.yourdomain.com
# 3. Ensure Redis password matches .env`,
    newbieContent: `# Open Authelia config
nano config/authelia/configuration.yml

# Replace 'example.com' with your actual domain
# throughout the file.`,
    completed: false
  },
  {
    id: 'cloudflared',
    title: 'Core: Cloudflare Tunnel',
    description: 'Expose services securely',
    type: 'config',
    content: `# Edit Cloudflare Tunnel config
nano config/cloudflared/config.yml

# Define ingress rules for your services:
# - hostname: hub.yourdomain.com
#   service: http://homepage:3000
# - hostname: auth.yourdomain.com
#   service: http://authelia:9091
# ... map other services as needed`,
    newbieContent: `# Open Tunnel config
nano config/cloudflared/config.yml

# Update the hostnames to match your domain.
# e.g., change 'hub.example.com' to 'hub.yourdomain.com'`,
    completed: false
  },
  {
    id: 'media-server',
    title: 'Media: Plex / Jellyfin',
    description: 'Setup media servers',
    type: 'verify',
    content: `# VERIFICATION CHECKS:

# Plex:
# - Claim Token: Ensure PLEX_CLAIM is set in .env if new.
# - URL: http://localhost:32400/web

# Jellyfin:
# - Hardware Accel: Check /dev/dri mapping if using Intel QuickSync.
# - URL: http://localhost:8096

# SHARED:
# - Verify both see: /movies, /tv, /music`,
    newbieContent: `# 1. Start the stack (next step)
# 2. Open Plex: http://localhost:32400/web
# 3. Open Jellyfin: http://localhost:8096`,
    completed: false
  },
  {
    id: 'arr-stack',
    title: 'Media: The *Arr Stack',
    description: 'Sonarr, Radarr, Prowlarr setup',
    type: 'verify',
    content: `# VERIFICATION CHECKS:

# Volume Mappings:
# Ensure /tv, /movies, /downloads are consistent across all apps.

# Prowlarr (Indexer Manager):
# - URL: http://localhost:9696
# - Add FlareSolverr proxy: http://flaresolverr:8191
# - Connect to Sonarr/Radarr (Settings > Apps)

# Sonarr (TV) / Radarr (Movies):
# - URL: http://localhost:8989 / http://localhost:7878
# - Verify Root Folders match volume mappings`,
    newbieContent: `# Access your media managers:
# Sonarr (TV): http://localhost:8989
# Radarr (Movies): http://localhost:7878
# Prowlarr (Indexers): http://localhost:9696`,
    completed: false
  },
  {
    id: 'download',
    title: 'Media: Download Client',
    description: 'qBittorrent & VPN',
    type: 'verify',
    content: `# VERIFICATION CHECKS:

# qBittorrent:
# - URL: http://localhost:8080
# - Default Creds: admin / adminadmin (CHANGE IMMEDIATELY)
# - Network Interface: tun0 (Ensure it's using Gluetun VPN)

# Gluetun (VPN):
# - Check logs to confirm VPN connection:
#   docker-compose logs gluetun`,
    newbieContent: `# Open qBittorrent:
# http://localhost:8080

# Login with default: admin / adminadmin
# CHANGE PASSWORD IMMEDIATELY!`,
    completed: false
  },
  {
    id: 'deploy',
    title: 'Deploy Stack',
    description: 'Launch all services',
    type: 'code',
    content: `# 1. Validate configuration
docker-compose -f docker-compose.fixed.yml config

# 2. Start the stack (Detached mode)
docker-compose -f docker-compose.fixed.yml up -d

# 3. Check logs for issues
docker-compose logs -f`,
    newbieContent: `# Start everything!
docker-compose -f docker-compose.fixed.yml up -d`,
    completed: false
  },
  {
    id: 'verify-all',
    title: 'Final Verification',
    description: 'Ensure everything works',
    type: 'verify',
    content: `# MANUAL CHECKLIST:

# 1. Homepage: https://hub.yourdomain.com
#    - Should load and show all services up.

# 2. Authelia: https://auth.yourdomain.com
#    - Should show login page.

# 3. External Access:
#    - Try accessing a service from outside your network (e.g. phone on 5G).
#    - Should hit Authelia login first.

# 4. Media Playback:
#    - Play a video in Plex/Jellyfin to test transcoding.`,
    newbieContent: `# Go to your dashboard:
# https://hub.yourdomain.com

# If it loads, you're done!`,
    completed: false
  }
]

export function ImplementationSteps() {
  const [activeStep, setActiveStep] = useState(0)
  const [isNewbieMode, setIsNewbieMode] = useState(true)
  const [copiedCode, setCopiedCode] = useState<string | null>(null)

  const copyCode = async (code: string, stepId: string) => {
    await navigator.clipboard.writeText(code)
    setCopiedCode(stepId)
    setTimeout(() => setCopiedCode(null), 2000)
  }

  const getIcon = (type: Step['type']) => {
    switch (type) {
      case 'code': return Terminal
      case 'config': return FileText
      case 'verify': return Shield
      default: return Terminal
    }
  }

  const getTypeColor = (type: Step['type']) => {
    switch (type) {
      case 'code': return 'from-blue-500/20 to-cyan-500/20 border-blue-500/30'
      case 'config': return 'from-purple-500/20 to-pink-500/20 border-purple-500/30'
      case 'verify': return 'from-emerald-500/20 to-green-500/20 border-emerald-500/30'
      default: return 'from-gray-500/20 to-gray-500/20 border-gray-500/30'
    }
  }

  const currentContent = isNewbieMode
    ? (steps[activeStep].newbieContent || steps[activeStep].content)
    : steps[activeStep].content

  return (
    <section className="py-24 bg-background relative overflow-hidden">
      {/* Background Elements */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 -left-64 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 -right-64 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl" />
      </div>

      <div className="container mx-auto px-4 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          className="text-center mb-16"
        >
          <h2 className="text-4xl md:text-5xl font-bold mb-6">
            <span className="bg-gradient-to-r from-white to-purple-200 bg-clip-text text-transparent">
              Implementation Guide
            </span>
          </h2>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto mb-8">
            Follow these steps to build your ultimate media server.
          </p>

          {/* Mode Toggle */}
          <div className="flex justify-center">
            <div className="bg-muted/40 backdrop-blur-sm border border-border p-1 rounded-xl inline-flex items-center gap-2">
              <button
                onClick={() => setIsNewbieMode(true)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-300 ${isNewbieMode
                  ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white shadow-lg'
                  : 'text-muted-foreground hover:text-foreground'
                  }`}
              >
                Newbie Mode
              </button>
              <button
                onClick={() => setIsNewbieMode(false)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-300 ${!isNewbieMode
                  ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white shadow-lg'
                  : 'text-muted-foreground hover:text-foreground'
                  }`}
              >
                Expert Mode
              </button>
            </div>
          </div>

          <AnimatePresence mode="wait">
            {isNewbieMode && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-4 text-sm text-purple-300 flex items-center justify-center gap-2"
              >
                <Info className="w-4 h-4" />
                <span>Simplified instructions for a quick start. Switch to Expert for full details.</span>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        <div className="grid lg:grid-cols-12 gap-8 max-w-7xl mx-auto">
          {/* Step Navigation - Sticky Sidebar */}
          <div className="lg:col-span-4 space-y-4 lg:sticky lg:top-24 lg:h-[calc(100vh-8rem)] lg:overflow-y-auto pr-2 custom-scrollbar">
            {steps.map((step, index) => {
              const Icon = getIcon(step.type)
              const isActive = index === activeStep

              return (
                <motion.button
                  key={step.id}
                  onClick={() => setActiveStep(index)}
                  className={`w-full text-left p-4 rounded-xl border transition-all duration-300 group ${isActive
                    ? `bg-gradient-to-r ${getTypeColor(step.type)} shadow-lg`
                    : 'bg-muted/40 border-border hover:bg-muted/60 hover:border-border'
                    }`}
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center transition-colors ${isActive ? 'bg-white/20' : 'bg-muted/40 group-hover:bg-muted/60'
                      }`}>
                      <Icon className={`w-5 h-5 ${isActive ? 'text-white' : 'text-muted-foreground'}`} />
                    </div>

                    <div className="flex-1 min-w-0">
                      <h3 className={`font-semibold truncate ${isActive ? 'text-white' : 'text-foreground'}`}>
                        {step.title}
                      </h3>
                      <p className={`text-xs truncate ${isActive ? 'text-white/80' : 'text-muted-foreground'}`}>
                        {step.description}
                      </p>
                    </div>

                    {isActive && (
                      <ChevronRight className="w-5 h-5 text-white/50" />
                    )}
                  </div>
                </motion.button>
              )
            })}
          </div>

          {/* Step Content */}
          <motion.div
            key={activeStep + (isNewbieMode ? '-newbie' : '-expert')}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3 }}
            className="lg:col-span-8"
          >
            <div className="glass-panel rounded-2xl overflow-hidden">
              {/* Header */}
              <div className="p-8 border-b border-border bg-muted/40">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-3 mb-2">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium border ${steps[activeStep].type === 'code' ? 'bg-blue-500/20 border-blue-500/30 text-blue-300' :
                        steps[activeStep].type === 'config' ? 'bg-purple-500/20 border-purple-500/30 text-purple-300' :
                          'bg-emerald-500/20 border-emerald-500/30 text-emerald-300'
                        }`}>
                        {steps[activeStep].type.toUpperCase()}
                      </span>
                      <h3 className="text-2xl font-bold text-foreground">{steps[activeStep].title}</h3>
                    </div>
                    <p className="text-muted-foreground text-lg">{steps[activeStep].description}</p>
                  </div>

                  <button
                    onClick={() => copyCode(currentContent, steps[activeStep].id)}
                    className="p-3 rounded-xl bg-muted/60 hover:bg-muted/80 transition-all duration-200 hover:scale-105 active:scale-95"
                    title="Copy content"
                  >
                    {copiedCode === steps[activeStep].id ? (
                      <Check className="w-5 h-5 text-emerald-400" />
                    ) : (
                      <Copy className="w-5 h-5 text-muted-foreground" />
                    )}
                  </button>
                </div>
              </div>

              {/* Content */}
              <div className="p-8">
                {!isNewbieMode && (
                  <div className="mb-6 p-4 rounded-xl bg-yellow-500/10 border border-yellow-500/20 flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-yellow-500 shrink-0 mt-0.5" />
                    <p className="text-sm text-yellow-200/80">
                      Expert Mode shows full configuration details. Be careful when editing production files.
                    </p>
                  </div>
                )}

                <div className="relative group">
                  <div className="absolute -inset-1 bg-gradient-to-r from-purple-600 to-blue-600 rounded-xl opacity-20 group-hover:opacity-30 transition duration-1000 blur-lg" />
                  <pre className="relative bg-card rounded-xl p-6 overflow-x-auto border border-border shadow-2xl">
                    <code className="text-sm md:text-base text-foreground/80 font-mono leading-relaxed whitespace-pre-wrap">
                      {currentContent}
                    </code>
                  </pre>
                </div>
              </div>

              {/* Footer Actions */}
              <div className="p-8 border-t border-border bg-muted/40 flex justify-between items-center">
                <button
                  onClick={() => setActiveStep(Math.max(0, activeStep - 1))}
                  disabled={activeStep === 0}
                  className="px-6 py-3 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted/60 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  Previous
                </button>

                <button
                  onClick={() => setActiveStep(Math.min(steps.length - 1, activeStep + 1))}
                  disabled={activeStep === steps.length - 1}
                  className="px-8 py-3 bg-gradient-to-r from-purple-600 to-blue-600 rounded-xl font-semibold text-white hover:shadow-lg hover:shadow-purple-500/25 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 transition-all duration-300 flex items-center gap-2"
                >
                  Next Step
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  )
}
