import { useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import {
    Zap,
    ChevronDown,
    ChevronUp,
    Copy,
    Check,
    ExternalLink,
    AlertCircle,
    CheckCircle,
    Info,
    Download,
    Shield,
} from 'lucide-react'
import { type VPNProvider } from '@/data/vpnProviders'
import { cn } from '@/lib/utils'

interface PortForwardingGuideProps {
    provider: VPNProvider
    className?: string
}

interface Step {
    title: string
    description: string
    code?: string
    note?: string
}

export function PortForwardingGuide({ provider, className }: PortForwardingGuideProps) {
    const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['provider-setup']))
    const [copiedCode, setCopiedCode] = useState<string | null>(null)

    if (!provider.portForwarding.supported) {
        return (
            <div className={cn('p-6 rounded-xl border border-border bg-card/40', className)}>
                <div className="flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
                    <div>
                        <h3 className="text-lg font-semibold text-foreground mb-2">
                            Port Forwarding Not Supported
                        </h3>
                        <p className="text-sm text-muted-foreground mb-3">
                            {provider.name} does not support port forwarding. This may limit your ability to seed
                            torrents effectively and could result in slower download speeds.
                        </p>
                        <p className="text-sm text-muted-foreground">
                            Consider switching to a VPN provider that supports port forwarding like Mullvad,
                            ProtonVPN, or Private Internet Access for better torrenting performance.
                        </p>
                    </div>
                </div>
            </div>
        )
    }

    const toggleSection = (section: string) => {
        setExpandedSections((prev) => {
            const next = new Set(prev)
            if (next.has(section)) {
                next.delete(section)
            } else {
                next.add(section)
            }
            return next
        })
    }

    const copyToClipboard = (text: string, id: string) => {
        navigator.clipboard.writeText(text)
        setCopiedCode(id)
        setTimeout(() => setCopiedCode(null), 2000)
    }

    // Provider-specific setup steps
    const getProviderSteps = (): Step[] => {
        switch (provider.id) {
            case 'mullvad':
                return [
                    {
                        title: 'Generate WireGuard Keys',
                        description:
                            'First, generate a WireGuard configuration from your Mullvad account page. This will create the necessary keys.',
                        note: 'Visit: https://mullvad.net/en/account/#/wireguard-config',
                    },
                    {
                        title: 'Assign a Port',
                        description:
                            'Navigate to the Ports section in your Mullvad account and assign a static port. Mullvad provides one port per account.',
                        note: 'Visit: https://mullvad.net/en/account/#/ports',
                    },
                    {
                        title: 'Note Your Port Number',
                        description:
                            'Copy the assigned port number (e.g., 51820). You will need this for qBittorrent configuration.',
                    },
                    {
                        title: 'Enable Port Forwarding in Gluetun',
                        description:
                            'Set the VPN_PORT_FORWARDING environment variable to "on" in your configuration.',
                        code: 'VPN_PORT_FORWARDING=on',
                    },
                ]

            case 'protonvpn':
                return [
                    {
                        title: 'Verify Your Plan',
                        description:
                            'Port forwarding is only available on ProtonVPN Plus or Unlimited plans. Free tier does not support port forwarding.',
                        note: 'Check your subscription at: https://account.protonvpn.com/account',
                    },
                    {
                        title: 'Use OpenVPN Protocol',
                        description:
                            'Port forwarding with ProtonVPN requires OpenVPN. WireGuard does NOT support port forwarding on ProtonVPN.',
                        code: 'VPN_TYPE=openvpn',
                    },
                    {
                        title: 'Add +pmp to Username',
                        description:
                            'Append "+pmp" to your OpenVPN username to enable NAT-PMP (Network Address Translation Port Mapping Protocol). This tells ProtonVPN to allocate a port for you.',
                        code: 'OPENVPN_USER=your-username+pmp',
                        note: 'Example: If your username is "user123", use "user123+pmp"',
                    },
                    {
                        title: 'Enable Port Forwarding in Gluetun',
                        description:
                            'Set the VPN_PORT_FORWARDING environment variable to "on". Gluetun will automatically request a port via NAT-PMP.',
                        code: 'VPN_PORT_FORWARDING=on',
                    },
                    {
                        title: 'Check Gluetun Logs for Port',
                        description:
                            'After Gluetun connects, check the logs to find your assigned port. ProtonVPN dynamically assigns ports via NAT-PMP.',
                        code: 'docker logs gluetun | grep -i "port forwarding"',
                        note: 'Look for a line like "port forwarding: listening on port 12345"',
                    },
                ]

            case 'pia':
                return [
                    {
                        title: 'Enable Port Forwarding',
                        description:
                            'Private Internet Access supports automatic port forwarding. Simply enable it in your Gluetun configuration.',
                        code: 'VPN_PORT_FORWARDING=on',
                    },
                    {
                        title: 'Port Assignment is Automatic',
                        description:
                            'PIA will automatically assign a port when you connect. Gluetun will detect and use this port.',
                        note: 'No manual port assignment needed - it's all handled automatically',
                    },
                    {
                        title: 'Check Gluetun Logs for Port',
                        description:
                            'After Gluetun connects, check the logs to see your assigned port number.',
                        code: 'docker logs gluetun | grep -i "port forwarding"',
                    },
                ]

            case 'airvpn':
            case 'ivpn':
                return [
                    {
                        title: 'Enable Port Forwarding',
                        description: `${provider.name} supports automatic port forwarding through Gluetun.`,
                        code: 'VPN_PORT_FORWARDING=on',
                    },
                    {
                        title: 'Check Provider Account',
                        description:
                            'Some providers require you to enable port forwarding in your account settings first. Check your provider dashboard.',
                        note: provider.portForwarding.setupUrl
                            ? `Visit: ${provider.portForwarding.setupUrl}`
                            : undefined,
                    },
                    {
                        title: 'Verify Port Assignment',
                        description: 'Check Gluetun logs to confirm port forwarding is active.',
                        code: 'docker logs gluetun | grep -i "port forwarding"',
                    },
                ]

            default:
                return [
                    {
                        title: 'Enable Port Forwarding',
                        description: 'Enable port forwarding in your Gluetun configuration.',
                        code: 'VPN_PORT_FORWARDING=on',
                    },
                    {
                        title: 'Check Provider Documentation',
                        description:
                            'Refer to your VPN provider documentation for specific port forwarding setup requirements.',
                        note: provider.portForwarding.setupUrl,
                    },
                ]
        }
    }

    const qbittorrentSteps: Step[] = [
        {
            title: 'Open qBittorrent Web UI',
            description:
                'Access the qBittorrent Web UI through your browser. If using Gluetun, qBittorrent should be using the VPN network.',
            note: 'URL: http://<server-ip>:8080 or https://qbt.yourdomain.com',
        },
        {
            title: 'Navigate to Connection Settings',
            description: 'Go to Tools → Options → Connection (or Settings → Connection)',
        },
        {
            title: 'Configure Listening Port',
            description:
                'Set the "Port used for incoming connections" to the port assigned by your VPN provider. Uncheck "Use UPnP / NAT-PMP" since the VPN handles port forwarding.',
            note: 'For ProtonVPN/PIA: Check Gluetun logs for the assigned port number',
        },
        {
            title: 'Disable UPnP/NAT-PMP in qBittorrent',
            description:
                'Make sure "Use UPnP / NAT-PMP port forwarding from my router" is UNCHECKED. This prevents conflicts with VPN port forwarding.',
        },
        {
            title: 'Test Your Connection',
            description:
                'Click "Test" button in the Connection settings to verify your port is properly forwarded. You should see a success message.',
            note: 'If the test fails, verify Gluetun is connected and port forwarding is active',
        },
        {
            title: 'Verify VPN Protection',
            description: 'Confirm qBittorrent is using the VPN IP address, not your real IP.',
            code: 'docker exec qbittorrent curl -s ifconfig.me',
            note: 'This should show your VPN IP, not your home IP',
        },
    ]

    const troubleshootingTips = [
        {
            issue: 'Port test fails in qBittorrent',
            solution:
                'Check Gluetun logs to confirm port forwarding is active. Restart both Gluetun and qBittorrent containers if needed.',
        },
        {
            issue: 'No port assigned in logs',
            solution:
                'Verify your VPN account supports port forwarding and that VPN_PORT_FORWARDING=on is set. For ProtonVPN, ensure you added "+pmp" to username.',
        },
        {
            issue: 'Port changes after restart',
            solution:
                'ProtonVPN and PIA assign dynamic ports. You may need to update qBittorrent settings after each restart. Mullvad provides static ports.',
        },
        {
            issue: 'Low upload/download speeds',
            solution:
                'Ensure port forwarding is working correctly. Without it, you can only connect to peers who have port forwarding enabled.',
        },
        {
            issue: 'qBittorrent shows "Firewalled"',
            solution:
                'This means incoming connections are blocked. Verify port forwarding is enabled in both Gluetun and qBittorrent, and that the port numbers match.',
        },
    ]

    const providerSteps = getProviderSteps()

    return (
        <div className={cn('space-y-4', className)}>
            {/* Header */}
            <div className="flex items-start gap-3">
                <div className="p-3 rounded-lg bg-emerald-500/20 text-emerald-400">
                    <Zap className="w-6 h-6" />
                </div>
                <div className="flex-1">
                    <h3 className="text-xl font-bold text-foreground mb-1">Port Forwarding Setup</h3>
                    <p className="text-sm text-muted-foreground">
                        {provider.portForwarding.automatic
                            ? 'Automatic port forwarding via Gluetun'
                            : 'Manual port forwarding configuration required'}
                    </p>
                    {provider.portForwarding.notes && (
                        <p className="text-sm text-muted-foreground mt-2 bg-blue-500/10 border border-blue-500/20 p-3 rounded-lg">
                            <Info className="w-4 h-4 inline-block mr-2" />
                            {provider.portForwarding.notes}
                        </p>
                    )}
                </div>
            </div>

            {/* Provider Setup Section */}
            <CollapsibleSection
                id="provider-setup"
                title={`${provider.name} Port Forwarding Setup`}
                icon={<Shield className="w-4 h-4" />}
                expanded={expandedSections.has('provider-setup')}
                onToggle={() => toggleSection('provider-setup')}
            >
                <div className="space-y-4">
                    {providerSteps.map((step, index) => (
                        <StepCard
                            key={index}
                            step={index + 1}
                            title={step.title}
                            description={step.description}
                            code={step.code}
                            note={step.note}
                            onCopy={step.code ? () => copyToClipboard(step.code!, `provider-${index}`) : undefined}
                            copied={copiedCode === `provider-${index}`}
                        />
                    ))}

                    {provider.portForwarding.setupUrl && (
                        <a
                            href={provider.portForwarding.setupUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 text-sm text-primary hover:text-primary/80 transition-colors"
                        >
                            View {provider.name} port forwarding documentation
                            <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                    )}
                </div>
            </CollapsibleSection>

            {/* qBittorrent Configuration Section */}
            <CollapsibleSection
                id="qbittorrent"
                title="qBittorrent Configuration"
                icon={<Download className="w-4 h-4" />}
                expanded={expandedSections.has('qbittorrent')}
                onToggle={() => toggleSection('qbittorrent')}
            >
                <div className="space-y-4">
                    {qbittorrentSteps.map((step, index) => (
                        <StepCard
                            key={index}
                            step={index + 1}
                            title={step.title}
                            description={step.description}
                            code={step.code}
                            note={step.note}
                            onCopy={step.code ? () => copyToClipboard(step.code!, `qbt-${index}`) : undefined}
                            copied={copiedCode === `qbt-${index}`}
                        />
                    ))}
                </div>
            </CollapsibleSection>

            {/* Gluetun Environment Variables Section */}
            <CollapsibleSection
                id="gluetun-env"
                title="Gluetun Environment Variables"
                icon={<Shield className="w-4 h-4" />}
                expanded={expandedSections.has('gluetun-env')}
                onToggle={() => toggleSection('gluetun-env')}
            >
                <div className="space-y-3">
                    <p className="text-sm text-muted-foreground">
                        Add these environment variables to your Gluetun container configuration:
                    </p>

                    <div className="space-y-2">
                        <EnvVarCard
                            varName="VPN_PORT_FORWARDING"
                            value="on"
                            description="Enables port forwarding in Gluetun"
                            onCopy={() => copyToClipboard('VPN_PORT_FORWARDING=on', 'env-pf')}
                            copied={copiedCode === 'env-pf'}
                        />

                        {provider.id === 'mullvad' && (
                            <EnvVarCard
                                varName="VPN_PORT_FORWARDING_PROVIDER"
                                value="port_forwarding"
                                description="Port forwarding implementation (optional, usually auto-detected)"
                                onCopy={() =>
                                    copyToClipboard('VPN_PORT_FORWARDING_PROVIDER=port_forwarding', 'env-pfp')
                                }
                                copied={copiedCode === 'env-pfp'}
                            />
                        )}

                        <div className="bg-muted/40 border border-border rounded-lg p-3">
                            <p className="text-sm text-muted-foreground">
                                These variables are automatically added to your <code className="text-xs">.env</code>{' '}
                                file when you enable port forwarding in the wizard.
                            </p>
                        </div>
                    </div>
                </div>
            </CollapsibleSection>

            {/* Troubleshooting Section */}
            <CollapsibleSection
                id="troubleshooting"
                title="Troubleshooting"
                icon={<AlertCircle className="w-4 h-4" />}
                expanded={expandedSections.has('troubleshooting')}
                onToggle={() => toggleSection('troubleshooting')}
            >
                <div className="space-y-3">
                    {troubleshootingTips.map((tip, index) => (
                        <div
                            key={index}
                            className="bg-muted/40 border border-border rounded-lg p-4"
                        >
                            <h5 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
                                <AlertCircle className="w-4 h-4 text-amber-400" />
                                {tip.issue}
                            </h5>
                            <p className="text-sm text-muted-foreground pl-6">{tip.solution}</p>
                        </div>
                    ))}

                    <div className="mt-4 bg-blue-500/10 border border-blue-500/20 p-3 rounded-lg">
                        <p className="text-sm text-blue-200">
                            <Info className="w-4 h-4 inline-block mr-2" />
                            For more help, check the{' '}
                            <a
                                href="https://github.com/qdm12/gluetun/wiki"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-primary hover:underline"
                            >
                                Gluetun Wiki
                            </a>{' '}
                            and {provider.name} documentation.
                        </p>
                    </div>
                </div>
            </CollapsibleSection>
        </div>
    )
}

