import { useMemo } from 'react'
import { motion } from 'motion/react'
import { RotateCcw, User, MoreHorizontal, Sparkles } from 'lucide-react'
import { Button } from '../ui/button'
import { useReducedMotion } from '../../hooks/useReducedMotion'

interface WizardHeaderProps {
    onResetClick: () => void
    showResetConfirm: boolean
    onProfilesClick: () => void
    onToolsClick: () => void
}

export function WizardHeader({
    onResetClick,
    showResetConfirm,
    onProfilesClick,
    onToolsClick
}: WizardHeaderProps) {
    const prefersReducedMotion = useReducedMotion()

    // Animation variants that respect reduced motion
    const fadeInUp = useMemo(() => prefersReducedMotion
        ? { initial: {}, animate: {}, transition: { duration: 0 } }
        : { initial: { opacity: 0, y: 20 }, animate: { opacity: 1, y: 0 } },
        [prefersReducedMotion]
    )

    return (
        <div className="text-center mb-12">
            <motion.div
                {...fadeInUp}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/30 mb-6"
            >
                <Sparkles className="w-4 h-4 text-primary" />
                <span className="text-sm text-primary">Interactive Setup Wizard</span>
            </motion.div>
            <motion.h1
                {...fadeInUp}
                transition={prefersReducedMotion ? { duration: 0 } : { delay: 0.1 }}
                className="text-4xl md:text-5xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-emerald-400 via-cyan-400 to-lime-400 mb-4"
            >
                Setup Wizard
            </motion.h1>
            <motion.p
                {...fadeInUp}
                transition={prefersReducedMotion ? { duration: 0 } : { delay: 0.2 }}
                className="text-lg text-muted-foreground max-w-2xl mx-auto"
            >
                Step-by-step guidance to generate your <code className="px-2 py-1 bg-muted/40 rounded text-primary">.env</code> and configuration files
            </motion.p>

            {/* Action Buttons */}
            <motion.div
                initial={prefersReducedMotion ? {} : { opacity: 0 }}
                animate={prefersReducedMotion ? {} : { opacity: 1 }}
                transition={prefersReducedMotion ? { duration: 0 } : { delay: 0.3 }}
                className="flex flex-wrap items-center justify-center gap-3 mt-6"
            >
                <Button
                    onClick={onResetClick}
                    variant={showResetConfirm ? 'destructive' : 'outline'}
                    className={showResetConfirm
                        ? 'animate-pulse'
                        : 'border-red-500/30 text-red-300 hover:bg-red-500/20 hover:text-red-200'}
                    title="Reset wizard to defaults"
                >
                    <RotateCcw className={`w-4 h-4 ${showResetConfirm ? 'animate-spin' : ''}`} />
                    {showResetConfirm ? 'Confirm Reset?' : 'Reset'}
                </Button>
                <Button
                    onClick={onProfilesClick}
                    variant="glass"
                    className="text-foreground hover:text-foreground"
                    title="Manage saved profiles"
                >
                    <User className="w-4 h-4" />
                    Profiles
                </Button>
                <Button
                    onClick={onToolsClick}
                    variant="glass"
                    className="text-foreground hover:text-foreground"
                    title="Import/export and templates"
                >
                    <MoreHorizontal className="w-4 h-4" />
                    Tools
                </Button>
            </motion.div>
        </div>
    )
}
