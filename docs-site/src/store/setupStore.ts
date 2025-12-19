import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import {
    createDefaultStoragePlan,
    DEFAULT_DATA_ROOT,
    type StoragePathSetting,
    type StoragePlan,
} from '../data/storagePlan'

// ---------------------------------------------------------------------------
// SHAPE OF THE WIZARD CONFIGURATION
// ---------------------------------------------------------------------------
// SetupConfig is the single source of truth for all values that drive the
// compose generator, .env output, and various helper components.
//
// Comments here are intentionally user-facing (for future devs and power
// users reading the code) and match the guidance in the docs + wizard UI.
export interface SetupConfig {
    // MAIN DOMAIN for your stack (no protocol), e.g. "media.example.com".
    // Used by reverse proxy examples and any generated URLs.
    domain: string

    // TIMEZONE in IANA format ("America/New_York", "Europe/Berlin", etc.).
    // Passed through to all containers so logs/schedules line up.
    timezone: string

    // FILE PERMISSIONS: user/group IDs on the Docker host.
    // Recommended: run `id -u` and `id -g` on the host and paste here.
    puid: string
    pgid: string

    // MASTER PASSWORD: used for some default credentials in generated files
    // (e.g. dashboards, internal UIs). You can later change it per-service.
    password: string

    // Cloudflare API token (if using Cloudflare DNS/Tunnels examples).
    cloudflareToken: string

    // Plex claim token from https://plex.tv/claim (only needed on first run).
    plexClaim: string

    // WireGuard settings for the Gluetun VPN container.
    wireguardPrivateKey: string
    wireguardAddresses: string

    // Per-service extra config blobs (key/value maps per service ID).
    // Example:
    //   serviceConfigs: {
    //     plex: { advertiseUrl: 'https://plex.example.com' },
    //     overseerr: { applicationUrl: 'https://requests.example.com' }
    //   }
    serviceConfigs: Record<string, Record<string, string>>

    // Storage plan that ties library/download paths to selected services.
    storagePlan?: StoragePlan
}

// ---------------------------------------------------------------------------
// ZUSTAND STORE INTERFACE
// ---------------------------------------------------------------------------
export interface SetupStore {
    // Wizard step index (0–5 for the 6 steps in the UI).
    currentStep: number

    // Mode influences defaults: "newbie" pre-selects a safe stack.
    mode: 'newbie' | 'expert' | null
    // Storage planner mode toggles between single-root (simple) and per-path (advanced).
    storageMode: 'simple' | 'advanced'

    // IDs of all services selected in the Stack Selection step.
    selectedServices: string[]

    // The full config object the rest of the app reads from.
    config: SetupConfig
    // Cached advanced plan so we can restore expert overrides after switching back from simple mode.
    advancedPlanCache?: StoragePlan

    // ------ Actions for navigation & selection ------
    setCurrentStep: (step: number) => void
    setMode: (mode: 'newbie' | 'expert') => void
    setSelectedServices: (services: string[]) => void
    toggleService: (service: string) => void

    // Update top-level config (domain, timezone, PUID, etc.).
    updateConfig: (config: Partial<SetupConfig>) => void

    // Update a specific service's custom config map.
    updateServiceConfig: (serviceId: string, config: Record<string, string>) => void

    // Update a storage path/type pairing.
    updateStoragePath: (categoryId: string, update: Partial<StoragePathSetting>) => void
    // Toggle between simple (single data root) and advanced per-path editing.
    setStorageMode: (mode: 'simple' | 'advanced') => void

    // Reset wizard back to initial state.
    resetWizard: () => void

    // Move forward/backwards between steps.
    nextStep: () => void
    prevStep: () => void

    // ------ Template & Export/Import ------
    // Load a pre-defined template (sets services + maybe config overrides).
    loadTemplate: (services: string[], config?: Partial<SetupConfig>) => void

    // Export current config (including selected services) as JSON string.
    exportConfig: () => string

    // Import previously exported JSON config and reset wizard to step 0.
    importConfig: (data: { config: SetupConfig; selectedServices: string[]; mode: string | null }) => void

    // ------ Profile Management ------
    // Saved named profiles (e.g. "Home Server", "Laptop Lab").
    savedProfiles: Record<string, { config: SetupConfig; selectedServices: string[]; mode: string | null }>
    saveProfile: (name: string) => void
    deleteProfile: (name: string) => void
    loadProfile: (name: string) => void
}

const scrubSecrets = (config: SetupConfig): SetupConfig => {
    const { openaiApiKey: _legacyOpenAiKey, ...rest } = (config as any) || {}
    return {
        ...rest,
    password: '',
    cloudflareToken: '',
    plexClaim: '',
    wireguardPrivateKey: '',
    wireguardAddresses: '',
    } as SetupConfig
}

