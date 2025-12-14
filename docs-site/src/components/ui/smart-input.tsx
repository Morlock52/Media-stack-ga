import { useState, useEffect, forwardRef } from 'react'
import { cn } from '@/lib/utils'
import { Sparkles } from 'lucide-react'

export interface SmartInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  suggestions?: string[]
  autoDetect?: boolean
  detectType?: 'timezone' | 'email' | 'url'
}

const SmartInput = forwardRef<HTMLInputElement, SmartInputProps>(
  ({ className, label, error, suggestions = [], autoDetect = false, detectType, ...props }, ref) => {
    const [value, setValue] = useState(props.value as string || '')
    const [showSuggestions, setShowSuggestions] = useState(false)
    const [detectedValue, setDetectedValue] = useState<string | null>(null)

    // Auto-detect timezone
    useEffect(() => {
      if (autoDetect && detectType === 'timezone' && !value) {
        const detected = Intl.DateTimeFormat().resolvedOptions().timeZone
        setDetectedValue(detected)
        setValue(detected)
      }
    }, [autoDetect, detectType, value])

    const filteredSuggestions = suggestions.filter(s =>
      s.toLowerCase().includes(value.toLowerCase())
    )

    const handleSuggestionClick = (suggestion: string) => {
      setValue(suggestion)
      setShowSuggestions(false)
      if (props.onChange) {
        const event = { target: { value: suggestion, name: props.name } } as React.ChangeEvent<HTMLInputElement>
        props.onChange(event)
      }
    }

    return (
      <div className="space-y-2">
        {label && (
          <label htmlFor={props.id || props.name} className="text-sm font-medium text-foreground">
            {label}
          </label>
        )}

        {detectedValue && detectType === 'timezone' && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1 bg-blue-500/10 text-blue-500 px-2 py-1 rounded">
              <Sparkles className="w-3 h-3" />
              <span>Auto-detected: {detectedValue}</span>
            </span>
          </div>
        )}

        <div className="relative">
          <input
            ref={ref}
            {...props}
            value={value}
            onChange={(e) => {
              setValue(e.target.value)
              if (props.onChange) props.onChange(e)
            }}
            onFocus={() => setShowSuggestions(true)}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
            className={cn(
              "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
              error && "border-destructive focus-visible:ring-destructive",
              className
            )}
            aria-invalid={!!error}
            aria-describedby={error ? `${props.id || props.name}-error` : undefined}
          />

          {showSuggestions && filteredSuggestions.length > 0 && (
            <div className="absolute z-50 w-full mt-1 bg-popover border rounded-md shadow-lg max-h-60 overflow-auto animate-in fade-in-0 zoom-in-95">
              {filteredSuggestions.map((suggestion, i) => (
                <button
                  key={i}
                  type="button"
                  className="w-full px-3 py-2 text-left text-sm hover:bg-accent transition-colors focus:bg-accent focus:outline-none"
                  onClick={() => handleSuggestionClick(suggestion)}
                >
                  {suggestion}
                </button>
              ))}
            </div>
          )}
        </div>

        {error && (
          <p id={`${props.id || props.name}-error`} className="text-sm text-destructive" role="alert">
            {error}
          </p>
        )}
      </div>
    )
  }
)

SmartInput.displayName = 'SmartInput'

export { SmartInput }
