/**
 * ScheduleManager Component
 * Manage backup schedules: view active schedules, edit schedule settings,
 * enable/disable schedules, view schedule history
 */

import { useEffect, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
    Clock,
    Calendar,
    Play,
    Pause,
    Edit2,
    Trash2,
    CheckCircle,
    XCircle,
    AlertCircle,
    Loader2,
    RefreshCw,
    Save,
    X,
    Database,
    Shield,
    ShieldOff,
    AlertTriangle,
} from 'lucide-react'
import { useBackupStore, type BackupSchedule } from '../../store/backupStore'
import {
    useScheduleList,
    useScheduleUpdate,
    useScheduleDelete,
    useScheduleTrigger,
    type ScheduleHealth,
} from '../../hooks/useBackup'
import { Button } from '../ui/button'
import { InteractiveCard } from '../ui/interactive-card'
import { FocusRing } from '../ui/focus-ring'
import { toast } from 'sonner'

// Utility function to format next run time
function formatNextRun(nextRunString: string | undefined): string {
    if (!nextRunString) return 'Not scheduled'

    const nextRun = new Date(nextRunString)
    const now = new Date()
    const diffMs = nextRun.getTime() - now.getTime()

    if (diffMs <= 0) return 'Pending'

    const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
    const diffDays = Math.floor(diffHours / 24)

    if (diffDays > 0) {
        return `in ${diffDays} day${diffDays > 1 ? 's' : ''}`
    } else if (diffHours > 0) {
        return `in ${diffHours} hour${diffHours > 1 ? 's' : ''}`
    } else {
        const diffMinutes = Math.floor(diffMs / (1000 * 60))
        return `in ${diffMinutes} minute${diffMinutes > 1 ? 's' : ''}`
    }
}

