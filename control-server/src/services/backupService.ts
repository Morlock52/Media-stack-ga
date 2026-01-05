/**
 * Backup Service
 * Core backup functionality: discovery, archiving, manifest generation
 */

import { createHash } from 'crypto';
import { createReadStream } from 'fs';
import { mkdir, stat, writeFile } from 'fs/promises';
import { join } from 'path';
import { pipeline } from 'stream/promises';
import { runCommand } from '../utils/docker.js';
import { createLogger } from '../utils/logger.js';
import { PROJECT_ROOT } from '../utils/env.js';
import type {
    BackupItem,
    BackupManifest,
    BackupManifestItem,
    BackupConfig,
    BackupProgress,
} from '../types/backup.js';

const logger = createLogger('backupService');

const BACKUP_DIR = join(PROJECT_ROOT, 'data', 'backups');
const TEMP_DIR = join(PROJECT_ROOT, 'data', 'temp');

/**
 * Ensure backup directories exist
 */
async function ensureDirectories(): Promise<void> {
    await mkdir(BACKUP_DIR, { recursive: true });
    await mkdir(TEMP_DIR, { recursive: true });
}

/**
 * Calculate checksum for a file
 */
async function calculateChecksum(filePath: string, algorithm: string = 'sha256'): Promise<string> {
    const hash = createHash(algorithm);
    const stream = createReadStream(filePath);

    await pipeline(stream, hash);

    return hash.digest('hex');
}

/**
 * Get list of all Docker volumes
 */
async function getDockerVolumes(): Promise<string[]> {
    try {
        const output = await runCommand(
            'docker',
            ['volume', 'ls', '--format', '{{.Name}}'],
            { timeoutMs: 10_000, label: 'docker:volume:ls' }
        );
        return output.split('\n').filter(Boolean);
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logger.error({ error: message }, 'Failed to list Docker volumes');
        throw new Error('Failed to list Docker volumes');
    }
}

/**
 * Get list of running containers
 */
async function getRunningContainers(): Promise<Array<{ name: string; id: string }>> {
    try {
        const output = await runCommand(
            'docker',
            ['ps', '--format', '{{.Names}}|{{.ID}}'],
            { timeoutMs: 10_000, label: 'docker:ps' }
        );

        return output
            .split('\n')
            .filter(Boolean)
            .map(line => {
                const [name, id] = line.split('|');
                return { name, id };
            });
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logger.error({ error: message }, 'Failed to list running containers');
        throw new Error('Failed to list running containers');
    }
}

/**
 * Get volume mount information for a container
 */
async function getContainerVolumes(containerName: string): Promise<Array<{ source: string; destination: string; type: string }>> {
    try {
        const output = await runCommand(
            'docker',
            ['inspect', '-f', '{{json .Mounts}}', containerName],
            { timeoutMs: 5_000, label: `docker:inspect:${containerName}` }
        );

        const mounts = JSON.parse(output);
        return mounts.map((mount: any) => ({
            source: mount.Source || mount.Name,
            destination: mount.Destination,
            type: mount.Type,
        }));
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logger.warn({ containerName, error: message }, 'Failed to inspect container volumes');
        return [];
    }
}

/**
 * Get size of a Docker volume in bytes
 */
async function getVolumeSize(volumeName: string): Promise<number> {
    try {
        // Use a temporary alpine container to get volume size
        const output = await runCommand(
            'docker',
            [
                'run',
                '--rm',
                '-v', `${volumeName}:/data:ro`,
                'alpine',
                'du',
                '-sb',
                '/data'
            ],
            { timeoutMs: 30_000, label: `docker:volume:size:${volumeName}` }
        );

        // Output format: "12345678\t/data"
        const sizeStr = output.split('\t')[0];
        return parseInt(sizeStr, 10) || 0;
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logger.warn({ volumeName, error: message }, 'Failed to get volume size');
        return 0;
    }
}

/**
 * Get size of a path inside a container in bytes
 */
async function getContainerPathSize(containerName: string, path: string): Promise<number> {
    try {
        const output = await runCommand(
            'docker',
            ['exec', containerName, 'du', '-sb', path],
            { timeoutMs: 30_000, label: `docker:exec:du:${containerName}` }
        );

        // Output format: "12345678\t/path"
        const sizeStr = output.split('\t')[0];
        return parseInt(sizeStr, 10) || 0;
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logger.warn({ containerName, path, error: message }, 'Failed to get container path size');
        return 0;
    }
}

/**
 * Check if a file/directory exists in a container
 */
