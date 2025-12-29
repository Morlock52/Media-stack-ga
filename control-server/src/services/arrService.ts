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
    { id: 'bazarr', envKey: 'BAZARR_API_KEY' },
];

export interface ArrServiceStatus {
    id: string;
    running: boolean;
    ready: boolean; // config.xml exists
}

/**
 * Check if a container is running
 */
export const isContainerRunning = async (containerName: string): Promise<boolean> => {
    try {
        const result = await runCommand('docker', [
            'inspect',
            '-f',
            '{{.State.Running}}',
            containerName
        ]);
        return result.trim() === 'true';
    } catch {
        return false;
    }
};

/**
 * Check if an *arr container has initialized (config file exists)
 * Bazarr uses YAML config, others use XML
 */
export const isArrReady = async (containerName: string): Promise<boolean> => {
    try {
        // Bazarr uses a different config structure
        if (containerName === 'bazarr') {
            await runCommand('docker', [
                'exec',
                containerName,
                'test',
                '-f',
                '/config/config/config.yaml'
            ]);
        } else {
            await runCommand('docker', [
                'exec',
                containerName,
                'test',
                '-f',
                '/config/config.xml'
            ]);
        }
        return true;
    } catch {
        return false;
    }
};

/**
 * Get status of all *arr services
 */
export const getArrServicesStatus = async (): Promise<ArrServiceStatus[]> => {
    const statuses: ArrServiceStatus[] = [];

    for (const service of ARR_SERVICES) {
        const running = await isContainerRunning(service.id);
        const ready = running ? await isArrReady(service.id) : false;
        statuses.push({
            id: service.id,
            running,
            ready
        });
    }

    return statuses;
};

/**
 * Wait for *arr services to be ready (with timeout)
 */
export const waitForArrServices = async (
    timeoutMs: number = 120000,
    pollIntervalMs: number = 5000
): Promise<{ ready: boolean; services: ArrServiceStatus[] }> => {
    const startTime = Date.now();

    while (Date.now() - startTime < timeoutMs) {
        const statuses = await getArrServicesStatus();
        const runningServices = statuses.filter(s => s.running);

        // If no services are running, return immediately
        if (runningServices.length === 0) {
            return { ready: false, services: statuses };
        }

        // Check if all running services are ready
        const allReady = runningServices.every(s => s.ready);
        if (allReady) {
            return { ready: true, services: statuses };
        }

        // Wait before next poll
        await new Promise(resolve => setTimeout(resolve, pollIntervalMs));
    }

    // Timeout - return current status
    const finalStatuses = await getArrServicesStatus();
    return { ready: false, services: finalStatuses };
};

/**
 * Extracts the API key from an *arr container by reading its config
 * Bazarr uses YAML format, others use XML
 */
export const extractArrApiKey = async (containerName: string): Promise<string | null> => {
    try {
        let result: string;

        if (containerName === 'bazarr') {
            // Bazarr stores API key in YAML format at auth.apikey
            result = await runCommand('docker', [
                'exec',
                containerName,
                'grep',
                '-A1',
                'auth:',
                '/config/config/config.yaml'
            ]);
            // Parse "  apikey: <value>" from grep output
            const match = result.match(/apikey:\s*([a-f0-9]+)/i);
            return match ? match[1] : null;
        } else {
            // Standard *arr apps use XML config
            result = await runCommand('docker', [
                'exec',
                containerName,
                'sed',
                '-n',
                's:.*<ApiKey>\\(.*\\)</ApiKey>.*:\\1:p',
                '/config/config.xml'
            ]);
            const key = result.trim();
            return key || null;
        }
    } catch {
        // Container might not be running or config not yet initialized
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
