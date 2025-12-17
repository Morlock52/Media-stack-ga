import { useMemo } from 'react'
import { useShallow } from 'zustand/react/shallow'
import type { LucideIcon } from 'lucide-react'
import {
    HardDrive,
    Server,
    Download,
    Clapperboard,
    ListVideo,
    Music,
    BookOpen,
    Headphones,
    Image,
    Cpu,
    Network,
} from 'lucide-react'
import { useSetupStore } from '../store/setupStore'
import {
    STORAGE_CATEGORIES,
    DEFAULT_DATA_ROOT,
    createDefaultStoragePlan,
    type StoragePathType,
} from '../data/storagePlan'

const SERVICE_LABELS: Record<string, string> = {
    plex: 'Plex',
    jellyfin: 'Jellyfin',
    emby: 'Emby',
    radarr: 'Radarr',
    sonarr: 'Sonarr',
    bazarr: 'Bazarr',
    lidarr: 'Lidarr',
    readarr: 'Readarr',
    transcode: 'Tdarr',
    torrent: 'qBittorrent',
    usenet: 'SABnzbd',
    notify: 'Notifiarr',
    arr: '*Arr Stack',
    kavita: 'Kavita',
    audiobookshelf: 'Audiobookshelf',
    photoprism: 'PhotoPrism',
}

const CATEGORY_ICONS: Record<string, LucideIcon> = {
    dataRoot: HardDrive,
    configRoot: Server,
    downloads: Download,
    movies: Clapperboard,
    tv: ListVideo,
    music: Music,
    books: BookOpen,
    audiobooks: Headphones,
    photos: Image,
    transcode: Cpu,
}

const networkPattern = /^(\\\\|\/\/|smb:|nfs:)/i
const absolutePathPattern = /^(\/|\\\\|\/\/|[A-Za-z]:\\)/

