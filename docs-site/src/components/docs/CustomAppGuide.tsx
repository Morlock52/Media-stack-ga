import { MarkdownViewer } from '../ui/MarkdownViewer'
import { Box, Trash2 } from 'lucide-react'

interface CustomAppGuideProps {
    app: any;
    onDelete?: (id: string) => void;
}

export function CustomAppGuide({ app, onDelete }: CustomAppGuideProps) {
    if (!app) return null;

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between mb-6 pb-6 border-b border-white/10">
                <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500/20 to-cyan-500/20 border border-blue-500/30 flex items-center justify-center">
                        <Box className="w-8 h-8 text-blue-400" />
                    </div>
                    <div>
                        <h2 className="text-3xl font-bold text-white">{app.name} Guide</h2>
                        <p className="text-gray-400 font-mono text-sm mt-1">{app.repo}</p>
                    </div>
                </div>

                {onDelete && (
                    <button
                        onClick={() => onDelete(app.id)}
                        className="flex items-center gap-2 px-4 py-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 rounded-lg text-red-300 hover:text-white transition-all text-sm group"
                        title="Delete this app and documentation"
                    >
                        <Trash2 className="w-4 h-4 group-hover:scale-110 transition-transform" />
                        Remove
                    </button>
                )}
            </div>

            <div className="p-4 bg-purple-500/10 border border-purple-500/20 rounded-xl mb-6 flex items-start gap-3">
                <div className="mt-1">✨</div>
                <div>
                    <h4 className="font-semibold text-purple-200 text-sm">AI-Generated Integration</h4>
                    <p className="text-sm text-purple-300/80">
                        This guide was automatically generated from the repository's README.
                        It includes a standard configuration for your stack.
                    </p>
                </div>
            </div>

            <MarkdownViewer content={app.docs || 'No documentation available.'} />
        </div>
    )
}
