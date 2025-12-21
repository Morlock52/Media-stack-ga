import { Radio, Link as LinkIcon, CheckCircle2 } from 'lucide-react'
import { AppGuideLayout } from './AppGuideLayout'

export function AudiobookshelfGuide() {
    return (
        <AppGuideLayout
            icon={<Radio className="w-7 h-7 text-primary" />}
            title="Audiobookshelf Server"
            subtitle="Self-hosted audiobooks and podcasts for your household"
            category="Audio App Guide"
            estimatedTime="20–40 minutes"
        >
            <section className="space-y-4 text-sm text-gray-300">
                <div>
                    <h3 className="text-base font-semibold text-white mb-2">What Audiobookshelf does</h3>
                    <p>
                        Audiobookshelf is a self-hosted server for audiobooks and podcasts. It lets you stream your
                        collection to phones, tablets, and browsers, remember playback position, and keep everything
                        organized by series and author.
                    </p>
                </div>

                <div>
                    <h3 className="text-base font-semibold text-white mb-2">Before you start</h3>
                    <ul className="list-disc list-inside space-y-1 text-gray-300">
                        <li>You have already run <code>docker compose up -d</code> and the Audiobookshelf container is running.</li>
                        <li>Your audiobooks and/or podcasts are stored in folders (for example <code>/data/audio/audiobooks</code>).</li>
                        <li>You know your server IP or domain (e.g. <code>http://localhost</code> or a subdomain).</li>
                    </ul>
                </div>

                <div>
                    <h3 className="text-base font-semibold text-white mb-2">1. Open Audiobookshelf</h3>
                    <ol className="list-decimal list-inside space-y-1 text-gray-300">
                        <li>
                            In your browser, go to your Audiobookshelf URL. Common examples:
                            <ul className="list-disc list-inside ml-5 text-xs text-gray-400 mt-1">
                                <li><code>http://localhost:13378</code> on a local machine (default Docker port).</li>
                                <li><code>https://audio.your-domain.com</code> if you configured a subdomain.</li>
                            </ul>
                        </li>
                        <li>You should see the first-time setup / admin user creation screen.</li>
                    </ol>
                </div>

                <div>
                    <h3 className="text-base font-semibold text-white mb-2">2. Create your admin account</h3>
                    <ol className="list-decimal list-inside space-y-1 text-gray-300">
                        <li>Pick a username (e.g., <code>admin</code> or your name).</li>
                        <li>Choose a strong password and store it in a password manager.</li>
                        <li>Click <strong>Create account</strong> to continue.</li>
                    </ol>
                </div>

                <div>
                    <h3 className="text-base font-semibold text-white mb-2">3. Add your libraries</h3>
                    <ol className="list-decimal list-inside space-y-1 text-gray-300">
                        <li>From the sidebar, go to <strong>Libraries</strong>.</li>
                        <li>Click <strong>New Library</strong> and choose <strong>Audiobooks</strong> or <strong>Podcasts</strong>.</li>
                        <li>Give the library a name (for example <code>Audiobooks</code> or <code>Family Podcasts</code>).</li>
                        <li>Set the folder path to your audio directory (e.g., <code>/data/audio/audiobooks</code>).</li>
                        <li>Save the library. Audiobookshelf will begin scanning your files and fetching metadata.</li>
                    </ol>
                </div>

                <div>
                    <h3 className="text-base font-semibold text-white mb-2">4. Check that metadata looks right</h3>
                    <ol className="list-decimal list-inside space-y-1 text-gray-300">
                        <li>Open your Audiobooks library.</li>
                        <li>Click on one or two titles and confirm the cover art, title, and chapter list look reasonable.</li>
                        <li>If something is wrong, check the folder/filename structure in the official docs for best results.</li>
                    </ol>
                </div>

                <div>
                    <h3 className="text-base font-semibold text-white mb-2">5. Install mobile apps and connect</h3>
                    <ol className="list-decimal list-inside space-y-1 text-gray-300">
                        <li>On your phone, install the Audiobookshelf app for iOS or Android.</li>
                        <li>Open the app and enter the same server URL and your account credentials.</li>
                        <li>Verify that you can see the same libraries and start playing an audiobook.</li>
                        <li>Pause playback, then resume on another device or in the browser to confirm progress sync.</li>
                    </ol>
                </div>

                <div className="rounded-2xl border border-primary/30 bg-primary/10 p-4 flex items-start gap-3 text-xs text-primary">
                    <CheckCircle2 className="w-4 h-4 mt-0.5" />
                    <div>
                        <p className="font-semibold mb-1">Audiobookshelf is ready</p>
                        <p>
                            At this point your family can use Audiobookshelf just like any modern audiobook app, but with
                            your own files and full control.
                        </p>
                    </div>
                </div>

                <div>
                    <h3 className="text-base font-semibold text-white mb-2">Where Audiobookshelf fits in your stack</h3>
                    <ul className="list-disc list-inside space-y-1 text-gray-300">
                        <li>It is separate from Plex/Jellyfin – focused only on audio content.</li>
                        <li>You can expose it through the same reverse proxy / domain pattern you used for other apps.</li>
                        <li>It does not depend on *Arr apps; you typically manage audiobook files yourself.</li>
                    </ul>
                </div>

                <div>
                    <h3 className="text-base font-semibold text-white mb-2">Common issues</h3>
                    <ul className="list-disc list-inside space-y-1 text-gray-300 text-xs">
                        <li>
                            <strong>Books not grouped correctly:</strong> Check that files are organized by author / series /
                            book according to the Audiobookshelf recommendations.
                        </li>
                        <li>
                            <strong>Playback stops or stutters:</strong> Make sure your server has enough bandwidth and that
                            you&apos;re not on a very slow connection when remote.
                        </li>
                        <li>
                            <strong>Progress not syncing:</strong> Confirm you&apos;re using the same user account on all devices.
                        </li>
                    </ul>
                </div>

                <div className="flex items-center gap-2 pt-2 text-xs text-gray-400">
                    <LinkIcon className="w-4 h-4" />
                    <span>For advanced metadata rules, multi-user setups, and backups, see the Audiobookshelf documentation.</span>
                </div>
            </section>
        </AppGuideLayout>
    )
}