export function StoragePlanner() {
    const { selectedServices, storagePlan, updateStoragePath, storageMode, setStorageMode } = useSetupStore(
        useShallow((state) => ({
            selectedServices: state.selectedServices,
            storagePlan: state.config.storagePlan,
            updateStoragePath: state.updateStoragePath,
            storageMode: state.storageMode,
            setStorageMode: state.setStorageMode,
        }))
    )

    const plan = storagePlan ?? createDefaultStoragePlan(DEFAULT_DATA_ROOT)
    const planDataRoot = plan.dataRoot?.path || DEFAULT_DATA_ROOT
    const defaults = createDefaultStoragePlan(planDataRoot)
    const isSimpleMode = storageMode === 'simple'

    const relevantCategories = useMemo(() => {
        const lookup = new Set(selectedServices)
        return STORAGE_CATEGORIES.filter((category) => {
            if (category.alwaysVisible) return true
            if (category.services.length === 0) return false
            return category.services.some((service) => lookup.has(service))
        })
    }, [selectedServices])

    const handlePathChange = (categoryId: string, value: string) => {
        updateStoragePath(categoryId, { path: value })
    }

    const handleTypeChange = (categoryId: string, type: StoragePathType) => {
        updateStoragePath(categoryId, { type })
    }

    const handleBrowse = (categoryId: string, currentValue: string) => {
        if (typeof window === 'undefined') return
        const input = window.prompt(
            'Enter the full path or network share (e.g. /mnt/media or \\\\NAS\\Media)',
            currentValue
        )
        if (input && input.trim()) {
            const trimmed = input.trim()
            updateStoragePath(categoryId, {
                path: trimmed,
                type: networkPattern.test(trimmed) ? 'network' : undefined,
            })
        }
    }

    const handleReset = (categoryId: string) => {
        const category = STORAGE_CATEGORIES.find((c) => c.id === categoryId)
        if (!category) return
        const rootForDefault = categoryId === 'dataRoot' ? DEFAULT_DATA_ROOT : planDataRoot
        updateStoragePath(categoryId, {
            path: category.defaultPath(rootForDefault),
            type: 'local',
        })
    }

    const handleSimpleRootChange = (value: string) => {
        updateStoragePath('dataRoot', { path: value })
    }

    const isAbsolutePath = (value: string) => !value || absolutePathPattern.test(value)

    return (
        <section className="space-y-4">
            <div className="flex flex-wrap gap-2">
                {([
                    { id: 'simple' as const, label: 'Simple (Single Root)' },
                    { id: 'advanced' as const, label: 'Advanced (Per-Service)' },
                ]).map((option) => (
                    <button
                        key={option.id}
                        type="button"
                        onClick={() => setStorageMode(option.id)}
                        className={`px-4 py-2 rounded-xl text-sm font-medium transition ${
                            storageMode === option.id
                                ? 'bg-purple-600 text-white shadow-lg shadow-purple-500/30'
                                : 'bg-muted/60 text-muted-foreground border border-border hover:border-purple-500/30'
                        }`}
                    >
                        {option.label}
                    </button>
                ))}
            </div>

            <div className="p-4 bg-purple-500/5 border border-purple-500/30 rounded-xl flex gap-3">
                <div className="p-2 rounded-lg bg-purple-500/20 text-purple-200">
                    <Network className="w-4 h-4" />
                </div>
                <div className="text-sm text-purple-100/80">
                    <p className="font-medium text-white">Storage plan</p>
                    <p className="text-purple-100/70">
                        Paths start with your local data root ({planDataRoot}). Update them if your libraries or
                        downloads live on a NAS or mounted network share.
                    </p>
                </div>
            </div>

            {isSimpleMode ? (
                <div className="space-y-4">
                    <div className="rounded-2xl border border-border bg-muted/40 p-4 space-y-2">
                        <label className="text-xs uppercase tracking-[0.25em] text-muted-foreground">Data root</label>
                        <input
                            value={planDataRoot}
                            onChange={(e) => handleSimpleRootChange(e.target.value)}
                            placeholder={DEFAULT_DATA_ROOT}
                            className="w-full bg-background/60 border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-purple-500/40"
                        />
                        <p className="text-xs text-muted-foreground">
                            Every path in your compose file is derived from this root. Want per-service overrides? Flip
                            the toggle above to Advanced mode.
                        </p>
                    </div>

                    <div className="overflow-hidden rounded-2xl border border-border bg-card">
                        <table className="w-full text-sm text-foreground">
                            <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
                                <tr>
                                    <th className="px-4 py-3 text-left font-semibold text-foreground/80">Category</th>
                                    <th className="px-4 py-3 text-left">Used By</th>
                                    <th className="px-4 py-3 text-left">Path</th>
                                </tr>
                            </thead>
                            <tbody>
                                {relevantCategories.map((category) => {
                                    const servicesForCategory = category.services.filter((service) =>
                                        selectedServices.includes(service)
                                    )
                                    const path =
                                        category.id === 'dataRoot'
                                            ? planDataRoot
                                            : defaults[category.id]?.path || ''
                                    return (
                                        <tr key={category.id} className="border-t border-border">
                                            <td className="px-4 py-3 align-top">
                                                <p className="text-foreground font-medium text-sm">{category.label}</p>
                                                <p className="text-xs text-muted-foreground">{category.description}</p>
                                            </td>
                                            <td className="px-4 py-3 align-top text-xs text-muted-foreground">
                                                {servicesForCategory.length > 0 ? (
                                                    <div className="flex flex-wrap gap-1">
                                                        {servicesForCategory.map((service) => (
                                                            <span
                                                                key={`${category.id}-${service}`}
                                                                className="px-2 py-0.5 rounded-full bg-muted/60 text-[10px] uppercase tracking-wide text-muted-foreground"
                                                            >
                                                                {SERVICE_LABELS[service] || service}
                                                            </span>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <span className="text-muted-foreground">All services</span>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 align-top font-mono text-xs text-foreground">{path}</td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            ) : (
                <div className="space-y-4">
                {relevantCategories.map((category) => {
                    const Icon = CATEGORY_ICONS[category.id] || HardDrive
                    const value = plan[category.id]?.path || defaults[category.id]?.path || ''
                    const type = plan[category.id]?.type || 'local'
                    const servicesForCategory = category.services.filter((service) =>
                        selectedServices.includes(service)
                    )
                    const validPath = isAbsolutePath(value)
                    return (
                        <div
                            key={category.id}
                            className="rounded-2xl border border-border bg-card p-4 shadow-inner"
                        >
                            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                                <div className="flex items-start gap-3">
                                    <div className="p-2 rounded-xl bg-muted/60 text-foreground/80">
                                        <Icon className="w-4 h-4" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-semibold text-foreground">{category.label}</p>
                                        <p className="text-xs text-muted-foreground">{category.description}</p>
                                        {servicesForCategory.length > 0 && (
                                            <div className="flex flex-wrap gap-1 mt-2">
                                                {servicesForCategory.map((service) => (
                                                    <span
                                                        key={`${category.id}-${service}`}
                                                        className="px-2 py-0.5 rounded-full bg-muted/60 text-[10px] uppercase tracking-wide text-muted-foreground"
                                                    >
                                                        {SERVICE_LABELS[service] || service}
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="flex items-center gap-2">
                                    <label className="text-[10px] uppercase tracking-wider text-muted-foreground">
                                        Path Type
                                    </label>
                                    <select
                                        aria-label="Path Type"
                                        value={type}
                                        onChange={(e) => handleTypeChange(category.id, e.target.value as StoragePathType)}
                                        className="bg-background/60 border border-border rounded-lg text-xs text-foreground px-3 py-2 focus:outline-none focus:ring-1 focus:ring-purple-500/40"
                                    >
                                        <option value="local">Local disk / mount</option>
                                        <option value="network">Network share (SMB/NFS)</option>
                                    </select>
                                </div>
                            </div>

                            <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
                                <input
                                    value={value}
                                    onChange={(e) => handlePathChange(category.id, e.target.value)}
                                    placeholder={defaults[category.id]?.path || ''}
                                    className={`flex-1 bg-background/60 rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 ${
                                        validPath
                                            ? 'border border-border focus:ring-purple-500/40'
                                            : 'border border-red-500/60 focus:ring-red-500/40'
                                    }`}
                                />
                                <div className="flex gap-2">
                                    <button
                                        type="button"
                                        onClick={() => handleBrowse(category.id, value)}
                                        className="px-3 py-2 rounded-lg border border-border text-xs text-muted-foreground hover:text-foreground hover:border-purple-500/30 transition-colors"
                                    >
                                        Browse
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => handleReset(category.id)}
                                        className="px-3 py-2 rounded-lg border border-border text-xs text-muted-foreground hover:text-foreground hover:border-purple-500/30 transition-colors"
                                    >
                                        Reset
                                    </button>
                                </div>
                            </div>

                            {!validPath ? (
                                <p className="text-xs text-red-400 mt-2">
                                    Paths must be absolute (start with `/`, `C:\`, `//`, or `\\\\NAS\\share`). Update the
                                    path or switch to Simple mode if everything lives under one root.
                                </p>
                            ) : type === 'network' ? (
                                <p className="text-xs text-primary mt-2">
                                    Tip: Use UNC paths like <code className="font-mono">//NAS/Media</code> or
                                    smb://server/share when pointing at remote storage.
                                </p>
                            ) : (
                                <p className="text-xs text-muted-foreground mt-2">
                                    This path stays on the local host. For remote shares, switch the type to Network.
                                </p>
                            )}
                        </div>
                    )
                })}
                </div>
            )}
        </section>
    )
}
