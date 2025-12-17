import { motion } from 'framer-motion'
import { HelpCircle, Shield } from 'lucide-react'
import { UseFormReturn } from 'react-hook-form'
import { AdvancedSettingsFormData } from '../../../schemas/setupSchema'

interface AdvancedSettingsStepProps {
    form: UseFormReturn<AdvancedSettingsFormData>
    selectedServices: string[]
}

export function AdvancedSettingsStep({ form, selectedServices }: AdvancedSettingsStepProps) {
    const { register, formState: { errors } } = form

    return (
        <motion.div
            key="step4"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-6"
        >
            <div className="mb-6">
                <h2 className="text-2xl font-bold text-foreground mb-2">Advanced Settings</h2>
                <p className="text-muted-foreground">Optional configurations (can be set later)</p>
            </div>

            <div className="space-y-6">
                {/* Cloudflare Token */}
                <div>
                    <label className="block text-sm font-medium text-foreground mb-2 flex items-center gap-2">
                        Cloudflare Tunnel Token
                        <a
                            href="https://one.dash.cloudflare.com/"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-400 hover:text-blue-300"
                            title="Open Cloudflare dashboard in a new tab to get your tunnel token"
                        >
                            <HelpCircle className="w-4 h-4" />
                        </a>
                    </label>
                    <input
                        {...register('cloudflareToken')}
                        type="password"
                        className="w-full bg-background/60 border border-border rounded-lg py-2.5 px-4 text-foreground placeholder:text-muted-foreground input-focus-glow transition-all backdrop-blur-sm"
                        placeholder="ey..."
                    />
                    <p className="mt-1 text-xs text-muted-foreground">Required for remote access via Cloudflare Tunnel</p>
                </div>

                {/* Plex Claim */}
                {selectedServices.includes('plex') && (
                    <div>
                        <label className="block text-sm font-medium text-foreground mb-2 flex items-center gap-2">
                            Plex Claim Token
                            <a
                                href="https://www.plex.tv/claim"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-400 hover:text-blue-300"
                                title="Open Plex claim page in a new tab to generate a claim token"
                            >
                                <HelpCircle className="w-4 h-4" />
                            </a>
                        </label>
                        <input
                            {...register('plexClaim')}
                            className="w-full bg-background/60 border border-border rounded-lg py-2.5 px-4 text-foreground placeholder:text-muted-foreground input-focus-glow transition-all backdrop-blur-sm"
                            placeholder="claim-..."
                        />
                        <p className="mt-1 text-xs text-muted-foreground">Used to automatically claim your Plex server</p>
                    </div>
                )}

                {/* VPN Settings */}
                {selectedServices.includes('vpn') && (
                    <div className="space-y-4 p-4 bg-background/40 rounded-xl border border-border backdrop-blur-sm">
                        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                            <Shield className="w-4 h-4 text-green-400" />
                            VPN Configuration (WireGuard)
                        </h3>
                        <div>
                            <label className="block text-sm font-medium text-foreground mb-2">Private Key</label>
                            <input
                                {...register('wireguardPrivateKey')}
                                type="password"
                                className="w-full bg-background/60 border border-border rounded-lg py-2.5 px-4 text-foreground placeholder:text-muted-foreground input-focus-glow transition-all backdrop-blur-sm"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-foreground mb-2">Address</label>
                            <input
                                {...register('wireguardAddresses')}
                                className="w-full bg-background/60 border border-border rounded-lg py-2.5 px-4 text-foreground placeholder:text-muted-foreground input-focus-glow transition-all backdrop-blur-sm"
                                placeholder="10.0.0.2/32"
                            />
                            {errors.wireguardAddresses && (
                                <p className="mt-1 text-sm text-destructive">{errors.wireguardAddresses.message as string}</p>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </motion.div>
    )
}
