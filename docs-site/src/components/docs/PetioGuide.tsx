import { Search } from 'lucide-react'
import { AppGuideLayout } from './AppGuideLayout'

export function PetioGuide() {
    return (
        <AppGuideLayout
            icon={<Search className="w-7 h-7 text-emerald-300" />}
            title="Petio"
            subtitle="Request portal with personalized recommendations"
            category="Requests"
            estimatedTime="20-30 minutes"
        >
            <section className="space-y-6 text-sm text-gray-300">
                <div>
                    <h3 className="text-base font-semibold text-white mb-2">What is Petio?</h3>
                    <p>
                        Petio is a third-party companion app for Plex that provides a feature-rich request system
                        with personalized recommendations, user profiles, and a modern interface. It integrates
                        seamlessly with Sonarr and Radarr for automated downloads.
                    </p>
                </div>

                <div>
                    <h3 className="text-base font-semibold text-white mb-2">Initial setup</h3>
                    <ol className="list-decimal list-inside space-y-2 text-gray-300">
                        <li>
                            Open <code>https://petio.yourdomain.com</code> or <code>http://localhost:7777</code>.
                        </li>
                        <li>
                            Connect your Plex account using OAuth sign-in.
                        </li>
                        <li>
                            Select your Plex server and enable user import.
                        </li>
                        <li>
                            Set up Sonarr and Radarr connections in Settings.
                        </li>
                    </ol>
                </div>

                <div>
                    <h3 className="text-base font-semibold text-white mb-2">Key features</h3>
                    <ul className="list-disc list-inside space-y-2 text-gray-300">
                        <li>
                            <strong>Recommendations</strong> - AI-powered suggestions based on watch history
                        </li>
                        <li>
                            <strong>User reviews</strong> - Let users rate and review content
                        </li>
                        <li>
                            <strong>Discovery</strong> - Browse trending and popular content
                        </li>
                        <li>
                            <strong>Collections</strong> - Create and share curated lists
                        </li>
                    </ul>
                </div>

                <div>
                    <h3 className="text-base font-semibold text-white mb-2">User management</h3>
                    <ol className="list-decimal list-inside space-y-2 text-gray-300">
                        <li>
                            Users authenticate via Plex account.
                        </li>
                        <li>
                            Set request limits and approval requirements per user.
                        </li>
                        <li>
                            Configure auto-approve for trusted users.
                        </li>
                    </ol>
                </div>

                <div>
                    <h3 className="text-base font-semibold text-white mb-2">Petio vs Overseerr</h3>
                    <p>
                        Both are excellent request apps. Petio focuses on personalization and discovery,
                        while Overseerr has a more streamlined request-focused interface. Try both
                        and see which fits your users better.
                    </p>
                </div>
            </section>
        </AppGuideLayout>
    )
}
