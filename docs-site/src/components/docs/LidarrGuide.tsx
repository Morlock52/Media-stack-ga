import { Music } from 'lucide-react'
import { AppGuideLayout } from './AppGuideLayout'

export function LidarrGuide() {
    return (
        <AppGuideLayout
            icon={<Music className="w-7 h-7 text-emerald-300" />}
            title="Lidarr"
            subtitle="Music collection manager in the *Arr family"
            category="Automation"
            estimatedTime="20-30 minutes"
        >
            <section className="space-y-6 text-sm text-gray-300">
                <div>
                    <h3 className="text-base font-semibold text-white mb-2">What is Lidarr?</h3>
                    <p>
                        Lidarr is a music collection manager for Usenet and BitTorrent users. It can monitor multiple
                        RSS feeds for new albums and will grab, sort, and rename them. It can also be configured to
                        automatically upgrade the quality of existing files when a better quality format becomes available.
                    </p>
                </div>

                <div>
                    <h3 className="text-base font-semibold text-white mb-2">Initial setup</h3>
                    <ol className="list-decimal list-inside space-y-2 text-gray-300">
                        <li>
                            Open <code>https://lidarr.yourdomain.com</code> or <code>http://localhost:8686</code>.
                        </li>
                        <li>
                            Go to <strong>Settings → Media Management</strong> and set your root folder to <code>/music</code>.
                        </li>
                        <li>
                            Configure your <strong>Download Clients</strong> (qBittorrent or SABnzbd).
                        </li>
                        <li>
                            Add <strong>Indexers</strong> via Prowlarr sync or manually.
                        </li>
                    </ol>
                </div>

                <div>
                    <h3 className="text-base font-semibold text-white mb-2">Adding artists</h3>
                    <ol className="list-decimal list-inside space-y-2 text-gray-300">
                        <li>
                            Click <strong>Add New</strong> in the sidebar.
                        </li>
                        <li>
                            Search for an artist by name.
                        </li>
                        <li>
                            Select the artist and choose a quality profile.
                        </li>
                        <li>
                            Click <strong>Add</strong> to start monitoring.
                        </li>
                    </ol>
                </div>

                <div>
                    <h3 className="text-base font-semibold text-white mb-2">Connect to Plex/Jellyfin</h3>
                    <ol className="list-decimal list-inside space-y-2 text-gray-300">
                        <li>
                            Go to <strong>Settings → Connect</strong>.
                        </li>
                        <li>
                            Add a new connection for Plex or Jellyfin.
                        </li>
                        <li>
                            This triggers library updates when new music is imported.
                        </li>
                    </ol>
                </div>

                <div>
                    <h3 className="text-base font-semibold text-white mb-2">Tips</h3>
                    <ul className="list-disc list-inside space-y-2 text-gray-300">
                        <li>
                            Use the <strong>Metadata</strong> profile to configure how albums are named.
                        </li>
                        <li>
                            Enable <strong>Track naming</strong> in Media Management for consistent file names.
                        </li>
                        <li>
                            Check <strong>Wanted → Missing</strong> to see albums that need downloading.
                        </li>
                    </ul>
                </div>
            </section>
        </AppGuideLayout>
    )
}
