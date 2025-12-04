import { MonitorPlay, Link as LinkIcon, CheckCircle2 } from 'lucide-react'
import { AppGuideLayout } from './AppGuideLayout'

export function EmbyGuide() {
    return (
        <AppGuideLayout
            icon={<MonitorPlay className="w-7 h-7 text-purple-100" />}
            title="Emby Media Server"
            subtitle="Feature-rich media server with strong live TV support"
            category="Media Server Guide"
            estimatedTime="20–40 minutes"
        >
            <section className="space-y-4 text-sm text-gray-300">
                <div>
                    <h3 className="text-base font-semibold text-white mb-2">What Emby does</h3>
                    <p>
                        Emby is a media server that organizes your movies, TV shows, music, and photos into a 
                        beautiful interface. It's known for excellent live TV and DVR support, parental controls, 
                        and polished apps across all platforms. Some premium features require Emby Premiere.
                    </p>
                </div>

                <div>
                    <h3 className="text-base font-semibold text-white mb-2">Before you start</h3>
                    <ul className="list-disc list-inside space-y-1 text-gray-300">
                        <li>You have already run <code>docker compose up -d</code> on your server.</li>
                        <li>The Emby container is running (check with <code>docker compose ps</code>).</li>
                        <li>Your media folders exist (for example <code>/data/media/movies</code> and <code>/data/media/tv</code>).</li>
                        <li>Optional: Create a free Emby Connect account at <code>emby.media</code> for easier remote access.</li>
                    </ul>
                </div>

                <div>
                    <h3 className="text-base font-semibold text-white mb-2">1. Open the Emby web UI</h3>
                    <ol className="list-decimal list-inside space-y-1 text-gray-300">
                        <li>
                            In your browser, go to the Emby URL from your stack. Common defaults:
                            <ul className="list-disc list-inside ml-5 text-xs text-gray-400 mt-1">
                                <li><code>http://localhost:8096</code> if running on your local machine.</li>
                                <li><code>https://emby.your-domain.com</code> if you used a subdomain in the wizard.</li>
                            </ul>
                        </li>
                        <li>You should see the Emby welcome wizard.</li>
                    </ol>
                </div>

                <div>
                    <h3 className="text-base font-semibold text-white mb-2">2. Select language and create admin account</h3>
                    <ol className="list-decimal list-inside space-y-1 text-gray-300">
                        <li>Select your preferred language from the dropdown.</li>
                        <li>Click <strong>Next</strong>.</li>
                        <li>Enter a username (e.g., <code>admin</code> or your name).</li>
                        <li>Enter a strong password and confirm it.</li>
                        <li>Click <strong>Next</strong> to continue.</li>
                    </ol>
                </div>

                <div>
                    <h3 className="text-base font-semibold text-white mb-2">3. Add your media libraries</h3>
                    <ol className="list-decimal list-inside space-y-1 text-gray-300">
                        <li>Click <strong>New Library</strong> (the + button).</li>
                        <li>Choose a content type: <strong>Movies</strong>, <strong>TV Shows</strong>, <strong>Music</strong>, or <strong>Photos</strong>.</li>
                        <li>Give it a display name like <code>Movies</code>.</li>
                        <li>Click <strong>Add</strong> next to Folders and browse to your media path (e.g., <code>/data/media/movies</code>).</li>
                        <li>Leave other settings at defaults for now.</li>
                        <li>Click <strong>OK</strong> to create the library.</li>
                        <li>Repeat for TV Shows and any other media types you have.</li>
                        <li>Click <strong>Next</strong> when finished.</li>
                    </ol>
                </div>

                <div>
                    <h3 className="text-base font-semibold text-white mb-2">4. Configure metadata settings</h3>
                    <ol className="list-decimal list-inside space-y-1 text-gray-300">
                        <li>Select your preferred metadata language (e.g., English).</li>
                        <li>Select your country for regional content.</li>
                        <li>Click <strong>Next</strong>.</li>
                    </ol>
                </div>

                <div>
                    <h3 className="text-base font-semibold text-white mb-2">5. Configure remote access</h3>
                    <ol className="list-decimal list-inside space-y-1 text-gray-300">
                        <li>Decide if you want to allow remote access outside your home network.</li>
                        <li>If using a reverse proxy or Cloudflare tunnel, you can enable this.</li>
                        <li>Optionally link an Emby Connect account for easier app sign-in.</li>
                        <li>Click <strong>Next</strong>, then <strong>Finish</strong>.</li>
                    </ol>
                </div>

                <div>
                    <h3 className="text-base font-semibold text-white mb-2">6. Wait for library scan and test playback</h3>
                    <ol className="list-decimal list-inside space-y-1 text-gray-300">
                        <li>Emby will start scanning your libraries in the background. This may take a while for large collections.</li>
                        <li>Once some items appear, click on any movie or episode.</li>
                        <li>Press <strong>Play</strong> to test that video and audio work correctly.</li>
                        <li>Try on multiple devices (phone app, smart TV) to confirm everything connects.</li>
                    </ol>
                </div>

                <div className="rounded-2xl border border-purple-500/30 bg-purple-500/5 p-4 flex items-start gap-3 text-xs text-purple-100">
                    <CheckCircle2 className="w-4 h-4 mt-0.5" />
                    <div>
                        <p className="font-semibold mb-1">Core setup complete!</p>
                        <p>
                            Emby is now ready for use. Install Emby apps on your devices and sign in with 
                            your server address or Emby Connect account.
                        </p>
                    </div>
                </div>

                <div>
                    <h3 className="text-base font-semibold text-white mb-2">Where Emby fits in your stack</h3>
                    <ul className="list-disc list-inside space-y-1 text-gray-300">
                        <li>Emby is the "front end" for watching media – the interface your family uses.</li>
                        <li>The *Arr apps (Sonarr, Radarr) download media into folders that Emby scans.</li>
                        <li>Emby has built-in live TV and DVR if you add a tuner.</li>
                        <li>Emby Premiere ($119 lifetime or $4.99/month) unlocks hardware transcoding, sync, and more.</li>
                    </ul>
                </div>

                <div>
                    <h3 className="text-base font-semibold text-white mb-2">Common issues</h3>
                    <ul className="list-disc list-inside space-y-1 text-gray-300 text-xs">
                        <li>
                            <strong>No media showing:</strong> Verify your library paths match the Docker 
                            volume mappings. Use <code>docker compose logs emby</code> to check for errors.
                        </li>
                        <li>
                            <strong>Hardware transcoding not working:</strong> This requires Emby Premiere. 
                            Also ensure GPU passthrough is configured in Docker.
                        </li>
                        <li>
                            <strong>Apps can't find server:</strong> Make sure your device is on the same network, 
                            or configure Emby Connect for remote discovery.
                        </li>
                    </ul>
                </div>

                <div className="flex items-center gap-2 pt-2 text-xs text-gray-400">
                    <LinkIcon className="w-4 h-4" />
                    <span>For live TV setup, plugins, and advanced configuration, see the official Emby documentation at emby.media.</span>
                </div>
            </section>
        </AppGuideLayout>
    )
}
