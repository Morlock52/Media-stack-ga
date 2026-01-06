import { motion } from 'motion/react'
import { Globe, Clock, User, Lock, AlertCircle, Home, CheckCircle, Loader2 } from 'lucide-react'
import { ComboboxInput } from '../../ui/ComboboxInput'
import { UseFormReturn } from 'react-hook-form'
import { BasicConfigFormData } from '../../../schemas/setupSchema'
import { useFocusManagement, useAutoFocus } from '../../../hooks/useFocusManagement'
import { useRef, useState, useEffect, useCallback } from 'react'
import { FocusRing } from '../../ui/focus-ring'
import { InteractiveCard } from '../../ui/interactive-card'
import { useSetupStore } from '../../../store/setupStore'
import { useValidation } from '../../../hooks/useValidation'
import type { ValidationIssue } from '../../../types/validation'

interface BasicConfigurationStepProps {
    form: UseFormReturn<BasicConfigFormData>
    shakeField: string | null
}

export function BasicConfigurationStep({ form, shakeField }: BasicConfigurationStepProps) {
    const { register, formState: { errors }, watch } = form
    const { config } = useSetupStore()
    const isLocalMode = config.deploymentMode === 'local'
    const { registerInput, handleKeyDown, updateCurrentIndex } = useFocusManagement()
    const domainInputRef = useRef<HTMLInputElement>(null) as React.MutableRefObject<HTMLInputElement | null>

    // Inline validation state
    const [inlineValidationIssues, setInlineValidationIssues] = useState<Record<string, ValidationIssue[]>>({})
    const [validatingFields, setValidatingFields] = useState<Record<string, boolean>>({})
    const debounceTimerRef = useRef<Record<string, NodeJS.Timeout>>({})

    const { validateSpecific } = useValidation({ autoValidate: false })

    useAutoFocus(domainInputRef)
    const domainRegister = register('domain')
    const passwordRegister = register('password')

    // Watch field values for inline validation
    const domainValue = watch('domain')
    const passwordValue = watch('password')

    /**
     * Debounced inline validation for a specific field
     */
    const validateField = useCallback(
        async (fieldName: string, value: string) => {
            // Clear existing timer for this field
            if (debounceTimerRef.current[fieldName]) {
                clearTimeout(debounceTimerRef.current[fieldName])
            }

            // Skip validation for empty values
            if (!value || value.trim() === '') {
                setInlineValidationIssues((prev) => ({ ...prev, [fieldName]: [] }))
                setValidatingFields((prev) => ({ ...prev, [fieldName]: false }))
                return
            }

            // Set debounced validation timer
            debounceTimerRef.current[fieldName] = setTimeout(async () => {
                setValidatingFields((prev) => ({ ...prev, [fieldName]: true }))

                try {
                    // Note: Currently we only have validators for paths, ports, VPN, Cloudflare, and Docker
                    // For password and domain, we rely on form validation (Zod schema)
                    // This inline validation infrastructure is ready for when we add more validators
                    // or when we integrate client-side validation logic

                    // Clear validation state since we don't have specific validators for these fields yet
                    setInlineValidationIssues((prev) => ({ ...prev, [fieldName]: [] }))
                } catch (error) {
                    // Error during validation - clear issues
                    setInlineValidationIssues((prev) => ({ ...prev, [fieldName]: [] }))
                } finally {
                    setValidatingFields((prev) => ({ ...prev, [fieldName]: false }))
                }
            }, 500) // 500ms debounce
        },
        [validateSpecific]
    )

    /**
     * Trigger validation when field values change
     */
    useEffect(() => {
        if (domainValue !== undefined) {
            validateField('domain', domainValue)
        }
    }, [domainValue, validateField])

    useEffect(() => {
        if (passwordValue !== undefined) {
            validateField('password', passwordValue)
        }
    }, [passwordValue, validateField])

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
        const fieldValue = fieldName === 'domain' ? domainValue : passwordValue
        if (fieldValue && fieldValue.trim() !== '' && issues.length === 0 && !validatingFields[fieldName]) {
            return <CheckCircle className="w-4 h-4 text-emerald-400" />
        }

        return null
    }

    const timezoneOptions = [
        { value: 'Etc/UTC', label: 'Universal Coordinated Time', description: 'Recommended for servers' },
        { value: 'America/New_York', label: 'Eastern Time (US & Canada)' },
        { value: 'America/Los_Angeles', label: 'Pacific Time (US & Canada)' },
        { value: 'Europe/London', label: 'London', description: 'GMT/BST' },
        { value: 'Europe/Berlin', label: 'Berlin', description: 'CET/CEST' },
        { value: 'Asia/Tokyo', label: 'Tokyo', description: 'JST' },
        { value: 'Australia/Sydney', label: 'Sydney', description: 'AEST/AEDT' },
    ]

    const puidOptions = [
        { value: '1000', label: 'Standard User', description: 'Default for most Linux systems' },
        { value: '1001', label: 'Secondary User' },
        { value: '501', label: 'macOS User', description: 'Default for macOS' },
        { value: '0', label: 'Root', description: 'Not recommended for security' },
    ]

    const pgidOptions = [
        { value: '1000', label: 'Standard Group', description: 'Default for most Linux systems' },
        { value: '100', label: 'Users Group', description: 'Common shared group' },
        { value: '20', label: 'Staff Group', description: 'Default for macOS' },
        { value: '0', label: 'Root Group', description: 'Not recommended' },
    ]

    return (
        <motion.div
            key="step1"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-4 sm:space-y-6 px-4 sm:px-0"
        >
            <div className="mb-4 sm:mb-6">
                <h2 className="text-xl sm:text-2xl font-bold text-foreground mb-2">Basic Configuration</h2>
                <p className="text-sm sm:text-base text-muted-foreground">
                    {isLocalMode
                        ? "Just a few quick settings and you're ready to go!"
                        : "Set up your core environment settings"}
                </p>
            </div>

            {/* Beginner-friendly tip for local mode */}
            {isLocalMode && (
                <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-3 sm:p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-lg sm:rounded-xl mb-3 sm:mb-4"
                >
                    <p className="text-xs sm:text-sm text-muted-foreground break-words">
                        <span className="text-emerald-400 font-medium">💡 Quick tip:</span> Most settings are already set to good defaults.
                        Just create a password and click Next!
                    </p>
                </motion.div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                {/* Domain */}
                <InteractiveCard className={`md:col-span-2 ${shakeField === 'domain' ? 'animate-shake' : ''}`}>
                    <label className="block text-sm font-medium text-foreground mb-2 flex items-center gap-2">
                        {isLocalMode ? <Home className="w-4 h-4 text-emerald-400 flex-shrink-0" /> : <Globe className="w-4 h-4 flex-shrink-0" />}
                        <span className="break-words">{isLocalMode ? 'Local Hostname' : 'Domain'} <span className="text-destructive">*</span></span>
                    </label>
                    <FocusRing focused={document.activeElement === domainInputRef.current}>
                        <div className="relative">
                            {isLocalMode
                                ? <Home className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-emerald-400 flex-shrink-0" />
                                : <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground flex-shrink-0" />
                            }
                            <input
                                {...domainRegister}
                                ref={(e) => {
                                    domainRegister.ref(e)
                                    registerInput(0)(e)
                                    if (e) domainInputRef.current = e
                                }}
                                onKeyDown={handleKeyDown}
                                onFocus={() => updateCurrentIndex(domainInputRef.current)}
                                className={`w-full h-11 bg-background/60 border ${errors.domain ? 'border-destructive' : 'border-border'} rounded-lg pl-11 pr-11 text-base text-foreground placeholder:text-muted-foreground input-focus-glow transition-all backdrop-blur-sm`}
                                placeholder={isLocalMode ? 'mediastack.local' : 'yourdomain.com'}
                            />
                            {/* Validation status icon */}
                            <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                {getValidationIcon('domain')}
                            </div>
                        </div>
                    </FocusRing>
                    {errors.domain && (
                        <p className="mt-1 text-xs sm:text-sm text-destructive flex items-center gap-1">
                            <AlertCircle className="w-3 h-3 flex-shrink-0" /> <span className="break-words">{errors.domain.message as string}</span>
                        </p>
                    )}
                    {/* Inline validation errors */}
                    {!errors.domain && inlineValidationIssues.domain && inlineValidationIssues.domain.length > 0 && (
                        <div className="mt-1 space-y-1">
                            {inlineValidationIssues.domain.map((issue, idx) => (
                                <p key={idx} className={`text-sm flex items-center gap-1 ${
                                    issue.severity === 'error' ? 'text-destructive' :
                                    issue.severity === 'warning' ? 'text-yellow-500' :
                                    'text-blue-500'
                                }`}>
                                    <AlertCircle className="w-3 h-3" /> {issue.message}
                                </p>
                            ))}
                        </div>
                    )}
                    <p className="mt-1 text-xs text-muted-foreground break-words">
                        {isLocalMode
                            ? 'Optional: You can leave this as "local" — you\'ll access apps via IP address'
                            : 'Your domain for Cloudflare Tunnel access'}
                    </p>
                </InteractiveCard>

                {/* Timezone */}
                <div className="md:col-span-2">
                    <ComboboxInput
                        form={form}
                        name="timezone"
                        label="Timezone"
                        icon={Clock}
                        options={timezoneOptions}
                        placeholder="Etc/UTC"
                        description={`Auto-detected: ${Intl.DateTimeFormat().resolvedOptions().timeZone}`}
                        inputIndex={1}
                        registerInput={registerInput}
                        handleKeyDown={handleKeyDown}
                        updateCurrentIndex={updateCurrentIndex}
                    />
                </div>

                {/* PUID - with beginner-friendly description */}
                <div>
                    <ComboboxInput
                        form={form}
                        name="puid"
                        label="PUID"
                        icon={User}
                        options={puidOptions}
                        placeholder="1000"
                        description={isLocalMode ? "Leave as 1000 (works for most computers)" : "Process User ID for Docker containers"}
                        inputIndex={2}
                        registerInput={registerInput}
                        handleKeyDown={handleKeyDown}
                        updateCurrentIndex={updateCurrentIndex}
                    />
                </div>

                {/* PGID - with beginner-friendly description */}
                <div>
                    <ComboboxInput
                        form={form}
                        name="pgid"
                        label="PGID"
                        icon={User}
                        options={pgidOptions}
                        placeholder="1000"
                        description={isLocalMode ? "Leave as 1000 (works for most computers)" : "Group ID for file permissions"}
                        inputIndex={3}
                        registerInput={registerInput}
                        handleKeyDown={handleKeyDown}
                        updateCurrentIndex={updateCurrentIndex}
                    />
                </div>

                {/* Master Password */}
                <InteractiveCard className={`md:col-span-2 ${shakeField === 'password' ? 'animate-shake' : ''}`}>
                    <label className="block text-sm font-medium text-foreground mb-2">
                        Master Password <span className="text-destructive">*</span>
                    </label>
                    <FocusRing focused={(document.activeElement as HTMLInputElement)?.type === 'password'}>
                        <div className="relative">
                            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground flex-shrink-0" />
                            <input
                                {...passwordRegister}
                                type="password"
                                ref={(element) => {
                                    passwordRegister.ref(element)
                                    registerInput(4)(element)
                                }}
                                onKeyDown={handleKeyDown}
                                onFocus={() => updateCurrentIndex(document.activeElement as HTMLInputElement)}
                                className={`w-full h-11 bg-background/60 border ${errors.password ? 'border-destructive' : 'border-border'} rounded-lg pl-11 pr-4 text-base text-foreground placeholder:text-muted-foreground input-focus-glow transition-all backdrop-blur-sm`}
                                placeholder="••••••••"
                            />
                        </div>
                    </FocusRing>
                    {errors.password && (
                        <p className="mt-1 text-xs sm:text-sm text-destructive flex items-center gap-1">
                            <AlertCircle className="w-3 h-3 flex-shrink-0" /> <span className="break-words">{errors.password.message as string}</span>
                        </p>
                    )}
                    <p className="mt-1 text-xs text-muted-foreground break-words">
                        {isLocalMode
                            ? 'This password protects your apps — choose something memorable!'
                            : 'Used for Redis and default service passwords'}
                    </p>
                </InteractiveCard>
            </div>
        </motion.div>
    )
}