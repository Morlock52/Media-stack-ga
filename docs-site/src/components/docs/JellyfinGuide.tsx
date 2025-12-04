import { Tv, Link as LinkIcon, CheckCircle2 } from 'lucide-react'
import { AppGuideLayout } from './AppGuideLayout'

export function JellyfinGuide() {
    return (
        <AppGuideLayout
            icon={<Tv className="w-7 h-7 text-purple-100" />}
            title="Jellyfin Media Server"
            subtitle="100% free and open-source media streaming"
            category="Media Server Guide"
            estimatedTime="15–30 minutes"
        >
            <section className="space-y-4 text-sm text-gray-300">
                <div>
                    <h3 className="text-base font-semibold text-white mb-2">What Jellyfin does</h3>
                    <p>
                        Jellyfin is a fully open-source media server with no paid tier or tracking. It scans your 
                        movies, TV shows, and music, downloads artwork and metadata, and streams to any device 
                        through apps or a web browser. Think of it as a free alternative to Plex with no premium features locked away.
                    </p>
                </div>

                <div>
                    <h3 className="text-base font-semibold text-white mb-2">Before you start</h3>
                    <ul className="list-disc list-inside space-y-1 text-gray-300">
                        <li>You have already run <code>docker compose up -d</code> on your server.</li>
                        <li>The Jellyfin container is running (check with <code>docker compose ps</code>).</li>
                        <li>Your media folders exist (for example <code>/data/media/movies</code> and <code>/data/media/tv</code>).</li>
                        <li>No account is needed – Jellyfin is entirely self-hosted with no external login.</li>
                    </ul>
                </div>

                <div>
                    <h3 className="text-base font-semibold text-white mb-2">1. Open the Jellyfin web UI</h3>
                    <ol className="list-decimal list-inside space-y-1 text-gray-300">
                        <li>
                            In your browser, go to the Jellyfin URL from your stack. Common defaults:
                            <ul className="list-disc list-inside ml-5 text-xs text-gray-400 mt-1">
                                <li><code>http://localhost:8096</code> if running on your local machine.</li>
                                <li><code>https://jellyfin.your-domain.com</code> if you used a subdomain in the wizard.</li>
                            </ul>
                        </li>
                        <li>You should see the Jellyfin first-time setup wizard.</li>
                    </ol>
                </div>

                <div>
                    <h3 className="text-base font-semibold text-white mb-2">2. Create your admin account</h3>
                    <ol className="list-decimal list-inside space-y-1 text-gray-300">
                        <li>Choose your preferred display language (you can change this later).</li>
                        <li>Enter a username like <code>admin</code> or your name.</li>
                        <li>Pick a strong password and store it somewhere safe (password manager recommended).</li>
                        <li>Click <strong>Next</strong> to continue.</li>
                    </ol>
                </div>

                <div>
                    <h3 className="text-base font-semibold text-white mb-2">3. Add your media libraries</h3>
                    <ol className="list-decimal list-inside space-y-1 text-gray-300">
                        <li>Click <strong>Add Media Library</strong>.</li>
                        <li>Choose a content type: <strong>Movies</strong>, <strong>Shows</strong>, or <strong>Music</strong>.</li>
                        <li>Give the library a display name like <code>Movies</code> or <code>TV Shows</code>.</li>
                        <li>Click the <strong>+</strong> next to Folders and browse to the path mapped in Docker (e.g., <code>/data/media/movies</code>).</li>
                        <li>Leave metadata settings at defaults for now – you can tune them later.</li>
                        <li>Click <strong>OK</strong> to add the library, then repeat for TV Shows.</li>
                        <li>Click <strong>Next</strong> when done adding libraries.</li>
                    </ol>
                </div>

                <div>
                    <h3 className="text-base font-semibold text-white mb-2">4. Configure metadata language</h3>
                    <ol className="list-decimal list-inside space-y-1 text-gray-300">
                        <li>Select your preferred metadata language (e.g., English).</li>
                        <li>Select your country for regional content matching.</li>
                        <li>Click <strong>Next</strong>.</li>
                    </ol>
                </div>

                <div>
                    <h3 className="text-base font-semibold text-white mb-2">5. Configure remote access (optional)</h3>
                    <ol className="list-decimal list-inside space-y-1 text-gray-300">
                        <li>If you want to stream outside your home, check "Allow remote connections to this server".</li>
                        <li>If using a reverse proxy or Cloudflare tunnel (from the wizard), you can leave this enabled.</li>
                        <li>Click <strong>Next</strong>, then <strong>Finish</strong> to complete setup.</li>
                    </ol>
                </div>

                <div>
                    <h3 className="text-base font-semibold text-white mb-2">6. Test playback</h3>
                    <ol className="list-decimal list-inside space-y-1 text-gray-300">
                        <li>Wait a few minutes for Jellyfin to scan your libraries and download metadata.</li>
                        <li>Go to your Movies or TV library from the home screen.</li>
                        <li>Click on any title and press <strong>Play</strong>.</li>
                        <li>Confirm video and audio work correctly in the web player.</li>
                    </ol>
                </div>

                <div className="rounded-2xl border border-purple-500/30 bg-purple-500/5 p-4 flex items-start gap-3 text-xs text-purple-100">
                    <CheckCircle2 className="w-4 h-4 mt-0.5" />
                    <div>
                        <p className="font-semibold mb-1">Core setup complete!</p>
                        <p>
                            Jellyfin is now ready for use. You can install Jellyfin apps on your TV, phone, Roku, 
                            Fire TV, Apple TV, and more – all free with no subscriptions.
                        </p>
                    </div>
                </div>

                <div>
                    <h3 className="text-base font-semibold text-white mb-2">Where Jellyfin fits in your stack</h3>
                    <ul className="list-disc list-inside space-y-1 text-gray-300">
                        <li>Jellyfin is the "front end" for watching your media – the player your family sees.</li>
                        <li>The *Arr apps (Sonarr, Radarr) download media into folders that Jellyfin scans.</li>
                        <li>Jellyseerr (or Overseerr) can connect to Jellyfin for media requests.</li>
                        <li>Unlike Plex, all features (hardware transcoding, sync, etc.) are free.</li>
                    </ul>
                </div>

                <div>
                    <h3 className="text-base font-semibold text-white mb-2">Common issues</h3>
                    <ul className="list-disc list-inside space-y-1 text-gray-300 text-xs">
                        <li>
                            <strong>No media showing:</strong> Confirm the library paths in Jellyfin match the 
                            Docker volume mappings from your compose file.
                        </li>
                        <li>
                            <strong>Slow transcoding:</strong> Enable hardware acceleration in Dashboard → Playback 
                            if your server has an Intel/AMD/NVIDIA GPU.
                        </li>
                        <li>
                            <strong>Can't connect remotely:</strong> Check your reverse proxy config or 
                            enable remote access in Dashboard → Networking.
                        </li>
                    </ul>
                </div>

                <div className="flex items-center gap-2 pt-2 text-xs text-gray-400">
                    <LinkIcon className="w-4 h-4" />
                    <span>For plugins, live TV/DVR, and advanced settings, see the official Jellyfin documentation at jellyfin.org.</span>
                </div>
            </section>
        </AppGuideLayout>
    )
}
