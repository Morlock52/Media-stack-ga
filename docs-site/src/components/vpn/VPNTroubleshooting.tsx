import { useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import {
    AlertCircle,
    ChevronDown,
    ChevronUp,
    Copy,
    Check,
    ExternalLink,
    Info,
    Shield,
    Wifi,
    Lock,
    Globe,
    Terminal,
} from 'lucide-react'
import { type VPNProvider } from '@/data/vpnProviders'
import { cn } from '@/lib/utils'

interface VPNTroubleshootingProps {
    provider?: VPNProvider
    className?: string
}

interface TroubleshootingIssue {
    issue: string
    symptoms?: string[]
    solutions: string[]
    commands?: string[]
    notes?: string
    links?: Array<{ label: string; url: string }>
}

export function VPNTroubleshooting({ provider, className }: VPNTroubleshootingProps) {
    const [expandedSections, setExpandedSections] = useState<Set<string>>(
        new Set(['connection-timeout'])
    )
    const [copiedCode, setCopiedCode] = useState<string | null>(null)

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

    // General troubleshooting issues
    const connectionTimeoutIssues: TroubleshootingIssue[] = [
        {
            issue: 'VPN connection timeout or fails to connect',
            symptoms: [
                'Container starts but VPN never connects',
                'Logs show "connection timeout" or "handshake timeout"',
                'Gluetun keeps retrying connection',
            ],
            solutions: [
                'Verify your credentials are correct (check for extra spaces or incorrect characters)',
                'Try a different server location using SERVER_COUNTRIES or SERVER_CITIES',
                'Check if your ISP is blocking VPN connections (try different protocols)',
                'Ensure firewall allows outbound VPN traffic on required ports',
                'Restart the Gluetun container with fresh connection attempt',
            ],
            commands: [
                'docker logs gluetun --tail 50',
                'docker restart gluetun',
                'docker exec gluetun sh -c "cat /tmp/gluetun/ip"',
            ],
            notes: 'If using WireGuard, try switching to OpenVPN (or vice versa) to rule out protocol-specific issues.',
        },
        {
            issue: 'Container exits immediately after start',
            symptoms: [
                'Gluetun container shows "Exited (1)" status',
                'Logs show configuration errors',
                'Container restarts in a loop',
            ],
            solutions: [
                'Check logs for specific error messages about missing or invalid environment variables',
                'Verify VPN_SERVICE_PROVIDER matches your provider exactly',
                'Ensure all required environment variables are set for your chosen provider',
                'Check for typos in environment variable names (they are case-sensitive)',
                'Validate your .env file has no syntax errors (no spaces around =)',
            ],
            commands: [
                'docker logs gluetun',
                'docker inspect gluetun | grep -A 20 "Env"',
            ],
        },
    ]

    const authenticationIssues: TroubleshootingIssue[] = [
        {
            issue: 'Authentication failed or credentials rejected',
            symptoms: [
                'Logs show "authentication failed" or "invalid credentials"',
                'Username/password error messages',
                'API token rejected by provider',
            ],
            solutions: [
                'Double-check credentials have no leading/trailing spaces',
                'Verify you are using VPN credentials (not account login password)',
                'For ProtonVPN: Use OpenVPN credentials from account settings, add +pmp for port forwarding',
                'For Mullvad: Ensure account number is exactly 16 digits',
                'For PIA: Username should start with "p"',
                'Regenerate credentials on provider website if persistent issues',
                'Check if your VPN subscription is active and not expired',
            ],
            commands: [
                'docker logs gluetun | grep -i "auth\\|credential"',
            ],
            notes: provider
                ? `${provider.name} uses ${provider.authMethod.type} authentication. Check ${provider.authMethod.credentialUrl || provider.setupInstructionsUrl} for credential details.`
                : 'Check your provider documentation for specific credential requirements.',
        },
        {
            issue: 'WireGuard key format errors',
            symptoms: [
                'Logs show "invalid key" or "malformed key"',
                'Base64 decoding errors',
                'Key length errors',
            ],
            solutions: [
                'WireGuard keys must be base64-encoded and approximately 44 characters long',
                'Copy keys directly from provider dashboard (do not modify)',
                'Ensure no line breaks or extra characters in the key',
                'For multi-line configs: Extract only the key value, not the entire line',
                'Regenerate WireGuard configuration if keys appear corrupted',
            ],
            commands: [
                'echo "$WIREGUARD_PRIVATE_KEY" | wc -c  # Should be around 44',
            ],
        },
    ]

    const dnsLeakIssues: TroubleshootingIssue[] = [
        {
            issue: 'DNS leaks detected',
            symptoms: [
                'DNS leak tests show your ISP DNS servers',
                'Real IP address visible in DNS queries',
                'Applications bypassing VPN DNS',
            ],
            solutions: [
                'Enable DNS over TLS (DOT=on) in Gluetun configuration',
                'Ensure containers are using Gluetun network and not host network',
                'Set custom DNS servers using DNS_ADDRESS environment variable',
                'Verify FIREWALL=on to prevent DNS bypass when VPN disconnects',
                'Check that applications inside containers respect container DNS settings',
            ],
            commands: [
                'docker exec gluetun sh -c "cat /etc/resolv.conf"',
                'docker exec <app-container> nslookup cloudflare.com',
            ],
            notes: 'Test DNS leaks at: https://dnsleaktest.com or https://ipleak.net',
            links: [
                { label: 'DNS Leak Test', url: 'https://dnsleaktest.com' },
                { label: 'IP Leak Test', url: 'https://ipleak.net' },
            ],
        },
        {
            issue: 'Custom DNS servers not working',
            symptoms: [
                'DNS resolution fails inside containers',
                'Cannot reach domains or external services',
                'Timeout errors on DNS lookups',
            ],
            solutions: [
                'Verify DNS_ADDRESS format: comma-separated IPs (e.g., "1.1.1.1,1.0.0.1")',
                'Try well-known DNS servers: Cloudflare (1.1.1.1), Google (8.8.8.8), Quad9 (9.9.9.9)',
                'Disable DOT temporarily to rule out DNS over TLS issues',
                'Check if DNS servers are accessible from your network',
                'Ensure firewall is not blocking DNS traffic (port 53)',
            ],
            commands: [
                'docker exec gluetun ping -c 3 1.1.1.1',
                'docker exec gluetun nslookup google.com 1.1.1.1',
            ],
        },
    ]

    const killSwitchIssues: TroubleshootingIssue[] = [
        {
            issue: 'Kill switch not working (traffic leaks when VPN drops)',
            symptoms: [
                'Real IP visible when VPN disconnects',
                'Applications continue working during VPN reconnection',
                'Traffic bypasses VPN tunnel',
            ],
            solutions: [
                'Verify FIREWALL=on in your Gluetun configuration',
                'Ensure containers are using Gluetun network (network_mode: service:gluetun)',
                'Do not use host network mode - it bypasses the kill switch',
                'Set FIREWALL_OUTBOUND_SUBNETS only if you need local network access',
                'Test kill switch by stopping Gluetun and checking if traffic is blocked',
            ],
            commands: [
                'docker exec gluetun sh -c "iptables -L -n | grep -i drop"',
                'docker stop gluetun && docker exec <app> curl -m 5 ifconfig.me',
            ],
            notes: 'The second command should fail/timeout if kill switch is working correctly.',
        },
        {
            issue: 'Cannot access local network when kill switch is enabled',
            symptoms: [
                'Cannot reach local servers or services',
                'LAN devices unreachable from containers',
                'Plex/Jellyfin not accessible on local network',
            ],
            solutions: [
                'Add your local subnet to FIREWALL_OUTBOUND_SUBNETS',
                'Common local subnets: 192.168.1.0/24, 10.0.0.0/8, 172.16.0.0/12',
                'Find your subnet with: ip addr show or ifconfig',
                'Multiple subnets: separate with commas',
                'Avoid disabling firewall - use subnet whitelist instead',
            ],
            commands: [
                'ip addr show | grep "inet "  # Find your subnet',
                'export FIREWALL_OUTBOUND_SUBNETS=192.168.1.0/24',
            ],
            notes: 'Setting FIREWALL_OUTBOUND_SUBNETS allows traffic to specified networks even when VPN is down.',
        },
    ]

    // Provider-specific issues
    const getProviderSpecificIssues = (): TroubleshootingIssue[] => {
        if (!provider) return []

        const issues: TroubleshootingIssue[] = []

        // Add issues based on provider tips
        if (provider.troubleshootingTips && provider.troubleshootingTips.length > 0) {
            provider.troubleshootingTips.forEach((tip, index) => {
                // Parse tip into issue format
                if (tip.includes(':')) {
                    const [issue, solution] = tip.split(':')
                    issues.push({
                        issue: issue.trim(),
                        solutions: [solution.trim()],
                    })
                } else {
                    issues.push({
                        issue: `${provider.name} Issue ${index + 1}`,
                        solutions: [tip],
                    })
                }
            })
        }

        // Add provider-specific structured issues
        switch (provider.id) {
            case 'protonvpn':
                issues.push({
                    issue: 'Port forwarding not working with ProtonVPN',
                    symptoms: [
                        'No port assigned in logs',
                        'NAT-PMP errors',
                        'qBittorrent shows no incoming connections',
                    ],
                    solutions: [
                        'Port forwarding ONLY works with OpenVPN (not WireGuard)',
                        'Add +pmp suffix to your OpenVPN username (e.g., username+pmp)',
                        'Verify you have Plus or Unlimited subscription (not Free)',
                        'Set VPN_PORT_FORWARDING=on',
                        'Check logs for assigned port: docker logs gluetun | grep -i "port forwarding"',
                    ],
                    links: [
                        {
                            label: 'ProtonVPN Port Forwarding Guide',
                            url: 'https://protonvpn.com/support/port-forwarding-manual-setup/',
                        },
                    ],
                })
                break

            case 'mullvad':
                issues.push({
                    issue: 'Mullvad port forwarding not working',
                    symptoms: [
                        'Assigned port not working in qBittorrent',
                        'Port test fails',
                    ],
                    solutions: [
                        'Assign a port at mullvad.net/en/account/#/ports BEFORE enabling port forwarding',
                        'Mullvad provides ONE static port per account',
                        'Use the assigned port in qBittorrent settings',
                        'Port assignments expire - check if yours is still active',
                        'Ensure VPN_PORT_FORWARDING=on in Gluetun',
                    ],
                    links: [
                        {
                            label: 'Mullvad Port Assignment',
                            url: 'https://mullvad.net/en/account/#/ports',
                        },
                    ],
                })
                break

            case 'nordvpn':
                issues.push({
                    issue: 'NordVPN does not support port forwarding',
                    solutions: [
                        'NordVPN removed port forwarding support in 2023',
                        'Consider switching to Mullvad, ProtonVPN, or PIA for torrenting',
                        'Torrenting will work but with reduced upload speeds and fewer peers',
                        'You can still seed, but only to peers with port forwarding enabled',
                    ],
                    notes: 'NordVPN does not support port forwarding. This is a provider limitation, not a Gluetun issue.',
                })
                break
        }

        return issues
    }

    const providerSpecificIssues = getProviderSpecificIssues()

    // Common debugging commands
    const debuggingCommands = [
        {
            description: 'Check Gluetun logs for errors',
            command: 'docker logs gluetun --tail 100',
        },
        {
            description: 'Verify VPN is connected and check IP',
            command: 'docker exec gluetun sh -c "cat /tmp/gluetun/ip"',
        },
        {
            description: 'Check VPN connection status',
            command: 'docker exec gluetun sh -c "wget -qO- ifconfig.me"',
        },
        {
            description: 'Verify kill switch firewall rules',
            command: 'docker exec gluetun sh -c "iptables -L -n"',
        },
        {
            description: 'Test DNS resolution inside Gluetun',
            command: 'docker exec gluetun nslookup google.com',
        },
        {
            description: 'Check environment variables',
            command: 'docker exec gluetun env | grep VPN',
        },
        {
            description: 'Restart Gluetun container',
            command: 'docker restart gluetun',
        },
        {
            description: 'View Gluetun health check',
            command: 'docker inspect gluetun --format="{{.State.Health.Status}}"',
        },
    ]

    return (
        <div className={cn('space-y-4', className)}>
            {/* Header */}
            <div className="flex items-start gap-3">
                <div className="p-3 rounded-lg bg-amber-500/20 text-amber-400">
                    <AlertCircle className="w-6 h-6" />
                </div>
                <div className="flex-1">
                    <h3 className="text-xl font-bold text-foreground mb-1">VPN Troubleshooting</h3>
                    <p className="text-sm text-muted-foreground">
                        Common issues and solutions for VPN configuration and connectivity
                        {provider && ` with ${provider.name}`}
                    </p>
                </div>
            </div>

            {/* Connection Timeout Issues */}
            <CollapsibleSection
                id="connection-timeout"
                title="Connection Timeout & Connectivity Issues"
                icon={<Wifi className="w-4 h-4" />}
                expanded={expandedSections.has('connection-timeout')}
                onToggle={() => toggleSection('connection-timeout')}
            >
                <div className="space-y-4">
                    {connectionTimeoutIssues.map((issue, index) => (
                        <IssueCard
                            key={index}
                            issue={issue}
                            onCopy={copyToClipboard}
                            copiedCode={copiedCode}
                            idPrefix={`conn-${index}`}
                        />
                    ))}
                </div>
            </CollapsibleSection>

            {/* Authentication Issues */}
            <CollapsibleSection
                id="authentication"
                title="Authentication & Credential Errors"
                icon={<Lock className="w-4 h-4" />}
                expanded={expandedSections.has('authentication')}
                onToggle={() => toggleSection('authentication')}
            >
                <div className="space-y-4">
                    {authenticationIssues.map((issue, index) => (
                        <IssueCard
                            key={index}
                            issue={issue}
                            onCopy={copyToClipboard}
                            copiedCode={copiedCode}
                            idPrefix={`auth-${index}`}
                        />
                    ))}
                </div>
            </CollapsibleSection>

            {/* DNS Leak Issues */}
            <CollapsibleSection
                id="dns-leaks"
                title="DNS Leaks & Resolution Issues"
                icon={<Globe className="w-4 h-4" />}
                expanded={expandedSections.has('dns-leaks')}
                onToggle={() => toggleSection('dns-leaks')}
            >
                <div className="space-y-4">
                    {dnsLeakIssues.map((issue, index) => (
                        <IssueCard
                            key={index}
                            issue={issue}
                            onCopy={copyToClipboard}
                            copiedCode={copiedCode}
                            idPrefix={`dns-${index}`}
                        />
                    ))}
                </div>
            </CollapsibleSection>

            {/* Kill Switch Issues */}
            <CollapsibleSection
                id="kill-switch"
                title="Kill Switch & Firewall Configuration"
                icon={<Shield className="w-4 h-4" />}
                expanded={expandedSections.has('kill-switch')}
                onToggle={() => toggleSection('kill-switch')}
            >
                <div className="space-y-4">
                    {killSwitchIssues.map((issue, index) => (
                        <IssueCard
                            key={index}
                            issue={issue}
                            onCopy={copyToClipboard}
                            copiedCode={copiedCode}
                            idPrefix={`kill-${index}`}
                        />
                    ))}
                </div>
            </CollapsibleSection>

            {/* Provider-Specific Issues */}
            {provider && providerSpecificIssues.length > 0 && (
                <CollapsibleSection
                    id="provider-specific"
                    title={`${provider.name}-Specific Issues`}
                    icon={<provider.icon className="w-4 h-4" />}
                    expanded={expandedSections.has('provider-specific')}
                    onToggle={() => toggleSection('provider-specific')}
                >
                    <div className="space-y-4">
                        {providerSpecificIssues.map((issue, index) => (
                            <IssueCard
                                key={index}
                                issue={issue}
                                onCopy={copyToClipboard}
                                copiedCode={copiedCode}
                                idPrefix={`provider-${index}`}
                            />
                        ))}

                        {provider.setupInstructionsUrl && (
                            <div className="pt-2">
                                <a
                                    href={provider.setupInstructionsUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-2 text-sm text-primary hover:text-primary/80 transition-colors"
                                >
                                    View {provider.name} setup documentation
                                    <ExternalLink className="w-3.5 h-3.5" />
                                </a>
                            </div>
                        )}
                    </div>
                </CollapsibleSection>
            )}

            {/* Debugging Commands */}
            <CollapsibleSection
                id="debugging"
                title="Debugging Commands"
                icon={<Terminal className="w-4 h-4" />}
                expanded={expandedSections.has('debugging')}
                onToggle={() => toggleSection('debugging')}
            >
                <div className="space-y-3">
                    <p className="text-sm text-muted-foreground mb-3">
                        Useful commands for diagnosing VPN issues:
                    </p>
                    {debuggingCommands.map((cmd, index) => (
                        <CommandCard
                            key={index}
                            description={cmd.description}
                            command={cmd.command}
                            onCopy={() => copyToClipboard(cmd.command, `debug-${index}`)}
                            copied={copiedCode === `debug-${index}`}
                        />
                    ))}
                </div>
            </CollapsibleSection>

            {/* Additional Resources */}
            <div className="bg-blue-500/10 border border-blue-500/20 p-4 rounded-xl">
                <div className="flex items-start gap-3">
                    <Info className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                        <h4 className="text-sm font-semibold text-foreground mb-2">
                            Additional Resources
                        </h4>
                        <ul className="space-y-1 text-sm text-muted-foreground">
                            <li>
                                •{' '}
                                <a
                                    href="https://github.com/qdm12/gluetun/wiki"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-primary hover:underline"
                                >
                                    Gluetun Wiki
                                </a>{' '}
                                - Official documentation and provider setup guides
                            </li>
                            <li>
                                •{' '}
                                <a
                                    href="https://github.com/qdm12/gluetun/discussions"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-primary hover:underline"
                                >
                                    Gluetun Discussions
                                </a>{' '}
                                - Community support and troubleshooting
                            </li>
                            <li>
                                •{' '}
                                <a
                                    href="https://ipleak.net"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-primary hover:underline"
                                >
                                    IP Leak Test
                                </a>{' '}
                                - Test for IP, DNS, and WebRTC leaks
                            </li>
                            <li>
                                •{' '}
                                <a
                                    href="https://dnsleaktest.com"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-primary hover:underline"
                                >
                                    DNS Leak Test
                                </a>{' '}
                                - Verify DNS is not leaking
                            </li>
                        </ul>
                    </div>
                </div>
            </div>
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

// Issue Card Component
interface IssueCardProps {
    issue: TroubleshootingIssue
    onCopy: (text: string, id: string) => void
    copiedCode: string | null
    idPrefix: string
}

function IssueCard({ issue, onCopy, copiedCode, idPrefix }: IssueCardProps) {
    return (
        <div className="bg-muted/40 border border-border rounded-lg p-4">
            <h5 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-amber-400" />
                {issue.issue}
            </h5>

            {issue.symptoms && issue.symptoms.length > 0 && (
                <div className="mb-3 pl-6">
                    <p className="text-xs font-medium text-muted-foreground mb-1">Symptoms:</p>
                    <ul className="text-xs text-muted-foreground space-y-0.5">
                        {issue.symptoms.map((symptom, idx) => (
                            <li key={idx}>• {symptom}</li>
                        ))}
                    </ul>
                </div>
            )}

            <div className="pl-6 mb-3">
                <p className="text-xs font-medium text-muted-foreground mb-1">Solutions:</p>
                <ul className="text-sm text-muted-foreground space-y-1">
                    {issue.solutions.map((solution, idx) => (
                        <li key={idx}>• {solution}</li>
                    ))}
                </ul>
            </div>

            {issue.commands && issue.commands.length > 0 && (
                <div className="space-y-2 mb-3">
                    {issue.commands.map((cmd, idx) => (
                        <div key={idx} className="relative group">
                            <pre className="bg-slate-950 border border-border rounded-lg p-2.5 pr-10 text-xs font-mono text-gray-300 overflow-x-auto">
                                {cmd}
                            </pre>
                            <button
                                onClick={() => onCopy(cmd, `${idPrefix}-cmd-${idx}`)}
                                className="absolute top-2 right-2 p-1.5 rounded bg-muted/80 hover:bg-muted transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100 focus:outline-none focus:ring-2 focus:ring-primary"
                                aria-label="Copy command"
                            >
                                {copiedCode === `${idPrefix}-cmd-${idx}` ? (
                                    <Check className="w-3.5 h-3.5 text-green-400" />
                                ) : (
                                    <Copy className="w-3.5 h-3.5 text-muted-foreground" />
                                )}
                            </button>
                        </div>
                    ))}
                </div>
            )}

            {issue.notes && (
                <div className="mt-2 flex items-start gap-2 text-xs text-muted-foreground bg-blue-500/10 border border-blue-500/20 rounded-lg p-2">
                    <Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                    <span>{issue.notes}</span>
                </div>
            )}

            {issue.links && issue.links.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-3">
                    {issue.links.map((link, idx) => (
                        <a
                            key={idx}
                            href={link.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 transition-colors"
                        >
                            {link.label}
                            <ExternalLink className="w-3 h-3" />
                        </a>
                    ))}
                </div>
            )}
        </div>
    )
}

// Command Card Component
interface CommandCardProps {
    description: string
    command: string
    onCopy: () => void
    copied: boolean
}

function CommandCard({ description, command, onCopy, copied }: CommandCardProps) {
    return (
        <div className="bg-muted/40 border border-border rounded-lg p-3">
            <p className="text-xs text-muted-foreground mb-2">{description}</p>
            <div className="relative group">
                <pre className="bg-slate-950 border border-border rounded-lg p-2.5 pr-10 text-xs font-mono text-gray-300 overflow-x-auto">
                    {command}
                </pre>
                <button
                    onClick={onCopy}
                    className="absolute top-2 right-2 p-1.5 rounded bg-muted/80 hover:bg-muted transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100 focus:outline-none focus:ring-2 focus:ring-primary"
                    aria-label="Copy command"
                >
                    {copied ? (
                        <Check className="w-3.5 h-3.5 text-green-400" />
                    ) : (
                        <Copy className="w-3.5 h-3.5 text-muted-foreground" />
                    )}
                </button>
            </div>
        </div>
    )
}
