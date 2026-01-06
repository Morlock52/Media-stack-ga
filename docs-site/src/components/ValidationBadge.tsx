/**
 * ValidationBadge - Small badge/indicator showing overall validation status
 * Shows error count if issues exist, green checkmark when all validations pass
 * Clickable to trigger manual validation, with tooltip showing summary on hover
 */

import { CheckCircle, AlertCircle, Loader2, RefreshCw } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip'
import type { AggregatedValidationResult } from '../types/validation'
import { getValidationSummary, hasBlockingErrors } from '../types/validation'

export interface ValidationBadgeProps {
    /** Current validation result */
    result: AggregatedValidationResult | null
    /** Whether validation is in progress */
    isValidating?: boolean
    /** Error message if validation request failed */
    error?: string | null
    /** Callback to trigger manual validation */
    onValidate?: () => void
    /** Icon size class override */
    iconClassName?: string
    /** Hide text, show icon only */
    hideText?: boolean
    /** Compact mode - smaller padding */
    compact?: boolean
}

/**
 * ValidationBadge component
 */
export function ValidationBadge({
    result,
    isValidating = false,
    error = null,
    onValidate,
    iconClassName,
    hideText = false,
    compact = false,
}: ValidationBadgeProps) {
    const iconSizeClass = iconClassName ?? 'w-4 h-4'
    const paddingClass = compact ? 'px-2 py-1' : 'px-3 py-1.5'

    // Calculate status
    const isPassed = result?.passed ?? false
    const blocking = hasBlockingErrors(result)
    const summary = getValidationSummary(result)
    const totalIssues = (result?.errorCount ?? 0) + (result?.warningCount ?? 0) + (result?.infoCount ?? 0)

    // Determine badge state
    const isHealthy = !error && !isValidating && isPassed && totalIssues === 0
    const hasIssues = !error && !isValidating && result && totalIssues > 0
    const hasError = !!error
    const isLoading = isValidating && !result

    // Style classes based on state
    const getBadgeStyles = () => {
        if (hasError || blocking) {
            return {
                container: 'bg-red-500/10 border-red-500/25 text-red-200',
                icon: 'text-red-400',
                pulse: 'bg-red-400',
            }
        }
        if (hasIssues && !blocking) {
            return {
                container: 'bg-yellow-500/10 border-yellow-500/25 text-yellow-200',
                icon: 'text-yellow-400',
                pulse: 'bg-yellow-400',
            }
        }
        if (isHealthy) {
            return {
                container: 'bg-emerald-500/10 border-emerald-500/25 text-emerald-200',
                icon: 'text-emerald-400',
                pulse: 'bg-emerald-400',
            }
        }
        // Default/loading state
        return {
            container: 'bg-muted/50 border-border/50 text-muted-foreground',
            icon: 'text-muted-foreground',
            pulse: 'bg-muted-foreground',
        }
    }

    const styles = getBadgeStyles()

    // Badge content
    const BadgeContent = (
        <div
            className={`
                inline-flex items-center gap-2 ${paddingClass} rounded-full text-xs sm:text-sm font-semibold border backdrop-blur-md
                ${styles.container}
                ${onValidate ? 'cursor-pointer hover:opacity-80 transition-opacity' : 'cursor-help'}
            `}
            onClick={onValidate}
            data-testid="validation-badge"
            role={onValidate ? 'button' : 'status'}
            aria-label={onValidate ? 'Trigger validation' : 'Validation status'}
        >
            {/* Icon */}
            {isLoading ? (
                <Loader2 className={`${iconSizeClass} ${styles.icon} animate-spin`} />
            ) : hasError || blocking ? (
                <AlertCircle className={`${iconSizeClass} ${styles.icon}`} />
            ) : hasIssues ? (
                <AlertCircle className={`${iconSizeClass} ${styles.icon}`} />
            ) : isHealthy ? (
                <CheckCircle className={`${iconSizeClass} ${styles.icon}`} />
            ) : (
                <RefreshCw className={`${iconSizeClass} ${styles.icon}`} />
            )}

            {/* Text */}
            {!hideText && (
                <span>
                    {isLoading
                        ? 'Validating...'
                        : hasError
                          ? 'Validation Error'
                          : blocking
                            ? `${result?.errorCount} Error${result?.errorCount !== 1 ? 's' : ''}`
                            : hasIssues
                              ? `${totalIssues} Issue${totalIssues !== 1 ? 's' : ''}`
                              : isHealthy
                                ? 'Validated'
                                : 'Not Validated'}
                </span>
            )}

            {/* Pulse indicator */}
            {!isLoading && (isHealthy || hasIssues || hasError) && (
                <span className="relative flex h-2 w-2 ml-1">
                    <span
                        className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${styles.pulse}`}
                    ></span>
                    <span className={`relative inline-flex rounded-full h-2 w-2 ${styles.pulse}`}></span>
                </span>
            )}
        </div>
    )

    // Tooltip content
    const TooltipContentElement = (
        <TooltipContent className="bg-popover text-popover-foreground border-border max-w-xs">
            <div className="space-y-2">
                <p className="font-semibold text-sm">Validation Status</p>
                <div className="text-xs space-y-1">
                    {error ? (
                        <div className="text-red-400">{error}</div>
                    ) : isLoading ? (
                        <div className="text-muted-foreground">Running validation checks...</div>
                    ) : result ? (
                        <>
                            <div className="flex justify-between gap-4">
                                <span className="text-muted-foreground">Summary:</span>
                                <span className="font-mono">{summary}</span>
                            </div>
                            {result.errorCount > 0 && (
                                <div className="flex justify-between gap-4">
                                    <span className="text-muted-foreground">Errors:</span>
                                    <span className="font-mono text-red-400">{result.errorCount}</span>
                                </div>
                            )}
                            {result.warningCount > 0 && (
                                <div className="flex justify-between gap-4">
                                    <span className="text-muted-foreground">Warnings:</span>
                                    <span className="font-mono text-yellow-400">
                                        {result.warningCount}
                                    </span>
                                </div>
                            )}
                            {result.infoCount > 0 && (
                                <div className="flex justify-between gap-4">
                                    <span className="text-muted-foreground">Info:</span>
                                    <span className="font-mono text-blue-400">{result.infoCount}</span>
                                </div>
                            )}
                            <div className="flex justify-between gap-4">
                                <span className="text-muted-foreground">Validators:</span>
                                <span className="font-mono">{result.results.length}</span>
                            </div>
                            <div className="flex justify-between gap-4">
                                <span className="text-muted-foreground">Duration:</span>
                                <span className="font-mono">{result.durationMs}ms</span>
                            </div>
                            <div className="text-muted-foreground pt-1 mt-1 border-t border-border">
                                <span>
                                    Checked at {new Date(result.completedAt).toLocaleTimeString()}
                                </span>
                            </div>
                        </>
                    ) : (
                        <div className="text-muted-foreground">
                            {onValidate ? 'Click to run validation' : 'No validation results yet'}
                        </div>
                    )}
                </div>
            </div>
        </TooltipContent>
    )

    return (
        <TooltipProvider>
            <Tooltip delayDuration={200}>
                <TooltipTrigger asChild>{BadgeContent}</TooltipTrigger>
                {TooltipContentElement}
            </Tooltip>
        </TooltipProvider>
    )
}
