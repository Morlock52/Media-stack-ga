import { Home } from 'lucide-react'
import { AppGuideLayout } from './AppGuideLayout'

export function HomepageGuide() {
    return (
        <AppGuideLayout
            icon={<Home className="w-7 h-7 text-blue-500" />}
            title="Homepage"
            subtitle="Your central dashboard"
            category="Dashboard"
            estimatedTime="10–20 minutes"
        >
            <section className="space-y-6 text-sm text-gray-300">
                <div>
                    <h3 className="text-base font-semibold text-white mb-2">About Homepage</h3>
                    <p>
                        Homepage is a modern, fully static, fast, and secure dashboard. All your services are automatically discovered via Docker labels (or configured in YAML).
                    </p>
                </div>

                <div>
                    <h3 className="text-base font-semibold text-white mb-2">Customization</h3>
                    <p className="mb-2">
                        Configuration lives in <code>config/homepage/</code>. You can edit these YAML files to change the layout.
                    </p>
                    <ul className="list-disc list-inside space-y-2 text-gray-300">
                        <li><code>services.yaml</code>: Define your apps and groups.</li>
                        <li><code>widgets.yaml</code>: Add information widgets (weather, system stats).</li>
                        <li><code>settings.yaml</code>: Change the title, background image, and colors.</li>
                    </ul>
                </div>

                <div>
                    <h3 className="text-base font-semibold text-white mb-2">Access</h3>
                    <p>
                        Local: <a href="http://localhost:3000" target="_blank" rel="noreferrer noopener" className="text-purple-400 hover:underline">http://localhost:3000</a>
                        <br />
                        Remote: <code>https://hub.yourdomain.com</code> (if Cloudflare Tunnel is set up).
                    </p>
                </div>
            </section>
        </AppGuideLayout>
    )
}
