import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
    CheckCircle, ExternalLink, Copy, Check, ChevronDown, ChevronRight,
    Server, Key, Shield, Tv, Bell, Activity, Settings,
    Terminal, Clock, Sparkles
} from 'lucide-react'
import { useSetupStore } from '../store/setupStore'

interface ChecklistItem {
    id: string
    title: string
    description: string
    icon: any
    steps: string[]
    links?: { label: string; url: string }[]
    command?: string
    estimatedTime?: string
    condition?: (services: string[]) => boolean
}

const checklistItems: ChecklistItem[] = [
    {
        id: 'deploy',
        title: 'Deploy Your Stack',
        description: 'Run the docker-compose command to start all services',
        icon: Server,
        estimatedTime: '5-10 min',
        steps: [
            'Place all downloaded files in your server directory (e.g., /srv/mediastack)',
            'Open a terminal and navigate to that directory',
            'Run the command below to start all services',
            'Wait for all containers to download and start'
        ],
        command: 'docker compose --profile all up -d'
    },
    {
        id: 'plex-claim',
        title: 'Claim Your Plex Server',
        description: 'Link Plex to your account (do this within 4 minutes of starting)',
        icon: Tv,
        estimatedTime: '2 min',
        condition: (services) => services.includes('plex'),
        steps: [
            'Go to plex.tv/claim and copy your claim token',
            'Add it to your .env file as PLEX_CLAIM=claim-xxxx',
            'Restart the Plex container: docker compose restart plex',
            'Access Plex at http://your-server:32400/web'
        ],
        links: [
            { label: 'Get Plex Claim Token', url: 'https://www.plex.tv/claim/' }
        ]
    },
    {
        id: 'arr-api-keys',
        title: 'Get *Arr API Keys',
        description: 'Each Arr service generates its own API key after first start',
        icon: Key,
        estimatedTime: '5 min',
        condition: (services) => services.includes('arr'),
        steps: [
            'Open each *Arr service in your browser (ports: Sonarr 8989, Radarr 7878, Prowlarr 9696)',
            'Go to Settings → General in each service',
            'Copy the API Key shown there',
            'Add each key to your .env file',
            'These keys let services communicate with each other'
        ],
        links: [
            { label: 'Sonarr (TV)', url: 'http://localhost:8989' },
            { label: 'Radarr (Movies)', url: 'http://localhost:7878' },
            { label: 'Prowlarr (Indexers)', url: 'http://localhost:9696' }
        ]
    },
    {
        id: 'prowlarr-setup',
        title: 'Configure Prowlarr Indexers',
        description: 'Add indexers (search sources) to Prowlarr',
        icon: Settings,
        estimatedTime: '10 min',
        condition: (services) => services.includes('arr'),
        steps: [
            'Open Prowlarr at http://localhost:9696',
            'Go to Indexers → Add Indexer',
            'Add your preferred indexers (public or private)',
            'Go to Settings → Apps and add Sonarr and Radarr',
            'Prowlarr will sync indexers to all your *Arr apps automatically'
        ]
    },
    {
        id: 'vpn-setup',
        title: 'Configure VPN (Gluetun)',
        description: 'Set up your VPN provider for secure downloads',
        icon: Shield,
        estimatedTime: '10 min',
        condition: (services) => services.includes('vpn'),
        steps: [
            'Get WireGuard credentials from your VPN provider',
            'Add WIREGUARD_PRIVATE_KEY to your .env file',
            'Add WIREGUARD_ADDRESSES (usually like 10.x.x.x/32)',
            'Restart gluetun: docker compose restart gluetun',
            'Verify VPN is working: docker exec gluetun wget -qO- ifconfig.me'
        ],
        links: [
            { label: 'Gluetun Wiki', url: 'https://github.com/qdm12/gluetun-wiki' }
        ]
    },
    {
        id: 'cloudflare',
        title: 'Set Up Remote Access (Optional)',
        description: 'Configure Cloudflare Tunnel for secure remote access',
        icon: ExternalLink,
        estimatedTime: '15 min',
        steps: [
            'Create a free Cloudflare account if you don\'t have one',
            'Go to Zero Trust → Networks → Tunnels',
            'Create a new tunnel and copy the token',
            'Add CLOUDFLARE_TUNNEL_TOKEN to your .env file',
            'Configure which services to expose in the Cloudflare dashboard'
        ],
        links: [
            { label: 'Cloudflare Zero Trust', url: 'https://one.dash.cloudflare.com/' }
        ]
    },
    {
        id: 'notifications',
        title: 'Configure Notifications',
        description: 'Set up Notifiarr for alerts about your media',
        icon: Bell,
        estimatedTime: '5 min',
        condition: (services) => services.includes('notify'),
        steps: [
            'Create a free account at notifiarr.com',
            'Generate an API key in your Notifiarr dashboard',
            'Add the key to each *Arr service under Settings → Connect',
            'Choose what events you want notifications for'
        ],
        links: [
            { label: 'Notifiarr', url: 'https://notifiarr.com/' }
        ]
    },
    {
        id: 'verify',
        title: 'Verify Everything Works',
        description: 'Final checks to make sure your stack is healthy',
        icon: Activity,
        estimatedTime: '5 min',
        steps: [
            'Run: docker compose ps (all containers should be "running")',
            'Check container logs for errors: docker compose logs -f',
            'Access each service web UI and verify it loads',
            'Try adding a movie/show in Radarr/Sonarr to test the full flow'
        ],
        command: 'docker compose ps && docker compose logs --tail=50'
    }
]

