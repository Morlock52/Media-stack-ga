/**
 * Configuration Applier Service
 * Safely applies configuration fixes with backup, validation, and rollback support
 * Handles .env files, docker-compose.yml changes, and service restarts
 * Updated: January 2026
 */

import { readFile, writeFile, mkdir, copyFile, unlink, stat } from 'fs/promises';
import { join } from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { randomBytes } from 'crypto';
import { PROJECT_ROOT, readEnvFile, writeEnvFile } from '../utils/env.js';
import { createLogger } from '../utils/logger.js';
import { getErrorMessage } from '../utils/errors.js';
import type { ConfigFix, ConfigChange } from './configFixGenerator.js';

const logger = createLogger('configApplier');
const execFileAsync = promisify(execFile);

const BACKUPS_DIR = join(PROJECT_ROOT, 'data', 'config-backups');
const DOCKER_COMPOSE_PATH = join(PROJECT_ROOT, 'docker-compose.yml');
const ENV_PATH = join(PROJECT_ROOT, '.env');

/**
 * Application result for a configuration fix
 */
export interface ApplyResult {
    /** Whether the application was successful */
    success: boolean;
    /** Backup ID (for rollback if needed) */
    backupId?: string;
    /** Applied changes */
    appliedChanges: ConfigChange[];
    /** Services that were restarted */
    restartedServices?: string[];
    /** Error message if failed */
    error?: string;
    /** Validation results */
    validation?: ValidationResult;
    /** Rollback information */
    rollbackInfo?: RollbackInfo;
}

/**
 * Validation result after applying changes
 */
export interface ValidationResult {
    /** Whether validation passed */
    passed: boolean;
    /** Validation checks performed */
    checks: Array<{
        name: string;
        passed: boolean;
        message?: string;
    }>;
    /** Overall validation message */
    message: string;
}

/**
 * Rollback information
 */
export interface RollbackInfo {
    /** Backup ID to restore */
    backupId: string;
    /** Files backed up */
    backedUpFiles: string[];
    /** Rollback instructions */
    instructions: string[];
}

/**
 * Backup metadata
 */
interface BackupMetadata {
    /** Backup ID */
    id: string;
    /** Timestamp of backup */
    timestamp: string;
    /** Fix that triggered this backup */
    fixId: string;
    /** Files backed up */
    files: Array<{
        original: string;
        backup: string;
    }>;
    /** Whether this backup is still valid */
    valid: boolean;
}

/**
 * Options for applying a fix
 */
export interface ApplyOptions {
    /** Whether to automatically restart services */
    autoRestart?: boolean;
    /** Whether to run validation after applying */
    validate?: boolean;
    /** Custom validation timeout in ms */
    validationTimeout?: number;
    /** Dry run mode - don't actually apply changes */
    dryRun?: boolean;
}

/**
 * Ensure backup directory exists
 */
async function ensureBackupDir(): Promise<void> {
    try {
        await mkdir(BACKUPS_DIR, { recursive: true });
    } catch {
        /* exists */
    }
}

/**
 * Generate a unique backup ID
 */
function generateBackupId(): string {
    return `backup_${Date.now()}_${randomBytes(4).toString('hex')}`;
}

/**
 * Get backup directory path for a backup ID
 */
function getBackupDir(backupId: string): string {
    return join(BACKUPS_DIR, backupId);
}

/**
 * Create backup of configuration files
 */
async function createBackup(fix: ConfigFix): Promise<BackupMetadata> {
    await ensureBackupDir();
    const backupId = generateBackupId();
    const backupDir = getBackupDir(backupId);

    await mkdir(backupDir, { recursive: true });

    const metadata: BackupMetadata = {
        id: backupId,
        timestamp: new Date().toISOString(),
        fixId: fix.id,
        files: [],
        valid: true
    };

    // Backup each file specified in the fix
    for (const file of fix.backup.filesToBackup) {
        const sourcePath = join(PROJECT_ROOT, file);
        const backupFileName = file.replace(/[/\\]/g, '_');
        const backupPath = join(backupDir, backupFileName);

        try {
            // Check if source file exists
            await stat(sourcePath);
            await copyFile(sourcePath, backupPath);
            metadata.files.push({
                original: file,
                backup: backupPath
            });
            logger.debug({ file, backupPath }, 'Backed up configuration file');
        } catch (error) {
            // File doesn't exist yet - that's OK for new files
            logger.debug({ file, error: getErrorMessage(error) }, 'Source file does not exist (may be new)');
        }
    }

    // Save metadata
    const metadataPath = join(backupDir, '_metadata.json');
    await writeFile(metadataPath, JSON.stringify(metadata, null, 2));

    logger.info({ backupId, fileCount: metadata.files.length }, 'Created configuration backup');
    return metadata;
}

