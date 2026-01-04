import { useEffect, useMemo, useState } from 'react'
import { Loader2, AlertTriangle, BookOpen, Link as LinkIcon } from 'lucide-react'

type DocSource = {
    id: string
    label: string
    url: string
    description?: string
}

const DOC_SOURCES: DocSource[] = [
    {
        id: 'start-here',
        label: 'Start Here (Getting Started)',
        url: 'https://raw.githubusercontent.com/Morlock52/Media-stack-ga/main/docs/getting-started/START_HERE.md',
        description: 'Pick your install path (wizard, shell, manual).',
    },
    {
        id: 'quick-reference',
        label: 'Quick Reference',
        url: 'https://raw.githubusercontent.com/Morlock52/Media-stack-ga/main/docs/getting-started/QUICK_REFERENCE.md',
        description: 'Ports, URLs, commands, defaults at a glance.',
    },
    {
        id: 'plan',
        label: 'Project Plan (Pro)',
        url: 'https://raw.githubusercontent.com/Morlock52/Media-stack-ga/main/docs/pro/PROJECT_PLAN.md',
        description: 'Milestones, acceptance criteria, Mermaid diagrams.',
    },
    {
        id: 'training',
        label: 'Training Guide (Pro)',
        url: 'https://raw.githubusercontent.com/Morlock52/Media-stack-ga/main/docs/pro/TRAINING_GUIDE.md',
        description: 'Newbie, expert, and management playbooks.',
    },
    {
        id: 'operations',
        label: 'Post-Deploy Checks',
        url: 'https://raw.githubusercontent.com/Morlock52/Media-stack-ga/main/docs/operations/POST_DEPLOY_CHECKS.md',
        description: 'VPN/auth/tunnel verification after updates.',
    },
]

export function DocsReader() {
    const [selectedId, setSelectedId] = useState<string>(DOC_SOURCES[0].id)
    const [html, setHtml] = useState<string>('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const selected = useMemo(
        () => DOC_SOURCES.find((d) => d.id === selectedId) || DOC_SOURCES[0],
        [selectedId],
    )

    useEffect(() => {
        let cancelled = false
        const load = async () => {
            setLoading(true)
            setError(null)
            try {
                const res = await fetch(selected.url)
                if (!res.ok) throw new Error(`HTTP ${res.status}`)
                const markdown = await res.text()
                // Load a markdown parser at runtime (keeps bundle lean).
                const { marked } = await import('https://cdn.jsdelivr.net/npm/marked/lib/marked.esm.js')
                marked.setOptions({ mangle: false, headerIds: false })
                const rendered = marked.parse(markdown)
                if (!cancelled) setHtml(rendered)
            } catch (err: unknown) {
                if (!cancelled)
                    setError(
                        err instanceof Error ? err.message : 'Unable to load document. Please try again.',
                    )
            } finally {
                if (!cancelled) setLoading(false)
            }
        }
        void load()
        return () => {
            cancelled = true
        }
    }, [selected])

    return (
        <section className="container mx-auto px-4 pb-12">
            <div className="rounded-3xl border border-border/60 bg-card/60 backdrop-blur-xl shadow-2xl overflow-hidden">
                <div className="p-6 md:p-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between border-b border-border/60 bg-gradient-to-r from-primary/10 via-cyan-500/5 to-emerald-500/10">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-primary/15 border border-primary/40 flex items-center justify-center">
                            <BookOpen className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                            <h2 className="text-xl font-semibold text-foreground">Docs Reader</h2>
                            <p className="text-sm text-muted-foreground">
                                Beautiful, in-app reading of your Markdown docs.
                            </p>
                        </div>
                    </div>
                    <div className="flex flex-wrap gap-3">
                        <select
                            value={selectedId}
                            onChange={(e) => setSelectedId(e.target.value)}
                            className="bg-background/70 border border-border rounded-xl px-4 py-2 text-sm text-foreground shadow-inner"
                        >
                            {DOC_SOURCES.map((doc) => (
                                <option key={doc.id} value={doc.id}>
                                    {doc.label}
                                </option>
                            ))}
                        </select>
                        <a
                            href={`https://github.com/Morlock52/Media-stack-ga/tree/main/docs`}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-primary/40 bg-primary/10 text-sm text-primary hover:bg-primary/15 transition-colors"
                        >
                            <LinkIcon className="w-4 h-4" />
                            View all docs (GitHub)
                        </a>
                    </div>
                </div>

                <div className="p-4 md:p-6 bg-background/70">
                    {selected.description && (
                        <div className="mb-4 text-sm text-muted-foreground">
                            {selected.description}
                        </div>
                    )}

                    <div className="docs-reader-card">
                        {loading && (
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Loading…
                            </div>
                        )}
                        {error && (
                            <div className="flex items-center gap-2 text-sm text-amber-400">
                                <AlertTriangle className="w-4 h-4" />
                                {error}
                            </div>
                        )}
                        {!loading && !error && (
                            <article
                                className="docs-prose"
                                dangerouslySetInnerHTML={{ __html: html }}
                            />
                        )}
                    </div>
                </div>
            </div>
        </section>
    )
}
