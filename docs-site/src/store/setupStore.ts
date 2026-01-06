import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import {
    createDefaultStoragePlan,
    DEFAULT_DATA_ROOT,
    type StoragePathSetting,
    type StoragePlan,
} from '../data/storagePlan'

// Auto-save configuration
const AUTO_SAVE_KEY = 'setup-wizard-autosave'
const AUTO_SAVE_DEBOUNCE_MS = 2000 // Save after 2 seconds of inactivity

// ---------------------------------------------------------------------------
// SHAPE OF THE WIZARD CONFIGURATION
// ---------------------------------------------------------------------------
// SetupConfig is the single source of truth for all values that drive the
// compose generator, .env output, and various helper components.
//
// Comments here are intentionally user-facing (for future devs and power
// users reading the code) and match the guidance in the docs + wizard UI.
export interface SetupConfig {
    // DEPLOYMENT MODE: 'local' uses just Traefik, 'cloud' adds Cloudflare + Authelia
    // Local mode: Access via LAN IP/hostname, no external dependencies
    // Cloud mode: Access via Cloudflare Tunnel with Authelia SSO
    deploymentMode: 'local' | 'cloud'

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

    // VPN Configuration (for VPN provider wizard)
    // Selected VPN provider ID (e.g., 'mullvad', 'protonvpn', 'custom-wireguard')
    selectedVpnProvider?: string
    // VPN protocol choice: WireGuard (recommended) or OpenVPN
    vpnProtocol?: 'wireguard' | 'openvpn'
    // Provider-specific credentials (username, password, API tokens, etc.)
    // Structure varies by provider - see vpnProviders.ts for details
    vpnCredentials?: Record<string, string>
    // Whether port forwarding is enabled (only for supported providers)
    portForwardingEnabled?: boolean
    // Flag indicating if a WireGuard config file was imported
    wireguardConfigImported?: boolean
    // Kill switch enabled (blocks all traffic if VPN disconnects)
    killSwitchEnabled?: boolean

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
/**
 * Main Zustand store for the Setup Wizard.
 *
 * The store is organized into logical slices:
 * - Wizard Navigation State: Step tracking and flow control
 * - Mode & Configuration State: User preferences and config data
 * - Navigation Actions: Step movement and wizard flow
 * - Service Selection Actions: Managing selected services
 * - Configuration Actions: Updating config and service-specific settings
 * - Storage Management Actions: Controlling storage paths and modes
 * - Wizard Control Actions: Reset and initialization
 * - Template & Import/Export Actions: Config sharing and templates
 * - Profile Management: Named config presets
 * - Auto-Save Draft: Automatic draft recovery
 */
export interface SetupStore {
    // ---------------------------------------------------------------------------
    // WIZARD NAVIGATION STATE
    // ---------------------------------------------------------------------------
    // Controls the wizard flow and current position

    /** Current wizard step index (0–5 for the 6 steps in the UI) */
    currentStep: number

    /** Quick Start mode: simplified 2-step flow for beginners */
    quickStartMode: boolean

    // ---------------------------------------------------------------------------
    // MODE & CONFIGURATION STATE
    // ---------------------------------------------------------------------------
    // User preferences and the main configuration object

    /** Mode influences defaults: "newbie" pre-selects a safe stack */
    mode: 'newbie' | 'expert' | null

    /** Storage planner mode toggles between single-root (simple) and per-path (advanced) */
    storageMode: 'simple' | 'advanced'

    /** IDs of all services selected in the Stack Selection step */
    selectedServices: string[]

    /** The full config object that drives compose generation and .env output */
    config: SetupConfig

    /** Cached advanced plan so we can restore expert overrides after switching back from simple mode */
    advancedPlanCache?: StoragePlan

    /** Track which template was applied (null if none or reset) */
    appliedTemplateId: string | null

    // ---------------------------------------------------------------------------
    // NAVIGATION ACTIONS
    // ---------------------------------------------------------------------------
    // Actions for controlling wizard flow and step movement

    /** Set the current wizard step directly */
    setCurrentStep: (step: number) => void

    /** Toggle Quick Start mode on/off */
    setQuickStartMode: (enabled: boolean) => void

    /** Move to the next wizard step */
    nextStep: () => void

    /** Move back to the previous wizard step */
    prevStep: () => void

    // ---------------------------------------------------------------------------
    // SERVICE SELECTION ACTIONS
    // ---------------------------------------------------------------------------
    // Actions for managing which services are selected

    /** Set wizard mode (newbie auto-selects a starter stack) */
    setMode: (mode: 'newbie' | 'expert') => void

    /** Replace the entire selected services array */
    setSelectedServices: (services: string[]) => void

    /** Toggle a single service on/off in the selection */
    toggleService: (service: string) => void

