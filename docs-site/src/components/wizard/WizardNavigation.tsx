import { ArrowLeft, ArrowRight, RotateCcw } from 'lucide-react'
import { Button } from '../ui/button'
import { useSetupStore } from '../../store/setupStore'

interface WizardNavigationProps {
    onNext: () => void
    onPrev: () => void
    onReset: () => void
}

export function WizardNavigation({ onNext, onPrev, onReset }: WizardNavigationProps) {
    const currentStep = useSetupStore((state) => state.currentStep)
    const isFinalStep = currentStep === 5

    return (
        <div className="sticky bottom-4 z-30 mt-8">
            <div className="flex justify-between items-center glass-ultra rounded-2xl border border-border/60 px-4 py-3 backdrop-blur">
                <Button
                    type="button"
                    onClick={onPrev}
                    variant="glass"
                    className="btn-lift px-6 py-3"
                >
                    <ArrowLeft className="w-4 h-4" />
                    Back
                </Button>

                {isFinalStep ? (
                    <Button
                        type="button"
                        onClick={onReset}
                        variant="glass"
                        className="btn-lift px-6 py-3"
                    >
                        <RotateCcw className="w-4 h-4" />
                        Start Over
                    </Button>
                ) : (
                    <Button
                        type="button"
                        onClick={onNext}
                        variant="gradient"
                        className="btn-lift px-6 py-3"
                    >
                        Next
                        <ArrowRight className="w-4 h-4" />
                    </Button>
                )}
            </div>
        </div>
    )
}