export function PostInstallChecklist() {
    const { selectedServices } = useSetupStore()
    const [completed, setCompleted] = useState<Set<string>>(new Set())
    const [expanded, setExpanded] = useState<string | null>('deploy')
    const [copied, setCopied] = useState<string | null>(null)

    const filteredItems = checklistItems.filter(
        item => !item.condition || item.condition(selectedServices)
    )

    const toggleComplete = (id: string) => {
        setCompleted(prev => {
            const next = new Set(prev)
            if (next.has(id)) {
                next.delete(id)
            } else {
                next.add(id)
            }
            return next
        })
    }

    const copyToClipboard = (text: string, id: string) => {
        navigator.clipboard.writeText(text)
        setCopied(id)
        setTimeout(() => setCopied(null), 2000)
    }

    const progress = (completed.size / filteredItems.length) * 100

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                        <Sparkles className="w-5 h-5 text-purple-400" />
                        Post-Installation Checklist
                    </h3>
                    <p className="text-sm text-gray-400 mt-1">
                        Complete these steps after downloading your config files
                    </p>
                </div>
                <div className="text-right">
                    <div className="text-2xl font-bold text-white">{completed.size}/{filteredItems.length}</div>
                    <div className="text-xs text-gray-500">steps completed</div>
                </div>
            </div>

            {/* Progress Bar */}
            <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                <motion.div
                    className="h-full bg-gradient-to-r from-green-500 to-emerald-500"
                    initial={{ width: 0 }}
                    animate={{ width: `${progress}%` }}
                    transition={{ duration: 0.5 }}
                />
            </div>

            {/* Checklist Items */}
            <div className="space-y-3">
                {filteredItems.map((item, index) => {
                    const Icon = item.icon
                    const isCompleted = completed.has(item.id)
                    const isExpanded = expanded === item.id

                    return (
                        <motion.div
                            key={item.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.05 }}
                            className={`rounded-xl border transition-all ${
                                isCompleted
                                    ? 'bg-green-500/5 border-green-500/20'
                                    : 'bg-white/5 border-white/10 hover:border-white/20'
                            }`}
                        >
                            {/* Item Header */}
                            <div className="w-full px-4 py-3 flex items-center gap-3 text-left">
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation()
                                        toggleComplete(item.id)
                                    }}
                                    className={`w-6 h-6 rounded-full flex items-center justify-center transition-all ${
                                        isCompleted
                                            ? 'bg-green-500 text-white'
                                            : 'border-2 border-gray-600 hover:border-purple-500'
                                    }`}
                                    title={isCompleted ? 'Mark as incomplete' : 'Mark as complete'}
                                    aria-label={isCompleted ? 'Mark as incomplete' : 'Mark as complete'}
                                >
                                    {isCompleted && <Check className="w-4 h-4" />}
                                </button>

                                <div className={`p-2 rounded-lg ${
                                    isCompleted ? 'bg-green-500/20 text-green-400' : 'bg-white/5 text-gray-400'
                                }`}>
                                    <Icon className="w-4 h-4" />
                                </div>

                                <div className="flex-1">
                                    <div className={`font-medium ${isCompleted ? 'text-green-300 line-through' : 'text-white'}`}>
                                        {item.title}
                                    </div>
                                    <div className="text-xs text-gray-500">{item.description}</div>
                                </div>

                                {item.estimatedTime && (
                                    <div className="flex items-center gap-1 text-xs text-gray-500">
                                        <Clock className="w-3 h-3" />
                                        {item.estimatedTime}
                                    </div>
                                )}

                                <button
                                    onClick={() => setExpanded(isExpanded ? null : item.id)}
                                    className="p-1 hover:bg-white/10 rounded transition-colors"
                                    title={isExpanded ? 'Collapse details' : 'Expand details'}
                                    aria-label={isExpanded ? 'Collapse details' : 'Expand details'}
                                >
                                    {isExpanded ? (
                                        <ChevronDown className="w-4 h-4 text-gray-500" />
                                    ) : (
                                        <ChevronRight className="w-4 h-4 text-gray-500" />
                                    )}
                                </button>
                            </div>

                            {/* Expanded Content */}
                            <AnimatePresence>
                                {isExpanded && (
                                    <motion.div
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: 'auto', opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }}
                                        className="overflow-hidden"
                                    >
                                        <div className="px-4 pb-4 pt-2 border-t border-white/5 ml-9">
                                            {/* Steps */}
                                            <ol className="space-y-2 mb-4">
                                                {item.steps.map((step, i) => (
                                                    <li key={i} className="flex items-start gap-2 text-sm text-gray-300">
                                                        <span className="w-5 h-5 rounded-full bg-purple-500/20 text-purple-300 flex items-center justify-center flex-shrink-0 text-xs font-medium">
                                                            {i + 1}
                                                        </span>
                                                        {step}
                                                    </li>
                                                ))}
                                            </ol>

                                            {/* Command */}
                                            {item.command && (
                                                <div className="mb-4">
                                                    <div className="flex items-center gap-2 mb-2">
                                                        <Terminal className="w-3 h-3 text-gray-500" />
                                                        <span className="text-xs text-gray-500">Command</span>
                                                    </div>
                                                    <div className="flex items-center gap-2 bg-black/40 rounded-lg p-2 font-mono text-xs text-green-400">
                                                        <code className="flex-1 overflow-x-auto">{item.command}</code>
                                                        <button
                                                            onClick={() => copyToClipboard(item.command!, item.id)}
                                                            className="p-1.5 hover:bg-white/10 rounded transition-colors"
                                                            title="Copy command"
                                                            aria-label="Copy command to clipboard"
                                                        >
                                                            {copied === item.id ? (
                                                                <Check className="w-3 h-3 text-green-400" />
                                                            ) : (
                                                                <Copy className="w-3 h-3 text-gray-500" />
                                                            )}
                                                        </button>
                                                    </div>
                                                </div>
                                            )}

                                            {/* Links */}
                                            {item.links && item.links.length > 0 && (
                                                <div className="flex flex-wrap gap-2">
                                                    {item.links.map((link, i) => (
                                                        <a
                                                            key={i}
                                                            href={link.url}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 rounded-lg text-xs text-blue-300 transition-colors"
                                                        >
                                                            {link.label}
                                                            <ExternalLink className="w-3 h-3" />
                                                        </a>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </motion.div>
                    )
                })}
            </div>

            {/* Completion Message */}
            {completed.size === filteredItems.length && (
                <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="p-4 bg-gradient-to-r from-green-500/10 to-emerald-500/10 border border-green-500/20 rounded-xl text-center"
                >
                    <CheckCircle className="w-8 h-8 text-green-400 mx-auto mb-2" />
                    <h4 className="text-lg font-semibold text-white mb-1">All Done!</h4>
                    <p className="text-sm text-gray-400">
                        Your media stack is fully configured. Enjoy!
                    </p>
                </motion.div>
            )}
        </div>
    )
}
