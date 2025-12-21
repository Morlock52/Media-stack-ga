import { Bell } from 'lucide-react'
import { AppGuideLayout } from './AppGuideLayout'

export function NotifiarrGuide() {
    return (
        <AppGuideLayout
            icon={<Bell className="w-7 h-7 text-green-500" />}
            title="Notifiarr"
            subtitle="Unified Notifications for Discord"
            category="Monitoring"
            estimatedTime="10–15 minutes"
        >
            <section className="space-y-6 text-sm text-gray-300">
                <div>
                    <h3 className="text-base font-semibold text-white mb-2">About Notifiarr</h3>
                    <p>
                        Notifiarr connects your *Arr stack to Discord (and other services) to send rich, detailed notifications when media is grabbed, downloaded, or if there are issues.
                    </p>
                </div>

                <div>
                    <h3 className="text-base font-semibold text-white mb-2">Configuration</h3>
                    <ol className="list-decimal list-inside space-y-2 text-gray-300">
                        <li>
                            <strong>Get API Key:</strong> Sign up at <a href="https://notifiarr.com" target="_blank" rel="noreferrer noopener" className="text-primary hover:underline">notifiarr.com</a> and get your API key.
                        </li>
                        <li>
                            <strong>Environment:</strong> Add <code>NOTIFIARR_API_KEY</code> to your <code>.env</code> file and restart the container.
                        </li>
                        <li>
                            <strong>Connect Apps:</strong>
                            In Sonarr/Radarr/Prowlarr, go to <strong>Settings → Connect → + → Notifiarr</strong>.
                            Enter your API key.
                        </li>
                        <li>
                            <strong>Discord Triggers:</strong> In the Notifiarr website dashboard, configure which events (Grab, Download, Upgrade) send messages to which Discord channels.
                        </li>
                    </ol>
                </div>
            </section>
        </AppGuideLayout>
    )
}