/**
 * Restore configuration from backup
 */
export async function restoreBackup(backupId: string): Promise<boolean> {
    try {
        const backupDir = getBackupDir(backupId);
        const metadataPath = join(backupDir, '_metadata.json');

        // Load metadata
        const metadataContent = await readFile(metadataPath, 'utf-8');
        const metadata: BackupMetadata = JSON.parse(metadataContent);

        if (!metadata.valid) {
            throw new Error('Backup is marked as invalid');
        }

        // Restore each file
        for (const fileInfo of metadata.files) {
            const sourcePath = fileInfo.backup;
            const targetPath = join(PROJECT_ROOT, fileInfo.original);

            await copyFile(sourcePath, targetPath);
            logger.debug({ file: fileInfo.original }, 'Restored file from backup');
        }

        logger.info({ backupId, fileCount: metadata.files.length }, 'Restored configuration from backup');
        return true;
    } catch (error) {
        logger.error({ backupId, error: getErrorMessage(error) }, 'Failed to restore backup');
        return false;
    }
}

/**
 * Delete a backup
 */
export async function deleteBackup(backupId: string): Promise<boolean> {
    try {
        const backupDir = getBackupDir(backupId);
        const metadataPath = join(backupDir, '_metadata.json');

        // Load metadata to get file list
        const metadataContent = await readFile(metadataPath, 'utf-8');
        const metadata: BackupMetadata = JSON.parse(metadataContent);

        // Delete backup files
        for (const fileInfo of metadata.files) {
            try {
                await unlink(fileInfo.backup);
            } catch {
                /* file may not exist */
            }
        }

        // Delete metadata
        await unlink(metadataPath);

        logger.info({ backupId }, 'Deleted backup');
        return true;
    } catch (error) {
        logger.error({ backupId, error: getErrorMessage(error) }, 'Failed to delete backup');
        return false;
    }
}

/**
 * Apply environment variable changes to .env file
 */
async function applyEnvChanges(changes: ConfigChange[]): Promise<void> {
    const envChanges = changes.filter(c => c.type === 'env');
    if (envChanges.length === 0) return;

    // Read current .env content
    let envContent = readEnvFile();
    const lines = envContent.split('\n');

    // Apply each change
    for (const change of envChanges) {
        const { key, newValue } = change;
        let updated = false;

        // Try to update existing line
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            if (line.startsWith(`${key}=`) || line.startsWith(`# ${key}=`)) {
                lines[i] = `${key}=${newValue}`;
                updated = true;
                logger.debug({ key, newValue }, 'Updated environment variable');
                break;
            }
        }

        // Add new line if not found
        if (!updated) {
            lines.push(`${key}=${newValue}`);
            logger.debug({ key, newValue }, 'Added new environment variable');
        }
    }

    // Write back to .env
    writeEnvFile(lines.join('\n') + '\n');
    logger.info({ changeCount: envChanges.length }, 'Applied environment variable changes');
}

/**
 * Apply docker-compose changes
 * NOTE: This is a basic implementation that appends/updates simple YAML structures
 * For complex docker-compose modifications, manual editing may be required
 */
async function applyComposeChanges(changes: ConfigChange[]): Promise<void> {
    const composeChanges = changes.filter(c => c.type === 'compose');
    if (composeChanges.length === 0) return;

    logger.warn(
        { changeCount: composeChanges.length },
        'Docker-compose changes detected. Automatic application is limited - manual review recommended'
    );

    // For safety, we log the changes but don't automatically modify docker-compose.yml
    // Users should apply these changes manually or via the generated instructions
    for (const change of composeChanges) {
        logger.info({
            key: change.key,
            newValue: change.newValue,
            description: change.description
        }, 'Docker-compose change to apply manually');
    }

    // Note: Full implementation would parse YAML, modify structure, and write back
    // For now, we rely on the fix instructions for docker-compose changes
}

