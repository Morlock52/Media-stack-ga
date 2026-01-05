/**
 * BackupHistoryList Component
 * Paginated list of past backups with date, size, status, contents summary
 * Actions: restore, download, delete
 * Filter by date range
 */

import { useEffect, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
    Database,
    Shield,
    ShieldOff,
    Loader2,
    RefreshCw,
    CheckCircle,
    XCircle,
    RotateCcw,
    Download,
    Trash2,
    Calendar,
    ChevronLeft,
    ChevronRight,
    Filter,
    X
} from 'lucide-react'
import { useBackupStore, type BackupHistoryEntry, type BackupDestination } from '../../store/backupStore'
import { useBackupList, useBackupDelete, useRestorePreview, type BackupPreview } from '../../hooks/useBackup'
import { Button } from '../ui/button'
import { InteractiveCard } from '../ui/interactive-card'
import { toast } from 'sonner'
import { useNavigate } from 'react-router-dom'

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
        return date.toLocaleDateString([], { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
    }
}

// Items per page options
const PAGE_SIZE_OPTIONS = [10, 25, 50, 100]

export function BackupHistoryList() {
    const navigate = useNavigate()
    const destination = useBackupStore((state) => state.destination)
    const setSelectedBackupForRestore = useBackupStore((state) => state.setSelectedBackupForRestore)

    const { listBackups, loading: fetchingBackups } = useBackupList()
    const { deleteBackup, loading: deletingBackup } = useBackupDelete()
    const { previewBackup, loading: loadingPreview } = useRestorePreview()

    const [backups, setBackups] = useState<BackupHistoryEntry[]>([])
    const [total, setTotal] = useState(0)
    const [currentPage, setCurrentPage] = useState(1)
    const [pageSize, setPageSize] = useState(10)
    const [showFilters, setShowFilters] = useState(false)
    const [dateFrom, setDateFrom] = useState('')
    const [dateTo, setDateTo] = useState('')
    const [expandedBackupId, setExpandedBackupId] = useState<string | null>(null)
    const [backupPreviews, setBackupPreviews] = useState<Map<string, BackupPreview>>(new Map())

    // Fetch backups list
    const fetchBackupList = useCallback(async () => {
        if (!destination) {
            toast.error('Please configure a backup destination first')
            return
        }

        try {
            const offset = (currentPage - 1) * pageSize
            const result = await listBackups({
                destination,
                limit: pageSize,
                offset,
            })

            // Apply date filtering client-side (since API doesn't support it)
            let filteredBackups = result.backups
            if (dateFrom || dateTo) {
                filteredBackups = result.backups.filter((backup) => {
                    const backupDate = new Date(backup.createdAt)
                    const fromDate = dateFrom ? new Date(dateFrom) : null
                    const toDate = dateTo ? new Date(dateTo) : null

                    if (fromDate && backupDate < fromDate) return false
                    if (toDate) {
                        // Set to end of day for toDate
                        const endOfDay = new Date(toDate)
                        endOfDay.setHours(23, 59, 59, 999)
                        if (backupDate > endOfDay) return false
                    }
                    return true
                })
            }

            setBackups(filteredBackups)
            setTotal(filteredBackups.length > 0 ? result.total : 0)
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to fetch backups'
            toast.error(message)
        }
    }, [destination, listBackups, currentPage, pageSize, dateFrom, dateTo])

    // Fetch backups on mount and when dependencies change
    useEffect(() => {
        fetchBackupList()
    }, [fetchBackupList])

    // Handle delete backup
    const handleDelete = useCallback(async (backup: BackupHistoryEntry) => {
        if (!destination) return

        const confirmed = window.confirm(
            `Are you sure you want to delete backup "${backup.name || backup.id}"?\n\n` +
            `This action cannot be undone and will permanently delete:\n` +
            `• ${backup.itemCount} items\n` +
            `• ${formatBytes(backup.totalCompressedSize)} of data\n\n` +
            `Created: ${formatDate(backup.createdAt)}`
        )

        if (!confirmed) return

        try {
            toast.loading('Deleting backup...', { id: 'delete-backup' })
            const result = await deleteBackup({
                backupId: backup.id,
                destination,
            })

            if (result.errors.length > 0) {
                toast.warning(`Backup deleted with errors: ${result.errors.join(', ')}`, { id: 'delete-backup' })
            } else {
                toast.success(`Backup deleted successfully (${result.deletedFiles.length} files removed)`, { id: 'delete-backup' })
            }

            // Refresh the list
            await fetchBackupList()
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to delete backup'
            toast.error(message, { id: 'delete-backup' })
        }
    }, [destination, deleteBackup, fetchBackupList])

    // Handle restore backup
    const handleRestore = useCallback((backup: BackupHistoryEntry) => {
        setSelectedBackupForRestore(backup)
        navigate('/backup/restore')
        toast.info('Navigating to restore wizard...')
    }, [setSelectedBackupForRestore, navigate])

    // Handle download backup (navigate to restore wizard with info)
    const handleDownload = useCallback((backup: BackupHistoryEntry) => {
        toast.info(
            `To download this backup, use the restore wizard to preview its contents. ` +
            `You can then selectively restore items or download the entire backup.`
        )
        setSelectedBackupForRestore(backup)
        navigate('/backup/restore')
    }, [setSelectedBackupForRestore, navigate])

    // Toggle backup details
    const handleToggleDetails = useCallback(async (backup: BackupHistoryEntry) => {
        if (expandedBackupId === backup.id) {
            setExpandedBackupId(null)
            return
        }

        setExpandedBackupId(backup.id)

        // If preview not loaded yet, fetch it
        if (!backupPreviews.has(backup.id) && destination) {
            try {
                const preview = await previewBackup({
                    backupId: backup.id,
                    destination,
                })
                setBackupPreviews(new Map(backupPreviews.set(backup.id, preview)))
            } catch (error) {
                const message = error instanceof Error ? error.message : 'Failed to load backup details'
                toast.error(message)
            }
        }
    }, [expandedBackupId, backupPreviews, destination, previewBackup])

    // Handle page change
    const handlePageChange = useCallback((newPage: number) => {
        setCurrentPage(newPage)
        window.scrollTo({ top: 0, behavior: 'smooth' })
    }, [])

    // Handle page size change
    const handlePageSizeChange = useCallback((newPageSize: number) => {
        setPageSize(newPageSize)
        setCurrentPage(1) // Reset to first page
    }, [])

    // Clear filters
    const handleClearFilters = useCallback(() => {
        setDateFrom('')
        setDateTo('')
        setCurrentPage(1)
    }, [])

    // Calculate pagination
    const totalPages = Math.ceil(total / pageSize)
    const startIndex = (currentPage - 1) * pageSize + 1
    const endIndex = Math.min(currentPage * pageSize, total)
    const hasFilters = dateFrom || dateTo

    // No destination configured
    if (!destination) {
        return (
            <div className="flex flex-col items-center justify-center p-12 text-center">
                <Database className="h-16 w-16 text-primary/40 mb-4" />
                <h3 className="text-lg font-semibold mb-2">No Backup Destination Configured</h3>
                <p className="text-sm text-muted-foreground mb-4">
                    Configure a backup destination to view your backup history
                </p>
                <Button onClick={() => navigate('/backup/new')}>
                    Configure Backup
                </Button>
            </div>
        )
    }

    return (
        <div className="space-y-4">
            {/* Header with filters */}
            <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-2">
                    <h2 className="text-xl font-semibold">Backup History</h2>
                    <span className="text-sm text-muted-foreground">
                        ({total} total)
                    </span>
                </div>

                <div className="flex items-center gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowFilters(!showFilters)}
                    >
                        <Filter className="h-4 w-4 mr-2" />
                        Filters
                        {hasFilters && (
                            <span className="ml-2 px-1.5 py-0.5 text-xs bg-primary text-primary-foreground rounded">
                                {[dateFrom, dateTo].filter(Boolean).length}
                            </span>
                        )}
                    </Button>

                    <Button
                        variant="outline"
                        size="sm"
                        onClick={fetchBackupList}
                        disabled={fetchingBackups}
                    >
                        <RefreshCw className={`h-4 w-4 ${fetchingBackups ? 'animate-spin' : ''}`} />
                    </Button>
                </div>
            </div>

            {/* Filter panel */}
            <AnimatePresence>
                {showFilters && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.2 }}
                    >
                        <InteractiveCard className="p-4">
                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-sm font-semibold">Date Range Filter</h3>
                                    {hasFilters && (
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={handleClearFilters}
                                        >
                                            <X className="h-4 w-4 mr-1" />
                                            Clear
                                        </Button>
                                    )}
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label htmlFor="dateFrom" className="text-sm font-medium">
                                            From Date
                                        </label>
                                        <input
                                            id="dateFrom"
                                            type="date"
                                            value={dateFrom}
                                            onChange={(e) => setDateFrom(e.target.value)}
                                            className="w-full px-3 py-2 bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <label htmlFor="dateTo" className="text-sm font-medium">
                                            To Date
                                        </label>
                                        <input
                                            id="dateTo"
                                            type="date"
                                            value={dateTo}
                                            onChange={(e) => setDateTo(e.target.value)}
                                            className="w-full px-3 py-2 bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                                        />
                                    </div>
                                </div>

                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                    <Calendar className="h-3 w-3" />
                                    <span>
                                        Showing backups {dateFrom && `from ${new Date(dateFrom).toLocaleDateString()}`}
                                        {dateFrom && dateTo && ' '}
                                        {dateTo && `to ${new Date(dateTo).toLocaleDateString()}`}
                                        {!dateFrom && !dateTo && 'for all dates'}
                                    </span>
                                </div>
                            </div>
                        </InteractiveCard>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Loading state */}
            {fetchingBackups && backups.length === 0 && (
                <div className="flex flex-col items-center justify-center p-12">
                    <Loader2 className="h-8 w-8 animate-spin text-primary mb-2" />
                    <p className="text-sm text-muted-foreground">Loading backups...</p>
                </div>
            )}

            {/* Empty state */}
            {!fetchingBackups && backups.length === 0 && (
                <div className="flex flex-col items-center justify-center p-12 text-center">
                    <Database className="h-16 w-16 text-primary/40 mb-4" />
                    <h3 className="text-lg font-semibold mb-2">No Backups Found</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                        {hasFilters
                            ? 'No backups match the selected date range. Try adjusting your filters.'
                            : 'Create your first backup to get started'}
                    </p>
                    {hasFilters ? (
                        <Button variant="outline" onClick={handleClearFilters}>
                            Clear Filters
                        </Button>
                    ) : (
                        <Button onClick={() => navigate('/backup/new')}>
                            Create Backup
                        </Button>
                    )}
                </div>
            )}

            {/* Backup list */}
            {backups.length > 0 && (
                <div className="space-y-3">
                    {backups.map((backup) => (
                        <InteractiveCard key={backup.id} className="p-4">
                            <div className="space-y-3">
                                {/* Backup header */}
                                <div className="flex items-start justify-between gap-4">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                            {backup.status === 'completed' ? (
                                                <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
                                            ) : (
                                                <XCircle className="h-4 w-4 text-red-500 flex-shrink-0" />
                                            )}
                                            <h3 className="font-semibold truncate">
                                                {backup.name || backup.id}
                                            </h3>
                                            {backup.encrypted ? (
                                                <Shield className="h-4 w-4 text-primary flex-shrink-0" />
                                            ) : (
                                                <ShieldOff className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                                            )}
                                        </div>

                                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs text-muted-foreground">
                                            <div>
                                                <span className="font-medium">Date:</span> {formatDate(backup.createdAt)}
                                            </div>
                                            <div>
                                                <span className="font-medium">Size:</span> {formatBytes(backup.totalCompressedSize)}
                                            </div>
                                            <div>
                                                <span className="font-medium">Items:</span> {backup.itemCount}
                                            </div>
                                            <div>
                                                <span className={`font-medium px-2 py-0.5 rounded ${
                                                    backup.status === 'completed'
                                                        ? 'bg-green-500/20 text-green-500'
                                                        : 'bg-red-500/20 text-red-500'
                                                }`}>
                                                    {backup.status === 'completed' ? 'Complete' : 'Failed'}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Actions */}
                                    <div className="flex items-center gap-1 flex-shrink-0">
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => handleRestore(backup)}
                                            title="Restore this backup"
                                        >
                                            <RotateCcw className="h-4 w-4" />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => handleDownload(backup)}
                                            title="Download this backup"
                                        >
                                            <Download className="h-4 w-4" />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => handleDelete(backup)}
                                            disabled={deletingBackup}
                                            title="Delete this backup"
                                        >
                                            {deletingBackup ? (
                                                <Loader2 className="h-4 w-4 animate-spin" />
                                            ) : (
                                                <Trash2 className="h-4 w-4 text-destructive" />
                                            )}
                                        </Button>
                                    </div>
                                </div>

                                {/* Expandable contents summary */}
                                <div>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleToggleDetails(backup)}
                                        className="text-xs"
                                    >
                                        {expandedBackupId === backup.id ? 'Hide' : 'Show'} Contents
                                    </Button>

                                    <AnimatePresence>
                                        {expandedBackupId === backup.id && (
                                            <motion.div
                                                initial={{ opacity: 0, height: 0 }}
                                                animate={{ opacity: 1, height: 'auto' }}
                                                exit={{ opacity: 0, height: 0 }}
                                                transition={{ duration: 0.2 }}
                                                className="mt-2"
                                            >
                                                {loadingPreview && !backupPreviews.has(backup.id) ? (
                                                    <div className="flex items-center gap-2 p-4 text-sm text-muted-foreground">
                                                        <Loader2 className="h-4 w-4 animate-spin" />
                                                        <span>Loading contents...</span>
                                                    </div>
                                                ) : backupPreviews.has(backup.id) ? (
                                                    <div className="border border-border rounded-md p-3 space-y-2">
                                                        <h4 className="text-xs font-semibold mb-2">Backup Contents:</h4>
                                                        <div className="grid grid-cols-1 gap-1 max-h-48 overflow-y-auto">
                                                            {backupPreviews.get(backup.id)!.items.map((item, idx) => (
                                                                <div key={idx} className="text-xs flex items-center gap-2 p-1">
                                                                    <Database className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                                                                    <span className="flex-1 truncate">{item.name}</span>
                                                                    {item.service && (
                                                                        <span className="px-2 py-0.5 bg-primary/10 text-primary text-xs rounded">
                                                                            {item.service}
                                                                        </span>
                                                                    )}
                                                                    <span className="text-muted-foreground">
                                                                        {formatBytes(item.size)}
                                                                    </span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="text-xs text-muted-foreground p-4">
                                                        Failed to load contents
                                                    </div>
                                                )}
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>
                            </div>
                        </InteractiveCard>
                    ))}
                </div>
            )}

            {/* Pagination */}
            {backups.length > 0 && totalPages > 1 && (
                <div className="flex items-center justify-between gap-4 flex-wrap">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <span>Showing {startIndex}-{endIndex} of {total}</span>
                        <span className="text-muted-foreground/50">|</span>
                        <select
                            value={pageSize}
                            onChange={(e) => handlePageSizeChange(Number(e.target.value))}
                            className="px-2 py-1 bg-background border border-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                        >
                            {PAGE_SIZE_OPTIONS.map((size) => (
                                <option key={size} value={size}>
                                    {size} per page
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="flex items-center gap-1">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handlePageChange(currentPage - 1)}
                            disabled={currentPage === 1}
                        >
                            <ChevronLeft className="h-4 w-4" />
                        </Button>

                        <div className="flex items-center gap-1">
                            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                                // Show first, last, current, and surrounding pages
                                let pageNum: number
                                if (totalPages <= 5) {
                                    pageNum = i + 1
                                } else if (currentPage <= 3) {
                                    pageNum = i + 1
                                } else if (currentPage >= totalPages - 2) {
                                    pageNum = totalPages - 4 + i
                                } else {
                                    pageNum = currentPage - 2 + i
                                }

                                return (
                                    <Button
                                        key={pageNum}
                                        variant={currentPage === pageNum ? 'default' : 'outline'}
                                        size="sm"
                                        onClick={() => handlePageChange(pageNum)}
                                        className="min-w-[2.5rem]"
                                    >
                                        {pageNum}
                                    </Button>
                                )
                            })}
                        </div>

                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handlePageChange(currentPage + 1)}
                            disabled={currentPage === totalPages}
                        >
                            <ChevronRight className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            )}
        </div>
    )
}
