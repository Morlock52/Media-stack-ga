import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, Sparkles, Database, FileText, Code, Copy, AlertCircle, Loader2, Save, Trash2, ExternalLink } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useSetupStore } from '../store/setupStore'

interface SavedApp {
    id: string;
    name: string;
    repo: string;
    homepage: string;
    docs: string;
    compose: string;
    updatedAt: string;
}

export function ServiceGeneratorPage() {
    const [url, setUrl] = useState('')
    const [isLoading, setIsLoading] = useState(false)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [result, setResult] = useState<any>(null)
    const [savedApps, setSavedApps] = useState<SavedApp[]>([])
    const [activeTab, setActiveTab] = useState<'homepage' | 'docs' | 'compose'>('homepage')

    const { config } = useSetupStore()

    // Base URLs
    const API_BASE = 'http://localhost:3001/api'

    // Load saved apps
    useEffect(() => {
        fetch(`${API_BASE}/registry/apps`)
            .then(res => res.json())
            .then(data => Array.isArray(data) ? setSavedApps(data) : setSavedApps([]))
            .catch(console.error)
    }, [])

    const handleGenerate = async () => {
        if (!url.includes('github.com')) {
            setError('Please enter a valid GitHub URL (e.g., https://github.com/user/repo)')
            return
        }

        setIsLoading(true)
        setError(null)
        setResult(null)

        try {
            const res = await fetch(`${API_BASE}/generator/analyze`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    url,
                    openaiKey: config.openaiApiKey
                })
            })

            const data = await res.json()
            if (!res.ok) throw new Error(data.error || 'Generation failed')

            setResult(data)
        } catch (err: any) {
            setError(err.message)
        } finally {
            setIsLoading(false)
        }
    }

    const handleSave = async () => {
        if (!result) return
        setSaving(true)
        try {
            const payload = {
                repo: url,
                homepage: result.homepage,
                docs: result.docs,
                compose: result.compose
            }

            const res = await fetch(`${API_BASE}/registry/apps`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            })

            const data = await res.json()

            if (res.ok) {
                setSavedApps(prev => {
                    const filtered = prev.filter(a => a.id !== data.app.id)
                    return [data.app, ...filtered]
                })
            }
        } catch (err) {
            console.error('Failed to save', err)
        } finally {
            setSaving(false)
        }
    }

    const handleDelete = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation()
        if (!confirm('Remove this app from your library?')) return

        try {
            await fetch(`${API_BASE}/registry/apps/${id}`, { method: 'DELETE' })
            setSavedApps(prev => prev.filter(a => a.id !== id))
            if (result?.id === id) setResult(null)
        } catch (err) {
            console.error(err)
        }
    }

    const loadApp = (app: SavedApp) => {
        setUrl(app.repo)
        setResult({
            homepage: app.homepage,
            docs: app.docs,
            compose: app.compose,
            id: app.id // track id so we know it's saved
        })
        window.scrollTo({ top: 0, behavior: 'smooth' })
    }

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text)
    }

    return (
        <main className="min-h-screen bg-slate-900 text-white selection:bg-purple-500/30 font-sans">
            {/* Header */}
            <header className="fixed top-0 left-0 right-0 z-40 bg-slate-900/80 backdrop-blur-xl border-b border-white/10">
                <div className="container mx-auto px-4 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500/20 to-cyan-500/20 border border-blue-500/30 flex items-center justify-center">
                            <Sparkles className="w-5 h-5 text-blue-400" />
                        </div>
                        <h1 className="font-bold text-white text-lg">AI Service Integrator</h1>
                    </div>
                    <Link
                        to="/docs"
                        className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-sm transition-all"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        Back to Docs
                    </Link>
                </div>
            </header>

            <div className="container mx-auto px-4 pt-32 pb-20 max-w-4xl">
                {/* Hero */}
                <div className="text-center mb-12">
                    <h2 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 mb-4">
                        Add Any App to Your Stack
                    </h2>
                    <p className="text-gray-400 text-lg max-w-2xl mx-auto">
                        Paste a GitHub URL. Our AI will analyze the repo and generate your Homepage config, Documentation guide, and Docker Compose snippet instantly.
                    </p>
                </div>

                {/* Input Section */}
                <div className="bg-white/5 border border-white/10 rounded-2xl p-6 mb-12 shadow-2xl backdrop-blur-sm">
                    <div className="flex flex-col md:flex-row gap-4">
                        <input
                            type="text"
                            placeholder="https://github.com/linuxserver/docker-wireguard"
                            className="flex-1 bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition-all font-mono text-sm"
                            value={url}
                            onChange={(e) => setUrl(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleGenerate()}
                        />
                        <button
                            onClick={handleGenerate}
                            disabled={isLoading}
                            className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 px-8 py-3 rounded-xl font-bold transition-all disabled:opacity-50 flex items-center gap-2 justify-center min-w-[160px] shadow-lg shadow-purple-500/25"
                        >
                            {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
                            {isLoading ? 'Thinking...' : 'Generate'}
                        </button>
                    </div>
                    {error && (
                        <div className="mt-4 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-200 flex items-center gap-3 animate-in fade-in slide-in-from-top-2">
                            <AlertCircle className="w-5 h-5 text-red-400" />
                            {error}
                        </div>
                    )}
                </div>

                {/* Results Section */}
                <AnimatePresence>
                    {result && (
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            className="space-y-6 mb-20"
                        >
                            <div className="flex items-center justify-between">
                                {/* Tabs */}
                                <div className="flex gap-2 p-1 bg-white/5 rounded-xl border border-white/10 w-fit">
                                    {[
                                        { id: 'homepage', label: 'Dashboard Config', icon: Database },
                                        { id: 'docs', label: 'Docs Guide', icon: FileText },
                                        { id: 'compose', label: 'Docker Compose', icon: Code },
                                    ].map((tab) => (
                                        <button
                                            key={tab.id}
                                            onClick={() => setActiveTab(tab.id as any)}
                                            className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-all ${activeTab === tab.id
                                                    ? 'bg-purple-600 text-white shadow-lg'
                                                    : 'hover:bg-white/5 text-gray-400 hover:text-white'
                                                }`}
                                        >
                                            <tab.icon className="w-4 h-4" />
                                            {tab.label}
                                        </button>
                                    ))}
                                </div>

                                {/* Save Button */}
                                <button
                                    onClick={handleSave}
                                    disabled={saving}
                                    className="flex items-center gap-2 px-4 py-2 bg-green-500/10 hover:bg-green-500/20 border border-green-500/20 rounded-xl text-green-300 hover:text-white transition-all disabled:opacity-50"
                                >
                                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                    Save to Library
                                </button>
                            </div>

                            {/* Content Viewer */}
                            <div className="bg-[#1e1e1e] rounded-2xl border border-white/10 overflow-hidden relative group shadow-2xl">
                                <div className="absolute right-4 top-4 flex gap-2">
                                    <span className="text-xs text-gray-500 px-2 py-1 bg-black/30 rounded border border-white/5 self-center">
                                        {activeTab === 'homepage' ? 'services.yaml' : activeTab === 'docs' ? 'README.md' : 'docker-compose.yml'}
                                    </span>
                                    <button
                                        onClick={() => copyToClipboard(result[activeTab])}
                                        className="p-2 bg-white/10 hover:bg-white/20 rounded-lg text-gray-400 hover:text-white transition-all opacity-0 group-hover:opacity-100"
                                        title="Copy to clipboard"
                                    >
                                        <Copy className="w-4 h-4" />
                                    </button>
                                </div>
                                <div className="p-6 overflow-x-auto max-h-[600px] overflow-y-auto custom-scrollbar">
                                    <pre className="font-mono text-sm text-gray-300 leading-relaxed whitespace-pre-wrap">
                                        {result[activeTab]}
                                    </pre>
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Library Section */}
                <div className="pt-12 border-t border-white/10">
                    <h3 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-cyan-400 mb-6 flex items-center gap-2">
                        <Database className="w-5 h-5 text-blue-400" />
                        My Library
                    </h3>

                    {savedApps.length === 0 ? (
                        <div className="text-center py-12 bg-white/5 rounded-2xl border border-white/5 border-dashed">
                            <p className="text-gray-500">No apps saved yet. Generate one above!</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {savedApps.map(app => (
                                <motion.div
                                    key={app.id}
                                    layoutId={app.id}
                                    onClick={() => loadApp(app)}
                                    className="bg-white/5 hover:bg-white/10 border border-white/10 hover:border-purple-500/50 rounded-xl p-4 cursor-pointer group transition-all relative"
                                >
                                    <h4 className="font-bold text-white mb-1">{app.name}</h4>
                                    <p className="text-xs text-gray-400 font-mono mb-3 truncate">{app.repo}</p>
                                    <div className="flex items-center gap-2 text-xs text-gray-500">
                                        <span className="px-2 py-1 bg-white/5 rounded">Updated: {new Date(app.updatedAt).toLocaleDateString()}</span>
                                    </div>

                                    <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <a
                                            href={app.repo}
                                            target="_blank"
                                            rel="noreferrer"
                                            onClick={(e) => e.stopPropagation()}
                                            className="p-1.5 hover:bg-blue-500/20 rounded-lg text-gray-400 hover:text-blue-400"
                                        >
                                            <ExternalLink className="w-4 h-4" />
                                        </a>
                                        <button
                                            onClick={(e) => handleDelete(app.id, e)}
                                            className="p-1.5 hover:bg-red-500/20 rounded-lg text-gray-400 hover:text-red-400"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </motion.div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </main>
    )
}
