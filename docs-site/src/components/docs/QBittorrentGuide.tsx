import { Download, Shield } from 'lucide-react'
import { AppGuideLayout } from './AppGuideLayout'

export function QBittorrentGuide() {
    return (
        <AppGuideLayout
            icon={<Download className="w-7 h-7 text-blue-300" />}
            title="qBittorrent"
            subtitle="Download client protected by VPN"
            category="Downloads"
            estimatedTime="5–10 minutes"
        >
            <section className="space-y-6 text-sm text-gray-300">
                <div>
                    <h3 className="text-base font-semibold text-white mb-2">VPN Protection</h3>
                    <p className="bg-blue-500/10 border border-blue-500/20 p-3 rounded-lg text-blue-200">
                        <Shield className="w-4 h-4 inline-block mr-2" />
                        In this stack, qBittorrent routes 100% of its traffic through the <strong>Gluetun</strong> container. 
                        If Gluetun (VPN) is down, qBittorrent cuts the connection (Kill Switch).
                    </p>
                </div>

                <div>
                    <h3 className="text-base font-semibold text-white mb-2">Configuration</h3>
                    <ol className="list-decimal list-inside space-y-2 text-gray-300">
                        <li>
                            Open WebUI at <a href="http://localhost:8080" target="_blank" rel="noopener noreferrer" className="text-purple-400 hover:underline">http://localhost:8080</a>
                        </li>
                        <li>
                            <strong>Login:</strong> Default user is <code>admin</code>. On first run, LinuxServer qBittorrent prints a temporary/random password in the container logs.
                            <br/>
                            <span className="text-gray-400 text-xs">
                                Find it with <code>docker logs qbittorrent 2&gt;&amp;1 | grep -i password</code>, then change it in Tools → Options → Web UI.
                            </span>
                        </li>
                        <li>
                            <strong>Verify VPN:</strong> 
                            Since the container uses the VPN network mode, you can check your IP by running:
                            <code className="block bg-slate-950 p-2 mt-1 rounded text-xs">docker exec qbittorrent curl -s ifconfig.me</code>
                            It should be different from your home IP.
                        </li>
                        <li>
                            <strong>Saving Paths:</strong>
                            Default Save Path: <code>/downloads</code>.
                            Categories (added by Sonarr/Radarr) will create subfolders like <code>/downloads/sonarr</code>.
                        </li>
                    </ol>
                </div>
            </section>
        </AppGuideLayout>
    )
}
