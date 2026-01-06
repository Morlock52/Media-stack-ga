/**
 * Backup Scheduler Service
 * Automated backup scheduling using node-cron with retention policies and health checks
 */

import cron from 'node-cron';
import { randomUUID } from 'crypto';
import { readFile, writeFile, mkdir, unlink } from 'fs/promises';
import { join } from 'path';
import { PROJECT_ROOT } from '../utils/env.js';
import { createLogger } from '../utils/logger.js';
import { getErrorMessage } from '../utils/errors.js';
import type { BackupSchedule, BackupConfig, BackupHistoryEntry } from '../types/backup.js';
import { discoverBackupTargets, createBackupArchive } from './backupService.js';
import { createAdapter } from './backup/destinationAdapter.js';
import { encryptFile } from '../utils/encryption.js';

const logger = createLogger('backupScheduler');

const SCHEDULES_DIR = join(PROJECT_ROOT, 'data', 'schedules');
const SCHEDULES_FILE = join(SCHEDULES_DIR, 'backup_schedules.json');
const TEMP_DIR = join(PROJECT_ROOT, 'data', 'temp');

/**
 * Storage structure for schedules
 */
interface ScheduleStore {
    version: number;
    lastUpdated: string;
    schedules: BackupSchedule[];
}

/**
 * Active cron jobs keyed by schedule ID
 */
const activeCronJobs = new Map<string, cron.ScheduledTask>();

/**
 * In-memory schedule store
 */
let scheduleStore: ScheduleStore = {
    version: 1,
    lastUpdated: new Date().toISOString(),
    schedules: [],
};

/**
 * Last run statistics for health checks
 */
const scheduleHealth = new Map<string, {
    lastAttempt: string;
    lastSuccess?: string;
    lastError?: string;
    consecutiveFailures: number;
}>();

/**
 * Ensure schedules directory exists
 */
async function ensureDir(): Promise<void> {
    try {
        await mkdir(SCHEDULES_DIR, { recursive: true });
        await mkdir(TEMP_DIR, { recursive: true });
    } catch {
        // Directory already exists
    }
}

/**
 * Load schedules from disk
 */
async function loadSchedules(): Promise<void> {
    try {
        await ensureDir();
        const data = await readFile(SCHEDULES_FILE, 'utf-8');
        scheduleStore = JSON.parse(data);
        logger.info({ scheduleCount: scheduleStore.schedules.length }, 'Loaded backup schedules');
    } catch {
        // Start with empty schedules
        scheduleStore = {
            version: 1,
            lastUpdated: new Date().toISOString(),
            schedules: [],
        };
        logger.info('No existing schedules found, starting fresh');
    }
}

/**
 * Save schedules to disk
 */
async function saveSchedules(): Promise<void> {
    try {
        await ensureDir();
        scheduleStore.lastUpdated = new Date().toISOString();
        await writeFile(SCHEDULES_FILE, JSON.stringify(scheduleStore, null, 2));
        logger.debug({ scheduleCount: scheduleStore.schedules.length }, 'Saved backup schedules');
    } catch (error) {
        logger.error({ error: getErrorMessage(error) }, 'Failed to save schedules');
        throw error;
    }
}

/**
 * Convert schedule frequency to cron expression
 */
function getCronExpression(schedule: BackupSchedule): string {
    const [hours, minutes] = schedule.time.split(':').map(Number);

    switch (schedule.frequency) {
        case 'daily':
            return `${minutes} ${hours} * * *`;
        case 'weekly':
            // Run on Sunday at the specified time
            return `${minutes} ${hours} * * 0`;
        case 'monthly':
            // Run on the 1st of each month at the specified time
            return `${minutes} ${hours} 1 * *`;
        default:
            throw new Error(`Unknown frequency: ${schedule.frequency}`);
    }
}

/**
 * Calculate next run time for a schedule
 */
