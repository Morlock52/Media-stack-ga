/**
 * Restore API Routes
 * Routes for previewing, executing, and tracking restore operations
 */

import { FastifyInstance } from 'fastify';
import { randomUUID } from 'crypto';
import { join } from 'path';
import { readFile, unlink } from 'fs/promises';
import { getErrorMessage } from '../utils/errors.js';
import { createLogger } from '../utils/logger.js';
import { PROJECT_ROOT } from '../utils/env.js';
import {
    RestoreConfigSchema,
    RestorePreviewRequestSchema,
} from '../types/backup.js';
import type {
    RestoreConfig,
    RestoreProgress,
    BackupManifest,
    BackupManifestItem,
} from '../types/backup.js';
import {
    extractBackupArchive,
    restoreToVolume,
    restoreToContainerPath,
    stopContainer,
    startContainer,
    cleanupTempFiles,
} from '../services/backupService.js';
import { createAdapter } from '../services/backup/destinationAdapter.js';
import { decryptFile } from '../utils/encryption.js';

const logger = createLogger('restoreRoutes');

const TEMP_DIR = join(PROJECT_ROOT, 'data', 'temp');

// In-memory storage for active restore operations
const activeRestores = new Map<string, RestoreProgress>();

export async function restoreRoutes(fastify: FastifyInstance) {
    /**
     * POST /api/restore/preview
     * Analyze backup contents without restoring
     */
    fastify.post<{
        Body: { backupId: string; destination: any; decryptionPassword?: string };
    }>('/api/restore/preview', async (request, reply) => {
        const parseResult = RestorePreviewRequestSchema.safeParse(request.body);

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

            // Test connection
            const connected = await adapter.testConnection();
            if (!connected) {
                return reply.status(503).send({
                    success: false,
                    error: 'Unable to connect to backup destination',
                });
            }

            // Download manifest
            const manifestFileName = `${backupId}-manifest.json`;
            const tempManifestPath = join(TEMP_DIR, `preview-manifest-${Date.now()}.json`);

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

            // Check if encrypted and password provided
            if (manifest.encrypted && !decryptionPassword) {
                await unlink(tempManifestPath).catch(() => {});
                return reply.status(400).send({
                    success: false,
                    error: 'Backup is encrypted but no decryption password provided',
                    encrypted: true,
                });
            }

            // Cleanup temp manifest
            await unlink(tempManifestPath).catch(() => {});

            // Return preview information
            return reply.status(200).send({
                success: true,
                preview: {
                    id: manifest.id,
                    name: manifest.name,
                    createdAt: manifest.createdAt,
                    totalSize: manifest.totalSize,
                    totalCompressedSize: manifest.totalCompressedSize,
                    encrypted: manifest.encrypted,
                    items: manifest.items.map((item: BackupManifestItem) => ({
                        type: item.type,
                        name: item.name,
                        path: item.path,
                        service: item.service,
                        size: item.size,
                        compressedSize: item.compressedSize,
                    })),
                    metadata: manifest.metadata,
                },
            });
        } catch (error: unknown) {
            logger.error({ err: error, backupId }, '[restore/preview] failed');
            return reply.status(500).send({
                success: false,
                error: getErrorMessage(error),
            });
        }
    });

    /**
     * POST /api/restore/execute
     * Execute restore operation with optional selective restore
     */
    fastify.post<{ Body: RestoreConfig }>('/api/restore/execute', async (request, reply) => {
        const parseResult = RestoreConfigSchema.safeParse(request.body);

        if (!parseResult.success) {
            return reply.status(400).send({
                success: false,
                error: 'Invalid restore configuration',
                details: parseResult.error.issues,
            });
        }

        const config = parseResult.data;
        const restoreId = randomUUID();

        // Initialize progress tracking
        const progress: RestoreProgress = {
            id: restoreId,
            status: 'initializing',
            currentOperation: 'Initializing restore...',
            itemsProcessed: 0,
            itemsTotal: config.items?.length || 0,
            bytesProcessed: 0,
            bytesTotal: 0,
            startedAt: new Date().toISOString(),
        };

        activeRestores.set(restoreId, progress);

        // Start restore asynchronously
        executeRestore(restoreId, config).catch((error) => {
            const errorMsg = getErrorMessage(error);
            logger.error({ restoreId, error: errorMsg }, 'Restore failed');
            const failedProgress = activeRestores.get(restoreId);
            if (failedProgress) {
                failedProgress.status = 'failed';
                failedProgress.error = errorMsg;
                activeRestores.set(restoreId, failedProgress);
            }
        });

        return reply.status(202).send({
            success: true,
            restoreId,
            message: 'Restore started',
        });
    });

    /**
     * GET /api/restore/status/:id
     * Get progress of an active restore operation
     */
    fastify.get<{ Params: { id: string } }>('/api/restore/status/:id', async (request, reply) => {
        const { id } = request.params;
        const progress = activeRestores.get(id);

        if (!progress) {
            return reply.status(404).send({
                success: false,
                error: 'Restore operation not found',
            });
        }

        return reply.status(200).send({
            success: true,
            progress,
        });
    });
}

/**
 * Execute restore operation asynchronously
 */
