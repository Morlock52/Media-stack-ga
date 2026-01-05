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
export interface RestoreOptions {
    stopServices: boolean;
    createPreRestoreBackup: boolean;
}

export interface BackupStore {
    // Backup Wizard step index (0-4 for the 5 steps in the backup wizard)
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

    // ------ Restore Wizard State ------
    // Restore wizard step index (0-4 for the 5 steps in the restore wizard)
    restoreCurrentStep: number;

    // Selected backup for restore
    selectedBackupForRestore: BackupHistoryEntry | null;

    // Validation result (null = not validated yet, true = valid, false = invalid)
    restoreValidationResult: boolean | null;

    // Selected items for restore (array of item names, empty = restore all)
    restoreSelectedItems: string[];

    // Restore options
    restoreOptions: RestoreOptions;

    // Decryption password for encrypted backups
    restoreDecryptionPassword: string;

    // ------ Actions for backup wizard navigation ------
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

    // ------ Actions for restore wizard navigation ------
    setRestoreCurrentStep: (step: number) => void;
    restoreNextStep: () => void;
    restorePrevStep: () => void;

    // ------ Actions for restore wizard state ------
    setSelectedBackupForRestore: (backup: BackupHistoryEntry | null) => void;
    setRestoreValidationResult: (result: boolean | null) => void;
    setRestoreSelectedItems: (items: string[]) => void;
    toggleRestoreItem: (itemName: string) => void;
    selectAllRestoreItems: () => void;
    deselectAllRestoreItems: () => void;
    setRestoreOptions: (options: RestoreOptions) => void;
    setRestoreDecryptionPassword: (password: string) => void;

    // ------ Reset wizards ------
    resetWizard: () => void;
    resetRestoreWizard: () => void;
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

// Initial restore options
const initialRestoreOptions: RestoreOptions = {
    stopServices: true,
    createPreRestoreBackup: true,
};

// Main exported hook used throughout the app
export const useBackupStore = create<BackupStore>()(
    persist(
        (set) => ({
            // Initial backup wizard state
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

            // Initial restore wizard state
            restoreCurrentStep: 0,
            selectedBackupForRestore: null,
            restoreValidationResult: null,
            restoreSelectedItems: [],
            restoreOptions: initialRestoreOptions,
            restoreDecryptionPassword: '',

            // Backup wizard navigation actions
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

            // Restore wizard navigation actions
            setRestoreCurrentStep: (step) => set({ restoreCurrentStep: step }),

            restoreNextStep: () =>
                set((state) => ({
                    restoreCurrentStep: Math.min(state.restoreCurrentStep + 1, 4), // 5 steps total (0-4)
                })),

            restorePrevStep: () =>
                set((state) => ({
                    restoreCurrentStep: Math.max(state.restoreCurrentStep - 1, 0),
                })),

            // Restore wizard state actions
            setSelectedBackupForRestore: (backup) => set({ selectedBackupForRestore: backup }),

            setRestoreValidationResult: (result) => set({ restoreValidationResult: result }),

            setRestoreSelectedItems: (items) => set({ restoreSelectedItems: items }),

            toggleRestoreItem: (itemName) =>
                set((state) => {
                    const isSelected = state.restoreSelectedItems.includes(itemName);
                    if (isSelected) {
                        return {
                            restoreSelectedItems: state.restoreSelectedItems.filter(name => name !== itemName),
                        };
                    } else {
                        return {
                            restoreSelectedItems: [...state.restoreSelectedItems, itemName],
                        };
                    }
                }),

            selectAllRestoreItems: () =>
                set((state) => {
                    // Get all item names from the selected backup
                    const allItemNames = state.selectedBackupForRestore?.metadata?.items?.map((item: any) => item.name) || [];
                    return { restoreSelectedItems: allItemNames };
                }),

            deselectAllRestoreItems: () => set({ restoreSelectedItems: [] }),

            setRestoreOptions: (options) => set({ restoreOptions: options }),

            setRestoreDecryptionPassword: (password) => set({ restoreDecryptionPassword: password }),

            // Reset backup wizard to initial state
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
                    backupName: '',
                }),

            // Reset restore wizard to initial state
            resetRestoreWizard: () =>
                set({
                    restoreCurrentStep: 0,
                    selectedBackupForRestore: null,
                    restoreValidationResult: null,
                    restoreSelectedItems: [],
                    restoreOptions: initialRestoreOptions,
                    restoreDecryptionPassword: '',
                    activeRestoreProgress: null,
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