    // ---------------------------------------------------------------------------
    // CONFIGURATION ACTIONS
    // ---------------------------------------------------------------------------
    // Actions for updating the main config and service-specific settings

    /** Update top-level config fields (domain, timezone, PUID, etc.) */
    updateConfig: (config: Partial<SetupConfig>) => void

    /** Update a specific service's custom config map */
    updateServiceConfig: (serviceId: string, config: Record<string, string>) => void

    // ---------------------------------------------------------------------------
    // STORAGE MANAGEMENT ACTIONS
    // ---------------------------------------------------------------------------
    // Actions for managing storage paths and storage mode

    /** Update a storage path/type pairing for a specific category */
    // Update VPN configuration (provider, protocol, credentials, port forwarding).
    updateVpnConfig: (vpnConfig: {
        selectedVpnProvider?: string
        vpnProtocol?: 'wireguard' | 'openvpn'
        vpnCredentials?: Record<string, string>
        portForwardingEnabled?: boolean
        wireguardConfigImported?: boolean
        killSwitchEnabled?: boolean
    }) => void

    // Update a storage path/type pairing.
    updateStoragePath: (categoryId: string, update: Partial<StoragePathSetting>) => void

    /** Toggle between simple (single data root) and advanced per-path editing */
    setStorageMode: (mode: 'simple' | 'advanced') => void

    // ---------------------------------------------------------------------------
    // WIZARD CONTROL ACTIONS
    // ---------------------------------------------------------------------------
    // Actions for resetting and controlling the wizard lifecycle

    /** Reset wizard back to initial state (clears all config and selections) */
    resetWizard: () => void

    // ---------------------------------------------------------------------------
    // TEMPLATE & IMPORT/EXPORT ACTIONS
    // ---------------------------------------------------------------------------
    // Actions for sharing configs and using templates

    /** Load a pre-defined template (sets services + maybe config overrides) */
    loadTemplate: (templateId: string, services: string[], config?: Partial<SetupConfig>) => void

    /** Export current config (including selected services) as JSON string */
    exportConfig: () => string

    /** Import previously exported JSON config and reset wizard to step 0 */
    importConfig: (data: { config: SetupConfig; selectedServices: string[]; mode: string | null }) => void

    // ---------------------------------------------------------------------------
    // PROFILE MANAGEMENT
    // ---------------------------------------------------------------------------
    // Named config presets that users can save, load, and delete

    /** Saved named profiles (e.g. "Home Server", "Laptop Lab") */
    savedProfiles: Record<string, { config: SetupConfig; selectedServices: string[]; mode: string | null }>

    /** Save current config as a named profile */
    saveProfile: (name: string) => void

    /** Delete a saved profile by name */
    deleteProfile: (name: string) => void

    /** Load a saved profile and reset wizard to step 0 */
    loadProfile: (name: string) => void

    // ---------------------------------------------------------------------------
    // AUTO-SAVE DRAFT
    // ---------------------------------------------------------------------------
    // Automatic draft recovery for resuming interrupted wizard sessions

    /** Track last auto-save timestamp */
    lastAutoSaveAt: number | null

    /** Check if there's a recoverable draft (valid for 7 days) */
    hasRecoverableDraft: () => boolean

    /** Get the recoverable draft data with metadata */
    getRecoverableDraft: () => { config: SetupConfig; selectedServices: string[]; mode: string | null; savedAt: number } | null

    /** Dismiss/clear the auto-saved draft */
    dismissDraft: () => void

    /** Restore from auto-saved draft */
    restoreDraft: () => void
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
        // Scrub VPN credentials but preserve other VPN config
        vpnCredentials: {},
    } as SetupConfig
}

// Auto-save helper functions
interface AutoSaveDraft {
    config: SetupConfig
    selectedServices: string[]
    mode: string | null
    currentStep: number
    savedAt: number
}

let autoSaveTimeout: ReturnType<typeof setTimeout> | null = null

const saveAutoSaveDraft = (state: Pick<SetupStore, 'config' | 'selectedServices' | 'mode' | 'currentStep'>) => {
    // Don't save if on welcome step with no meaningful data
    if (state.currentStep === 0 && state.selectedServices.length === 0) {
        return
    }

    const draft: AutoSaveDraft = {
        config: scrubSecrets(state.config),
        selectedServices: state.selectedServices,
        mode: state.mode,
        currentStep: state.currentStep,
        savedAt: Date.now(),
    }

    try {
        localStorage.setItem(AUTO_SAVE_KEY, JSON.stringify(draft))
    } catch (e) {
        // localStorage might be full or unavailable
        console.warn('Failed to auto-save draft:', e)
    }
}

