import { motion } from 'framer-motion'
import { AlertCircle, Check, Copy, Download, Package, Globe } from 'lucide-react'
import { PostInstallChecklist } from '../../PostInstallChecklist'
import { createDefaultStoragePlan, DEFAULT_DATA_ROOT, STORAGE_CATEGORIES } from '../../../data/storagePlan'
import { SetupConfig } from '../../../store/setupStore'

interface ReviewGenerateStepProps {
    config: SetupConfig
    mode: 'newbie' | 'expert' | null
    selectedServices: string[]
    generateEnvFile: () => string
    generateAutheliaYaml: () => string
    generateCloudflareYaml: () => string
    copyToClipboard: (text: string) => void
    downloadFile: (content: string, filename: string) => void
    downloadAllFiles: () => void
    handleShare: () => void
    copied: boolean
}

export function ReviewGenerateStep({
    config, mode, selectedServices,
    generateEnvFile, generateAutheliaYaml: _generateAutheliaYaml, generateCloudflareYaml: _generateCloudflareYaml,
    copyToClipboard, downloadFile, downloadAllFiles, handleShare, copied
}: ReviewGenerateStepProps) {
    const storagePlan = config.storagePlan || createDefaultStoragePlan(DEFAULT_DATA_ROOT)
    const planRoot = storagePlan.dataRoot?.path || DEFAULT_DATA_ROOT
    const storageDefaults = createDefaultStoragePlan(planRoot)
    const storageEntries = STORAGE_CATEGORIES.filter((category) => {
        if (category.alwaysVisible) return true
        if (category.services.length === 0) return false
        return category.services.some((service) => selectedServices.includes(service))
    }).map((category) => ({
        id: category.id,
        label: category.label,
        path: storagePlan[category.id]?.path || storageDefaults[category.id]?.path || '',
        type: storagePlan[category.id]?.type || 'local',
    }))

    return (
        <motion.div
            key="step5"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-6"
        >
            <div className="mb-6">
                <h2 className="text-2xl font-bold text-white mb-2">Review & Generate</h2>
                <p className="text-gray-400">Verify your settings and generate configuration files</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                    <h3 className="text-sm font-semibold text-gray-300 mb-4">Configuration Summary</h3>
                    <dl className="space-y-2 text-sm">
                        <div className="flex justify-between">
                            <dt className="text-gray-500">Domain</dt>
                            <dd className="text-white font-mono">{config.domain}</dd>
                        </div>
                        <div className="flex justify-between">
                            <dt className="text-gray-500">Timezone</dt>
                            <dd className="text-white font-mono">{config.timezone}</dd>
                        </div>
                        <div className="flex justify-between">
                            <dt className="text-gray-500">Mode</dt>
                            <dd className="text-purple-300 capitalize">{mode}</dd>
                        </div>
                        <div className="flex justify-between">
                            <dt className="text-gray-500">Services</dt>
                            <dd className="text-white">{selectedServices.length} selected</dd>
                        </div>
                    </dl>
                </div>

                <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                    <h3 className="text-sm font-semibold text-gray-300 mb-4">Selected Services</h3>
                    <div className="flex flex-wrap gap-2">
                        {selectedServices.map((s: string) => (
                            <span key={s} className="px-2 py-1 rounded-md bg-purple-500/20 text-purple-300 text-xs border border-purple-500/30">
                                {s}
                            </span>
                        ))}
                    </div>
                </div>
            </div>

            {selectedServices.includes('torrent') && !selectedServices.includes('vpn') && (
                <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/30 flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-red-400 mt-0.5" />
                    <div>
                        <h3 className="text-sm font-semibold text-red-300">Security Warning: VPN Missing</h3>
                        <p className="text-sm text-red-200/70 mt-1">
                            You have selected a torrent client but not the VPN service.
                            Your IP address will be exposed to the swarm.
                            It is highly recommended to enable <strong>Gluetun VPN</strong> for privacy.
                        </p>
                    </div>
                </div>
            )}

            <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                <h3 className="text-sm font-semibold text-gray-300 mb-4">Storage Layout</h3>
                <div className="space-y-2 text-xs">
                    {storageEntries.map((entry) => (
                        <div key={entry.id} className="flex items-start justify-between gap-3">
                            <span className="text-gray-500">{entry.label}</span>
                            <div className="text-right">
                                <p className="font-mono text-white break-all">{entry.path}</p>
                                {entry.type === 'network' && (
                                    <span className="text-[10px] text-blue-300 uppercase tracking-wide">Network share</span>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* File Previews */}
            <div className="space-y-4">
                <div className="rounded-xl bg-black/50 border border-white/10 overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-2 bg-white/5 border-b border-white/10">
                        <span className="text-sm font-mono text-gray-300">.env</span>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => copyToClipboard(generateEnvFile())}
                                className="p-1.5 hover:bg-white/10 rounded-lg transition-colors text-gray-400 hover:text-white"
                                title="Copy to clipboard"
                            >
                                {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                            </button>
                            <button
                                onClick={() => downloadFile(generateEnvFile(), '.env')}
                                className="p-1.5 hover:bg-white/10 rounded-lg transition-colors text-gray-400 hover:text-white"
                                title="Download file"
                            >
                                <Download className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                    <pre className="p-4 text-xs font-mono text-gray-300 overflow-x-auto max-h-60 custom-scrollbar">
                        {generateEnvFile()}
                    </pre>
                </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 mt-8">
                <button
                    onClick={downloadAllFiles}
                    className="flex-1 flex items-center justify-center gap-2 px-6 py-4 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white rounded-xl font-semibold shadow-lg shadow-green-500/20 transition-all btn-lift"
                >
                    <Package className="w-5 h-5" />
                    Download All Files
                </button>
                <button
                    onClick={handleShare}
                    className="flex items-center justify-center gap-2 px-6 py-4 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 text-white rounded-xl font-semibold transition-all btn-lift"
                >
                    <Globe className="w-5 h-5" />
                    Share Configuration
                </button>
            </div>

            {/* Post-Install Checklist */}
            <div className="mt-12 pt-8 border-t border-white/10">
                <PostInstallChecklist />
            </div>
        </motion.div>
    )
}
