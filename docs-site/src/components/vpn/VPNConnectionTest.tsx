import { useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import {
    CheckCircle,
    XCircle,
    AlertTriangle,
    Loader2,
    ExternalLink,
    Shield,
    Terminal,
    Copy,
    Check,
    Info,
} from 'lucide-react'
import { useSetupStore } from '@/store/setupStore'
import { getVPNProviderById } from '@/data/vpnProviders'
import { buildControlServerUrl, controlServerAuthHeaders } from '@/utils/controlServer'
import { cn } from '@/lib/utils'

interface VPNConnectionTestProps {
    className?: string
}

interface ValidationResponse {
    success: boolean
    valid: boolean
    errors: string[]
    warnings: string[]
    details?: Record<string, unknown>
}

export function VPNConnectionTest({ className }: VPNConnectionTestProps) {
    const { config } = useSetupStore()
    const [isValidating, setIsValidating] = useState(false)
    const [validationResult, setValidationResult] = useState<ValidationResponse | null>(null)
    const [copiedCommand, setCopiedCommand] = useState<string | null>(null)

    const provider = config.selectedVpnProvider
        ? getVPNProviderById(config.selectedVpnProvider)
        : null

    const handleValidate = async () => {
        if (!provider) return

        setIsValidating(true)
        setValidationResult(null)

        try {
            const response = await fetch(buildControlServerUrl('/api/vpn/validate'), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...controlServerAuthHeaders(),
                },
                body: JSON.stringify({
                    provider: provider.id,
                    protocol: config.vpnProtocol || provider.recommendedProtocol,
                    credentials: config.vpnCredentials || {},
                    portForwardingEnabled: config.portForwardingEnabled || false,
                }),
            })

            const result: ValidationResponse = await response.json()
            setValidationResult(result)
        } catch (error) {
            setValidationResult({
                success: false,
                valid: false,
                errors: [error instanceof Error ? error.message : 'Failed to validate VPN configuration'],
                warnings: [],
            })
        } finally {
            setIsValidating(false)
        }
    }

    const copyToClipboard = (text: string, id: string) => {
        navigator.clipboard.writeText(text)
        setCopiedCommand(id)
        setTimeout(() => setCopiedCommand(null), 2000)
    }

    if (!provider) {
        return (
            <div className={cn('p-6 rounded-xl border border-border bg-card/40', className)}>
                <div className="flex items-start gap-3">
                    <Info className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
                    <div>
                        <h3 className="text-lg font-semibold text-foreground mb-2">
                            No VPN Provider Selected
                        </h3>
                        <p className="text-sm text-muted-foreground">
                            Please select a VPN provider and configure credentials before running validation.
                        </p>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className={cn('space-y-6', className)}>
            {/* Pre-deployment Validation */}
            <div className="p-6 rounded-xl border border-border bg-card/40">
                <div className="flex items-start gap-3 mb-4">
                    <Shield className="w-6 h-6 text-primary flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                        <h3 className="text-lg font-semibold text-foreground mb-2">
                            Pre-Deployment Validation
                        </h3>
                        <p className="text-sm text-muted-foreground mb-4">
                            Validate your VPN configuration before deployment. This checks credential formats,
                            WireGuard key structure, and provider-specific requirements.
                        </p>

                        <button
                            onClick={handleValidate}
                            disabled={isValidating}
                            className={cn(
                                'flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all',
                                'bg-primary/10 hover:bg-primary/20 text-primary',
                                'border border-primary/30 hover:border-primary/50',
                                'disabled:opacity-50 disabled:cursor-not-allowed',
                                'focus:outline-none focus:ring-2 focus:ring-primary'
                            )}
                        >
                            {isValidating ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    Validating...
                                </>
                            ) : (
                                <>
                                    <Shield className="w-4 h-4" />
                                    Validate Configuration
                                </>
                            )}
                        </button>
                    </div>
                </div>

                {/* Validation Results */}
                <AnimatePresence mode="wait">
                    {validationResult && (
                        <motion.div
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            transition={{ duration: 0.2 }}
                            className="mt-4 space-y-3"
                        >
                            {/* Success State */}
                            {validationResult.success && validationResult.valid && (
                                <div className="flex items-start gap-3 p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/30">
                                    <CheckCircle className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
                                    <div className="flex-1">
                                        <p className="font-medium text-emerald-400 mb-1">
                                            Configuration Valid
                                        </p>
                                        <p className="text-sm text-emerald-400/80">
                                            Your VPN configuration passed all validation checks. You can proceed with
                                            deployment.
                                        </p>
                                    </div>
                                </div>
                            )}

                            {/* Errors */}
                            {validationResult.errors.length > 0 && (
                                <div className="flex items-start gap-3 p-4 rounded-lg bg-red-500/10 border border-red-500/30">
                                    <XCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                                    <div className="flex-1">
                                        <p className="font-medium text-red-400 mb-2">
                                            Validation Errors
                                        </p>
                                        <ul className="space-y-1">
                                            {validationResult.errors.map((error, idx) => (
                                                <li key={idx} className="text-sm text-red-400/90">
                                                    • {error}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                </div>
                            )}

                            {/* Warnings */}
                            {validationResult.warnings.length > 0 && (
                                <div className="flex items-start gap-3 p-4 rounded-lg bg-amber-500/10 border border-amber-500/30">
                                    <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
                                    <div className="flex-1">
                                        <p className="font-medium text-amber-400 mb-2">
                                            Warnings
                                        </p>
                                        <ul className="space-y-1">
                                            {validationResult.warnings.map((warning, idx) => (
                                                <li key={idx} className="text-sm text-amber-400/90">
                                                    • {warning}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                </div>
                            )}
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* Post-deployment Test Instructions */}
            <div className="p-6 rounded-xl border border-border bg-card/40">
                <div className="flex items-start gap-3 mb-4">
                    <Terminal className="w-6 h-6 text-primary flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                        <h3 className="text-lg font-semibold text-foreground mb-2">
                            Post-Deployment Connection Test
                        </h3>
                        <p className="text-sm text-muted-foreground mb-4">
                            After deploying your stack, follow these steps to verify your VPN is working correctly.
                        </p>
                    </div>
                </div>

                <div className="space-y-4">
                    {/* Step 1: Check Gluetun Status */}
                    <div className="space-y-2">
                        <div className="flex items-center gap-2">
                            <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/20 border border-primary/40 text-primary text-xs font-semibold">
                                1
                            </div>
                            <h4 className="font-medium text-foreground">Check Gluetun Container Status</h4>
                        </div>
                        <p className="text-sm text-muted-foreground ml-8">
                            Verify the Gluetun container is running and connected to the VPN.
                        </p>
                        <div className="ml-8 relative group">
                            <pre className="p-3 rounded-lg bg-black/40 border border-border text-sm text-foreground overflow-x-auto">
                                <code>docker logs gluetun</code>
                            </pre>
                            <button
                                onClick={() => copyToClipboard('docker logs gluetun', 'cmd-1')}
                                className="absolute top-2 right-2 p-1.5 rounded bg-background/80 border border-border hover:bg-background transition-colors opacity-0 group-hover:opacity-100"
                                aria-label="Copy command"
                            >
                                {copiedCommand === 'cmd-1' ? (
                                    <Check className="w-4 h-4 text-emerald-400" />
                                ) : (
                                    <Copy className="w-4 h-4 text-muted-foreground" />
                                )}
                            </button>
                        </div>
                        <p className="text-xs text-muted-foreground ml-8">
                            Look for "Wireguard is up" or "ip has been assigned" messages.
                        </p>
                    </div>

                    {/* Step 2: Check VPN IP Address */}
                    <div className="space-y-2">
                        <div className="flex items-center gap-2">
                            <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/20 border border-primary/40 text-primary text-xs font-semibold">
                                2
                            </div>
                            <h4 className="font-medium text-foreground">Verify VPN IP Address</h4>
                        </div>
                        <p className="text-sm text-muted-foreground ml-8">
                            Check that your container is using the VPN's IP address, not your real IP.
                        </p>
                        <div className="ml-8 relative group">
                            <pre className="p-3 rounded-lg bg-black/40 border border-border text-sm text-foreground overflow-x-auto">
                                <code>docker exec gluetun wget -qO- ifconfig.me</code>
                            </pre>
                            <button
                                onClick={() =>
                                    copyToClipboard('docker exec gluetun wget -qO- ifconfig.me', 'cmd-2')
                                }
                                className="absolute top-2 right-2 p-1.5 rounded bg-background/80 border border-border hover:bg-background transition-colors opacity-0 group-hover:opacity-100"
                                aria-label="Copy command"
                            >
                                {copiedCommand === 'cmd-2' ? (
                                    <Check className="w-4 h-4 text-emerald-400" />
                                ) : (
                                    <Copy className="w-4 h-4 text-muted-foreground" />
                                )}
                            </button>
                        </div>
                        <p className="text-xs text-muted-foreground ml-8">
                            This should return your VPN provider's IP, not your real public IP.
                        </p>
                    </div>

                    {/* Step 3: Port Forwarding Check (if enabled) */}
                    {config.portForwardingEnabled && provider.portForwarding.supported && (
                        <div className="space-y-2">
                            <div className="flex items-center gap-2">
                                <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/20 border border-primary/40 text-primary text-xs font-semibold">
                                    3
                                </div>
                                <h4 className="font-medium text-foreground">Verify Port Forwarding</h4>
                            </div>
                            <p className="text-sm text-muted-foreground ml-8">
                                Check Gluetun logs for your assigned forwarded port.
                            </p>
                            <div className="ml-8 relative group">
                                <pre className="p-3 rounded-lg bg-black/40 border border-border text-sm text-foreground overflow-x-auto">
                                    <code>docker logs gluetun | grep -i "port forwarding"</code>
                                </pre>
                                <button
                                    onClick={() =>
                                        copyToClipboard(
                                            'docker logs gluetun | grep -i "port forwarding"',
                                            'cmd-3'
                                        )
                                    }
                                    className="absolute top-2 right-2 p-1.5 rounded bg-background/80 border border-border hover:bg-background transition-colors opacity-0 group-hover:opacity-100"
                                    aria-label="Copy command"
                                >
                                    {copiedCommand === 'cmd-3' ? (
                                        <Check className="w-4 h-4 text-emerald-400" />
                                    ) : (
                                        <Copy className="w-4 h-4 text-muted-foreground" />
                                    )}
                                </button>
                            </div>
                            <p className="text-xs text-muted-foreground ml-8">
                                Note the port number and configure it in qBittorrent's connection settings.
                            </p>
                        </div>
                    )}

                    {/* Step 4: IP Leak Test */}
                    <div className="space-y-2">
                        <div className="flex items-center gap-2">
                            <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/20 border border-primary/40 text-primary text-xs font-semibold">
                                {config.portForwardingEnabled && provider.portForwarding.supported ? '4' : '3'}
                            </div>
                            <h4 className="font-medium text-foreground">Run IP Leak Test</h4>
                        </div>
                        <p className="text-sm text-muted-foreground ml-8 mb-3">
                            Visit an IP leak testing website to verify your VPN is working and not leaking your
                            real IP address or DNS queries.
                        </p>
                        <div className="ml-8 flex flex-col gap-2">
                            <a
                                href="https://ipleak.net"
                                target="_blank"
                                rel="noopener noreferrer"
                                className={cn(
                                    'inline-flex items-center gap-2 px-4 py-2 rounded-lg',
                                    'bg-primary/10 hover:bg-primary/20 border border-primary/30 hover:border-primary/50',
                                    'text-sm font-medium text-primary transition-all w-fit',
                                    'focus:outline-none focus:ring-2 focus:ring-primary'
                                )}
                            >
                                <ExternalLink className="w-4 h-4" />
                                Open IPLeak.net
                            </a>
                            <a
                                href="https://dnsleaktest.com"
                                target="_blank"
                                rel="noopener noreferrer"
                                className={cn(
                                    'inline-flex items-center gap-2 px-4 py-2 rounded-lg',
                                    'bg-primary/10 hover:bg-primary/20 border border-primary/30 hover:border-primary/50',
                                    'text-sm font-medium text-primary transition-all w-fit',
                                    'focus:outline-none focus:ring-2 focus:ring-primary'
                                )}
                            >
                                <ExternalLink className="w-4 h-4" />
                                Open DNSLeakTest.com
                            </a>
                        </div>
                        <p className="text-xs text-muted-foreground ml-8 mt-2">
                            Both sites should show your VPN provider's IP address and DNS servers, not your ISP's.
                        </p>
                    </div>

                    {/* Kill Switch Verification */}
                    {config.killSwitchEnabled && (
                        <div className="mt-4 p-4 rounded-lg bg-blue-500/10 border border-blue-500/30">
                            <div className="flex items-start gap-3">
                                <Info className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
                                <div>
                                    <p className="font-medium text-blue-400 mb-1">Kill Switch Enabled</p>
                                    <p className="text-sm text-blue-400/80">
                                        Your kill switch is enabled. If the VPN connection drops, all internet
                                        traffic will be blocked automatically to prevent IP leaks.
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
