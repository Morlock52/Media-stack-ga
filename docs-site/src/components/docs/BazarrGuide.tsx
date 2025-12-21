import { Languages } from 'lucide-react'
import { AppGuideLayout } from './AppGuideLayout'

export function BazarrGuide() {
    return (
        <AppGuideLayout
            icon={<Languages className="w-7 h-7 text-orange-400" />}
            title="Bazarr"
            subtitle="Subtitle downloader and manager"
            category="Automation"
            estimatedTime="10–15 minutes"
        >
            <section className="space-y-6 text-sm text-gray-300">
                <div>
                    <h3 className="text-base font-semibold text-white mb-2">What is Bazarr?</h3>
                    <p>
                        Bazarr manages and downloads subtitles for your TV shows and movies. It syncs with Sonarr and Radarr to know what media you have.
                    </p>
                </div>

                <div>
                    <h3 className="text-base font-semibold text-white mb-2">Setup Steps</h3>
                    <ol className="list-decimal list-inside space-y-2 text-gray-300">
                        <li>
                            Open Bazarr at <a href="http://localhost:6767" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">http://localhost:6767</a>
                        </li>
                        <li>
                            <strong>Settings → General:</strong> 
                            Connect to Sonarr (<code>http://sonarr:8989</code>) and Radarr (<code>http://radarr:7878</code>) using their API keys.
                        </li>
                        <li>
                            <strong>Settings → Providers:</strong>
                            Add your preferred subtitle providers (e.g., OpenSubtitles.com).
                        </li>
                        <li>
                            <strong>Settings → Languages:</strong>
                            Select your desired subtitle languages and the default profile (e.g., "English").
                        </li>
                    </ol>
                </div>
            </section>
        </AppGuideLayout>
    )
}
