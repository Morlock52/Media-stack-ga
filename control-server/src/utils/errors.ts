/**
 * Error Handling Utilities
 * Provides type-safe error message extraction
 */

/**
 * Safely extract error message from an unknown error
 * Replaces the pattern: catch (err: any) { err.message }
 */
export function getErrorMessage(error: unknown): string {
    if (error instanceof Error) {
        return error.message;
    }
    if (typeof error === 'string') {
        return error;
    }
    if (error && typeof error === 'object' && 'message' in error) {
        return String((error as { message: unknown }).message);
    }
    return 'An unknown error occurred';
}

/**
 * Check if an error has a specific error code
 */
export function hasErrorCode(error: unknown, code: string): boolean {
    if (error && typeof error === 'object' && 'code' in error) {
        return (error as { code: unknown }).code === code;
    }
    return false;
}

/**
 * Check if error message contains a specific string (case-insensitive)
 */
export function errorContains(error: unknown, text: string): boolean {
    const message = getErrorMessage(error).toLowerCase();
    return message.includes(text.toLowerCase());
}

/**
 * Type guard for Error objects
 */
export function isError(error: unknown): error is Error {
    return error instanceof Error;
}
