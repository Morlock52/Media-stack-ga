import { FolderOpen } from 'lucide-react'
import { AppGuideLayout } from './AppGuideLayout'

export function FileBrowserGuide() {
    return (
        <AppGuideLayout
            icon={<FolderOpen className="w-7 h-7 text-emerald-300" />}
            title="File Browser"
            subtitle="Web-based file manager for your media folders"
            category="Utility"
            estimatedTime="5-10 minutes"
        >
            <section className="space-y-6 text-sm text-gray-300">
                <div>
                    <h3 className="text-base font-semibold text-white mb-2">What is File Browser?</h3>
                    <p>
                        File Browser provides a file management interface within a specified directory. It can
                        upload, delete, preview, rename, and edit files. It also allows sharing files with other
                        users and creating multiple user accounts with different permissions.
                    </p>
                </div>

                <div>
                    <h3 className="text-base font-semibold text-white mb-2">Initial setup</h3>
                    <ol className="list-decimal list-inside space-y-2 text-gray-300">
                        <li>
                            Open <code>https://files.yourdomain.com</code> or <code>http://localhost:8082</code>.
                        </li>
                        <li>
                            Log in with default credentials: <code>admin</code> / <code>admin</code>.
                        </li>
                        <li>
                            <strong>Change the password immediately</strong> in Settings → Profile.
                        </li>
                    </ol>
                </div>

                <div>
                    <h3 className="text-base font-semibold text-white mb-2">Key features</h3>
                    <ul className="list-disc list-inside space-y-2 text-gray-300">
                        <li>
                            <strong>Upload files</strong> - Drag and drop or use the upload button
                        </li>
                        <li>
                            <strong>Preview media</strong> - View images, videos, and documents in-browser
                        </li>
                        <li>
                            <strong>Edit text files</strong> - Built-in editor with syntax highlighting
                        </li>
                        <li>
                            <strong>Share links</strong> - Create temporary or permanent share links
                        </li>
                    </ul>
                </div>

                <div>
                    <h3 className="text-base font-semibold text-white mb-2">User management</h3>
                    <ol className="list-decimal list-inside space-y-2 text-gray-300">
                        <li>
                            Go to <strong>Settings → User Management</strong>.
                        </li>
                        <li>
                            Create users with specific root directories (scope).
                        </li>
                        <li>
                            Set permissions: read, write, create, delete, share.
                        </li>
                    </ol>
                </div>

                <div>
                    <h3 className="text-base font-semibold text-white mb-2">Use cases in Media Stack</h3>
                    <ul className="list-disc list-inside space-y-2 text-gray-300">
                        <li>
                            Manually upload media files without SSH access.
                        </li>
                        <li>
                            Check download folder contents while away.
                        </li>
                        <li>
                            Clean up failed or incomplete downloads.
                        </li>
                        <li>
                            Share media files with friends before they're added to Plex.
                        </li>
                    </ul>
                </div>
            </section>
        </AppGuideLayout>
    )
}
