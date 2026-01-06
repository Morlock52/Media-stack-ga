import { useState } from 'react'
import { motion } from 'motion/react'
import {
    Database,
    HardDrive,
    FileCode,
    Clapperboard,
    CheckSquare,
    Square,
    CheckCircle2,
    Info,
} from 'lucide-react'
import { useBackupStore } from '../../store/backupStore'
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
function groupItemsByType(items: Array<{ type: string; name: string; path: string; service?: string; size: number; compressedSize: number }>) {
    const grouped: Record<string, Array<{ type: string; name: string; path: string; service?: string; size: number; compressedSize: number }>> = {
        config: [],
        database: [],
        metadata: [],
        volume: [],
    }

    items.forEach(item => {
        const type = item.type.toLowerCase()
        if (!grouped[type]) {
            grouped[type] = []
        }
        grouped[type].push(item)
    })

    return grouped
}

// Get icon for each item type
function getTypeIcon(type: string) {
    switch (type.toLowerCase()) {
        case 'config':
            return FileCode
        case 'database':
            return Database
        case 'metadata':
            return Clapperboard
        case 'volume':
            return HardDrive
        default:
            return HardDrive
    }
}

// Get display name for each item type
function getTypeName(type: string): string {
    switch (type.toLowerCase()) {
        case 'config':
            return 'Configuration Files'
        case 'database':
            return 'Databases'
        case 'metadata':
            return 'Metadata'
        case 'volume':
            return 'Docker Volumes'
        default:
            return type
    }
}

