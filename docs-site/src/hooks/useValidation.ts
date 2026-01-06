/**
 * useValidation - Hook for managing validation state and API calls
 * Handles validation requests with debouncing, auto-refresh, and caching
 */

import { useState, useCallback, useEffect, useRef } from 'react'
import { buildControlServerUrl, controlServerAuthHeaders } from '../utils/controlServer'
import { getErrorMessage } from '../utils/logging'
import type {
    AggregatedValidationResult,
    ValidationRequest,
    ValidatorType,
    ValidatorConfig,
} from '../types/validation'

export interface UseValidationOptions {
    /**
     * Auto-validate when config changes
     * @default false
     */
    autoValidate?: boolean
    /**
     * Debounce delay in milliseconds for auto-validation
     * @default 500
     */
    debounceMs?: number
    /**
     * Bypass cache for validation requests
     * @default false
     */
    bypassCache?: boolean
    /**
     * Callback when validation completes
     */
    onValidationComplete?: (result: AggregatedValidationResult) => void
    /**
     * Callback when validation fails
     */
    onValidationError?: (error: Error) => void
}

export interface UseValidationResult {
    /**
     * Current validation result
     */
    result: AggregatedValidationResult | null
    /**
     * Whether validation is currently in progress
     */
    isValidating: boolean
    /**
     * Error message if validation request failed
     */
    error: string | null
    /**
     * Timestamp of last validation (ISO string)
     */
    lastValidatedAt: string | null
    /**
     * Run full validation with given config
     */
    validate: (request: ValidationRequest) => Promise<void>
    /**
     * Run specific validators only
     */
    validateSpecific: (
        validators: ValidatorType[],
        config: Record<string, unknown>,
        validatorConfigs?: Partial<Record<ValidatorType, ValidatorConfig>>
    ) => Promise<void>
    /**
     * Run quick validation (Docker + paths only)
     */
    quickValidate: (dataRoot?: string, configRoot?: string) => Promise<void>
    /**
     * Clear validation cache on the server
     */
    clearCache: () => Promise<void>
    /**
     * Manually refresh validation with last request
     */
    refresh: () => Promise<void>
    /**
     * Clear current validation state
     */
    clear: () => void
}

/**
 * Hook for managing validation state and API calls
 * @param options Validation options
 * @returns Validation state and control functions
 */
