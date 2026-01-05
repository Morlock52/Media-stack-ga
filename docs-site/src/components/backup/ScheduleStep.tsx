import { useState, useEffect } from 'react'
import { motion } from 'motion/react'
import { Clock, Calendar, Trash2, Info, CheckCircle2 } from 'lucide-react'
import { useBackupStore } from '../../store/backupStore'
import type { ScheduleFrequency, BackupSchedule } from '../../store/backupStore'
import { InteractiveCard } from '../ui/interactive-card'
import { FocusRing } from '../ui/focus-ring'
import { toast } from 'sonner'

// Helper function to generate a unique ID
function generateScheduleId(): string {
    return `schedule_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

// Helper function to calculate next run time
function calculateNextRun(frequency: ScheduleFrequency, time: string): string {
    const now = new Date()
    const [hours, minutes] = time.split(':').map(Number)

    const nextRun = new Date(now)
    nextRun.setHours(hours, minutes, 0, 0)

    // If the time has already passed today, move to next occurrence
    if (nextRun <= now) {
        if (frequency === 'daily') {
            nextRun.setDate(nextRun.getDate() + 1)
        } else if (frequency === 'weekly') {
            nextRun.setDate(nextRun.getDate() + 7)
        } else if (frequency === 'monthly') {
            nextRun.setMonth(nextRun.getMonth() + 1)
            nextRun.setDate(1) // First of next month
        }
    } else if (frequency === 'weekly') {
        // Set to next Sunday (0 = Sunday)
        const daysUntilSunday = (7 - nextRun.getDay()) % 7
        if (daysUntilSunday > 0 || nextRun <= now) {
            nextRun.setDate(nextRun.getDate() + (daysUntilSunday || 7))
        }
    } else if (frequency === 'monthly') {
        // Set to first of next month if time has passed
        if (nextRun <= now || nextRun.getDate() !== 1) {
            nextRun.setMonth(nextRun.getMonth() + 1)
            nextRun.setDate(1)
        }
    }

    return nextRun.toISOString()
}

// Helper function to format the next run display
function formatNextRun(nextRun: string | undefined): string {
    if (!nextRun) return 'Not scheduled'

    const date = new Date(nextRun)
    const now = new Date()
    const diffMs = date.getTime() - now.getTime()
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
    const diffDays = Math.floor(diffHours / 24)

    if (diffDays > 0) {
        return `in ${diffDays} day${diffDays === 1 ? '' : 's'}`
    } else if (diffHours > 0) {
        return `in ${diffHours} hour${diffHours === 1 ? '' : 's'}`
    } else {
        return 'soon'
    }
}

export function ScheduleStep() {
    const { schedule, setSchedule } = useBackupStore()

    // Local state for form inputs
    const [enabled, setEnabled] = useState(schedule?.enabled ?? false)
    const [frequency, setFrequency] = useState<ScheduleFrequency>(schedule?.frequency ?? 'weekly')
    const [time, setTime] = useState(schedule?.time ?? '02:00')
    const [retentionCount, setRetentionCount] = useState(schedule?.retentionCount ?? 7)

    // Update store when form values change
    useEffect(() => {
        if (enabled) {
            const scheduleConfig: BackupSchedule = {
                id: schedule?.id ?? generateScheduleId(),
                enabled: true,
                frequency,
                time,
                retentionCount,
                lastRun: schedule?.lastRun,
                nextRun: calculateNextRun(frequency, time),
            }
            setSchedule(scheduleConfig)
        } else {
            setSchedule(null)
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [enabled, frequency, time, retentionCount])

    const handleToggleSchedule = () => {
        const newEnabled = !enabled
        setEnabled(newEnabled)

        if (!newEnabled) {
            toast.info('Scheduled backups disabled')
        } else {
            toast.success('Scheduled backups enabled')
        }
    }

    const handleRetentionChange = (value: string) => {
        const num = parseInt(value, 10)
        if (!isNaN(num) && num >= 1 && num <= 100) {
            setRetentionCount(num)
        }
    }

    return (
        <motion.div
            key="schedule"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-6"
        >
            <div className="mb-6">
                <h2 className="text-2xl font-bold text-foreground mb-2">Configure Backup Schedule</h2>
                <p className="text-muted-foreground">
                    Set up automated backups to run on a regular schedule with configurable retention policies.
                </p>
            </div>

            {/* Info Banner */}
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-5 bg-cyan-500/10 border-2 border-cyan-500/40 rounded-xl"
            >
                <div className="flex gap-3">
                    <Info className="w-6 h-6 text-cyan-400 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                        <h3 className="text-lg font-semibold text-cyan-300 mb-2">
                            About Scheduled Backups
                        </h3>
                        <div className="space-y-2 text-sm text-cyan-200/90">
                            <p>
                                Scheduled backups run automatically in the background and use the destination, items, and encryption settings configured in this wizard.
                            </p>
                            <p>
                                The retention policy automatically deletes old backups, keeping only the most recent backups based on your configured retention count.
                            </p>
                        </div>
                    </div>
                </div>
            </motion.div>

            {/* Schedule Toggle */}
            <InteractiveCard>
                <div className="flex items-center justify-between p-4">
                    <div className="flex items-center gap-3">
                        <Clock className={`w-6 h-6 ${enabled ? 'text-green-400' : 'text-muted-foreground'}`} />
                        <div>
                            <h3 className="text-lg font-semibold text-foreground">Enable Scheduled Backups</h3>
                            <p className="text-sm text-muted-foreground">
                                Automatically backup on a recurring schedule
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={handleToggleSchedule}
                        className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors ${
                            enabled ? 'bg-green-500/80' : 'bg-muted/60'
                        }`}
                        aria-label="Toggle scheduled backups"
                    >
                        <motion.span
                            className={`inline-block h-6 w-6 transform rounded-full bg-white shadow-lg transition-transform ${
                                enabled ? 'translate-x-7' : 'translate-x-1'
                            }`}
                            layout
                        />
                    </button>
                </div>
            </InteractiveCard>

            {/* Schedule Configuration (shown when enabled) */}
            {enabled && (
                <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="space-y-4"
                >
                    {/* Frequency Selector */}
                    <InteractiveCard>
                        <label className="block text-sm font-medium text-foreground mb-3 flex items-center gap-2">
                            <Calendar className="w-4 h-4" />
                            Backup Frequency <span className="text-destructive">*</span>
                        </label>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            {(['daily', 'weekly', 'monthly'] as const).map((freq) => (
                                <FocusRing key={freq}>
                                    <button
                                        type="button"
                                        onClick={() => setFrequency(freq)}
                                        className={`relative p-4 rounded-lg border-2 transition-all text-left ${
                                            frequency === freq
                                                ? 'border-primary bg-primary/10 text-primary'
                                                : 'border-border bg-background/60 text-foreground hover:border-primary/50 hover:bg-primary/5'
                                        }`}
                                    >
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <div className="font-semibold capitalize mb-1">{freq}</div>
                                                <div className="text-xs text-muted-foreground">
                                                    {freq === 'daily' && 'Every day at set time'}
                                                    {freq === 'weekly' && 'Every Sunday at set time'}
                                                    {freq === 'monthly' && '1st of each month at set time'}
                                                </div>
                                            </div>
                                            {frequency === freq && (
                                                <CheckCircle2 className="w-5 h-5 text-primary" />
                                            )}
                                        </div>
                                    </button>
                                </FocusRing>
                            ))}
                        </div>
                        <p className="mt-3 text-xs text-muted-foreground">
                            Selected: <strong className="text-foreground capitalize">{frequency}</strong> backups
                        </p>
                    </InteractiveCard>

                    {/* Time Picker */}
                    <InteractiveCard>
                        <label className="block text-sm font-medium text-foreground mb-2 flex items-center gap-2">
                            <Clock className="w-4 h-4" />
                            Backup Time <span className="text-destructive">*</span>
                        </label>
                        <FocusRing>
                            <input
                                type="time"
                                value={time}
                                onChange={(e) => setTime(e.target.value)}
                                className="w-full sm:w-64 bg-background/60 border border-border rounded-lg py-2.5 px-4 text-foreground placeholder:text-muted-foreground input-focus-glow transition-all backdrop-blur-sm"
                            />
                        </FocusRing>
                        <p className="mt-2 text-xs text-muted-foreground">
                            Backups will run at <strong className="text-foreground">{time}</strong> (local time).
                            {schedule?.nextRun && (
                                <span className="ml-1">
                                    Next backup: <strong className="text-primary">{formatNextRun(schedule.nextRun)}</strong>
                                </span>
                            )}
                        </p>
                    </InteractiveCard>

                    {/* Retention Policy */}
                    <InteractiveCard>
                        <label className="block text-sm font-medium text-foreground mb-2 flex items-center gap-2">
                            <Trash2 className="w-4 h-4" />
                            Retention Policy <span className="text-destructive">*</span>
                        </label>
                        <div className="flex items-center gap-4">
                            <FocusRing>
                                <input
                                    type="number"
                                    min="1"
                                    max="100"
                                    value={retentionCount}
                                    onChange={(e) => handleRetentionChange(e.target.value)}
                                    className="w-24 bg-background/60 border border-border rounded-lg py-2.5 px-4 text-foreground placeholder:text-muted-foreground input-focus-glow transition-all backdrop-blur-sm text-center font-semibold"
                                />
                            </FocusRing>
                            <span className="text-foreground">backups to keep</span>
                        </div>
                        <p className="mt-3 text-xs text-muted-foreground">
                            The system will automatically delete older backups when the retention count is exceeded.
                            For example, if you keep <strong className="text-foreground">{retentionCount}</strong> backups and create a new one, the oldest backup will be deleted.
                        </p>

                        {/* Retention Examples */}
                        <div className="mt-4 p-3 bg-muted/20 border border-border/60 rounded-lg">
                            <h4 className="text-xs font-semibold text-foreground mb-2">💡 Recommended Settings</h4>
                            <ul className="space-y-1 text-xs text-muted-foreground">
                                <li className="flex items-start gap-2">
                                    <span className="text-primary">•</span>
                                    <span><strong>Daily backups:</strong> Keep 7-14 backups (1-2 weeks)</span>
                                </li>
                                <li className="flex items-start gap-2">
                                    <span className="text-primary">•</span>
                                    <span><strong>Weekly backups:</strong> Keep 4-12 backups (1-3 months)</span>
                                </li>
                                <li className="flex items-start gap-2">
                                    <span className="text-primary">•</span>
                                    <span><strong>Monthly backups:</strong> Keep 6-12 backups (6-12 months)</span>
                                </li>
                            </ul>
                        </div>
                    </InteractiveCard>

                    {/* Schedule Summary */}
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="p-5 bg-green-500/10 border-2 border-green-500/40 rounded-xl"
                    >
                        <div className="flex gap-3">
                            <CheckCircle2 className="w-6 h-6 text-green-400 flex-shrink-0 mt-0.5" />
                            <div className="flex-1">
                                <h3 className="text-lg font-semibold text-green-300 mb-2">
                                    Schedule Summary
                                </h3>
                                <div className="space-y-1 text-sm text-green-200/90">
                                    <p>
                                        <strong>Frequency:</strong> {frequency.charAt(0).toUpperCase() + frequency.slice(1)} at {time}
                                    </p>
                                    <p>
                                        <strong>Retention:</strong> Keep {retentionCount} most recent backup{retentionCount !== 1 ? 's' : ''}
                                    </p>
                                    {schedule?.nextRun && (
                                        <p>
                                            <strong>Next backup:</strong> {formatNextRun(schedule.nextRun)}
                                        </p>
                                    )}
                                </div>
                            </div>
                        </div>
                    </motion.div>
                </motion.div>
            )}

            {/* Summary when scheduling is disabled */}
            {!enabled && (
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-6 bg-muted/20 border border-border/60 rounded-xl text-center"
                >
                    <Clock className="w-12 h-12 mx-auto mb-3 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground mb-2">
                        Scheduled backups are disabled. You can still create manual backups.
                    </p>
                    <p className="text-xs text-muted-foreground">
                        Enable scheduling to automatically backup your media stack on a regular basis.
                    </p>
                </motion.div>
            )}
        </motion.div>
    )
}
