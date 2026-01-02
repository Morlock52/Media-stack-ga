/**
 * Shared Logger Utility
 * Centralized pino logger configuration for the control server
 */

import pino from 'pino';

/**
 * Create the shared logger instance
 * Uses pino-pretty for development, standard JSON for production
 */
export const logger = pino({
    level: process.env.LOG_LEVEL || 'info',
    transport: {
        target: 'pino-pretty',
        options: { colorize: true }
    }
});

/**
 * Create a child logger with a specific module name
 * Useful for filtering logs by component
 */
export function createLogger(module: string) {
    return logger.child({ module });
}

export default logger;
