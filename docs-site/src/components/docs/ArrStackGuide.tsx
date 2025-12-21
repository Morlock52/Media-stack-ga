import { Layers, Link as LinkIcon, CheckCircle2 } from 'lucide-react'
import { AppGuideLayout } from './AppGuideLayout'

export function ArrStackGuide() {
    return (
        <AppGuideLayout
            icon={<Layers className="w-7 h-7 text-primary" />}
            title="*Arr Automation Stack"
            subtitle="Sonarr, Radarr, Prowlarr and friends – automated media downloads"
            category="Automation Stack Guide"
            estimatedTime="45–90 minutes"
        >
            <section className="space-y-4 text-sm text-gray-300">
                <div>
                    <h3 className="text-base font-semibold text-white mb-2">What the *Arr stack does</h3>
                    <p>
                        The *Arr apps automate finding, downloading, and organizing your media. Together they can watch
                        for new episodes or movies, grab them from your indexers, send them to your download client, and
                        then move them into the correct folders for Plex, Jellyfin, or Emby.
                    </p>
                    <p className="mt-2 text-xs text-gray-400">
                        Common members of the stack:
                    </p>
                    <ul className="list-disc list-inside space-y-1 text-xs text-gray-400">
                        <li><strong>Sonarr</strong> – TV shows</li>
                        <li><strong>Radarr</strong> – Movies</li>
                        <li><strong>Prowlarr</strong> – Indexer manager shared by Sonarr/Radarr/etc.</li>
                        <li><strong>Readarr</strong>, <strong>Lidarr</strong>, <strong>Whisparr</strong> – Books, music, and other content types.</li>
                    </ul>
                </div>

                <div>
                    <h3 className="text-base font-semibold text-white mb-2">Before you start</h3>
                    <ul className="list-disc list-inside space-y-1 text-gray-300">
                        <li>You have already run <code>docker compose up -d</code> on your server.</li>
                        <li>Your media server (Plex/Jellyfin/Emby) is already working and scanning the correct folders.</li>
                        <li>Your download client (for example qBittorrent or NZBGet) is running from the same stack.</li>
                        <li>You have at least one indexer or usenet/torrent provider set up (check your provider&apos;s docs).</li>
                    </ul>
                </div>

                <div>
                    <h3 className="text-base font-semibold text-white mb-2">1. Open each *Arr app</h3>
                    <ol className="list-decimal list-inside space-y-1 text-gray-300">
                        <li>
                            In your browser, open the URLs from your stack. Common defaults (adjust to match your config):
                            <ul className="list-disc list-inside ml-5 text-xs text-gray-400 mt-1">
                                <li><code>http://localhost:8989</code> – Sonarr</li>
                                <li><code>http://localhost:7878</code> – Radarr</li>
                                <li><code>http://localhost:9696</code> – Prowlarr</li>
                            </ul>
                        </li>
                        <li>If you use subdomains, they might look like <code>https://sonarr.your-domain.com</code>, etc.</li>
                    </ol>
                </div>

                <div>
                    <h3 className="text-base font-semibold text-white mb-2">2. Configure Prowlarr (indexers)</h3>
                    <ol className="list-decimal list-inside space-y-1 text-gray-300">
                        <li>In Prowlarr, go to <strong>Settings → Indexers</strong>.</li>
                        <li>Click the <strong>+</strong> button and pick your provider (e.g., a usenet or torrent indexer).</li>
                        <li>Enter the API key / credentials from your provider dashboard.</li>
                        <li>Test the connection and save.</li>
                        <li>Repeat for each indexer you want to use.</li>
                        <li>
                            Go to <strong>Settings → Apps</strong> and connect Sonarr and Radarr so they can use Prowlarr&apos;s
                            indexers automatically.
                        </li>
                    </ol>
                </div>

                <div>
                    <h3 className="text-base font-semibold text-white mb-2">3. Connect Sonarr/Radarr to your download client</h3>
                    <ol className="list-decimal list-inside space-y-1 text-gray-300">
                        <li>In Sonarr, go to <strong>Settings → Download Clients</strong>.</li>
                        <li>Click <strong>+</strong> and choose your client (e.g., qBittorrent).</li>
                        <li>Enter the host, port, and API key (from the download client&apos;s settings).</li>
                        <li>Test and save the connection.</li>
                        <li>Repeat the same steps in Radarr so both apps can talk to the same client.</li>
                    </ol>
                </div>

                <div>
                    <h3 className="text-base font-semibold text-white mb-2">4. Map paths correctly (very important)</h3>
                    <ol className="list-decimal list-inside space-y-1 text-gray-300">
                        <li>
                            Make sure Sonarr, Radarr, and your download client all see the <strong>same</strong> download and media
                            folders inside their containers.
                        </li>
                        <li>In Sonarr and Radarr, open <strong>Settings → Media Management</strong> / <strong>Root Folders</strong>.</li>
                        <li>Add root folders that match your compose file (e.g., <code>/data/media/tv</code>, <code>/data/media/movies</code>).</li>
                        <li>
                            In your download client, confirm the completed downloads folder is on a path like
                            <code>/data/downloads/completed</code>, with the same base path used in Sonarr/Radarr&apos;s settings.
                        </li>
                    </ol>
                </div>

                <div>
                    <h3 className="text-base font-semibold text-white mb-2">5. Add a test series and movie</h3>
                    <ol className="list-decimal list-inside space-y-1 text-gray-300">
                        <li>In Sonarr, click <strong>Add New Series</strong>.</li>
                        <li>Search for a show you know is available (e.g., a popular TV series).</li>
                        <li>Select the root folder (your TV path) and a basic quality profile.</li>
                        <li>Choose <strong>Start search for missing episodes</strong> and save.</li>
                        <li>In Radarr, do the same with <strong>Add New Movie</strong>, picking a known movie and your movies root folder.</li>
                    </ol>
                </div>

                <div>
                    <h3 className="text-base font-semibold text-white mb-2">6. Watch the first automated download</h3>
                    <ol className="list-decimal list-inside space-y-1 text-gray-300">
                        <li>Open your download client&apos;s web UI.</li>
                        <li>You should see one or more downloads queued from Sonarr/Radarr.</li>
                        <li>Once finished, the *Arr app will move and rename the files into your media folders.</li>
                        <li>After a few minutes, check Plex/Jellyfin/Emby – the new series or movie should now appear in your library.</li>
                    </ol>
                </div>

                <div className="rounded-2xl border border-primary/30 bg-primary/10 p-4 flex items-start gap-3 text-xs text-primary">
                    <CheckCircle2 className="w-4 h-4 mt-0.5" />
                    <div>
                        <p className="font-semibold mb-1">Automation online!</p>
                        <p>
                            Once this loop works (indexer → *Arr → download client → media server), your stack is doing the
                            hard work for you. You can now add series and movies from simple search boxes instead of
                            managing files by hand.
                        </p>
                    </div>
                </div>

                <div>
                    <h3 className="text-base font-semibold text-white mb-2">Where the *Arr stack fits in your project</h3>
                    <ul className="list-disc list-inside space-y-1 text-gray-300">
                        <li>Plex/Jellyfin/Emby are the <strong>players</strong>.</li>
                        <li>The *Arr stack + indexers + download client is the <strong>pipeline</strong> feeding them new content.</li>
                        <li>Overseerr / Jellyseerr sit in front, letting users request content that flows through this pipeline.</li>
                        <li>Tautulli observes Plex usage so you can see what people actually watch.</li>
                    </ul>
                </div>

                <div>
                    <h3 className="text-base font-semibold text-white mb-2">Common issues</h3>
                    <ul className="list-disc list-inside space-y-1 text-gray-300 text-xs">
                        <li>
                            <strong>Stuck in "pending" or no downloads:</strong> Check indexer status in Prowlarr and test
                            your provider&apos;s API keys.
                        </li>
                        <li>
                            <strong>Files download but never import:</strong> Usually a path mapping issue – make sure the
                            completed downloads folder looks the same inside Sonarr/Radarr and the download client.
                        </li>
                        <li>
                            <strong>Media shows in Plex/Jellyfin but with wrong titles:</strong> Verify the naming and
                            folder structure recommendations in the *Arr documentation and your media server&apos;s docs.
                        </li>
                    </ul>
                </div>

                <div className="flex items-center gap-2 pt-2 text-xs text-gray-400">
                    <LinkIcon className="w-4 h-4" />
                    <span>
                        For advanced release profiles, custom formats, and multi-server setups, see the official Sonarr,
                        Radarr, and Prowlarr documentation.
                    </span>
                </div>
            </section>
        </AppGuideLayout>
    )
}
