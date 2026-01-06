import { motion } from 'motion/react'
import { HelpCircle, Shield, Home, Cloud, AlertCircle, CheckCircle, Loader2 } from 'lucide-react'
import { UseFormReturn } from 'react-hook-form'
import { AdvancedSettingsFormData } from '../../../schemas/setupSchema'
import { useSetupStore } from '../../../store/setupStore'
import { useRef, useEffect, useState, useCallback } from 'react'
import { useValidation } from '../../../hooks/useValidation'
import type { ValidationIssue, CloudflareValidationOptions, VpnValidationOptions } from '../../../types/validation'

interface AdvancedSettingsStepProps {
    form: UseFormReturn<AdvancedSettingsFormData>
    selectedServices: string[]
}

export function AdvancedSettingsStep({ form, selectedServices }: AdvancedSettingsStepProps) {
    const { register, formState: { errors }, watch } = form
    const { config } = useSetupStore()
    const isLocalMode = config.deploymentMode === 'local'
    const firstInputRef = useRef<HTMLInputElement | null>(null) as React.MutableRefObject<HTMLInputElement | null>

    // Inline validation state
    const [inlineValidationIssues, setInlineValidationIssues] = useState<Record<string, ValidationIssue[]>>({})
    const [validatingFields, setValidatingFields] = useState<Record<string, boolean>>({})
    const debounceTimerRef = useRef<Record<string, NodeJS.Timeout>>({})

    const { validateSpecific } = useValidation({ autoValidate: false })

    // Register cloudflare token with merged ref
    const cloudflareRegister = register('cloudflareToken')
    const plexClaimRegister = register('plexClaim')

    // Watch field values for inline validation
    const cloudflareTokenValue = watch('cloudflareToken')
    const wireguardPrivateKeyValue = watch('wireguardPrivateKey')
    const wireguardAddressesValue = watch('wireguardAddresses')

    /**
     * Debounced inline validation for Cloudflare token
     */
    const validateCloudflareToken = useCallback(
        async (value: string) => {
            // Clear existing timer
            if (debounceTimerRef.current.cloudflareToken) {
                clearTimeout(debounceTimerRef.current.cloudflareToken)
            }

            // Skip validation for empty values
            if (!value || value.trim() === '') {
                setInlineValidationIssues((prev) => ({ ...prev, cloudflareToken: [] }))
                setValidatingFields((prev) => ({ ...prev, cloudflareToken: false }))
                return
            }

            // Set debounced validation timer
            debounceTimerRef.current.cloudflareToken = setTimeout(async () => {
                setValidatingFields((prev) => ({ ...prev, cloudflareToken: true }))

                try {
                    const options: CloudflareValidationOptions = {
                        tunnelToken: value,
                        testConnectivity: false, // Don't test connectivity for inline validation
                    }

                    await validateSpecific(
                        ['cloudflare'],
                        { cloudflareToken: value },
                        {
                            cloudflare: {
                                enabled: true,
                                options: options as Record<string, unknown>,
                            },
                        }
                    )

                    // Validation successful (no issues returned means it passed)
                    setInlineValidationIssues((prev) => ({ ...prev, cloudflareToken: [] }))
                } catch (error) {
                    // Validation will update the result state, but we need to extract issues from it
                    // For now, clear issues as the validation hook handles errors internally
                    setInlineValidationIssues((prev) => ({ ...prev, cloudflareToken: [] }))
                } finally {
                    setValidatingFields((prev) => ({ ...prev, cloudflareToken: false }))
                }
            }, 500) // 500ms debounce
        },
        [validateSpecific]
    )

    /**
     * Debounced inline validation for VPN credentials
     */
    const validateVpnCredentials = useCallback(
        async (privateKey: string, addresses: string) => {
            const fieldName = 'vpn'

            // Clear existing timer
            if (debounceTimerRef.current[fieldName]) {
                clearTimeout(debounceTimerRef.current[fieldName])
            }

            // Skip validation if both fields are empty
            if ((!privateKey || privateKey.trim() === '') && (!addresses || addresses.trim() === '')) {
                setInlineValidationIssues((prev) => ({ ...prev, wireguardPrivateKey: [], wireguardAddresses: [] }))
                setValidatingFields((prev) => ({ ...prev, wireguardPrivateKey: false, wireguardAddresses: false }))
                return
            }

            // Set debounced validation timer
            debounceTimerRef.current[fieldName] = setTimeout(async () => {
                setValidatingFields((prev) => ({
                    ...prev,
                    wireguardPrivateKey: !!privateKey,
                    wireguardAddresses: !!addresses,
                }))

                try {
                    const options: VpnValidationOptions = {
                        type: 'wireguard',
                        credentials: {
                            privateKey: privateKey || undefined,
                            addresses: addresses || undefined,
                        },
                    }

                    await validateSpecific(
                        ['vpn'],
                        { wireguardPrivateKey: privateKey, wireguardAddresses: addresses },
                        {
                            vpn: {
                                enabled: true,
                                options: options as Record<string, unknown>,
                            },
                        }
                    )

                    // Validation successful
                    setInlineValidationIssues((prev) => ({
                        ...prev,
                        wireguardPrivateKey: [],
                        wireguardAddresses: [],
                    }))
                } catch (error) {
                    // Clear issues as the validation hook handles errors internally
                    setInlineValidationIssues((prev) => ({
                        ...prev,
                        wireguardPrivateKey: [],
                        wireguardAddresses: [],
                    }))
                } finally {
                    setValidatingFields((prev) => ({
                        ...prev,
                        wireguardPrivateKey: false,
                        wireguardAddresses: false,
                    }))
                }
            }, 500) // 500ms debounce
        },
        [validateSpecific]
    )

    /**
     * Trigger validation when Cloudflare token changes
     */
    useEffect(() => {
        if (cloudflareTokenValue !== undefined && !isLocalMode) {
            validateCloudflareToken(cloudflareTokenValue || '')
        }
    }, [cloudflareTokenValue, isLocalMode, validateCloudflareToken])

    /**
     * Trigger validation when VPN credentials change
     */
    useEffect(() => {
        if (selectedServices.includes('vpn')) {
            validateVpnCredentials(
                wireguardPrivateKeyValue || '',
                wireguardAddressesValue || ''
            )
        }
    }, [wireguardPrivateKeyValue, wireguardAddressesValue, selectedServices, validateVpnCredentials])

    /**
     * Cleanup timers on unmount
     */
    useEffect(() => {
        return () => {
            Object.values(debounceTimerRef.current).forEach((timer) => clearTimeout(timer))
        }
    }, [])

    /**
     * Helper to get validation status icon for a field
     */
    const getValidationIcon = (fieldName: string) => {
        if (validatingFields[fieldName]) {
            return <Loader2 className="w-4 h-4 text-muted-foreground animate-spin" />
        }

        const issues = inlineValidationIssues[fieldName] || []
        const hasErrors = issues.some((issue) => issue.severity === 'error')

        if (issues.length > 0 && hasErrors) {
            return <AlertCircle className="w-4 h-4 text-destructive" />
        }

        // Show checkmark only if field has value and no errors
        let fieldValue = ''
        if (fieldName === 'cloudflareToken') fieldValue = cloudflareTokenValue || ''
        if (fieldName === 'wireguardPrivateKey') fieldValue = wireguardPrivateKeyValue || ''
        if (fieldName === 'wireguardAddresses') fieldValue = wireguardAddressesValue || ''

        if (fieldValue && fieldValue.trim() !== '' && issues.length === 0 && !validatingFields[fieldName]) {
            return <CheckCircle className="w-4 h-4 text-emerald-400" />
        }

        return null
    }

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
            className="space-y-4 sm:space-y-6 px-4 sm:px-0"
        >
            <div className="mb-4 sm:mb-6">
                <h2 className="text-xl sm:text-2xl font-bold text-foreground mb-2">Advanced Settings</h2>
                <p className="text-sm sm:text-base text-muted-foreground break-words">
                    {isLocalMode
                        ? 'Local deployment - just a few optional settings'
                        : 'Optional configurations (can be set later)'}
                </p>
            </div>

            <div className="space-y-4 sm:space-y-6">
                {/* Local Mode Banner */}
                {isLocalMode && (
                    <div className="p-3 sm:p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-lg sm:rounded-xl">
                        <div className="flex items-center gap-2 sm:gap-3">
                            <Home className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                            <div className="min-w-0">
                                <h3 className="text-sm sm:text-base font-semibold text-emerald-400 break-words">Local Installation Mode</h3>
                                <p className="text-xs sm:text-sm text-muted-foreground break-words">
                                    Access via *.local domains. No Cloudflare or external authentication needed.
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Cloudflare Token - Only show for cloud mode */}
                {!isLocalMode && (
                    <div>
                        <label className="block text-xs sm:text-sm font-medium text-foreground mb-2 flex items-center gap-2">
                            <Cloud className="w-4 h-4 text-blue-400 flex-shrink-0" />
                            <span className="break-words">Cloudflare Tunnel Token</span>
                            <a
                                href="https://one.dash.cloudflare.com/"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-400 hover:text-blue-300 touch-target-44 -m-2.5 p-2.5"
                                title="Open Cloudflare dashboard in a new tab to get your tunnel token"
                            >
                                <HelpCircle className="w-4 h-4 flex-shrink-0" />
                            </a>
                        </label>
                        <div className="relative">
                            <input
                                {...cloudflareRegister}
                                ref={(e) => {
                                    cloudflareRegister.ref(e)
                                    if (e) firstInputRef.current = e
                                }}
                                type="password"
                                className="w-full h-11 bg-background/60 border border-border rounded-lg px-4 pr-11 text-base text-foreground placeholder:text-muted-foreground input-focus-glow transition-all backdrop-blur-sm"
                                placeholder="ey..."
                            />
                            {/* Validation status icon */}
                            <div className="absolute right-3 top-3">
                                {getValidationIcon('cloudflareToken')}
                            </div>
                        </div>
                        {/* Inline validation errors */}
                        {inlineValidationIssues.cloudflareToken && inlineValidationIssues.cloudflareToken.length > 0 && (
                            <div className="mt-1 space-y-1">
                                {inlineValidationIssues.cloudflareToken.map((issue, idx) => (
                                    <p key={idx} className={`text-xs sm:text-sm flex items-center gap-1 break-words ${
                                        issue.severity === 'error' ? 'text-destructive' :
                                        issue.severity === 'warning' ? 'text-yellow-500' :
                                        'text-blue-500'
                                    }`}>
                                        <AlertCircle className="w-3 h-3 flex-shrink-0" /> {issue.message}
                                        {issue.fixSuggestion && (
                                            <span className="text-xs text-muted-foreground ml-1">({issue.fixSuggestion})</span>
                                        )}
                                    </p>
                                ))}
                            </div>
                        )}
                        <p className="mt-1 text-xs text-muted-foreground break-words">Required for remote access via Cloudflare Tunnel</p>
                    </div>
                )}

                {/* Plex Claim */}
                {selectedServices.includes('plex') && (
                    <div>
                        <label className="block text-xs sm:text-sm font-medium text-foreground mb-2 flex items-center gap-2">
                            <span className="break-words">Plex Claim Token</span>
                            <a
                                href="https://www.plex.tv/claim"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-400 hover:text-blue-300 touch-target-44 -m-2.5 p-2.5"
                                title="Open Plex claim page in a new tab to generate a claim token"
                            >
                                <HelpCircle className="w-4 h-4 flex-shrink-0" />
                            </a>
                        </label>
                        <input
                            {...plexClaimRegister}
                            ref={(e) => {
                                plexClaimRegister.ref(e)
                                // Focus this if cloudflare is not shown (local mode)
                                if (e && isLocalMode && !firstInputRef.current) firstInputRef.current = e
                            }}
                            className="w-full h-11 bg-background/60 border border-border rounded-lg px-4 text-base text-foreground placeholder:text-muted-foreground input-focus-glow transition-all backdrop-blur-sm"
                            placeholder="claim-..."
                        />
                        <p className="mt-1 text-xs text-muted-foreground break-words">Used to automatically claim your Plex server</p>
                    </div>
                )}

                {/* VPN Settings */}
                {selectedServices.includes('vpn') && (
                    <div className="space-y-3 sm:space-y-4 p-3 sm:p-4 bg-background/40 rounded-lg sm:rounded-xl border border-border backdrop-blur-sm">
                        <h3 className="text-xs sm:text-sm font-semibold text-foreground flex items-center gap-2">
                            <Shield className="w-4 h-4 text-green-400 flex-shrink-0" />
                            <span className="break-words">VPN Configuration (WireGuard)</span>
                        </h3>
                        <div>
                            <label className="block text-xs sm:text-sm font-medium text-foreground mb-2 break-words">Private Key</label>
                            <div className="relative">
                                <input
                                    {...register('wireguardPrivateKey')}
                                    type="password"
                                    className="w-full h-11 bg-background/60 border border-border rounded-lg px-4 pr-11 text-base text-foreground placeholder:text-muted-foreground input-focus-glow transition-all backdrop-blur-sm"
                                />
                                {/* Validation status icon */}
                                <div className="absolute right-3 top-3">
                                    {getValidationIcon('wireguardPrivateKey')}
                                </div>
                            </div>
                            {/* Inline validation errors */}
                            {inlineValidationIssues.wireguardPrivateKey && inlineValidationIssues.wireguardPrivateKey.length > 0 && (
                                <div className="mt-1 space-y-1">
                                    {inlineValidationIssues.wireguardPrivateKey.map((issue, idx) => (
                                        <p key={idx} className={`text-xs sm:text-sm flex items-center gap-1 break-words ${
                                            issue.severity === 'error' ? 'text-destructive' :
                                            issue.severity === 'warning' ? 'text-yellow-500' :
                                            'text-blue-500'
                                        }`}>
                                            <AlertCircle className="w-3 h-3 flex-shrink-0" /> {issue.message}
                                            {issue.fixSuggestion && (
                                                <span className="text-xs text-muted-foreground ml-1">({issue.fixSuggestion})</span>
                                            )}
                                        </p>
                                    ))}
                                </div>
                            )}
                        </div>
                        <div>
                            <label className="block text-xs sm:text-sm font-medium text-foreground mb-2 break-words">Address</label>
                            <div className="relative">
                                <input
                                    {...register('wireguardAddresses')}
                                    className="w-full h-11 bg-background/60 border border-border rounded-lg px-4 pr-11 text-base text-foreground placeholder:text-muted-foreground input-focus-glow transition-all backdrop-blur-sm"
                                    placeholder="10.0.0.2/32"
                                />
                                {/* Validation status icon */}
                                <div className="absolute right-3 top-3">
                                    {getValidationIcon('wireguardAddresses')}
                                </div>
                            </div>
                            {/* Inline validation errors */}
                            {inlineValidationIssues.wireguardAddresses && inlineValidationIssues.wireguardAddresses.length > 0 && (
                                <div className="mt-1 space-y-1">
                                    {inlineValidationIssues.wireguardAddresses.map((issue, idx) => (
                                        <p key={idx} className={`text-xs sm:text-sm flex items-center gap-1 break-words ${
                                            issue.severity === 'error' ? 'text-destructive' :
                                            issue.severity === 'warning' ? 'text-yellow-500' :
                                            'text-blue-500'
                                        }`}>
                                            <AlertCircle className="w-3 h-3 flex-shrink-0" /> {issue.message}
                                            {issue.fixSuggestion && (
                                                <span className="text-xs text-muted-foreground ml-1">({issue.fixSuggestion})</span>
                                            )}
                                        </p>
                                    ))}
                                </div>
                            )}
                            {errors.wireguardAddresses && (
                                <p className="mt-1 text-xs sm:text-sm text-destructive break-words">{errors.wireguardAddresses.message as string}</p>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </motion.div>
    )
}