const getAutoSaveDraft = (): AutoSaveDraft | null => {
    try {
        const saved = localStorage.getItem(AUTO_SAVE_KEY)
        if (!saved) return null

        const draft = JSON.parse(saved) as AutoSaveDraft

        // Draft is valid for 7 days
        const DRAFT_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000
        if (Date.now() - draft.savedAt > DRAFT_EXPIRY_MS) {
            localStorage.removeItem(AUTO_SAVE_KEY)
            return null
        }

        // Only return if there's meaningful data (at least one service selected or past welcome step)
        if (draft.selectedServices.length > 0 || draft.currentStep > 0) {
            return draft
        }

        return null
    } catch {
        return null
    }
}

const clearAutoSaveDraft = () => {
    try {
        localStorage.removeItem(AUTO_SAVE_KEY)
    } catch {
        // Ignore
    }
}

const debouncedAutoSave = (state: Pick<SetupStore, 'config' | 'selectedServices' | 'mode' | 'currentStep'>) => {
    if (autoSaveTimeout) {
        clearTimeout(autoSaveTimeout)
    }
    autoSaveTimeout = setTimeout(() => {
        saveAutoSaveDraft(state)
    }, AUTO_SAVE_DEBOUNCE_MS)
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
    deploymentMode: 'cloud', // Default to cloud for backwards compatibility
    domain: 'example.com',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Etc/UTC',
    puid: '1000',
    pgid: '1000',
    password: '',
    cloudflareToken: '',
    plexClaim: '',
    wireguardPrivateKey: '',
    wireguardAddresses: '',
    // VPN configuration defaults
    selectedVpnProvider: undefined,
    vpnProtocol: 'wireguard', // WireGuard recommended by default
    vpnCredentials: {},
    portForwardingEnabled: false,
    wireguardConfigImported: false,
    killSwitchEnabled: true, // Kill switch enabled by default for security
    serviceConfigs: {},
    storagePlan: mergeStoragePlan(),
}

