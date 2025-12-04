import { Film, Link as LinkIcon, CheckCircle2 } from 'lucide-react'
import { AppGuideLayout } from './AppGuideLayout'

export function PlexGuide() {
    return (
        <AppGuideLayout
            icon={<Film className="w-7 h-7 text-purple-100" />}
            title="Plex Media Server"
            subtitle="Set up your main media server and connect your library"
            category="Media Server Guide"
            estimatedTime="20–40 minutes"
        >
            <section className="space-y-4 text-sm text-gray-300">
                <div>
                    <h3 className="text-base font-semibold text-white mb-2">What Plex does</h3>
                    <p>
                        Plex is your main media server. It scans your movies and TV shows from disk, downloads artwork
                        and metadata, and streams them to your devices (TV, phone, tablet, browser) with a polished UI.
                    </p>
                </div>

                <div>
                    <h3 className="text-base font-semibold text-white mb-2">Before you start</h3>
                    <ul className="list-disc list-inside space-y-1 text-gray-300">
                        <li>You have already run <code>docker compose up -d</code> on your server.</li>
                        <li>The Plex container is running (check with <code>docker compose ps</code>).</li>
                        <li>Your media folders exist (for example <code>/data/media/movies</code> and <code>/data/media/tv</code>).</li>
                        <li>You have a free Plex account at <code>https://plex.tv</code>.</li>
                    </ul>
                </div>

                <div>
                    <h3 className="text-base font-semibold text-white mb-2">1. Open the Plex web UI</h3>
                    <ol className="list-decimal list-inside space-y-1 text-gray-300">
                        <li>
                            In your browser, go to the Plex URL from your stack. Common defaults:
                            <ul className="list-disc list-inside ml-5 text-xs text-gray-400 mt-1">
                                <li><code>http://localhost:32400/web</code> if running on your local machine.</li>
                                <li><code>https://plex.your-domain.com</code> if you used a subdomain in the wizard.</li>
                            </ul>
                        </li>
                        <li>Sign in with your Plex account when prompted.</li>
                    </ol>
                </div>

                <div>
                    <h3 className="text-base font-semibold text-white mb-2">2. Claim your server</h3>
                    <ol className="list-decimal list-inside space-y-1 text-gray-300">
                        <li>If Plex shows a setup wizard, give your server a friendly name (for example "Media Stack").</li>
                        <li>
                            If it asks for a <strong>claim token</strong> and you do not have one yet:
                            <ul className="list-disc list-inside ml-5 text-xs text-gray-400 mt-1">
                                <li>In another tab, go to <code>https://plex.tv/claim</code> while logged in.</li>
                                <li>Copy the token shown (it expires in about 4 minutes).</li>
                                <li>Paste that token into the Plex setup screen and continue.</li>
                            </ul>
                        </li>
                        <li>Wait a moment while Plex links the server to your account.</li>
                    </ol>
                </div>

                <div>
                    <h3 className="text-base font-semibold text-white mb-2">3. Add your libraries (movies and TV)</h3>
                    <ol className="list-decimal list-inside space-y-1 text-gray-300">
                        <li>In the left sidebar, click the <strong>+</strong> next to "Libraries".</li>
                        <li>Choose a type: <strong>Movies</strong> or <strong>TV Shows</strong>.</li>
                        <li>Give the library a simple name like <code>Movies</code> or <code>TV</code>.</li>
                        <li>Click <strong>Next</strong>, then <strong>Browse for media folder</strong>.</li>
                        <li>Select the path you mapped in docker (for example <code>/data/media/movies</code>).</li>
                        <li>Click <strong>Add Library</strong>. Plex will begin scanning automatically.</li>
                    </ol>
                </div>

                <div>
                    <h3 className="text-base font-semibold text-white mb-2">4. Check remote access (optional at first)</h3>
                    <ol className="list-decimal list-inside space-y-1 text-gray-300">
                        <li>Go to <strong>Settings → Server → Remote Access</strong>.</li>
                        <li>
                            If you see a green checkmark, remote access is working. If not, do not panic: your local
                            network playback will still work fine.
                        </li>
                        <li>
                            Your stack&apos;s reverse proxy (and Cloudflare tunnel, if used) can handle remote access later.
                            For now, focus on getting local playback working.
                        </li>
                    </ol>
                </div>

                <div>
                    <h3 className="text-base font-semibold text-white mb-2">5. Test playback</h3>
                    <ol className="list-decimal list-inside space-y-1 text-gray-300">
                        <li>Wait a few minutes for Plex to finish its first scan.</li>
                        <li>Open your Movies or TV library and pick a title.</li>
                        <li>Click the <strong>Play</strong> button and confirm that video and audio work.</li>
                        <li>If playback stutters, try a smaller file or lower quality first.</li>
                    </ol>
                </div>

                <div className="rounded-2xl border border-purple-500/30 bg-purple-500/5 p-4 flex items-start gap-3 text-xs text-purple-100">
                    <CheckCircle2 className="w-4 h-4 mt-0.5" />
                    <div>
                        <p className="font-semibold mb-1">Core setup done</p>
                        <p>
                            At this point Plex is fully usable on your network. You can add apps on your TV, phone, or
                            tablet and sign in with the same account.
                        </p>
                    </div>
                </div>

                <div>
                    <h3 className="text-base font-semibold text-white mb-2">Where Plex fits in your stack</h3>
                    <ul className="list-disc list-inside space-y-1 text-gray-300">
                        <li>Plex is the "front end" for watching your media.</li>
                        <li>The *Arr apps (Sonarr, Radarr, etc.) feed new media into the folders Plex scans.</li>
                        <li>Tautulli can hook into Plex to track who is watching what.</li>
                        <li>Overseerr or Ombi let friends request titles, which then flow through *Arr → Plex.</li>
                    </ul>
                </div>

                <div>
                    <h3 className="text-base font-semibold text-white mb-2">Common issues</h3>
                    <ul className="list-disc list-inside space-y-1 text-gray-300 text-xs">
                        <li>
                            <strong>Server not showing in apps:</strong> Make sure you claimed the server and are logged in
                            with the same Plex account on all devices.
                        </li>
                        <li>
                            <strong>No media found:</strong> Confirm the library paths in Plex match the docker volume
                            mappings from your compose file.
                        </li>
                        <li>
                            <strong>Remote access red warning:</strong> This can often be ignored if you plan to use a
                            reverse proxy / tunnel. Focus on local playback first.
                        </li>
                    </ul>
                </div>

                <div className="flex items-center gap-2 pt-2 text-xs text-gray-400">
                    <LinkIcon className="w-4 h-4" />
                    <span>For advanced tuning (hardware transcoding, DVR, etc.), see the official Plex documentation.</span>
                </div>
            </section>
        </AppGuideLayout>
    )
}
