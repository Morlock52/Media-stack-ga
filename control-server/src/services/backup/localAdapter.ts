/**
 * Local Filesystem Adapter
 * Handles backup operations to local filesystem
 */

import { createReadStream, createWriteStream } from 'fs';
import { mkdir, readdir, stat, unlink, copyFile } from 'fs/promises';
import { join, dirname, basename } from 'path';
import { pipeline } from 'stream/promises';
import { createLogger } from '../../utils/logger.js';
import { getErrorMessage } from '../../utils/errors.js';
import type { LocalDestination } from '../../types/backup.js';
import type {
    DestinationAdapter,
    BackupFileInfo,
    ProgressCallback,
} from './destinationAdapter.js';

const logger = createLogger('localAdapter');

/**
 * Local filesystem adapter for backup operations
 */
export class LocalAdapter implements DestinationAdapter {
    private basePath: string;

    constructor(destination: LocalDestination) {
        this.basePath = destination.path;
        logger.info({ basePath: this.basePath }, 'Local adapter initialized');
    }

    /**
     * Ensure the base directory exists
     */
    private async ensureDirectory(): Promise<void> {
        try {
            await mkdir(this.basePath, { recursive: true });
        } catch (error) {
            const message = getErrorMessage(error);
            logger.error({ error: message, path: this.basePath }, 'Failed to create directory');
            throw new Error(`Failed to create backup directory: ${message}`);
        }
    }

    /**
     * Get full path for a remote path
     */
    private getFullPath(remotePath: string): string {
        return join(this.basePath, remotePath);
    }

    /**
     * Upload a file to local destination (copy operation)
     */
    async upload(
        localPath: string,
        remotePath: string,
        progressCallback?: ProgressCallback
    ): Promise<void> {
        logger.info({ localPath, remotePath }, 'Starting local upload');

        try {
            await this.ensureDirectory();

            const fullPath = this.getFullPath(remotePath);
            const targetDir = dirname(fullPath);

            // Ensure target directory exists
            await mkdir(targetDir, { recursive: true });

            // Get file size for progress reporting
            const stats = await stat(localPath);
            const totalBytes = stats.size;

            if (progressCallback) {
                // For small local copies, we can't easily track progress
                // Report completion in one go
                progressCallback({
                    bytesTransferred: 0,
                    totalBytes,
                    percentage: 0,
                });
            }

            // Copy file
            await copyFile(localPath, fullPath);

            if (progressCallback) {
                progressCallback({
                    bytesTransferred: totalBytes,
                    totalBytes,
                    percentage: 100,
                });
            }

            logger.info({ remotePath, size: totalBytes }, 'Local upload completed');
        } catch (error) {
            const message = getErrorMessage(error);
            logger.error({ error: message, localPath, remotePath }, 'Local upload failed');
            throw new Error(`Failed to upload to local destination: ${message}`);
        }
    }

    /**
     * Download a file from local destination (copy operation)
     */
    async download(
        remotePath: string,
        localPath: string,
        progressCallback?: ProgressCallback
    ): Promise<void> {
        logger.info({ remotePath, localPath }, 'Starting local download');

        try {
            const fullPath = this.getFullPath(remotePath);
            const targetDir = dirname(localPath);

            // Ensure target directory exists
            await mkdir(targetDir, { recursive: true });

            // Get file size for progress reporting
            const stats = await stat(fullPath);
            const totalBytes = stats.size;

            if (progressCallback) {
                progressCallback({
                    bytesTransferred: 0,
                    totalBytes,
                    percentage: 0,
                });
            }

            // Copy file
            await copyFile(fullPath, localPath);

            if (progressCallback) {
                progressCallback({
                    bytesTransferred: totalBytes,
                    totalBytes,
                    percentage: 100,
                });
            }

            logger.info({ localPath, size: totalBytes }, 'Local download completed');
        } catch (error) {
            const message = getErrorMessage(error);
            logger.error({ error: message, remotePath, localPath }, 'Local download failed');
            throw new Error(`Failed to download from local destination: ${message}`);
        }
    }

    /**
     * List all backup files in the local destination
     */
    async list(prefix?: string): Promise<BackupFileInfo[]> {
        logger.info({ prefix }, 'Listing local backups');

        try {
            await this.ensureDirectory();

            const searchPath = prefix ? this.getFullPath(prefix) : this.basePath;
            const files: BackupFileInfo[] = [];

            // Read directory
            const entries = await readdir(searchPath, { withFileTypes: true });

            for (const entry of entries) {
                if (entry.isFile() && (entry.name.endsWith('.tar.gz') || entry.name.endsWith('.enc'))) {
                    const fullPath = join(searchPath, entry.name);
                    const stats = await stat(fullPath);
                    const relativePath = prefix ? join(prefix, entry.name) : entry.name;

                    // Extract backup ID from filename
                    // Expected format: backup-<timestamp>.tar.gz or backup-<timestamp>.enc
                    const id = entry.name.replace(/\.(tar\.gz|enc)$/, '');

                    files.push({
                        id,
                        name: entry.name,
                        size: stats.size,
                        createdAt: stats.mtime,
                        path: relativePath,
                    });
                }
            }

            // Sort by creation time (newest first)
            files.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

            logger.info({ count: files.length }, 'Local backup listing completed');
            return files;
        } catch (error) {
            const message = getErrorMessage(error);
            logger.error({ error: message, prefix }, 'Failed to list local backups');
            throw new Error(`Failed to list local backups: ${message}`);
        }
    }

    /**
     * Delete a file from local destination
     */
    async delete(remotePath: string): Promise<void> {
        logger.info({ remotePath }, 'Deleting local backup');

        try {
            const fullPath = this.getFullPath(remotePath);
            await unlink(fullPath);
            logger.info({ remotePath }, 'Local backup deleted');
        } catch (error) {
            const message = getErrorMessage(error);
            logger.error({ error: message, remotePath }, 'Failed to delete local backup');
            throw new Error(`Failed to delete local backup: ${message}`);
        }
    }

    /**
     * Test connection to local destination (check if path is accessible)
     */
    async testConnection(): Promise<boolean> {
        logger.info({ path: this.basePath }, 'Testing local connection');

        try {
            await this.ensureDirectory();

            // Try to create and delete a test file
            const testFile = join(this.basePath, '.connection-test');
            await mkdir(dirname(testFile), { recursive: true });
            const writeStream = createWriteStream(testFile);
            writeStream.end('test');

            await new Promise<void>((resolve, reject) => {
                writeStream.on('finish', resolve);
                writeStream.on('error', reject);
            });

            await unlink(testFile);

            logger.info('Local connection test successful');
            return true;
        } catch (error) {
            const message = getErrorMessage(error);
            logger.error({ error: message }, 'Local connection test failed');
            return false;
        }
    }
}
