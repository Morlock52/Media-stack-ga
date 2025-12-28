import { FileText } from 'lucide-react'
import { AppGuideLayout } from './AppGuideLayout'

export function PromtailGuide() {
    return (
        <AppGuideLayout
            icon={<FileText className="w-7 h-7 text-emerald-300" />}
            title="Promtail"
            subtitle="Log collector that ships to Loki"
            category="Monitoring"
            estimatedTime="5 minutes"
        >
            <section className="space-y-6 text-sm text-gray-300">
                <div>
                    <h3 className="text-base font-semibold text-white mb-2">What is Promtail?</h3>
                    <p>
                        Promtail is an agent that ships the contents of local logs to a Loki instance. It is usually
                        deployed to every machine that has applications needed to be monitored. In Media Stack, it
                        automatically discovers and collects logs from all Docker containers.
                    </p>
                </div>

                <div>
                    <h3 className="text-base font-semibold text-white mb-2">Automatic container discovery</h3>
                    <p>
                        Promtail mounts the Docker socket and automatically discovers all running containers.
                        It adds labels for:
                    </p>
                    <ul className="list-disc list-inside space-y-2 text-gray-300 mt-2">
                        <li><code>container</code> - The container name (e.g., sonarr, plex)</li>
                        <li><code>container_id</code> - The Docker container ID</li>
                        <li><code>service_name</code> - The compose service name</li>
                        <li><code>project</code> - The Docker Compose project name</li>
                    </ul>
                </div>

                <div>
                    <h3 className="text-base font-semibold text-white mb-2">Configuration</h3>
                    <p>
                        Promtail's configuration is at <code>config/promtail/promtail-config.yaml</code>.
                        The default setup:
                    </p>
                    <ul className="list-disc list-inside space-y-2 text-gray-300 mt-2">
                        <li>Scrapes all Docker container logs</li>
                        <li>Adds container labels automatically</li>
                        <li>Ships logs to Loki at <code>http://loki:3100</code></li>
                    </ul>
                </div>

                <div>
                    <h3 className="text-base font-semibold text-white mb-2">Verify it's working</h3>
                    <ol className="list-decimal list-inside space-y-2 text-gray-300">
                        <li>
                            Check container status: <code>docker ps | grep promtail</code>
                        </li>
                        <li>
                            View Promtail logs: <code>docker logs promtail</code>
                        </li>
                        <li>
                            Look for "Syncing stream" messages indicating active log shipping.
                        </li>
                    </ol>
                </div>

                <div>
                    <h3 className="text-base font-semibold text-white mb-2">Troubleshooting</h3>
                    <ul className="list-disc list-inside space-y-2 text-gray-300">
                        <li>
                            If no logs appear in Grafana, ensure Promtail can reach Loki.
                        </li>
                        <li>
                            Verify the Docker socket is mounted: <code>/var/run/docker.sock</code>
                        </li>
                        <li>
                            Check for permission errors in Promtail's logs.
                        </li>
                    </ul>
                </div>
            </section>
        </AppGuideLayout>
    )
}