function calculateNextRun(schedule: BackupSchedule): string {
    const [hours, minutes] = schedule.time.split(':').map(Number);
    const now = new Date();
    const next = new Date();
    next.setHours(hours, minutes, 0, 0);

    switch (schedule.frequency) {
        case 'daily':
            if (next <= now) {
                next.setDate(next.getDate() + 1);
            }
            break;
        case 'weekly':
            // Set to next Sunday
            const daysUntilSunday = (7 - next.getDay()) % 7;
            next.setDate(next.getDate() + daysUntilSunday);
            if (next <= now) {
                next.setDate(next.getDate() + 7);
            }
            break;
        case 'monthly':
            // Set to 1st of month
            next.setDate(1);
            if (next <= now) {
                next.setMonth(next.getMonth() + 1);
            }
            break;
    }

    return next.toISOString();
}

/**
 * Execute a scheduled backup
 */
async function executeScheduledBackup(schedule: BackupSchedule): Promise<void> {
    const backupId = randomUUID();
    const startTime = new Date().toISOString();

    logger.info({ scheduleId: schedule.id, backupId }, 'Starting scheduled backup');

    // Update health tracking
    scheduleHealth.set(schedule.id, {
        lastAttempt: startTime,
        lastSuccess: scheduleHealth.get(schedule.id)?.lastSuccess,
        lastError: undefined,
        consecutiveFailures: 0,
    });

    try {
        // Discover backup targets if items are empty
        const config: BackupConfig = schedule.config;
        if (config.items.length === 0) {
            const targets = await discoverBackupTargets();
            config.items = targets;
        }

        // Create backup archive
        const { archivePath, manifest } = await createBackupArchive(config);

        // Save manifest to file
        const manifestPath = join(TEMP_DIR, `${manifest.id}-manifest.json`);
        await writeFile(manifestPath, JSON.stringify(manifest, null, 2));

        // Encrypt if needed
        let finalArchivePath = archivePath;
        if (config.encryption.enabled && config.encryption.password) {
            const encryptedPath = `${archivePath}.enc`;
            await encryptFile(archivePath, encryptedPath, config.encryption.password);
            finalArchivePath = encryptedPath;
        }

        // Upload to destination
        const adapter = await createAdapter(config.destination);
        const archiveFileName = config.encryption.enabled ? `${manifest.id}.tar.gz.enc` : `${manifest.id}.tar.gz`;
        const manifestFileName = `${manifest.id}-manifest.json`;

        await adapter.upload(finalArchivePath, archiveFileName);
        await adapter.upload(manifestPath, manifestFileName);

        // Cleanup temporary files
        await unlink(archivePath).catch(() => {});
        await unlink(manifestPath).catch(() => {});
        if (finalArchivePath !== archivePath) {
            await unlink(finalArchivePath).catch(() => {});
        }

        // Update schedule metadata
        schedule.lastRun = startTime;
        schedule.nextRun = calculateNextRun(schedule);
        await saveSchedules();

        // Update health tracking
        const health = scheduleHealth.get(schedule.id)!;
        health.lastSuccess = new Date().toISOString();
        health.consecutiveFailures = 0;

        logger.info({ scheduleId: schedule.id, backupId }, 'Scheduled backup completed successfully');

        // Apply retention policy
        await applyRetentionPolicy(schedule);
    } catch (error) {
        const errorMsg = getErrorMessage(error);
        logger.error({ scheduleId: schedule.id, backupId, error: errorMsg }, 'Scheduled backup failed');

        // Update health tracking
        const health = scheduleHealth.get(schedule.id)!;
        health.lastError = errorMsg;
        health.consecutiveFailures++;

        // TODO: Send health check notification if failures exceed threshold
        if (health.consecutiveFailures >= 3) {
            logger.warn(
                { scheduleId: schedule.id, consecutiveFailures: health.consecutiveFailures },
                'Backup schedule has multiple consecutive failures'
            );
        }
    }
}

/**
 * Apply retention policy to backup history
 * Keeps only the N most recent backups and deletes older ones
 */
