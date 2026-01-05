/**
 * Backup API Routes
 * Routes for creating, listing, validating, and deleting backups
 */

import { FastifyInstance } from 'fastify';
import { randomUUID } from 'crypto';
import { join } from 'path';
import { readFile, unlink } from 'fs/promises';
import { getErrorMessage } from '../utils/errors.js';
import { createLogger } from '../utils/logger.js';
import { PROJECT_ROOT } from '../utils/env.js';
import {
    BackupConfigSchema,
    BackupValidateRequestSchema,
    BackupListRequestSchema,
    BackupDeleteRequestSchema,
} from '../types/backup.js';
import type {
    BackupConfig,
    BackupProgress,
    BackupManifest,
    BackupHistoryEntry,
} from '../types/backup.js';
import {
    discoverBackupTargets,
    calculateBackupSize,
    createBackupArchive,
    validateBackup as validateBackupIntegrity,
} from '../services/backupService.js';
import { createAdapter } from '../services/backup/destinationAdapter.js';
import { encryptFile, decryptFile } from '../utils/encryption.js';

const logger = createLogger('backupRoutes');

const TEMP_DIR = join(PROJECT_ROOT, 'data', 'temp');

// In-memory storage for active backup operations
const activeBackups = new Map<string, BackupProgress>();

