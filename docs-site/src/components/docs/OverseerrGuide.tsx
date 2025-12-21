import { Search, Link as LinkIcon, CheckCircle2 } from 'lucide-react'
import { AppGuideLayout } from './AppGuideLayout'

export function OverseerrGuide() {
    return (
        <AppGuideLayout
            icon={<Search className="w-7 h-7 text-primary" />}
            title="Overseerr Requests"
            subtitle="Let friends request movies and shows that flow into your *Arr stack"
            category="Requests App Guide"
            estimatedTime="20–40 minutes"
        >
            <section className="space-y-4 text-sm text-gray-300">
                <div>
                    <h3 className="text-base font-semibold text-white mb-2">What Overseerr does</h3>
                    <p>
                        Overseerr is a friendly web app where you and your users can request movies and TV shows. Those
                        requests are sent to Radarr and Sonarr, which then handle the downloads and feed your media
                        server (Plex/Jellyfin/Emby).
                    </p>
                </div>

                <div>
                    <h3 className="text-base font-semibold text-white mb-2">Before you start</h3>
                    <ul className="list-disc list-inside space-y-1 text-gray-300">
                        <li>Your media server (Plex or Jellyfin) is already set up and working.</li>
                        <li>Your *Arr stack (Radarr/Sonarr + Prowlarr + download client) is working for at least one test title.</li>
                        <li>You have already run <code>docker compose up -d</code> and the Overseerr container is running.</li>
                    </ul>
                </div>

                <div>
                    <h3 className="text-base font-semibold text-white mb-2">1. Open Overseerr</h3>
                    <ol className="list-decimal list-inside space-y-1 text-gray-300">
                        <li>
                            In your browser, go to your Overseerr URL. Common examples:
                            <ul className="list-disc list-inside ml-5 text-xs text-gray-400 mt-1">
                                <li><code>http://localhost:5055</code> if you run on your local machine.</li>
                                <li><code>https://requests.your-domain.com</code> if you configured a subdomain.</li>
                            </ul>
                        </li>
                        <li>You should see the Overseerr setup or login screen.</li>
                    </ol>
                </div>

                <div>
                    <h3 className="text-base font-semibold text-white mb-2">2. Connect to Plex (or Jellyfin)</h3>
                    <ol className="list-decimal list-inside space-y-1 text-gray-300">
                        <li>
                            On first run, Overseerr normally asks you to sign in with Plex. Follow the prompts and allow
                            access. If you are using Jellyfin instead, use the Jellyfin integration in the settings after setup.
                        </li>
                        <li>Choose which Plex server Overseerr should use (if you have more than one).</li>
                        <li>Confirm which libraries (Movies/TV) should be visible for search and availability checks.</li>
                    </ol>
                </div>

                <div>
                    <h3 className="text-base font-semibold text-white mb-2">3. Connect Radarr and Sonarr</h3>
                    <ol className="list-decimal list-inside space-y-1 text-gray-300">
                        <li>In Overseerr, go to <strong>Settings → Services</strong>.</li>
                        <li>Click <strong>Add Service</strong> and choose <strong>Radarr</strong>.</li>
                        <li>
                            Enter the Radarr URL and API key (find the API key in Radarr under
                            <strong>Settings → General</strong>).
                        </li>
                        <li>Pick the correct root folder and quality profile for movies.</li>
                        <li>Repeat the same steps for <strong>Sonarr</strong> (URL, API key, root folder, quality profile).</li>
                        <li>Save and ensure you see green checkmarks / successful connection messages.</li>
                    </ol>
                </div>

                <div>
                    <h3 className="text-base font-semibold text-white mb-2">4. Configure users and permissions</h3>
                    <ol className="list-decimal list-inside space-y-1 text-gray-300">
                        <li>Go to <strong>Settings → Users</strong>.</li>
                        <li>If you use Plex, import users from your Plex server so they can log in.</li>
                        <li>For each user or role, choose whether requests are auto-approved or need admin approval.</li>
                        <li>Set limits if desired (e.g., maximum requests per user, per day/week).</li>
                    </ol>
                </div>

                <div>
                    <h3 className="text-base font-semibold text-white mb-2">5. Test a full request flow</h3>
                    <ol className="list-decimal list-inside space-y-1 text-gray-300">
                        <li>From the Overseerr home screen, search for a movie you do not yet have.</li>
                        <li>Click it and choose <strong>Request</strong>.</li>
                        <li>If you set auto-approval, the request will go straight to Radarr/Sonarr.</li>
                        <li>
                            Check Radarr or Sonarr: you should see the new item appear and a download queued in your
                            download client.
                        </li>
                        <li>After the download and import finish, Overseerr should mark the title as <strong>Available</strong>.</li>
                    </ol>
                </div>

                <div className="rounded-2xl border border-primary/30 bg-primary/10 p-4 flex items-start gap-3 text-xs text-primary">
                    <CheckCircle2 className="w-4 h-4 mt-0.5" />
                    <div>
                        <p className="font-semibold mb-1">Request loop working!</p>
                        <p>
                            At this point, friends and family can simply open Overseerr, search for what they want, and
                            click Request. Your *Arr stack and media server do the rest.
                        </p>
                    </div>
                </div>

                <div>
                    <h3 className="text-base font-semibold text-white mb-2">Where Overseerr fits in your stack</h3>
                    <ul className="list-disc list-inside space-y-1 text-gray-300">
                        <li>Overseerr is the <strong>request front-end</strong> for your users.</li>
                        <li>It talks to Plex/Jellyfin to see what you already have and who can log in.</li>
                        <li>It talks to Sonarr/Radarr, which then talk to indexers and your download client.</li>
                        <li>Finished media appears in Plex/Jellyfin/Emby without users needing to understand any of that.</li>
                    </ul>
                </div>

                <div>
                    <h3 className="text-base font-semibold text-white mb-2">Common issues</h3>
                    <ul className="list-disc list-inside space-y-1 text-gray-300 text-xs">
                        <li>
                            <strong>Requests never start downloading:</strong> Check the Radarr/Sonarr service settings and
                            confirm the API keys and URLs are correct.
                        </li>
                        <li>
                            <strong>Title shows as "Available" but not really there:</strong> Make sure the correct Plex
                            libraries are mapped and that Plex has finished scanning.
                        </li>
                        <li>
                            <strong>Users can&apos;t log in:</strong> If you use Plex authentication, confirm they are in your
                            Plex Home or Friends list and that Overseerr is linked to the right Plex account.
                        </li>
                    </ul>
                </div>

                <div className="flex items-center gap-2 pt-2 text-xs text-gray-400">
                    <LinkIcon className="w-4 h-4" />
                    <span>For webhooks, notifications, and advanced rules, see the Overseerr documentation on GitHub.</span>
                </div>
            </section>
        </AppGuideLayout>
    )
}
