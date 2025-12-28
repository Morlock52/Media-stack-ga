import { ListVideo } from 'lucide-react'
import { AppGuideLayout } from './AppGuideLayout'

export function OmbiGuide() {
    return (
        <AppGuideLayout
            icon={<ListVideo className="w-7 h-7 text-emerald-300" />}
            title="Ombi"
            subtitle="Media request system with user management"
            category="Requests"
            estimatedTime="20-30 minutes"
        >
            <section className="space-y-6 text-sm text-gray-300">
                <div>
                    <h3 className="text-base font-semibold text-white mb-2">What is Ombi?</h3>
                    <p>
                        Ombi is a self-hosted web application that allows your users to request content for
                        your Plex/Jellyfin/Emby server. It automatically sends requests to Sonarr/Radarr
                        and provides a friendly interface for managing user requests.
                    </p>
                </div>

                <div>
                    <h3 className="text-base font-semibold text-white mb-2">Initial setup</h3>
                    <ol className="list-decimal list-inside space-y-2 text-gray-300">
                        <li>
                            Open <code>https://ombi.yourdomain.com</code> or <code>http://localhost:5000</code>.
                        </li>
                        <li>
                            Create your admin account on first launch.
                        </li>
                        <li>
                            Complete the media server wizard to connect Plex or Jellyfin.
                        </li>
                        <li>
                            Configure Sonarr and Radarr in <strong>Settings → TV/Movies</strong>.
                        </li>
                    </ol>
                </div>

                <div>
                    <h3 className="text-base font-semibold text-white mb-2">Connect to Plex</h3>
                    <ol className="list-decimal list-inside space-y-2 text-gray-300">
                        <li>
                            Go to <strong>Settings → Plex</strong>.
                        </li>
                        <li>
                            Sign in with your Plex account credentials.
                        </li>
                        <li>
                            Select your Plex server from the list.
                        </li>
                        <li>
                            Enable <strong>Import Plex Users</strong> to sync existing users.
                        </li>
                    </ol>
                </div>

                <div>
                    <h3 className="text-base font-semibold text-white mb-2">User management</h3>
                    <ul className="list-disc list-inside space-y-2 text-gray-300">
                        <li>
                            Users can sign in with their Plex credentials if enabled.
                        </li>
                        <li>
                            Set request limits per user in <strong>User Management</strong>.
                        </li>
                        <li>
                            Create user roles with different permission levels.
                        </li>
                    </ul>
                </div>

                <div>
                    <h3 className="text-base font-semibold text-white mb-2">Notifications</h3>
                    <p className="mb-2">
                        Configure notifications in <strong>Settings → Notifications</strong>:
                    </p>
                    <ul className="list-disc list-inside space-y-2 text-gray-300">
                        <li>Email notifications for request status updates</li>
                        <li>Discord/Slack webhooks for admin alerts</li>
                        <li>Mobile push notifications via Pushover</li>
                    </ul>
                </div>
            </section>
        </AppGuideLayout>
    )
}
