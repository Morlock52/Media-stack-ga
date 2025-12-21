import { motion } from 'framer-motion'
import { Globe, Clock, User, Lock, AlertCircle } from 'lucide-react'
import { ComboboxInput } from '../../ui/ComboboxInput'
import { UseFormReturn } from 'react-hook-form'
import { BasicConfigFormData } from '../../../schemas/setupSchema'
import { useFocusManagement, useAutoFocus } from '../../../hooks/useFocusManagement'
import { useRef } from 'react'
import { FocusRing } from '../../ui/focus-ring'
import { InteractiveCard } from '../../ui/interactive-card'

interface BasicConfigurationStepProps {
    form: UseFormReturn<BasicConfigFormData>
    shakeField: string | null
}

export function BasicConfigurationStep({ form, shakeField }: BasicConfigurationStepProps) {
    const { register, formState: { errors } } = form
    const { registerInput, handleKeyDown, updateCurrentIndex } = useFocusManagement()
    const domainInputRef = useRef<HTMLInputElement>(null) as React.MutableRefObject<HTMLInputElement | null>
    
    useAutoFocus(domainInputRef)
    const domainRegister = register('domain')
    const passwordRegister = register('password')

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
            className="space-y-6"
        >
            <div className="mb-6">
                <h2 className="text-2xl font-bold text-foreground mb-2">Basic Configuration</h2>
                <p className="text-muted-foreground">Set up your core environment settings</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Domain */}
                <InteractiveCard className={`md:col-span-2 ${shakeField === 'domain' ? 'animate-shake' : ''}`}>
                    <label className="block text-sm font-medium text-foreground mb-2">
                        Domain <span className="text-destructive">*</span>
                    </label>
                    <FocusRing focused={document.activeElement === domainInputRef.current}>
                        <div className="relative">
                            <Globe className="absolute left-3 top-3 w-5 h-5 text-muted-foreground" />
                            <input
                                {...domainRegister}
                                ref={(e) => {
                                    domainRegister.ref(e)
                                    registerInput(0)(e)
                                    if (e) domainInputRef.current = e
                                }}
                                onKeyDown={handleKeyDown}
                                onFocus={() => updateCurrentIndex(domainInputRef.current)}
                                className={`w-full bg-background/60 border ${errors.domain ? 'border-destructive' : 'border-border'} rounded-lg py-2.5 pl-11 pr-4 text-foreground placeholder:text-muted-foreground input-focus-glow transition-all backdrop-blur-sm`}
                                placeholder="yourdomain.com"
                            />
                        </div>
                    </FocusRing>
                    {errors.domain && (
                        <p className="mt-1 text-sm text-destructive flex items-center gap-1">
                            <AlertCircle className="w-3 h-3" /> {errors.domain.message as string}
                        </p>
                    )}
                    <p className="mt-1 text-xs text-muted-foreground">Your domain for Cloudflare Tunnel access</p>
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

                {/* PUID */}
                <div>
                    <ComboboxInput
                        form={form}
                        name="puid"
                        label="PUID"
                        icon={User}
                        options={puidOptions}
                        placeholder="1000"
                        description="Process User ID for Docker containers"
                        inputIndex={2}
                        registerInput={registerInput}
                        handleKeyDown={handleKeyDown}
                        updateCurrentIndex={updateCurrentIndex}
                    />
                </div>

                {/* PGID */}
                <div>
                    <ComboboxInput
                        form={form}
                        name="pgid"
                        label="PGID"
                        icon={User}
                        options={pgidOptions}
                        placeholder="1000"
                        description="Group ID for file permissions"
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
                            <Lock className="absolute left-3 top-3 w-5 h-5 text-muted-foreground" />
                            <input
                                {...passwordRegister}
                                type="password"
                                ref={(element) => {
                                    passwordRegister.ref(element)
                                    registerInput(4)(element)
                                }}
                                onKeyDown={handleKeyDown}
                                onFocus={() => updateCurrentIndex(document.activeElement as HTMLInputElement)}
                                className={`w-full bg-background/60 border ${errors.password ? 'border-destructive' : 'border-border'} rounded-lg py-2.5 pl-11 pr-4 text-foreground placeholder:text-muted-foreground input-focus-glow transition-all backdrop-blur-sm`}
                                placeholder="••••••••"
                            />
                        </div>
                    </FocusRing>
                    {errors.password && (
                        <p className="mt-1 text-sm text-destructive flex items-center gap-1">
                            <AlertCircle className="w-3 h-3" /> {errors.password.message as string}
                        </p>
                    )}
                    <p className="mt-1 text-xs text-muted-foreground">Used for Redis and default service passwords</p>
                </InteractiveCard>
            </div>
        </motion.div>
    )
}
