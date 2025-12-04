import { FileVideo } from 'lucide-react'
import { AppGuideLayout } from './AppGuideLayout'

export function TdarrGuide() {
    return (
        <AppGuideLayout
            icon={<FileVideo className="w-7 h-7 text-blue-500" />}
            title="Tdarr"
            subtitle="Distributed Transcoding System"
            category="Optimization"
            estimatedTime="15–30 minutes"
        >
            <section className="space-y-6 text-sm text-gray-300">
                <div>
                    <h3 className="text-base font-semibold text-white mb-2">What is Tdarr?</h3>
                    <p>
                        Tdarr scans your media library and automatically converts files to a more efficient format (like H.265/HEVC) to save space.
                        It can also remove unwanted audio tracks or subtitles.
                    </p>
                </div>

                <div>
                    <h3 className="text-base font-semibold text-white mb-2">Setup</h3>
                    <ol className="list-decimal list-inside space-y-2 text-gray-300">
                        <li>
                            Open Tdarr at <a href="http://localhost:8265" target="_blank" rel="noreferrer noopener" className="text-purple-400 hover:underline">http://localhost:8265</a>
                        </li>
                        <li>
                            <strong>Nodes:</strong> You should see your "InternalNode" online. This is the worker that does the actual conversion.
                        </li>
                        <li>
                            <strong>Libraries:</strong> Go to the "Libraries" tab.
                            <ul className="list-disc list-inside ml-5 mt-1 text-xs text-gray-400">
                                <li>Add a library for Movies (<code>/media/movies</code>) and TV (<code>/media/tv</code>).</li>
                                <li>Choose a plugin stack (e.g., "Tdarr_Plugin_MC93_Migz1Remux" is a popular all-in-one).</li>
                            </ul>
                        </li>
                        <li>
                            <strong>Transcode Options:</strong> Set your output container (usually MKV or MP4) and GPU capabilities.
                        </li>
                    </ol>
                </div>
            </section>
        </AppGuideLayout>
    )
}
