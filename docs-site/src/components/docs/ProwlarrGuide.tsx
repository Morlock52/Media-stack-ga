import { Search } from 'lucide-react'
import { AppGuideLayout } from './AppGuideLayout'

export function ProwlarrGuide() {
    return (
        <AppGuideLayout
            icon={<Search className="w-7 h-7 text-red-400" />}
            title="Prowlarr"
            subtitle="Indexer manager for Sonarr, Radarr, and more"
            category="Automation"
            estimatedTime="10–20 minutes"
        >
            <section className="space-y-6 text-sm text-gray-300">
                <div>
                    <h3 className="text-base font-semibold text-white mb-2">What is Prowlarr?</h3>
                    <p>
                        Prowlarr manages your indexers (torrent trackers or Usenet indexers) in one place and syncs them to Sonarr, Radarr, and other apps. 
                        This saves you from adding indexers manually to each app.
                    </p>
                </div>

                <div>
                    <h3 className="text-base font-semibold text-white mb-2">Configuration</h3>
                    <ol className="list-decimal list-inside space-y-2 text-gray-300">
                        <li>
                            Open Prowlarr at <a href="http://localhost:9696" target="_blank" rel="noopener noreferrer" className="text-purple-400 hover:underline">http://localhost:9696</a>
                        </li>
                        <li>
                            <strong>Add Indexers:</strong> Go to <strong>Indexers</strong> → <strong>Add Indexer</strong>.
                            Search for your tracker (e.g., "1337x", "RARBG") or Usenet provider and follow the prompts.
                        </li>
                        <li>
                            <strong>Setup FlareSolverr:</strong> If using public trackers that have Cloudflare protection:
                            <ul className="list-disc list-inside ml-5 mt-1 text-xs text-gray-400">
                                <li>Go to Settings → Indexers.</li>
                                <li>Add "FlareSolverr".</li>
                                <li>Host: <code>http://flaresolverr:8191</code></li>
                                <li>Add the tag <code>flaresolverr</code> to your protected indexers.</li>
                            </ul>
                        </li>
                        <li>
                            <strong>Connect Apps:</strong> Go to <strong>Settings</strong> → <strong>Apps</strong> → <strong>+</strong>.
                            <ul className="list-disc list-inside ml-5 mt-1 text-xs text-gray-400">
                                <li>Select <strong>Sonarr</strong>. Server: <code>http://sonarr:8989</code>. Copy the API Key from Sonarr (Settings → General).</li>
                                <li>Select <strong>Radarr</strong>. Server: <code>http://radarr:7878</code>. Copy the API Key from Radarr (Settings → General).</li>
                            </ul>
                        </li>
                    </ol>
                </div>
            </section>
        </AppGuideLayout>
    )
}
