import { Film } from 'lucide-react'
import { AppGuideLayout } from './AppGuideLayout'

export function RadarrGuide() {
    return (
        <AppGuideLayout
            icon={<Film className="w-7 h-7 text-yellow-400" />}
            title="Radarr"
            subtitle="Movie collection manager and automation"
            category="Automation"
            estimatedTime="15–30 minutes"
        >
            <section className="space-y-6 text-sm text-muted-foreground">
                <div>
                    <h3 className="text-base font-semibold text-foreground mb-2">What is Radarr?</h3>
                    <p>
                        Radarr works just like Sonarr but for movies. It monitors your favorite journals/feeds and automatically downloads movies as soon as they are available.
                    </p>
                </div>

                <div>
                    <h3 className="text-base font-semibold text-foreground mb-2">Initial Setup</h3>
                    <ol className="list-decimal list-inside space-y-2 text-muted-foreground">
                        <li>
                            Open Radarr at <a href="http://localhost:7878" target="_blank" rel="noopener noreferrer" className="text-purple-400 hover:underline">http://localhost:7878</a>
                        </li>
                        <li>
                            <strong>Media Management:</strong> Go to Settings → Media Management. Enable "Rename Movies".
                        </li>
                        <li>
                            <strong>Root Folders:</strong> Go to Settings → Media Management → Root Folders.
                            Add <code>/movies</code>.
                        </li>
                        <li>
                            <strong>Indexers:</strong> Use Prowlarr to sync indexers to Radarr automatically.
                        </li>
                        <li>
                            <strong>Download Client:</strong> Go to Settings → Download Clients.
                            <ul className="list-disc list-inside ml-5 mt-1 text-xs text-muted-foreground/80">
                                <li>Click <strong>+</strong> and select <strong>qBittorrent</strong>.</li>
                                <li>Host: <code>qbittorrent</code></li>
                                <li>Port: <code>8080</code></li>
                                <li>Username/Password: the qBittorrent credentials you set (default user is <code>admin</code>; first-run password is shown in qBittorrent logs).</li>
                                <li>Category: <code>radarr</code></li>
                            </ul>
                        </li>
                    </ol>
                </div>

                <div>
                    <h3 className="text-base font-semibold text-foreground mb-2">Adding a Movie</h3>
                    <ol className="list-decimal list-inside space-y-2 text-muted-foreground">
                        <li>Click <strong>Movies</strong> in the sidebar, then <strong>Add New</strong>.</li>
                        <li>Search for a movie (e.g., "The Matrix").</li>
                        <li>Select your <strong>Root Folder</strong> and <strong>Quality Profile</strong>.</li>
                        <li>Click <strong>Add Movie</strong>.</li>
                    </ol>
                </div>
            </section>
        </AppGuideLayout>
    )
}