async function containerPathExists(containerName: string, path: string): Promise<boolean> {
    try {
        await runCommand(
            'docker',
            ['exec', containerName, 'test', '-e', path],
            { timeoutMs: 5_000, label: `docker:exec:test:${containerName}` }
        );
        return true;
    } catch {
        return false;
    }
}

/**
 * Discover backup targets from running containers
 */
export async function discoverBackupTargets(): Promise<BackupItem[]> {
    logger.info('Discovering backup targets...');
    const targets: BackupItem[] = [];

    try {
        // Get running containers
        const containers = await getRunningContainers();
        logger.debug({ containerCount: containers.length }, 'Found running containers');

        // Common config paths for media stack services
        const commonConfigPaths: Array<{ service: string; path: string; type: 'config' | 'database' | 'metadata' }> = [
            // *Arr applications
            { service: 'sonarr', path: '/config', type: 'config' },
            { service: 'sonarr', path: '/config/sonarr.db', type: 'database' },
            { service: 'radarr', path: '/config', type: 'config' },
            { service: 'radarr', path: '/config/radarr.db', type: 'database' },
            { service: 'prowlarr', path: '/config', type: 'config' },
            { service: 'prowlarr', path: '/config/prowlarr.db', type: 'database' },
            { service: 'lidarr', path: '/config', type: 'config' },
            { service: 'lidarr', path: '/config/lidarr.db', type: 'database' },
            { service: 'readarr', path: '/config', type: 'config' },
            { service: 'readarr', path: '/config/readarr.db', type: 'database' },
            { service: 'bazarr', path: '/config', type: 'config' },
            { service: 'bazarr', path: '/config/db/bazarr.db', type: 'database' },

            // Media servers
            { service: 'plex', path: '/config/Library/Application Support/Plex Media Server', type: 'metadata' },
            { service: 'jellyfin', path: '/config', type: 'config' },
            { service: 'jellyfin', path: '/config/data/library.db', type: 'database' },
            { service: 'emby', path: '/config', type: 'config' },

            // Download clients
            { service: 'qbittorrent', path: '/config', type: 'config' },
            { service: 'deluge', path: '/config', type: 'config' },
            { service: 'transmission', path: '/config', type: 'config' },
            { service: 'sabnzbd', path: '/config', type: 'config' },
            { service: 'nzbget', path: '/config', type: 'config' },

            // Indexers
            { service: 'jackett', path: '/config', type: 'config' },

            // Request management
            { service: 'overseerr', path: '/app/config', type: 'config' },
            { service: 'overseerr', path: '/app/config/db/db.sqlite3', type: 'database' },
            { service: 'jellyseerr', path: '/app/config', type: 'config' },
            { service: 'jellyseerr', path: '/app/config/db/db.sqlite3', type: 'database' },
            { service: 'ombi', path: '/config', type: 'config' },

            // Monitoring
            { service: 'tautulli', path: '/config', type: 'config' },
            { service: 'tautulli', path: '/config/tautulli.db', type: 'database' },
        ];

        // Discover configs from containers
        for (const container of containers) {
            const serviceName = container.name.toLowerCase().replace(/^mediastack[-_]/, '');

            // Check common config paths
            for (const pathConfig of commonConfigPaths) {
                if (serviceName.includes(pathConfig.service)) {
                    const exists = await containerPathExists(container.name, pathConfig.path);
                    if (exists) {
                        const size = await getContainerPathSize(container.name, pathConfig.path);
                        targets.push({
                            type: pathConfig.type,
                            name: `${pathConfig.service}-${pathConfig.type}`,
                            path: `${container.name}:${pathConfig.path}`,
                            service: pathConfig.service,
                            estimatedSize: size,
                        });
                        logger.debug({
                            service: pathConfig.service,
                            path: pathConfig.path,
                            size,
                        }, 'Discovered backup target');
                    }
                }
            }

            // Get volume mounts
            const volumes = await getContainerVolumes(container.name);
            for (const volume of volumes) {
                if (volume.type === 'volume') {
                    // Only add if not already discovered as a config
                    const existing = targets.find(t => t.path.includes(volume.source));
                    if (!existing) {
                        const size = await getVolumeSize(volume.source);
                        targets.push({
                            type: 'volume',
                            name: volume.source,
                            path: volume.source,
                            service: serviceName,
                            estimatedSize: size,
                        });
                    }
                }
            }
        }

        logger.info({ targetCount: targets.length }, 'Discovery complete');
        return targets;
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logger.error({ error: message }, 'Failed to discover backup targets');
        throw new Error(`Failed to discover backup targets: ${message}`);
    }
}

