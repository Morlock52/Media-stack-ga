import { useState, useCallback } from 'react'
import { UseFormReturn } from 'react-hook-form'
import { toast } from 'sonner'
import { useSetupStore } from '../store/setupStore'
import type { BasicConfigFormData, AdvancedSettingsFormData } from '../schemas/setupSchema'

/**
 * Hook that provides form validation and step navigation logic for the wizard.
 * Handles validation for Basic Config (step 1) and Advanced Settings (step 4) forms,
 * manages error scrolling, shake animations, and toast notifications.
 *
 * @param step1Form - React Hook Form instance for Basic Config step
 * @param step4Form - React Hook Form instance for Advanced Settings step
 * @returns Object containing handleNextStep, shakeField state, and setShakeField
 */
export function useWizardValidation(
    step1Form: UseFormReturn<BasicConfigFormData>,
    step4Form: UseFormReturn<AdvancedSettingsFormData>
) {
    const currentStep = useSetupStore((state) => state.currentStep)
    const selectedServices = useSetupStore((state) => state.selectedServices)
    const nextStep = useSetupStore((state) => state.nextStep)
    const updateConfig = useSetupStore((state) => state.updateConfig)

    const [shakeField, setShakeField] = useState<string | null>(null)

    /**
     * Scrolls to an element and optionally focuses it
     */
    const scrollToElement = useCallback((selector: string, shouldFocus = true) => {
        setTimeout(() => {
            const element = document.querySelector(selector) as HTMLElement
            if (element) {
                element.scrollIntoView({ behavior: 'smooth', block: 'center' })
                if (shouldFocus && element instanceof HTMLInputElement) {
                    element.focus()
                }
            }
        }, 100)
    }, [])

    /**
     * Scrolls to the first error field in a form
     */
    const scrollToFirstError = useCallback((errors: Record<string, unknown>) => {
        const firstErrorField = Object.keys(errors)[0]
        if (firstErrorField) {
            scrollToElement(`[name="${firstErrorField}"]`, true)
        }
    }, [scrollToElement])

    /**
     * Handles step navigation with form validation
     */
    const handleNextStep = useCallback(async () => {
        if (currentStep === 0) {
            // Welcome step handled by component
            nextStep()
        } else if (currentStep === 1) {
            const isValid = await step1Form.trigger()
            if (!isValid) {
                const errors = step1Form.formState.errors
                const firstErrorField = Object.keys(errors)[0]
                if (firstErrorField) {
                    setShakeField(firstErrorField)
                    setTimeout(() => setShakeField(null), 500)
                    // Scroll to error field and focus
                    scrollToFirstError(errors)
                    toast.error(`Please fix the ${firstErrorField} field`)
                }
                return
            }
            updateConfig(step1Form.getValues())
            nextStep()
        } else if (currentStep === 2) {
            if (selectedServices.length === 0) {
                toast.error('Please select at least one service')
                // Scroll to service selection area
                scrollToElement('.grid.grid-cols-1.sm\\:grid-cols-2', false)
                return
            }
            nextStep()
        } else if (currentStep === 3) {
            // Service Config step
            nextStep()
        } else if (currentStep === 4) {
            const isValid = await step4Form.trigger()
            if (!isValid) {
                const errors = step4Form.formState.errors
                scrollToFirstError(errors)
                toast.error('Please check the form fields')
                return
            }
            const values = step4Form.getValues()
            updateConfig({
                cloudflareToken: values.cloudflareToken,
                plexClaim: values.plexClaim,
                wireguardPrivateKey: values.wireguardPrivateKey,
                wireguardAddresses: values.wireguardAddresses,
            })
            nextStep()
        }
    }, [currentStep, selectedServices, step1Form, step4Form, nextStep, updateConfig, scrollToFirstError, scrollToElement])

    return {
        handleNextStep,
        shakeField,
        setShakeField
    }
}
