import { useEffect, useState } from 'react'
import { motion } from 'motion/react'
import { Database, HardDrive, FileCode, Clapperboard, Loader2, CheckSquare, Square, RefreshCw } from 'lucide-react'
import { useBackupStore, type BackupItem, type BackupItemType } from '../../store/backupStore'
import { useBackupDiscover } from '../../hooks/useBackup'
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

// Group items by type for better organization
function groupItemsByType(items: BackupItem[]): Record<BackupItemType, BackupItem[]> {
    const grouped: Record<BackupItemType, BackupItem[]> = {
        config: [],
        volume: [],
        database: [],
        metadata: [],
    }

    items.forEach(item => {
        if (grouped[item.type]) {
            grouped[item.type].push(item)
        }
    })

    return grouped
}

// Get icon for each item type
function getTypeIcon(type: BackupItemType) {
    switch (type) {
        case 'config':
            return FileCode
        case 'volume':
            return HardDrive
        case 'database':
            return Database
        case 'metadata':
            return Clapperboard
        default:
            return HardDrive
    }
}

// Get display name for each item type
function getTypeName(type: BackupItemType): string {
    switch (type) {
        case 'config':
            return 'Configuration Files'
        case 'volume':
            return 'Docker Volumes'
        case 'database':
            return 'Databases'
        case 'metadata':
            return 'Metadata'
        default:
            return type
    }
}

