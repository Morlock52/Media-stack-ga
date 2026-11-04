/**
 * Moving a backup's files between the local temp folder and a destination,
 * shared by backups started from the API, scheduled backups, validate and restore.
 */
import { join } from 'path';
import { unlink } from 'fs/promises';
import type { BackupManifest } from '../../types/backup.js';
import { encryptFile } from '../../utils/encryption.js';
import type { DestinationAdapter, ProgressCallback } from './destinationAdapter.js';
import { itemArchiveName, legacyItemArchiveName, sanitizeItemName } from './backupFiles.js';

export interface UploadBackupOptions {
    /** Folder holding `<item>.tar.gz` archives and `<id>-manifest.json`, as createBackupArchive leaves them. */
    tempDir: string;
    /** Encrypt each archive with this password before upload. */
    encryptionPassword?: string;
    onItem?: (itemName: string, index: number) => void;
    onProgress?: ProgressCallback;
}

/**
 * Upload every item archive under its own `<backupId>-<item>.tar.gz[.enc]` name,
 * then the manifest. The manifest goes last so a backup only shows up in the list
 * once all its archives are there. Local temp files are removed afterwards.
 */
export async function uploadBackupFiles(
    adapter: DestinationAdapter,
    manifest: BackupManifest,
    options: UploadBackupOptions
): Promise<string[]> {
    const encrypted = manifest.encrypted && !!options.encryptionPassword;
    const uploaded: string[] = [];
    const localFiles: string[] = [];

    try {
        for (let i = 0; i < manifest.items.length; i++) {
            const item = manifest.items[i];
            options.onItem?.(item.name, i);

            const plainPath = join(options.tempDir, `${sanitizeItemName(item.name)}.tar.gz`);
            localFiles.push(plainPath);
            let localPath = plainPath;
            if (encrypted) {
                localPath = `${plainPath}.enc`;
                localFiles.push(localPath);
                await encryptFile(plainPath, localPath, options.encryptionPassword!);
            }

            const remoteName = itemArchiveName(manifest.id, item.name, encrypted);
            await adapter.upload(localPath, remoteName, options.onProgress);
            uploaded.push(remoteName);
        }

        const manifestPath = join(options.tempDir, `${manifest.id}-manifest.json`);
        localFiles.push(manifestPath);
        const manifestName = `${manifest.id}-manifest.json`;
        await adapter.upload(manifestPath, manifestName, options.onProgress);
        uploaded.push(manifestName);
        return uploaded;
    } finally {
        for (const file of localFiles) {
            await unlink(file).catch(() => {});
        }
    }
}

/**
 * Download one item's archive for a backup. Tries the per-backup name first,
 * then the shared name older backups used. Returns the name that was found.
 */
export async function downloadItemArchive(
    adapter: DestinationAdapter,
    backupId: string,
    itemName: string,
    encrypted: boolean,
    localPath: string
): Promise<string> {
    const candidates = [itemArchiveName(backupId, itemName, encrypted), legacyItemArchiveName(itemName, encrypted)];
    let lastError: unknown;
    for (const name of candidates) {
        try {
            await adapter.download(name, localPath);
            return name;
        } catch (error) {
            lastError = error;
        }
    }
    throw lastError instanceof Error ? lastError : new Error(`Archive for ${itemName} not found`);
}
