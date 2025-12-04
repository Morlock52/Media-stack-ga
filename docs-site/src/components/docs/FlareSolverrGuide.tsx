import { Bug } from 'lucide-react'
import { AppGuideLayout } from './AppGuideLayout'

export function FlareSolverrGuide() {
    return (
        <AppGuideLayout
            icon={<Bug className="w-7 h-7 text-amber-300" />}
            title="FlareSolverr"
            subtitle="Bypass Cloudflare challenges for stubborn indexers"
            category="Automation"
            estimatedTime="10 minutes"
        >
            <section className="space-y-6 text-sm text-gray-300">
                <div>
                    <h3 className="text-base font-semibold text-white mb-2">What it does</h3>
                    <p>
                        Some torrent or Usenet indexers sit behind aggressive Cloudflare protection. FlareSolverr acts as a lightweight
                        browser that solves the JS challenge and hands the clean response back to Prowlarr so Sonarr/Radarr never miss
                        releases. It only spins up when needed, so it has virtually zero footprint.
                    </p>
                </div>

                <div>
                    <h3 className="text-base font-semibold text-white mb-2">Wire it into Prowlarr</h3>
                    <ol className="list-decimal list-inside space-y-2 text-gray-300">
                        <li>
                            Open <code>https://prowlarr.yourdomain.com</code> → <strong>Settings</strong> → <strong>Indexers</strong> →
                            <strong>Add (+)</strong>.
                        </li>
                        <li>
                            Search for <strong>FlareSolverr</strong>, click it, and apply these fields:
                            <ul className="list-disc list-inside ml-5 mt-2 text-xs text-gray-400">
                                <li>Host: <code>http://flaresolverr:8191</code></li>
                                <li>Tag: <code>flaresolverr</code> (helps route only the indexers that need it)</li>
                                <li>Request Timeout: <code>120</code> seconds (Cloudflare challenges can take a moment)</li>
                            </ul>
                        </li>
                        <li>
                            Edit any indexer that struggles with Cloudflare, scroll to the bottom, and add the <code>flaresolverr</code> tag.
                            Prowlarr will automatically proxy matching requests through FlareSolverr.
                        </li>
                    </ol>
                </div>

                <div>
                    <h3 className="text-base font-semibold text-white mb-2">Health checks</h3>
                    <ul className="list-disc list-inside space-y-2 text-gray-300">
                        <li>
                            API reachable: <code>curl http://localhost:8191/</code> should return <code>FlareSolverr is ready!</code>.
                        </li>
                        <li>
                            Logs live at <code>docker compose logs -f flaresolverr</code>. Look for <em>&quot;Solving challenge&quot;</em> when
                            an indexer triggers it.
                        </li>
                        <li>
                            If Cloudflare rotates fingerprints, restart the container (<code>docker compose restart flaresolverr</code>) so it
                            grabs the newest stealth driver.
                        </li>
                    </ul>
                </div>
            </section>
        </AppGuideLayout>
    )
}
