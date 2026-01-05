/**
 * Destination Adapter Interface
 * Base interface for backup destination adapters (local, S3, rclone)
 */

import type { BackupDestination } from '../../types/backup.js';

/**
 * File metadata for backup listings
 */
export interface BackupFileInfo {
    id: string;
    name: string;
    size: number;
    createdAt: Date;
    path: string;
}

/**
 * Progress callback for upload/download operations
 */
export interface TransferProgress {
    bytesTransferred: number;
    totalBytes: number;
    percentage: number;
}

export type ProgressCallback = (progress: TransferProgress) => void;

/**
 * Base interface for all destination adapters
 */
export interface DestinationAdapter {
    /**
     * Upload a file to the destination
     *
     * @param localPath - Local file path to upload
     * @param remotePath - Remote path/key for the file
     * @param progressCallback - Optional callback for progress updates
     */
    upload(localPath: string, remotePath: string, progressCallback?: ProgressCallback): Promise<void>;

    /**
     * Download a file from the destination
     *
     * @param remotePath - Remote path/key of the file
     * @param localPath - Local path to save the file
     * @param progressCallback - Optional callback for progress updates
     */
    download(remotePath: string, localPath: string, progressCallback?: ProgressCallback): Promise<void>;

    /**
     * List all backup files at the destination
     *
     * @param prefix - Optional path prefix to filter results
     * @returns Array of backup file metadata
     */
    list(prefix?: string): Promise<BackupFileInfo[]>;

    /**
     * Delete a file from the destination
     *
     * @param remotePath - Remote path/key of the file to delete
     */
    delete(remotePath: string): Promise<void>;

    /**
     * Test connection to the destination
     *
     * @returns True if connection is successful
     */
    testConnection(): Promise<boolean>;
}

/**
 * Factory function to create the appropriate adapter for a destination
 */
export async function createAdapter(destination: BackupDestination): Promise<DestinationAdapter> {
    switch (destination.type) {
        case 'local': {
            const { LocalAdapter } = await import('./localAdapter.js');
            return new LocalAdapter(destination);
        }
        case 's3': {
            const { S3Adapter } = await import('./s3Adapter.js');
            return new S3Adapter(destination);
        }
        case 'rclone': {
            const { RcloneAdapter } = await import('./rcloneAdapter.js');
            return new RcloneAdapter(destination);
        }
        default:
            // TypeScript exhaustiveness check
            const _exhaustive: never = destination;
            throw new Error(`Unknown destination type: ${(_exhaustive as BackupDestination).type}`);
    }
}
