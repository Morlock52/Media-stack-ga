import { useState, useEffect, useRef, useCallback } from 'react'
import { motion } from 'framer-motion'
import { readmeContent, quickRefContent } from '../lib/content'
import { marked } from 'marked'
import DOMPurify from 'dompurify'
import { createHighlighter } from 'shiki'
import type { Highlighter } from 'shiki'

// SVG icons for raw HTML injection
const COPY_ICON = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>`
const CHECK_ICON = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`

let highlighterPromise: Promise<Highlighter> | null = null;

const getHighlighterSingleton = () => {
    if (!highlighterPromise) {
        highlighterPromise = createHighlighter({
            themes: ['vitesse-dark'],
            langs: ['javascript', 'typescript', 'bash', 'yaml', 'json', 'markdown', 'docker', 'nginx', 'toml']
        })
    }
    return highlighterPromise
}

export function DocsViewer() {
    const [activeTab, setActiveTab] = useState<'readme' | 'quickref'>('readme')
    const [htmlContent, setHtmlContent] = useState<string>('')
    const [isLoading, setIsLoading] = useState(true)
    const containerRef = useRef<HTMLDivElement>(null)

    // Parse markdown with syntax highlighting
    const parseContent = useCallback(async (content: string) => {
        setIsLoading(true)
        try {
            const highlighter = await getHighlighterSingleton()

            // Custom renderer
            const renderer = new marked.Renderer()

            renderer.code = ({ text, lang }) => {
                const language = lang || 'text'
                let highlighted = ''

                try {
                    highlighted = highlighter.codeToHtml(text, {
                        lang: language,
                        theme: 'vitesse-dark'
                    })
                } catch (e) {
                    highlighted = `<pre><code>${text}</code></pre>`
                }

                // Wrap in relative container with copy button
                return `
                    <div class="relative group my-4 rounded-lg overflow-hidden">
                        <button class="copy-btn absolute right-2 top-2 p-2 rounded-lg bg-white/10 hover:bg-white/20 text-gray-400 hover:text-white opacity-0 group-hover:opacity-100 transition-all z-10" aria-label="Copy code">
                            <span class="icon-copy">${COPY_ICON}</span>
                            <span class="icon-check hidden">${CHECK_ICON}</span>
                        </button>
                        ${highlighted}
                    </div>
                `
            }

            // Configure marked
            marked.setOptions({
                renderer,
                gfm: true,
                breaks: true
            })

            // Parse
            const parsed = await marked.parse(content, { async: true })
            const sanitized = DOMPurify.sanitize(parsed)
            setHtmlContent(sanitized)
        } catch (error) {
            console.error('Failed to parse markdown:', error)
            setHtmlContent('<p class="text-red-500">Failed to load documentation.</p>')
        } finally {
            setIsLoading(false)
        }
    }, [])

    useEffect(() => {
        parseContent(activeTab === 'readme' ? readmeContent : quickRefContent)
    }, [activeTab, parseContent])

    // Handle Copy Button Clicks via Event Delegation
    const handleCopyClick = useCallback((e: React.MouseEvent) => {
        const target = (e.target as HTMLElement).closest('.copy-btn')
        if (!target) return

        const container = target.closest('.group')
        const codeBlock = container?.querySelector('code')
        if (!codeBlock) return

        const codeText = codeBlock.textContent || ''
        navigator.clipboard.writeText(codeText)

        // Show check icon logic
        const copyIcon = target.querySelector('.icon-copy')
        const checkIcon = target.querySelector('.icon-check')

        copyIcon?.classList.add('hidden')
        checkIcon?.classList.remove('hidden')

        setTimeout(() => {
            copyIcon?.classList.remove('hidden')
            checkIcon?.classList.add('hidden')
        }, 2000)
    }, [])

    return (
        <section className="py-24 container mx-auto px-4" id="docs">
            <div className="max-w-4xl mx-auto">
                <div className="flex items-center gap-4 mb-8 border-b border-white/10 pb-4">
                    <button
                        onClick={() => setActiveTab('readme')}
                        className={`text-lg font-medium transition-colors ${activeTab === 'readme' ? 'text-primary' : 'text-muted-foreground hover:text-white'
                            }`}
                    >
                        README.md
                    </button>
                    <button
                        onClick={() => setActiveTab('quickref')}
                        className={`text-lg font-medium transition-colors ${activeTab === 'quickref' ? 'text-primary' : 'text-muted-foreground hover:text-white'
                            }`}
                    >
                        QUICK_REFERENCE.md
                    </button>
                </div>

                <motion.div
                    key={activeTab}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3 }}
                    className="prose prose-invert prose-pre:bg-transparent prose-pre:p-0 prose-pre:border-0 max-w-none"
                    ref={containerRef}
                    onClick={handleCopyClick}
                >
                    {isLoading ? (
                        <div className="flex justify-center py-20">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                        </div>
                    ) : (
                        <div dangerouslySetInnerHTML={{ __html: htmlContent }} />
                    )}
                </motion.div>
            </div>
        </section>
    )
}
