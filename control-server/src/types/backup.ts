import { z } from 'zod';

/**
 * Backup and Restore Type Definitions
 * Types for backup destinations, configurations, manifests, and progress tracking
 */

// ============================================================================
// Destination Types
// ============================================================================

export type DestinationType = 'local' | 's3' | 'rclone';

export interface LocalDestination {
    type: 'local';
    path: string;
}

export interface S3Destination {
    type: 's3';
    endpoint: string;
    bucket: string;
    region?: string;
    accessKeyId: string;
    secretAccessKey: string;
    pathPrefix?: string;
}

export interface RcloneDestination {
    type: 'rclone';
    remoteName: string;
    remotePath: string;
}

export type BackupDestination = LocalDestination | S3Destination | RcloneDestination;

// ============================================================================
// Backup Configuration
// ============================================================================

export type BackupItemType = 'config' | 'volume' | 'database' | 'metadata';

export interface BackupItem {
    type: BackupItemType;
    name: string;
    path: string;
    service?: string;
    estimatedSize?: number;
}

export interface EncryptionConfig {
    enabled: boolean;
    password?: string;
}

export interface BackupConfig {
    destination: BackupDestination;
    items: BackupItem[];
    encryption: EncryptionConfig;
    compress: boolean;
    name?: string;
}

// ============================================================================
// Backup Manifest
// ============================================================================

export interface BackupManifestItem {
    type: BackupItemType;
    name: string;
    path: string;
    service?: string;
    size: number;
    checksum: string;
    compressedSize?: number;
}

export interface BackupManifest {
    id: string;
    version: string;
    createdAt: string;
    name: string;
    items: BackupManifestItem[];
    totalSize: number;
    totalCompressedSize: number;
    encrypted: boolean;
    encryptionAlgorithm?: string;
    checksumAlgorithm: string;
    metadata: {
        hostname?: string;
        dockerVersion?: string;
        composeVersion?: string;
    };
}

// ============================================================================
// Backup Progress Tracking
// ============================================================================

export type BackupStatus = 'initializing' | 'discovering' | 'archiving' | 'encrypting' | 'uploading' | 'completed' | 'failed';

export interface BackupProgress {
    id: string;
    status: BackupStatus;
    currentOperation: string;
    currentItem?: string;
    itemsProcessed: number;
    itemsTotal: number;
    bytesProcessed: number;
    bytesTotal: number;
    startedAt: string;
    estimatedCompletionAt?: string;
    transferSpeed?: number;
    error?: string;
}

// ============================================================================
// Restore Types
// ============================================================================

export type RestoreStatus = 'initializing' | 'downloading' | 'validating' | 'decrypting' | 'extracting' | 'applying' | 'completed' | 'failed';

export interface RestoreProgress {
    id: string;
    status: RestoreStatus;
    currentOperation: string;
    currentItem?: string;
    itemsProcessed: number;
    itemsTotal: number;
    bytesProcessed: number;
    bytesTotal: number;
    startedAt: string;
    estimatedCompletionAt?: string;
    error?: string;
}

export interface RestoreConfig {
    backupId: string;
    destination: BackupDestination;
    items?: string[];
    stopServices: boolean;
    backupBeforeRestore: boolean;
    decryptionPassword?: string;
}

// ============================================================================
// Backup Schedule
// ============================================================================

export type ScheduleFrequency = 'daily' | 'weekly' | 'monthly';

export interface BackupSchedule {
    id: string;
    enabled: boolean;
    frequency: ScheduleFrequency;
    time: string;
    config: BackupConfig;
    retentionCount: number;
    lastRun?: string;
    nextRun?: string;
}

// ============================================================================
// Backup History
// ============================================================================

export interface BackupHistoryEntry {
    id: string;
    name: string;
    createdAt: string;
    size: number;
    compressedSize: number;
    encrypted: boolean;
    itemCount: number;
    destination: BackupDestination;
    status: 'completed' | 'failed';
    error?: string;
}

// ============================================================================
// Zod Validation Schemas
// ============================================================================

export const LocalDestinationSchema = z.object({
    type: z.literal('local'),
    path: z.string().min(1).max(500),
});

export const S3DestinationSchema = z.object({
    type: z.literal('s3'),
    endpoint: z.string().url().max(500),
    bucket: z.string().min(1).max(255),
    region: z.string().max(100).optional(),
    accessKeyId: z.string().min(1).max(255),
    secretAccessKey: z.string().min(1).max(255),
    pathPrefix: z.string().max(500).optional(),
});

export const RcloneDestinationSchema = z.object({
    type: z.literal('rclone'),
    remoteName: z.string().min(1).max(255),
    remotePath: z.string().min(1).max(500),
});

export const BackupDestinationSchema = z.discriminatedUnion('type', [
    LocalDestinationSchema,
    S3DestinationSchema,
    RcloneDestinationSchema,
]);

export const BackupItemSchema = z.object({
    type: z.enum(['config', 'volume', 'database', 'metadata']),
    name: z.string().min(1).max(255),
    path: z.string().min(1).max(500),
    service: z.string().max(100).optional(),
    estimatedSize: z.number().int().min(0).optional(),
});

export const EncryptionConfigSchema = z.object({
    enabled: z.boolean(),
    password: z.string().min(8).max(255).optional(),
}).refine(
    (data) => !data.enabled || (data.enabled && data.password && data.password.length >= 8),
    {
        message: 'Password is required when encryption is enabled and must be at least 8 characters',
        path: ['password'],
    }
);

export const BackupConfigSchema = z.object({
    destination: BackupDestinationSchema,
    items: z.array(BackupItemSchema).min(1).max(1000),
    encryption: EncryptionConfigSchema,
    compress: z.boolean().default(true),
    name: z.string().max(255).optional(),
});

export const RestoreConfigSchema = z.object({
    backupId: z.string().min(1).max(255),
    destination: BackupDestinationSchema,
    items: z.array(z.string().max(255)).max(1000).optional(),
    stopServices: z.boolean().default(true),
    backupBeforeRestore: z.boolean().default(true),
    decryptionPassword: z.string().min(8).max(255).optional(),
});

export const BackupScheduleSchema = z.object({
    id: z.string().max(255).optional(),
    enabled: z.boolean(),
    frequency: z.enum(['daily', 'weekly', 'monthly']),
    time: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Time must be in HH:MM format'),
    config: BackupConfigSchema,
    retentionCount: z.number().int().min(1).max(100),
    lastRun: z.string().datetime().optional(),
    nextRun: z.string().datetime().optional(),
});

export const BackupValidateRequestSchema = z.object({
    backupId: z.string().min(1).max(255),
    destination: BackupDestinationSchema,
    decryptionPassword: z.string().min(8).max(255).optional(),
});

export const BackupDeleteRequestSchema = z.object({
    backupId: z.string().min(1).max(255),
    destination: BackupDestinationSchema,
});

export const BackupListRequestSchema = z.object({
    destination: BackupDestinationSchema,
    limit: z.number().int().min(1).max(1000).optional(),
    offset: z.number().int().min(0).optional(),
});

export const RestorePreviewRequestSchema = z.object({
    backupId: z.string().min(1).max(255),
    destination: BackupDestinationSchema,
    decryptionPassword: z.string().min(8).max(255).optional(),
});