// Collapsible Section Component
interface CollapsibleSectionProps {
    id: string
    title: string
    icon: React.ReactNode
    expanded: boolean
    onToggle: () => void
    children: React.ReactNode
}

function CollapsibleSection({ title, icon, expanded, onToggle, children }: CollapsibleSectionProps) {
    return (
        <div className="border border-border rounded-xl overflow-hidden bg-card/40">
            <button
                onClick={onToggle}
                className="w-full flex items-center justify-between p-4 hover:bg-muted/40 transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-inset"
                aria-expanded={expanded}
            >
                <div className="flex items-center gap-3">
                    <div className="text-primary">{icon}</div>
                    <h4 className="text-base font-semibold text-foreground">{title}</h4>
                </div>
                {expanded ? (
                    <ChevronUp className="w-5 h-5 text-muted-foreground" />
                ) : (
                    <ChevronDown className="w-5 h-5 text-muted-foreground" />
                )}
            </button>

            <AnimatePresence initial={false}>
                {expanded && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                    >
                        <div className="p-4 pt-0 border-t border-border">{children}</div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}

// Step Card Component
interface StepCardProps {
    step: number
    title: string
    description: string
    code?: string
    note?: string
    onCopy?: () => void
    copied?: boolean
}

function StepCard({ step, title, description, code, note, onCopy, copied }: StepCardProps) {
    return (
        <div className="flex gap-3">
            <div className="flex-shrink-0 w-7 h-7 rounded-full bg-primary/20 text-primary flex items-center justify-center text-sm font-semibold">
                {step}
            </div>
            <div className="flex-1 min-w-0">
                <h5 className="text-sm font-semibold text-foreground mb-1">{title}</h5>
                <p className="text-sm text-muted-foreground mb-2">{description}</p>

                {code && (
                    <div className="relative group">
                        <pre className="bg-slate-950 border border-border rounded-lg p-3 text-xs font-mono text-gray-300 overflow-x-auto">
                            {code}
                        </pre>
                        {onCopy && (
                            <button
                                onClick={onCopy}
                                className="absolute top-2 right-2 p-1.5 rounded bg-muted/80 hover:bg-muted transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100 focus:outline-none focus:ring-2 focus:ring-primary"
                                aria-label="Copy code"
                            >
                                {copied ? (
                                    <Check className="w-3.5 h-3.5 text-green-400" />
                                ) : (
                                    <Copy className="w-3.5 h-3.5 text-muted-foreground" />
                                )}
                            </button>
                        )}
                    </div>
                )}

                {note && (
                    <div className="mt-2 flex items-start gap-2 text-xs text-muted-foreground bg-muted/40 border border-border rounded-lg p-2">
                        <Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                        <span>{note}</span>
                    </div>
                )}
            </div>
        </div>
    )
}

// Environment Variable Card Component
interface EnvVarCardProps {
    varName: string
    value: string
    description: string
    onCopy: () => void
    copied: boolean
}

function EnvVarCard({ varName, value, description, onCopy, copied }: EnvVarCardProps) {
    return (
        <div className="bg-muted/40 border border-border rounded-lg p-3">
            <div className="flex items-start justify-between gap-3 mb-2">
                <div className="flex-1 min-w-0">
                    <code className="text-sm font-semibold text-foreground">
                        {varName}={value}
                    </code>
                </div>
                <button
                    onClick={onCopy}
                    className="p-1.5 rounded hover:bg-muted transition-colors focus:outline-none focus:ring-2 focus:ring-primary"
                    aria-label={`Copy ${varName}`}
                >
                    {copied ? (
                        <Check className="w-4 h-4 text-green-400" />
                    ) : (
                        <Copy className="w-4 h-4 text-muted-foreground" />
                    )}
                </button>
            </div>
            <p className="text-xs text-muted-foreground">{description}</p>
        </div>
    )
}
