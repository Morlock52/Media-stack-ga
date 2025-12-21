type LogLevel = 'debug' | 'info' | 'warn' | 'error'

const envFlag = (key: string) =>
    typeof import.meta !== 'undefined' && import.meta.env && key in import.meta.env
        ? String((import.meta.env as Record<string, unknown>)[key] ?? '')
        : ''

const isDebugEnabled = () => {
    const v = envFlag('VITE_DEBUG_LOGGING').toLowerCase()
    if (v === '1' || v === 'true' || v === 'yes') return true
    return Boolean(import.meta.env?.DEV)
}

const isSensitiveKey = (key: string) => {
    const k = key.toLowerCase()
    return (
        k.includes('password') ||
        k.includes('privatekey') ||
        k.includes('secret') ||
        k.includes('token') ||
        k === 'authorization' ||
        k.includes('apikey')
    )
}

export const redactSecrets = (value: unknown): unknown => {
    if (value === null || value === undefined) return value

    if (value instanceof Error) {
        const err = value as Error & { cause?: unknown }
        return {
            name: err.name,
            message: err.message,
            stack: err.stack,
            cause: err.cause ? redactSecrets(err.cause) : undefined,
        }
    }

    if (Array.isArray(value)) return value.map(redactSecrets)

    if (typeof value === 'object') {
        const out: Record<string, unknown> = {}
        for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
            out[k] = isSensitiveKey(k) ? '[redacted]' : redactSecrets(v)
        }
        return out
    }

    return value
}

export const safeStringify = (value: unknown): string => {
    const seen = new WeakSet<object>()
    try {
        return JSON.stringify(
            value,
            (_key, v) => {
                if (typeof v === 'object' && v !== null) {
                    if (seen.has(v as object)) return '[circular]'
                    seen.add(v as object)
                }
                return v
            },
            2
        )
    } catch {
        try {
            return String(value)
        } catch {
            return '[unstringifiable]'
        }
    }
}

export const getErrorMessage = (err: unknown): string => {
    if (err instanceof Error) return err.message
    if (typeof err === 'string') return err

    const redacted = redactSecrets(err)
    const json = safeStringify(redacted)
    return json && json !== '{}' ? json : 'Unknown error'
}

export const log = (level: LogLevel, message: string, meta?: unknown) => {
    const redacted = meta === undefined ? undefined : redactSecrets(meta)

    if (level === 'debug' && !isDebugEnabled()) return

    const fn =
        level === 'debug'
            ? console.debug
            : level === 'info'
              ? console.info
              : level === 'warn'
                ? console.warn
                : console.error

    if (redacted === undefined) fn(message)
    else fn(message, redacted)
}
