import { useEffect, useState } from 'react'
import { motion } from 'motion/react'
import {
    HardDrive,
    Cloud,
    FolderSync,
    Calendar,
    Database,
    Shield,
    ShieldOff,
    Loader2,
    RefreshCw,
    CheckCircle2,
    Search,
    ArrowUpDown,
    Clock
} from 'lucide-react'
import { useBackupStore, type BackupHistoryEntry, type BackupDestination } from '../../store/backupStore'
import { useBackupList } from '../../hooks/useBackup'
import { Button } from '../ui/button'
import { InteractiveCard } from '../ui/interactive-card'
import { toast } from 'sonner'

// Utility function to format bytes to human-readable sizes
function formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`
}

// Format date to human-readable format
function formatDate(dateString: string): string {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

    if (diffDays === 0) {
        return `Today at ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
    } else if (diffDays === 1) {
        return `Yesterday at ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
    } else if (diffDays < 7) {
        return `${diffDays} days ago`
    } else {
        return date.toLocaleDateString([], { year: 'numeric', month: 'short', day: 'numeric' })
    }
}

// Get icon for destination type
function getDestinationIcon(type: 'local' | 's3' | 'rclone') {
    switch (type) {
        case 'local':
            return HardDrive
        case 's3':
            return Cloud
        case 'rclone':
            return FolderSync
        default:
            return HardDrive
    }
}

// Get destination display name
function getDestinationName(destination: BackupDestination): string {
    switch (destination.type) {
        case 'local':
            return destination.path
        case 's3':
            return `${destination.bucket}${destination.pathPrefix ? `/${destination.pathPrefix}` : ''}`
        case 'rclone':
            return `${destination.remoteName}:${destination.remotePath}`
        default:
            return 'Unknown'
    }
}

// Sort options
type SortOption = 'date-desc' | 'date-asc' | 'size-desc' | 'size-asc' | 'name-asc' | 'name-desc'

export function BackupSelector() {
    const {
        destination,
        selectedBackupForRestore,
        setSelectedBackupForRestore,
    } = useBackupStore()

    const { listBackups, loading: fetchingBackups } = useBackupList()
    const [backups, setBackups] = useState<BackupHistoryEntry[]>([])
    const [initialLoad, setInitialLoad] = useState(true)
    const [searchQuery, setSearchQuery] = useState('')
    const [sortOption, setSortOption] = useState<SortOption>('date-desc')

    // Fetch backups on mount
    useEffect(() => {
        const fetchBackupList = async () => {
            if (!destination) {
                toast.error('Please configure a backup destination first')
                return
            }

            try {
                const result = await listBackups({ destination })
                setBackups(result.backups)
                if (result.total === 0) {
                    toast.info('No backups found at this destination')
                } else {
                    toast.success(`Found ${result.total} backup${result.total === 1 ? '' : 's'}`)
                }
            } catch (error) {
                const errorMsg = error instanceof Error ? error.message : 'Failed to list backups'
                toast.error(errorMsg)
            } finally {
                setInitialLoad(false)
            }
        }

        if (initialLoad && destination) {
            fetchBackupList()
        }
    }, [listBackups, destination, initialLoad])

    const handleRefresh = async () => {
        if (!destination) {
            toast.error('Please configure a backup destination first')
            return
        }

        try {
            const result = await listBackups({ destination })
            setBackups(result.backups)
            toast.success(`Refreshed: ${result.total} backup${result.total === 1 ? '' : 's'}`)
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : 'Failed to refresh backups'
            toast.error(errorMsg)
        }
    }

    const handleSelectBackup = (backup: BackupHistoryEntry) => {
        setSelectedBackupForRestore(backup)
        toast.success(`Selected backup: ${backup.name}`)
    }

    // Filter backups by search query
    const filteredBackups = backups.filter(backup => {
        if (!searchQuery) return true
        const query = searchQuery.toLowerCase()
        return (
            backup.name.toLowerCase().includes(query) ||
            backup.id.toLowerCase().includes(query) ||
            formatDate(backup.createdAt).toLowerCase().includes(query)
        )
    })

    // Sort backups
    const sortedBackups = [...filteredBackups].sort((a, b) => {
        switch (sortOption) {
            case 'date-desc':
                return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
            case 'date-asc':
                return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
            case 'size-desc':
                return b.compressedSize - a.compressedSize
            case 'size-asc':
                return a.compressedSize - b.compressedSize
            case 'name-asc':
                return a.name.localeCompare(b.name)
            case 'name-desc':
                return b.name.localeCompare(a.name)
            default:
                return 0
        }
    })

    if (initialLoad && fetchingBackups) {
        return (
            <motion.div
                key="backup-selector-loading"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="flex flex-col items-center justify-center py-12"
            >
                <Loader2 className="w-12 h-12 text-primary animate-spin mb-4" />
                <h2 className="text-2xl font-bold text-foreground mb-2">Loading Backups</h2>
                <p className="text-muted-foreground">Fetching backups from destination...</p>
            </motion.div>
        )
    }

    if (!destination) {
        return (
            <motion.div
                key="no-destination"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="text-center py-12"
            >
                <HardDrive className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                <h2 className="text-2xl font-bold text-foreground mb-2">No Destination Configured</h2>
                <p className="text-muted-foreground">
                    Please configure a backup destination in the Backup Wizard first
                </p>
            </motion.div>
        )
    }

    return (
        <motion.div
            key="backup-selector"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-6"
        >
            <div className="mb-6">
                <h2 className="text-2xl font-bold text-foreground mb-2">Select Backup to Restore</h2>
                <p className="text-muted-foreground">
                    Choose a backup from your configured destination to restore
                </p>
            </div>

            {/* Destination Info */}
            <div className="p-4 bg-primary/10 border border-primary/30 rounded-xl">
                <div className="flex items-center gap-3">
                    {(() => {
                        const DestIcon = getDestinationIcon(destination.type)
                        return <DestIcon className="w-5 h-5 text-primary" />
                    })()}
                    <div>
                        <span className="text-sm text-muted-foreground">Destination: </span>
                        <span className="text-sm font-semibold text-foreground">
                            {destination.type.toUpperCase()} - {getDestinationName(destination)}
                        </span>
                    </div>
                </div>
            </div>

            {/* Search and Sort Controls */}
            <div className="flex flex-col sm:flex-row gap-3">
                {/* Search */}
                <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                        type="text"
                        placeholder="Search backups by name or date..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 bg-background/60 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 text-foreground placeholder:text-muted-foreground"
                    />
                </div>

                {/* Sort */}
                <div className="flex items-center gap-2">
                    <ArrowUpDown className="w-4 h-4 text-muted-foreground" />
                    <select
                        value={sortOption}
                        onChange={(e) => setSortOption(e.target.value as SortOption)}
                        className="px-3 py-2 bg-background/60 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 text-foreground cursor-pointer"
                    >
                        <option value="date-desc">Newest First</option>
                        <option value="date-asc">Oldest First</option>
                        <option value="size-desc">Largest First</option>
                        <option value="size-asc">Smallest First</option>
                        <option value="name-asc">Name A-Z</option>
                        <option value="name-desc">Name Z-A</option>
                    </select>
                </div>

                {/* Refresh */}
                <Button
                    type="button"
                    onClick={handleRefresh}
                    variant="outline"
                    size="sm"
                    disabled={fetchingBackups}
                    className="btn-lift"
                >
                    {fetchingBackups ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                        <RefreshCw className="w-4 h-4" />
                    )}
                    Refresh
                </Button>
            </div>

            {/* No backups found */}
            {sortedBackups.length === 0 && !fetchingBackups && (
                <InteractiveCard>
                    <div className="text-center py-8">
                        <Database className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                        <p className="text-muted-foreground mb-4">
                            {searchQuery
                                ? `No backups matching "${searchQuery}"`
                                : 'No backups found at this destination'}
                        </p>
                        {!searchQuery && (
                            <Button
                                type="button"
                                onClick={handleRefresh}
                                variant="outline"
                                size="sm"
                                className="btn-lift"
                            >
                                <RefreshCw className="w-4 h-4" />
                                Refresh
                            </Button>
                        )}
                    </div>
                </InteractiveCard>
            )}

            {/* Backup List */}
            {sortedBackups.length > 0 && (
                <div className="space-y-3">
                    {sortedBackups.map((backup) => {
                        const isSelected = selectedBackupForRestore?.id === backup.id
                        const EncryptionIcon = backup.encrypted ? Shield : ShieldOff

                        return (
                            <InteractiveCard key={backup.id}>
                                <button
                                    type="button"
                                    onClick={() => handleSelectBackup(backup)}
                                    className={`w-full text-left p-4 transition-all ${
                                        isSelected
                                            ? 'ring-2 ring-primary bg-primary/10'
                                            : 'hover:bg-white/5'
                                    }`}
                                >
                                    <div className="flex items-start justify-between gap-4">
                                        {/* Left: Backup Info */}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-2">
                                                <h3 className="text-lg font-semibold text-foreground truncate">
                                                    {backup.name}
                                                </h3>
                                                {isSelected && (
                                                    <CheckCircle2 className="w-5 h-5 text-green-400 flex-shrink-0" />
                                                )}
                                            </div>

                                            {/* Metadata Row */}
                                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                                                {/* Date */}
                                                <div className="flex items-center gap-1.5">
                                                    <Calendar className="w-4 h-4" />
                                                    <span>{formatDate(backup.createdAt)}</span>
                                                </div>

                                                {/* Size */}
                                                <div className="flex items-center gap-1.5">
                                                    <Database className="w-4 h-4" />
                                                    <span>{formatBytes(backup.compressedSize)}</span>
                                                </div>

                                                {/* Items */}
                                                <div className="flex items-center gap-1.5">
                                                    <HardDrive className="w-4 h-4" />
                                                    <span>{backup.itemCount} {backup.itemCount === 1 ? 'item' : 'items'}</span>
                                                </div>

                                                {/* Encryption */}
                                                <div className={`flex items-center gap-1.5 ${
                                                    backup.encrypted ? 'text-green-400' : 'text-muted-foreground'
                                                }`}>
                                                    <EncryptionIcon className="w-4 h-4" />
                                                    <span>{backup.encrypted ? 'Encrypted' : 'Not encrypted'}</span>
                                                </div>
                                            </div>

                                            {/* Backup ID */}
                                            <div className="mt-2 text-xs text-muted-foreground/60 font-mono">
                                                ID: {backup.id}
                                            </div>
                                        </div>

                                        {/* Right: Status Badge */}
                                        <div className="flex-shrink-0">
                                            {backup.status === 'completed' ? (
                                                <div className="px-3 py-1 rounded-full bg-green-500/10 border border-green-500/30 text-green-400 text-xs font-medium">
                                                    Complete
                                                </div>
                                            ) : (
                                                <div className="px-3 py-1 rounded-full bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-medium">
                                                    Failed
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </button>
                            </InteractiveCard>
                        )
                    })}
                </div>
            )}

            {/* Selected backup summary */}
            {selectedBackupForRestore && (
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-4 bg-green-500/10 border border-green-500/30 rounded-xl"
                >
                    <div className="flex items-center gap-3">
                        <CheckCircle2 className="w-5 h-5 text-green-400 flex-shrink-0" />
                        <div>
                            <p className="text-sm font-medium text-green-400">
                                Selected: {selectedBackupForRestore.name}
                            </p>
                            <p className="text-xs text-green-300/80 mt-0.5">
                                Created {formatDate(selectedBackupForRestore.createdAt)} • {formatBytes(selectedBackupForRestore.compressedSize)} • {selectedBackupForRestore.itemCount} items
                            </p>
                        </div>
                    </div>
                </motion.div>
            )}

            {/* Info banner */}
            {sortedBackups.length > 0 && !selectedBackupForRestore && (
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-4 bg-cyan-500/10 border border-cyan-500/30 rounded-xl"
                >
                    <p className="text-sm text-cyan-400">
                        <span className="font-medium">💡 Tip:</span> Click on a backup to select it for restoration. You'll be able to validate its integrity in the next step.
                    </p>
                </motion.div>
            )}
        </motion.div>
    )
}