const mergeStoragePlan = (plan?: StoragePlan, rootOverride?: string): StoragePlan => {
    const root = rootOverride || plan?.dataRoot?.path || DEFAULT_DATA_ROOT
    const defaults = createDefaultStoragePlan(root)
    return {
        ...defaults,
        ...plan,
    }
}

// Initial defaults shown on first load.
export const initialConfig: SetupConfig = {
    domain: 'example.com',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Etc/UTC',
    puid: '1000',
    pgid: '1000',
    password: '',
    cloudflareToken: '',
    plexClaim: '',
    wireguardPrivateKey: '',
    wireguardAddresses: '',
    serviceConfigs: {},
    storagePlan: mergeStoragePlan(),
}

// Main exported hook used throughout the app.
export const useSetupStore = create<SetupStore>()(
    persist(
        (set, _get) => ({
            // Start at step 0 (Welcome), no mode, no services selected.
            currentStep: 0,
            mode: null,
            storageMode: 'simple',
            selectedServices: [],
            config: initialConfig,
            savedProfiles: {},
            advancedPlanCache: undefined,

            setCurrentStep: (step) => set({ currentStep: step }),

            setMode: (mode) => {
                set({ mode })
                // Auto-select a sensible starter stack for "newbie" mode.
                // This gives: Plex + *Arr + downloads + VPN + notifications + stats.
                if (mode === 'newbie') {
                    set({ selectedServices: ['plex', 'arr', 'torrent', 'vpn', 'notify', 'stats'] })
                }
            },

            setSelectedServices: (services) => set({ selectedServices: services }),

            toggleService: (service) => set((state) => ({
                selectedServices: state.selectedServices.includes(service)
                    ? state.selectedServices.filter(s => s !== service)
                    : [...state.selectedServices, service]
            })),

            // Merge partial updates into the existing config.
            updateConfig: (newConfig) =>
                set((state) => ({
                    config: {
                        ...state.config,
                        ...newConfig,
                        storagePlan: newConfig.storagePlan
                            ? mergeStoragePlan(newConfig.storagePlan)
                            : state.config.storagePlan,
                    },
                })),

            // Merge service-specific config while preserving existing keys.
            updateServiceConfig: (serviceId, newConfig) =>
                set((state) => ({
                    config: {
                        ...state.config,
                        serviceConfigs: {
                            ...state.config.serviceConfigs,
                            [serviceId]: {
                                ...(state.config.serviceConfigs[serviceId] || {}),
                                ...newConfig,
                            },
                        },
                    },
                })),

            updateStoragePath: (categoryId, update) =>
                set((state) => {
                    const currentPlan = mergeStoragePlan(state.config.storagePlan)
                    const planDataRoot = currentPlan.dataRoot?.path || DEFAULT_DATA_ROOT

                    if (state.storageMode === 'simple') {
                        if (categoryId !== 'dataRoot' || !update.path) {
                            return {}
                        }
                        const nextRoot = update.path.trim() || planDataRoot
                        return {
                            config: {
                                ...state.config,
                                storagePlan: createDefaultStoragePlan(nextRoot),
                            },
                        }
                    }

                    const defaultsForCurrentRoot = createDefaultStoragePlan(planDataRoot)
                    const previous = currentPlan[categoryId] || defaultsForCurrentRoot[categoryId]
                    if (!previous) {
                        return {}
                    }

                    const nextEntry: StoragePathSetting = {
                        path: update.path ?? previous.path,
                        type: update.type ?? previous.type,
                    }

                    let nextPlan: StoragePlan = {
                        ...currentPlan,
                        [categoryId]: nextEntry,
                    }

                    if (categoryId === 'dataRoot' && update.path && update.path !== previous.path) {
                        const oldRoot = previous.path
                        const oldDefaults = createDefaultStoragePlan(oldRoot)
                        const newDefaults = createDefaultStoragePlan(update.path)

                        nextPlan = Object.keys(nextPlan).reduce<StoragePlan>((acc, key) => {
                            const currentValue = nextPlan[key]
                            if (!currentValue) return acc
                            const oldDefaultPath = oldDefaults[key]?.path
                            if (oldDefaultPath && currentValue.path === oldDefaultPath) {
                                acc[key] = {
                                    ...currentValue,
                                    path: newDefaults[key]?.path || currentValue.path,
                                }
                            } else {
                                acc[key] = currentValue
                            }
                            return acc
                        }, {} as StoragePlan)
                    }

                    const mergedPlan = mergeStoragePlan(nextPlan, nextPlan.dataRoot?.path)

                    return {
                        config: {
                            ...state.config,
                            storagePlan: mergedPlan,
                        },
                        advancedPlanCache: mergedPlan,
                    }
                }),

            setStorageMode: (mode) =>
                set((state) => {
                    if (state.storageMode === mode) return {}
                    if (mode === 'simple') {
                        const currentPlan = mergeStoragePlan(state.config.storagePlan)
                        const root = currentPlan.dataRoot?.path || DEFAULT_DATA_ROOT
                        return {
                            storageMode: 'simple',
                            advancedPlanCache: currentPlan,
                            config: {
                                ...state.config,
                                storagePlan: createDefaultStoragePlan(root),
                            },
                        }
                    }

                    const restoredPlan = state.advancedPlanCache || mergeStoragePlan(state.config.storagePlan)
                    return {
                        storageMode: 'advanced',
                        config: {
                            ...state.config,
                            storagePlan: mergeStoragePlan(restoredPlan, restoredPlan.dataRoot?.path),
                        },
                    }
                }),

            // Clear everything back to initial defaults.
            resetWizard: () =>
                set({
                    currentStep: 0,
                    mode: null,
                    storageMode: 'simple',
                    selectedServices: [],
                    config: initialConfig,
                    advancedPlanCache: undefined,
                }),

            // Move to the next wizard step (max index 5).
            nextStep: () =>
                set((state) => ({
                    currentStep: Math.min(state.currentStep + 1, 5), // 6 steps total (0-5)
                })),

            // Move back a step, but never below 0.
            prevStep: () =>
                set((state) => ({
                    currentStep: Math.max(state.currentStep - 1, 0),
                })),

            // Template & Export/Import
            loadTemplate: (services, templateConfig) =>
                set((state) => {
                    const mergedConfig = templateConfig
                        ? {
                            ...state.config,
                            ...templateConfig,
                            storagePlan: templateConfig.storagePlan
                                ? mergeStoragePlan(templateConfig.storagePlan)
                                : state.config.storagePlan,
                        }
                        : state.config

                    return {
                        selectedServices: services,
                        config: mergedConfig,
                        mode: 'expert',
                    }
                }),

            // Serialize current state so users can save/share their stack.
            exportConfig: (): string => {
                const { mode, selectedServices, config } = useSetupStore.getState()
                const normalizedConfig = {
                    ...config,
                    storagePlan: mergeStoragePlan(config.storagePlan),
                }
                return JSON.stringify(
                    {
                        version: '1.0',
                        timestamp: new Date().toISOString(),
                        mode,
                        selectedServices,
                        config: normalizedConfig,
                    },
                    null,
                    2
                )
            },

            // Load a previously exported config JSON.
            importConfig: (data: { config: SetupConfig; selectedServices: string[]; mode: string | null }) =>
                set({
                    config: {
                        ...((() => {
                            const { openaiApiKey: _legacyOpenAiKey, ...rest } = (data.config as any) || {}
                            return rest
                        })()),
                        storagePlan: mergeStoragePlan(data.config.storagePlan),
                    },
                    selectedServices: data.selectedServices,
                    mode: data.mode as 'newbie' | 'expert' | null,
                    storageMode: 'advanced',
                    advancedPlanCache: mergeStoragePlan(data.config.storagePlan),
                    currentStep: 0,
                }),

            // Profile Management
            // Save a named profile with current config + selected services.
            saveProfile: (name) =>
                set((state) => ({
                    savedProfiles: {
                        ...state.savedProfiles,
                        [name]: {
                            config: {
                                ...state.config,
                                storagePlan: mergeStoragePlan(state.config.storagePlan),
                            },
                            selectedServices: state.selectedServices,
                            mode: state.mode,
                        },
                    },
                })),

            // Delete a saved profile by name.
            deleteProfile: (name) =>
                set((state) => {
                    const newProfiles = { ...state.savedProfiles }
                    delete newProfiles[name]
                    return { savedProfiles: newProfiles }
                }),

            // Load a saved profile and reset wizard back to step 0.
            loadProfile: (name) =>
                set((state) => {
                    const profile = state.savedProfiles[name]
                    if (!profile) return {}
                    return {
                        config: {
                            ...profile.config,
                            storagePlan: mergeStoragePlan(profile.config.storagePlan),
                        },
                        selectedServices: profile.selectedServices,
                        mode: profile.mode as 'newbie' | 'expert' | null,
                        storageMode: 'advanced',
                        advancedPlanCache: mergeStoragePlan(profile.config.storagePlan),
                        currentStep: 0,
                    }
                }),
        }),
        {
            name: 'setup-wizard-storage',
            partialize: (state) => ({
                currentStep: state.currentStep,
                mode: state.mode,
                storageMode: state.storageMode,
                selectedServices: state.selectedServices,
                config: scrubSecrets(state.config),
                savedProfiles: Object.fromEntries(
                    Object.entries(state.savedProfiles).map(([name, profile]) => [
                        name,
                        {
                            ...profile,
                            config: scrubSecrets(profile.config),
                        },
                    ])
                ),
                advancedPlanCache: state.advancedPlanCache,
            })
        }
    )
)
