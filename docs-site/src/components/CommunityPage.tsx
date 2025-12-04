import { SocialProof } from './SocialProof'
import { CommunityCTA } from './CommunityCTA'
import { FaqSection } from './FaqSection'
import { ResourcesStrip } from './ResourcesStrip'

export function CommunityPage() {
  return (
    <div className="space-y-16">
      <section className="py-16">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold mb-4">Community & Resources</h1>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
              Join the media stack community. Get help, share your setup, 
              and discover new tools from fellow enthusiasts.
            </p>
          </div>
        </div>
      </section>
      
      <SocialProof />
      <CommunityCTA />
      <FaqSection />
      <ResourcesStrip />
    </div>
  )
}
