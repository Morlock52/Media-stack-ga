/**
 * ValidationPanel - Main UI component for displaying validation results
 * Shows validation issues grouped by severity with expandable details
 */

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
    AlertCircle,
    CheckCircle,
    ChevronDown,
    ChevronRight,
    Info,
    Loader2,
    RefreshCw,
    Shield,
    XCircle,
} from 'lucide-react'
import type {
    AggregatedValidationResult,
    ValidationIssue,
    ValidationSeverity,
} from '../types/validation'
import {
    getAllIssues,
    getValidationSummary,
    groupIssuesBySeverity,
    hasBlockingErrors,
} from '../types/validation'

export interface ValidationPanelProps {
    /** Current validation result */
    result: AggregatedValidationResult | null
    /** Whether validation is in progress */
    isValidating?: boolean
    /** Error message if validation request failed */
    error?: string | null
    /** Callback to trigger manual refresh */
    onRefresh?: () => void
    /** Show refresh button */
    showRefreshButton?: boolean
    /** Compact mode - hide details by default */
    compact?: boolean
}

/**
 * Get severity icon component
 */
function getSeverityIcon(severity: ValidationSeverity, className?: string) {
    switch (severity) {
        case 'error':
            return <XCircle className={className || 'w-4 h-4'} />
        case 'warning':
            return <AlertCircle className={className || 'w-4 h-4'} />
        case 'info':
            return <Info className={className || 'w-4 h-4'} />
    }
}

/**
 * Get severity color classes
 */
function getSeverityColors(severity: ValidationSeverity) {
    switch (severity) {
        case 'error':
            return {
                bg: 'bg-red-500/5',
                border: 'border-red-500/30',
                text: 'text-red-400',
                icon: 'text-red-400',
                badge: 'bg-red-500/20 border-red-500/40',
            }
        case 'warning':
            return {
                bg: 'bg-yellow-500/5',
                border: 'border-yellow-500/30',
                text: 'text-yellow-400',
                icon: 'text-yellow-400',
                badge: 'bg-yellow-500/20 border-yellow-500/40',
            }
        case 'info':
            return {
                bg: 'bg-blue-500/5',
                border: 'border-blue-500/30',
                text: 'text-blue-400',
                icon: 'text-blue-400',
                badge: 'bg-blue-500/20 border-blue-500/40',
            }
    }
}

/**
 * Get validator display name
 */
function getValidatorDisplayName(validator: string): string {
    const names: Record<string, string> = {
        path: 'Path Configuration',
        port: 'Port Availability',
        vpn: 'VPN Credentials',
        cloudflare: 'Cloudflare Tunnel',
        docker: 'Docker Environment',
        environment: 'System Environment',
    }
    return names[validator] || validator
}

/**
 * ValidationIssueCard - Individual issue card with expandable details
 */
interface ValidationIssueCardProps {
    issue: ValidationIssue
    index: number
}

