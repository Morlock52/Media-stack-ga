import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * Backup Store
 * Manages state for backup wizard including destination config, selected items,
 * encryption settings, schedule config, backup history, and active backup/restore progress.
 */

// Import types from control-server (these should match the backend types)
export type DestinationType = 'local' | 's3' | 'rclone';
export type BackupItemType = 'config' | 'volume' | 'database' | 'metadata';
export type BackupStatus = 'initializing' | 'discovering' | 'archiving' | 'encrypting' | 'uploading' | 'completed' | 'failed';
export type RestoreStatus = 'initializing' | 'downloading' | 'validating' | 'decrypting' | 'extracting' | 'applying' | 'completed' | 'failed';
export type ScheduleFrequency = 'daily' | 'weekly' | 'monthly';

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

export interface BackupSchedule {
    id: string;
    enabled: boolean;
    frequency: ScheduleFrequency;
    time: string;
    retentionCount: number;
    lastRun?: string;
    nextRun?: string;
}

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

// ---------------------------------------------------------------------------
// ZUSTAND STORE INTERFACE
// ---------------------------------------------------------------------------
export interface BackupStore {
    // Wizard step index (0-4 for the 5 steps in the backup wizard)
    currentStep: number;

    // Destination configuration
    destination: BackupDestination | null;

    // Selected backup items
    selectedItems: BackupItem[];

    // Available backup items (discovered from API)
    availableItems: BackupItem[];

    // Encryption configuration
    encryption: EncryptionConfig;

    // Schedule configuration
    schedule: BackupSchedule | null;

    // Backup history (fetched from API)
    backupHistory: BackupHistoryEntry[];

    // Active backup progress (null when no backup is running)
    activeBackupProgress: BackupProgress | null;

    // Active restore progress (null when no restore is running)
    activeRestoreProgress: RestoreProgress | null;

    // Backup name (optional user-provided name)
    backupName: string;

    // ------ Actions for navigation ------
    setCurrentStep: (step: number) => void;
    nextStep: () => void;
    prevStep: () => void;

    // ------ Actions for destination ------
    setDestination: (destination: BackupDestination | null) => void;

    // ------ Actions for backup items ------
    setAvailableItems: (items: BackupItem[]) => void;
    setSelectedItems: (items: BackupItem[]) => void;
    toggleItem: (itemName: string) => void;
    selectAllItems: () => void;
    deselectAllItems: () => void;

    // ------ Actions for encryption ------
    setEncryption: (config: EncryptionConfig) => void;

    // ------ Actions for schedule ------
    setSchedule: (schedule: BackupSchedule | null) => void;

    // ------ Actions for backup history ------
    setBackupHistory: (history: BackupHistoryEntry[]) => void;
    addBackupToHistory: (entry: BackupHistoryEntry) => void;

    // ------ Actions for active progress ------
    setActiveBackupProgress: (progress: BackupProgress | null) => void;
    setActiveRestoreProgress: (progress: RestoreProgress | null) => void;

    // ------ Actions for backup name ------
    setBackupName: (name: string) => void;

    // ------ Reset wizard ------
    resetWizard: () => void;
}

// Initial encryption config
const initialEncryption: EncryptionConfig = {
    enabled: false,
    password: undefined,
};

// Default local destination
const initialDestination: LocalDestination = {
    type: 'local',
    path: '/backups',
};

// Helper to scrub sensitive data before persisting
const scrubSensitiveData = (state: Partial<BackupStore>): Partial<BackupStore> => {
    return {
        ...state,
        // Don't persist encryption password
        encryption: state.encryption ? {
            enabled: state.encryption.enabled,
            password: undefined,
        } : undefined,
        // Don't persist S3 credentials
        destination: state.destination?.type === 's3' ? {
            ...state.destination,
            accessKeyId: '',
            secretAccessKey: '',
        } : state.destination,
        // Don't persist active progress (ephemeral)
        activeBackupProgress: null,
        activeRestoreProgress: null,
    };
};

// Main exported hook used throughout the app
export const useBackupStore = create<BackupStore>()(
    persist(
        (set) => ({
            // Initial state
            currentStep: 0,
            destination: initialDestination,
            selectedItems: [],
            availableItems: [],
            encryption: initialEncryption,
            schedule: null,
            backupHistory: [],
            activeBackupProgress: null,
            activeRestoreProgress: null,
            backupName: '',

            // Navigation actions
            setCurrentStep: (step) => set({ currentStep: step }),

            nextStep: () =>
                set((state) => ({
                    currentStep: Math.min(state.currentStep + 1, 4), // 5 steps total (0-4)
                })),

            prevStep: () =>
                set((state) => ({
                    currentStep: Math.max(state.currentStep - 1, 0),
                })),

            // Destination actions
            setDestination: (destination) => set({ destination }),

            // Backup items actions
            setAvailableItems: (items) => set({ availableItems: items }),

            setSelectedItems: (items) => set({ selectedItems: items }),

            toggleItem: (itemName) =>
                set((state) => {
                    const isSelected = state.selectedItems.some(item => item.name === itemName);
                    if (isSelected) {
                        return {
                            selectedItems: state.selectedItems.filter(item => item.name !== itemName),
                        };
                    } else {
                        const itemToAdd = state.availableItems.find(item => item.name === itemName);
                        if (itemToAdd) {
                            return {
                                selectedItems: [...state.selectedItems, itemToAdd],
                            };
                        }
                        return {};
                    }
                }),

            selectAllItems: () =>
                set((state) => ({
                    selectedItems: [...state.availableItems],
                })),

            deselectAllItems: () => set({ selectedItems: [] }),

            // Encryption actions
            setEncryption: (config) => set({ encryption: config }),

            // Schedule actions
            setSchedule: (schedule) => set({ schedule }),

            // Backup history actions
            setBackupHistory: (history) => set({ backupHistory: history }),

            addBackupToHistory: (entry) =>
                set((state) => ({
                    backupHistory: [entry, ...state.backupHistory],
                })),

            // Active progress actions
            setActiveBackupProgress: (progress) => set({ activeBackupProgress: progress }),

            setActiveRestoreProgress: (progress) => set({ activeRestoreProgress: progress }),

            // Backup name actions
            setBackupName: (name) => set({ backupName: name }),

            // Reset wizard to initial state
            resetWizard: () =>
                set({
                    currentStep: 0,
                    destination: initialDestination,
                    selectedItems: [],
                    availableItems: [],
                    encryption: initialEncryption,
                    schedule: null,
                    backupHistory: [],
                    activeBackupProgress: null,
                    activeRestoreProgress: null,
                    backupName: '',
                }),
        }),
        {
            name: 'backup-wizard-storage',
            partialize: (state) =>
                scrubSensitiveData({
                    currentStep: state.currentStep,
                    destination: state.destination,
                    selectedItems: state.selectedItems,
                    availableItems: state.availableItems,
                    encryption: state.encryption,
                    schedule: state.schedule,
                    backupName: state.backupName,
                    // Don't persist history or active progress
                }),
        }
    )
);
