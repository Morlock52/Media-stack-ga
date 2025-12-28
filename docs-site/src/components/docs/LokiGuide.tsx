import { FileText } from 'lucide-react'
import { AppGuideLayout } from './AppGuideLayout'

export function LokiGuide() {
    return (
        <AppGuideLayout
            icon={<FileText className="w-7 h-7 text-emerald-300" />}
            title="Loki"
            subtitle="Log aggregation designed for Grafana"
            category="Monitoring"
            estimatedTime="10 minutes"
        >
            <section className="space-y-6 text-sm text-gray-300">
                <div>
                    <h3 className="text-base font-semibold text-white mb-2">What is Loki?</h3>
                    <p>
                        Loki is a horizontally-scalable, highly-available log aggregation system inspired by Prometheus.
                        It is designed to be cost-effective and easy to operate. Unlike other logging systems, Loki indexes
                        only metadata (labels) about your logs, making it very efficient.
                    </p>
                </div>

                <div>
                    <h3 className="text-base font-semibold text-white mb-2">How it works in Media Stack</h3>
                    <ol className="list-decimal list-inside space-y-2 text-gray-300">
                        <li>
                            <strong>Promtail</strong> collects logs from all Docker containers.
                        </li>
                        <li>
                            Logs are shipped to <strong>Loki</strong> with labels like container name and service.
                        </li>
                        <li>
                            <strong>Grafana</strong> queries Loki to display logs in dashboards.
                        </li>
                    </ol>
                </div>

                <div>
                    <h3 className="text-base font-semibold text-white mb-2">Verify Loki is running</h3>
                    <ol className="list-decimal list-inside space-y-2 text-gray-300">
                        <li>
                            Check the ready endpoint: <code>curl http://localhost:3100/ready</code>
                        </li>
                        <li>
                            It should return <code>ready</code> when Loki is healthy.
                        </li>
                        <li>
                            View available labels: <code>curl http://localhost:3100/loki/api/v1/labels</code>
                        </li>
                    </ol>
                </div>

                <div>
                    <h3 className="text-base font-semibold text-white mb-2">Configuration</h3>
                    <p>
                        Loki's configuration is stored at <code>config/loki/loki-config.yaml</code>.
                        The default setup is optimized for single-node deployments and retains logs for 14 days.
                    </p>
                </div>

                <div>
                    <h3 className="text-base font-semibold text-white mb-2">Troubleshooting</h3>
                    <ul className="list-disc list-inside space-y-2 text-gray-300">
                        <li>
                            If logs aren't appearing, check that Promtail is running and can reach Loki.
                        </li>
                        <li>
                            View Loki's own logs: <code>docker logs loki</code>
                        </li>
                        <li>
                            Ensure the data directory has proper permissions for persistence.
                        </li>
                    </ul>
                </div>
            </section>
        </AppGuideLayout>
    )
}
