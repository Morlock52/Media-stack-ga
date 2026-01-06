/**
 * S3-Compatible Storage Adapter
 * Handles backup operations to S3-compatible object storage (AWS S3, MinIO, etc.)
 */

import { createReadStream, createWriteStream } from 'fs';
import { stat, unlink } from 'fs/promises';
import { createLogger } from '../../utils/logger.js';
import { getErrorMessage } from '../../utils/errors.js';
import type { S3Destination } from '../../types/backup.js';
import type {
    DestinationAdapter,
    BackupFileInfo,
    ProgressCallback,
} from './destinationAdapter.js';

const logger = createLogger('s3Adapter');

/**
 * S3-compatible storage adapter for backup operations
 *
 * Note: This adapter requires @aws-sdk/client-s3 to be installed.
 * Install with: npm install @aws-sdk/client-s3
 */
export class S3Adapter implements DestinationAdapter {
    private config: S3Destination;
    private s3Client: any; // Will be typed once @aws-sdk/client-s3 is installed

    constructor(destination: S3Destination) {
        this.config = destination;
        logger.info({
            endpoint: destination.endpoint,
            bucket: destination.bucket,
            region: destination.region,
        }, 'S3 adapter initialized');
    }

    /**
     * Initialize S3 client (lazy loading)
     */
    private async getClient(): Promise<any> {
        if (this.s3Client) {
            return this.s3Client;
        }

        try {
            // Dynamically import AWS SDK
            const { S3Client } = await import('@aws-sdk/client-s3');

            this.s3Client = new S3Client({
                endpoint: this.config.endpoint,
                region: this.config.region || 'us-east-1',
                credentials: {
                    accessKeyId: this.config.accessKeyId,
                    secretAccessKey: this.config.secretAccessKey,
                },
                // Force path style for compatibility with MinIO and other S3-compatible services
                forcePathStyle: true,
            });

            return this.s3Client;
        } catch (error) {
            const message = getErrorMessage(error);
            logger.error({ error: message }, 'Failed to initialize S3 client');

            // Check if it's a missing dependency error
            if (message.includes('Cannot find module')) {
                throw new Error(
                    'AWS SDK not installed. Install with: npm install @aws-sdk/client-s3'
                );
            }

            throw new Error(`Failed to initialize S3 client: ${message}`);
        }
    }

    /**
     * Get full S3 key with optional path prefix
     */
    private getS3Key(path: string): string {
        if (this.config.pathPrefix) {
            return `${this.config.pathPrefix}/${path}`.replace(/\/+/g, '/');
        }
        return path;
    }

    /**
     * Upload a file to S3
     */
    async upload(
        localPath: string,
        remotePath: string,
        progressCallback?: ProgressCallback
    ): Promise<void> {
        logger.info({ localPath, remotePath }, 'Starting S3 upload');

        try {
            const client = await this.getClient();
            const { PutObjectCommand } = await import('@aws-sdk/client-s3');

            // Get file size
            const stats = await stat(localPath);
            const totalBytes = stats.size;

            // Read file
            const fileStream = createReadStream(localPath);
            const key = this.getS3Key(remotePath);

            // Create upload command
            const command = new PutObjectCommand({
                Bucket: this.config.bucket,
                Key: key,
                Body: fileStream,
                ContentLength: totalBytes,
            });

            // Track progress if callback provided
            if (progressCallback) {
                let bytesTransferred = 0;
                fileStream.on('data', (chunk) => {
                    bytesTransferred += chunk.length;
                    progressCallback({
                        bytesTransferred,
                        totalBytes,
                        percentage: Math.round((bytesTransferred / totalBytes) * 100),
                    });
                });
            }

            // Execute upload
            await client.send(command);

            logger.info({ key, size: totalBytes }, 'S3 upload completed');
        } catch (error) {
            const message = getErrorMessage(error);
            logger.error({ error: message, localPath, remotePath }, 'S3 upload failed');
            throw new Error(`Failed to upload to S3: ${message}`);
        }
    }