// Utility function to format last run time
function formatLastRun(lastRunString: string | undefined): string {
    if (!lastRunString) return 'Never run'

    const lastRun = new Date(lastRunString)
    const now = new Date()
    const diffMs = now.getTime() - lastRun.getTime()
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

    if (diffDays === 0) {
        const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
        if (diffHours === 0) {
            const diffMinutes = Math.floor(diffMs / (1000 * 60))
            return `${diffMinutes} minute${diffMinutes !== 1 ? 's' : ''} ago`
        }
        return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`
    } else if (diffDays === 1) {
        return 'Yesterday'
    } else {
        return `${diffDays} days ago`
    }
}

// Utility function to get frequency display name
function getFrequencyName(frequency: string): string {
    switch (frequency) {
        case 'daily':
            return 'Daily'
        case 'weekly':
            return 'Weekly (Sunday)'
        case 'monthly':
            return 'Monthly (1st)'
        default:
            return frequency
    }
}

export function ScheduleManager() {
    const destination = useBackupStore((state) => state.destination)
    const setSchedule = useBackupStore((state) => state.setSchedule)

    const { getSchedules, loading: loadingSchedules } = useScheduleList()
    const { updateSchedule, loading: updatingSchedule } = useScheduleUpdate()
    const { deleteSchedule, loading: deletingSchedule } = useScheduleDelete()
    const { triggerSchedule, loading: triggeringSchedule } = useScheduleTrigger()

    const [schedules, setSchedules] = useState<BackupSchedule[]>([])
    const [scheduleHealth, setScheduleHealth] = useState<Record<string, ScheduleHealth>>({})
    const [editingScheduleId, setEditingScheduleId] = useState<string | null>(null)
    const [editFormData, setEditFormData] = useState<Partial<BackupSchedule>>({})
    const [deletingScheduleId, setDeletingScheduleId] = useState<string | null>(null)

    // Fetch schedules list
    const fetchSchedules = useCallback(async () => {
        try {
            const result = await getSchedules()
            setSchedules(result.schedules)
            setScheduleHealth(result.health)
        } catch (error) {
            toast.error('Failed to load schedules')
        }
    }, [getSchedules])

    useEffect(() => {
        fetchSchedules()
    }, [fetchSchedules])

    // Handle enable/disable toggle
    const handleToggleEnabled = async (schedule: BackupSchedule) => {
        try {
            const updated = await updateSchedule(schedule.id, {
                enabled: !schedule.enabled,
            })
            setSchedules((prev) =>
                prev.map((s) => (s.id === schedule.id ? updated : s))
            )
            toast.success(
                updated.enabled
                    ? 'Schedule enabled successfully'
                    : 'Schedule disabled successfully'
            )

            // Update global store if this is the active schedule
            if (schedules.length === 1) {
                setSchedule(updated)
            }
        } catch (error) {
            toast.error('Failed to update schedule')
        }
    }

    // Handle edit start
    const handleEditStart = (schedule: BackupSchedule) => {
        setEditingScheduleId(schedule.id)
        setEditFormData({
            frequency: schedule.frequency,
            time: schedule.time,
            retentionCount: schedule.retentionCount,
        })
    }

    // Handle edit save
    const handleEditSave = async () => {
        if (!editingScheduleId) return

        try {
            const updated = await updateSchedule(editingScheduleId, editFormData)
            setSchedules((prev) =>
                prev.map((s) => (s.id === editingScheduleId ? updated : s))
            )
            setEditingScheduleId(null)
            setEditFormData({})
            toast.success('Schedule updated successfully')

            // Update global store if this is the active schedule
            if (schedules.length === 1) {
                setSchedule(updated)
            }
        } catch (error) {
            toast.error('Failed to update schedule')
        }
    }

    // Handle edit cancel
    const handleEditCancel = () => {
        setEditingScheduleId(null)
        setEditFormData({})
    }

    // Handle delete with confirmation
    const handleDelete = async (scheduleId: string) => {
        setDeletingScheduleId(scheduleId)
    }

    // Confirm delete
    const confirmDelete = async () => {
        if (!deletingScheduleId) return

        try {
            await deleteSchedule(deletingScheduleId)
            setSchedules((prev) => prev.filter((s) => s.id !== deletingScheduleId))
            setDeletingScheduleId(null)
            toast.success('Schedule deleted successfully')

            // Clear global store if this was the only schedule
            if (schedules.length === 1) {
                setSchedule(null)
            }
        } catch (error) {
            toast.error('Failed to delete schedule')
        }
    }

    // Handle manual trigger
    const handleTrigger = async (scheduleId: string) => {
        try {
            await triggerSchedule(scheduleId)
            toast.success('Backup triggered successfully')
        } catch (error) {
            toast.error('Failed to trigger backup')
        }
    }

    // Get health status for a schedule
    const getHealthStatus = (scheduleId: string) => {
        const health = scheduleHealth[scheduleId]
        if (!health) {
            return { status: 'unknown', message: 'No health data' }
        }

        if (health.consecutiveFailures >= 3) {
            return {
                status: 'error',
                message: `${health.consecutiveFailures} consecutive failures`,
            }
        } else if (health.consecutiveFailures > 0) {
            return {
                status: 'warning',
                message: `${health.consecutiveFailures} recent failure${health.consecutiveFailures > 1 ? 's' : ''}`,
            }
        } else if (health.lastSuccess) {
            return { status: 'success', message: 'Healthy' }
        } else {
            return { status: 'unknown', message: 'Not yet run' }
        }
    }

    // No destination configured
    if (!destination) {
        return (
            <InteractiveCard className="p-12 text-center">
                <Database className="w-16 h-16 mx-auto mb-4 text-muted-foreground/50" />
                <h3 className="text-xl font-semibold mb-2">No Backup Destination Configured</h3>
                <p className="text-muted-foreground mb-6">
                    Configure a backup destination first to manage schedules.
                </p>
                <Button onClick={() => window.location.href = '/backup/new'}>
                    Configure Backup Destination
                </Button>
            </InteractiveCard>
        )
    }

    // Loading state
    if (loadingSchedules && schedules.length === 0) {
        return (
            <InteractiveCard className="p-12 text-center">
                <Loader2 className="w-12 h-12 mx-auto mb-4 animate-spin text-primary" />
                <p className="text-muted-foreground">Loading schedules...</p>
            </InteractiveCard>
        )
    }

    // Empty state
    if (schedules.length === 0) {
        return (
            <InteractiveCard className="p-12 text-center">
                <Clock className="w-16 h-16 mx-auto mb-4 text-muted-foreground/50" />
                <h3 className="text-xl font-semibold mb-2">No Backup Schedules</h3>
                <p className="text-muted-foreground mb-6">
                    Create a backup schedule to automatically backup your data on a regular basis.
                </p>
                <Button onClick={() => window.location.href = '/backup/new'}>
                    Create Schedule
                </Button>
            </InteractiveCard>
        )
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold">Backup Schedules</h2>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={fetchSchedules}
                    disabled={loadingSchedules}
                >
                    <RefreshCw className={`w-4 h-4 mr-2 ${loadingSchedules ? 'animate-spin' : ''}`} />
                    Refresh
                </Button>
            </div>

            {/* Schedule list */}
            <div className="space-y-4">
                {schedules.map((schedule) => {
                    const health = getHealthStatus(schedule.id)
                    const isEditing = editingScheduleId === schedule.id
                    const isDeleting = deletingScheduleId === schedule.id

                    return (
                        <InteractiveCard
                            key={schedule.id}
                            className={`p-6 ${
                                !schedule.enabled ? 'opacity-60' : ''
                            }`}
                        >
                            <AnimatePresence mode="wait">
                                {isDeleting ? (
                                    <motion.div
                                        key="delete-confirm"
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        exit={{ opacity: 0 }}
                                        className="space-y-4"
                                    >
                                        <div className="flex items-start gap-3 p-4 bg-destructive/10 border border-destructive/30 rounded-lg">
                                            <AlertTriangle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
                                            <div className="flex-1">
                                                <h4 className="font-semibold text-destructive mb-1">
                                                    Delete Schedule
                                                </h4>
                                                <p className="text-sm text-muted-foreground mb-2">
                                                    Are you sure you want to delete this schedule?
                                                </p>
                                                <div className="text-sm space-y-1">
                                                    <p>
                                                        <span className="font-medium">Frequency:</span>{' '}
                                                        {getFrequencyName(schedule.frequency)} at {schedule.time}
                                                    </p>
                                                    <p>
                                                        <span className="font-medium">Retention:</span>{' '}
                                                        Keep {schedule.retentionCount} backup{schedule.retentionCount > 1 ? 's' : ''}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex gap-2 justify-end">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => setDeletingScheduleId(null)}
                                            >
                                                Cancel
                                            </Button>
                                            <Button
                                                variant="destructive"
                                                size="sm"
                                                onClick={confirmDelete}
                                                disabled={deletingSchedule}
                                            >
                                                {deletingSchedule && (
                                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                                )}
                                                Delete Schedule
                                            </Button>
                                        </div>
                                    </motion.div>
                                ) : isEditing ? (
                                    <motion.div
                                        key="edit-form"
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        exit={{ opacity: 0 }}
                                        className="space-y-4"
                                    >
                                        <h4 className="font-semibold text-lg mb-4">Edit Schedule</h4>

                                        {/* Frequency selector */}
                                        <div>
                                            <label className="block text-sm font-medium mb-2">
                                                Frequency
                                            </label>
                                            <FocusRing>
                                                <select
                                                    className="w-full p-2 bg-background border border-input rounded-lg focus:outline-none"
                                                    value={editFormData.frequency}
                                                    onChange={(e) =>
                                                        setEditFormData((prev) => ({
                                                            ...prev,
                                                            frequency: e.target.value as any,
                                                        }))
                                                    }
                                                >
                                                    <option value="daily">Daily</option>
                                                    <option value="weekly">Weekly (Sunday)</option>
                                                    <option value="monthly">Monthly (1st)</option>
                                                </select>
                                            </FocusRing>
                                        </div>

                                        {/* Time picker */}
                                        <div>
                                            <label className="block text-sm font-medium mb-2">
                                                Time
                                            </label>
                                            <FocusRing>
                                                <input
                                                    type="time"
                                                    className="w-full p-2 bg-background border border-input rounded-lg focus:outline-none"
                                                    value={editFormData.time}
                                                    onChange={(e) =>
                                                        setEditFormData((prev) => ({
                                                            ...prev,
                                                            time: e.target.value,
                                                        }))
                                                    }
                                                />
                                            </FocusRing>
                                        </div>

                                        {/* Retention count */}
                                        <div>
                                            <label className="block text-sm font-medium mb-2">
                                                Retention Count
                                            </label>
                                            <FocusRing>
                                                <input
                                                    type="number"
                                                    min="1"
                                                    max="100"
                                                    className="w-full p-2 bg-background border border-input rounded-lg focus:outline-none"
                                                    value={editFormData.retentionCount}
                                                    onChange={(e) =>
                                                        setEditFormData((prev) => ({
                                                            ...prev,
                                                            retentionCount: parseInt(e.target.value),
                                                        }))
                                                    }
                                                />
                                            </FocusRing>
                                            <p className="text-xs text-muted-foreground mt-1">
                                                Keep {editFormData.retentionCount} most recent backup
                                                {editFormData.retentionCount !== 1 ? 's' : ''}
                                            </p>
                                        </div>

                                        <div className="flex gap-2 justify-end pt-4 border-t">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={handleEditCancel}
                                            >
                                                <X className="w-4 h-4 mr-2" />
                                                Cancel
                                            </Button>
                                            <Button
                                                size="sm"
                                                onClick={handleEditSave}
                                                disabled={updatingSchedule}
                                            >
                                                {updatingSchedule && (
                                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                                )}
                                                <Save className="w-4 h-4 mr-2" />
                                                Save Changes
                                            </Button>
                                        </div>
                                    </motion.div>
                                ) : (
                                    <motion.div
                                        key="view"
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        exit={{ opacity: 0 }}
                                        className="space-y-4"
                                    >
                                        {/* Header with enable/disable toggle */}
                                        <div className="flex items-start justify-between">
                                            <div className="flex items-start gap-3">
                                                <div
                                                    className={`p-2 rounded-lg ${
                                                        schedule.enabled
                                                            ? 'bg-primary/10 text-primary'
                                                            : 'bg-muted text-muted-foreground'
                                                    }`}
                                                >
                                                    <Clock className="w-5 h-5" />
                                                </div>
                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <h3 className="font-semibold text-lg">
                                                            {getFrequencyName(schedule.frequency)} Backup
                                                        </h3>
                                                        {schedule.enabled ? (
                                                            <span className="text-xs px-2 py-0.5 bg-primary/10 text-primary rounded-full">
                                                                Enabled
                                                            </span>
                                                        ) : (
                                                            <span className="text-xs px-2 py-0.5 bg-muted text-muted-foreground rounded-full">
                                                                Disabled
                                                            </span>
                                                        )}
                                                    </div>
                                                    <p className="text-sm text-muted-foreground">
                                                        {schedule.time} • Keep {schedule.retentionCount} backup
                                                        {schedule.retentionCount > 1 ? 's' : ''}
                                                    </p>
                                                </div>
                                            </div>

                                            <div className="flex gap-2">
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => handleToggleEnabled(schedule)}
                                                    disabled={updatingSchedule}
                                                >
                                                    {schedule.enabled ? (
                                                        <>
                                                            <Pause className="w-4 h-4 mr-2" />
                                                            Disable
                                                        </>
                                                    ) : (
                                                        <>
                                                            <Play className="w-4 h-4 mr-2" />
                                                            Enable
                                                        </>
                                                    )}
                                                </Button>
                                            </div>
                                        </div>

                                        {/* Schedule details grid */}
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                            {/* Last run */}
                                            <InteractiveCard className="p-4">
                                                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                                                    <Calendar className="w-4 h-4" />
                                                    Last Run
                                                </div>
                                                <div className="font-semibold">
                                                    {formatLastRun(schedule.lastRun)}
                                                </div>
                                            </InteractiveCard>

                                            {/* Next run */}
                                            <InteractiveCard className="p-4">
                                                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                                                    <Calendar className="w-4 h-4" />
                                                    Next Run
                                                </div>
                                                <div className="font-semibold">
                                                    {schedule.enabled
                                                        ? formatNextRun(schedule.nextRun)
                                                        : 'Disabled'}
                                                </div>
                                            </InteractiveCard>

                                            {/* Health status */}
                                            <InteractiveCard className="p-4">
                                                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                                                    {health.status === 'success' && (
                                                        <CheckCircle className="w-4 h-4" />
                                                    )}
                                                    {health.status === 'warning' && (
                                                        <AlertCircle className="w-4 h-4" />
                                                    )}
                                                    {health.status === 'error' && (
                                                        <XCircle className="w-4 h-4" />
                                                    )}
                                                    {health.status === 'unknown' && (
                                                        <AlertCircle className="w-4 h-4" />
                                                    )}
                                                    Health Status
                                                </div>
                                                <div
                                                    className={`font-semibold ${
                                                        health.status === 'success'
                                                            ? 'text-green-500'
                                                            : health.status === 'warning'
                                                            ? 'text-amber-500'
                                                            : health.status === 'error'
                                                            ? 'text-destructive'
                                                            : 'text-muted-foreground'
                                                    }`}
                                                >
                                                    {health.message}
                                                </div>
                                            </InteractiveCard>
                                        </div>

                                        {/* Backup details */}
                                        <div className="flex flex-wrap gap-4 text-sm">
                                            <div className="flex items-center gap-2">
                                                <Database className="w-4 h-4 text-muted-foreground" />
                                                <span className="text-muted-foreground">Items:</span>
                                                <span className="font-medium">
                                                    {schedule.items?.length || 0}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                {schedule.encryption?.enabled ? (
                                                    <Shield className="w-4 h-4 text-primary" />
                                                ) : (
                                                    <ShieldOff className="w-4 h-4 text-muted-foreground" />
                                                )}
                                                <span className="text-muted-foreground">Encryption:</span>
                                                <span className="font-medium">
                                                    {schedule.encryption?.enabled ? 'Enabled' : 'Disabled'}
                                                </span>
                                            </div>
                                        </div>

                                        {/* Action buttons */}
                                        <div className="flex gap-2 pt-4 border-t">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => handleTrigger(schedule.id)}
                                                disabled={triggeringSchedule || !schedule.enabled}
                                            >
                                                {triggeringSchedule ? (
                                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                                ) : (
                                                    <Play className="w-4 h-4 mr-2" />
                                                )}
                                                Run Now
                                            </Button>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => handleEditStart(schedule)}
                                            >
                                                <Edit2 className="w-4 h-4 mr-2" />
                                                Edit
                                            </Button>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => handleDelete(schedule.id)}
                                                className="ml-auto text-destructive hover:text-destructive"
                                            >
                                                <Trash2 className="w-4 h-4 mr-2" />
                                                Delete
                                            </Button>
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </InteractiveCard>
                    )
                })}
            </div>
        </div>
    )
}
