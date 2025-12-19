import { HelpCircle, Link as LinkIcon, CheckCircle2 } from 'lucide-react'
import { AppGuideLayout } from './AppGuideLayout'

export function AppGuide() {
    return (
        <AppGuideLayout
            icon={<HelpCircle className="w-7 h-7 text-blue-100" />}
            title="App Name"
            subtitle="Short description of the setup goals"
            category="Category Name"
            estimatedTime="10–20 minutes"
        >
            <section className="space-y-4 text-sm text-gray-300">
                <div>
                    <h3 className="text-base font-semibold text-white mb-2">What [App Name] does</h3>
                    <p>
                        Briefly explain the purpose of this application and how it benefits the user's media stack.
                    </p>
                </div>

                <div>
                    <h3 className="text-base font-semibold text-white mb-2">Before you start</h3>
                    <ul className="list-disc list-inside space-y-1 text-gray-300">
                        <li>The [App ID] container is running in your stack.</li>
                        <li>Any related services (e.g., Download Client, Indexers) are configured.</li>
                        <li>You have access to the web UI at the expected URL.</li>
                    </ul>
                </div>

                <div>
                    <h3 className="text-base font-semibold text-white mb-2">1. Initial Configuration</h3>
                    <ol className="list-decimal list-inside space-y-1 text-gray-300">
                        <li>Open the web interface.</li>
                        <li>Follow the initial setup wizard if available.</li>
                        <li>Set your preferred language and basic settings.</li>
                    </ol>
                </div>

                <div>
                    <h3 className="text-base font-semibold text-white mb-2">2. Connecting to the Stack</h3>
                    <p>
                        Explain how to link this app with other services (e.g., connecting a downloader to Sonarr).
                    </p>
                    <ol className="list-decimal list-inside space-y-1 text-gray-300">
                        <li>Go to Settings -{">"} Integration.</li>
                        <li>Enter the internal Docker hostname and port.</li>
                        <li>Test the connection and save.</li>
                    </ol>
                </div>

                <div className="rounded-2xl border border-blue-500/30 bg-blue-500/5 p-4 flex items-start gap-3 text-xs text-blue-100">
                    <CheckCircle2 className="w-4 h-4 mt-0.5" />
                    <div>
                        <p className="font-semibold mb-1">Configuration Tip</p>
                        <p>
                            Always use internal Docker hostnames (e.g., <code>qbittorrent</code> instead of <code>localhost</code>) for better reliability within the network.
                        </p>
                    </div>
                </div>

                <div>
                    <h3 className="text-base font-semibold text-white mb-2">Summary</h3>
                    <ul className="list-disc list-inside space-y-1 text-gray-300">
                        <li>[App Name] is now managing [Responsibility].</li>
                        <li>Check the logs in the "Dozzle" app if you encounter any errors.</li>
                    </ul>
                </div>

                <div className="flex items-center gap-2 pt-2 text-xs text-gray-400">
                    <LinkIcon className="w-4 h-4" />
                    <span>For more details, visit the [App Name] documentation site.</span>
                </div>
            </section>
        </AppGuideLayout>
    )
}
