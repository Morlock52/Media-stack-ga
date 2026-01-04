import { BarChart3 } from 'lucide-react'
import { AppGuideLayout } from './AppGuideLayout'

export function GrafanaGuide() {
    return (
        <AppGuideLayout
            icon={<BarChart3 className="w-7 h-7 text-emerald-300" />}
            title="Grafana"
            subtitle="Dashboards and visualization for your media stack"
            category="Monitoring"
            estimatedTime="15-30 minutes"
        >
            <section className="space-y-6 text-sm text-gray-300">
                <div>
                    <h3 className="text-base font-semibold text-white mb-2">Why use Grafana?</h3>
                    <p>
                        Grafana provides beautiful, interactive dashboards to visualize logs from Loki, metrics from Prometheus,
                        and any other data source you connect. It is the industry standard for observability and gives you
                        instant insight into your stack's health.
                    </p>
                </div>

                <div>
                    <h3 className="text-base font-semibold text-white mb-2">Access Grafana</h3>
                    <ol className="list-decimal list-inside space-y-2 text-gray-300">
                        <li>
                            Navigate to <code>https://grafana.yourdomain.com</code> or <code>http://localhost:3003</code>.
                        </li>
                        <li>
                            Log in with the default credentials: username <code>admin</code>, password <code>mediastack</code>
                            (or whatever you set in <code>.env</code>).
                        </li>
                        <li>
                            <strong>Change the admin password immediately</strong> from the profile menu.
                        </li>
                    </ol>
                </div>

                <div>
                    <h3 className="text-base font-semibold text-white mb-2">Explore logs with Loki</h3>
                    <ol className="list-decimal list-inside space-y-2 text-gray-300">
                        <li>
                            Go to <strong>Explore</strong> in the left sidebar.
                        </li>
                        <li>
                            Select the <strong>Loki</strong> data source from the dropdown.
                        </li>
                        <li>
                            Use the label browser to filter by container: <code>{'{container="sonarr"}'}</code>.
                        </li>
                        <li>
                            Click <strong>Run query</strong> to see logs in real-time.
                        </li>
                    </ol>
                </div>

                <div>
                    <h3 className="text-base font-semibold text-white mb-2">Pre-built dashboards</h3>
                    <p className="mb-2">
                        The Media Stack includes two pre-configured dashboards:
                    </p>
                    <ul className="list-disc list-inside space-y-2 text-gray-300">
                        <li>
                            <strong>Media Stack</strong> - Overview of all container health and status.
                        </li>
                        <li>
                            <strong>Media Stack - Docker Logs</strong> - Aggregated logs from all containers with filtering.
                        </li>
                    </ul>
                </div>

                <div>
                    <h3 className="text-base font-semibold text-white mb-2">Tips</h3>
                    <ul className="list-disc list-inside space-y-2 text-gray-300">
                        <li>
                            Star your favorite dashboards for quick access from the home page.
                        </li>
                        <li>
                            Set up alerts to get notified when containers crash or logs contain errors.
                        </li>
                        <li>
                            Use the time picker in the top right to view historical data.
                        </li>
                    </ul>
                </div>
            </section>
        </AppGuideLayout>
    )
}
