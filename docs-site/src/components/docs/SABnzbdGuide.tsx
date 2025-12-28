import { Inbox } from 'lucide-react'
import { AppGuideLayout } from './AppGuideLayout'

export function SABnzbdGuide() {
    return (
        <AppGuideLayout
            icon={<Inbox className="w-7 h-7 text-emerald-300" />}
            title="SABnzbd"
            subtitle="Usenet downloader for NZB files"
            category="Download"
            estimatedTime="15-20 minutes"
        >
            <section className="space-y-6 text-sm text-gray-300">
                <div>
                    <h3 className="text-base font-semibold text-white mb-2">What is SABnzbd?</h3>
                    <p>
                        SABnzbd is a free and open-source binary newsreader for Usenet. It simplifies downloading
                        from Usenet by automating the entire process: downloading, verification, repair, extraction,
                        and organization.
                    </p>
                </div>

                <div>
                    <h3 className="text-base font-semibold text-white mb-2">Prerequisites</h3>
                    <ul className="list-disc list-inside space-y-2 text-gray-300">
                        <li>
                            A Usenet provider account (e.g., Newshosting, Eweka, Frugal Usenet)
                        </li>
                        <li>
                            Usenet indexer access (e.g., NZBgeek, DrunkenSlug)
                        </li>
                    </ul>
                </div>

                <div>
                    <h3 className="text-base font-semibold text-white mb-2">Initial setup</h3>
                    <ol className="list-decimal list-inside space-y-2 text-gray-300">
                        <li>
                            Open <code>https://sabnzbd.yourdomain.com</code> or <code>http://localhost:8080</code>.
                        </li>
                        <li>
                            The setup wizard will guide you through the initial configuration.
                        </li>
                        <li>
                            Enter your Usenet server details (host, port, username, password, SSL).
                        </li>
                        <li>
                            Set your download folder to <code>/downloads/usenet</code>.
                        </li>
                    </ol>
                </div>

                <div>
                    <h3 className="text-base font-semibold text-white mb-2">Connect to *Arr apps</h3>
                    <ol className="list-decimal list-inside space-y-2 text-gray-300">
                        <li>
                            Go to <strong>Config → General</strong> and copy your API key.
                        </li>
                        <li>
                            In Sonarr/Radarr, go to <strong>Settings → Download Clients</strong>.
                        </li>
                        <li>
                            Add SABnzbd with host <code>sabnzbd</code>, port <code>8080</code>.
                        </li>
                        <li>
                            Paste your API key and set the category to <code>tv</code> or <code>movies</code>.
                        </li>
                    </ol>
                </div>

                <div>
                    <h3 className="text-base font-semibold text-white mb-2">Categories</h3>
                    <p>
                        Set up categories in SABnzbd's Config → Categories to organize downloads:
                    </p>
                    <ul className="list-disc list-inside space-y-2 text-gray-300 mt-2">
                        <li><code>tv</code> - For Sonarr TV downloads</li>
                        <li><code>movies</code> - For Radarr movie downloads</li>
                        <li><code>music</code> - For Lidarr music downloads</li>
                    </ul>
                </div>

                <div>
                    <h3 className="text-base font-semibold text-white mb-2">Tips</h3>
                    <ul className="list-disc list-inside space-y-2 text-gray-300">
                        <li>
                            Enable SSL for your Usenet connections for better security.
                        </li>
                        <li>
                            Add a backup server from a different provider for more complete downloads.
                        </li>
                        <li>
                            Set up notifications to get alerts when downloads complete.
                        </li>
                    </ul>
                </div>
            </section>
        </AppGuideLayout>
    )
}
