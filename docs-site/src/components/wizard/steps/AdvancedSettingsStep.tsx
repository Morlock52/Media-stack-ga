import { motion } from 'framer-motion'
import { HelpCircle, Shield, Home, Cloud } from 'lucide-react'
import { UseFormReturn } from 'react-hook-form'
import { AdvancedSettingsFormData } from '../../../schemas/setupSchema'
import { useSetupStore } from '../../../store/setupStore'
import { useRef, useEffect } from 'react'

interface AdvancedSettingsStepProps {
    form: UseFormReturn<AdvancedSettingsFormData>
    selectedServices: string[]
}

export function AdvancedSettingsStep({ form, selectedServices }: AdvancedSettingsStepProps) {
    const { register, formState: { errors } } = form
    const { config } = useSetupStore()
    const isLocalMode = config.deploymentMode === 'local'
    const firstInputRef = useRef<HTMLInputElement | null>(null) as React.MutableRefObject<HTMLInputElement | null>

    // Register cloudflare token with merged ref
    const cloudflareRegister = register('cloudflareToken')
    const plexClaimRegister = register('plexClaim')

    // Auto-focus first visible input
    useEffect(() => {
        const timer = setTimeout(() => {
            if (firstInputRef.current) {
                firstInputRef.current.focus()
            }
        }, 100)
        return () => clearTimeout(timer)
    }, [])

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
                <p className="text-muted-foreground">
                    {isLocalMode
                        ? 'Local deployment - just a few optional settings'
                        : 'Optional configurations (can be set later)'}
                </p>
            </div>

            <div className="space-y-6">
                {/* Local Mode Banner */}
                {isLocalMode && (
                    <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl">
                        <div className="flex items-center gap-3">
                            <Home className="w-5 h-5 text-emerald-400" />
                            <div>
                                <h3 className="font-semibold text-emerald-400">Local Installation Mode</h3>
                                <p className="text-sm text-muted-foreground">
                                    Access via *.local domains. No Cloudflare or external authentication needed.
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Cloudflare Token - Only show for cloud mode */}
                {!isLocalMode && (
                    <div>
                        <label className="block text-sm font-medium text-foreground mb-2 flex items-center gap-2">
                            <Cloud className="w-4 h-4 text-blue-400" />
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
                            {...cloudflareRegister}
                            ref={(e) => {
                                cloudflareRegister.ref(e)
                                if (e) firstInputRef.current = e
                            }}
                            type="password"
                            className="w-full bg-background/60 border border-border rounded-lg py-2.5 px-4 text-foreground placeholder:text-muted-foreground input-focus-glow transition-all backdrop-blur-sm"
                            placeholder="ey..."
                        />
                        <p className="mt-1 text-xs text-muted-foreground">Required for remote access via Cloudflare Tunnel</p>
                    </div>
                )}

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
                            {...plexClaimRegister}
                            ref={(e) => {
                                plexClaimRegister.ref(e)
                                // Focus this if cloudflare is not shown (local mode)
                                if (e && isLocalMode && !firstInputRef.current) firstInputRef.current = e
                            }}
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