export function useValidation(options: UseValidationOptions = {}): UseValidationResult {
    const {
        autoValidate = false,
        debounceMs = 500,
        bypassCache = false,
        onValidationComplete,
        onValidationError,
    } = options

    const [result, setResult] = useState<AggregatedValidationResult | null>(null)
    const [isValidating, setIsValidating] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [lastValidatedAt, setLastValidatedAt] = useState<string | null>(null)

    // Store last request for refresh functionality
    const lastRequestRef = useRef<ValidationRequest | null>(null)
    const debounceTimerRef = useRef<NodeJS.Timeout | null>(null)
    const abortControllerRef = useRef<AbortController | null>(null)

    /**
     * Core validation function that calls the API
     */
    const runValidation = useCallback(
        async (request: ValidationRequest, endpoint: string = '/api/validate') => {
            // Cancel any pending validation
            if (abortControllerRef.current) {
                abortControllerRef.current.abort()
            }

            // Create new abort controller
            const abortController = new AbortController()
            abortControllerRef.current = abortController

            setIsValidating(true)
            setError(null)
            lastRequestRef.current = request

            try {
                const headers: Record<string, string> = {
                    'Content-Type': 'application/json',
                    ...controlServerAuthHeaders(),
                }

                // Add bypass cache header if requested
                if (bypassCache) {
                    headers['X-Bypass-Cache'] = 'true'
                }

                const response = await fetch(buildControlServerUrl(endpoint), {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(request),
                    signal: abortController.signal,
                })

                if (!response.ok) {
                    const text = await response.text().catch(() => '')
                    throw new Error(
                        `Validation failed (HTTP ${response.status}): ${text || response.statusText}`
                    )
                }

                const data: AggregatedValidationResult = await response.json()
                setResult(data)
                setLastValidatedAt(new Date().toISOString())
                onValidationComplete?.(data)
            } catch (err) {
                // Don't set error if request was aborted
                if (err instanceof Error && err.name === 'AbortError') {
                    return
                }

                const errorMessage = getErrorMessage(err)
                setError(errorMessage)

                if (err instanceof Error) {
                    onValidationError?.(err)
                } else {
                    onValidationError?.(new Error(errorMessage))
                }
            } finally {
                setIsValidating(false)
                abortControllerRef.current = null
            }
        },
        [bypassCache, onValidationComplete, onValidationError]
    )

    /**
     * Run full validation with given config
     */
    const validate = useCallback(
        async (request: ValidationRequest) => {
            await runValidation(request, '/api/validate')
        },
        [runValidation]
    )

    /**
     * Run specific validators only
     */
    const validateSpecific = useCallback(
        async (
            validators: ValidatorType[],
            config: Record<string, unknown>,
            validatorConfigs?: Partial<Record<ValidatorType, ValidatorConfig>>
        ) => {
            const request: ValidationRequest = {
                config,
                validators,
                validatorConfigs,
            }
            await runValidation(request, '/api/validate')
        },
        [runValidation]
    )

    /**
     * Run quick validation (Docker + paths only)
     */
    const quickValidate = useCallback(
        async (dataRoot?: string, configRoot?: string) => {
            try {
                setIsValidating(true)
                setError(null)

                const headers: Record<string, string> = {
                    ...controlServerAuthHeaders(),
                }

                const url = new URL(buildControlServerUrl('/api/validate/quick'))
                if (dataRoot) url.searchParams.set('dataRoot', dataRoot)
                if (configRoot) url.searchParams.set('configRoot', configRoot)

                const response = await fetch(url.toString(), {
                    method: 'GET',
                    headers,
                })

                if (!response.ok) {
                    const text = await response.text().catch(() => '')
                    throw new Error(
                        `Quick validation failed (HTTP ${response.status}): ${text || response.statusText}`
                    )
                }

                const data: AggregatedValidationResult = await response.json()
                setResult(data)
                setLastValidatedAt(new Date().toISOString())
                onValidationComplete?.(data)
            } catch (err) {
                const errorMessage = getErrorMessage(err)
                setError(errorMessage)

                if (err instanceof Error) {
                    onValidationError?.(err)
                } else {
                    onValidationError?.(new Error(errorMessage))
                }
            } finally {
                setIsValidating(false)
            }
        },
        [onValidationComplete, onValidationError]
    )

    /**
     * Clear validation cache on the server
     */
    const clearCache = useCallback(async () => {
        try {
            const response = await fetch(buildControlServerUrl('/api/validate/clear-cache'), {
                method: 'POST',
                headers: {
                    ...controlServerAuthHeaders(),
                },
            })

            if (!response.ok) {
                const text = await response.text().catch(() => '')
                throw new Error(
                    `Failed to clear cache (HTTP ${response.status}): ${text || response.statusText}`
                )
            }
        } catch (err) {
            const errorMessage = getErrorMessage(err)
            setError(errorMessage)

            if (err instanceof Error) {
                onValidationError?.(err)
            } else {
                onValidationError?.(new Error(errorMessage))
            }
        }
    }, [onValidationError])

    /**
     * Manually refresh validation with last request
     */
    const refresh = useCallback(async () => {
        if (lastRequestRef.current) {
            await runValidation(lastRequestRef.current)
        }
    }, [runValidation])

    /**
     * Clear current validation state
     */
    const clear = useCallback(() => {
        setResult(null)
        setError(null)
        setLastValidatedAt(null)
        lastRequestRef.current = null

        // Clear any pending debounce timer
        if (debounceTimerRef.current) {
            clearTimeout(debounceTimerRef.current)
            debounceTimerRef.current = null
        }

        // Abort any in-flight request
        if (abortControllerRef.current) {
            abortControllerRef.current.abort()
            abortControllerRef.current = null
        }
    }, [])

    /**
     * Auto-validate with debouncing when enabled
     */
    const debouncedValidate = useCallback(
        (request: ValidationRequest) => {
            // Clear any existing timer
            if (debounceTimerRef.current) {
                clearTimeout(debounceTimerRef.current)
            }

            // Set new timer
            debounceTimerRef.current = setTimeout(() => {
                validate(request)
                debounceTimerRef.current = null
            }, debounceMs)
        },
        [validate, debounceMs]
    )

    /**
     * Cleanup on unmount
     */
    useEffect(() => {
        return () => {
            // Clean up timers and abort controllers
            if (debounceTimerRef.current) {
                clearTimeout(debounceTimerRef.current)
            }
            if (abortControllerRef.current) {
                abortControllerRef.current.abort()
            }
        }
    }, [])

    return {
        result,
        isValidating,
        error,
        lastValidatedAt,
        validate,
        validateSpecific,
        quickValidate,
        clearCache,
        refresh,
        clear,
    }
}