export function SelectionStep() {
    const {
        availableItems,
        selectedItems,
        setAvailableItems,
        toggleItem,
        selectAllItems,
        deselectAllItems,
    } = useBackupStore()

    const { discover, loading: discovering } = useBackupDiscover()
    const [initialLoad, setInitialLoad] = useState(true)

    // Discover available backup targets on mount
    useEffect(() => {
        const discoverTargets = async () => {
            try {
                const result = await discover()
                setAvailableItems(result.targets)
                toast.success(`Discovered ${result.count} backup targets (${formatBytes(result.totalSize)})`)
            } catch (error) {
                const errorMsg = error instanceof Error ? error.message : 'Failed to discover backup targets'
                toast.error(errorMsg)
            } finally {
                setInitialLoad(false)
            }
        }

        if (initialLoad) {
            discoverTargets()
        }
    }, [discover, setAvailableItems, initialLoad])

    const handleRefresh = async () => {
        try {
            const result = await discover()
            setAvailableItems(result.targets)
            toast.success(`Refreshed: ${result.count} backup targets (${formatBytes(result.totalSize)})`)
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : 'Failed to refresh backup targets'
            toast.error(errorMsg)
        }
    }

    // Calculate total selected size
    const totalSelectedSize = selectedItems.reduce((sum, item) => sum + (item.estimatedSize || 0), 0)
    const totalAvailableSize = availableItems.reduce((sum, item) => sum + (item.estimatedSize || 0), 0)

    // Group items by type
    const groupedItems = groupItemsByType(availableItems)

    // Check if an item is selected
    const isItemSelected = (itemName: string) => {
        return selectedItems.some(item => item.name === itemName)
    }

    // Check if all items in a type group are selected
    const isTypeFullySelected = (type: BackupItemType) => {
        const typeItems = groupedItems[type]
        if (typeItems.length === 0) return false
        return typeItems.every(item => isItemSelected(item.name))
    }

    // Toggle all items in a type group
    const toggleTypeGroup = (type: BackupItemType) => {
        const typeItems = groupedItems[type]
        const allSelected = isTypeFullySelected(type)

        if (allSelected) {
            // Deselect all items in this type
            typeItems.forEach(item => {
                if (isItemSelected(item.name)) {
                    toggleItem(item.name)
                }
            })
        } else {
            // Select all items in this type
            typeItems.forEach(item => {
                if (!isItemSelected(item.name)) {
                    toggleItem(item.name)
                }
            })
        }
    }

    if (initialLoad && discovering) {
        return (
            <motion.div
                key="selection-loading"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="flex flex-col items-center justify-center py-12"
            >
                <Loader2 className="w-12 h-12 text-primary animate-spin mb-4" />
                <h2 className="text-2xl font-bold text-foreground mb-2">Discovering Backup Targets</h2>
                <p className="text-muted-foreground">Scanning running containers and volumes...</p>
            </motion.div>
        )
    }

    return (
        <motion.div
            key="selection"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-6"
        >
            <div className="mb-6">
                <h2 className="text-2xl font-bold text-foreground mb-2">Select Items to Backup</h2>
                <p className="text-muted-foreground">
                    Choose which configurations, databases, volumes, and metadata to include in your backup
                </p>
            </div>

            {/* Summary and Actions */}
            <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-primary/10 border border-primary/30 rounded-xl">
                <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                    <div>
                        <span className="text-sm text-muted-foreground">Selected: </span>
                        <span className="text-lg font-bold text-primary">
                            {selectedItems.length} / {availableItems.length}
                        </span>
                    </div>
                    <div className="h-4 w-px bg-border hidden sm:block" />
                    <div>
                        <span className="text-sm text-muted-foreground">Size: </span>
                        <span className="text-lg font-bold text-primary">
                            {formatBytes(totalSelectedSize)}
                        </span>
                        {totalAvailableSize > 0 && (
                            <span className="text-sm text-muted-foreground ml-1">
                                / {formatBytes(totalAvailableSize)}
                            </span>
                        )}
                    </div>
                </div>

                <div className="flex gap-2">
                    <Button
                        type="button"
                        onClick={handleRefresh}
                        variant="outline"
                        size="sm"
                        disabled={discovering}
                        className="btn-lift"
                    >
                        {discovering ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                            <RefreshCw className="w-4 h-4" />
                        )}
                        Refresh
                    </Button>
                    <Button
                        type="button"
                        onClick={selectAllItems}
                        variant="outline"
                        size="sm"
                        disabled={selectedItems.length === availableItems.length}
                        className="btn-lift"
                    >
                        <CheckSquare className="w-4 h-4" />
                        Select All
                    </Button>
                    <Button
                        type="button"
                        onClick={deselectAllItems}
                        variant="outline"
                        size="sm"
                        disabled={selectedItems.length === 0}
                        className="btn-lift"
                    >
                        <Square className="w-4 h-4" />
                        Deselect All
                    </Button>
                </div>
            </div>

            {/* No items found message */}
            {availableItems.length === 0 && !discovering && (
                <InteractiveCard>
                    <div className="text-center py-8">
                        <Database className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                        <p className="text-muted-foreground">
                            No backup targets found. Make sure your Docker containers are running.
                        </p>
                        <Button
                            type="button"
                            onClick={handleRefresh}
                            variant="outline"
                            size="sm"
                            className="mt-4 btn-lift"
                        >
                            <RefreshCw className="w-4 h-4" />
                            Refresh
                        </Button>
                    </div>
                </InteractiveCard>
            )}

            {/* Grouped Items by Type */}
            <div className="space-y-6">
                {(['config', 'database', 'metadata', 'volume'] as BackupItemType[]).map(type => {
                    const typeItems = groupedItems[type]
                    if (typeItems.length === 0) return null

                    const TypeIcon = getTypeIcon(type)
                    const typeFullySelected = isTypeFullySelected(type)
                    const typeTotalSize = typeItems.reduce((sum, item) => sum + (item.estimatedSize || 0), 0)

                    return (
                        <motion.div
                            key={type}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="space-y-3"
                        >
                            {/* Type Header */}
                            <div className="flex items-center justify-between">
                                <button
                                    type="button"
                                    onClick={() => toggleTypeGroup(type)}
                                    className="flex items-center gap-3 text-left group cursor-pointer hover:opacity-80 transition-opacity"
                                >
                                    <div className={`w-6 h-6 rounded border-2 flex items-center justify-center transition-all ${
                                        typeFullySelected
                                            ? 'bg-primary/20 border-primary'
                                            : 'bg-background/60 border-border hover:border-primary/50'
                                    }`}>
                                        {typeFullySelected && <CheckSquare className="w-4 h-4 text-primary" />}
                                    </div>
                                    <TypeIcon className="w-5 h-5 text-primary" />
                                    <h3 className="text-lg font-semibold text-foreground group-hover:text-primary transition-colors">
                                        {getTypeName(type)}
                                    </h3>
                                    <span className="text-sm text-muted-foreground">
                                        ({typeItems.length} {typeItems.length === 1 ? 'item' : 'items'}, {formatBytes(typeTotalSize)})
                                    </span>
                                </button>
                            </div>

                            {/* Type Items */}
                            <div className="grid grid-cols-1 gap-2 pl-9">
                                {typeItems.map(item => {
                                    const selected = isItemSelected(item.name)

                                    return (
                                        <InteractiveCard key={item.name}>
                                            <label className="flex items-center justify-between gap-4 cursor-pointer p-3">
                                                <div className="flex items-center gap-3 flex-1 min-w-0">
                                                    <input
                                                        type="checkbox"
                                                        checked={selected}
                                                        onChange={() => toggleItem(item.name)}
                                                        className="h-4 w-4 rounded border-border text-primary focus:ring-2 focus:ring-primary focus:ring-offset-0 cursor-pointer"
                                                    />
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-2">
                                                            <span className="font-medium text-foreground truncate">
                                                                {item.name}
                                                            </span>
                                                            {item.service && (
                                                                <span className="px-2 py-0.5 text-xs rounded-full bg-primary/10 border border-primary/30 text-primary whitespace-nowrap">
                                                                    {item.service}
                                                                </span>
                                                            )}
                                                        </div>
                                                        <p className="text-xs text-muted-foreground truncate mt-0.5">
                                                            {item.path}
                                                        </p>
                                                    </div>
                                                </div>

                                                <div className="text-sm font-medium text-primary whitespace-nowrap">
                                                    {item.estimatedSize ? formatBytes(item.estimatedSize) : 'Unknown'}
                                                </div>
                                            </label>
                                        </InteractiveCard>
                                    )
                                })}
                            </div>
                        </motion.div>
                    )
                })}
            </div>

            {/* Warning if no items selected */}
            {availableItems.length > 0 && selectedItems.length === 0 && (
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl"
                >
                    <p className="text-sm text-amber-400">
                        <span className="font-medium">⚠️ No items selected:</span> Please select at least one item to backup.
                    </p>
                </motion.div>
            )}
        </motion.div>
    )
}
