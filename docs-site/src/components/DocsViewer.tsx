import ReactMarkdown from 'react-markdown'
import { PrismLight as SyntaxHighlighter } from 'react-syntax-highlighter'
import bash from 'react-syntax-highlighter/dist/esm/languages/prism/bash'
import json from 'react-syntax-highlighter/dist/esm/languages/prism/json'
import yaml from 'react-syntax-highlighter/dist/esm/languages/prism/yaml'
import docker from 'react-syntax-highlighter/dist/esm/languages/prism/docker'
import typescript from 'react-syntax-highlighter/dist/esm/languages/prism/typescript'
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { motion } from 'framer-motion'
import { useState } from 'react'
import { Copy, Check } from 'lucide-react'
import { readmeContent, quickRefContent } from '../lib/content'

// Register languages for lighter bundle
SyntaxHighlighter.registerLanguage('bash', bash)
SyntaxHighlighter.registerLanguage('json', json)
SyntaxHighlighter.registerLanguage('yaml', yaml)
SyntaxHighlighter.registerLanguage('docker', docker)
SyntaxHighlighter.registerLanguage('typescript', typescript)

const CodeBlock = ({ inline, className, children, ...props }: any) => {
    const [copied, setCopied] = useState(false)
    const match = /language-(\w+)/.exec(className || '')
    const codeString = String(children).replace(/\n$/, '')

    const handleCopy = () => {
        navigator.clipboard.writeText(codeString)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
    }

    return !inline && match ? (
        <div className="relative group">
            <button
                onClick={handleCopy}
                className="absolute right-2 top-2 p-2 rounded-lg bg-white/10 hover:bg-white/20 text-gray-400 hover:text-white opacity-0 group-hover:opacity-100 transition-all z-10"
                title="Copy code"
            >
                {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
            </button>
            <SyntaxHighlighter
                {...props}
                style={vscDarkPlus}
                language={match[1]}
                PreTag="div"
                customStyle={{ background: '#1e1e1e', padding: '1.5rem', borderRadius: '0.75rem', border: '1px solid rgba(255,255,255,0.1)' }}
            >
                {codeString}
            </SyntaxHighlighter>
        </div>
    ) : (
        <code {...props} className={className}>
            {children}
        </code>
    )
}

export function DocsViewer() {
    const [activeTab, setActiveTab] = useState<'readme' | 'quickref'>('readme')

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
                >
                    <ReactMarkdown
                        components={{
                            code: CodeBlock
                        }}
                    >
                        {activeTab === 'readme' ? readmeContent : quickRefContent}
                    </ReactMarkdown>
                </motion.div>
            </div>
        </section>
    )
}