/**
 * Calculate total size of backup items
 */
export async function calculateBackupSize(items: BackupItem[]): Promise<number> {
    logger.info({ itemCount: items.length }, 'Calculating backup size...');

    let totalSize = 0;

    for (const item of items) {
        if (item.estimatedSize) {
            totalSize += item.estimatedSize;
        } else {
            // Try to calculate size if not already estimated
            try {
                if (item.type === 'volume') {
                    const size = await getVolumeSize(item.path);
                    totalSize += size;
                } else if (item.path.includes(':')) {
                    // Container path format: "containerName:/path"
                    const [containerName, containerPath] = item.path.split(':');
                    const size = await getContainerPathSize(containerName, containerPath);
                    totalSize += size;
                }
            } catch (error) {
                logger.warn({ item: item.name }, 'Failed to calculate item size');
            }
        }
    }

    logger.info({ totalSize }, 'Size calculation complete');
    return totalSize;
}

/**
 * Create a compressed tar archive from a Docker volume
 */
async function archiveVolume(volumeName: string, outputPath: string): Promise<void> {
    logger.debug({ volumeName, outputPath }, 'Archiving Docker volume...');

    try {
        // Use docker run with volume mounted to create tar archive
        await runCommand(
            'docker',
            [
                'run',
                '--rm',
                '-v', `${volumeName}:/source:ro`,
                '-v', `${TEMP_DIR}:/backup`,
                'alpine',
                'tar',
                'czf',
                `/backup/${volumeName}.tar.gz`,
                '-C', '/source',
                '.'
            ],
            { timeoutMs: 300_000, label: `docker:volume:archive:${volumeName}` }
        );

        logger.debug({ volumeName }, 'Volume archived successfully');
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logger.error({ volumeName, error: message }, 'Failed to archive volume');
        throw new Error(`Failed to archive volume ${volumeName}: ${message}`);
    }
}

/**
 * Create a compressed tar archive from a container path
 */
async function archiveContainerPath(containerName: string, containerPath: string, outputPath: string): Promise<void> {
    logger.debug({ containerName, containerPath, outputPath }, 'Archiving container path...');

    try {
        // Create tar.gz inside the container
        const tarFileName = `${containerName}-${containerPath.replace(/\//g, '_')}.tar.gz`;
        const tempTarPath = `/tmp/${tarFileName}`;

        // Create archive inside container
        await runCommand(
            'docker',
            [
                'exec',
                containerName,
                'tar',
                'czf',
                tempTarPath,
                '-C', containerPath,
                '.'
            ],
            { timeoutMs: 300_000, label: `docker:exec:tar:${containerName}` }
        );

        // Copy archive out of container
        await runCommand(
            'docker',
            [
                'cp',
                `${containerName}:${tempTarPath}`,
                outputPath
            ],
            { timeoutMs: 60_000, label: `docker:cp:${containerName}` }
        );

        // Clean up temp file in container
        await runCommand(
            'docker',
            ['exec', containerName, 'rm', tempTarPath],
            { timeoutMs: 5_000, label: `docker:exec:rm:${containerName}` }
        ).catch(() => {
            // Ignore cleanup errors
            logger.debug({ containerName, tempTarPath }, 'Failed to cleanup temp file');
        });

        logger.debug({ containerName, containerPath }, 'Container path archived successfully');
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logger.error({ containerName, containerPath, error: message }, 'Failed to archive container path');
        throw new Error(`Failed to archive ${containerName}:${containerPath}: ${message}`);
    }
}

/**
 * Create backup archive from backup items
 */
