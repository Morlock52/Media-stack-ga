/**
 * Backup and Restore Hooks
 * React hooks for managing backup and restore operations
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { buildControlServerUrl, controlServerAuthHeaders } from '../utils/controlServer';
import { getErrorMessage } from '../utils/logging';
import type {
    BackupDestination,
    BackupItem,
    BackupProgress,
    RestoreProgress,
    BackupHistoryEntry,
    BackupSchedule,
} from '../store/backupStore';

// ---------------------------------------------------------------------------
// TEST CONNECTION
// ---------------------------------------------------------------------------

export interface TestConnectionResult {
    connected: boolean;
    message?: string;
}

export interface UseTestConnectionResult {
    testConnection: (destination: BackupDestination) => Promise<TestConnectionResult>;
    loading: boolean;
    error: string | null;
    data: TestConnectionResult | null;
}

/**
 * Hook for testing connection to a backup destination
 */
export function useTestConnection(): UseTestConnectionResult {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [data, setData] = useState<TestConnectionResult | null>(null);

    const testConnection = useCallback(async (destination: BackupDestination): Promise<TestConnectionResult> => {
        setLoading(true);
        setError(null);

        try {
            const res = await fetch(buildControlServerUrl('/api/backup/test-connection'), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...controlServerAuthHeaders(),
                },
                body: JSON.stringify(destination),
            });

            if (!res.ok) {
                const body = await res.text().catch(() => '');
                throw new Error(`Failed to test connection (HTTP ${res.status}): ${body || res.statusText}`);
            }

            const result = await res.json();

            const testResult: TestConnectionResult = {
                connected: result.connected || false,
                message: result.message || result.error,
            };

            setData(testResult);
            return testResult;
        } catch (err) {
            const errorMsg = getErrorMessage(err);
            setError(errorMsg);
            throw new Error(errorMsg);
        } finally {
            setLoading(false);
        }
    }, []);

    return { testConnection, loading, error, data };
}

// ---------------------------------------------------------------------------
// BACKUP DISCOVER
// ---------------------------------------------------------------------------

export interface DiscoverResult {
    targets: BackupItem[];
    totalSize: number;
    count: number;
}

export interface UseBackupDiscoverResult {
    discover: () => Promise<DiscoverResult>;
    loading: boolean;
    error: string | null;
    data: DiscoverResult | null;
}

/**
 * Hook for discovering available backup targets
 */
export function useBackupDiscover(): UseBackupDiscoverResult {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [data, setData] = useState<DiscoverResult | null>(null);

    const discover = useCallback(async (): Promise<DiscoverResult> => {
        setLoading(true);
        setError(null);

        try {
            const res = await fetch(buildControlServerUrl('/api/backup/discover'), {
                headers: { ...controlServerAuthHeaders() },
            });

            if (!res.ok) {
                const body = await res.text().catch(() => '');
                throw new Error(`Failed to discover backup targets (HTTP ${res.status}): ${body || res.statusText}`);
            }

            const result = await res.json();

            if (!result.success) {
                throw new Error(result.error || 'Failed to discover backup targets');
            }

            const discoverResult: DiscoverResult = {
                targets: result.targets || [],
                totalSize: result.totalSize || 0,
                count: result.count || 0,
            };

            setData(discoverResult);
            return discoverResult;
        } catch (err) {
            const errorMsg = getErrorMessage(err);
            setError(errorMsg);
            throw new Error(errorMsg);
        } finally {
            setLoading(false);
        }
    }, []);

    return { discover, loading, error, data };
}

// ---------------------------------------------------------------------------
// BACKUP CREATE
// ---------------------------------------------------------------------------

export interface BackupConfig {
    destination: BackupDestination;
    items: BackupItem[];
    encryption: {
        enabled: boolean;
        password?: string;
    };
    name?: string;
    schedule?: {
        enabled: boolean;
        frequency: 'daily' | 'weekly' | 'monthly';
        time: string;
        retentionCount: number;
    };
}

export interface CreateBackupResult {
    backupId: string;
}

