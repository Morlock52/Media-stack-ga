import { motion } from 'motion/react'
import { Mic } from 'lucide-react'
import { useWizardAnimations } from '../../hooks/useWizardAnimations'

interface VoiceCompanionTriggerProps {
    /** Whether the trigger button should be visible */
    isVisible: boolean
    /** Handler called when the trigger button is clicked */
    onClick: () => void
}

/**
 * Floating voice companion trigger button that appears in newbie mode.
 * Uses scaleIn animation and fixed positioning at bottom-right of screen.
 */
export function VoiceCompanionTrigger({
    isVisible,
    onClick
}: VoiceCompanionTriggerProps) {
    const { scaleIn } = useWizardAnimations()

    if (!isVisible) return null

    return (
        <motion.button
            {...scaleIn}
            onClick={onClick}
            className="fixed bottom-24 right-6 z-40 p-4 rounded-2xl bg-gradient-to-r from-emerald-500 via-cyan-500 to-lime-400 text-white shadow-2xl shadow-emerald-500/30 hover:scale-105 transition-transform"
            title="Talk through my setup with AI"
        >
            <Mic className="w-6 h-6" />
        </motion.button>
    )
}
