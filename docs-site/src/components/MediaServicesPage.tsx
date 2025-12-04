import { BentoGrid } from './BentoGrid'
import { IntegrationMatrix } from './IntegrationMatrix'
import { AutomationFlow } from './AutomationFlow'

export function MediaServicesPage() {
  return (
    <div className="space-y-16">
      <section className="py-16">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold mb-4">Media Services Hub</h1>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
              Your complete media stack for movies, TV shows, music, and more. 
              Automate your media collection with the best self-hosted tools.
            </p>
          </div>
        </div>
      </section>
      
      <BentoGrid />
      <IntegrationMatrix />
      <AutomationFlow />
    </div>
  )
}
