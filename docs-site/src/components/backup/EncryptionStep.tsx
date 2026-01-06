import { useState, useEffect } from 'react'
import { motion } from 'motion/react'
import { Shield, Eye, EyeOff, AlertTriangle, CheckCircle2, XCircle, Lock } from 'lucide-react'
import { useBackupStore } from '../../store/backupStore'
import { InteractiveCard } from '../ui/interactive-card'
import { FocusRing } from '../ui/focus-ring'
import { toast } from 'sonner'

interface PasswordStrength {
    score: number // 0-4 (very weak to very strong)
    label: string
    color: string
    requirements: {
        length: boolean
        uppercase: boolean
        lowercase: boolean
        number: boolean
        special: boolean
    }
}

// Calculate password strength based on common criteria
function calculatePasswordStrength(password: string): PasswordStrength {
    const requirements = {
        length: password.length >= 12,
        uppercase: /[A-Z]/.test(password),
        lowercase: /[a-z]/.test(password),
        number: /[0-9]/.test(password),
        special: /[^A-Za-z0-9]/.test(password),
    }

    // Count met requirements
    const metRequirements = Object.values(requirements).filter(Boolean).length

    // Calculate score based on requirements and length
    let score = 0
    if (password.length === 0) {
        score = 0
    } else if (password.length < 8) {
        score = 1
    } else if (metRequirements <= 2) {
        score = 1
    } else if (metRequirements === 3) {
        score = 2
    } else if (metRequirements === 4) {
        score = 3
    } else if (metRequirements === 5 && password.length >= 12) {
        score = 4
    } else {
        score = 3
    }

    // Determine label and color based on score
    const strengthLevels = [
        { label: 'Very Weak', color: 'text-red-500' },
        { label: 'Weak', color: 'text-orange-500' },
        { label: 'Fair', color: 'text-yellow-500' },
        { label: 'Good', color: 'text-green-500' },
        { label: 'Excellent', color: 'text-emerald-400' },
    ]

    return {
        score,
        label: strengthLevels[score].label,
        color: strengthLevels[score].color,
        requirements,
    }
}

