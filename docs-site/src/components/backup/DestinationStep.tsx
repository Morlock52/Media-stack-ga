import { useState } from 'react'
import { motion } from 'motion/react'
import { HardDrive, Cloud, FolderSync, Check, Loader2, AlertCircle } from 'lucide-react'
import { useBackupStore, type BackupDestination } from '../../store/backupStore'
import { useTestConnection } from '../../hooks/useBackup'
import { Button } from '../ui/button'
import { InteractiveCard } from '../ui/interactive-card'
import { FocusRing } from '../ui/focus-ring'
import { toast } from 'sonner'

type DestinationType = 'local' | 's3' | 'rclone'

export function DestinationStep() {
    const { destination, setDestination } = useBackupStore()
    const { testConnection, loading: testing } = useTestConnection()
    const [activeTab, setActiveTab] = useState<DestinationType>(destination?.type || 'local')
    const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null)

    // Local destination state
    const [localPath, setLocalPath] = useState(
        destination?.type === 'local' ? destination.path : '/backups'
    )

    // S3 destination state
    const [s3Endpoint, setS3Endpoint] = useState(
        destination?.type === 's3' ? destination.endpoint : ''
    )
    const [s3Bucket, setS3Bucket] = useState(
        destination?.type === 's3' ? destination.bucket : ''
    )
    const [s3Region, setS3Region] = useState(
        destination?.type === 's3' ? destination.region || '' : 'us-east-1'
    )
    const [s3AccessKey, setS3AccessKey] = useState(
        destination?.type === 's3' ? destination.accessKeyId : ''
    )
    const [s3SecretKey, setS3SecretKey] = useState(
        destination?.type === 's3' ? destination.secretAccessKey : ''
    )
    const [s3PathPrefix, setS3PathPrefix] = useState(
        destination?.type === 's3' ? destination.pathPrefix || '' : 'backups/'
    )

    // Rclone destination state
    const [rcloneRemoteName, setRcloneRemoteName] = useState(
        destination?.type === 'rclone' ? destination.remoteName : ''
    )
    const [rcloneRemotePath, setRcloneRemotePath] = useState(
        destination?.type === 'rclone' ? destination.remotePath : ''
    )

    // Update destination when tab changes or fields change
    const updateDestination = () => {
        let newDestination: BackupDestination | null = null

        if (activeTab === 'local') {
            if (localPath) {
                newDestination = {
                    type: 'local',
                    path: localPath,
                }
            }
        } else if (activeTab === 's3') {
            if (s3Endpoint && s3Bucket && s3AccessKey && s3SecretKey) {
                newDestination = {
                    type: 's3',
                    endpoint: s3Endpoint,
                    bucket: s3Bucket,
                    region: s3Region || undefined,
                    accessKeyId: s3AccessKey,
                    secretAccessKey: s3SecretKey,
                    pathPrefix: s3PathPrefix || undefined,
                }
            }
        } else if (activeTab === 'rclone') {
            if (rcloneRemoteName && rcloneRemotePath) {
                newDestination = {
                    type: 'rclone',
                    remoteName: rcloneRemoteName,
                    remotePath: rcloneRemotePath,
                }
            }
        }

        setDestination(newDestination)
        setTestResult(null) // Clear test result when destination changes
    }

    const handleTestConnection = async () => {
        const currentDestination = getCurrentDestination()
        if (!currentDestination) {
            toast.error('Please fill in all required fields')
            return
        }

        try {
            const result = await testConnection(currentDestination)
            if (result.connected) {
                setTestResult({ success: true, message: result.message || 'Connection successful!' })
                toast.success('Connection successful!')
                updateDestination()
            } else {
                setTestResult({ success: false, message: result.message || 'Connection failed' })
                toast.error(result.message || 'Connection failed')
            }
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : 'Connection test failed'
            setTestResult({ success: false, message: errorMsg })
            toast.error(errorMsg)
        }
    }

    const getCurrentDestination = (): BackupDestination | null => {
        if (activeTab === 'local') {
            if (!localPath) return null
            return { type: 'local', path: localPath }
        } else if (activeTab === 's3') {
            if (!s3Endpoint || !s3Bucket || !s3AccessKey || !s3SecretKey) return null
            return {
                type: 's3',
                endpoint: s3Endpoint,
                bucket: s3Bucket,
                region: s3Region || undefined,
                accessKeyId: s3AccessKey,
                secretAccessKey: s3SecretKey,
                pathPrefix: s3PathPrefix || undefined,
            }
        } else if (activeTab === 'rclone') {
            if (!rcloneRemoteName || !rcloneRemotePath) return null
            return {
                type: 'rclone',
                remoteName: rcloneRemoteName,
                remotePath: rcloneRemotePath,
            }
        }
        return null
    }

    return (
        <motion.div
            key="destination"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-6"
        >
            <div className="mb-6">
                <h2 className="text-2xl font-bold text-foreground mb-2">Configure Backup Destination</h2>
                <p className="text-muted-foreground">
                    Choose where to store your backups - local directory, S3-compatible storage, or rclone remote
                </p>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 p-1 bg-background/60 rounded-lg border border-border/60">
                <button
                    type="button"
                    onClick={() => setActiveTab('local')}
                    className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-md transition-all ${
                        activeTab === 'local'
                            ? 'bg-primary/20 text-primary border border-primary/30'
                            : 'text-muted-foreground hover:text-foreground hover:bg-background/40'
                    }`}
                >
                    <HardDrive className="w-4 h-4" />
                    <span className="font-medium">Local</span>
                </button>
                <button
                    type="button"
                    onClick={() => setActiveTab('s3')}
                    className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-md transition-all ${
                        activeTab === 's3'
                            ? 'bg-primary/20 text-primary border border-primary/30'
                            : 'text-muted-foreground hover:text-foreground hover:bg-background/40'
                    }`}
                >
                    <Cloud className="w-4 h-4" />
                    <span className="font-medium">S3</span>
                </button>
                <button
                    type="button"
                    onClick={() => setActiveTab('rclone')}
                    className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-md transition-all ${
                        activeTab === 'rclone'
                            ? 'bg-primary/20 text-primary border border-primary/30'
                            : 'text-muted-foreground hover:text-foreground hover:bg-background/40'
                    }`}
                >
                    <FolderSync className="w-4 h-4" />
                    <span className="font-medium">Rclone</span>
                </button>
            </div>

            {/* Tab Content */}
            <div className="min-h-[300px]">
                {/* Local Tab */}
                {activeTab === 'local' && (
                    <motion.div
                        key="local"
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        className="space-y-4"
                    >
                        <InteractiveCard>
                            <label className="block text-sm font-medium text-foreground mb-2 flex items-center gap-2">
                                <HardDrive className="w-4 h-4" />
                                Backup Path <span className="text-destructive">*</span>
                            </label>
                            <FocusRing>
                                <input
                                    type="text"
                                    value={localPath}
                                    onChange={(e) => setLocalPath(e.target.value)}
                                    onBlur={updateDestination}
                                    className="w-full bg-background/60 border border-border rounded-lg py-2.5 px-4 text-foreground placeholder:text-muted-foreground input-focus-glow transition-all backdrop-blur-sm"
                                    placeholder="/path/to/backups"
                                />
                            </FocusRing>
                            <p className="mt-1 text-xs text-muted-foreground">
                                Absolute path to the directory where backups will be stored
                            </p>
                        </InteractiveCard>
                    </motion.div>
                )}

                {/* S3 Tab */}
                {activeTab === 's3' && (
                    <motion.div
                        key="s3"
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        className="space-y-4"
                    >
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <InteractiveCard>
                                <label className="block text-sm font-medium text-foreground mb-2">
                                    Endpoint <span className="text-destructive">*</span>
                                </label>
                                <FocusRing>
                                    <input
                                        type="text"
                                        value={s3Endpoint}
                                        onChange={(e) => setS3Endpoint(e.target.value)}
                                        onBlur={updateDestination}
                                        className="w-full bg-background/60 border border-border rounded-lg py-2.5 px-4 text-foreground placeholder:text-muted-foreground input-focus-glow transition-all backdrop-blur-sm"
                                        placeholder="s3.amazonaws.com"
                                    />
                                </FocusRing>
                                <p className="mt-1 text-xs text-muted-foreground">
                                    S3 endpoint URL (e.g., s3.amazonaws.com or MinIO endpoint)
                                </p>
                            </InteractiveCard>

                            <InteractiveCard>
                                <label className="block text-sm font-medium text-foreground mb-2">
                                    Bucket Name <span className="text-destructive">*</span>
                                </label>
                                <FocusRing>
                                    <input
                                        type="text"
                                        value={s3Bucket}
                                        onChange={(e) => setS3Bucket(e.target.value)}
                                        onBlur={updateDestination}
                                        className="w-full bg-background/60 border border-border rounded-lg py-2.5 px-4 text-foreground placeholder:text-muted-foreground input-focus-glow transition-all backdrop-blur-sm"
                                        placeholder="my-backup-bucket"
                                    />
                                </FocusRing>
                                <p className="mt-1 text-xs text-muted-foreground">
                                    S3 bucket name for storing backups
                                </p>
                            </InteractiveCard>

                            <InteractiveCard>
                                <label className="block text-sm font-medium text-foreground mb-2">
                                    Region
                                </label>
                                <FocusRing>
                                    <input
                                        type="text"
                                        value={s3Region}
                                        onChange={(e) => setS3Region(e.target.value)}
                                        onBlur={updateDestination}
                                        className="w-full bg-background/60 border border-border rounded-lg py-2.5 px-4 text-foreground placeholder:text-muted-foreground input-focus-glow transition-all backdrop-blur-sm"
                                        placeholder="us-east-1"
                                    />
                                </FocusRing>
                                <p className="mt-1 text-xs text-muted-foreground">
                                    AWS region (optional for some S3-compatible services)
                                </p>
                            </InteractiveCard>

                            <InteractiveCard>
                                <label className="block text-sm font-medium text-foreground mb-2">
                                    Path Prefix
                                </label>
                                <FocusRing>
                                    <input
                                        type="text"
                                        value={s3PathPrefix}
                                        onChange={(e) => setS3PathPrefix(e.target.value)}
                                        onBlur={updateDestination}
                                        className="w-full bg-background/60 border border-border rounded-lg py-2.5 px-4 text-foreground placeholder:text-muted-foreground input-focus-glow transition-all backdrop-blur-sm"
                                        placeholder="backups/"
                                    />
                                </FocusRing>
                                <p className="mt-1 text-xs text-muted-foreground">
                                    Optional prefix for organizing backups within the bucket
                                </p>
                            </InteractiveCard>

                            <InteractiveCard>
                                <label className="block text-sm font-medium text-foreground mb-2">
                                    Access Key ID <span className="text-destructive">*</span>
                                </label>
                                <FocusRing>
                                    <input
                                        type="text"
                                        value={s3AccessKey}
                                        onChange={(e) => setS3AccessKey(e.target.value)}
                                        onBlur={updateDestination}
                                        className="w-full bg-background/60 border border-border rounded-lg py-2.5 px-4 text-foreground placeholder:text-muted-foreground input-focus-glow transition-all backdrop-blur-sm"
                                        placeholder="AKIAIOSFODNN7EXAMPLE"
                                        autoComplete="off"
                                    />
                                </FocusRing>
                                <p className="mt-1 text-xs text-muted-foreground">
                                    S3 access key ID for authentication
                                </p>
                            </InteractiveCard>

                            <InteractiveCard>
                                <label className="block text-sm font-medium text-foreground mb-2">
                                    Secret Access Key <span className="text-destructive">*</span>
                                </label>
                                <FocusRing>
                                    <input
                                        type="password"
                                        value={s3SecretKey}
                                        onChange={(e) => setS3SecretKey(e.target.value)}
                                        onBlur={updateDestination}
                                        className="w-full bg-background/60 border border-border rounded-lg py-2.5 px-4 text-foreground placeholder:text-muted-foreground input-focus-glow transition-all backdrop-blur-sm"
                                        placeholder="wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"
                                        autoComplete="off"
                                    />
                                </FocusRing>
                                <p className="mt-1 text-xs text-muted-foreground">
                                    S3 secret access key for authentication
                                </p>
                            </InteractiveCard>
                        </div>
                    </motion.div>
                )}

                {/* Rclone Tab */}
                {activeTab === 'rclone' && (
                    <motion.div
                        key="rclone"
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        className="space-y-4"
                    >
                        <div className="p-4 bg-cyan-500/10 border border-cyan-500/30 rounded-xl mb-4">
                            <p className="text-sm text-muted-foreground">
                                <span className="text-cyan-400 font-medium">💡 Note:</span> Rclone must be installed and configured on the server with the remote already set up.
                            </p>
                        </div>

                        <InteractiveCard>
                            <label className="block text-sm font-medium text-foreground mb-2 flex items-center gap-2">
                                <FolderSync className="w-4 h-4" />
                                Remote Name <span className="text-destructive">*</span>
                            </label>
                            <FocusRing>
                                <input
                                    type="text"
                                    value={rcloneRemoteName}
                                    onChange={(e) => setRcloneRemoteName(e.target.value)}
                                    onBlur={updateDestination}
                                    className="w-full bg-background/60 border border-border rounded-lg py-2.5 px-4 text-foreground placeholder:text-muted-foreground input-focus-glow transition-all backdrop-blur-sm"
                                    placeholder="gdrive"
                                />
                            </FocusRing>
                            <p className="mt-1 text-xs text-muted-foreground">
                                Name of the configured rclone remote (e.g., gdrive, dropbox)
                            </p>
                        </InteractiveCard>

                        <InteractiveCard>
                            <label className="block text-sm font-medium text-foreground mb-2">
                                Remote Path <span className="text-destructive">*</span>
                            </label>
                            <FocusRing>
                                <input
                                    type="text"
                                    value={rcloneRemotePath}
                                    onChange={(e) => setRcloneRemotePath(e.target.value)}
                                    onBlur={updateDestination}
                                    className="w-full bg-background/60 border border-border rounded-lg py-2.5 px-4 text-foreground placeholder:text-muted-foreground input-focus-glow transition-all backdrop-blur-sm"
                                    placeholder="backups/"
                                />
                            </FocusRing>
                            <p className="mt-1 text-xs text-muted-foreground">
                                Path within the remote where backups will be stored
                            </p>
                        </InteractiveCard>
                    </motion.div>
                )}
            </div>

            {/* Test Connection Button */}
            <div className="flex items-center gap-4">
                <Button
                    type="button"
                    onClick={handleTestConnection}
                    disabled={testing || !getCurrentDestination()}
                    variant="outline"
                    className="btn-lift"
                >
                    {testing ? (
                        <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Testing...
                        </>
                    ) : (
                        <>
                            <Check className="w-4 h-4" />
                            Test Connection
                        </>
                    )}
                </Button>

                {testResult && (
                    <motion.div
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg ${
                            testResult.success
                                ? 'bg-green-500/10 border border-green-500/30 text-green-400'
                                : 'bg-destructive/10 border border-destructive/30 text-destructive'
                        }`}
                    >
                        {testResult.success ? (
                            <Check className="w-4 h-4" />
                        ) : (
                            <AlertCircle className="w-4 h-4" />
                        )}
                        <span className="text-sm font-medium">{testResult.message}</span>
                    </motion.div>
                )}
            </div>
        </motion.div>
    )
}
