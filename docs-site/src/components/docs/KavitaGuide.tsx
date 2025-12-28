import { Book } from 'lucide-react'
import { AppGuideLayout } from './AppGuideLayout'

export function KavitaGuide() {
    return (
        <AppGuideLayout
            icon={<Book className="w-7 h-7 text-emerald-300" />}
            title="Kavita"
            subtitle="Comics, manga, and ebook reading server"
            category="Media"
            estimatedTime="15-20 minutes"
        >
            <section className="space-y-6 text-sm text-gray-300">
                <div>
                    <h3 className="text-base font-semibold text-white mb-2">What is Kavita?</h3>
                    <p>
                        Kavita is a fast, feature-rich, cross-platform reading server. It supports comics (CBZ, CBR),
                        manga, ebooks (EPUB, PDF), and raw images. It includes a beautiful reader with full support
                        for various reading directions and formats.
                    </p>
                </div>

                <div>
                    <h3 className="text-base font-semibold text-white mb-2">Initial setup</h3>
                    <ol className="list-decimal list-inside space-y-2 text-gray-300">
                        <li>
                            Open <code>https://kavita.yourdomain.com</code> or <code>http://localhost:5000</code>.
                        </li>
                        <li>
                            Create your admin account on first launch.
                        </li>
                        <li>
                            Add libraries by pointing to your book/comic folders.
                        </li>
                        <li>
                            Wait for the initial scan to complete.
                        </li>
                    </ol>
                </div>

                <div>
                    <h3 className="text-base font-semibold text-white mb-2">Library organization</h3>
                    <p className="mb-2">
                        Kavita supports flexible folder structures. Common setups:
                    </p>
                    <ul className="list-disc list-inside space-y-2 text-gray-300">
                        <li>
                            <code>/books/Manga/Series Name/Volume 01.cbz</code>
                        </li>
                        <li>
                            <code>/books/Comics/Publisher/Series/Issue 001.cbr</code>
                        </li>
                        <li>
                            <code>/books/Ebooks/Author/Book Title.epub</code>
                        </li>
                    </ul>
                </div>

                <div>
                    <h3 className="text-base font-semibold text-white mb-2">Reading experience</h3>
                    <ul className="list-disc list-inside space-y-2 text-gray-300">
                        <li>
                            <strong>Continuous scroll</strong> - Manga-style vertical reading
                        </li>
                        <li>
                            <strong>Page-by-page</strong> - Traditional comic reading
                        </li>
                        <li>
                            <strong>Double-page spread</strong> - For desktop reading
                        </li>
                        <li>
                            <strong>Progress sync</strong> - Resume where you left off on any device
                        </li>
                    </ul>
                </div>

                <div>
                    <h3 className="text-base font-semibold text-white mb-2">Tips</h3>
                    <ul className="list-disc list-inside space-y-2 text-gray-300">
                        <li>
                            Use the metadata editor to fix incorrectly scanned titles.
                        </li>
                        <li>
                            Enable OPDS for Kindle and other e-reader support.
                        </li>
                        <li>
                            Set up Readarr to automatically add new books to Kavita.
                        </li>
                    </ul>
                </div>
            </section>
        </AppGuideLayout>
    )
}
