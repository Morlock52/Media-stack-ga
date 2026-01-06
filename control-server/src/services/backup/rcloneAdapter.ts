/**
 * Rclone Adapter
 * Handles backup operations using rclone CLI wrapper
 */

import { stat } from 'fs/promises';
import { basename, dirname } from 'path';
import { runCommand } from '../../utils/docker.js';
import { createLogger } from '../../utils/logger.js';
import { getErrorMessage } from '../../utils/errors.js';
import type { RcloneDestination } from '../../types/backup.js';
import type {
    DestinationAdapter,
    BackupFileInfo,
    ProgressCallback,
} from './destinationAdapter.js';

const logger = createLogger('rcloneAdapter');

/**
 * Rclone adapter for backup operations
 *
 * Note: This adapter requires rclone to be installed on the system.
 * Install rclone: https://rclone.org/install/
 */
export class RcloneAdapter implements DestinationAdapter {
    private config: RcloneDestination;
    private remotePrefix: string;

    constructor(destination: RcloneDestination) {
        this.config = destination;
        this.remotePrefix = `${destination.remoteName}:${destination.remotePath}`;
        logger.info({
            remoteName: destination.remoteName,
            remotePath: destination.remotePath,
        }, 'Rclone adapter initialized');
    }

    /**
     * Check if rclone is installed
     */
    private async checkRclone(): Promise<void> {
        try {
            await runCommand('rclone', ['version'], {
                timeoutMs: 5_000,
                label: 'rclone:version',
            });
        } catch (error) {
            const message = getErrorMessage(error);
            logger.error({ error: message }, 'Rclone not available');
            throw new Error(
                'Rclone is not installed. Install from: https://rclone.org/install/'
            );
        }
    }

    /**
     * Get full rclone remote path
     */
    private getRemotePath(path: string): string {
        // Normalize path separators
        const normalizedPath = path.replace(/\\/g, '/');
        return `${this.remotePrefix}/${normalizedPath}`.replace(/\/+/g, '/');
    }

    /**
     * Parse rclone ls output into file info
     */
    private parseLsOutput(output: string): BackupFileInfo[] {
        const files: BackupFileInfo[] = [];
        const lines = output.split('\n').filter(Boolean);

        for (const line of lines) {
            // rclone ls format: "size filename"
            const match = line.trim().match(/^\s*(\d+)\s+(.+)$/);
            if (!match) continue;

            const size = parseInt(match[1], 10);
            const path = match[2];
            const filename = basename(path);

            // Filter for backup files
            if (filename.endsWith('.tar.gz') || filename.endsWith('.enc')) {
                // Extract backup ID from filename
                const id = filename.replace(/\.(tar\.gz|enc)$/, '');

                files.push({
                    id,
                    name: filename,
                    size,
                    createdAt: new Date(), // rclone ls doesn't provide timestamps
                    path,
                });
            }
        }

        return files;
    }

    /**
     * Parse rclone lsl output (includes timestamps) into file info
     */
    private parseLslOutput(output: string): BackupFileInfo[] {
        const files: BackupFileInfo[] = [];
        const lines = output.split('\n').filter(Boolean);

        for (const line of lines) {
            // rclone lsl format: "size timestamp filename"
            // Example: "12345 2024-01-05 12:34:56.000000000 backup.tar.gz"
            const match = line.trim().match(/^\s*(\d+)\s+([\d-]+\s+[\d:.]+)\s+(.+)$/);
            if (!match) continue;

            const size = parseInt(match[1], 10);
            const timestamp = match[2];
            const path = match[3];
            const filename = basename(path);

            // Filter for backup files
            if (filename.endsWith('.tar.gz') || filename.endsWith('.enc')) {
                // Extract backup ID from filename
                const id = filename.replace(/\.(tar\.gz|enc)$/, '');

                // Parse timestamp
                let createdAt: Date;
                try {
                    createdAt = new Date(timestamp.replace(' ', 'T'));
                } catch {
                    createdAt = new Date();
                }

                files.push({
                    id,
                    name: filename,
                    size,
                    createdAt,
                    path,
                });
            }
        }

        return files;
    }

    /**
     * Upload a file using rclone
     */
    async upload(
        localPath: string,
        remotePath: string,
        progressCallback?: ProgressCallback
    ): Promise<void> {
        logger.info({ localPath, remotePath }, 'Starting rclone upload');

        try {
            await this.checkRclone();

            const fullRemotePath = this.getRemotePath(remotePath);

            // Get file size for progress calculation
            const stats = await stat(localPath);
            const totalBytes = stats.size;

            // Build rclone command
            const args = [
                'copyto',
                localPath,
                fullRemotePath,
                '--stats', '1s', // Update stats every second
                '--stats-one-line', // Single line stats output
            ];

            // Report initial progress
            if (progressCallback) {
                progressCallback({
                    bytesTransferred: 0,
                    totalBytes,
                    percentage: 0,
                });
            }

            // Execute rclone (with a generous timeout for large files)
            const output = await runCommand('rclone', args, {
                timeoutMs: 3_600_000, // 1 hour timeout
                label: 'rclone:copyto',
            });

            // Report completion
            if (progressCallback) {
                progressCallback({
                    bytesTransferred: totalBytes,
                    totalBytes,
                    percentage: 100,
                });
            }

            logger.info({ remotePath, size: totalBytes }, 'Rclone upload completed');
        } catch (error) {
            const message = getErrorMessage(error);
            logger.error({ error: message, localPath, remotePath }, 'Rclone upload failed');
            throw new Error(`Failed to upload with rclone: ${message}`);
        }
    }

