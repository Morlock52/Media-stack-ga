import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown, Check } from 'lucide-react'
import type { UseFormReturn } from 'react-hook-form'
import { cn } from '@/lib/utils'
import { Button } from './button'

interface Option {
    value: string
    label?: string
    description?: string
}

interface ComboboxInputProps {
    form: UseFormReturn<any>
    name: string
    label: string
    icon?: any
    options: Option[]
    placeholder?: string
    description?: string
    required?: boolean
    inputIndex?: number
    registerInput?: (index: number) => (element: HTMLInputElement | null) => void
    handleKeyDown?: (event: React.KeyboardEvent<HTMLInputElement>) => void
    updateCurrentIndex?: (element: HTMLInputElement | null) => void
}

export function ComboboxInput({
    form,
    name,
    label,
    icon: Icon,
    options,
    placeholder,
    description,
    required,
    inputIndex,
    registerInput,
    handleKeyDown,
    updateCurrentIndex
}: ComboboxInputProps) {
    const [isOpen, setIsOpen] = useState(false)
    const containerRef = useRef<HTMLDivElement>(null)
    const { register, setValue, watch, formState: { errors } } = form
    const registerResult = register(name)
    const currentValue = watch(name)
    const error = errors[name]

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    const handleSelect = (value: string) => {
        setValue(name, value, { shouldValidate: true, shouldDirty: true })
        setIsOpen(false)
    }

    return (
        <div className="relative" ref={containerRef}>
            <label className="block text-sm font-medium text-foreground mb-2">
                {label} {required && <span className="text-destructive">*</span>}
            </label>

            <div className="relative">
                {Icon && (
                    <Icon className="absolute left-3 top-3 w-5 h-5 text-muted-foreground z-10" />
                )}

                <input
                    {...registerResult}
                    type="text"
                    ref={(element) => {
                        registerResult.ref(element)
                        if (inputIndex !== undefined && registerInput) {
                            registerInput(inputIndex)(element)
                        }
                    }}
                    onKeyDown={handleKeyDown}
                    onFocus={(e) => {
                        setIsOpen(true)
                        updateCurrentIndex?.(e.target)
                    }}
                    className={cn(
                        "w-full bg-background/60 border rounded-lg py-2.5 pr-10 text-foreground placeholder:text-muted-foreground transition-all backdrop-blur-sm focus:ring-2 focus:ring-primary/20",
                        Icon ? "pl-11" : "pl-4",
                        error ? "border-destructive" : "border-border"
                    )}
                    placeholder={placeholder}
                    autoComplete="off"
                />

                <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => setIsOpen(!isOpen)}
                    className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 text-muted-foreground hover:text-foreground"
                    aria-label={isOpen ? `Close ${label} options` : `Open ${label} options`}
                >
                    <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                </Button>
            </div>

            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ duration: 0.15 }}
                        className="absolute z-50 w-full mt-2 bg-popover border border-border rounded-xl shadow-xl overflow-hidden backdrop-blur-xl"
                    >
                        <div className="max-h-60 overflow-y-auto custom-scrollbar p-1">
                            {options.map((option) => (
                                <button
                                    key={option.value}
                                    type="button"
                                    onClick={() => handleSelect(option.value)}
                                    className={cn(
                                        "w-full text-left px-3 py-2 rounded-lg text-sm transition-colors flex items-center justify-between group",
                                        currentValue === option.value
                                            ? "bg-primary/20 text-primary"
                                            : "text-foreground hover:bg-accent hover:text-accent-foreground"
                                    )}
                                >
                                    <div>
                                        <div className="font-medium">{option.value}</div>
                                        {(option.label || option.description) && (
                                            <div className="text-xs text-muted-foreground">
                                                {option.label || option.description}
                                            </div>
                                        )}
                                    </div>
                                    {currentValue === option.value && (
                                        <Check className="w-4 h-4 text-primary" />
                                    )}
                                </button>
                            ))}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {error && (
                <p className="mt-1 text-sm text-destructive">{error.message as string}</p>
            )}

            {description && !error && (
                <p className="mt-1 text-xs text-muted-foreground">{description}</p>
            )}
        </div>
    )
}
