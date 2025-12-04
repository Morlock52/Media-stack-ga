import { SetupConfig } from '../store/setupStore'

export function exportConfiguration(config: SetupConfig, selectedServices: string[], mode: string | null): string {
    const exportData = {
        version: '1.0',
        timestamp: new Date().toISOString(),
        mode,
        selectedServices,
        config
    }
    return JSON.stringify(exportData, null, 2)
}

export function importConfiguration(jsonString: string): {
    config: SetupConfig
    selectedServices: string[]
    mode: string | null
} | null {
    try {
        const data = JSON.parse(jsonString)

        // Validate structure
        if (!data.config || !Array.isArray(data.selectedServices)) {
            throw new Error('Invalid configuration format')
        }

        return {
            config: data.config,
            selectedServices: data.selectedServices,
            mode: data.mode || null
        }
    } catch (error) {
        console.error('Failed to import configuration:', error)
        return null
    }
}

export function downloadAsFile(content: string, filename: string) {
    const blob = new Blob([content], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
}
