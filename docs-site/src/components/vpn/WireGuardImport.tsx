import { useState, useRef, DragEvent } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import {
    Upload,
    FileText,
    CheckCircle,
    AlertCircle,
    X,
    Key,
    Lock,
    Globe,
    AlertTriangle,
    Copy,
    Check,
} from 'lucide-react'
import { parseWireGuardConfig, configToEnvVars, getSampleConfig, type WireGuardConfig } from '@/utils/wireguardParser'
import { useSetupStore } from '@/store/setupStore'
import { cn } from '@/lib/utils'

interface WireGuardImportProps {
    onImportComplete?: (config: WireGuardConfig) => void
    className?: string
}

export function WireGuardImport({ onImportComplete, className }: WireGuardImportProps) {
    const [configText, setConfigText] = useState('')
    const [parsedConfig, setParsedConfig] = useState<WireGuardConfig | null>(null)
    const [errors, setErrors] = useState<string[]>([])
    const [warnings, setWarnings] = useState<string[]>([])
    const [isDragging, setIsDragging] = useState(false)
    const [showPreview, setShowPreview] = useState(false)
    const [copiedField, setCopiedField] = useState<string | null>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)

    const { updateVpnConfig } = useSetupStore()

    // Handle file drop
    const handleDrop = (e: DragEvent<HTMLDivElement>) => {
        e.preventDefault()
        setIsDragging(false)

        const files = e.dataTransfer.files
        if (files.length > 0) {
            const file = files[0]

            // Check if it's a .conf file
            if (!file.name.endsWith('.conf')) {
                setErrors(['Please upload a .conf file'])
                return
            }

            // Read file content
            const reader = new FileReader()
            reader.onload = (event) => {
                const content = event.target?.result as string
                setConfigText(content)
                parseConfig(content)
            }
            reader.onerror = () => {
                setErrors(['Failed to read file'])
            }
            reader.readAsText(file)
        }
    }

    // Handle drag over
    const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
        e.preventDefault()
        setIsDragging(true)
    }

    // Handle drag leave
    const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
        e.preventDefault()
        setIsDragging(false)
    }

    // Handle file selection via input
    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files
        if (files && files.length > 0) {
            const file = files[0]
            const reader = new FileReader()
            reader.onload = (event) => {
                const content = event.target?.result as string
                setConfigText(content)
                parseConfig(content)
            }
            reader.onerror = () => {
                setErrors(['Failed to read file'])
            }
            reader.readAsText(file)
        }
    }

    // Parse configuration
    const parseConfig = (content: string) => {
        const result = parseWireGuardConfig(content)

        if (result.success && result.config) {
            setParsedConfig(result.config)
            setErrors([])
            setWarnings(result.warnings)
            setShowPreview(true)
        } else {
            setParsedConfig(null)
            setErrors(result.errors)
            setWarnings(result.warnings)
            setShowPreview(false)
        }
    }

    // Handle text change
    const handleTextChange = (text: string) => {
        setConfigText(text)
        if (text.trim()) {
            parseConfig(text)
        } else {
            setParsedConfig(null)
            setErrors([])
            setWarnings([])
            setShowPreview(false)
        }
    }

    // Apply configuration to store
    const handleApplyConfig = () => {
        if (!parsedConfig) return

        const envVars = configToEnvVars(parsedConfig)

        // Update store with parsed credentials
        updateVpnConfig({
            selectedVpnProvider: 'custom-wireguard',
            vpnProtocol: 'wireguard',
            vpnCredentials: envVars,
            wireguardConfigImported: true,
        })

        onImportComplete?.(parsedConfig)
    }

    // Clear configuration
    const handleClear = () => {
        setConfigText('')
        setParsedConfig(null)
        setErrors([])
        setWarnings([])
        setShowPreview(false)
        if (fileInputRef.current) {
            fileInputRef.current.value = ''
        }
    }

    // Copy to clipboard
    const handleCopyField = (value: string, fieldName: string) => {
        navigator.clipboard.writeText(value)
        setCopiedField(fieldName)
        setTimeout(() => setCopiedField(null), 2000)
    }

    // Paste sample config
    const handlePasteSample = () => {
        const sample = getSampleConfig()
        setConfigText(sample)
        parseConfig(sample)
    }

    return (
        <div className={cn('space-y-6', className)}>
            {/* Header */}
            <div>
                <h3 className="text-2xl font-bold text-foreground mb-2">Import WireGuard Configuration</h3>
                <p className="text-muted-foreground">
                    Upload your .conf file or paste the configuration text below
                </p>
            </div>

            {/* File Drop Zone */}
            <div
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onClick={() => fileInputRef.current?.click()}
                className={cn(
                    'relative border-2 border-dashed rounded-xl p-8 transition-all cursor-pointer',
                    'hover:border-primary/50 hover:bg-primary/5',
                    isDragging
                        ? 'border-primary bg-primary/10 scale-[1.02]'
                        : parsedConfig
                        ? 'border-green-500/50 bg-green-500/5'
                        : errors.length > 0
                        ? 'border-destructive/50 bg-destructive/5'
                        : 'border-border bg-card/40'
                )}
            >
                <input
                    ref={fileInputRef}
                    type="file"
                    accept=".conf"
                    onChange={handleFileSelect}
                    className="hidden"
                    aria-label="Upload WireGuard configuration file"
                />

                <div className="flex flex-col items-center text-center space-y-3">
                    {parsedConfig ? (
                        <>
                            <CheckCircle className="w-12 h-12 text-green-400" />
                            <div>
                                <p className="text-lg font-semibold text-foreground">Configuration Loaded</p>
                                <p className="text-sm text-muted-foreground mt-1">
                                    Click to upload a different file
                                </p>
                            </div>
                        </>
                    ) : errors.length > 0 ? (
                        <>
                            <AlertCircle className="w-12 h-12 text-destructive" />
                            <div>
                                <p className="text-lg font-semibold text-foreground">Invalid Configuration</p>
                                <p className="text-sm text-muted-foreground mt-1">
                                    Please check the errors below and try again
                                </p>
                            </div>
                        </>
                    ) : (
                        <>
                            <Upload className="w-12 h-12 text-muted-foreground" />
                            <div>
                                <p className="text-lg font-semibold text-foreground">
                                    {isDragging ? 'Drop file here' : 'Upload WireGuard Config'}
                                </p>
                                <p className="text-sm text-muted-foreground mt-1">
                                    Drag & drop a .conf file or click to browse
                                </p>
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* Text Paste Area */}
            <div className="space-y-3">
                <div className="flex items-center justify-between">
                    <label className="text-sm font-medium text-foreground flex items-center gap-2">
                        <FileText className="w-4 h-4 text-primary" />
                        Or paste configuration text
                    </label>
                    <div className="flex gap-2">
                        <button
                            onClick={handlePasteSample}
                            className="text-xs text-primary hover:text-primary/80 transition-colors"
                        >
                            View sample format
                        </button>
                        {configText && (
                            <button
                                onClick={handleClear}
                                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                            >
                                Clear
                            </button>
                        )}
                    </div>
                </div>
                <textarea
                    value={configText}
                    onChange={(e) => handleTextChange(e.target.value)}
                    placeholder={getSampleConfig()}
                    rows={12}
                    className={cn(
                        'w-full bg-background/60 border rounded-lg p-4 font-mono text-sm',
                        'focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background',
                        'transition-all resize-y',
                        errors.length > 0 ? 'border-destructive' : 'border-border',
                        parsedConfig && 'border-green-500/50'
                    )}
                />
            </div>

            {/* Errors */}
            <AnimatePresence>
                {errors.length > 0 && (
                    <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="p-4 bg-destructive/10 border border-destructive/30 rounded-xl"
                    >
                        <div className="flex items-start gap-3">
                            <AlertCircle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
                            <div className="flex-1">
                                <h4 className="font-semibold text-destructive mb-2">Configuration Errors</h4>
                                <ul className="space-y-1">
                                    {errors.map((error, idx) => (
                                        <li key={idx} className="text-sm text-muted-foreground flex items-start gap-2">
                                            <span className="text-destructive">•</span>
                                            {error}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Warnings */}
            <AnimatePresence>
                {warnings.length > 0 && (
                    <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl"
                    >
                        <div className="flex items-start gap-3">
                            <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
                            <div className="flex-1">
                                <h4 className="font-semibold text-amber-300 mb-2">Warnings</h4>
                                <ul className="space-y-1">
                                    {warnings.map((warning, idx) => (
                                        <li key={idx} className="text-sm text-muted-foreground flex items-start gap-2">
                                            <span className="text-amber-400">•</span>
                                            {warning}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Configuration Preview */}
            <AnimatePresence>
                {showPreview && parsedConfig && (
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="space-y-4"
                    >
                        <div className="flex items-center justify-between">
                            <h4 className="text-lg font-semibold text-foreground flex items-center gap-2">
                                <CheckCircle className="w-5 h-5 text-green-400" />
                                Configuration Preview
                            </h4>
                            <button
                                onClick={() => setShowPreview(false)}
                                className="p-1 hover:bg-muted/60 rounded transition-colors"
                                aria-label="Close preview"
                            >
                                <X className="w-4 h-4 text-muted-foreground" />
                            </button>
                        </div>

                        <div className="grid gap-3">
                            {/* Interface Address */}
                            <ConfigField
                                icon={Globe}
                                label="Interface Address"
                                value={parsedConfig.addresses}
                                onCopy={handleCopyField}
                                copied={copiedField === 'addresses'}
                            />

                            {/* Endpoint */}
                            <ConfigField
                                icon={Globe}
                                label="Endpoint"
                                value={`${parsedConfig.endpointIp}:${parsedConfig.endpointPort}`}
                                onCopy={handleCopyField}
                                copied={copiedField === 'endpoint'}
                            />

                            {/* Private Key */}
                            <ConfigField
                                icon={Lock}
                                label="Private Key"
                                value={parsedConfig.privateKey}
                                sensitive
                                onCopy={handleCopyField}
                                copied={copiedField === 'privateKey'}
                            />

                            {/* Public Key */}
                            <ConfigField
                                icon={Key}
                                label="Server Public Key"
                                value={parsedConfig.publicKey}
                                sensitive
                                onCopy={handleCopyField}
                                copied={copiedField === 'publicKey'}
                            />

                            {/* DNS (optional) */}
                            {parsedConfig.dns && (
                                <ConfigField
                                    icon={Globe}
                                    label="DNS"
                                    value={parsedConfig.dns}
                                    onCopy={handleCopyField}
                                    copied={copiedField === 'dns'}
                                    optional
                                />
                            )}

                            {/* Preshared Key (optional) */}
                            {parsedConfig.presharedKey && (
                                <ConfigField
                                    icon={Lock}
                                    label="Preshared Key"
                                    value={parsedConfig.presharedKey}
                                    sensitive
                                    onCopy={handleCopyField}
                                    copied={copiedField === 'presharedKey'}
                                    optional
                                />
                            )}
                        </div>

                        {/* Apply Button */}
                        <motion.button
                            onClick={handleApplyConfig}
                            className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-gradient-to-r from-emerald-500 via-cyan-500 to-lime-400 hover:from-emerald-400 hover:via-cyan-400 hover:to-lime-300 text-white font-medium rounded-lg transition-all"
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                        >
                            <CheckCircle className="w-5 h-5" />
                            Apply Configuration
                        </motion.button>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}

// Config field preview component
interface ConfigFieldProps {
    icon: React.ComponentType<{ className?: string }>
    label: string
    value: string
    sensitive?: boolean
    optional?: boolean
    onCopy: (value: string, field: string) => void
    copied: boolean
}

function ConfigField({ icon: Icon, label, value, sensitive, optional, onCopy, copied }: ConfigFieldProps) {
    const [revealed, setRevealed] = useState(false)

    const displayValue = sensitive && !revealed ? '•'.repeat(Math.min(value.length, 40)) : value

    return (
        <div className="p-4 bg-card/60 border border-border rounded-lg">
            <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div className="p-2 bg-primary/20 rounded-lg flex-shrink-0">
                        <Icon className="w-4 h-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                            <p className="text-sm font-medium text-foreground">{label}</p>
                            {optional && <span className="text-xs text-muted-foreground">(optional)</span>}
                        </div>
                        <p className="text-sm text-muted-foreground font-mono break-all">{displayValue}</p>
                    </div>
                </div>

                <div className="flex items-center gap-1 flex-shrink-0">
                    {sensitive && (
                        <button
                            onClick={() => setRevealed(!revealed)}
                            className="p-1.5 hover:bg-muted/60 rounded transition-colors"
                            aria-label={revealed ? 'Hide value' : 'Show value'}
                        >
                            {revealed ? (
                                <Lock className="w-4 h-4 text-muted-foreground" />
                            ) : (
                                <Key className="w-4 h-4 text-muted-foreground" />
                            )}
                        </button>
                    )}
                    <button
                        onClick={() => onCopy(value, label.toLowerCase().replace(/\s+/g, ''))}
                        className="p-1.5 hover:bg-muted/60 rounded transition-colors"
                        aria-label="Copy value"
                    >
                        {copied ? (
                            <Check className="w-4 h-4 text-green-400" />
                        ) : (
                            <Copy className="w-4 h-4 text-muted-foreground" />
                        )}
                    </button>
                </div>
            </div>
        </div>
    )
}
