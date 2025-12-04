import { Tv } from 'lucide-react'
import { AppGuideLayout } from './AppGuideLayout'

export function SonarrGuide() {
    return (
        <AppGuideLayout
            icon={<Tv className="w-7 h-7 text-blue-400" />}
            title="Sonarr"
            subtitle="Smart TV show automation and management"
            category="Automation"
            estimatedTime="15–30 minutes"
        >
            <section className="space-y-6 text-sm text-gray-300">
                <div>
                    <h3 className="text-base font-semibold text-white mb-2">What is Sonarr?</h3>
                    <p>
                        Sonarr monitors multiple RSS feeds for new episodes of your favorite shows and will grab, sort, and rename them.
                        It can also be configured to automatically upgrade the quality of files already downloaded when a better quality format becomes available.
                    </p>
                </div>

                <div>
                    <h3 className="text-base font-semibold text-white mb-2">Initial Setup</h3>
                    <ol className="list-decimal list-inside space-y-2 text-gray-300">
                        <li>
                            Open Sonarr at <a href="http://localhost:8989" target="_blank" rel="noopener noreferrer" className="text-purple-400 hover:underline">http://localhost:8989</a>
                        </li>
                        <li>
                            <strong>Media Management:</strong> Go to Settings → Media Management. Enable "Rename Episodes" to keep your library clean.
                        </li>
                        <li>
                            <strong>Root Folders:</strong> Go to Settings → Media Management → Root Folders.
                            Add <code>/tv</code> (this maps to your actual TV shows directory).
                        </li>
                        <li>
                            <strong>Indexers:</strong> If you use Prowlarr (recommended), you don't need to add indexers here. 
                            Instead, connect Sonarr inside Prowlarr.
                        </li>
                        <li>
                            <strong>Download Client:</strong> Go to Settings → Download Clients.
                            <ul className="list-disc list-inside ml-5 mt-1 text-xs text-gray-400">
                                <li>Click <strong>+</strong> and select <strong>qBittorrent</strong>.</li>
                                <li>Host: <code>qbittorrent</code></li>
                                <li>Port: <code>8080</code></li>
                                <li>Username/Password: <code>admin</code> / <code>adminadmin</code> (Change these if you updated them!)</li>
                                <li>Category: <code>sonarr</code></li>
                            </ul>
                        </li>
                    </ol>
                </div>

                <div>
                    <h3 className="text-base font-semibold text-white mb-2">Adding a Series</h3>
                    <ol className="list-decimal list-inside space-y-2 text-gray-300">
                        <li>Click <strong>Series</strong> in the sidebar, then <strong>Add New</strong>.</li>
                        <li>Search for a show (e.g., "Breaking Bad").</li>
                        <li>Select your <strong>Root Folder</strong> and <strong>Quality Profile</strong> (e.g., HD - 1080p).</li>
                        <li>Click <strong>Add Series</strong> (or "Add and Search" to start downloading immediately).</li>
                    </ol>
                </div>
            </section>
        </AppGuideLayout>
    )
}