/**
 * Restart Docker services
 */
async function restartServices(services: string[]): Promise<boolean> {
    if (services.length === 0) return true;

    try {
        logger.info({ services }, 'Restarting Docker services');

        // Run docker-compose restart
        const { stdout, stderr } = await execFileAsync('docker-compose', [
            '-f',
            DOCKER_COMPOSE_PATH,
            'restart',
            ...services
        ], {
            cwd: PROJECT_ROOT,
            timeout: 60000 // 60 second timeout
        });

        logger.debug({ stdout, stderr }, 'Docker-compose restart output');
        logger.info({ services }, 'Successfully restarted Docker services');
        return true;
    } catch (error) {
        logger.error({ services, error: getErrorMessage(error) }, 'Failed to restart Docker services');
        return false;
    }
}

/**
 * Validate that services are running after changes
 */
async function validateServices(services: string[], timeout = 30000): Promise<ValidationResult> {
    const checks: ValidationResult['checks'] = [];

    try {
        // Give services time to start
        await new Promise(resolve => setTimeout(resolve, 5000));

        // Check service status
        const { stdout } = await execFileAsync('docker-compose', [
            '-f',
            DOCKER_COMPOSE_PATH,
            'ps',
            '--services',
            '--filter',
            'status=running'
        ], {
            cwd: PROJECT_ROOT,
            timeout
        });

        const runningServices = stdout.trim().split('\n').filter(s => s.length > 0);

        // Check each service
        for (const service of services) {
            const isRunning = runningServices.includes(service);
            checks.push({
                name: `Service ${service} running`,
                passed: isRunning,
                message: isRunning ? `${service} is running` : `${service} is not running`
            });
        }

        const allPassed = checks.every(c => c.passed);
        return {
            passed: allPassed,
            checks,
            message: allPassed
                ? 'All services validated successfully'
                : 'Some services failed validation'
        };
    } catch (error) {
        logger.error({ error: getErrorMessage(error) }, 'Validation failed');
        return {
            passed: false,
            checks,
            message: `Validation error: ${getErrorMessage(error)}`
        };
    }
}

/**
 * Apply a configuration fix
 */
export async function applyConfigFix(
    fix: ConfigFix,
    options: ApplyOptions = {}
): Promise<ApplyResult> {
    const {
        autoRestart = true,
        validate = true,
        validationTimeout = 30000,
        dryRun = false
    } = options;

    const result: ApplyResult = {
        success: false,
        appliedChanges: []
    };

    try {
        logger.info({ fixId: fix.id, title: fix.title, dryRun }, 'Applying configuration fix');

        // Step 1: Create backup if required
        let backupMetadata: BackupMetadata | undefined;
        if (fix.backup.required && !dryRun) {
            backupMetadata = await createBackup(fix);
            result.backupId = backupMetadata.id;
            result.rollbackInfo = {
                backupId: backupMetadata.id,
                backedUpFiles: backupMetadata.files.map(f => f.original),
                instructions: fix.rollback.manualSteps
            };
        }

        if (dryRun) {
            logger.info({ fixId: fix.id }, 'Dry run mode - skipping actual changes');
            result.success = true;
            result.appliedChanges = fix.changes;
            return result;
        }

        // Step 2: Apply environment variable changes
        try {
            await applyEnvChanges(fix.changes);
            result.appliedChanges.push(...fix.changes.filter(c => c.type === 'env'));
        } catch (error) {
            logger.error({ error: getErrorMessage(error) }, 'Failed to apply environment changes');
            // Try to rollback
            if (backupMetadata) {
                await restoreBackup(backupMetadata.id);
            }
            result.error = `Failed to apply environment changes: ${getErrorMessage(error)}`;
            return result;
        }

        // Step 3: Apply docker-compose changes (logged for manual application)
        try {
            await applyComposeChanges(fix.changes);
            // Note: docker-compose changes are not automatically applied for safety
            // They are included in appliedChanges for tracking but require manual review
            const composeChanges = fix.changes.filter(c => c.type === 'compose');
            if (composeChanges.length > 0) {
                logger.warn('Docker-compose changes require manual application');
            }
        } catch (error) {
            logger.error({ error: getErrorMessage(error) }, 'Failed to process docker-compose changes');
            // Don't fail the whole operation for this
        }

        // Step 4: Restart services if required
        if (fix.requiresRestart && fix.servicesToRestart && autoRestart) {
            const restartSuccess = await restartServices(fix.servicesToRestart);
            if (restartSuccess) {
                result.restartedServices = fix.servicesToRestart;
            } else {
                logger.warn({ services: fix.servicesToRestart }, 'Failed to restart some services');
                result.error = 'Failed to restart services - manual restart may be required';
                // Don't fail completely - changes were applied
            }
        }

        // Step 5: Validate if requested
        if (validate && fix.servicesToRestart && fix.servicesToRestart.length > 0) {
            result.validation = await validateServices(fix.servicesToRestart, validationTimeout);
            if (!result.validation.passed) {
                logger.warn({ validation: result.validation }, 'Validation failed after applying fix');
                // Offer rollback information but don't auto-rollback
                result.error = 'Validation failed - review logs and consider rollback if needed';
            }
        }

        // Success!
        result.success = true;
        logger.info({
            fixId: fix.id,
            changeCount: result.appliedChanges.length,
            restartedServices: result.restartedServices
        }, 'Successfully applied configuration fix');

    } catch (error) {
        logger.error({ fixId: fix.id, error: getErrorMessage(error) }, 'Failed to apply configuration fix');
        result.error = getErrorMessage(error);
        result.success = false;
    }

    return result;
}

