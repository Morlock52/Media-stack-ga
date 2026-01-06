import { useState, useMemo } from 'react'
import { motion } from 'motion/react'
import { Eye, EyeOff, ExternalLink, AlertCircle, CheckCircle, Lock, Key, User, HelpCircle } from 'lucide-react'
import { type VPNProvider, type VPNEnvironmentVariable } from '@/data/vpnProviders'
import { useSetupStore } from '@/store/setupStore'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

interface VPNCredentialFormProps {
    provider: VPNProvider
    onValidationChange?: (isValid: boolean) => void
    className?: string
}

interface FieldError {
    field: string
    message: string
}

export function VPNCredentialForm({ provider, onValidationChange, className }: VPNCredentialFormProps) {
    const { config, updateVpnConfig } = useSetupStore()
    const [visibleFields, setVisibleFields] = useState<Set<string>>(new Set())
    const [touchedFields, setTouchedFields] = useState<Set<string>>(new Set())
    const [errors, setErrors] = useState<FieldError[]>([])

    // Get current credential values from store
    const credentials = config.vpnCredentials || {}
    const selectedProtocol = config.vpnProtocol || provider.recommendedProtocol

    // Filter fields based on selected protocol
    const relevantRequiredFields = useMemo(() => {
        return provider.requiredEnvVars.filter(field => {
            // Filter out protocol-specific fields if they don't match selected protocol
            if (field.key.includes('WIREGUARD') && selectedProtocol !== 'wireguard') return false
            if (field.key.includes('OPENVPN') && selectedProtocol !== 'openvpn') return false
            // Always show VPN_SERVICE_PROVIDER and VPN_TYPE
            if (field.key === 'VPN_SERVICE_PROVIDER' || field.key === 'VPN_TYPE') return true
            return true
        })
    }, [provider.requiredEnvVars, selectedProtocol])

    const relevantOptionalFields = useMemo(() => {
        return provider.optionalEnvVars.filter(field => {
            // Filter out protocol-specific fields
            if (field.key.includes('WIREGUARD') && selectedProtocol !== 'wireguard') return false
            if (field.key.includes('OPENVPN') && selectedProtocol !== 'openvpn') return false
            return true
        })
    }, [provider.optionalEnvVars, selectedProtocol])

    // Validate a single field
    const validateField = (field: VPNEnvironmentVariable, value: string): string | null => {
        if (field.required && !value.trim()) {
            return `${field.label} is required`
        }

        // Type-specific validation
        if (value.trim()) {
            if (field.type === 'number' && isNaN(Number(value))) {
                return `${field.label} must be a valid number`
            }

            // Email-like validation for username fields that might be emails
            if (field.key.toLowerCase().includes('user') && value.includes('@') && !value.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
                return `${field.label} appears to be an invalid email format`
            }

            // Basic WireGuard key validation (base64, ~44 chars)
            if (field.key.includes('PRIVATE_KEY') || field.key.includes('PUBLIC_KEY')) {
                if (value.length < 40 || !value.match(/^[A-Za-z0-9+/]+=*$/)) {
                    return `${field.label} appears to be invalid (should be base64 encoded, ~44 characters)`
                }
            }
        }

        return null
    }

    // Validate all required fields
    const validateForm = (currentCredentials: Record<string, string>): FieldError[] => {
        const newErrors: FieldError[] = []

        relevantRequiredFields.forEach(field => {
            // Skip auto-populated fields
            if (field.key === 'VPN_SERVICE_PROVIDER' || field.key === 'VPN_TYPE') return

            const value = currentCredentials[field.key] || ''
            const error = validateField(field, value)
            if (error) {
                newErrors.push({ field: field.key, message: error })
            }
        })

        return newErrors
    }

    // Handle field change
    const handleFieldChange = (field: VPNEnvironmentVariable, value: string) => {
        const newCredentials = { ...credentials, [field.key]: value }

        // Update store
        updateVpnConfig({ vpnCredentials: newCredentials })

        // Mark field as touched
        setTouchedFields(prev => new Set([...prev, field.key]))

        // Validate and update errors
        const newErrors = validateForm(newCredentials)
        setErrors(newErrors)

        // Notify parent of validation state
        onValidationChange?.(newErrors.length === 0)
    }

    // Handle field blur
    const handleFieldBlur = (field: VPNEnvironmentVariable) => {
        setTouchedFields(prev => new Set([...prev, field.key]))

        // Re-validate on blur
        const newErrors = validateForm(credentials)
        setErrors(newErrors)
        onValidationChange?.(newErrors.length === 0)
    }

    // Toggle password visibility
    const toggleVisibility = (fieldKey: string) => {
        setVisibleFields(prev => {
            const next = new Set(prev)
            if (next.has(fieldKey)) {
                next.delete(fieldKey)
            } else {
                next.add(fieldKey)
            }
            return next
        })
    }

    // Get error for a field
    const getFieldError = (fieldKey: string): string | undefined => {
        return errors.find(e => e.field === fieldKey)?.message
    }

    // Check if field has error and was touched
    const hasError = (fieldKey: string): boolean => {
        return touchedFields.has(fieldKey) && !!getFieldError(fieldKey)
    }

    // Get field icon based on type
    const getFieldIcon = (field: VPNEnvironmentVariable) => {
        if (field.key.includes('PASSWORD') || field.key.includes('KEY') || field.key.includes('TOKEN')) {
            return Lock
        }
        if (field.key.includes('USER') || field.key.includes('ACCOUNT')) {
            return User
        }
        return Key
    }

    // Render a single field
    const renderField = (field: VPNEnvironmentVariable, isOptional: boolean = false) => {
        // Skip auto-populated system fields
        if (field.key === 'VPN_SERVICE_PROVIDER' || field.key === 'VPN_TYPE') {
            return null
        }

        const Icon = getFieldIcon(field)
        const value = credentials[field.key] || ''
        const isPassword = field.type === 'password' || field.key.includes('PASSWORD') || field.key.includes('KEY') || field.key.includes('TOKEN')
        const isVisible = visibleFields.has(field.key)
        const fieldError = hasError(field.key) ? getFieldError(field.key) : undefined
        const showSuccess = touchedFields.has(field.key) && !fieldError && value.trim() && field.required

        return (
            <motion.div
                key={field.key}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-2"
            >
                {/* Label */}
                <label className="block text-sm font-medium text-foreground flex items-center gap-2">
                    <Icon className="w-4 h-4 text-primary" />
                    {field.label}
                    {field.required && !isOptional && <span className="text-destructive">*</span>}
                    {isOptional && <span className="text-xs text-muted-foreground">(optional)</span>}
                </label>

                {/* Input field */}
                {field.type === 'select' && field.options ? (
                    <div className="relative">
                        <select
                            value={value}
                            onChange={(e) => handleFieldChange(field, e.target.value)}
                            onBlur={() => handleFieldBlur(field)}
                            className={cn(
                                'w-full bg-background/60 border rounded-lg py-2.5 px-4 text-foreground',
                                'focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background',
                                'transition-all backdrop-blur-sm',
                                fieldError ? 'border-destructive' : 'border-border',
                                showSuccess && 'border-green-500/50'
                            )}
                        >
                            <option value="">Select {field.label}</option>
                            {field.options.map(opt => (
                                <option key={opt.value} value={opt.value}>
                                    {opt.label}
                                </option>
                            ))}
                        </select>
                    </div>
                ) : (
                    <div className="relative">
                        <Input
                            type={isPassword && !isVisible ? 'password' : field.type === 'number' ? 'number' : 'text'}
                            value={value}
                            onChange={(e) => handleFieldChange(field, e.target.value)}
                            onBlur={() => handleFieldBlur(field)}
                            placeholder={field.placeholder || `Enter ${field.label.toLowerCase()}`}
                            className={cn(
                                'w-full bg-background/60 border transition-all pr-20',
                                fieldError ? 'border-destructive focus-visible:ring-destructive' : 'border-border',
                                showSuccess && 'border-green-500/50 focus-visible:ring-green-500'
                            )}
                        />

                        {/* Password visibility toggle + success indicator */}
                        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                            {showSuccess && (
                                <CheckCircle className="w-4 h-4 text-green-500" />
                            )}
                            {isPassword && (
                                <button
                                    type="button"
                                    onClick={() => toggleVisibility(field.key)}
                                    className="p-1.5 hover:bg-muted/60 rounded transition-colors"
                                    aria-label={isVisible ? 'Hide password' : 'Show password'}
                                >
                                    {isVisible ? (
                                        <EyeOff className="w-4 h-4 text-muted-foreground" />
                                    ) : (
                                        <Eye className="w-4 h-4 text-muted-foreground" />
                                    )}
                                </button>
                            )}
                        </div>
                    </div>
                )}

                {/* Description */}
                {field.description && (
                    <p className="text-xs text-muted-foreground flex items-start gap-1">
                        <HelpCircle className="w-3 h-3 mt-0.5 flex-shrink-0" />
                        {field.description}
                    </p>
                )}

                {/* Error message */}
                {fieldError && (
                    <motion.p
                        initial={{ opacity: 0, y: -5 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="text-sm text-destructive flex items-center gap-1"
                    >
                        <AlertCircle className="w-3 h-3" />
                        {fieldError}
                    </motion.p>
                )}
            </motion.div>
        )
    }

    return (
        <div className={cn('space-y-6', className)}>
            {/* Header */}
            <div>
                <h3 className="text-2xl font-bold text-foreground mb-2">
                    {provider.name} Credentials
                </h3>
                <p className="text-muted-foreground">
                    {provider.authMethod.description}
                </p>
            </div>

            {/* Credential documentation link */}
            {provider.authMethod.credentialUrl && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="p-4 bg-primary/10 border border-primary/30 rounded-xl"
                >
                    <div className="flex items-start gap-3">
                        <div className="p-2 bg-primary/20 rounded-lg">
                            <Key className="w-5 h-5 text-primary" />
                        </div>
                        <div className="flex-1">
                            <h4 className="font-semibold text-foreground mb-1">
                                Where to find your credentials
                            </h4>
                            <p className="text-sm text-muted-foreground mb-2">
                                Get your {provider.name} credentials from your account settings:
                            </p>
                            <a
                                href={provider.authMethod.credentialUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-2 text-sm text-primary hover:text-primary/80 transition-colors font-medium"
                            >
                                Open {provider.name} credential page
                                <ExternalLink className="w-4 h-4" />
                            </a>
                        </div>
                    </div>
                </motion.div>
            )}

            {/* Required fields */}
            <div className="space-y-4">
                <h4 className="text-lg font-semibold text-foreground flex items-center gap-2">
                    <Lock className="w-5 h-5 text-primary" />
                    Required Credentials
                </h4>
                <div className="space-y-4">
                    {relevantRequiredFields.map(field => renderField(field, false))}
                </div>
            </div>

            {/* Optional fields */}
            {relevantOptionalFields.length > 0 && (
                <div className="space-y-4">
                    <h4 className="text-lg font-semibold text-foreground flex items-center gap-2">
                        <HelpCircle className="w-5 h-5 text-muted-foreground" />
                        Optional Settings
                    </h4>
                    <p className="text-sm text-muted-foreground -mt-2">
                        These can be configured later if needed
                    </p>
                    <div className="space-y-4">
                        {relevantOptionalFields.map(field => renderField(field, true))}
                    </div>
                </div>
            )}

            {/* Setup instructions link */}
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="pt-4 border-t border-border"
            >
                <a
                    href={provider.setupInstructionsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-sm text-primary hover:text-primary/80 transition-colors"
                >
                    View detailed setup instructions for {provider.name}
                    <ExternalLink className="w-4 h-4" />
                </a>
            </motion.div>

            {/* Validation summary */}
            {touchedFields.size > 0 && (
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={cn(
                        'p-4 rounded-xl border',
                        errors.length === 0
                            ? 'bg-green-500/10 border-green-500/30'
                            : 'bg-amber-500/10 border-amber-500/30'
                    )}
                >
                    <div className="flex items-start gap-3">
                        {errors.length === 0 ? (
                            <>
                                <CheckCircle className="w-5 h-5 text-green-400 mt-0.5" />
                                <div>
                                    <p className="font-medium text-green-300">All required credentials provided</p>
                                    <p className="text-sm text-muted-foreground mt-1">
                                        Your {provider.name} configuration is ready
                                    </p>
                                </div>
                            </>
                        ) : (
                            <>
                                <AlertCircle className="w-5 h-5 text-amber-400 mt-0.5" />
                                <div>
                                    <p className="font-medium text-amber-300">
                                        {errors.length} required {errors.length === 1 ? 'field' : 'fields'} remaining
                                    </p>
                                    <p className="text-sm text-muted-foreground mt-1">
                                        Please fill in all required credentials to continue
                                    </p>
                                </div>
                            </>
                        )}
                    </div>
                </motion.div>
            )}
        </div>
    )
}