export interface UseBackupCreateResult {
    createBackup: (config: BackupConfig) => Promise<CreateBackupResult>;
    loading: boolean;
    error: string | null;
    data: CreateBackupResult | null;
}

/**
 * Hook for creating a new backup
 */
export function useBackupCreate(): UseBackupCreateResult {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [data, setData] = useState<CreateBackupResult | null>(null);

    const createBackup = useCallback(async (config: BackupConfig): Promise<CreateBackupResult> => {
        setLoading(true);
        setError(null);

        try {
            const res = await fetch(buildControlServerUrl('/api/backup/create'), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...controlServerAuthHeaders(),
                },
                body: JSON.stringify(config),
            });

            if (!res.ok) {
                const body = await res.text().catch(() => '');
                throw new Error(`Failed to create backup (HTTP ${res.status}): ${body || res.statusText}`);
            }

            const result = await res.json();

            if (!result.success) {
                throw new Error(result.error || 'Failed to create backup');
            }

            const createResult: CreateBackupResult = {
                backupId: result.backupId,
            };

            setData(createResult);
            return createResult;
        } catch (err) {
            const errorMsg = getErrorMessage(err);
            setError(errorMsg);
            throw new Error(errorMsg);
        } finally {
            setLoading(false);
        }
    }, []);

    return { createBackup, loading, error, data };
}

// ---------------------------------------------------------------------------
// BACKUP PROGRESS (Polling)
// ---------------------------------------------------------------------------

export interface UseBackupProgressResult {
    progress: BackupProgress | null;
    loading: boolean;
    error: string | null;
    startPolling: (backupId: string, interval?: number) => void;
    stopPolling: () => void;
    isPolling: boolean;
}

/**
 * Hook for polling backup progress
 */
export function useBackupProgress(): UseBackupProgressResult {
    const [progress, setProgress] = useState<BackupProgress | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isPolling, setIsPolling] = useState(false);
    const intervalRef = useRef<NodeJS.Timeout | null>(null);
    const backupIdRef = useRef<string | null>(null);

    const fetchProgress = useCallback(async (backupId: string) => {
        try {
            const res = await fetch(buildControlServerUrl(`/api/backup/status/${backupId}`), {
                headers: { ...controlServerAuthHeaders() },
            });

            if (!res.ok) {
                const body = await res.text().catch(() => '');
                throw new Error(`Failed to fetch backup progress (HTTP ${res.status}): ${body || res.statusText}`);
            }

            const result = await res.json();

            if (!result.success) {
                throw new Error(result.error || 'Failed to fetch backup progress');
            }

            setProgress(result.progress);
            setError(null);

            // Stop polling if backup is completed or failed
            if (result.progress.status === 'completed' || result.progress.status === 'failed') {
                if (intervalRef.current) {
                    clearInterval(intervalRef.current);
                    intervalRef.current = null;
                    setIsPolling(false);
                }
            }
        } catch (err) {
            const errorMsg = getErrorMessage(err);
            setError(errorMsg);
        }
    }, []);

    const startPolling = useCallback((backupId: string, interval: number = 1000) => {
        // Stop existing polling if any
        if (intervalRef.current) {
            clearInterval(intervalRef.current);
        }

        backupIdRef.current = backupId;
        setIsPolling(true);
        setLoading(true);

        // Fetch immediately
        fetchProgress(backupId).finally(() => setLoading(false));

        // Start polling
        intervalRef.current = setInterval(() => {
            fetchProgress(backupId);
        }, interval);
    }, [fetchProgress]);

    const stopPolling = useCallback(() => {
        if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
        }
        setIsPolling(false);
        backupIdRef.current = null;
    }, []);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
            }
        };
    }, []);

    return { progress, loading, error, startPolling, stopPolling, isPolling };
}

// ---------------------------------------------------------------------------
// BACKUP LIST
// ---------------------------------------------------------------------------

export interface BackupListOptions {
    destination: BackupDestination;
    limit?: number;
    offset?: number;
}

export interface BackupListResult {
    backups: BackupHistoryEntry[];
    total: number;
    limit: number;
    offset: number;
}