function ValidationIssueCard({ issue, index }: ValidationIssueCardProps) {
    const [expanded, setExpanded] = useState(false)
    const colors = getSeverityColors(issue.severity)
    const hasDetails = issue.fixSuggestion || issue.affectedField || issue.details

    return (
        <motion.div
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            className={`rounded-lg border ${colors.border} ${colors.bg} overflow-hidden`}
        >
            <div className="flex items-start gap-3 p-3">
                {/* Severity icon */}
                <div className={`flex-shrink-0 ${colors.icon}`}>
                    {getSeverityIcon(issue.severity)}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium ${colors.text}`}>{issue.message}</p>

                    {issue.affectedField && (
                        <p className="text-xs text-muted-foreground mt-1">
                            Field: <code className="text-xs">{issue.affectedField}</code>
                        </p>
                    )}

                    {/* Expandable fix suggestion */}
                    {hasDetails && (
                        <AnimatePresence>
                            {expanded && (
                                <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: 'auto', opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    className="overflow-hidden"
                                >
                                    <div className="mt-3 pt-3 border-t border-border/30 space-y-2">
                                        {issue.fixSuggestion && (
                                            <div>
                                                <p className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1">
                                                    <Shield className="w-3 h-3" />
                                                    Suggested Fix:
                                                </p>
                                                <p className="text-xs text-foreground bg-background/40 rounded p-2">
                                                    {issue.fixSuggestion}
                                                </p>
                                            </div>
                                        )}

                                        {issue.details && Object.keys(issue.details).length > 0 && (
                                            <div>
                                                <p className="text-xs font-medium text-muted-foreground mb-1">
                                                    Additional Details:
                                                </p>
                                                <div className="text-xs text-foreground bg-background/40 rounded p-2 space-y-1">
                                                    {Object.entries(issue.details).map(([key, value]) => (
                                                        <div key={key} className="flex gap-2">
                                                            <span className="text-muted-foreground">{key}:</span>
                                                            <span className="font-mono">
                                                                {typeof value === 'object'
                                                                    ? JSON.stringify(value)
                                                                    : String(value)}
                                                            </span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    )}
                </div>

                {/* Expand/collapse button */}
                {hasDetails && (
                    <button
                        onClick={() => setExpanded(!expanded)}
                        className="flex-shrink-0 p-1 hover:bg-white/10 rounded transition-colors"
                        aria-label={expanded ? 'Collapse details' : 'Expand details'}
                    >
                        {expanded ? (
                            <ChevronDown className="w-4 h-4 text-muted-foreground" />
                        ) : (
                            <ChevronRight className="w-4 h-4 text-muted-foreground" />
                        )}
                    </button>
                )}
            </div>
        </motion.div>
    )
}

/**
 * ValidationPanel - Main validation results display component
 */
export function ValidationPanel({
    result,
    isValidating = false,
    error = null,
    onRefresh,
    showRefreshButton = true,
    compact = false,
}: ValidationPanelProps) {
    const [expandedSeverity, setExpandedSeverity] = useState<ValidationSeverity | null>(
        compact ? null : 'error'
    )

    // Loading state
    if (isValidating && !result) {
        return (
            <div className="rounded-lg border border-border/50 bg-card/50 p-6">
                <div className="flex items-center justify-center gap-2 text-muted-foreground">
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Running validation checks...</span>
                </div>
            </div>
        )
    }

    // Error state
    if (error && !result) {
        return (
            <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-6">
                <div className="flex items-center gap-2 text-red-400 mb-3">
                    <AlertCircle className="w-5 h-5" />
                    <span className="font-medium">Validation Failed</span>
                </div>
                <p className="text-sm text-muted-foreground mb-3">{error}</p>
                {onRefresh && (
                    <button
                        onClick={onRefresh}
                        className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
                    >
                        <RefreshCw className="w-4 h-4" /> Retry
                    </button>
                )}
            </div>
        )
    }

    // No results yet
    if (!result) {
        return (
            <div className="rounded-lg border border-border/50 bg-card/50 p-6">
                <div className="text-center text-muted-foreground">
                    <p className="mb-3">No validation results yet</p>
                    {onRefresh && (
                        <button
                            onClick={onRefresh}
                            className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
                        >
                            <RefreshCw className="w-4 h-4" /> Run Validation
                        </button>
                    )}
                </div>
            </div>
        )
    }

    const grouped = groupIssuesBySeverity(result)
    const allIssues = getAllIssues(result)
    const summary = getValidationSummary(result)
    const blocking = hasBlockingErrors(result)

    // All passed - success state
    if (result.passed && allIssues.length === 0) {
        return (
            <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-6">
                <div className="flex items-center gap-3">
                    <CheckCircle className="w-6 h-6 text-emerald-400" />
                    <div className="flex-1">
                        <h4 className="font-semibold text-foreground">All Validations Passed</h4>
                        <p className="text-sm text-muted-foreground mt-1">
                            Your configuration is ready for deployment
                        </p>
                    </div>
                    {showRefreshButton && onRefresh && (
                        <button
                            onClick={onRefresh}
                            disabled={isValidating}
                            className="p-2 rounded hover:bg-white/10 text-muted-foreground hover:text-foreground transition-colors"
                            title="Refresh validation"
                        >
                            <RefreshCw
                                className={`w-4 h-4 ${isValidating ? 'animate-spin' : ''}`}
                            />
                        </button>
                    )}
                </div>
            </div>
        )
    }

    // Has issues - display grouped by severity
    return (
        <div className="rounded-lg border border-border/50 bg-card/50 overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-border/30">
                <div className="flex items-center gap-3">
                    {blocking ? (
                        <AlertCircle className="w-5 h-5 text-red-400" />
                    ) : (
                        <AlertCircle className="w-5 h-5 text-yellow-400" />
                    )}
                    <div>
                        <h4 className="font-semibold text-foreground">Validation Results</h4>
                        <p className="text-sm text-muted-foreground">{summary}</p>
                    </div>
                </div>

                {showRefreshButton && onRefresh && (
                    <button
                        onClick={onRefresh}
                        disabled={isValidating}
                        className="p-2 rounded hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                        title="Refresh validation"
                    >
                        <RefreshCw className={`w-4 h-4 ${isValidating ? 'animate-spin' : ''}`} />
                    </button>
                )}
            </div>

            {/* Issues grouped by severity */}
            <div className="divide-y divide-border/30">
                {/* Errors */}
                {grouped.errors.length > 0 && (
                    <div>
                        <button
                            onClick={() =>
                                setExpandedSeverity(
                                    expandedSeverity === 'error' ? null : 'error'
                                )
                            }
                            className="w-full flex items-center justify-between p-4 hover:bg-red-500/5 transition-colors"
                        >
                            <div className="flex items-center gap-3">
                                <XCircle className="w-4 h-4 text-red-400" />
                                <span className="font-medium text-foreground">Errors</span>
                                <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-500/20 text-red-300 border border-red-500/40">
                                    {grouped.errors.length}
                                </span>
                            </div>
                            {expandedSeverity === 'error' ? (
                                <ChevronDown className="w-4 h-4 text-muted-foreground" />
                            ) : (
                                <ChevronRight className="w-4 h-4 text-muted-foreground" />
                            )}
                        </button>

                        <AnimatePresence>
                            {expandedSeverity === 'error' && (
                                <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: 'auto', opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    className="overflow-hidden"
                                >
                                    <div className="p-4 pt-0 space-y-2">
                                        {grouped.errors.map((issue, index) => (
                                            <ValidationIssueCard
                                                key={`${issue.code}-${index}`}
                                                issue={issue}
                                                index={index}
                                            />
                                        ))}
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                )}

                {/* Warnings */}
                {grouped.warnings.length > 0 && (
                    <div>
                        <button
                            onClick={() =>
                                setExpandedSeverity(
                                    expandedSeverity === 'warning' ? null : 'warning'
                                )
                            }
                            className="w-full flex items-center justify-between p-4 hover:bg-yellow-500/5 transition-colors"
                        >
                            <div className="flex items-center gap-3">
                                <AlertCircle className="w-4 h-4 text-yellow-400" />
                                <span className="font-medium text-foreground">Warnings</span>
                                <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-500/20 text-yellow-300 border border-yellow-500/40">
                                    {grouped.warnings.length}
                                </span>
                            </div>
                            {expandedSeverity === 'warning' ? (
                                <ChevronDown className="w-4 h-4 text-muted-foreground" />
                            ) : (
                                <ChevronRight className="w-4 h-4 text-muted-foreground" />
                            )}
                        </button>

                        <AnimatePresence>
                            {expandedSeverity === 'warning' && (
                                <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: 'auto', opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    className="overflow-hidden"
                                >
                                    <div className="p-4 pt-0 space-y-2">
                                        {grouped.warnings.map((issue, index) => (
                                            <ValidationIssueCard
                                                key={`${issue.code}-${index}`}
                                                issue={issue}
                                                index={index}
                                            />
                                        ))}
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                )}

                {/* Info */}
                {grouped.info.length > 0 && (
                    <div>
                        <button
                            onClick={() =>
                                setExpandedSeverity(expandedSeverity === 'info' ? null : 'info')
                            }
                            className="w-full flex items-center justify-between p-4 hover:bg-blue-500/5 transition-colors"
                        >
                            <div className="flex items-center gap-3">
                                <Info className="w-4 h-4 text-blue-400" />
                                <span className="font-medium text-foreground">Information</span>
                                <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-500/20 text-blue-300 border border-blue-500/40">
                                    {grouped.info.length}
                                </span>
                            </div>
                            {expandedSeverity === 'info' ? (
                                <ChevronDown className="w-4 h-4 text-muted-foreground" />
                            ) : (
                                <ChevronRight className="w-4 h-4 text-muted-foreground" />
                            )}
                        </button>

                        <AnimatePresence>
                            {expandedSeverity === 'info' && (
                                <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: 'auto', opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    className="overflow-hidden"
                                >
                                    <div className="p-4 pt-0 space-y-2">
                                        {grouped.info.map((issue, index) => (
                                            <ValidationIssueCard
                                                key={`${issue.code}-${index}`}
                                                issue={issue}
                                                index={index}
                                            />
                                        ))}
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                )}
            </div>

            {/* Footer with validator summary */}
            <div className="p-4 bg-muted/20 border-t border-border/30">
                <p className="text-xs text-muted-foreground">
                    Validated {result.results.length} component
                    {result.results.length !== 1 ? 's' : ''} in {result.durationMs}ms
                </p>
                <div className="flex flex-wrap gap-2 mt-2">
                    {result.results.map((validatorResult) => (
                        <div
                            key={validatorResult.validator}
                            className={`px-2 py-1 rounded text-xs border ${
                                validatorResult.passed
                                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                                    : 'bg-red-500/10 border-red-500/30 text-red-400'
                            }`}
                        >
                            {validatorResult.passed ? '✓' : '✕'}{' '}
                            {getValidatorDisplayName(validatorResult.validator)}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}
