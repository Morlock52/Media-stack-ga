import { Image, Link as LinkIcon, CheckCircle2 } from 'lucide-react'
import { AppGuideLayout } from './AppGuideLayout'

export function PhotoPrismGuide() {
    return (
        <AppGuideLayout
            icon={<Image className="w-7 h-7 text-primary" />}
            title="PhotoPrism Photo Library"
            subtitle="Private photo library with search and AI-powered tagging"
            category="Photos App Guide"
            estimatedTime="45–90 minutes"
        >
            <section className="space-y-4 text-sm text-gray-300">
                <div>
                    <h3 className="text-base font-semibold text-white mb-2">What PhotoPrism does</h3>
                    <p>
                        PhotoPrism is a self-hosted photo library and gallery. It can index your photos, group them by
                        people and places, and use AI to recognize objects so you can search your collection easily.
                    </p>
                </div>

                <div>
                    <h3 className="text-base font-semibold text-white mb-2">Before you start</h3>
                    <ul className="list-disc list-inside space-y-1 text-gray-300">
                        <li>You have already run <code>docker compose up -d</code> and the PhotoPrism container is running.</li>
                        <li>Your photos live in a folder that is mapped into PhotoPrism (for example <code>/data/photos</code>).</li>
                        <li>You understand that AI indexing may be CPU-intensive, especially on first run.</li>
                    </ul>
                </div>

                <div>
                    <h3 className="text-base font-semibold text-white mb-2">1. Open PhotoPrism</h3>
                    <ol className="list-decimal list-inside space-y-1 text-gray-300">
                        <li>
                            In your browser, go to your PhotoPrism URL. Common examples:
                            <ul className="list-disc list-inside ml-5 text-xs text-gray-400 mt-1">
                                <li><code>http://localhost:2342</code> on a local machine.</li>
                                <li><code>https://photos.your-domain.com</code> if you configured a subdomain.</li>
                            </ul>
                        </li>
                        <li>You should see the login or setup page for PhotoPrism.</li>
                    </ol>
                </div>

                <div>
                    <h3 className="text-base font-semibold text-white mb-2">2. Sign in as admin</h3>
                    <ol className="list-decimal list-inside space-y-1 text-gray-300">
                        <li>Use the default admin credentials from your stack README or environment file, or what you set.</li>
                        <li>Immediately change the default password in <strong>Settings → Account</strong>.</li>
                    </ol>
                </div>

                <div>
                    <h3 className="text-base font-semibold text-white mb-2">3. Point PhotoPrism at your photos</h3>
                    <ol className="list-decimal list-inside space-y-1 text-gray-300">
                        <li>In <strong>Settings → Library</strong>, confirm the originals path matches your Docker volume mapping (e.g., <code>/data/photos</code>).</li>
                        <li>Optionally choose a separate folder for imports if you plan to copy photos into the library.</li>
                        <li>Save any changes.</li>
                    </ol>
                </div>

                <div>
                    <h3 className="text-base font-semibold text-white mb-2">4. Start the first index</h3>
                    <ol className="list-decimal list-inside space-y-1 text-gray-300">
                        <li>Go to <strong>Library</strong> / <strong>Index</strong> page.</li>
                        <li>Start a full index / scan of your library.</li>
                        <li>Depending on your collection size and server hardware, this may take a long time.</li>
                        <li>You can leave PhotoPrism running in the background while it processes.</li>
                    </ol>
                </div>

                <div>
                    <h3 className="text-base font-semibold text-white mb-2">5. Explore your library</h3>
                    <ol className="list-decimal list-inside space-y-1 text-gray-300">
                        <li>Once indexing has started, open the <strong>Browse</strong> / <strong>Photos</strong> section.</li>
                        <li>Try searching for a date, location, or simple term once AI tagging is partially done.</li>
                        <li>Use albums or labels to group important sets of photos.</li>
                    </ol>
                </div>

                <div className="rounded-2xl border border-primary/30 bg-primary/10 p-4 flex items-start gap-3 text-xs text-primary">
                    <CheckCircle2 className="w-4 h-4 mt-0.5" />
                    <div>
                        <p className="font-semibold mb-1">Your photo library is live</p>
                        <p>
                            After the first index, PhotoPrism becomes a powerful way to explore your photo history, with
                            search filters that beat just browsing folders on disk.
                        </p>
                    </div>
                </div>

                <div>
                    <h3 className="text-base font-semibold text-white mb-2">Where PhotoPrism fits in your stack</h3>
                    <ul className="list-disc list-inside space-y-1 text-gray-300">
                        <li>It is dedicated to photos and does not affect your media server for movies/TV.</li>
                        <li>You can expose it with the same reverse proxy and domain style as the rest of your apps.</li>
                        <li>Backups are important: make sure the originals folder and database are part of your backup plan.</li>
                    </ul>
                </div>

                <div>
                    <h3 className="text-base font-semibold text-white mb-2">Common issues</h3>
                    <ul className="list-disc list-inside space-y-1 text-gray-300 text-xs">
                        <li>
                            <strong>High CPU usage:</strong> This is normal during indexing and AI tagging. Let it run when
                            you don&apos;t need the server for heavy tasks.
                        </li>
                        <li>
                            <strong>Missing or duplicate photos:</strong> Check that only the correct folders are mounted and
                            indexed; avoid symlink loops or duplicate paths.
                        </li>
                        <li>
                            <strong>Can&apos;t log in:</strong> Verify the admin password and consult the container logs if you
                            need to reset credentials.
                        </li>
                    </ul>
                </div>

                <div className="flex items-center gap-2 pt-2 text-xs text-gray-400">
                    <LinkIcon className="w-4 h-4" />
                    <span>For GPU acceleration, external storage, and advanced tuning, see the PhotoPrism documentation.</span>
                </div>
            </section>
        </AppGuideLayout>
    )
}