export async function backupRoutes(fastify: FastifyInstance) {
    /**
     * POST /api/backup/create
     * Start a new backup operation
     */
    fastify.post<{ Body: BackupConfig }>('/api/backup/create', async (request, reply) => {
        const parseResult = BackupConfigSchema.safeParse(request.body);

        if (!parseResult.success) {
            return reply.status(400).send({
                success: false,
                error: 'Invalid backup configuration',
                details: parseResult.error.issues,
            });
        }

        const config = parseResult.data;
        const backupId = randomUUID();

        // Initialize progress tracking
        const progress: BackupProgress = {
            id: backupId,
            status: 'initializing',
            currentOperation: 'Initializing backup...',
            itemsProcessed: 0,
            itemsTotal: config.items.length,
            bytesProcessed: 0,
            bytesTotal: 0,
            startedAt: new Date().toISOString(),
        };

        activeBackups.set(backupId, progress);

        // Start backup asynchronously
        executeBackup(backupId, config).catch((error) => {
            const errorMsg = getErrorMessage(error);
            logger.error({ backupId, error: errorMsg }, 'Backup failed');
            const failedProgress = activeBackups.get(backupId);
            if (failedProgress) {
                failedProgress.status = 'failed';
                failedProgress.error = errorMsg;
                activeBackups.set(backupId, failedProgress);
            }
        });

        return reply.status(202).send({
            success: true,
            backupId,
            message: 'Backup started',
        });
    });

    /**
     * GET /api/backup/status/:id
     * Get progress of an active backup
     */
    fastify.get<{ Params: { id: string } }>('/api/backup/status/:id', async (request, reply) => {
        const { id } = request.params;
        const progress = activeBackups.get(id);

        if (!progress) {
            return reply.status(404).send({
                success: false,
                error: 'Backup not found',
            });
        }

        return reply.status(200).send({
            success: true,
            progress,
        });
    });

    /**
     * GET /api/backup/list
     * List available backups from destination
     */
    fastify.post<{ Body: { destination: any; limit?: number; offset?: number } }>(
        '/api/backup/list',
        async (request, reply) => {
            const parseResult = BackupListRequestSchema.safeParse(request.body);

            if (!parseResult.success) {
                return reply.status(400).send({
                    success: false,
                    error: 'Invalid request',
                    details: parseResult.error.issues,
                });
            }

            const { destination, limit = 100, offset = 0 } = parseResult.data;

            try {
                const adapter = await createAdapter(destination);

                // Test connection first
                const connected = await adapter.testConnection();
                if (!connected) {
                    return reply.status(503).send({
                        success: false,
                        error: 'Unable to connect to backup destination',
                    });
                }

                // List all backup files
                const files = await adapter.list();

                // Filter for manifest files and parse backup info
                const backupHistory: BackupHistoryEntry[] = [];

                for (const file of files) {
                    if (file.name.endsWith('-manifest.json')) {
                        try {
                            // Download manifest to temp location
                            const tempManifestPath = join(TEMP_DIR, `temp-manifest-${Date.now()}.json`);
                            await adapter.download(file.name, tempManifestPath);

                            // Parse manifest
                            const manifestContent = await readFile(tempManifestPath, 'utf-8');
                            const manifest: BackupManifest = JSON.parse(manifestContent);

                            backupHistory.push({
                                id: manifest.id,
                                name: manifest.name,
                                createdAt: manifest.createdAt,
                                size: manifest.totalSize,
                                compressedSize: manifest.totalCompressedSize,
                                encrypted: manifest.encrypted,
                                itemCount: manifest.items.length,
                                destination,
                                status: 'completed',
                            });

                            // Cleanup temp manifest
                            await unlink(tempManifestPath).catch(() => {
                                // Ignore cleanup errors
                            });
                        } catch (error) {
                            logger.warn({ file: file.name, error: getErrorMessage(error) }, 'Failed to parse manifest');
                        }
                    }
                }

                // Sort by creation date (newest first)
                backupHistory.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

                // Apply pagination
                const paginatedBackups = backupHistory.slice(offset, offset + limit);

                return reply.status(200).send({
                    success: true,
                    backups: paginatedBackups,
                    total: backupHistory.length,
                    limit,
                    offset,
                });
            } catch (error: unknown) {
                logger.error({ err: error }, '[backup/list] failed');
                return reply.status(500).send({
                    success: false,
                    error: getErrorMessage(error),
                });
            }
        }
    );

    /**
     * POST /api/backup/validate
     * Validate backup integrity
     */
    fastify.post<{
        Body: { backupId: string; destination: any; decryptionPassword?: string };
    }>('/api/backup/validate', async (request, reply) => {
        const parseResult = BackupValidateRequestSchema.safeParse(request.body);

        if (!parseResult.success) {
            return reply.status(400).send({
                success: false,
                error: 'Invalid request',
                details: parseResult.error.issues,
            });
        }

        const { backupId, destination, decryptionPassword } = parseResult.data;

        try {
            const adapter = await createAdapter(destination);

            // Download manifest
            const manifestFileName = `${backupId}-manifest.json`;
            const tempManifestPath = join(TEMP_DIR, `validate-manifest-${Date.now()}.json`);

            try {
                await adapter.download(manifestFileName, tempManifestPath);
            } catch (error) {
                return reply.status(404).send({
                    success: false,
                    error: `Backup manifest not found: ${backupId}`,
                });
            }

            // Parse manifest
            const manifestContent = await readFile(tempManifestPath, 'utf-8');
            const manifest: BackupManifest = JSON.parse(manifestContent);

            // If encrypted, check if password provided
            if (manifest.encrypted && !decryptionPassword) {
                await unlink(tempManifestPath).catch(() => {});
                return reply.status(400).send({
                    success: false,
                    error: 'Backup is encrypted but no decryption password provided',
                    encrypted: true,
                });
            }

            // Download all archive files and validate checksums
            const validationErrors: string[] = [];
            const tempDir = join(TEMP_DIR, `validate-${backupId}-${Date.now()}`);

            for (const item of manifest.items) {
                const sanitizedName = item.name.replace(/[^a-zA-Z0-9_-]/g, '_');
                const archiveFileName = `${sanitizedName}.tar.gz`;
                const encryptedFileName = `${sanitizedName}.tar.gz.enc`;
                const tempArchivePath = join(tempDir, archiveFileName);

                try {
                    // Try encrypted file first if backup is encrypted
                    if (manifest.encrypted && decryptionPassword) {
                        const tempEncryptedPath = join(tempDir, encryptedFileName);
                        await adapter.download(encryptedFileName, tempEncryptedPath);

                        // Decrypt file
                        await decryptFile(tempEncryptedPath, tempArchivePath, decryptionPassword);

                        // Cleanup encrypted file
                        await unlink(tempEncryptedPath).catch(() => {});
                    } else {
                        // Download unencrypted archive
                        await adapter.download(archiveFileName, tempArchivePath);
                    }

                    // Validate checksum (handled by validateBackupIntegrity)
                } catch (error) {
                    validationErrors.push(`Failed to download or decrypt ${item.name}: ${getErrorMessage(error)}`);
                }
            }

            // Validate integrity
            const validation = await validateBackupIntegrity(manifest, tempDir);
            validationErrors.push(...validation.errors);

            // Cleanup
            await unlink(tempManifestPath).catch(() => {});

            return reply.status(200).send({
                success: validation.valid && validationErrors.length === 0,
                valid: validation.valid && validationErrors.length === 0,
                errors: validationErrors,
                manifest: {
                    id: manifest.id,
                    name: manifest.name,
                    createdAt: manifest.createdAt,
                    itemCount: manifest.items.length,
                    totalSize: manifest.totalSize,
                    encrypted: manifest.encrypted,
                },
            });
        } catch (error: unknown) {
            logger.error({ err: error, backupId }, '[backup/validate] failed');
            return reply.status(500).send({
                success: false,
                error: getErrorMessage(error),
            });
        }
    });

    /**
     * DELETE /api/backup/:id
     * Delete a backup from destination
     */
    fastify.delete<{
        Params: { id: string };
        Body: { destination: any };
    }>('/api/backup/:id', async (request, reply) => {
        const { id } = request.params;
        const parseResult = BackupDeleteRequestSchema.safeParse({
            backupId: id,
            destination: request.body.destination,
        });

        if (!parseResult.success) {
            return reply.status(400).send({
                success: false,
                error: 'Invalid request',
                details: parseResult.error.issues,
            });
        }

        const { backupId, destination } = parseResult.data;

        try {
            const adapter = await createAdapter(destination);

            // Download manifest to find all files
            const manifestFileName = `${backupId}-manifest.json`;
            const tempManifestPath = join(TEMP_DIR, `delete-manifest-${Date.now()}.json`);

            try {
                await adapter.download(manifestFileName, tempManifestPath);
            } catch (error) {
                return reply.status(404).send({
                    success: false,
                    error: `Backup not found: ${backupId}`,
                });
            }

            // Parse manifest
            const manifestContent = await readFile(tempManifestPath, 'utf-8');
            const manifest: BackupManifest = JSON.parse(manifestContent);

            // Delete all archive files
            const deletedFiles: string[] = [];
            const deleteErrors: string[] = [];

            for (const item of manifest.items) {
                const sanitizedName = item.name.replace(/[^a-zA-Z0-9_-]/g, '_');
                const archiveFileName = `${sanitizedName}.tar.gz`;
                const encryptedFileName = `${sanitizedName}.tar.gz.enc`;

                // Try to delete both encrypted and unencrypted versions
                const filesToDelete = manifest.encrypted
                    ? [encryptedFileName, archiveFileName]
                    : [archiveFileName];

                for (const fileName of filesToDelete) {
                    try {
                        await adapter.delete(fileName);
                        deletedFiles.push(fileName);
                    } catch (error) {
                        // File might not exist, continue
                        logger.debug({ fileName, error: getErrorMessage(error) }, 'File not found during delete');
                    }
                }
            }

            // Delete manifest
            try {
                await adapter.delete(manifestFileName);
                deletedFiles.push(manifestFileName);
            } catch (error) {
                deleteErrors.push(`Failed to delete manifest: ${getErrorMessage(error)}`);
            }

            // Cleanup temp manifest
            await unlink(tempManifestPath).catch(() => {});

            return reply.status(200).send({
                success: deleteErrors.length === 0,
                message: `Deleted ${deletedFiles.length} files`,
                deletedFiles,
                errors: deleteErrors,
            });
        } catch (error: unknown) {
            logger.error({ err: error, backupId }, '[backup/delete] failed');
            return reply.status(500).send({
                success: false,
                error: getErrorMessage(error),
            });
        }
    });

    /**
     * GET /api/backup/discover
     * Discover available backup targets
     */
    fastify.get('/api/backup/discover', async (_request, reply) => {
        try {
            const targets = await discoverBackupTargets();
            const totalSize = await calculateBackupSize(targets);

            return reply.status(200).send({
                success: true,
                targets,
                totalSize,
                count: targets.length,
            });
        } catch (error: unknown) {
            logger.error({ err: error }, '[backup/discover] failed');
            return reply.status(500).send({
                success: false,
                error: getErrorMessage(error),
                targets: [],
                totalSize: 0,
                count: 0,
            });
        }
    });
}

