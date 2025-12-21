import { useState } from 'react'
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
import { appCards, type AppId } from '../components/docs/appData'
import { GuideModal } from '../components/ui/GuideModal'
import { AIAssistant } from '../components/AIAssistant'
import { ArrowLeft, Sparkles } from 'lucide-react'
import { Button } from '../components/ui/button'
import { Link } from 'react-router-dom'
import { ThemeToggleButton } from '../components/layout/ThemeToggleButton'

export function DocsPage() {
    const [selectedAppId, setSelectedAppId] = useState<AppId | null>(null)
    const [isModalOpen, setIsModalOpen] = useState(false)

    const handleSelectApp = (id: AppId) => {
        setSelectedAppId(id)
        setIsModalOpen(true)
    }

    const selectedApp = appCards.find(app => app.id === selectedAppId)

    return (
        <main className="min-h-screen bg-background text-foreground overflow-x-hidden bg-noise relative">
            <div className="fixed inset-0 z-0 pointer-events-none">
                <div className="absolute inset-0 matrix-grid opacity-10" />
                <div className="absolute inset-0 matrix-rain opacity-18" />
                <div className="absolute inset-0 scanlines" />
            </div>

            <div className="relative z-10">
                {/* Navigation Header */}
                <header className="fixed top-0 left-0 right-0 z-40 glass border-b border-border/50">
                    <div className="container mx-auto px-4 h-16 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-background/50 border border-primary/40 flex items-center justify-center p-0.5 overflow-hidden">
                                <img src="/media-stack-logo.png" alt="Logo" className="w-full h-full object-contain" />
                            </div>
                            <div>
                                <h1 className="font-bold text-foreground text-lg leading-tight">Media Stack Docs</h1>
                                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">App Guides & Tutorials</p>
                            </div>
                        </div>
                        <Button variant="glass" asChild className="gap-2">
                            <Link to="/">
                                <ArrowLeft className="w-4 h-4" />
                                Back to Wizard
                            </Link>
                        </Button>
                        <ThemeToggleButton />
                    </div>
                </header>

                {/* Hero Section */}
                <section className="pt-32 pb-16 relative overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-b from-primary/10 to-transparent pointer-events-none" />
                    <div className="container mx-auto px-4 text-center relative z-10">
                        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/30 mb-6">
                            <Sparkles className="w-4 h-4 text-primary" />
                            <span className="text-sm text-primary">Non-technical friendly</span>
                        </div>
                        <h1 className="text-4xl md:text-5xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-emerald-400 via-cyan-400 to-lime-400 mb-4">
                            App Guides & Documentation
                        </h1>
                        <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                            Click-by-click instructions to set up each app in your media stack.
                            No jargon, just clear steps anyone can follow.
                        </p>
                    </div>
                </section>

                <AppsOverview onSelectApp={handleSelectApp} />

                <footer className="py-12 border-t border-border/50 mt-10">
                    <div className="container mx-auto px-4 text-center">
                        <p className="text-muted-foreground">
                            Media Stack Docs • Powered by your setup wizard
                        </p>
                        <Button variant="link" asChild className="mt-4 text-primary hover:text-primary/80">
                            <Link to="/" className="gap-2">
                                <ArrowLeft className="w-4 h-4" />
                                Return to Setup Wizard
                            </Link>
                        </Button>
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
                </GuideModal>

                {/* AI Assistant - Multi-Agent System */}
                <AIAssistant currentApp={selectedAppId || undefined} />
            </div>
        </main>
    )
}
