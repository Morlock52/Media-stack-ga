import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown, Check } from 'lucide-react'
import type { UseFormReturn } from 'react-hook-form'

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
}

export function ComboboxInput({
    form,
    name,
    label,
    icon: Icon,
    options,
    placeholder,
    description,
    required
}: ComboboxInputProps) {
    const [isOpen, setIsOpen] = useState(false)
    const containerRef = useRef<HTMLDivElement>(null)
    const { register, setValue, watch, formState: { errors } } = form
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
            <label className="block text-sm font-medium text-gray-300 mb-2">
                {label} {required && <span className="text-red-400">*</span>}
            </label>

            <div className="relative">
                {Icon && (
                    <Icon className="absolute left-3 top-3 w-5 h-5 text-gray-500 z-10" />
                )}

                <input
                    {...register(name)}
                    className={`w-full bg-black/30 border ${error ? 'border-red-500' : 'border-white/10'} rounded-lg py-2.5 ${Icon ? 'pl-11' : 'pl-4'} pr-10 text-white input-focus-glow transition-all`}
                    placeholder={placeholder}
                    onFocus={() => setIsOpen(true)}
                    autoComplete="off"
                />

                <button
                    type="button"
                    onClick={() => setIsOpen(!isOpen)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-gray-500 hover:text-white transition-colors rounded-md hover:bg-white/5"
                >
                    <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                </button>
            </div>

            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ duration: 0.15 }}
                        className="absolute z-50 w-full mt-2 bg-[#1a1b1e] border border-white/10 rounded-xl shadow-xl overflow-hidden backdrop-blur-xl"
                    >
                        <div className="max-h-60 overflow-y-auto custom-scrollbar p-1">
                            {options.map((option) => (
                                <button
                                    key={option.value}
                                    type="button"
                                    onClick={() => handleSelect(option.value)}
                                    className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors flex items-center justify-between group ${currentValue === option.value
                                            ? 'bg-purple-500/20 text-purple-300'
                                            : 'text-gray-300 hover:bg-white/5 hover:text-white'
                                        }`}
                                >
                                    <div>
                                        <div className="font-medium">{option.value}</div>
                                        {(option.label || option.description) && (
                                            <div className="text-xs text-gray-500 group-hover:text-gray-400">
                                                {option.label || option.description}
                                            </div>
                                        )}
                                    </div>
                                    {currentValue === option.value && (
                                        <Check className="w-4 h-4 text-purple-400" />
                                    )}
                                </button>
                            ))}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {error && (
                <p className="mt-1 text-sm text-red-400">{error.message as string}</p>
            )}

            {description && !error && (
                <p className="mt-1 text-xs text-gray-500">{description}</p>
            )}
        </div>
    )
}