export interface UseBackupListResult {
    listBackups: (options: BackupListOptions) => Promise<BackupListResult>;
    loading: boolean;
    error: string | null;
    data: BackupListResult | null;
}

/**
 * Hook for listing available backups
 */
export function useBackupList(): UseBackupListResult {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [data, setData] = useState<BackupListResult | null>(null);

    const listBackups = useCallback(async (options: BackupListOptions): Promise<BackupListResult> => {
        setLoading(true);
        setError(null);

        try {
            const res = await fetch(buildControlServerUrl('/api/backup/list'), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...controlServerAuthHeaders(),
                },
                body: JSON.stringify(options),
            });

            if (!res.ok) {
                const body = await res.text().catch(() => '');
                throw new Error(`Failed to list backups (HTTP ${res.status}): ${body || res.statusText}`);
            }

            const result = await res.json();

            if (!result.success) {
                throw new Error(result.error || 'Failed to list backups');
            }

            const listResult: BackupListResult = {
                backups: result.backups || [],
                total: result.total || 0,
                limit: result.limit || 100,
                offset: result.offset || 0,
            };

            setData(listResult);
            return listResult;
        } catch (err) {
            const errorMsg = getErrorMessage(err);
            setError(errorMsg);
            throw new Error(errorMsg);
        } finally {
            setLoading(false);
        }
    }, []);

    return { listBackups, loading, error, data };
}

// ---------------------------------------------------------------------------
// RESTORE PREVIEW
// ---------------------------------------------------------------------------

export interface RestorePreviewOptions {
    backupId: string;
    destination: BackupDestination;
    decryptionPassword?: string;
}

export interface BackupPreview {
    id: string;
    name: string;
    createdAt: string;
    totalSize: number;
    totalCompressedSize: number;
    encrypted: boolean;
    items: Array<{
        type: string;
        name: string;
        path: string;
        service?: string;
        size: number;
        compressedSize: number;
    }>;
    metadata?: Record<string, unknown>;
}

export interface UseRestorePreviewResult {
    previewBackup: (options: RestorePreviewOptions) => Promise<BackupPreview>;
    loading: boolean;
    error: string | null;
    data: BackupPreview | null;
}

/**
 * Hook for previewing backup contents before restoring
 */
export function useRestorePreview(): UseRestorePreviewResult {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [data, setData] = useState<BackupPreview | null>(null);

    const previewBackup = useCallback(async (options: RestorePreviewOptions): Promise<BackupPreview> => {
        setLoading(true);
        setError(null);

        try {
            const res = await fetch(buildControlServerUrl('/api/restore/preview'), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...controlServerAuthHeaders(),
                },
                body: JSON.stringify(options),
            });

            if (!res.ok) {
                const body = await res.text().catch(() => '');
                throw new Error(`Failed to preview backup (HTTP ${res.status}): ${body || res.statusText}`);
            }

            const result = await res.json();

            if (!result.success) {
                throw new Error(result.error || 'Failed to preview backup');
            }

            const preview: BackupPreview = result.preview;
            setData(preview);
            return preview;
        } catch (err) {
            const errorMsg = getErrorMessage(err);
            setError(errorMsg);
            throw new Error(errorMsg);
        } finally {
            setLoading(false);
        }
    }, []);

    return { previewBackup, loading, error, data };
}

// ---------------------------------------------------------------------------
// RESTORE EXECUTE
// ---------------------------------------------------------------------------

export interface RestoreConfig {
    backupId: string;
    destination: BackupDestination;
    items?: string[];
    decryptionPassword?: string;
    stopServices?: boolean;
    createPreRestoreBackup?: boolean;
}

export interface ExecuteRestoreResult {
    restoreId: string;
}

export interface UseRestoreExecuteResult {
    executeRestore: (config: RestoreConfig) => Promise<ExecuteRestoreResult>;
    loading: boolean;
    error: string | null;
    data: ExecuteRestoreResult | null;
}

/**
 * Hook for executing a restore operation
 */
