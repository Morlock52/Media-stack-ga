import { Home, Globe } from 'lucide-react'
import { SetupConfig } from '../../../../store/setupStore'

interface ConfigSummaryCardProps {
    config: SetupConfig
    mode: 'newbie' | 'expert' | null
    selectedServices: string[]
}

/**
 * Displays a summary of the wizard configuration including deployment mode,
 * domain, timezone, wizard mode, and service count.
 */
export function ConfigSummaryCard({ config, mode, selectedServices }: ConfigSummaryCardProps) {
    return (
        <div className="p-4 rounded-xl bg-muted/40 border border-border">
            <h3 className="text-sm font-semibold text-foreground/80 mb-4">Configuration Summary</h3>
            <dl className="space-y-2 text-sm">
                <div className="flex justify-between items-center">
                    <dt className="text-muted-foreground">Deployment</dt>
                    <dd className={`flex items-center gap-1.5 font-medium ${config.deploymentMode === 'local' ? 'text-emerald-400' : 'text-blue-400'}`}>
                        {config.deploymentMode === 'local' ? (
                            <><Home className="w-3.5 h-3.5" /> Local Network</>
                        ) : (
                            <><Globe className="w-3.5 h-3.5" /> Cloud / Remote</>
                        )}
                    </dd>
                </div>
                <div className="flex justify-between">
                    <dt className="text-muted-foreground">Domain</dt>
                    <dd className="text-foreground font-mono">{config.domain}</dd>
                </div>
                <div className="flex justify-between">
                    <dt className="text-muted-foreground">Timezone</dt>
                    <dd className="text-foreground font-mono">{config.timezone}</dd>
                </div>
                <div className="flex justify-between">
                    <dt className="text-muted-foreground">Mode</dt>
                    <dd className="text-primary capitalize">{mode}</dd>
                </div>
                <div className="flex justify-between">
                    <dt className="text-muted-foreground">Services</dt>
                    <dd className="text-foreground">{selectedServices.length} selected</dd>
                </div>
            </dl>
        </div>
    )
}
