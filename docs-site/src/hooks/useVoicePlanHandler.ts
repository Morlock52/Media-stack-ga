import { useCallback } from 'react'
import { toast } from 'sonner'
import { useSetupStore, type SetupConfig } from '../store/setupStore'
import type { VoicePlanSummary } from '../components/VoiceCompanion'

/**
 * Hook that provides voice plan application logic for the wizard.
 * Handles applying voice companion suggestions to wizard state with undo support.
 * Updates selected services, domain, and storage paths based on the AI-generated plan.
 *
 * @returns Object containing handleApplyVoicePlan function
 */
export function useVoicePlanHandler() {
    const currentStep = useSetupStore((state) => state.currentStep)
    const setSelectedServices = useSetupStore((state) => state.setSelectedServices)
    const updateConfig = useSetupStore((state) => state.updateConfig)
    const updateServiceConfig = useSetupStore((state) => state.updateServiceConfig)
    const updateStoragePath = useSetupStore((state) => state.updateStoragePath)
    const setCurrentStep = useSetupStore((state) => state.setCurrentStep)

    /**
     * Applies a voice plan to the wizard configuration
     * @param plan - The voice plan summary containing services, domain, and storage paths
     * @param onClose - Optional callback to close the voice companion modal
     */
    const handleApplyVoicePlan = useCallback((plan: VoicePlanSummary, onClose?: () => void) => {
        const appliedChanges: string[] = []

        // Apply selected services
        if (plan.services?.length) {
            setSelectedServices(Array.from(new Set(plan.services)))
            appliedChanges.push(`${plan.services.length} services`)
        }

        // Apply domain configuration
        const configUpdates: Partial<SetupConfig> = {}
        if (plan.domain) {
            configUpdates.domain = plan.domain
            appliedChanges.push(`domain: ${plan.domain}`)
        }
        if (Object.keys(configUpdates).length) {
            updateConfig(configUpdates)
        }

        // Apply media storage paths
        if (plan.storagePaths?.media) {
            updateServiceConfig('plex', { mediaPath: plan.storagePaths.media })
            updateStoragePath('movies', { path: plan.storagePaths.media })
            updateStoragePath('tv', { path: plan.storagePaths.media })
            appliedChanges.push('media paths')
        }

        // Apply download storage paths
        if (plan.storagePaths?.downloads) {
            updateServiceConfig('torrent', { downloadsPath: plan.storagePaths.downloads })
            updateStoragePath('downloads', { path: plan.storagePaths.downloads })
            appliedChanges.push('download paths')
        }

        // Close voice companion if callback provided
        if (onClose) {
            onClose()
        }

        // Show success feedback and navigate to Stack Selection
        if (appliedChanges.length > 0) {
            toast.success('Voice plan applied!', {
                description: `Set up: ${appliedChanges.join(', ')}`,
                action: {
                    label: 'Undo',
                    onClick: () => {
                        setSelectedServices([])
                        updateConfig({ domain: '' })
                        toast.info('Plan changes undone')
                    }
                }
            })
            // Navigate to Stack Selection step to review services
            if (plan.services?.length && currentStep < 2) {
                setCurrentStep(2)
            }
        }
    }, [currentStep, setSelectedServices, updateConfig, updateServiceConfig, updateStoragePath, setCurrentStep])

    return { handleApplyVoicePlan }
}