export async function createBackupArchive(
    config: BackupConfig,
    progressCallback?: (progress: Partial<BackupProgress>) => void
): Promise<{ archivePath: string; manifest: BackupManifest }> {
    logger.info({ itemCount: config.items.length }, 'Creating backup archive...');
    await ensureDirectories();

    const backupId = `backup-${Date.now()}`;
    const backupDir = join(TEMP_DIR, backupId);
    await mkdir(backupDir, { recursive: true });

    const manifestItems: BackupManifestItem[] = [];
    let processedItems = 0;

    try {
        // Archive each item
        for (const item of config.items) {
            processedItems++;
            if (progressCallback) {
                progressCallback({
                    status: 'archiving',
                    currentOperation: `Archiving ${item.name}...`,
                    currentItem: item.name,
                    itemsProcessed: processedItems,
                    itemsTotal: config.items.length,
                });
            }

            let archivePath: string;
            const sanitizedName = item.name.replace(/[^a-zA-Z0-9_-]/g, '_');

            if (item.type === 'volume') {
                archivePath = join(TEMP_DIR, `${sanitizedName}.tar.gz`);
                await archiveVolume(item.path, archivePath);
            } else if (item.path.includes(':')) {
                const [containerName, containerPath] = item.path.split(':');
                archivePath = join(TEMP_DIR, `${sanitizedName}.tar.gz`);
                await archiveContainerPath(containerName, containerPath, archivePath);
            } else {
                throw new Error(`Invalid item path format: ${item.path}`);
            }

            // Calculate checksum
            const checksum = await calculateChecksum(archivePath);
            const stats = await stat(archivePath);

            manifestItems.push({
                type: item.type,
                name: item.name,
                path: item.path,
                service: item.service,
                size: item.estimatedSize || stats.size,
                checksum,
                compressedSize: stats.size,
            });

            logger.debug({
                item: item.name,
                size: stats.size,
                checksum,
            }, 'Item archived and checksummed');
        }

        // Create manifest
        const manifest: BackupManifest = {
            id: backupId,
            version: '1.0',
            createdAt: new Date().toISOString(),
            name: config.name || backupId,
            items: manifestItems,
            totalSize: manifestItems.reduce((sum, item) => sum + item.size, 0),
            totalCompressedSize: manifestItems.reduce((sum, item) => sum + (item.compressedSize || 0), 0),
            encrypted: config.encryption.enabled,
            encryptionAlgorithm: config.encryption.enabled ? 'aes-256-gcm' : undefined,
            checksumAlgorithm: 'sha256',
            metadata: {
                hostname: await getHostname(),
                dockerVersion: await getDockerVersion(),
            },
        };

        // Write manifest
        const manifestPath = join(TEMP_DIR, `${backupId}-manifest.json`);
        await writeFile(manifestPath, JSON.stringify(manifest, null, 2));

        logger.info({
            backupId,
            itemCount: manifestItems.length,
            totalSize: manifest.totalSize,
            compressedSize: manifest.totalCompressedSize,
        }, 'Backup archive created successfully');

        return { archivePath: backupDir, manifest };
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logger.error({ error: message }, 'Failed to create backup archive');
        throw new Error(`Failed to create backup archive: ${message}`);
    }
}

/**
 * Generate backup manifest
 */
export async function generateManifest(
    backupId: string,
    items: BackupItem[],
    archivePaths: Map<string, string>
): Promise<BackupManifest> {
    logger.info({ backupId, itemCount: items.length }, 'Generating backup manifest...');

    const manifestItems: BackupManifestItem[] = [];

    for (const item of items) {
        const archivePath = archivePaths.get(item.name);
        if (!archivePath) {
            throw new Error(`Archive path not found for item: ${item.name}`);
        }

        const checksum = await calculateChecksum(archivePath);
        const stats = await stat(archivePath);

        manifestItems.push({
            type: item.type,
            name: item.name,
            path: item.path,
            service: item.service,
            size: item.estimatedSize || stats.size,
            checksum,
            compressedSize: stats.size,
        });
    }

    const manifest: BackupManifest = {
        id: backupId,
        version: '1.0',
        createdAt: new Date().toISOString(),
        name: backupId,
        items: manifestItems,
        totalSize: manifestItems.reduce((sum, item) => sum + item.size, 0),
        totalCompressedSize: manifestItems.reduce((sum, item) => sum + (item.compressedSize || 0), 0),
        encrypted: false,
        checksumAlgorithm: 'sha256',
        metadata: {
            hostname: await getHostname(),
            dockerVersion: await getDockerVersion(),
        },
    };

    logger.info({ backupId }, 'Manifest generated successfully');
    return manifest;
}

/**
 * Validate backup integrity by checking checksums
 */
export async function validateBackup(manifest: BackupManifest, backupDir: string): Promise<{ valid: boolean; errors: string[] }> {
    logger.info({ backupId: manifest.id }, 'Validating backup integrity...');

    const errors: string[] = [];

    for (const item of manifest.items) {
        const sanitizedName = item.name.replace(/[^a-zA-Z0-9_-]/g, '_');
        const archivePath = join(backupDir, `${sanitizedName}.tar.gz`);

        try {
            const checksum = await calculateChecksum(archivePath, manifest.checksumAlgorithm);

            if (checksum !== item.checksum) {
                errors.push(`Checksum mismatch for ${item.name}: expected ${item.checksum}, got ${checksum}`);
            }
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            errors.push(`Failed to validate ${item.name}: ${message}`);
        }
    }

    const valid = errors.length === 0;
    logger.info({ backupId: manifest.id, valid, errorCount: errors.length }, 'Validation complete');

    return { valid, errors };
}