async function executeRestore(restoreId: string, config: RestoreConfig): Promise<void> {
    const updateProgress = (update: Partial<RestoreProgress>) => {
        const current = activeRestores.get(restoreId);
        if (current) {
            activeRestores.set(restoreId, { ...current, ...update });
        }
    };

    const restoreDir = join(TEMP_DIR, `restore-${restoreId}`);
    const stoppedContainers: string[] = [];

    try {
        // Download manifest
        updateProgress({
            status: 'downloading',
            currentOperation: 'Downloading backup manifest...',
        });

        const adapter = await createAdapter(config.destination);
        const manifestFileName = `${config.backupId}-manifest.json`;
        const tempManifestPath = join(TEMP_DIR, `restore-manifest-${restoreId}.json`);

        await adapter.download(manifestFileName, tempManifestPath);

        // Parse manifest
        const manifestContent = await readFile(tempManifestPath, 'utf-8');
        const manifest: BackupManifest = JSON.parse(manifestContent);

        // Update total bytes
        updateProgress({
            bytesTotal: manifest.totalSize,
            itemsTotal: config.items?.length || manifest.items.length,
        });

        // Filter items if selective restore
        let itemsToRestore = manifest.items;
        if (config.items && config.items.length > 0) {
            itemsToRestore = manifest.items.filter((item: BackupManifestItem) =>
                config.items!.includes(item.name)
            );
        }

        // Download and decrypt archives
        updateProgress({
            currentOperation: 'Downloading backup archives...',
        });

        for (let i = 0; i < itemsToRestore.length; i++) {
            const item = itemsToRestore[i];
            const sanitizedName = item.name.replace(/[^a-zA-Z0-9_-]/g, '_');
            const archiveFileName = `${sanitizedName}.tar.gz`;
            const encryptedFileName = `${sanitizedName}.tar.gz.enc`;
            const tempArchivePath = join(restoreDir, archiveFileName);

            updateProgress({
                currentOperation: `Downloading ${item.name}...`,
                currentItem: item.name,
                itemsProcessed: i,
            });

            // Download (encrypted or unencrypted)
            if (manifest.encrypted && config.decryptionPassword) {
                const tempEncryptedPath = join(restoreDir, encryptedFileName);
                await adapter.download(encryptedFileName, tempEncryptedPath);

                updateProgress({
                    status: 'decrypting',
                    currentOperation: `Decrypting ${item.name}...`,
                });

                await decryptFile(tempEncryptedPath, tempArchivePath, config.decryptionPassword);
                await unlink(tempEncryptedPath).catch(() => {});
            } else {
                await adapter.download(archiveFileName, tempArchivePath);
            }
        }

        // Stop services if requested
        if (config.stopServices) {
            updateProgress({
                currentOperation: 'Stopping services...',
            });

            const containersToStop = new Set<string>();
            for (const item of itemsToRestore) {
                if (item.service) {
                    containersToStop.add(item.service);
                }
            }

            for (const containerName of containersToStop) {
                try {
                    await stopContainer(containerName);
                    stoppedContainers.push(containerName);
                } catch (error) {
                    logger.warn({ containerName, error: getErrorMessage(error) }, 'Failed to stop container');
                }
            }
        }

        // Extract and apply files
        updateProgress({
            status: 'extracting',
            currentOperation: 'Extracting backup files...',
        });

        for (let i = 0; i < itemsToRestore.length; i++) {
            const item = itemsToRestore[i];
            const sanitizedName = item.name.replace(/[^a-zA-Z0-9_-]/g, '_');
            const archivePath = join(restoreDir, `${sanitizedName}.tar.gz`);
            const extractDir = join(restoreDir, sanitizedName);

            updateProgress({
                currentOperation: `Extracting ${item.name}...`,
                currentItem: item.name,
                itemsProcessed: i,
            });

            await extractBackupArchive(archivePath, extractDir);

            updateProgress({
                status: 'applying',
                currentOperation: `Restoring ${item.name}...`,
            });

            // Restore based on type
            if (item.type === 'volume') {
                // Extract volume name from path
                const volumeName = item.path;
                await restoreToVolume(volumeName, extractDir);
            } else if (item.type === 'config' || item.type === 'database' || item.type === 'metadata') {
                // Restore to container path
                if (item.service) {
                    await restoreToContainerPath(item.service, item.path, extractDir);
                }
            }

            updateProgress({
                bytesProcessed: manifest.items
                    .slice(0, i + 1)
                    .reduce((sum: number, item: BackupManifestItem) => sum + item.size, 0),
            });
        }

        // Restart stopped services
        if (stoppedContainers.length > 0) {
            updateProgress({
                currentOperation: 'Restarting services...',
            });

            for (const containerName of stoppedContainers) {
                try {
                    await startContainer(containerName);
                } catch (error) {
                    logger.warn({ containerName, error: getErrorMessage(error) }, 'Failed to restart container');
                }
            }
        }

        // Cleanup
        await unlink(tempManifestPath).catch(() => {});
        await cleanupTempFiles(restoreId);

        // Mark as completed
        updateProgress({
            status: 'completed',
            currentOperation: 'Restore completed successfully',
            itemsProcessed: itemsToRestore.length,
            estimatedCompletionAt: new Date().toISOString(),
        });

        logger.info({ restoreId, backupId: config.backupId }, 'Restore completed successfully');
    } catch (error) {
        const errorMsg = getErrorMessage(error);
        logger.error({ restoreId, error: errorMsg }, 'Restore execution failed');

        // Try to restart any stopped containers
        for (const containerName of stoppedContainers) {
            try {
                await startContainer(containerName);
            } catch (restartError) {
                logger.error({ containerName, error: getErrorMessage(restartError) }, 'Failed to restart container after restore failure');
            }
        }

        updateProgress({
            status: 'failed',
            error: errorMsg,
        });

        throw error;
    }
}
