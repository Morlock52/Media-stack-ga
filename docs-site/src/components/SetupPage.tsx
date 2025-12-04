import { PlanChecklist } from './PlanChecklist'
import { ExportTools } from './ExportTools'

export function SetupPage() {
  return (
    <div className="space-y-16">
      <section className="py-16">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold mb-4">Setup & Configuration</h1>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
              Step-by-step guide to deploy your media stack. 
              Follow the checklist and export your configuration for easy setup.
            </p>
          </div>
        </div>
      </section>
      
      <PlanChecklist />
      <ExportTools />
    </div>
  )
}