export function useRestoreExecute(): UseRestoreExecuteResult {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [data, setData] = useState<ExecuteRestoreResult | null>(null);

    const executeRestore = useCallback(async (config: RestoreConfig): Promise<ExecuteRestoreResult> => {
        setLoading(true);
        setError(null);

        try {
            const res = await fetch(buildControlServerUrl('/api/restore/execute'), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...controlServerAuthHeaders(),
                },
                body: JSON.stringify(config),
            });

            if (!res.ok) {
                const body = await res.text().catch(() => '');
                throw new Error(`Failed to execute restore (HTTP ${res.status}): ${body || res.statusText}`);
            }

            const result = await res.json();

            if (!result.success) {
                throw new Error(result.error || 'Failed to execute restore');
            }

            const restoreResult: ExecuteRestoreResult = {
                restoreId: result.restoreId,
            };

            setData(restoreResult);
            return restoreResult;
        } catch (err) {
            const errorMsg = getErrorMessage(err);
            setError(errorMsg);
            throw new Error(errorMsg);
        } finally {
            setLoading(false);
        }
    }, []);

    return { executeRestore, loading, error, data };
}

// ---------------------------------------------------------------------------
// RESTORE PROGRESS (Polling)
// ---------------------------------------------------------------------------

export interface UseRestoreProgressResult {
    progress: RestoreProgress | null;
    loading: boolean;
    error: string | null;
    startPolling: (restoreId: string, interval?: number) => void;
    stopPolling: () => void;
    isPolling: boolean;
}

/**
 * Hook for polling restore progress
 */
export function useRestoreProgress(): UseRestoreProgressResult {
    const [progress, setProgress] = useState<RestoreProgress | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isPolling, setIsPolling] = useState(false);
    const intervalRef = useRef<NodeJS.Timeout | null>(null);
    const restoreIdRef = useRef<string | null>(null);

    const fetchProgress = useCallback(async (restoreId: string) => {
        try {
            const res = await fetch(buildControlServerUrl(`/api/restore/status/${restoreId}`), {
                headers: { ...controlServerAuthHeaders() },
            });

            if (!res.ok) {
                const body = await res.text().catch(() => '');
                throw new Error(`Failed to fetch restore progress (HTTP ${res.status}): ${body || res.statusText}`);
            }

            const result = await res.json();

            if (!result.success) {
                throw new Error(result.error || 'Failed to fetch restore progress');
            }

            setProgress(result.progress);
            setError(null);

            // Stop polling if restore is completed or failed
            if (result.progress.status === 'completed' || result.progress.status === 'failed') {
                if (intervalRef.current) {
                    clearInterval(intervalRef.current);
                    intervalRef.current = null;
                    setIsPolling(false);
                }
            }
        } catch (err) {
            const errorMsg = getErrorMessage(err);
            setError(errorMsg);
        }
    }, []);

    const startPolling = useCallback((restoreId: string, interval: number = 1000) => {
        // Stop existing polling if any
        if (intervalRef.current) {
            clearInterval(intervalRef.current);
        }

        restoreIdRef.current = restoreId;
        setIsPolling(true);
        setLoading(true);

        // Fetch immediately
        fetchProgress(restoreId).finally(() => setLoading(false));

        // Start polling
        intervalRef.current = setInterval(() => {
            fetchProgress(restoreId);
        }, interval);
    }, [fetchProgress]);

    const stopPolling = useCallback(() => {
        if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
        }
        setIsPolling(false);
        restoreIdRef.current = null;
    }, []);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
            }
        };
    }, []);

    return { progress, loading, error, startPolling, stopPolling, isPolling };
}

// ---------------------------------------------------------------------------
// BACKUP DELETE
// ---------------------------------------------------------------------------

export interface DeleteBackupOptions {
    backupId: string;
    destination: BackupDestination;
}

export interface DeleteBackupResult {
    deletedFiles: string[];
    errors: string[];
}

export interface UseBackupDeleteResult {
    deleteBackup: (options: DeleteBackupOptions) => Promise<DeleteBackupResult>;
    loading: boolean;
    error: string | null;
    data: DeleteBackupResult | null;
}

/**
 * Hook for deleting a backup from destination
 */
