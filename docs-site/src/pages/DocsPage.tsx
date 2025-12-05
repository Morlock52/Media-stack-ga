import { useState, useEffect } from 'react'
import {
    AppsOverview,
    PlexGuide,
    MealieGuide,
    JellyfinGuide,
    EmbyGuide,
    ArrStackGuide,
    OverseerrGuide,
    TautulliGuide,
    AudiobookshelfGuide,
    PhotoPrismGuide,
    SonarrGuide,
    RadarrGuide,
    ProwlarrGuide,
    BazarrGuide,
    QBittorrentGuide,
    GluetunGuide,
    HomepageGuide,
    AutheliaGuide,
    PortainerGuide,
    TdarrGuide,
    NotifiarrGuide,
    CloudflaredGuide,
    DozzleGuide,
    FlareSolverrGuide,
    RedisGuide,
    WatchtowerGuide,
} from '../components/docs'
import { Link } from 'react-router-dom'
import { appCards } from '../components/docs/appData'
import { CustomAppGuide } from '../components/docs/CustomAppGuide'
import { GuideModal } from '../components/ui/GuideModal'
import { AIAssistant } from '../components/AIAssistant'
import { BookOpen, ArrowLeft, Sparkles, Plus } from 'lucide-react'
import { useSetupStore } from '../store/setupStore'

export function DocsPage() {
    const [selectedAppId, setSelectedAppId] = useState<string | null>(null)
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [customApps, setCustomApps] = useState<any[]>([])
    const { config } = useSetupStore()

    // Load custom apps from registry
    useEffect(() => {
        fetch('http://localhost:3001/api/registry/apps')
            .then(res => res.json())
            .then(data => Array.isArray(data) ? setCustomApps(data) : setCustomApps([]))
            .catch(console.error)
    }, [])

    const handleSelectApp = (id: string) => {
        setSelectedAppId(id)
        setIsModalOpen(true)
    }

    const handleDeleteApp = async (id: string) => {
        if (!confirm('Are you sure you want to remove this app and its documentation?')) return
        try {
            await fetch(`http://localhost:3001/api/registry/apps/${id}`, { method: 'DELETE' })
            setCustomApps(prev => prev.filter(app => app.id !== id))
            setIsModalOpen(false)
            setSelectedAppId(null)
        } catch (error) {
            console.error('Failed to delete app:', error)
        }
    }

    const customApp = customApps.find(app => app.id === selectedAppId)
    const selectedApp = appCards.find(app => app.id === selectedAppId) || customApp

    return (
        <main className="min-h-screen bg-slate-900 text-white overflow-x-hidden">
            {/* Navigation Header */}
            <header className="fixed top-0 left-0 right-0 z-40 bg-slate-900/80 backdrop-blur-xl border-b border-white/10">
                <div className="container mx-auto px-4 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 border border-purple-500/30 flex items-center justify-center">
                            <BookOpen className="w-5 h-5 text-purple-400" />
                        </div>
                        <div>
                            <h1 className="font-bold text-white text-lg">Media Stack Docs</h1>
                            <p className="text-xs text-gray-500">App guides & tutorials</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <Link
                            to="/add-service"
                            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-500/10 to-cyan-500/10 hover:from-blue-500/20 hover:to-cyan-500/20 border border-blue-500/20 rounded-lg text-sm text-blue-300 hover:text-white transition-all group"
                        >
                            <Plus className="w-4 h-4 group-hover:rotate-90 transition-transform" />
                            <span className="hidden sm:inline">Add Service</span>
                        </Link>
                        <a
                            href="/"
                            className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-sm text-gray-300 hover:text-white transition-all"
                        >
                            <ArrowLeft className="w-4 h-4" />
                            Back to Wizard
                        </a>
                    </div>
                </div>
            </header>

            {/* Hero Section */}
            <section className="pt-32 pb-16 relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-b from-purple-500/5 to-transparent pointer-events-none" />
                <div className="container mx-auto px-4 text-center relative z-10">
                    <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-purple-500/10 border border-purple-500/20 mb-6">
                        <Sparkles className="w-4 h-4 text-purple-400" />
                        <span className="text-sm text-purple-300">Non-technical friendly</span>
                    </div>
                    <h1 className="text-4xl md:text-5xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 mb-4">
                        App Guides & Documentation
                    </h1>
                    <p className="text-lg text-gray-400 max-w-2xl mx-auto">
                        Click-by-click instructions to set up each app in your media stack.
                        No jargon, just clear steps anyone can follow.
                    </p>
                </div>
            </section>

            <AppsOverview onSelectApp={handleSelectApp} customApps={customApps} />

            <footer className="py-12 border-t border-white/10 mt-10">
                <div className="container mx-auto px-4 text-center">
                    <p className="text-gray-400">
                        Media Stack Docs • Powered by your setup wizard
                    </p>
                    <a
                        href="/"
                        className="inline-flex items-center gap-2 mt-4 text-sm text-purple-400 hover:text-purple-300 transition-colors"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        Return to Setup Wizard
                    </a>
                </div>
            </footer>

            {/* Guide Modal */}
            <GuideModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                title={selectedApp ? `${selectedApp.name} Guide` : 'App Guide'}
            >
                {selectedAppId === 'plex' && <PlexGuide />}
                {selectedAppId === 'mealie' && <MealieGuide />}
                {selectedAppId === 'jellyfin' && <JellyfinGuide />}
                {selectedAppId === 'emby' && <EmbyGuide />}
                {selectedAppId === 'arr' && <ArrStackGuide />}
                {selectedAppId === 'overseerr' && <OverseerrGuide />}
                {selectedAppId === 'tautulli' && <TautulliGuide />}
                {selectedAppId === 'audiobookshelf' && <AudiobookshelfGuide />}
                {selectedAppId === 'photoprism' && <PhotoPrismGuide />}

                {selectedAppId === 'sonarr' && <SonarrGuide />}
                {selectedAppId === 'radarr' && <RadarrGuide />}
                {selectedAppId === 'prowlarr' && <ProwlarrGuide />}
                {selectedAppId === 'bazarr' && <BazarrGuide />}
                {selectedAppId === 'qbittorrent' && <QBittorrentGuide />}
                {selectedAppId === 'gluetun' && <GluetunGuide />}
                {selectedAppId === 'homepage' && <HomepageGuide />}
                {selectedAppId === 'authelia' && <AutheliaGuide />}
                {selectedAppId === 'portainer' && <PortainerGuide />}
                {selectedAppId === 'tdarr' && <TdarrGuide />}
                {selectedAppId === 'notifiarr' && <NotifiarrGuide />}
                {selectedAppId === 'cloudflared' && <CloudflaredGuide />}
                {selectedAppId === 'dozzle' && <DozzleGuide />}
                {selectedAppId === 'flaresolverr' && <FlareSolverrGuide />}
                {selectedAppId === 'redis' && <RedisGuide />}
                {selectedAppId === 'watchtower' && <WatchtowerGuide />}

                {/* Custom Apps */}
                {customApp && <CustomAppGuide app={customApp} onDelete={handleDeleteApp} />}
            </GuideModal>

            {/* AI Assistant - Multi-Agent System */}
            <AIAssistant
                currentApp={selectedAppId || undefined}
                openaiKey={config.openaiApiKey}
            />
        </main>
    )
}
