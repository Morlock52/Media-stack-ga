import { useEffect, useState } from 'react'
import { HeroSection } from './components/modern/HeroSection'
import { ModernNavigation } from './components/modern/ModernNavigation'
import { SetupWizard } from './components/SetupWizard'
import { RemoteDeployModal } from './components/RemoteDeployModal'
import { AIAssistant } from './components/AIAssistant'
import { useSetupStore } from './store/setupStore'
import { TopologyMap } from './components/TopologyMap'
import { BookOpen, Server } from 'lucide-react'
import { Button } from './components/ui/button'
import { Link } from 'react-router-dom'

function App() {
  const [showDeployModal, setShowDeployModal] = useState(false)
  const { currentStep, config } = useSetupStore()

  const showAssistant = Boolean(import.meta.env.DEV || import.meta.env.VITE_CONTROL_SERVER_URL)

  // Only show deploy button when at final step (Review & Generate)
  const showDeployButton = currentStep >= 4

  useEffect(() => {
    // Handle smooth scrolling for navigation links
    const handleAnchorClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      const href = target.getAttribute('href')
      if (href && href.startsWith('#')) {
        e.preventDefault()
        const element = document.querySelector(href)
        if (element) {
          element.scrollIntoView({ behavior: 'smooth' })
        }
      }
    }

    document.addEventListener('click', handleAnchorClick)
    return () => document.removeEventListener('click', handleAnchorClick)
  }, [])

  return (
    <main className="min-h-screen bg-background text-foreground overflow-x-hidden bg-noise relative selection:bg-neon-purple/30 selection:text-neon-purple">
      {/* Deep Glass Background Blobs */}
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-purple-900/20 rounded-full blur-[120px] animate-pulse-glow" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-blue-900/20 rounded-full blur-[120px] animate-pulse-glow delay-1000" />
        <div className="absolute top-[40%] left-[30%] w-[30%] h-[30%] bg-pink-900/10 rounded-full blur-[100px] animate-float" />
      </div>
      <ModernNavigation />

      {/* Remote Deploy Modal */}
      <RemoteDeployModal isOpen={showDeployModal} onClose={() => setShowDeployModal(false)} />

      {/* Deploy to Server Button - Only show when at Review & Generate step */}
      {showDeployButton && (
        <Button
          onClick={() => setShowDeployModal(true)}
          variant="gradient"
          className="fixed bottom-4 left-4 z-40 animate-in fade-in slide-in-from-bottom-2"
          title="Deploy to remote server via SSH"
        >
          <Server className="w-4 h-4" />
          <span className="hidden sm:inline">Deploy to Server</span>
        </Button>
      )}

      {/* Hero Section */}
      <section id="hero">
        <HeroSection />
      </section>

      {/* Architecture Preview */}
      <section className="py-12 border-b border-border/50">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto text-center mb-8">
            <h2 className="text-2xl font-bold text-foreground mb-2">How It Works</h2>
            <p className="text-muted-foreground">Your traffic flows securely through Cloudflare and Authelia</p>
          </div>
          <div className="max-w-4xl mx-auto">
            <TopologyMap />
          </div>
        </div>
      </section>

      {/* Setup Wizard - Main Focus */}
      <section id="builder" className="relative">
        <SetupWizard />
      </section>

      {/* Docs Call-to-Action */}
      <section className="py-16 border-t border-border">
        <div className="container mx-auto px-4 text-center">
          <div className="max-w-2xl mx-auto">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-background/50 border border-purple-500/20 mb-6 p-1 shadow-lg shadow-purple-500/10 overflow-hidden">
              <img src="/media-stack-logo.png" alt="Logo" className="w-full h-full object-contain" />
            </div>
            <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-4">
              Need help setting up your apps?
            </h2>
            <p className="text-muted-foreground mb-8">
              Step-by-step guides for Plex, Mealie, Sonarr, Radarr and more.
              Written for non-technical users with clear, click-by-click instructions.
            </p>
            <Link
              to="/docs"
              className="inline-flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-purple-600 to-pink-600 rounded-xl font-semibold text-white shadow-lg shadow-purple-500/25 hover:shadow-purple-500/40 hover:scale-105 transition-all duration-300"
            >
              <BookOpen className="w-5 h-5" />
              View App Guides
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 border-t border-border">
        <div className="container mx-auto px-4 text-center">
          <p className="text-muted-foreground">
            Media Stack Setup Wizard • Modern 2025 UI
          </p>
        </div>
      </footer>

      {/* AI Assistant - Floating Chat */}
      {showAssistant && <AIAssistant openaiKey={config.openaiApiKey} />}
    </main>
  )
}

export default App