export function useBackupDelete(): UseBackupDeleteResult {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [data, setData] = useState<DeleteBackupResult | null>(null);

    const deleteBackup = useCallback(async (options: DeleteBackupOptions): Promise<DeleteBackupResult> => {
        setLoading(true);
        setError(null);

        try {
            const res = await fetch(buildControlServerUrl(`/api/backup/${options.backupId}`), {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                    ...controlServerAuthHeaders(),
                },
                body: JSON.stringify({ destination: options.destination }),
            });

            if (!res.ok) {
                const body = await res.text().catch(() => '');
                throw new Error(`Failed to delete backup (HTTP ${res.status}): ${body || res.statusText}`);
            }

            const result = await res.json();

            if (!result.success) {
                throw new Error(result.error || 'Failed to delete backup');
            }

            const deleteResult: DeleteBackupResult = {
                deletedFiles: result.deletedFiles || [],
                errors: result.errors || [],
            };

            setData(deleteResult);
            return deleteResult;
        } catch (err) {
            const errorMsg = getErrorMessage(err);
            setError(errorMsg);
            throw new Error(errorMsg);
        } finally {
            setLoading(false);
        }
    }, []);

    return { deleteBackup, loading, error, data };
}

// ---------------------------------------------------------------------------
// SCHEDULE MANAGEMENT
// ---------------------------------------------------------------------------

export interface ScheduleHealth {
    lastAttempt: string;
    lastSuccess?: string;
    lastError?: string;
    consecutiveFailures: number;
}

export interface GetSchedulesResult {
    schedules: BackupSchedule[];
    health: Record<string, ScheduleHealth>;
}

export interface UseScheduleListResult {
    getSchedules: () => Promise<GetSchedulesResult>;
    loading: boolean;
    error: string | null;
    data: GetSchedulesResult | null;
}

/**
 * Hook for getting all backup schedules
 */
export function useScheduleList(): UseScheduleListResult {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [data, setData] = useState<GetSchedulesResult | null>(null);

    const getSchedules = useCallback(async (): Promise<GetSchedulesResult> => {
        setLoading(true);
        setError(null);

        try {
            const res = await fetch(buildControlServerUrl('/api/backup/schedules'), {
                headers: { ...controlServerAuthHeaders() },
            });

            if (!res.ok) {
                const body = await res.text().catch(() => '');
                throw new Error(`Failed to get schedules (HTTP ${res.status}): ${body || res.statusText}`);
            }

            const result = await res.json();

            if (!result.success) {
                throw new Error(result.error || 'Failed to get schedules');
            }

            const scheduleResult: GetSchedulesResult = {
                schedules: result.schedules || [],
                health: result.health || {},
            };

            setData(scheduleResult);
            return scheduleResult;
        } catch (err) {
            const errorMsg = getErrorMessage(err);
            setError(errorMsg);
            throw new Error(errorMsg);
        } finally {
            setLoading(false);
        }
    }, []);

    return { getSchedules, loading, error, data };
}

export interface CreateScheduleData {
    destination: BackupDestination;
    items: BackupItem[];
    enabled: boolean;
    frequency: 'daily' | 'weekly' | 'monthly';
    time: string;
    retentionCount: number;
    encryption?: {
        enabled: boolean;
        password?: string;
    };
    name?: string;
}

export interface UseScheduleCreateResult {
    createSchedule: (data: CreateScheduleData) => Promise<BackupSchedule>;
    loading: boolean;
    error: string | null;
    data: BackupSchedule | null;
}

/**
 * Hook for creating a new backup schedule
 */
export function useScheduleCreate(): UseScheduleCreateResult {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [data, setData] = useState<BackupSchedule | null>(null);

    const createSchedule = useCallback(async (scheduleData: CreateScheduleData): Promise<BackupSchedule> => {
        setLoading(true);
        setError(null);

        try {
            const res = await fetch(buildControlServerUrl('/api/backup/schedules'), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...controlServerAuthHeaders(),
                },
                body: JSON.stringify(scheduleData),
            });

            if (!res.ok) {
                const body = await res.text().catch(() => '');
                throw new Error(`Failed to create schedule (HTTP ${res.status}): ${body || res.statusText}`);
            }

            const result = await res.json();

            if (!result.success) {
                throw new Error(result.error || 'Failed to create schedule');
            }

            const schedule: BackupSchedule = result.schedule;
            setData(schedule);
            return schedule;
        } catch (err) {
            const errorMsg = getErrorMessage(err);
            setError(errorMsg);
            throw new Error(errorMsg);
        } finally {
            setLoading(false);
        }
    }, []);

    return { createSchedule, loading, error, data };
}