export function EncryptionStep() {
    const { encryption, setEncryption } = useBackupStore()
    const [enabled, setEnabled] = useState(encryption.enabled)
    const [password, setPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [showPassword, setShowPassword] = useState(false)
    const [showConfirmPassword, setShowConfirmPassword] = useState(false)
    const [passwordStrength, setPasswordStrength] = useState<PasswordStrength | null>(null)
    const [passwordsMatch, setPasswordsMatch] = useState(true)

    // Update password strength when password changes
    useEffect(() => {
        if (password) {
            setPasswordStrength(calculatePasswordStrength(password))
        } else {
            setPasswordStrength(null)
        }
    }, [password])

    // Check if passwords match when either changes
    useEffect(() => {
        if (confirmPassword) {
            setPasswordsMatch(password === confirmPassword)
        } else {
            setPasswordsMatch(true)
        }
    }, [password, confirmPassword])

    // Update store when encryption config changes
    const updateEncryptionConfig = () => {
        if (enabled) {
            if (password && password === confirmPassword) {
                setEncryption({
                    enabled: true,
                    password: password,
                })
            } else {
                setEncryption({
                    enabled: true,
                    password: undefined,
                })
            }
        } else {
            setEncryption({
                enabled: false,
                password: undefined,
            })
        }
    }

    useEffect(() => {
        updateEncryptionConfig()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [enabled, password, confirmPassword, passwordsMatch])

    const handleToggleEncryption = () => {
        const newEnabled = !enabled
        setEnabled(newEnabled)

        if (!newEnabled) {
            // Clear passwords when disabling encryption
            setPassword('')
            setConfirmPassword('')
            toast.info('Encryption disabled')
        } else {
            toast.info('Encryption enabled')
        }
    }

    return (
        <motion.div
            key="encryption"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-6"
        >
            <div className="mb-6">
                <h2 className="text-2xl font-bold text-foreground mb-2">Configure Encryption</h2>
                <p className="text-muted-foreground">
                    Protect your backups with AES-256-GCM encryption. Encrypted backups are secure but require the password to restore.
                </p>
            </div>

            {/* Critical Warning Banner */}
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-5 bg-amber-500/10 border-2 border-amber-500/40 rounded-xl"
            >
                <div className="flex gap-3">
                    <AlertTriangle className="w-6 h-6 text-amber-400 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                        <h3 className="text-lg font-semibold text-amber-300 mb-2">
                            ⚠️ Important: Password Recovery
                        </h3>
                        <div className="space-y-2 text-sm text-amber-200/90">
                            <p>
                                <strong>There is NO way to recover your password if you lose it.</strong> Store your encryption password in a secure location such as a password manager.
                            </p>
                            <p>
                                Without the password, your encrypted backups will be <strong>permanently unrecoverable</strong>.
                            </p>
                            <p className="pt-2 border-t border-amber-500/30 text-amber-100 font-medium">
                                💡 Tip: Consider keeping an unencrypted backup copy in a secure local location as a failsafe.
                            </p>
                        </div>
                    </div>
                </div>
            </motion.div>

            {/* Encryption Toggle */}
            <InteractiveCard>
                <div className="flex items-center justify-between p-4">
                    <div className="flex items-center gap-3">
                        <Shield className={`w-6 h-6 ${enabled ? 'text-green-400' : 'text-muted-foreground'}`} />
                        <div>
                            <h3 className="text-lg font-semibold text-foreground">Enable Encryption</h3>
                            <p className="text-sm text-muted-foreground">
                                Encrypt backups with AES-256-GCM encryption
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={handleToggleEncryption}
                        className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors ${
                            enabled ? 'bg-green-500/80' : 'bg-muted/60'
                        }`}
                        aria-label="Toggle encryption"
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

            {/* Password Configuration (shown when enabled) */}
            {enabled && (
                <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="space-y-4"
                >
                    {/* Password Input */}
                    <InteractiveCard>
                        <label className="block text-sm font-medium text-foreground mb-2 flex items-center gap-2">
                            <Lock className="w-4 h-4" />
                            Encryption Password <span className="text-destructive">*</span>
                        </label>
                        <FocusRing>
                            <div className="relative">
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full bg-background/60 border border-border rounded-lg py-2.5 px-4 pr-12 text-foreground placeholder:text-muted-foreground input-focus-glow transition-all backdrop-blur-sm"
                                    placeholder="Enter a strong password"
                                    autoComplete="new-password"
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

                        {/* Password Strength Indicator */}
                        {passwordStrength && password && (
                            <motion.div
                                initial={{ opacity: 0, y: -5 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="mt-3 space-y-2"
                            >
                                {/* Strength Bar */}
                                <div className="flex items-center gap-3">
                                    <div className="flex-1 h-2 bg-muted/40 rounded-full overflow-hidden">
                                        <motion.div
                                            className={`h-full rounded-full ${
                                                passwordStrength.score === 0 ? 'bg-red-500' :
                                                passwordStrength.score === 1 ? 'bg-orange-500' :
                                                passwordStrength.score === 2 ? 'bg-yellow-500' :
                                                passwordStrength.score === 3 ? 'bg-green-500' :
                                                'bg-emerald-400'
                                            }`}
                                            initial={{ width: 0 }}
                                            animate={{ width: `${(passwordStrength.score + 1) * 20}%` }}
                                            transition={{ duration: 0.3 }}
                                        />
                                    </div>
                                    <span className={`text-sm font-medium ${passwordStrength.color}`}>
                                        {passwordStrength.label}
                                    </span>
                                </div>

                                {/* Requirements Checklist */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                                    <div className={`flex items-center gap-2 ${
                                        passwordStrength.requirements.length ? 'text-green-400' : 'text-muted-foreground'
                                    }`}>
                                        {passwordStrength.requirements.length ? (
                                            <CheckCircle2 className="w-3.5 h-3.5" />
                                        ) : (
                                            <XCircle className="w-3.5 h-3.5" />
                                        )}
                                        At least 12 characters
                                    </div>
                                    <div className={`flex items-center gap-2 ${
                                        passwordStrength.requirements.uppercase ? 'text-green-400' : 'text-muted-foreground'
                                    }`}>
                                        {passwordStrength.requirements.uppercase ? (
                                            <CheckCircle2 className="w-3.5 h-3.5" />
                                        ) : (
                                            <XCircle className="w-3.5 h-3.5" />
                                        )}
                                        Uppercase letter
                                    </div>
                                    <div className={`flex items-center gap-2 ${
                                        passwordStrength.requirements.lowercase ? 'text-green-400' : 'text-muted-foreground'
                                    }`}>
                                        {passwordStrength.requirements.lowercase ? (
                                            <CheckCircle2 className="w-3.5 h-3.5" />
                                        ) : (
                                            <XCircle className="w-3.5 h-3.5" />
                                        )}
                                        Lowercase letter
                                    </div>
                                    <div className={`flex items-center gap-2 ${
                                        passwordStrength.requirements.number ? 'text-green-400' : 'text-muted-foreground'
                                    }`}>
                                        {passwordStrength.requirements.number ? (
                                            <CheckCircle2 className="w-3.5 h-3.5" />
                                        ) : (
                                            <XCircle className="w-3.5 h-3.5" />
                                        )}
                                        Number
                                    </div>
                                    <div className={`flex items-center gap-2 sm:col-span-2 ${
                                        passwordStrength.requirements.special ? 'text-green-400' : 'text-muted-foreground'
                                    }`}>
                                        {passwordStrength.requirements.special ? (
                                            <CheckCircle2 className="w-3.5 h-3.5" />
                                        ) : (
                                            <XCircle className="w-3.5 h-3.5" />
                                        )}
                                        Special character (!@#$%^&*, etc.)
                                    </div>
                                </div>
                            </motion.div>
                        )}
                    </InteractiveCard>

                    {/* Confirm Password Input */}
                    <InteractiveCard>
                        <label className="block text-sm font-medium text-foreground mb-2 flex items-center gap-2">
                            <Lock className="w-4 h-4" />
                            Confirm Password <span className="text-destructive">*</span>
                        </label>
                        <FocusRing>
                            <div className="relative">
                                <input
                                    type={showConfirmPassword ? 'text' : 'password'}
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    className={`w-full bg-background/60 border rounded-lg py-2.5 px-4 pr-12 text-foreground placeholder:text-muted-foreground input-focus-glow transition-all backdrop-blur-sm ${
                                        confirmPassword && !passwordsMatch
                                            ? 'border-destructive'
                                            : confirmPassword && passwordsMatch
                                            ? 'border-green-500'
                                            : 'border-border'
                                    }`}
                                    placeholder="Re-enter your password"
                                    autoComplete="new-password"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                                    aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                                >
                                    {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                </button>
                            </div>
                        </FocusRing>

                        {/* Password Match Indicator */}
                        {confirmPassword && (
                            <motion.div
                                initial={{ opacity: 0, y: -5 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="mt-2"
                            >
                                {passwordsMatch ? (
                                    <div className="flex items-center gap-2 text-sm text-green-400">
                                        <CheckCircle2 className="w-4 h-4" />
                                        Passwords match
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-2 text-sm text-destructive">
                                        <XCircle className="w-4 h-4" />
                                        Passwords do not match
                                    </div>
                                )}
                            </motion.div>
                        )}
                    </InteractiveCard>

                    {/* Security Best Practices */}
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="p-4 bg-cyan-500/10 border border-cyan-500/30 rounded-xl"
                    >
                        <div className="flex gap-3">
                            <Shield className="w-5 h-5 text-cyan-400 flex-shrink-0 mt-0.5" />
                            <div className="flex-1">
                                <h4 className="text-sm font-semibold text-cyan-300 mb-2">
                                    Security Best Practices
                                </h4>
                                <ul className="space-y-1 text-xs text-cyan-200/90">
                                    <li>• Use a unique password that you don't use elsewhere</li>
                                    <li>• Store your password in a password manager (1Password, Bitwarden, etc.)</li>
                                    <li>• Consider using a passphrase of random words (e.g., "correct-horse-battery-staple")</li>
                                    <li>• Never share your encryption password or store it in plain text</li>
                                </ul>
                            </div>
                        </div>
                    </motion.div>
                </motion.div>
            )}

            {/* Summary when encryption is disabled */}
            {!enabled && (
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-6 bg-muted/20 border border-border/60 rounded-xl text-center"
                >
                    <Shield className="w-12 h-12 mx-auto mb-3 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">
                        Backups will be stored without encryption. Enable encryption to protect sensitive data.
                    </p>
                </motion.div>
            )}
        </motion.div>
    )
}
