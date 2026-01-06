/**
 * Path Validator
 * Validates filesystem paths for existence and permissions
 */

import fs from 'fs/promises';
import { constants } from 'fs';
import path from 'path';
import { createLogger } from '../../utils/logger.js';
import type {
    ValidationResult,
    ValidationIssue,
    PathValidationOptions
} from '../../types/validation.js';

const logger = createLogger('pathValidator');

/**
 * Common path misconfiguration patterns from TRaSH Guides
 */
const TRASH_GUIDE_ANTIPATTERNS = [
    {
        pattern: /\/downloads\/(complete|incomplete|movies|tv)/i,
        message: 'Avoid nested folders under /downloads. Use /data/torrents and /data/media instead.',
        fixSuggestion: 'Use /data/torrents for downloads and /data/media/{movies,tv} for final media. See TRaSH Guides hardlinks tutorial.'
    },
    {
        pattern: /\/movies?\/downloads?/i,
        message: 'Downloads should not be inside media folders',
        fixSuggestion: 'Move downloads to /data/torrents and keep media in /data/media/{movies,tv}'
    },
    {
        pattern: /\/downloads?\/movies?/i,
        message: 'Media folders should not be inside downloads',
        fixSuggestion: 'Use separate paths: /data/torrents for downloads, /data/media/movies for final media'
    }
];

/**
 * Validate a single path for existence and permissions
 */
async function validateSinglePath(
    pathToCheck: string,
    fieldName: string,
    checkWrite: boolean
): Promise<ValidationIssue[]> {
    const issues: ValidationIssue[] = [];

    try {
        // Check if path exists
        const stats = await fs.stat(pathToCheck);

        if (!stats.isDirectory()) {
            issues.push({
                code: 'PATH_NOT_DIRECTORY',
                severity: 'error',
                message: `Path is not a directory: ${pathToCheck}`,
                affectedField: fieldName,
                fixSuggestion: `Ensure ${pathToCheck} is a directory, not a file`
            });
            return issues;
        }

        // Check read permissions
        try {
            await fs.access(pathToCheck, constants.R_OK);
        } catch {
            issues.push({
                code: 'PATH_NOT_READABLE',
                severity: 'error',
                message: `Directory is not readable: ${pathToCheck}`,
                affectedField: fieldName,
                fixSuggestion: `Grant read permissions: chmod +r "${pathToCheck}"`,
                details: { path: pathToCheck }
            });
        }

        // Check write permissions if requested
        if (checkWrite) {
            try {
                await fs.access(pathToCheck, constants.W_OK);
            } catch {
                issues.push({
                    code: 'PATH_NOT_WRITABLE',
                    severity: 'error',
                    message: `Directory is not writable: ${pathToCheck}`,
                    affectedField: fieldName,
                    fixSuggestion: `Grant write permissions: chmod +w "${pathToCheck}"`,
                    details: { path: pathToCheck }
                });
            }
        }

        // Check for TRaSH Guides antipatterns
        const normalizedPath = path.normalize(pathToCheck);
        for (const antipattern of TRASH_GUIDE_ANTIPATTERNS) {
            if (antipattern.pattern.test(normalizedPath)) {
                issues.push({
                    code: 'PATH_ANTIPATTERN',
                    severity: 'warning',
                    message: antipattern.message,
                    affectedField: fieldName,
                    fixSuggestion: antipattern.fixSuggestion,
                    details: {
                        path: pathToCheck,
                        pattern: antipattern.pattern.toString()
                    }
                });
            }
        }
    } catch (error) {
        // Path doesn't exist or other stat error
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
            issues.push({
                code: 'PATH_NOT_FOUND',
                severity: 'error',
                message: `Path does not exist: ${pathToCheck}`,
                affectedField: fieldName,
                fixSuggestion: `Create the directory: mkdir -p "${pathToCheck}"`,
                details: { path: pathToCheck }
            });
        } else if ((error as NodeJS.ErrnoException).code === 'EACCES') {
            issues.push({
                code: 'PATH_ACCESS_DENIED',
                severity: 'error',
                message: `Access denied to path: ${pathToCheck}`,
                affectedField: fieldName,
                fixSuggestion: `Check parent directory permissions and ownership`,
                details: {
                    path: pathToCheck,
                    error: (error as Error).message
                }
            });
        } else {
            issues.push({
                code: 'PATH_CHECK_FAILED',
                severity: 'error',
                message: `Failed to check path: ${pathToCheck}`,
                affectedField: fieldName,
                fixSuggestion: 'Verify the path is accessible and correctly formatted',
                details: {
                    path: pathToCheck,
                    error: (error as Error).message
                }
            });
        }
    }

    return issues;
}

/**
 * Validate paths configuration
 */
export async function validatePaths(options: PathValidationOptions): Promise<ValidationResult> {
    const startTime = Date.now();
    logger.debug({ paths: options.paths, checkWrite: options.checkWrite }, 'Starting path validation');

    const allIssues: ValidationIssue[] = [];
    const checkWrite = options.checkWrite ?? true; // Default to checking write permissions

    // Validate each path in the configuration
    for (const [key, pathValue] of Object.entries(options.paths)) {
        if (!pathValue) {
            // Empty path
            allIssues.push({
                code: 'PATH_EMPTY',
                severity: 'error',
                message: `Path is empty or undefined`,
                affectedField: key,
                fixSuggestion: `Provide a valid path for ${key}`
            });
            continue;
        }

        // Validate the path
        const issues = await validateSinglePath(pathValue, key, checkWrite);
        allIssues.push(...issues);
    }

    // Check for common issues across paths
    const pathValues = Object.values(options.paths).filter(Boolean) as string[];
    if (pathValues.length > 1) {
        // Check if any paths are identical (potential misconfiguration)
        const pathSet = new Set(pathValues.map(p => path.normalize(p)));
        if (pathSet.size < pathValues.length) {
            const duplicates = pathValues.filter((p, i, arr) => {
                const normalized = path.normalize(p);
                return arr.findIndex(x => path.normalize(x) === normalized) !== i;
            });

            if (duplicates.length > 0) {
                allIssues.push({
                    code: 'PATH_DUPLICATE',
                    severity: 'warning',
                    message: 'Multiple configuration keys point to the same path',
                    fixSuggestion: 'Ensure each path serves a distinct purpose',
                    details: { duplicatePaths: duplicates }
                });
            }
        }

        // Check for nested paths (one path is inside another)
        for (let i = 0; i < pathValues.length; i++) {
            for (let j = i + 1; j < pathValues.length; j++) {
                const path1 = path.normalize(pathValues[i]);
                const path2 = path.normalize(pathValues[j]);

                if (path1.startsWith(path2 + path.sep) || path2.startsWith(path1 + path.sep)) {
                    allIssues.push({
                        code: 'PATH_NESTED',
                        severity: 'info',
                        message: `Path nesting detected: one path is inside another`,
                        fixSuggestion: 'This is OK if intentional, but verify your folder structure',
                        details: {
                            path1: pathValues[i],
                            path2: pathValues[j]
                        }
                    });
                }
            }
        }
    }

    const passed = allIssues.every(issue => issue.severity !== 'error');
    const duration = Date.now() - startTime;

    logger.debug({
        passed,
        issueCount: allIssues.length,
        durationMs: duration
    }, 'Path validation complete');

    return {
        validator: 'path',
        passed,
        issues: allIssues,
        timestamp: new Date(),
        metadata: {
            pathsChecked: Object.keys(options.paths).length,
            checkWritePermissions: checkWrite,
            durationMs: duration
        }
    };
}