/**
 * Get hostname
 */
async function getHostname(): Promise<string> {
    try {
        const output = await runCommand('hostname', [], { timeoutMs: 5_000, label: 'hostname' });
        return output.trim();
    } catch {
        return 'unknown';
    }
}

/**
 * Get Docker version
 */
async function getDockerVersion(): Promise<string> {
    try {
        const output = await runCommand('docker', ['--version'], { timeoutMs: 5_000, label: 'docker:version' });
        return output.trim();
    } catch {
        return 'unknown';
    }
}

/**
 * Clean up temporary files
 */
export async function cleanupTempFiles(backupId: string): Promise<void> {
    logger.debug({ backupId }, 'Cleaning up temporary files...');

    try {
        const backupDir = join(TEMP_DIR, backupId);
        await runCommand('rm', ['-rf', backupDir], { timeoutMs: 30_000, label: 'cleanup:temp' });
        logger.debug({ backupId }, 'Temporary files cleaned up');
    } catch (error) {
        logger.warn({ backupId }, 'Failed to clean up temporary files');
    }
}

/**
 * Extract backup archive to a directory
 */
export async function extractBackupArchive(archivePath: string, targetDir: string): Promise<void> {
    logger.info({ archivePath, targetDir }, 'Extracting backup archive...');

    try {
        await mkdir(targetDir, { recursive: true });

        await runCommand(
            'tar',
            ['-xzf', archivePath, '-C', targetDir],
            { timeoutMs: 300_000, label: 'tar:extract' }
        );

        logger.info({ archivePath, targetDir }, 'Archive extracted successfully');
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logger.error({ error: message, archivePath }, 'Failed to extract archive');
        throw new Error(`Failed to extract archive: ${message}`);
    }
}

/**
 * Restore files to a Docker volume
 */
export async function restoreToVolume(volumeName: string, sourcePath: string): Promise<void> {
    logger.info({ volumeName, sourcePath }, 'Restoring to Docker volume...');

    try {
        await runCommand(
            'docker',
            [
                'run',
                '--rm',
                '-v', `${volumeName}:/target`,
                '-v', `${sourcePath}:/source:ro`,
                'alpine',
                'sh', '-c', 'cp -a /source/. /target/',
            ],
            { timeoutMs: 600_000, label: `docker:restore:volume:${volumeName}` }
        );

        logger.info({ volumeName }, 'Volume restored successfully');
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logger.error({ error: message, volumeName }, 'Failed to restore volume');
        throw new Error(`Failed to restore volume ${volumeName}: ${message}`);
    }
}

/**
 * Restore files to a container path
 */
export async function restoreToContainerPath(containerName: string, containerPath: string, sourcePath: string): Promise<void> {
    logger.info({ containerName, containerPath, sourcePath }, 'Restoring to container path...');

    try {
        await runCommand(
            'docker',
            ['cp', `${sourcePath}/.`, `${containerName}:${containerPath}`],
            { timeoutMs: 600_000, label: `docker:restore:container:${containerName}` }
        );

        logger.info({ containerName, containerPath }, 'Container path restored successfully');
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logger.error({ error: message, containerName, containerPath }, 'Failed to restore container path');
        throw new Error(`Failed to restore to container ${containerName}:${containerPath}: ${message}`);
    }
}

/**
 * Stop a Docker container
 */
export async function stopContainer(containerName: string): Promise<void> {
    logger.info({ containerName }, 'Stopping container...');

    try {
        await runCommand(
            'docker',
            ['stop', containerName],
            { timeoutMs: 60_000, label: `docker:stop:${containerName}` }
        );

        logger.info({ containerName }, 'Container stopped successfully');
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logger.error({ error: message, containerName }, 'Failed to stop container');
        throw new Error(`Failed to stop container ${containerName}: ${message}`);
    }
}

/**
 * Start a Docker container
 */
export async function startContainer(containerName: string): Promise<void> {
    logger.info({ containerName }, 'Starting container...');

    try {
        await runCommand(
            'docker',
            ['start', containerName],
            { timeoutMs: 60_000, label: `docker:start:${containerName}` }
        );

        logger.info({ containerName }, 'Container started successfully');
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logger.error({ error: message, containerName }, 'Failed to start container');
        throw new Error(`Failed to start container ${containerName}: ${message}`);
    }
}
