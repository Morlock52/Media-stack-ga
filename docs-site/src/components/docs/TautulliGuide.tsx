import { Activity, Link as LinkIcon, CheckCircle2 } from 'lucide-react'
import { AppGuideLayout } from './AppGuideLayout'

export function TautulliGuide() {
    return (
        <AppGuideLayout
            icon={<Activity className="w-7 h-7 text-primary" />}
            title="Tautulli for Plex Stats"
            subtitle="Monitor Plex usage, streams, and history"
            category="Monitoring App Guide"
            estimatedTime="20–30 minutes"
        >
            <section className="space-y-4 text-sm text-gray-300">
                <div>
                    <h3 className="text-base font-semibold text-white mb-2">What Tautulli does</h3>
                    <p>
                        Tautulli is a companion app for Plex that tracks who&apos;s watching, what they&apos;re watching, and how
                        often. It provides graphs, notifications, and history so you can understand how your server is
                        used.
                    </p>
                </div>

                <div>
                    <h3 className="text-base font-semibold text-white mb-2">Before you start</h3>
                    <ul className="list-disc list-inside space-y-1 text-gray-300">
                        <li>Plex is already set up and working.</li>
                        <li>Your Plex server name and IP/hostname are known.</li>
                        <li>You have already run <code>docker compose up -d</code> and the Tautulli container is running.</li>
                    </ul>
                </div>

                <div>
                    <h3 className="text-base font-semibold text-white mb-2">1. Open Tautulli</h3>
                    <ol className="list-decimal list-inside space-y-1 text-gray-300">
                        <li>
                            In your browser, open the Tautulli URL from your stack. Common defaults:
                            <ul className="list-disc list-inside ml-5 text-xs text-gray-400 mt-1">
                                <li><code>http://localhost:8181</code> on a local machine.</li>
                                <li><code>https://tautulli.your-domain.com</code> if you configured a subdomain.</li>
                            </ul>
                        </li>
                        <li>You should see the Tautulli setup wizard or login screen.</li>
                    </ol>
                </div>

                <div>
                    <h3 className="text-base font-semibold text-white mb-2">2. Connect to Plex</h3>
                    <ol className="list-decimal list-inside space-y-1 text-gray-300">
                        <li>On the first screen, Tautulli will ask how to connect to Plex.</li>
                        <li>Select your Plex server from the list or enter its IP/hostname and port.</li>
                        <li>
                            If prompted, sign in with the same Plex account you used to claim the server so Tautulli can
                            read activity.
                        </li>
                        <li>Test the connection and save.</li>
                    </ol>
                </div>

                <div>
                    <h3 className="text-base font-semibold text-white mb-2">3. Basic settings</h3>
                    <ol className="list-decimal list-inside space-y-1 text-gray-300">
                        <li>Go to <strong>Settings</strong> in the Tautulli sidebar.</li>
                        <li>Set your time zone and preferred units.</li>
                        <li>Optionally enable HTTPS or reverse-proxy-related settings if you are exposing Tautulli externally.</li>
                        <li>Save changes.</li>
                    </ol>
                </div>

                <div>
                    <h3 className="text-base font-semibold text-white mb-2">4. View current activity</h3>
                    <ol className="list-decimal list-inside space-y-1 text-gray-300">
                        <li>Ask someone to start playing something from Plex (or start a stream yourself).</li>
                        <li>In Tautulli, go to the <strong>Current Activity</strong> or <strong>Now Playing</strong> page.</li>
                        <li>You should see the active stream(s) with user, device, and bitrate.</li>
                        <li>If nothing shows up, wait a few seconds and refresh.</li>
                    </ol>
                </div>

                <div>
                    <h3 className="text-base font-semibold text-white mb-2">5. Explore history and stats</h3>
                    <ol className="list-decimal list-inside space-y-1 text-gray-300">
                        <li>Open the <strong>History</strong> section to see past plays.</li>
                        <li>Filter by user, library, or time range to understand patterns.</li>
                        <li>Use the <strong>Graphs</strong> or <strong>Statistics</strong> pages to see top users and most-watched items.</li>
                    </ol>
                </div>

                <div className="rounded-2xl border border-primary/30 bg-primary/10 p-4 flex items-start gap-3 text-xs text-primary">
                    <CheckCircle2 className="w-4 h-4 mt-0.5" />
                    <div>
                        <p className="font-semibold mb-1">Tautulli is watching your Plex</p>
                        <p>
                            Once history and stats start filling in, you can quickly answer questions like "Who is using the
                            server the most?" and "What gets watched the most?".
                        </p>
                    </div>
                </div>

                <div>
                    <h3 className="text-base font-semibold text-white mb-2">Where Tautulli fits in your stack</h3>
                    <ul className="list-disc list-inside space-y-1 text-gray-300">
                        <li>Tautulli reads Plex activity; it does not change media or requests.</li>
                        <li>It is purely for monitoring and analytics, not for downloading or serving media.</li>
                        <li>It works alongside Overseerr and the *Arr stack to give you insight into how the system is used.</li>
                    </ul>
                </div>

                <div>
                    <h3 className="text-base font-semibold text-white mb-2">Common issues</h3>
                    <ul className="list-disc list-inside space-y-1 text-gray-300 text-xs">
                        <li>
                            <strong>No activity shown:</strong> Confirm Tautulli is connected to the right Plex server and
                            that streams are actually playing.
                        </li>
                        <li>
                            <strong>Wrong users or missing names:</strong> Ensure Plex user accounts are set up correctly and
                            that you are not all using a single shared account.
                        </li>
                        <li>
                            <strong>Slow or empty graphs:</strong> Tautulli builds data over time; give it a few days of real
                            usage to populate stats.
                        </li>
                    </ul>
                </div>

                <div className="flex items-center gap-2 pt-2 text-xs text-gray-400">
                    <LinkIcon className="w-4 h-4" />
                    <span>For notifications, Discord/webhook alerts, and advanced reports, see the Tautulli documentation.</span>
                </div>
            </section>
        </AppGuideLayout>
    )
}
