import { useState } from 'react'
import { motion } from 'motion/react'
import { Lock, Tv, Film, Rocket, Check, AlertCircle, ArrowLeft } from 'lucide-react'
import { useSetupStore } from '../../../store/setupStore'

interface Preset {
    id: string
    title: string
    description: string
    icon: React.ReactNode
    services: string[]
    color: string
}

const presets: Preset[] = [
    {
        id: 'streaming',
        title: 'Just Streaming',
        description: 'Watch movies and TV shows',
        icon: <Tv className="w-6 h-6" />,
        services: ['plex', 'jellyfin'],
        color: 'from-blue-500 to-cyan-500',
    },
    {
        id: 'media-manager',
        title: 'Media Manager',
        description: 'Streaming + automatic downloads',
        icon: <Film className="w-6 h-6" />,
        services: ['plex', 'arr', 'torrent'],
        color: 'from-purple-500 to-pink-500',
    },
    {
        id: 'full-stack',
        title: 'Full Media Center',
        description: 'Everything included',
        icon: <Rocket className="w-6 h-6" />,
        services: ['plex', 'jellyfin', 'arr', 'torrent', 'vpn', 'stats', 'notify'],
        color: 'from-emerald-500 to-lime-500',
    },
]

export function QuickStartStep() {
    const { updateConfig, setSelectedServices, setCurrentStep, setQuickStartMode, config } = useSetupStore()
    const [password, setPassword] = useState(config.password || '')
    const [selectedPreset, setSelectedPreset] = useState<string>('streaming')
    const [error, setError] = useState<string | null>(null)

    const handleBack = () => {
        setQuickStartMode(false)
        setCurrentStep(0)
    }

    const handleStart = () => {
        if (password.length < 8) {
            setError('Password must be at least 8 characters')
            return
        }

        // Apply defaults for quick start
        const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Etc/UTC'
        updateConfig({
            domain: 'local',
            timezone,
            puid: '1000',
            pgid: '1000',
            password,
            deploymentMode: 'local',
        })

        // Apply selected preset
        const preset = presets.find(p => p.id === selectedPreset)
        if (preset) {
            setSelectedServices(preset.services)
        }

        // Skip to Review step (step 5)
        setCurrentStep(5)
    }

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-8 py-4"
        >
            {/* Header */}
            <div className="text-center">
                <h2 className="text-2xl font-bold text-foreground mb-2">
                    Quick Start
                </h2>
                <p className="text-muted-foreground">
                    Just two things and you're ready to go!
                </p>
            </div>

            {/* Step 1: Password */}
            <div className="max-w-md mx-auto">
                <div className="flex items-center gap-2 mb-3">
                    <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-sm">
                        1
                    </div>
                    <span className="font-medium text-foreground">Create a password</span>
                </div>
                <div className="relative">
                    <Lock className="absolute left-3 top-3.5 w-5 h-5 text-muted-foreground" />
                    <input
                        type="password"
                        value={password}
                        onChange={(e) => {
                            setPassword(e.target.value)
                            setError(null)
                        }}
                        className={`w-full bg-background/60 border ${error ? 'border-destructive' : 'border-border'} rounded-xl py-3 pl-11 pr-4 text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all`}
                        placeholder="Choose a password (8+ characters)"
                        autoFocus
                    />
                </div>
                {error && (
                    <p className="mt-2 text-sm text-destructive flex items-center gap-1">
                        <AlertCircle className="w-4 h-4" /> {error}
                    </p>
                )}
                <p className="mt-2 text-xs text-muted-foreground">
                    This protects your apps from others on your network
                </p>
            </div>

            {/* Step 2: Choose Preset */}
            <div className="max-w-2xl mx-auto">
                <div className="flex items-center gap-2 mb-4">
                    <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-sm">
                        2
                    </div>
                    <span className="font-medium text-foreground">What do you want to do?</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {presets.map((preset) => {
                        const isSelected = selectedPreset === preset.id
                        return (
                            <motion.button
                                key={preset.id}
                                onClick={() => setSelectedPreset(preset.id)}
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                className={`relative p-5 rounded-2xl border-2 text-left transition-all ${
                                    isSelected
                                        ? 'border-primary bg-primary/10 shadow-lg'
                                        : 'border-border bg-card/50 hover:border-muted-foreground/50'
                                }`}
                            >
                                {/* Selection indicator */}
                                <div className={`absolute top-3 right-3 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
                                    isSelected
                                        ? 'border-primary bg-primary'
                                        : 'border-muted-foreground/30'
                                }`}>
                                    {isSelected && <Check className="w-4 h-4 text-primary-foreground" />}
                                </div>

                                {/* Icon */}
                                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${preset.color} flex items-center justify-center text-white mb-3`}>
                                    {preset.icon}
                                </div>

                                {/* Text */}
                                <h3 className="font-semibold text-foreground mb-1">
                                    {preset.title}
                                </h3>
                                <p className="text-sm text-muted-foreground">
                                    {preset.description}
                                </p>
                            </motion.button>
                        )
                    })}
                </div>
            </div>

            {/* Buttons */}
            <div className="flex items-center justify-center gap-4 pt-4">
                <button
                    onClick={handleBack}
                    className="inline-flex items-center gap-2 px-6 py-3 text-muted-foreground hover:text-foreground transition-colors"
                >
                    <ArrowLeft className="w-4 h-4" />
                    Back
                </button>
                <motion.button
                    onClick={handleStart}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="inline-flex items-center gap-2 px-10 py-4 bg-gradient-to-r from-emerald-500 via-cyan-500 to-lime-400 rounded-xl font-bold text-lg text-white shadow-lg shadow-emerald-500/25 hover:shadow-emerald-400/40 transition-all"
                >
                    <Rocket className="w-5 h-5" />
                    Start My Media Server
                </motion.button>
            </div>
            <p className="text-center text-xs text-muted-foreground">
                Takes about 2 minutes to download and start
            </p>
        </motion.div>
    )
}
