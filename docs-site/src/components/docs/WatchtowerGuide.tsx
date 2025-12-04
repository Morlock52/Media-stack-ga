import { RefreshCw } from 'lucide-react'
import { AppGuideLayout } from './AppGuideLayout'

export function WatchtowerGuide() {
    return (
        <AppGuideLayout
            icon={<RefreshCw className="w-7 h-7 text-sky-300" />}
            title="Watchtower"
            subtitle="Nightly automated Docker updates"
            category="Maintenance"
            estimatedTime="5 minutes"
        >
            <section className="space-y-6 text-sm text-gray-300">
                <div>
                    <h3 className="text-base font-semibold text-white mb-2">What Watchtower handles</h3>
                    <p>
                        Watchtower monitors every container on the Docker host. Once per day (4 AM by default) it checks for new images,
                        pulls them, recreates the container with the same arguments, and cleans up old layers. That keeps Plex, Gluetun,
                        Authelia, and friends patched without babysitting.
                    </p>
                </div>

                <div>
                    <h3 className="text-base font-semibold text-white mb-2">Customize the schedule</h3>
                    <ol className="list-decimal list-inside space-y-2 text-gray-300">
                        <li>
                            Edit <code>WATCHTOWER_SCHEDULE</code> inside <code>.env</code> if you prefer a different cron time. The default{' '}
                            <code>0 0 4 * * *</code> means 04:00 server time daily.
                        </li>
                        <li>
                            Restart the container to apply the change: <code>docker compose up -d watchtower</code>.
                        </li>
                        <li>
                            Check logs for <em>&quot;Scheduled next run&quot;</em> to confirm the cron expression parsed correctly:
                            <code>docker compose logs -f watchtower</code>.
                        </li>
                    </ol>
                </div>

                <div>
                    <h3 className="text-base font-semibold text-white mb-2">Manual fail-safe</h3>
                    <ul className="list-disc list-inside space-y-2 text-gray-300">
                        <li>
                            For critical weekends, temporarily pause Watchtower:
                            <code>docker compose stop watchtower</code>, then start it again afterwards.
                        </li>
                        <li>
                            If an update misbehaves, roll back by running <code>docker compose pull &lt;service&gt;</code> followed by{' '}
                            <code>docker compose up -d &lt;service&gt;</code> with a known-good tag.
                        </li>
                        <li>
                            Pair Watchtower with Portainer notifications or Notifiarr to get pinged when new images land.
                        </li>
                    </ul>
                </div>
            </section>
        </AppGuideLayout>
    )
}