async function applyRetentionPolicy(schedule: BackupSchedule): Promise<void> {
    try {
        const adapter = await createAdapter(schedule.config.destination);

        // List all backup files
        const files = await adapter.list();

        // Filter for manifest files and parse backup info
        const backupHistory: Array<{ id: string; createdAt: Date; files: string[] }> = [];

        for (const file of files) {
            if (file.name.endsWith('-manifest.json')) {
                try {
                    // Download and parse manifest to get creation date
                    const tempManifestPath = join(TEMP_DIR, `retention-manifest-${Date.now()}.json`);
                    await adapter.download(file.name, tempManifestPath);
                    const manifestContent = await readFile(tempManifestPath, 'utf-8');
                    const manifest = JSON.parse(manifestContent);

                    const backupId = manifest.id;
                    const createdAt = new Date(manifest.createdAt);
                    const encrypted = manifest.encrypted;

                    // Collect all files associated with this backup
                    const backupFiles: string[] = [`${backupId}-manifest.json`];
                    for (const item of manifest.items) {
                        const sanitizedName = item.name.replace(/[^a-zA-Z0-9_-]/g, '_');
                        const fileName = encrypted ? `${sanitizedName}.tar.gz.enc` : `${sanitizedName}.tar.gz`;
                        backupFiles.push(fileName);
                    }

                    backupHistory.push({ id: backupId, createdAt, files: backupFiles });

                    // Cleanup temp manifest
                    await unlink(tempManifestPath).catch(() => {});
                } catch (error) {
                    logger.warn({ file: file.name, error: getErrorMessage(error) }, 'Failed to parse manifest for retention');
                }
            }
        }

        // Sort by creation date (newest first)
        backupHistory.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

        // Delete backups beyond retention count
        const toDelete = backupHistory.slice(schedule.retentionCount);

        if (toDelete.length > 0) {
            logger.info(
                { scheduleId: schedule.id, retentionCount: schedule.retentionCount, deleteCount: toDelete.length },
                'Applying retention policy'
            );

            for (const backup of toDelete) {
                for (const file of backup.files) {
                    try {
                        await adapter.delete(file);
                        logger.debug({ scheduleId: schedule.id, backupId: backup.id, file }, 'Deleted old backup file');
                    } catch (error) {
                        logger.warn(
                            { scheduleId: schedule.id, backupId: backup.id, file, error: getErrorMessage(error) },
                            'Failed to delete old backup file'
                        );
                    }
                }
            }

            logger.info({ scheduleId: schedule.id, deletedBackups: toDelete.length }, 'Retention policy applied');
        }
    } catch (error) {
        logger.error({ scheduleId: schedule.id, error: getErrorMessage(error) }, 'Failed to apply retention policy');
    }
}

/**
 * Schedule a cron job for a backup schedule
 */
function scheduleJob(schedule: BackupSchedule): void {
    try {
        const cronExpression = getCronExpression(schedule);
        const task = cron.schedule(
            cronExpression,
            () => {
                executeScheduledBackup(schedule).catch((error) => {
                    logger.error({ scheduleId: schedule.id, error: getErrorMessage(error) }, 'Backup execution failed');
                });
            },
            {
                scheduled: schedule.enabled,
                timezone: 'UTC',
            }
        );

        activeCronJobs.set(schedule.id, task);
        logger.info({ scheduleId: schedule.id, cronExpression, enabled: schedule.enabled }, 'Scheduled backup job');
    } catch (error) {
        logger.error({ scheduleId: schedule.id, error: getErrorMessage(error) }, 'Failed to schedule backup job');
        throw error;
    }
}

/**
 * Add or update a backup schedule
 */