export interface UseScheduleUpdateResult {
    updateSchedule: (id: string, updates: Partial<BackupSchedule>) => Promise<BackupSchedule>;
    loading: boolean;
    error: string | null;
    data: BackupSchedule | null;
}

/**
 * Hook for updating a backup schedule
 */
export function useScheduleUpdate(): UseScheduleUpdateResult {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [data, setData] = useState<BackupSchedule | null>(null);

    const updateSchedule = useCallback(async (id: string, updates: Partial<BackupSchedule>): Promise<BackupSchedule> => {
        setLoading(true);
        setError(null);

        try {
            const res = await fetch(buildControlServerUrl(`/api/backup/schedules/${id}`), {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    ...controlServerAuthHeaders(),
                },
                body: JSON.stringify(updates),
            });

            if (!res.ok) {
                const body = await res.text().catch(() => '');
                throw new Error(`Failed to update schedule (HTTP ${res.status}): ${body || res.statusText}`);
            }

            const result = await res.json();

            if (!result.success) {
                throw new Error(result.error || 'Failed to update schedule');
            }

            const schedule: BackupSchedule = result.schedule;
            setData(schedule);
            return schedule;
        } catch (err) {
            const errorMsg = getErrorMessage(err);
            setError(errorMsg);
            throw new Error(errorMsg);
        } finally {
            setLoading(false);
        }
    }, []);

    return { updateSchedule, loading, error, data };
}

export interface UseScheduleDeleteResult {
    deleteSchedule: (id: string) => Promise<void>;
    loading: boolean;
    error: string | null;
}

/**
 * Hook for deleting a backup schedule
 */
export function useScheduleDelete(): UseScheduleDeleteResult {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const deleteSchedule = useCallback(async (id: string): Promise<void> => {
        setLoading(true);
        setError(null);

        try {
            const res = await fetch(buildControlServerUrl(`/api/backup/schedules/${id}`), {
                method: 'DELETE',
                headers: { ...controlServerAuthHeaders() },
            });

            if (!res.ok) {
                const body = await res.text().catch(() => '');
                throw new Error(`Failed to delete schedule (HTTP ${res.status}): ${body || res.statusText}`);
            }

            const result = await res.json();

            if (!result.success) {
                throw new Error(result.error || 'Failed to delete schedule');
            }
        } catch (err) {
            const errorMsg = getErrorMessage(err);
            setError(errorMsg);
            throw new Error(errorMsg);
        } finally {
            setLoading(false);
        }
    }, []);

    return { deleteSchedule, loading, error };
}

export interface UseScheduleTriggerResult {
    triggerSchedule: (id: string) => Promise<void>;
    loading: boolean;
    error: string | null;
}

/**
 * Hook for manually triggering a scheduled backup
 */
export function useScheduleTrigger(): UseScheduleTriggerResult {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const triggerSchedule = useCallback(async (id: string): Promise<void> => {
        setLoading(true);
        setError(null);

        try {
            const res = await fetch(buildControlServerUrl(`/api/backup/schedules/${id}/trigger`), {
                method: 'POST',
                headers: { ...controlServerAuthHeaders() },
            });

            if (!res.ok) {
                const body = await res.text().catch(() => '');
                throw new Error(`Failed to trigger schedule (HTTP ${res.status}): ${body || res.statusText}`);
            }

            const result = await res.json();

            if (!result.success) {
                throw new Error(result.error || 'Failed to trigger schedule');
            }
        } catch (err) {
            const errorMsg = getErrorMessage(err);
            setError(errorMsg);
            throw new Error(errorMsg);
        } finally {
            setLoading(false);
        }
    }, []);

    return { triggerSchedule, loading, error };
}
