import { ShieldCheck, Zap, Shield, ExternalLink, CheckCircle, XCircle } from 'lucide-react'
import { AppGuideLayout } from './AppGuideLayout'
import { vpnProviders } from '@/data/vpnProviders'

export function GluetunGuide() {
    // Separate providers by port forwarding support
    const portForwardingProviders = vpnProviders.filter(p => p.portForwarding.supported && p.id !== 'custom')
    const otherProviders = vpnProviders.filter(p => !p.portForwarding.supported && p.id !== 'custom')

    return (
        <AppGuideLayout
            icon={<ShieldCheck className="w-7 h-7 text-green-400" />}
            title="Gluetun VPN"
            subtitle="Universal VPN Client & Kill Switch"
            category="Network"
            estimatedTime="Setup via Wizard"
        >
            <section className="space-y-6 text-sm text-gray-300">
                {/* Wizard Configuration Section */}
                <div>
                    <h3 className="text-base font-semibold text-white mb-2">Easy Configuration via Wizard</h3>
                    <p className="bg-emerald-500/10 border border-emerald-500/20 p-3 rounded-lg text-emerald-200 mb-3">
                        <ShieldCheck className="w-4 h-4 inline-block mr-2" />
                        The Media Stack wizard now includes a comprehensive <strong>VPN Setup Wizard</strong> that guides you through
                        configuring Gluetun with your preferred VPN provider. No manual .env editing required!
                    </p>
                    <p className="mb-2">
                        During the wizard setup flow, you'll be able to:
                    </p>
                    <ul className="list-disc list-inside space-y-1 text-gray-300 ml-2">
                        <li>Select from 15+ supported VPN providers with provider-specific templates</li>
                        <li>Enter your VPN credentials with inline validation</li>
                        <li>Import WireGuard configuration files (.conf) for custom setups</li>
                        <li>Configure port forwarding for supported providers</li>
                        <li>Enable kill switch protection (recommended and enabled by default)</li>
                        <li>Get provider-specific troubleshooting tips</li>
                    </ul>
                </div>

                {/* How it Works */}
                <div>
                    <h3 className="text-base font-semibold text-white mb-2">How it works</h3>
                    <p className="mb-3">
                        Gluetun creates a secure VPN tunnel. Other containers (like qBittorrent) use Gluetun's network connection
                        via Docker's <code>network_mode: "service:vpn"</code> setting.
                        This means they share the same VPN IP and are protected by Gluetun's kill switch.
                    </p>
                    <p className="bg-blue-500/10 border border-blue-500/20 p-3 rounded-lg text-blue-200">
                        <Shield className="w-4 h-4 inline-block mr-2" />
                        <strong>Kill Switch:</strong> If the VPN connection drops, Gluetun's firewall blocks all traffic
                        from dependent containers until the VPN reconnects. This prevents accidental IP leaks.
                    </p>
                </div>

                {/* Kill Switch Explanation */}
                <div>
                    <h3 className="text-base font-semibold text-white mb-2">Kill Switch Protection</h3>
                    <p className="mb-2">
                        The kill switch is a critical security feature that ensures your real IP address is never exposed:
                    </p>
                    <div className="bg-slate-950 p-4 rounded-lg border border-white/10 space-y-2">
                        <div className="flex items-start gap-2">
                            <CheckCircle className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" />
                            <div>
                                <p className="text-white font-medium text-xs">Enabled by default</p>
                                <p className="text-gray-400 text-xs">Set via <code>FIREWALL=on</code> in your .env file</p>
                            </div>
                        </div>
                        <div className="flex items-start gap-2">
                            <CheckCircle className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" />
                            <div>
                                <p className="text-white font-medium text-xs">Automatic reconnection</p>
                                <p className="text-gray-400 text-xs">Gluetun continuously monitors and restores VPN connection</p>
                            </div>
                        </div>
                        <div className="flex items-start gap-2">
                            <CheckCircle className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" />
                            <div>
                                <p className="text-white font-medium text-xs">Local network access</p>
                                <p className="text-gray-400 text-xs">Configure <code>FIREWALL_OUTBOUND_SUBNETS</code> to allow LAN access while maintaining kill switch</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Port Forwarding Overview */}
                <div>
                    <h3 className="text-base font-semibold text-white mb-2">Port Forwarding for Torrenting</h3>
                    <p className="mb-3">
                        Port forwarding significantly improves torrent download speeds by allowing incoming connections.
                        Not all VPN providers support this feature.
                    </p>

                    <div className="bg-amber-500/10 border border-amber-500/20 p-3 rounded-lg text-amber-200 mb-3">
                        <Zap className="w-4 h-4 inline-block mr-2" />
                        <strong>Providers with Port Forwarding:</strong> {portForwardingProviders.length} providers support automatic port forwarding
                    </div>

                    <div className="space-y-2">
                        {portForwardingProviders.map(provider => (
                            <div key={provider.id} className="flex items-center justify-between bg-slate-900/50 p-2 rounded border border-white/5">
                                <div className="flex items-center gap-2">
                                    <Zap className="w-3.5 h-3.5 text-emerald-400" />
                                    <span className="text-white font-medium">{provider.name}</span>
                                </div>
                                <div className="flex items-center gap-2 text-xs">
                                    <span className={`px-2 py-0.5 rounded ${
                                        provider.portForwarding.automatic
                                            ? 'bg-emerald-500/20 text-emerald-300'
                                            : 'bg-blue-500/20 text-blue-300'
                                    }`}>
                                        {provider.portForwarding.automatic ? 'Automatic' : 'Manual Setup'}
                                    </span>
                                    <a
                                        href={provider.setupInstructionsUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-primary hover:underline flex items-center gap-1"
                                    >
                                        Setup Guide
                                        <ExternalLink className="w-3 h-3" />
                                    </a>
                                </div>
                            </div>
                        ))}
                    </div>

                    <p className="text-xs text-gray-400 mt-3">
                        The wizard provides step-by-step port forwarding setup instructions for each supported provider,
                        including qBittorrent configuration and testing procedures.
                    </p>
                </div>

                {/* Provider Quick Reference */}
                <div>
                    <h3 className="text-base font-semibold text-white mb-2">Supported VPN Providers</h3>
                    <p className="mb-3">
                        The wizard supports {vpnProviders.filter(p => p.id !== 'custom').length}+ popular VPN providers with pre-configured templates:
                    </p>

                    <div className="bg-slate-950 rounded-lg border border-white/10 overflow-hidden">
                        <table className="w-full text-xs">
                            <thead>
                                <tr className="border-b border-white/10 bg-slate-900/50">
                                    <th className="text-left p-2 text-white font-semibold">Provider</th>
                                    <th className="text-center p-2 text-white font-semibold">Protocol</th>
                                    <th className="text-center p-2 text-white font-semibold">Port Forward</th>
                                    <th className="text-center p-2 text-white font-semibold">Difficulty</th>
                                </tr>
                            </thead>
                            <tbody>
                                {/* Port Forwarding Providers First */}
                                {portForwardingProviders.map((provider, idx) => (
                                    <tr key={provider.id} className={`border-b border-white/5 ${idx % 2 === 0 ? 'bg-slate-900/20' : ''}`}>
                                        <td className="p-2">
                                            <div className="flex items-center gap-2">
                                                <span className="text-white font-medium">{provider.name}</span>
                                                {provider.popular && (
                                                    <span className="px-1.5 py-0.5 bg-primary/20 text-primary text-[10px] rounded">Popular</span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="p-2 text-center text-gray-300">
                                            {provider.recommendedProtocol === 'wireguard' ? 'WireGuard' : 'OpenVPN'}
                                        </td>
                                        <td className="p-2 text-center">
                                            <CheckCircle className="w-4 h-4 text-emerald-400 mx-auto" />
                                        </td>
                                        <td className="p-2 text-center">
                                            <span className={`px-2 py-0.5 rounded text-[10px] ${
                                                provider.difficulty === 'easy' ? 'bg-green-500/20 text-green-300' :
                                                provider.difficulty === 'moderate' ? 'bg-yellow-500/20 text-yellow-300' :
                                                'bg-red-500/20 text-red-300'
                                            }`}>
                                                {provider.difficulty}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                                {/* Other Providers */}
                                {otherProviders.map((provider, idx) => (
                                    <tr key={provider.id} className={`border-b border-white/5 ${(portForwardingProviders.length + idx) % 2 === 0 ? 'bg-slate-900/20' : ''}`}>
                                        <td className="p-2">
                                            <div className="flex items-center gap-2">
                                                <span className="text-white font-medium">{provider.name}</span>
                                                {provider.popular && (
                                                    <span className="px-1.5 py-0.5 bg-primary/20 text-primary text-[10px] rounded">Popular</span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="p-2 text-center text-gray-300">
                                            {provider.recommendedProtocol === 'wireguard' ? 'WireGuard' : 'OpenVPN'}
                                        </td>
                                        <td className="p-2 text-center">
                                            <XCircle className="w-4 h-4 text-gray-500 mx-auto" />
                                        </td>
                                        <td className="p-2 text-center">
                                            <span className={`px-2 py-0.5 rounded text-[10px] ${
                                                provider.difficulty === 'easy' ? 'bg-green-500/20 text-green-300' :
                                                provider.difficulty === 'moderate' ? 'bg-yellow-500/20 text-yellow-300' :
                                                'bg-red-500/20 text-red-300'
                                            }`}>
                                                {provider.difficulty}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    <p className="text-xs text-gray-400 mt-3">
                        Each provider includes pre-filled templates with all required Gluetun environment variables,
                        authentication requirements, and provider-specific configuration options.
                    </p>
                </div>

                {/* Troubleshooting */}
                <div>
                    <h3 className="text-base font-semibold text-white mb-2">Troubleshooting</h3>
                    <p className="mb-2">
                        The VPN wizard includes comprehensive troubleshooting guides for common issues:
                    </p>
                    <ul className="list-disc list-inside space-y-1 text-gray-300 ml-2 mb-3">
                        <li>Connection timeouts and authentication errors</li>
                        <li>DNS leaks and resolution issues</li>
                        <li>Kill switch and firewall configuration</li>
                        <li>Port forwarding setup and verification</li>
                        <li>Provider-specific common problems</li>
                    </ul>
                    <p className="mb-2">
                        For additional help, consult these resources:
                    </p>
                    <div className="space-y-2">
                        <a
                            href="https://github.com/qdm12/gluetun-wiki"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 text-primary hover:underline"
                        >
                            <ExternalLink className="w-3.5 h-3.5" />
                            Official Gluetun Wiki - Provider configurations and advanced settings
                        </a>
                        <a
                            href="https://ipleak.net"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 text-primary hover:underline"
                        >
                            <ExternalLink className="w-3.5 h-3.5" />
                            IP Leak Test - Verify your VPN is working correctly
                        </a>
                        <a
                            href="https://www.dnsleaktest.com"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 text-primary hover:underline"
                        >
                            <ExternalLink className="w-3.5 h-3.5" />
                            DNS Leak Test - Check for DNS leaks
                        </a>
                    </div>
                </div>

                {/* Manual Configuration (Advanced) */}
                <div>
                    <h3 className="text-base font-semibold text-white mb-2">Manual Configuration (Advanced)</h3>
                    <p className="mb-2">
                        While the wizard handles most scenarios, you can manually edit VPN settings in your <code>.env</code> file if needed:
                    </p>
                    <div className="bg-slate-950 p-4 rounded-lg border border-white/10 font-mono text-xs space-y-1">
                        <p className="text-gray-400"># Example: Mullvad with WireGuard</p>
                        <p>VPN_SERVICE_PROVIDER=mullvad</p>
                        <p>VPN_TYPE=wireguard</p>
                        <p>WIREGUARD_PRIVATE_KEY=your_private_key</p>
                        <p>WIREGUARD_ADDRESSES=10.2.0.2/32</p>
                        <p>VPN_PORT_FORWARDING=on</p>
                        <p className="text-gray-400 pt-2"># Kill switch (enabled by default)</p>
                        <p>FIREWALL=on</p>
                        <p>FIREWALL_OUTBOUND_SUBNETS=192.168.1.0/24</p>
                    </div>
                    <p className="text-xs text-gray-400 mt-2">
                        See the <a href="https://github.com/qdm12/gluetun/wiki" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Gluetun Wiki</a> for complete environment variable documentation.
                    </p>
                </div>

                {/* Verification */}
                <div>
                    <h3 className="text-base font-semibold text-white mb-2">Verify VPN Connection</h3>
                    <p className="mb-2">
                        After deployment, verify your VPN is working correctly:
                    </p>
                    <div className="bg-slate-950 p-3 rounded-lg border border-white/10 space-y-3">
                        <div>
                            <p className="text-gray-400 text-xs mb-1">Check Gluetun container logs:</p>
                            <code className="block bg-slate-900 p-2 rounded text-xs">docker logs vpn</code>
                        </div>
                        <div>
                            <p className="text-gray-400 text-xs mb-1">Verify outbound IP (should be VPN IP, not your home IP):</p>
                            <code className="block bg-slate-900 p-2 rounded text-xs">docker exec vpn wget -qO- ifconfig.me</code>
                        </div>
                        <div>
                            <p className="text-gray-400 text-xs mb-1">Check qBittorrent's IP (should match VPN IP):</p>
                            <code className="block bg-slate-900 p-2 rounded text-xs">docker exec qbittorrent wget -qO- ifconfig.me</code>
                        </div>
                    </div>
                </div>
            </section>
        </AppGuideLayout>
    )
}
