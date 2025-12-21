import { runCommand } from '../utils/docker.js';
import { setEnvValue } from '../utils/env.js';

export interface ArrServiceInfo {
    id: string;
    envKey: string;
}

export const ARR_SERVICES: ArrServiceInfo[] = [
    { id: 'sonarr', envKey: 'SONARR_API_KEY' },
    { id: 'radarr', envKey: 'RADARR_API_KEY' },
    { id: 'prowlarr', envKey: 'PROWLARR_API_KEY' },
    { id: 'readarr', envKey: 'READARR_API_KEY' },
    { id: 'lidarr', envKey: 'LIDARR_API_KEY' },
    { id: 'bazarr', envKey: 'BAZARR_API_KEY' }, // Included as it often follows similar patterns
];

/**
 * Extracts the API key from an *arr container by reading its config.xml
 */
export const extractArrApiKey = async (containerName: string): Promise<string | null> => {
    try {
        // Use the robust sed command to extract the key from config.xml
        const result = await runCommand('docker', [
            'exec',
            containerName,
            'sed',
            '-n',
            's:.*<ApiKey>\\(.*\\)</ApiKey>.*:\\1:p',
            '/config/config.xml'
        ]);

        const key = result.trim();
        return key || null;
    } catch {
        // Container might not be running or config.xml not yet initialized
        return null;
    }
};

export const extractArrKeys = async (): Promise<Record<string, string>> => {
    const results: Record<string, string> = {};

    for (const service of ARR_SERVICES) {
        const key = await extractArrApiKey(service.id);
        if (key) {
            results[service.envKey] = key;
        }
    }

    return results;
};

export const writeArrKeysToEnv = (keys: Record<string, string>): void => {
    for (const [envKey, envValue] of Object.entries(keys)) {
        setEnvValue(envKey, envValue);
    }
};

/**
 * Iterates through all known *arr services, extracts their keys, and updates .env
 */
export const bootstrapArrKeys = async (): Promise<Record<string, string>> => {
    const keys = await extractArrKeys();
    writeArrKeysToEnv(keys);
    return keys;
};