    /**
     * Download a file using rclone
     */
    async download(
        remotePath: string,
        localPath: string,
        progressCallback?: ProgressCallback
    ): Promise<void> {
        logger.info({ remotePath, localPath }, 'Starting rclone download');

        try {
            await this.checkRclone();

            const fullRemotePath = this.getRemotePath(remotePath);

            // Get remote file size for progress calculation
            let totalBytes = 0;
            try {
                const sizeOutput = await runCommand('rclone', ['size', fullRemotePath, '--json'], {
                    timeoutMs: 30_000,
                    label: 'rclone:size',
                });
                const sizeData = JSON.parse(sizeOutput);
                totalBytes = sizeData.bytes || 0;
            } catch {
                // Size check failed, continue without progress tracking
                logger.warn({ remotePath }, 'Failed to get remote file size');
            }

            // Build rclone command
            const args = [
                'copyto',
                fullRemotePath,
                localPath,
                '--stats', '1s',
                '--stats-one-line',
            ];

            // Report initial progress
            if (progressCallback && totalBytes > 0) {
                progressCallback({
                    bytesTransferred: 0,
                    totalBytes,
                    percentage: 0,
                });
            }

            // Execute rclone
            const output = await runCommand('rclone', args, {
                timeoutMs: 3_600_000, // 1 hour timeout
                label: 'rclone:copyto',
            });

            // Report completion
            if (progressCallback && totalBytes > 0) {
                progressCallback({
                    bytesTransferred: totalBytes,
                    totalBytes,
                    percentage: 100,
                });
            }

            logger.info({ localPath, size: totalBytes }, 'Rclone download completed');
        } catch (error) {
            const message = getErrorMessage(error);
            logger.error({ error: message, remotePath, localPath }, 'Rclone download failed');
            throw new Error(`Failed to download with rclone: ${message}`);
        }
    }

    /**
     * List all backup files using rclone
     */
    async list(prefix?: string): Promise<BackupFileInfo[]> {
        logger.info({ prefix }, 'Listing rclone backups');

        try {
            await this.checkRclone();

            const remotePath = prefix
                ? this.getRemotePath(prefix)
                : this.remotePrefix;

            // Use lsl for detailed listing with timestamps
            const output = await runCommand('rclone', ['lsl', remotePath], {
                timeoutMs: 60_000,
                label: 'rclone:lsl',
            });

            const files = this.parseLslOutput(output);

            // Sort by creation time (newest first)
            files.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

            logger.info({ count: files.length }, 'Rclone backup listing completed');
            return files;
        } catch (error) {
            const message = getErrorMessage(error);

            // If lsl fails, try ls as fallback
            try {
                logger.warn('lsl failed, trying ls fallback');
                const remotePath = prefix
                    ? this.getRemotePath(prefix)
                    : this.remotePrefix;

                const output = await runCommand('rclone', ['ls', remotePath], {
                    timeoutMs: 60_000,
                    label: 'rclone:ls',
                });

                const files = this.parseLsOutput(output);
                logger.info({ count: files.length }, 'Rclone backup listing completed (ls fallback)');
                return files;
            } catch (fallbackError) {
                const fallbackMessage = getErrorMessage(fallbackError);
                logger.error({ error: fallbackMessage, prefix }, 'Failed to list rclone backups');
                throw new Error(`Failed to list rclone backups: ${fallbackMessage}`);
            }
        }
    }

    /**
     * Delete a file using rclone
     */
    async delete(remotePath: string): Promise<void> {
        logger.info({ remotePath }, 'Deleting rclone backup');

        try {
            await this.checkRclone();

            const fullRemotePath = this.getRemotePath(remotePath);

            await runCommand('rclone', ['delete', fullRemotePath], {
                timeoutMs: 60_000,
                label: 'rclone:delete',
            });

            logger.info({ remotePath }, 'Rclone backup deleted');
        } catch (error) {
            const message = getErrorMessage(error);
            logger.error({ error: message, remotePath }, 'Failed to delete rclone backup');
            throw new Error(`Failed to delete rclone backup: ${message}`);
        }
    }

    /**
     * Test connection to rclone remote
     */
    async testConnection(): Promise<boolean> {
        logger.info({ remoteName: this.config.remoteName }, 'Testing rclone connection');

        try {
            await this.checkRclone();

            // Check if remote exists and is accessible
            await runCommand('rclone', ['lsd', this.remotePrefix], {
                timeoutMs: 30_000,
                label: 'rclone:lsd',
            });

            logger.info('Rclone connection test successful');
            return true;
        } catch (error) {
            const message = getErrorMessage(error);
            logger.error({ error: message }, 'Rclone connection test failed');
            return false;
        }
    }
}