export async function addSchedule(schedule: Omit<BackupSchedule, 'id' | 'lastRun' | 'nextRun'>): Promise<BackupSchedule> {
    const newSchedule: BackupSchedule = {
        ...schedule,
        id: randomUUID(),
        nextRun: calculateNextRun(schedule as BackupSchedule),
    };

    scheduleStore.schedules.push(newSchedule);
    await saveSchedules();

    if (newSchedule.enabled) {
        scheduleJob(newSchedule);
    }

    logger.info({ scheduleId: newSchedule.id, frequency: newSchedule.frequency }, 'Added backup schedule');

    return newSchedule;
}

/**
 * Update an existing backup schedule
 */
export async function updateSchedule(id: string, updates: Partial<BackupSchedule>): Promise<BackupSchedule | null> {
    const index = scheduleStore.schedules.findIndex((s) => s.id === id);
    if (index === -1) {
        return null;
    }

    const oldSchedule = scheduleStore.schedules[index];
    const updatedSchedule: BackupSchedule = {
        ...oldSchedule,
        ...updates,
        id, // Ensure ID doesn't change
        nextRun: calculateNextRun({ ...oldSchedule, ...updates } as BackupSchedule),
    };

    scheduleStore.schedules[index] = updatedSchedule;
    await saveSchedules();

    // Restart cron job
    const existingJob = activeCronJobs.get(id);
    if (existingJob) {
        existingJob.stop();
        activeCronJobs.delete(id);
    }

    if (updatedSchedule.enabled) {
        scheduleJob(updatedSchedule);
    }

    logger.info({ scheduleId: id, enabled: updatedSchedule.enabled }, 'Updated backup schedule');

    return updatedSchedule;
}

/**
 * Delete a backup schedule
 */
export async function deleteSchedule(id: string): Promise<boolean> {
    const index = scheduleStore.schedules.findIndex((s) => s.id === id);
    if (index === -1) {
        return false;
    }

    // Stop cron job
    const existingJob = activeCronJobs.get(id);
    if (existingJob) {
        existingJob.stop();
        activeCronJobs.delete(id);
    }

    scheduleStore.schedules.splice(index, 1);
    await saveSchedules();

    logger.info({ scheduleId: id }, 'Deleted backup schedule');

    return true;
}

/**
 * Get all backup schedules
 */
export function getSchedules(): BackupSchedule[] {
    return [...scheduleStore.schedules];
}

/**
 * Get a specific backup schedule by ID
 */
export function getSchedule(id: string): BackupSchedule | null {
    return scheduleStore.schedules.find((s) => s.id === id) || null;
}

/**
 * Get health status for all schedules
 */
export function getScheduleHealth(): Map<string, {
    lastAttempt: string;
    lastSuccess?: string;
    lastError?: string;
    consecutiveFailures: number;
}> {
    return new Map(scheduleHealth);
}

/**
 * Trigger a scheduled backup immediately (manual execution)
 */
export async function triggerSchedule(id: string): Promise<void> {
    const schedule = getSchedule(id);
    if (!schedule) {
        throw new Error(`Schedule not found: ${id}`);
    }

    logger.info({ scheduleId: id }, 'Manually triggering scheduled backup');
    await executeScheduledBackup(schedule);
}

/**
 * Initialize the scheduler
 * Load schedules from disk and start cron jobs
 */
export async function initializeScheduler(): Promise<void> {
    logger.info('Initializing backup scheduler');

    await loadSchedules();

    // Schedule all enabled jobs
    for (const schedule of scheduleStore.schedules) {
        if (schedule.enabled) {
            scheduleJob(schedule);
        }
    }

    logger.info({ scheduledCount: activeCronJobs.size }, 'Backup scheduler initialized');
}

/**
 * Shutdown the scheduler
 * Stop all cron jobs
 */
export async function shutdownScheduler(): Promise<void> {
    logger.info('Shutting down backup scheduler');

    for (const [id, task] of activeCronJobs.entries()) {
        task.stop();
        logger.debug({ scheduleId: id }, 'Stopped scheduled job');
    }

    activeCronJobs.clear();

    logger.info('Backup scheduler shut down');
}
