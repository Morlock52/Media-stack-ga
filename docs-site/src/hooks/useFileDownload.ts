import { useState, useCallback } from 'react'
import { useSetupStore } from '../store/setupStore'
import { useConfigGenerators } from './useConfigGenerators'
import { generateEnvFile as buildEnvFile } from '../utils/generateEnvFile'
import dockerComposeTemplate from '../../../docker-compose.yml?raw'
import dockerComposeLocalTemplate from '../../../docker-compose.local.yml?raw'

/**
 * Hook that provides file download and clipboard utilities for the wizard.
 * Handles downloading configuration files and copying text to clipboard.
 *
 * @returns Object containing download/clipboard functions and copied state
 */
export function useFileDownload() {
    const config = useSetupStore((state) => state.config)
    const selectedServices = useSetupStore((state) => state.selectedServices)
    const [copied, setCopied] = useState(false)

    const { generateAutheliaYaml, generateCloudflareYaml } = useConfigGenerators()

    /**
     * Copies text to clipboard and shows feedback for 2 seconds
     */
    const copyToClipboard = useCallback((text: string) => {
        navigator.clipboard.writeText(text)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
    }, [])

    /**
     * Downloads content as a file with the specified filename
     */
    const downloadFile = useCallback((content: string, filename: string) => {
        const blob = new Blob([content], { type: 'text/plain' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = filename
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
    }, [])

    /**
     * Generates the .env file content
     */
    const generateEnvFile = useCallback(
        () => buildEnvFile(config, selectedServices),
        [config, selectedServices]
    )

    /**
     * Downloads all configuration files (.env, authelia, cloudflare, docker-compose)
     */
    const downloadAllFiles = useCallback(() => {
        downloadFile(generateEnvFile(), '.env')
        downloadFile(generateAutheliaYaml(), 'authelia-configuration.yml')
        downloadFile(generateCloudflareYaml(), 'cloudflare-config.yml')
        const compose =
            config.deploymentMode === 'local'
                ? dockerComposeLocalTemplate
                : dockerComposeTemplate
        downloadFile(compose, 'docker-compose.yml')
    }, [
        downloadFile,
        generateEnvFile,
        generateAutheliaYaml,
        generateCloudflareYaml,
        config.deploymentMode
    ])

    return {
        copied,
        copyToClipboard,
        downloadFile,
        downloadAllFiles,
        generateEnvFile
    }
}
