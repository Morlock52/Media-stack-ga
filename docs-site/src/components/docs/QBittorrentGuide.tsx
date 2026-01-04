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
                        In the <strong>secure stack</strong> (<code>docker-compose.yml</code>), qBittorrent routes 100% of its traffic
                        through the <strong>Gluetun</strong> container (kill-switch).
                        <br />
                        In the <strong>local ports</strong> stack (<code>docker-compose.local.yml</code>), qBittorrent runs directly (no VPN)
                        for simplicity.
                    </p>
                </div>

                <div>
                    <h3 className="text-base font-semibold text-white mb-2">Configuration</h3>
                    <ol className="list-decimal list-inside space-y-2 text-gray-300">
                        <li>
                            Open the Web UI:
                            <ul className="list-disc list-inside mt-2 space-y-1 text-gray-300">
                                <li>
                                    Local ports: <code>http://&lt;server-ip&gt;:8081</code>
                                </li>
                                <li>
                                    Secure / tunnel: <code>https://qbt.yourdomain.com</code> (or <code>http://&lt;server-ip&gt;:8080</code> if you published it)
                                </li>
                            </ul>
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
                            If you are using the secure stack (Gluetun), you can check the outbound IP:
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