/**
 * Test a configuration fix in dry-run mode
 */
export async function testConfigFix(fix: ConfigFix): Promise<ApplyResult> {
    return applyConfigFix(fix, { dryRun: true, validate: false });
}

/**
 * Get list of available backups
 */
export async function listBackups(): Promise<BackupMetadata[]> {
    try {
        await ensureBackupDir();
        const entries = await readdir(BACKUPS_DIR, { withFileTypes: true });
        const backups: BackupMetadata[] = [];

        for (const entry of entries) {
            if (!entry.isDirectory()) continue;

            const metadataPath = join(BACKUPS_DIR, entry.name, '_metadata.json');
            try {
                const content = await readFile(metadataPath, 'utf-8');
                const metadata: BackupMetadata = JSON.parse(content);
                backups.push(metadata);
            } catch {
                // Skip invalid backups
            }
        }

        // Sort by timestamp descending
        backups.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        return backups;
    } catch (error) {
        logger.error({ error: getErrorMessage(error) }, 'Failed to list backups');
        return [];
    }
}

/**
 * Clean up old backups (keep only the most recent N)
 */
export async function cleanupOldBackups(keepCount = 10): Promise<number> {
    try {
        const backups = await listBackups();
        if (backups.length <= keepCount) return 0;

        const toDelete = backups.slice(keepCount);
        let deletedCount = 0;

        for (const backup of toDelete) {
            const success = await deleteBackup(backup.id);
            if (success) deletedCount++;
        }

        logger.info({ deletedCount, keepCount }, 'Cleaned up old backups');
        return deletedCount;
    } catch (error) {
        logger.error({ error: getErrorMessage(error) }, 'Failed to cleanup old backups');
        return 0;
    }
}

/**
 * Validate that a fix can be safely applied
 */
export async function validateFix(fix: ConfigFix): Promise<{
    canApply: boolean;
    warnings: string[];
    errors: string[];
}> {
    const warnings: string[] = [];
    const errors: string[] = [];

    // Check if files exist
    for (const file of fix.backup.filesToBackup) {
        const filePath = join(PROJECT_ROOT, file);
        try {
            await stat(filePath);
        } catch {
            if (file === '.env') {
                // .env might not exist yet
                warnings.push(`${file} does not exist - will be created`);
            } else {
                errors.push(`Required file ${file} does not exist`);
            }
        }
    }

    // Check risk level
    if (fix.riskLevel === 'high' || fix.riskLevel === 'critical') {
        warnings.push(`This fix has ${fix.riskLevel} risk level - ensure you have backups`);
    }

    // Check if docker-compose is available
    try {
        await execFileAsync('docker-compose', ['--version'], { timeout: 5000 });
    } catch {
        if (fix.requiresRestart) {
            errors.push('docker-compose is not available but service restart is required');
        }
    }

    const canApply = errors.length === 0;
    return { canApply, warnings, errors };
}
