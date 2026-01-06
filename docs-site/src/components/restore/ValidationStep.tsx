import { useState, useEffect } from 'react'
import { motion } from 'motion/react'
import {
    Shield,
    CheckCircle2,
    XCircle,
    Loader2,
    AlertTriangle,
    Lock,
    Eye,
    EyeOff,
    Database,
    FileCode,
    HardDrive,
    Clapperboard,
} from 'lucide-react'
import { useBackupStore } from '../../store/backupStore'
import { useRestorePreview, type BackupPreview } from '../../hooks/useBackup'
import { InteractiveCard } from '../ui/interactive-card'
import { FocusRing } from '../ui/focus-ring'
import { Button } from '../ui/button'
import { toast } from 'sonner'

// Utility function to format bytes to human-readable sizes
function formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`
}

// Get icon for item type
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
            return Database
    }
}

export function ValidationStep() {
    const {
        destination,
        selectedBackupForRestore,
        restoreValidationResult,
        restoreDecryptionPassword,
        setRestoreValidationResult,
        setRestoreDecryptionPassword,
        setRestorePreviewData,
    } = useBackupStore()

    const { previewBackup, loading: validating } = useRestorePreview()
    const [password, setPassword] = useState(restoreDecryptionPassword || '')
    const [showPassword, setShowPassword] = useState(false)
    const [validationAttempted, setValidationAttempted] = useState(false)
    const [validationError, setValidationError] = useState<string | null>(null)
    const [preview, setPreview] = useState<BackupPreview | null>(null)

    // Auto-validate if backup is not encrypted and validation hasn't been attempted
    useEffect(() => {
        const autoValidate = async () => {
            if (
                selectedBackupForRestore &&
                !selectedBackupForRestore.encrypted &&
                !validationAttempted &&
                destination
            ) {
                await handleValidate()
            }
        }

        autoValidate()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedBackupForRestore, destination])

    const handleValidate = async () => {
        if (!selectedBackupForRestore || !destination) {
            toast.error('No backup or destination configured')
            return
        }

        // Check if backup is encrypted and password is required
        if (selectedBackupForRestore.encrypted && !password) {
            toast.error('This backup is encrypted. Please enter the decryption password.')
            return
        }

        setValidationAttempted(true)
        setValidationError(null)

        try {
            const result = await previewBackup({
                backupId: selectedBackupForRestore.id,
                destination,
                decryptionPassword: selectedBackupForRestore.encrypted ? password : undefined,
            })

            // Validation successful
            setPreview(result)
            setRestoreValidationResult(true)
            setRestoreDecryptionPassword(selectedBackupForRestore.encrypted ? password : '')
            setRestorePreviewData(result) // Store preview data in global store
            toast.success('Backup validated successfully! All checksums verified.')
        } catch (error) {
            // Validation failed
            const errorMsg = error instanceof Error ? error.message : 'Validation failed'
            setValidationError(errorMsg)
            setRestoreValidationResult(false)
            setRestoreDecryptionPassword('')
            setRestorePreviewData(null) // Clear preview data on failure
            toast.error(`Validation failed: ${errorMsg}`)
        }
    }

    const handlePasswordChange = (newPassword: string) => {
        setPassword(newPassword)
        // Reset validation state when password changes
        if (validationAttempted && restoreValidationResult !== null) {
            setRestoreValidationResult(null)
            setValidationAttempted(false)
            setValidationError(null)
            setPreview(null)
        }
    }

    if (!selectedBackupForRestore || !destination) {
        return (
            <motion.div
                key="no-backup-selected"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="text-center py-12"
            >
                <AlertTriangle className="w-16 h-16 text-amber-400 mx-auto mb-4" />
                <h2 className="text-2xl font-bold text-foreground mb-2">No Backup Selected</h2>
                <p className="text-muted-foreground">
                    Please go back and select a backup to validate
                </p>
            </motion.div>
        )
    }

    return (
        <motion.div
            key="validation"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-6"
        >
            <div className="mb-6">
                <h2 className="text-2xl font-bold text-foreground mb-2">Validate Backup Integrity</h2>
                <p className="text-muted-foreground">
                    Verify checksums and decrypt backup to ensure it can be restored safely
                </p>
            </div>

            {/* Backup Info Banner */}
            <div className="p-4 bg-primary/10 border border-primary/30 rounded-xl">
                <div className="flex items-start gap-3">
                    <Shield className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-foreground mb-1">
                            Selected Backup: {selectedBackupForRestore.name}
                        </p>
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                            <span>ID: {selectedBackupForRestore.id}</span>
                            <span>•</span>
                            <span>Created: {new Date(selectedBackupForRestore.createdAt).toLocaleString()}</span>
                            <span>•</span>
                            <span>Size: {formatBytes(selectedBackupForRestore.compressedSize)}</span>
                            <span>•</span>
                            <span className={selectedBackupForRestore.encrypted ? 'text-green-400' : 'text-muted-foreground'}>
                                {selectedBackupForRestore.encrypted ? '🔒 Encrypted' : '🔓 Not Encrypted'}
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Password Input (for encrypted backups) */}
            {selectedBackupForRestore.encrypted && (
                <InteractiveCard>
                    <div className="space-y-3">
                        <div className="flex items-center gap-2 mb-2">
                            <Lock className="w-5 h-5 text-amber-400" />
                            <h3 className="text-lg font-semibold text-foreground">Decryption Password</h3>
                        </div>
                        <p className="text-sm text-muted-foreground mb-3">
                            This backup is encrypted. Enter the password used during backup creation.
                        </p>
                        <FocusRing>
                            <div className="relative">
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    value={password}
                                    onChange={(e) => handlePasswordChange(e.target.value)}
                                    className="w-full bg-background/60 border border-border rounded-lg py-2.5 px-4 pr-12 text-foreground placeholder:text-muted-foreground input-focus-glow transition-all backdrop-blur-sm"
                                    placeholder="Enter decryption password"
                                    autoComplete="off"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                                >
                                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                </button>
                            </div>
                        </FocusRing>
                        {selectedBackupForRestore.encrypted && !password && (
                            <p className="text-xs text-amber-400 flex items-center gap-1.5">
                                <AlertTriangle className="w-3.5 h-3.5" />
                                Password is required to validate encrypted backups
                            </p>
                        )}
                    </div>
                </InteractiveCard>
            )}

            {/* Validate Button */}
            {(!validationAttempted || restoreValidationResult === false) && (
                <div className="flex justify-center">
                    <Button
                        type="button"
                        onClick={handleValidate}
                        disabled={validating || (selectedBackupForRestore.encrypted && !password)}
                        className="btn-lift px-8"
                    >
                        {validating ? (
                            <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Validating Backup...
                            </>
                        ) : (
                            <>
                                <Shield className="w-4 h-4" />
                                {validationAttempted ? 'Retry Validation' : 'Validate Backup'}
                            </>
                        )}
                    </Button>
                </div>
            )}

            {/* Validation In Progress */}
            {validating && (
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-6 bg-primary/10 border border-primary/30 rounded-xl"
                >
                    <div className="flex items-center gap-4">
                        <Loader2 className="w-8 h-8 text-primary animate-spin flex-shrink-0" />
                        <div className="flex-1">
                            <h3 className="text-lg font-semibold text-foreground mb-1">
                                Validating Backup...
                            </h3>
                            <p className="text-sm text-muted-foreground">
                                Downloading manifest, verifying checksums
                                {selectedBackupForRestore.encrypted && ', and decrypting backup'}...
                            </p>
                        </div>
                    </div>
                </motion.div>
            )}

            {/* Validation Failed */}
            {restoreValidationResult === false && validationError && (
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-5 bg-red-500/10 border-2 border-red-500/40 rounded-xl"
                >
                    <div className="flex gap-3">
                        <XCircle className="w-6 h-6 text-red-400 flex-shrink-0 mt-0.5" />
                        <div className="flex-1">
                            <h3 className="text-lg font-semibold text-red-300 mb-2">
                                Validation Failed
                            </h3>
                            <div className="space-y-2 text-sm text-red-200/90">
                                <p>
                                    The backup could not be validated. This could be due to:
                                </p>
                                <ul className="list-disc list-inside space-y-1 ml-2">
                                    <li>Incorrect decryption password (for encrypted backups)</li>
                                    <li>Corrupted backup files or checksums</li>
                                    <li>Missing or incomplete backup data</li>
                                    <li>Network issues during download</li>
                                </ul>
                                <div className="pt-2 border-t border-red-500/30">
                                    <p className="font-medium text-red-100">Error Details:</p>
                                    <p className="font-mono text-xs text-red-200 mt-1 bg-red-900/20 p-2 rounded">
                                        {validationError}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </motion.div>
            )}

            {/* Validation Successful */}
            {restoreValidationResult === true && preview && (
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-4"
                >
                    {/* Success Banner */}
                    <div className="p-5 bg-green-500/10 border-2 border-green-500/40 rounded-xl">
                        <div className="flex gap-3">
                            <CheckCircle2 className="w-6 h-6 text-green-400 flex-shrink-0 mt-0.5" />
                            <div className="flex-1">
                                <h3 className="text-lg font-semibold text-green-300 mb-2">
                                    ✅ Backup Validated Successfully
                                </h3>
                                <div className="space-y-1 text-sm text-green-200/90">
                                    <p>
                                        All checksums verified successfully.
                                        {selectedBackupForRestore.encrypted && ' Backup decrypted successfully.'}
                                    </p>
                                    <p>
                                        This backup contains <strong>{preview.items.length} items</strong> with a total size of <strong>{formatBytes(preview.totalSize)}</strong>.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Backup Contents */}
                    <InteractiveCard>
                        <div className="space-y-4">
                            <div className="flex items-center gap-2 mb-2">
                                <Database className="w-5 h-5 text-primary" />
                                <h3 className="text-lg font-semibold text-foreground">Backup Contents</h3>
                            </div>
                            <p className="text-sm text-muted-foreground mb-4">
                                The following components were found and validated in this backup:
                            </p>

                            {/* Items List */}
                            <div className="space-y-2 max-h-96 overflow-y-auto">
                                {preview.items.map((item, index) => {
                                    const TypeIcon = getTypeIcon(item.type)
                                    return (
                                        <div
                                            key={index}
                                            className="flex items-start gap-3 p-3 bg-background/40 border border-border/60 rounded-lg"
                                        >
                                            <CheckCircle2 className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" />
                                            <TypeIcon className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <h4 className="text-sm font-medium text-foreground">
                                                        {item.name}
                                                    </h4>
                                                    {item.service && (
                                                        <span className="px-2 py-0.5 rounded-full bg-primary/20 border border-primary/30 text-xs text-primary">
                                                            {item.service}
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                                    <span className="capitalize">{item.type}</span>
                                                    <span>•</span>
                                                    <span className="truncate">{item.path}</span>
                                                    <span>•</span>
                                                    <span>{formatBytes(item.size)}</span>
                                                </div>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>

                            {/* Summary Stats */}
                            <div className="pt-4 border-t border-border/60">
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-center">
                                    <div className="p-3 bg-background/40 rounded-lg">
                                        <p className="text-2xl font-bold text-foreground">{preview.items.length}</p>
                                        <p className="text-xs text-muted-foreground">Items</p>
                                    </div>
                                    <div className="p-3 bg-background/40 rounded-lg">
                                        <p className="text-2xl font-bold text-foreground">{formatBytes(preview.totalSize)}</p>
                                        <p className="text-xs text-muted-foreground">Total Size</p>
                                    </div>
                                    <div className="p-3 bg-background/40 rounded-lg">
                                        <p className="text-2xl font-bold text-foreground">{formatBytes(preview.totalCompressedSize)}</p>
                                        <p className="text-xs text-muted-foreground">Compressed</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </InteractiveCard>

                    {/* Next Step Hint */}
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="p-4 bg-cyan-500/10 border border-cyan-500/30 rounded-xl"
                    >
                        <p className="text-sm text-cyan-400">
                            <span className="font-medium">✅ Ready to proceed:</span> Click "Next" to choose which items to restore, or restore all items.
                        </p>
                    </motion.div>
                </motion.div>
            )}

            {/* Info Banner (before validation) */}
            {!validationAttempted && !validating && (
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-4 bg-cyan-500/10 border border-cyan-500/30 rounded-xl"
                >
                    <div className="flex gap-3">
                        <Shield className="w-5 h-5 text-cyan-400 flex-shrink-0 mt-0.5" />
                        <div className="flex-1">
                            <h4 className="text-sm font-semibold text-cyan-300 mb-2">
                                About Backup Validation
                            </h4>
                            <ul className="space-y-1 text-xs text-cyan-200/90">
                                <li>• Checksums will be verified to ensure backup integrity</li>
                                {selectedBackupForRestore.encrypted && (
                                    <li>• The backup will be decrypted using your password</li>
                                )}
                                <li>• Backup contents will be analyzed and displayed</li>
                                <li>• You cannot proceed with restore if validation fails</li>
                                <li>• This process may take a few moments depending on backup size</li>
                            </ul>
                        </div>
                    </div>
                </motion.div>
            )}
        </motion.div>
    )
}