/**
 * Execute backup operation asynchronously
 */
async function executeBackup(backupId: string, config: BackupConfig): Promise<void> {
    const updateProgress = (update: Partial<BackupProgress>) => {
        const current = activeBackups.get(backupId);
        if (current) {
            activeBackups.set(backupId, { ...current, ...update });
        }
    };

    try {
        // Calculate total size
        updateProgress({
            status: 'discovering',
            currentOperation: 'Calculating backup size...',
        });

        const totalSize = await calculateBackupSize(config.items);
        updateProgress({
            bytesTotal: totalSize,
        });

        // Create archive
        updateProgress({
            status: 'archiving',
            currentOperation: 'Creating backup archive...',
        });

        const { archivePath, manifest } = await createBackupArchive(config, (progress) => {
            updateProgress({
                currentOperation: progress.currentOperation || 'Archiving...',
                currentItem: progress.currentItem,
                itemsProcessed: progress.itemsProcessed || 0,
                itemsTotal: progress.itemsTotal || config.items.length,
            });
        });

        // Encrypt if needed
        let finalArchivePath = archivePath;
        if (config.encryption.enabled && config.encryption.password) {
            updateProgress({
                status: 'encrypting',
                currentOperation: 'Encrypting backup...',
            });

            for (const item of manifest.items) {
                const sanitizedName = item.name.replace(/[^a-zA-Z0-9_-]/g, '_');
                const itemArchivePath = join(TEMP_DIR, `${sanitizedName}.tar.gz`);
                const encryptedPath = `${itemArchivePath}.enc`;

                await encryptFile(itemArchivePath, encryptedPath, config.encryption.password);

                // Remove unencrypted file
                await unlink(itemArchivePath).catch(() => {});
            }
        }

        // Upload to destination
        updateProgress({
            status: 'uploading',
            currentOperation: 'Uploading backup to destination...',
        });

        const adapter = await createAdapter(config.destination);

        // Upload manifest
        const manifestPath = join(TEMP_DIR, `${manifest.id}-manifest.json`);
        const manifestFileName = `${manifest.id}-manifest.json`;
        await adapter.upload(manifestPath, manifestFileName, (progress) => {
            updateProgress({
                bytesProcessed: progress.bytesTransferred,
                transferSpeed: progress.bytesTransferred / ((Date.now() - new Date(activeBackups.get(backupId)!.startedAt).getTime()) / 1000),
            });
        });

        // Upload archive files
        for (let i = 0; i < manifest.items.length; i++) {
            const item = manifest.items[i];
            const sanitizedName = item.name.replace(/[^a-zA-Z0-9_-]/g, '_');
            const fileName = config.encryption.enabled
                ? `${sanitizedName}.tar.gz.enc`
                : `${sanitizedName}.tar.gz`;
            const localPath = join(TEMP_DIR, fileName);

            updateProgress({
                currentOperation: `Uploading ${item.name}...`,
                currentItem: item.name,
                itemsProcessed: i,
            });

            await adapter.upload(localPath, fileName, (progress) => {
                updateProgress({
                    bytesProcessed: progress.bytesTransferred,
                    transferSpeed: progress.bytesTransferred / ((Date.now() - new Date(activeBackups.get(backupId)!.startedAt).getTime()) / 1000),
                });
            });
        }

        // Cleanup temp files
        for (const item of manifest.items) {
            const sanitizedName = item.name.replace(/[^a-zA-Z0-9_-]/g, '_');
            const files = [
                join(TEMP_DIR, `${sanitizedName}.tar.gz`),
                join(TEMP_DIR, `${sanitizedName}.tar.gz.enc`),
            ];

            for (const file of files) {
                await unlink(file).catch(() => {});
            }
        }
        await unlink(manifestPath).catch(() => {});

        // Mark as completed
        updateProgress({
            status: 'completed',
            currentOperation: 'Backup completed successfully',
            itemsProcessed: config.items.length,
            estimatedCompletionAt: new Date().toISOString(),
        });

        logger.info({ backupId, manifest: manifest.id }, 'Backup completed successfully');
    } catch (error) {
        const errorMsg = getErrorMessage(error);
        logger.error({ backupId, error: errorMsg }, 'Backup execution failed');
        updateProgress({
            status: 'failed',
            error: errorMsg,
        });
        throw error;
    }
}