export function RestoreSelectionStep() {
    const {
        restorePreviewData,
        restoreSelectedItems,
        toggleRestoreItem,
        selectAllRestoreItems,
        deselectAllRestoreItems,
    } = useBackupStore()

    const [expandedTypes, setExpandedTypes] = useState<Set<string>>(
        new Set(['config', 'database', 'metadata', 'volume'])
    )

    if (!restorePreviewData) {
        return (
            <div className="text-center py-12">
                <Info className="w-16 h-16 text-amber-400 mx-auto mb-4" />
                <h2 className="text-2xl font-bold mb-2">No Backup Data Available</h2>
                <p className="text-muted-foreground">
                    Please go back and validate the backup first.
                </p>
            </div>
        )
    }

    const items = restorePreviewData.items || []
    const groupedItems = groupItemsByType(items)

    // Calculate totals
    const selectedCount = restoreSelectedItems.length
    const totalCount = items.length
    const selectedSize = items
        .filter(item => restoreSelectedItems.includes(item.name))
        .reduce((sum, item) => sum + item.size, 0)
    const totalSize = items.reduce((sum, item) => sum + item.size, 0)

    const toggleTypeExpansion = (type: string) => {
        const newExpanded = new Set(expandedTypes)
        if (newExpanded.has(type)) {
            newExpanded.delete(type)
        } else {
            newExpanded.add(type)
        }
        setExpandedTypes(newExpanded)
    }

    const isItemSelected = (itemName: string) => {
        return restoreSelectedItems.includes(itemName)
    }

    const isTypeFullySelected = (type: string) => {
        const typeItems = groupedItems[type] || []
        if (typeItems.length === 0) return false
        return typeItems.every(item => restoreSelectedItems.includes(item.name))
    }

    const isTypePartiallySelected = (type: string) => {
        const typeItems = groupedItems[type] || []
        if (typeItems.length === 0) return false
        const selectedInType = typeItems.filter(item => restoreSelectedItems.includes(item.name)).length
        return selectedInType > 0 && selectedInType < typeItems.length
    }

    const toggleTypeGroup = (type: string) => {
        const typeItems = groupedItems[type] || []
        const allSelected = isTypeFullySelected(type)

        if (allSelected) {
            // Deselect all items of this type
            typeItems.forEach(item => {
                if (restoreSelectedItems.includes(item.name)) {
                    toggleRestoreItem(item.name)
                }
            })
        } else {
            // Select all items of this type
            typeItems.forEach(item => {
                if (!restoreSelectedItems.includes(item.name)) {
                    toggleRestoreItem(item.name)
                }
            })
        }
    }

    const handleSelectAll = () => {
        selectAllRestoreItems()
        toast.success(`Selected all ${totalCount} items`)
    }

    const handleDeselectAll = () => {
        deselectAllRestoreItems()
        toast.info('Deselected all items')
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="text-center">
                <h2 className="text-2xl font-bold mb-2">Choose Items to Restore</h2>
                <p className="text-muted-foreground">
                    Select which items you want to restore. Leave empty to restore everything.
                </p>
            </div>

            {/* Info Banner */}
            <div className="rounded-lg border border-cyan-500/30 bg-cyan-500/10 p-4">
                <div className="flex items-start gap-3">
                    <Info className="w-5 h-5 text-cyan-400 mt-0.5 flex-shrink-0" />
                    <div className="text-left">
                        <h3 className="text-sm font-semibold text-cyan-400 mb-1">
                            Selective Restore
                        </h3>
                        <p className="text-xs text-cyan-200/80">
                            You can restore specific items (e.g., only Sonarr config) or leave the selection empty to restore everything from the backup.
                        </p>
                    </div>
                </div>
            </div>

            {/* Summary and Actions */}
            <div className="flex items-center justify-between flex-wrap gap-4">
                <div className="text-sm text-muted-foreground">
                    {selectedCount === 0 ? (
                        <span className="text-amber-400 font-medium">Will restore all {totalCount} items</span>
                    ) : (
                        <>
                            <span className="font-medium text-primary">
                                {selectedCount} / {totalCount} items
                            </span>
                            {' • '}
                            <span className="font-medium text-primary">
                                {formatBytes(selectedSize)} / {formatBytes(totalSize)}
                            </span>
                        </>
                    )}
                </div>

                <div className="flex gap-2">
                    <Button
                        type="button"
                        variant="glass"
                        size="sm"
                        onClick={handleSelectAll}
                        disabled={selectedCount === totalCount}
                    >
                        <CheckSquare className="w-4 h-4" />
                        Select All
                    </Button>
                    <Button
                        type="button"
                        variant="glass"
                        size="sm"
                        onClick={handleDeselectAll}
                        disabled={selectedCount === 0}
                    >
                        <Square className="w-4 h-4" />
                        Deselect All
                    </Button>
                </div>
            </div>

            {/* Items grouped by type */}
            <div className="space-y-4">
                {Object.entries(groupedItems).map(([type, typeItems]) => {
                    if (typeItems.length === 0) return null

                    const Icon = getTypeIcon(type)
                    const typeName = getTypeName(type)
                    const typeSize = typeItems.reduce((sum, item) => sum + item.size, 0)
                    const isExpanded = expandedTypes.has(type)
                    const isFullySelected = isTypeFullySelected(type)
                    const isPartiallySelected = isTypePartiallySelected(type)

                    return (
                        <InteractiveCard key={type} className="p-4">
                            {/* Type Header */}
                            <button
                                type="button"
                                onClick={() => toggleTypeExpansion(type)}
                                className="w-full flex items-center justify-between mb-4 hover:opacity-80 transition-opacity"
                            >
                                <div className="flex items-center gap-3">
                                    <div
                                        onClick={(e) => {
                                            e.stopPropagation()
                                            toggleTypeGroup(type)
                                        }}
                                        className="flex items-center justify-center w-5 h-5 border-2 border-border rounded cursor-pointer hover:border-primary transition-colors"
                                    >
                                        {isFullySelected && (
                                            <CheckCircle2 className="w-4 h-4 text-green-400" />
                                        )}
                                        {isPartiallySelected && (
                                            <div className="w-2 h-2 bg-primary rounded" />
                                        )}
                                    </div>
                                    <Icon className="w-5 h-5 text-primary" />
                                    <h3 className="text-lg font-semibold">{typeName}</h3>
                                    <span className="text-sm text-muted-foreground">
                                        ({typeItems.length} items • {formatBytes(typeSize)})
                                    </span>
                                </div>
                                <motion.div
                                    animate={{ rotate: isExpanded ? 180 : 0 }}
                                    transition={{ duration: 0.2 }}
                                >
                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                    </svg>
                                </motion.div>
                            </button>

                            {/* Items List */}
                            {isExpanded && (
                                <motion.div
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: 'auto' }}
                                    exit={{ opacity: 0, height: 0 }}
                                    transition={{ duration: 0.2 }}
                                    className="space-y-2"
                                >
                                    {typeItems.map((item) => {
                                        const selected = isItemSelected(item.name)
                                        const ItemIcon = getTypeIcon(item.type)

                                        return (
                                            <button
                                                key={item.name}
                                                type="button"
                                                onClick={() => toggleRestoreItem(item.name)}
                                                className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-all ${
                                                    selected
                                                        ? 'bg-primary/10 border-primary/50 hover:bg-primary/15'
                                                        : 'bg-muted/40 border-border hover:bg-muted/60'
                                                }`}
                                            >
                                                {/* Checkbox */}
                                                <div className="flex items-center justify-center w-5 h-5 border-2 border-border rounded">
                                                    {selected && (
                                                        <CheckCircle2 className="w-4 h-4 text-green-400" />
                                                    )}
                                                </div>

                                                {/* Icon */}
                                                <ItemIcon className="w-5 h-5 text-muted-foreground flex-shrink-0" />

                                                {/* Item Details */}
                                                <div className="flex-1 text-left min-w-0">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <p className="font-medium truncate">{item.name}</p>
                                                        {item.service && (
                                                            <span className="text-xs px-2 py-0.5 rounded bg-primary/20 text-primary">
                                                                {item.service}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                                        <span className="truncate">{item.path}</span>
                                                        <span>•</span>
                                                        <span className="flex-shrink-0">{formatBytes(item.size)}</span>
                                                    </div>
                                                </div>
                                            </button>
                                        )
                                    })}
                                </motion.div>
                            )}
                        </InteractiveCard>
                    )
                })}
            </div>

            {/* Selection Summary */}
            {selectedCount === 0 ? (
                <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4">
                    <div className="flex items-start gap-3">
                        <Info className="w-5 h-5 text-amber-400 mt-0.5 flex-shrink-0" />
                        <div className="text-left">
                            <h3 className="text-sm font-semibold text-amber-400 mb-1">
                                Full Restore Mode
                            </h3>
                            <p className="text-xs text-amber-200/80">
                                No items selected. All {totalCount} items ({formatBytes(totalSize)}) will be restored from the backup.
                            </p>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="rounded-lg border border-green-500/30 bg-green-500/10 p-4">
                    <div className="flex items-start gap-3">
                        <CheckCircle2 className="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0" />
                        <div className="text-left">
                            <h3 className="text-sm font-semibold text-green-400 mb-1">
                                Selective Restore
                            </h3>
                            <p className="text-xs text-green-200/80">
                                {selectedCount} item{selectedCount > 1 ? 's' : ''} selected ({formatBytes(selectedSize)}) will be restored. Other items will remain unchanged.
                            </p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
