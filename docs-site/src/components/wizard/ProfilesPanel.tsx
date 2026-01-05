import { useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { User, FileUp, RotateCcw } from 'lucide-react'
import { useSetupStore } from '../../store/setupStore'

interface ProfilesPanelProps {
    isOpen: boolean
    onClose: () => void
}

/**
 * Panel for managing saved configuration profiles.
 * Allows users to save, load, and delete wizard configurations for quick reuse.
 */
export function ProfilesPanel({ isOpen, onClose }: ProfilesPanelProps) {
    const { savedProfiles, saveProfile, deleteProfile, loadProfile } = useSetupStore()
    const [newProfileName, setNewProfileName] = useState('')

    const handleSaveProfile = () => {
        if (!newProfileName.trim()) return
        saveProfile(newProfileName)
        setNewProfileName('')
    }

    const handleLoadProfile = (name: string) => {
        loadProfile(name)
        onClose()
    }

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mb-8 overflow-hidden"
                >
                    <div className="glass-ultra rounded-xl p-6 border border-blue-500/20 max-w-2xl mx-auto">
                        <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                            <User className="w-5 h-5 text-blue-400" />
                            Saved Profiles
                        </h3>

                        <div className="flex gap-2 mb-6">
                            <input
                                type="text"
                                value={newProfileName}
                                onChange={(e) => setNewProfileName(e.target.value)}
                                placeholder="Profile Name (e.g., 'Home Server')"
                                className="flex-1 bg-background border border-border rounded-lg px-4 py-2 text-sm text-foreground focus:border-blue-500/50 outline-none"
                                onKeyDown={(e) => e.key === 'Enter' && handleSaveProfile()}
                            />
                            <button
                                onClick={handleSaveProfile}
                                disabled={!newProfileName.trim()}
                                className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Save Current
                            </button>
                        </div>

                        <div className="space-y-2 max-h-60 overflow-y-auto custom-scrollbar">
                            {Object.keys(savedProfiles).length === 0 ? (
                                <p className="text-center text-muted-foreground py-4">No saved profiles yet.</p>
                            ) : (
                                Object.entries(savedProfiles).map(([name, profile]) => (
                                    <div key={name} className="flex items-center justify-between p-3 bg-muted/40 rounded-lg border border-border hover:border-primary/40 transition-all">
                                        <div>
                                            <div className="font-medium text-foreground">{name}</div>
                                            <div className="text-xs text-muted-foreground">
                                                {profile.selectedServices.length} services • {profile.mode || 'Custom'}
                                            </div>
                                        </div>
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => handleLoadProfile(name)}
                                                className="p-2 hover:bg-green-500/20 text-muted-foreground hover:text-green-600 rounded-lg transition-colors"
                                                title="Load Profile"
                                            >
                                                <FileUp className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={() => deleteProfile(name)}
                                                className="p-2 hover:bg-red-500/20 text-muted-foreground hover:text-red-600 rounded-lg transition-colors"
                                                title="Delete Profile"
                                            >
                                                <RotateCcw className="w-4 h-4 rotate-45" />
                                            </button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    )
}
