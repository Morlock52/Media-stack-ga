import { Terminal } from 'lucide-react'
import { AppGuideLayout } from './AppGuideLayout'

export function DozzleGuide() {
    return (
        <AppGuideLayout
            icon={<Terminal className="w-7 h-7 text-emerald-300" />}
            title="Dozzle"
            subtitle="Real-time container logs with zero CLI work"
            category="Monitoring"
            estimatedTime="5 minutes"
        >
            <section className="space-y-6 text-sm text-gray-300">
                <div>
                    <h3 className="text-base font-semibold text-white mb-2">Why use Dozzle?</h3>
                    <p>
                        Dozzle tails every container log (including qBittorrent inside Gluetun) and streams it through a sleek web UI. It is
                        the fastest way to answer “what just happened?” without typing <code>docker compose logs</code> repeatedly or
                        exposing SSH.
                    </p>
                </div>

                <div>
                    <h3 className="text-base font-semibold text-white mb-2">Open the dashboard</h3>
                    <ol className="list-decimal list-inside space-y-2 text-gray-300">
                        <li>
                            Visit <code>https://dozzle.yourdomain.com</code> (or <code>http://localhost:8080</code> if you are on the same
                            machine).
                        </li>
                        <li>
                            Use the sidebar to pick a container. The search field filters instantly—type <code>sonarr</code>,{' '}
                            <code>plex</code>, etc.
                        </li>
                        <li>
                            Toggle <strong>Follow</strong> to keep the log pinned to the latest lines. Use the time-range dropdown to jump
                            back in time if you missed something.
                        </li>
                        <li>
                            Click the <strong>Download</strong> button whenever you need to attach logs to a support ticket or GitHub issue.
                        </li>
                    </ol>
                </div>

                <div>
                    <h3 className="text-base font-semibold text-white mb-2">Troubleshooting tips</h3>
                    <ul className="list-disc list-inside space-y-2 text-gray-300">
                        <li>
                            If Dozzle shows an empty list, make sure the Docker socket is mounted (
                            <code>/var/run/docker.sock</code>) and the container is up: <code>docker compose ps dozzle</code>.
                        </li>
                        <li>
                            Use the filter chips (Errors / Warnings) to zero in on stack traces after a failed download or transcoding job.
                        </li>
                        <li>
                            Bookmark the Dozzle hostname inside Homepage so the entire team sees the same log URL.
                        </li>
                    </ul>
                </div>
            </section>
        </AppGuideLayout>
    )
}
