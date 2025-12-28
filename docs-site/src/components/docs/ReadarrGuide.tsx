import { Book } from 'lucide-react'
import { AppGuideLayout } from './AppGuideLayout'

export function ReadarrGuide() {
    return (
        <AppGuideLayout
            icon={<Book className="w-7 h-7 text-emerald-300" />}
            title="Readarr"
            subtitle="Book and audiobook manager in the *Arr family"
            category="Automation"
            estimatedTime="20-30 minutes"
        >
            <section className="space-y-6 text-sm text-gray-300">
                <div>
                    <h3 className="text-base font-semibold text-white mb-2">What is Readarr?</h3>
                    <p>
                        Readarr is an ebook and audiobook collection manager for Usenet and BitTorrent users.
                        It monitors for new books from your favorite authors and grabs, sorts, and renames them
                        to your library structure.
                    </p>
                </div>

                <div>
                    <h3 className="text-base font-semibold text-white mb-2">Initial setup</h3>
                    <ol className="list-decimal list-inside space-y-2 text-gray-300">
                        <li>
                            Open <code>https://readarr.yourdomain.com</code> or <code>http://localhost:8787</code>.
                        </li>
                        <li>
                            Go to <strong>Settings → Media Management</strong> and add your root folder (e.g., <code>/books</code>).
                        </li>
                        <li>
                            Configure <strong>Download Clients</strong> (qBittorrent or SABnzbd).
                        </li>
                        <li>
                            Add <strong>Indexers</strong> via Prowlarr or manually.
                        </li>
                    </ol>
                </div>

                <div>
                    <h3 className="text-base font-semibold text-white mb-2">Adding authors</h3>
                    <ol className="list-decimal list-inside space-y-2 text-gray-300">
                        <li>
                            Click <strong>Add New</strong> and search for an author.
                        </li>
                        <li>
                            Choose whether to monitor all books or specific ones.
                        </li>
                        <li>
                            Select a quality profile (EPUB, MOBI, Audiobook, etc.).
                        </li>
                        <li>
                            Click <strong>Add</strong> to start monitoring.
                        </li>
                    </ol>
                </div>

                <div>
                    <h3 className="text-base font-semibold text-white mb-2">Connect to readers</h3>
                    <p className="mb-2">
                        Readarr works great with:
                    </p>
                    <ul className="list-disc list-inside space-y-2 text-gray-300">
                        <li>
                            <strong>Kavita</strong> - Comics, manga, and ebook reader
                        </li>
                        <li>
                            <strong>Audiobookshelf</strong> - Audiobook and podcast server
                        </li>
                        <li>
                            <strong>Calibre</strong> - Ebook management (via Calibre-Web)
                        </li>
                    </ul>
                </div>

                <div>
                    <h3 className="text-base font-semibold text-white mb-2">Tips</h3>
                    <ul className="list-disc list-inside space-y-2 text-gray-300">
                        <li>
                            Separate audiobooks and ebooks into different root folders.
                        </li>
                        <li>
                            Use the <strong>Cutoff Unmet</strong> filter to find books needing upgrades.
                        </li>
                        <li>
                            Enable <strong>Notifications</strong> to know when new books arrive.
                        </li>
                    </ul>
                </div>
            </section>
        </AppGuideLayout>
    )
}