    /**
     * Download a file from S3
     */
    async download(
        remotePath: string,
        localPath: string,
        progressCallback?: ProgressCallback
    ): Promise<void> {
        logger.info({ remotePath, localPath }, 'Starting S3 download');

        try {
            const client = await this.getClient();
            const { GetObjectCommand } = await import('@aws-sdk/client-s3');

            const key = this.getS3Key(remotePath);

            // Create download command
            const command = new GetObjectCommand({
                Bucket: this.config.bucket,
                Key: key,
            });

            // Execute download
            const response = await client.send(command);

            if (!response.Body) {
                throw new Error('S3 response body is empty');
            }

            // Get content length for progress tracking
            const totalBytes = response.ContentLength || 0;
            let bytesTransferred = 0;

            // Write to file
            const writeStream = createWriteStream(localPath);

            // Track progress
            if (progressCallback && totalBytes > 0) {
                const body = response.Body as any;
                body.on('data', (chunk: Buffer) => {
                    bytesTransferred += chunk.length;
                    progressCallback({
                        bytesTransferred,
                        totalBytes,
                        percentage: Math.round((bytesTransferred / totalBytes) * 100),
                    });
                });
            }

            // Stream to file
            await new Promise<void>((resolve, reject) => {
                const body = response.Body as any;
                body.pipe(writeStream);
                writeStream.on('finish', resolve);
                writeStream.on('error', reject);
                body.on('error', reject);
            });

            logger.info({ localPath, size: totalBytes }, 'S3 download completed');
        } catch (error) {
            const message = getErrorMessage(error);
            logger.error({ error: message, remotePath, localPath }, 'S3 download failed');

            // Clean up partial file on error
            try {
                await unlink(localPath);
            } catch {
                // Ignore cleanup errors
            }

            throw new Error(`Failed to download from S3: ${message}`);
        }
    }

    /**
     * List all backup files in S3
     */
    async list(prefix?: string): Promise<BackupFileInfo[]> {
        logger.info({ prefix }, 'Listing S3 backups');

        try {
            const client = await this.getClient();
            const { ListObjectsV2Command } = await import('@aws-sdk/client-s3');

            const listPrefix = prefix ? this.getS3Key(prefix) : this.config.pathPrefix || '';

            const command = new ListObjectsV2Command({
                Bucket: this.config.bucket,
                Prefix: listPrefix,
            });

            const response = await client.send(command);
            const files: BackupFileInfo[] = [];

            if (response.Contents) {
                for (const object of response.Contents) {
                    if (!object.Key) continue;

                    // Filter for backup files
                    if (object.Key.endsWith('.tar.gz') || object.Key.endsWith('.enc')) {
                        // Remove prefix from key to get relative path
                        let relativePath = object.Key;
                        if (this.config.pathPrefix) {
                            relativePath = object.Key.replace(
                                new RegExp(`^${this.config.pathPrefix}/?`),
                                ''
                            );
                        }

                        // Extract backup ID from filename
                        const filename = object.Key.split('/').pop() || object.Key;
                        const id = filename.replace(/\.(tar\.gz|enc)$/, '');

                        files.push({
                            id,
                            name: filename,
                            size: object.Size || 0,
                            createdAt: object.LastModified || new Date(),
                            path: relativePath,
                        });
                    }
                }
            }

            // Sort by creation time (newest first)
            files.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

            logger.info({ count: files.length }, 'S3 backup listing completed');
            return files;
        } catch (error) {
            const message = getErrorMessage(error);
            logger.error({ error: message, prefix }, 'Failed to list S3 backups');
            throw new Error(`Failed to list S3 backups: ${message}`);
        }
    }

    /**
     * Delete a file from S3
     */
    async delete(remotePath: string): Promise<void> {
        logger.info({ remotePath }, 'Deleting S3 backup');

        try {
            const client = await this.getClient();
            const { DeleteObjectCommand } = await import('@aws-sdk/client-s3');

            const key = this.getS3Key(remotePath);

            const command = new DeleteObjectCommand({
                Bucket: this.config.bucket,
                Key: key,
            });

            await client.send(command);

            logger.info({ key }, 'S3 backup deleted');
        } catch (error) {
            const message = getErrorMessage(error);
            logger.error({ error: message, remotePath }, 'Failed to delete S3 backup');
            throw new Error(`Failed to delete S3 backup: ${message}`);
        }
    }

    /**
     * Test connection to S3
     */
    async testConnection(): Promise<boolean> {
        logger.info({ bucket: this.config.bucket }, 'Testing S3 connection');

        try {
            const client = await this.getClient();
            const { HeadBucketCommand } = await import('@aws-sdk/client-s3');

            // Test bucket access
            const command = new HeadBucketCommand({
                Bucket: this.config.bucket,
            });

            await client.send(command);

            logger.info('S3 connection test successful');
            return true;
        } catch (error) {
            const message = getErrorMessage(error);
            logger.error({ error: message }, 'S3 connection test failed');
            return false;
        }
    }
}
