import { ShieldCheck } from 'lucide-react'
import { AppGuideLayout } from './AppGuideLayout'

export function GluetunGuide() {
    return (
        <AppGuideLayout
            icon={<ShieldCheck className="w-7 h-7 text-green-400" />}
            title="Gluetun VPN"
            subtitle="Universal VPN Client & Kill Switch"
            category="Network"
            estimatedTime="Setup via .env"
        >
            <section className="space-y-6 text-sm text-gray-300">
                <div>
                    <h3 className="text-base font-semibold text-white mb-2">How it works</h3>
                    <p>
                        Gluetun creates a secure VPN tunnel. Other containers (like qBittorrent) use Gluetun's network connection.
                        This means they share the same VPN IP and are protected by Gluetun's kill switch.
                    </p>
                </div>

                <div>
                    <h3 className="text-base font-semibold text-white mb-2">Configuration</h3>
                    <p className="mb-2">VPN settings are managed in your <code>.env</code> file.</p>
                    <div className="bg-slate-950 p-4 rounded-lg border border-white/10 font-mono text-xs">
                        <p className="text-gray-400"># Example for WireGuard</p>
                        <p>VPN_SERVICE_PROVIDER=custom</p>
                        <p>VPN_TYPE=wireguard</p>
                        <p>WIREGUARD_PRIVATE_KEY=wIo...</p>
                        <p>WIREGUARD_ADDRESSES=10.2.0.2/32</p>
                    </div>
                    <p className="mt-2">
                        See the <a href="https://github.com/qdm12/gluetun/wiki" target="_blank" rel="noopener noreferrer" className="text-purple-400 hover:underline">Gluetun Wiki</a> for provider-specific details.
                    </p>
                </div>
            </section>
        </AppGuideLayout>
    )
}