// Main exported hook used throughout the app.
export const useSetupStore = create<SetupStore>()(
    persist(
        (set, _get) => ({
            // Start at step 0 (Welcome), no mode, no services selected.
            currentStep: 0,
            quickStartMode: false,
            mode: null,
            storageMode: 'simple',
            selectedServices: [],
            config: initialConfig,
            savedProfiles: {},
            advancedPlanCache: undefined,
            appliedTemplateId: null,

            setCurrentStep: (step) => set({ currentStep: step }),

            setQuickStartMode: (enabled) => set({ quickStartMode: enabled }),

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

            // Update VPN configuration with partial updates.
            updateVpnConfig: (vpnConfig) =>
                set((state) => ({
                    config: {
                        ...state.config,
                        selectedVpnProvider: vpnConfig.selectedVpnProvider !== undefined
                            ? vpnConfig.selectedVpnProvider
                            : state.config.selectedVpnProvider,
                        vpnProtocol: vpnConfig.vpnProtocol !== undefined
                            ? vpnConfig.vpnProtocol
                            : state.config.vpnProtocol,
                        vpnCredentials: vpnConfig.vpnCredentials !== undefined
                            ? { ...state.config.vpnCredentials, ...vpnConfig.vpnCredentials }
                            : state.config.vpnCredentials,
                        portForwardingEnabled: vpnConfig.portForwardingEnabled !== undefined
                            ? vpnConfig.portForwardingEnabled
                            : state.config.portForwardingEnabled,
                        wireguardConfigImported: vpnConfig.wireguardConfigImported !== undefined
                            ? vpnConfig.wireguardConfigImported
                            : state.config.wireguardConfigImported,
                        killSwitchEnabled: vpnConfig.killSwitchEnabled !== undefined
                            ? vpnConfig.killSwitchEnabled
                            : state.config.killSwitchEnabled,
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
                    quickStartMode: false,
                    mode: null,
                    storageMode: 'simple',
                    selectedServices: [],
                    config: initialConfig,
                    advancedPlanCache: undefined,
                    appliedTemplateId: null,
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
            loadTemplate: (templateId, services, templateConfig) =>
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
                        appliedTemplateId: templateId,
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
                    appliedTemplateId: null,
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

            // ------ Auto-Save Draft ------
            lastAutoSaveAt: null,

            hasRecoverableDraft: () => {
                return getAutoSaveDraft() !== null
            },

            getRecoverableDraft: () => {
                const draft = getAutoSaveDraft()
                if (!draft) return null
                return {
                    config: draft.config,
                    selectedServices: draft.selectedServices,
                    mode: draft.mode,
                    savedAt: draft.savedAt,
                }
            },

            dismissDraft: () => {
                clearAutoSaveDraft()
            },

            restoreDraft: () =>
                set(() => {
                    const draft = getAutoSaveDraft()
                    if (!draft) return {}

                    // Clear the draft after restoring
                    clearAutoSaveDraft()

                    return {
                        config: {
                            ...draft.config,
                            storagePlan: mergeStoragePlan(draft.config.storagePlan),
                        },
                        selectedServices: draft.selectedServices,
                        mode: draft.mode as 'newbie' | 'expert' | null,
                        currentStep: draft.currentStep,
                        storageMode: 'advanced',
                        advancedPlanCache: mergeStoragePlan(draft.config.storagePlan),
                    }
                }),
        }),
        {
            name: 'setup-wizard-storage',
            partialize: (state) => ({
                currentStep: state.currentStep,
                quickStartMode: state.quickStartMode,
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
                appliedTemplateId: state.appliedTemplateId,
                lastAutoSaveAt: state.lastAutoSaveAt,
            })
        }
    )
)

// Subscribe to store changes and trigger auto-save
useSetupStore.subscribe((state, prevState) => {
    // Only auto-save if meaningful state changed
    const meaningfulChange =
        state.currentStep !== prevState.currentStep ||
        state.selectedServices !== prevState.selectedServices ||
        state.config !== prevState.config ||
        state.mode !== prevState.mode

    if (meaningfulChange) {
        debouncedAutoSave({
            config: state.config,
            selectedServices: state.selectedServices,
            mode: state.mode,
            currentStep: state.currentStep,
        })
    }
})

// ---------------------------------------------------------------------------
// SELECTOR FUNCTIONS
// ---------------------------------------------------------------------------
// Convenience hooks for commonly accessed derived state. Use these instead of
// calculating the same values repeatedly in components.

/**
 * Returns true if deployment mode is set to 'local' (LAN-only, no cloud access).
 * Use this to conditionally show local vs cloud UI elements.
 */
export const useIsLocalMode = () => useSetupStore((state) => state.config.deploymentMode === 'local')

/**
 * Returns the number of currently selected services.
 * Useful for validation and display purposes.
 */
export const useSelectedServiceCount = () => useSetupStore((state) => state.selectedServices.length)

/**
 * Checks if a specific service is currently selected.
 * @param serviceId - The service ID to check (e.g. 'plex', 'arr', 'vpn')
 */
export const useHasService = (serviceId: string) =>
    useSetupStore((state) => state.selectedServices.includes(serviceId))

/**
 * Returns wizard progress as a percentage (0-100).
 * Automatically accounts for quick start mode.
 * @param totalSteps - Total number of steps in the wizard (default: 6)
 */
export const useWizardProgress = (totalSteps = 6) =>
    useSetupStore((state) => {
        const currentStep = state.currentStep
        return ((currentStep + 1) / totalSteps) * 100
    })

/**
 * Returns true if the user can navigate to a specific step.
 * In quick start mode, only steps 0-1 are accessible. In normal mode, you can
 * navigate to any completed step or the next uncompleted step.
 * @param targetStep - The step index to check
 */
export const useCanNavigateToStep = (targetStep: number) =>
    useSetupStore((state) => {
        const { currentStep, quickStartMode } = state

        // Quick start mode: only steps 0-1 accessible
        if (quickStartMode) {
            return targetStep <= 1
        }

        // Normal mode: can go to any previous step or current step
        return targetStep <= currentStep
    })

/**
 * Returns the current step title and icon.
 * Useful for breadcrumbs and step indicators.
 * Note: You still need to pass the steps array with titles/icons.
 * @param steps - Array of step objects with title and icon
 */
export const useCurrentStepInfo = <T extends { title: string }>(steps: T[]) =>
    useSetupStore((state) => {
        const step = steps[state.currentStep]
        return {
            currentStep: state.currentStep,
            totalSteps: steps.length,
            stepInfo: step,
        }
    })

/**
 * Returns true if selected services include a torrent client but no VPN.
 * Used to show security warnings about IP exposure.
 */
export const useHasTorrentWithoutVPN = () =>
    useSetupStore((state) => {
        const { selectedServices } = state
        return selectedServices.includes('torrent') && !selectedServices.includes('vpn')
    })

/**
 * Returns true if the wizard is in quick start mode.
 * Quick start is a simplified 2-step flow for beginners.
 */
export const useIsQuickStartMode = () => useSetupStore((state) => state.quickStartMode)

/**
 * Returns the current wizard mode ('newbie', 'expert', or null).
 * Use this to customize UI hints and defaults.
 */
export const useWizardMode = () => useSetupStore((state) => state.mode)

/**
 * Returns true if storage mode is set to 'simple' (single root path).
 * Use this to show/hide advanced per-category storage path controls.
 */
export const useIsSimpleStorageMode = () => useSetupStore((state) => state.storageMode === 'simple')

/**
 * Returns the data root path from the storage plan.
 * Fallback to DEFAULT_DATA_ROOT if not set.
 */
export const useDataRootPath = () =>
    useSetupStore((state) => {
        const storagePlan = state.config.storagePlan
        return storagePlan?.dataRoot?.path || DEFAULT_DATA_ROOT
    })
