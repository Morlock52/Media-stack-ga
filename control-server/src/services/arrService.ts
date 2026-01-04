import { runCommand } from '../utils/docker.js';
import { setEnvValue } from '../utils/env.js';
import { createLogger } from '../utils/logger.js';
import fs from 'fs';

const logger = createLogger('arrService');

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export type KeyValidationResult = {
    ok: boolean;
    tested: boolean;
    status?: number;
    error?: string;
};

export interface ArrServiceInfo {
    id: string;
    envKey: string;
    configType: 'xml' | 'yaml' | 'json' | 'ini' | 'env' | 'custom';
    configPath?: string;
    extractPattern?: string;
    aliases?: string[]; // Alternative container names to check
}

/**
 * Comprehensive list of all services that have API keys/tokens
 * Includes *arr apps, media servers, download clients, and utilities
 */
export const ARR_SERVICES: ArrServiceInfo[] = [
    // === Standard *Arr Apps (XML config) ===
    { id: 'sonarr', envKey: 'SONARR_API_KEY', configType: 'xml', configPath: '/config/config.xml' },
    { id: 'radarr', envKey: 'RADARR_API_KEY', configType: 'xml', configPath: '/config/config.xml' },
    { id: 'prowlarr', envKey: 'PROWLARR_API_KEY', configType: 'xml', configPath: '/config/config.xml' },
    { id: 'readarr', envKey: 'READARR_API_KEY', configType: 'xml', configPath: '/config/config.xml' },
    { id: 'lidarr', envKey: 'LIDARR_API_KEY', configType: 'xml', configPath: '/config/config.xml' },
    { id: 'whisparr', envKey: 'WHISPARR_API_KEY', configType: 'xml', configPath: '/config/config.xml' },

    // === Bazarr (YAML config) ===
    { id: 'bazarr', envKey: 'BAZARR_API_KEY', configType: 'yaml', configPath: '/config/config/config.yaml' },

    // === Request Management ===
    {
        id: 'overseerr',
        envKey: 'OVERSEERR_API_KEY',
        configType: 'json',
        configPath: '/app/config/settings.json',
        aliases: ['jellyseerr']
    },
    {
        id: 'jellyseerr',
        envKey: 'JELLYSEERR_API_KEY',
        configType: 'json',
        configPath: '/app/config/settings.json'
    },
    {
        id: 'ombi',
        envKey: 'OMBI_API_KEY',
        configType: 'json',
        configPath: '/config/appsettings.json'
    },

    // === Media Servers ===
    {
        id: 'tautulli',
        envKey: 'TAUTULLI_API_KEY',
        configType: 'ini',
        configPath: '/config/config.ini'
    },
    {
        id: 'plex',
        envKey: 'PLEX_TOKEN',
        configType: 'custom',
        configPath: '/config/Library/Application Support/Plex Media Server/Preferences.xml'
    },
    {
        id: 'jellyfin',
        envKey: 'JELLYFIN_API_KEY',
        configType: 'env' // Read from container environment
    },

    // === Download Clients ===
    {
        id: 'qbittorrent',
        envKey: 'QBITTORRENT_API_KEY',
        configType: 'custom',
        aliases: ['qbt']
    },
    {
        id: 'deluge',
        envKey: 'DELUGE_PASSWORD',
        configType: 'json',
        configPath: '/config/auth'
    },
    {
        id: 'transmission',
        envKey: 'TRANSMISSION_PASSWORD',
        configType: 'json',
        configPath: '/config/settings.json'
    },
    {
        id: 'sabnzbd',
        envKey: 'SABNZBD_API_KEY',
        configType: 'ini',
        configPath: '/config/sabnzbd.ini'
    },
    {
        id: 'nzbget',
        envKey: 'NZBGET_PASSWORD',
        configType: 'custom',
        configPath: '/config/nzbget.conf'
    },

    // === Indexers ===
    {
        id: 'jackett',
        envKey: 'JACKETT_API_KEY',
        configType: 'json',
        configPath: '/config/Jackett/ServerConfig.json'
    },

    // === Notifications & Utilities ===
    {
        id: 'notifiarr',
        envKey: 'NOTIFIARR_API_KEY',
        configType: 'env'
    },
    {
        id: 'tdarr',
        envKey: 'TDARR_API_KEY',
        configType: 'env',
        aliases: ['tdarr_server', 'tdarr-server']
    },
    {
        id: 'unpackerr',
        envKey: 'UNPACKERR_API_KEY',
        configType: 'env'
    },
    {
        id: 'requestrr',
        envKey: 'REQUESTRR_API_KEY',
        configType: 'json',
        configPath: '/config/settings.json'
    },

    // === Homepage Dashboard ===
    {
        id: 'homepage',
        envKey: 'HOMEPAGE_API_KEY',
        configType: 'env'
    },

    // === Organizr ===
    {
        id: 'organizr',
        envKey: 'ORGANIZR_API_KEY',
        configType: 'custom',
        configPath: '/config/www/organizr/api/config/config.php'
    },
];

export interface ArrServiceStatus {
    id: string;
    running: boolean;
    ready: boolean;
    containerName?: string; // Actual container name found
}

export interface ExtractedKey {
    service: string;
    envKey: string;
    value: string;
    containerName: string;
}

const isRunningInDocker = () => {
    try {
        if (fs.existsSync('/.dockerenv')) return true;
    } catch {
        // ignore
    }
    try {
        const cgroup = fs.readFileSync('/proc/1/cgroup', 'utf-8');
        return /docker|containerd|kubepods/i.test(cgroup);
    } catch {
        return false;
    }
};

const getHostForPublishedPorts = () => (isRunningInDocker() ? 'host.docker.internal' : '127.0.0.1');

const getPublishedPort = async (containerName: string, containerPort: number): Promise<number | null> => {
    try {
        const output = await runCommand(
            'docker',
            ['port', containerName, `${containerPort}/tcp`],
            { timeoutMs: 4_000, label: `docker:port:${containerName}:${containerPort}` }
        );
        const lines = output
            .split('\n')
            .map((line) => line.trim())
            .filter(Boolean);
        for (const line of lines) {
            const match = line.match(/:(\d+)$/);
            if (match) return parseInt(match[1], 10);
        }
        return null;
    } catch {
        return null;
    }
};

const fetchWithTimeout = async (url: string, init: RequestInit = {}, timeoutMs = 4_000) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        return await fetch(url, { ...init, signal: controller.signal });
    } finally {
        clearTimeout(timer);
    }
};

const VALIDATORS_BY_ENV_KEY: Record<
    string,
    | { serviceId: string; containerPort: number; type: 'arr-v3' }
    | { serviceId: string; containerPort: number; type: 'bazarr' }
    | { serviceId: string; containerPort: number; type: 'tautulli' }
> = {
    SONARR_API_KEY: { serviceId: 'sonarr', containerPort: 8989, type: 'arr-v3' },
    RADARR_API_KEY: { serviceId: 'radarr', containerPort: 7878, type: 'arr-v3' },
    PROWLARR_API_KEY: { serviceId: 'prowlarr', containerPort: 9696, type: 'arr-v3' },
    BAZARR_API_KEY: { serviceId: 'bazarr', containerPort: 6767, type: 'bazarr' },
    TAUTULLI_API_KEY: { serviceId: 'tautulli', containerPort: 8181, type: 'tautulli' },
};

export const validateArrKeys = async (
    keys: Record<string, string>,
    services?: ArrServiceStatus[]
): Promise<Record<string, KeyValidationResult>> => {
    const results: Record<string, KeyValidationResult> = {};
    const entries = Object.entries(keys || {});
    if (entries.length === 0) return results;

    const host = getHostForPublishedPorts();
    const serviceContainerMap = new Map<string, string>();
    (services || []).forEach((s) => {
        if (s?.id && s.containerName) serviceContainerMap.set(s.id, s.containerName);
    });

    const runningContainers = services?.length ? null : await getRunningContainers();

    for (const [envKey, value] of entries) {
        const validator = VALIDATORS_BY_ENV_KEY[envKey];
        if (!validator) {
            results[envKey] = { ok: false, tested: false, error: 'No validator available for this key type' };
            continue;
        }

        const serviceInfo = ARR_SERVICES.find((s) => s.id === validator.serviceId);
        const containerName =
            serviceContainerMap.get(validator.serviceId) ||
            (serviceInfo && runningContainers ? await findContainerName(serviceInfo, runningContainers) : null);

        if (!containerName) {
            results[envKey] = { ok: false, tested: false, error: 'Container not found for validation' };
            continue;
        }

        const hostPort = await getPublishedPort(containerName, validator.containerPort);
        if (!hostPort) {
            results[envKey] = { ok: false, tested: false, error: 'Service port is not published (cannot validate)' };
            continue;
        }

        try {
            if (validator.type === 'arr-v3') {
                const url = `http://${host}:${hostPort}/api/v3/system/status`;
                const response = await fetchWithTimeout(url, { headers: { 'X-Api-Key': value } }, 4_000);
                results[envKey] = response.ok
                    ? { ok: true, tested: true, status: response.status }
                    : { ok: false, tested: true, status: response.status, error: `HTTP ${response.status}` };
                continue;
            }

            if (validator.type === 'bazarr') {
                const url = `http://${host}:${hostPort}/api/system/status`;
                const response = await fetchWithTimeout(url, { headers: { 'X-Api-Key': value } }, 4_000);
                results[envKey] = response.ok
                    ? { ok: true, tested: true, status: response.status }
                    : { ok: false, tested: true, status: response.status, error: `HTTP ${response.status}` };
                continue;
            }

            if (validator.type === 'tautulli') {
                const url = new URL(`http://${host}:${hostPort}/api/v2`);
                url.searchParams.set('apikey', value);
                url.searchParams.set('cmd', 'get_server_info');
                const response = await fetchWithTimeout(url.toString(), {}, 4_000);
                const status = response.status;
                const text = await response.text().catch(() => '');

                if (!response.ok) {
                    results[envKey] = { ok: false, tested: true, status, error: `HTTP ${status}` };
                    continue;
                }

                try {
                    const parsed = JSON.parse(text);
                    const ok = parsed?.response?.result === 'success';
                    results[envKey] = ok
                        ? { ok: true, tested: true, status }
                        : { ok: false, tested: true, status, error: parsed?.response?.message || 'Invalid API key' };
                } catch {
                    results[envKey] = { ok: false, tested: true, status, error: 'Invalid JSON response from service' };
                }
                continue;
            }

            results[envKey] = { ok: false, tested: false, error: 'Unsupported validator' };
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            results[envKey] = { ok: false, tested: true, error: message };
        }
    }

    return results;
};

/**
 * Get all running Docker containers
 * Throws if Docker is not available (important for fast failure)
 */
export const getRunningContainers = async (): Promise<string[]> => {
    logger.debug('Fetching running Docker containers...');
    try {
        const result = await runCommand('docker', [
            'ps',
            '--format',
            '{{.Names}}'
        ]);
        const containers = result.trim().split('\n').filter(Boolean);
        logger.debug({ count: containers.length }, 'Found running containers');
        return containers;
    } catch (error) {
        // Check if Docker is not running/accessible
        const message = error instanceof Error ? error.message : String(error);
        if (message.includes('Cannot connect') || message.includes('permission denied') || message.includes('not found')) {
            logger.error({ error: message }, 'Docker is not running or not accessible');
            throw new Error('Docker is not running or not accessible. Please ensure Docker is started.');
        }
        logger.warn({ error: message }, 'Failed to list containers, returning empty list');
        return [];
    }
};

/**
 * Check if a container is running (tries multiple name variants)
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
 * Find actual container name from service definition (checks aliases too)
 */
export const findContainerName = async (service: ArrServiceInfo, runningContainers?: string[]): Promise<string | null> => {
    logger.debug({ serviceId: service.id }, 'Looking for container...');

    if (runningContainers && runningContainers.length > 0) {
        const getExact = (candidate: string) =>
            runningContainers.find((name) => name.toLowerCase() === candidate.toLowerCase()) || null;

        const exactPrimary = getExact(service.id);
        if (exactPrimary) {
            logger.debug({ serviceId: service.id, containerName: exactPrimary }, 'Found container by primary name');
            return exactPrimary;
        }

        if (service.aliases) {
            for (const alias of service.aliases) {
                const exactAlias = getExact(alias);
                if (exactAlias) {
                    logger.debug({ serviceId: service.id, containerName: exactAlias }, 'Found container by alias');
                    return exactAlias;
                }
            }
        }

        const patterns = [
            service.id,
            `${service.id}-1`,
            `mediastack_${service.id}`,
            `mediastack-${service.id}`,
            `${service.id}_1`,
        ];

        for (const pattern of patterns) {
            const match = getExact(pattern);
            if (match) {
                logger.debug({ serviceId: service.id, containerName: match }, 'Found container by pattern');
                return match;
            }
        }

        const bases = [service.id, ...(service.aliases || [])].map((b) => b.toLowerCase());
        for (const base of bases) {
            const re = new RegExp(`(^|[^a-z0-9])${escapeRegExp(base)}([^a-z0-9]|$)`, 'i');
            const match = runningContainers.find((name) => re.test(name.toLowerCase()));
            if (match) {
                logger.debug({ serviceId: service.id, containerName: match }, 'Found container by boundary match');
                return match;
            }
        }

        logger.debug({ serviceId: service.id }, 'Container not found');
        return null;
    }

    // Check primary name
    if (await isContainerRunning(service.id)) {
        logger.debug({ serviceId: service.id, containerName: service.id }, 'Found container by primary name');
        return service.id;
    }

    // Check aliases
    if (service.aliases) {
        for (const alias of service.aliases) {
            if (await isContainerRunning(alias)) {
                logger.debug({ serviceId: service.id, containerName: alias }, 'Found container by alias');
                return alias;
            }
        }
    }

    // Try common naming patterns
    const patterns = [
        service.id,
        `${service.id}-1`,
        `mediastack_${service.id}`,
        `mediastack-${service.id}`,
        `${service.id}_1`,
    ];

    for (const pattern of patterns) {
        if (await isContainerRunning(pattern)) {
            logger.debug({ serviceId: service.id, containerName: pattern }, 'Found container by pattern');
            return pattern;
        }
    }

    logger.debug({ serviceId: service.id }, 'Container not found');
    return null;
};

/**
 * Check if a service has initialized (config file exists)
 */
export const isArrReady = async (containerName: string, service: ArrServiceInfo): Promise<boolean> => {
    if (!service.configPath) {
        // If we don't have a reliable config path to probe, treat a running container as "ready".
        // This prevents readiness from getting stuck (e.g. custom services without config files).
        return true;
    }

    try {
        await runCommand('docker', [
            'exec',
            containerName,
            'test',
            '-f',
            service.configPath
        ], { timeoutMs: 5000, label: `arr-ready:${service.id}` });
        return true;
    } catch {
        return false;
    }
};

/**
 * Get status of all known services
 */
export const getArrServicesStatus = async (): Promise<ArrServiceStatus[]> => {
    const statuses: ArrServiceStatus[] = [];

    const runningContainers = await getRunningContainers();

    for (const service of ARR_SERVICES) {
        const containerName = await findContainerName(service, runningContainers);
        const running = containerName !== null;
        const ready = running ? await isArrReady(containerName!, service) : false;

        statuses.push({
            id: service.id,
            running,
            ready,
            containerName: containerName || undefined
        });
    }

    return statuses;
};

/**
 * Discover additional containers that might have API keys
 * Scans all running containers and matches against known patterns
 */
export const discoverAdditionalContainers = async (): Promise<string[]> => {
    const runningContainers = await getRunningContainers();
    const knownIds = ARR_SERVICES.flatMap(s => [s.id, ...(s.aliases || [])]);

    // Find containers that might have API keys but aren't in our known list
    const potentialContainers = runningContainers.filter(name => {
        const lowerName = name.toLowerCase();
        // Check for *arr pattern
        if (lowerName.endsWith('arr') || lowerName.includes('arr-')) {
            return !knownIds.some(id => lowerName.includes(id.toLowerCase()));
        }
        return false;
    });

    return potentialContainers;
};

/**
 * Wait for services to be ready (with timeout)
 * Uses stabilization logic: if no new services become ready after several polls, proceed with what we have
 */
export const waitForArrServices = async (
    timeoutMs: number = 120000,
    pollIntervalMs: number = 5000
): Promise<{ ready: boolean; services: ArrServiceStatus[] }> => {
    const startTime = Date.now();
    let lastReadyCount = 0;
    let stablePolls = 0;
    const stabilizationThreshold = 3; // After 3 polls with no change, consider stable

    while (Date.now() - startTime < timeoutMs) {
        const statuses = await getArrServicesStatus();
        const runningServices = statuses.filter(s => s.running);
        const readyServices = runningServices.filter(s => s.ready);

        if (runningServices.length === 0) {
            return { ready: false, services: statuses };
        }

        // All running services are ready - full success
        if (readyServices.length === runningServices.length) {
            return { ready: true, services: statuses };
        }

        // Check if we've stabilized (no new services becoming ready)
        if (readyServices.length === lastReadyCount) {
            stablePolls++;
            // If we have at least some services ready and haven't seen progress, proceed
            if (stablePolls >= stabilizationThreshold && readyServices.length > 0) {
                logger.info({
                    readyCount: readyServices.length,
                    runningCount: runningServices.length,
                    stablePolls
                }, 'Services stabilized, proceeding with ready services');
                return { ready: true, services: statuses };
            }
        } else {
            // Progress was made, reset stability counter
            stablePolls = 0;
            lastReadyCount = readyServices.length;
        }

        await new Promise(resolve => setTimeout(resolve, pollIntervalMs));
    }

    const finalStatuses = await getArrServicesStatus();
    const readyCount = finalStatuses.filter(s => s.running && s.ready).length;

    // Even on timeout, if we have some ready services, consider it a partial success
    if (readyCount > 0) {
        logger.info({ readyCount }, 'Timeout reached but some services are ready, proceeding');
        return { ready: true, services: finalStatuses };
    }

    return { ready: false, services: finalStatuses };
};

/**
 * Extract API key from XML config (standard *arr apps)
 */
const extractFromXml = async (containerName: string, configPath: string): Promise<string | null> => {
    try {
        const result = await runCommand('docker', [
            'exec',
            containerName,
            'sed',
            '-n',
            's:.*<ApiKey>\\(.*\\)</ApiKey>.*:\\1:p',
            configPath
        ]);
        const key = result.trim();
        return key || null;
    } catch {
        return null;
    }
};

/**
 * Extract API key from YAML config (bazarr style)
 */
const extractFromYaml = async (containerName: string, configPath: string): Promise<string | null> => {
    try {
        const result = await runCommand('docker', [
            'exec',
            containerName,
            'cat',
            configPath
        ]);
        // Look for apikey in various YAML formats
        const patterns = [
            /apikey:\s*['"]?([a-f0-9-]+)['"]?/i,
            /api_key:\s*['"]?([a-f0-9-]+)['"]?/i,
            /apiKey:\s*['"]?([a-f0-9-]+)['"]?/i,
        ];
        for (const pattern of patterns) {
            const match = result.match(pattern);
            if (match) return match[1];
        }
        return null;
    } catch {
        return null;
    }
};

/**
 * Extract API key from JSON config
 */
const extractFromJson = async (containerName: string, configPath: string): Promise<string | null> => {
    try {
        const result = await runCommand('docker', [
            'exec',
            containerName,
            'cat',
            configPath
        ]);
        const data = JSON.parse(result);

        // Try various common key locations
        const key = data.apiKey ||
                   data.api_key ||
                   data.apikey ||
                   data.main?.apiKey ||
                   data.ApiKey ||
                   data.settings?.apiKey ||
                   data.auth?.apiKey;

        return key || null;
    } catch {
        return null;
    }
};

/**
 * Extract API key from INI config (tautulli, sabnzbd)
 */
const extractFromIni = async (containerName: string, configPath: string): Promise<string | null> => {
    try {
        const result = await runCommand('docker', [
            'exec',
            containerName,
            'cat',
            configPath
        ]);
        // Look for api_key in INI format
        const patterns = [
            /api_key\s*=\s*['"]?([a-f0-9-]+)['"]?/i,
            /apikey\s*=\s*['"]?([a-f0-9-]+)['"]?/i,
            /api_key\s*=\s*(.+)/i,
        ];
        for (const pattern of patterns) {
            const match = result.match(pattern);
            if (match) return match[1].trim();
        }
        return null;
    } catch {
        return null;
    }
};

/**
 * Extract API key from container environment variables
 */
const extractFromEnv = async (containerName: string, envKeys: string[]): Promise<string | null> => {
    try {
        const result = await runCommand('docker', [
            'inspect',
            '-f',
            '{{range .Config.Env}}{{println .}}{{end}}',
            containerName
        ]);

        for (const envKey of envKeys) {
            const pattern = new RegExp(`^${envKey}=(.+)$`, 'm');
            const match = result.match(pattern);
            if (match) return match[1].trim();
        }
        return null;
    } catch {
        return null;
    }
};

/**
 * Extract Plex token from Preferences.xml
 */
const extractPlexToken = async (containerName: string): Promise<string | null> => {
    try {
        const result = await runCommand('docker', [
            'exec',
            containerName,
            'cat',
            '/config/Library/Application Support/Plex Media Server/Preferences.xml'
        ]);
        const match = result.match(/PlexOnlineToken="([^"]+)"/);
        return match ? match[1] : null;
    } catch {
        return null;
    }
};

/**
 * Extract qBittorrent Web UI password
 */
const extractQbitPassword = async (containerName: string): Promise<string | null> => {
    try {
        // First try to get from environment
        const envResult = await extractFromEnv(containerName, ['WEBUI_PASSWORD', 'QBT_PASSWORD']);
        if (envResult) return envResult;

        // Try config file
        const result = await runCommand('docker', [
            'exec',
            containerName,
            'cat',
            '/config/qBittorrent/qBittorrent.conf'
        ]);
        // Note: qBittorrent stores hashed password, return indicator that it's configured
        if (result.includes('WebUI\\Password')) {
            return '[CONFIGURED]';
        }
        return null;
    } catch {
        return null;
    }
};

/**
 * Extract NZBGet password from config
 */
const extractNzbgetPassword = async (containerName: string, configPath: string): Promise<string | null> => {
    try {
        const result = await runCommand('docker', [
            'exec',
            containerName,
            'cat',
            configPath
        ]);
        const match = result.match(/ControlPassword=(.+)/);
        return match ? match[1].trim() : null;
    } catch {
        return null;
    }
};

/**
 * Extract API key from a service
 */
export const extractArrApiKey = async (service: ArrServiceInfo, containerName: string): Promise<string | null> => {
    try {
        switch (service.configType) {
            case 'xml':
                return await extractFromXml(containerName, service.configPath!);

            case 'yaml':
                return await extractFromYaml(containerName, service.configPath!);

            case 'json':
                return await extractFromJson(containerName, service.configPath!);

            case 'ini':
                return await extractFromIni(containerName, service.configPath!);

            case 'env': {
                const envKeys = [
                    `${service.id.toUpperCase()}_API_KEY`,
                    `${service.id.toUpperCase()}_APIKEY`,
                    'API_KEY',
                    'APIKEY',
                ];
                return await extractFromEnv(containerName, envKeys);
            }

            case 'custom':
                // Handle special cases
                if (service.id === 'plex') {
                    return await extractPlexToken(containerName);
                }
                if (service.id === 'qbittorrent') {
                    return await extractQbitPassword(containerName);
                }
                if (service.id === 'nzbget') {
                    return await extractNzbgetPassword(containerName, service.configPath!);
                }
                return null;

            default:
                return null;
        }
    } catch {
        return null;
    }
};

/**
 * Extract all API keys from all running containers
 */
export const extractArrKeys = async (): Promise<Record<string, string>> => {
    logger.info('Starting API key extraction from containers...');
    const results: Record<string, string> = {};

    // First check if any containers are running at all (fast failure)
    const runningContainers = await getRunningContainers();
    if (runningContainers.length === 0) {
        logger.warn('No running containers found, aborting extraction');
        return results; // No containers running, return empty
    }

    logger.info({ containerCount: runningContainers.length }, 'Found running containers, scanning for API keys...');

    // Create a set of running container names for fast lookup
    const runningSet = new Set(runningContainers.map(c => c.toLowerCase()));

    for (const service of ARR_SERVICES) {
        // Quick check if any variant of this service might be running
        const possibleNames = [service.id, ...(service.aliases || [])];
        const mightBeRunning = possibleNames.some(name =>
            runningSet.has(name.toLowerCase()) ||
            runningContainers.some(c => c.toLowerCase().includes(name.toLowerCase()))
        );

        if (!mightBeRunning) continue; // Skip services that definitely aren't running

        const containerName = await findContainerName(service, runningContainers);
        if (!containerName) continue;

        logger.debug({ service: service.id, container: containerName }, 'Extracting API key...');
        const key = await extractArrApiKey(service, containerName);
        if (key) {
            logger.info({ service: service.id, envKey: service.envKey }, 'Successfully extracted API key');
            results[service.envKey] = key;
        } else {
            logger.debug({ service: service.id, container: containerName }, 'No API key found');
        }
    }

    // Try to discover and extract from unknown *arr containers
    const unknownContainers = await discoverAdditionalContainers();
    if (unknownContainers.length > 0) {
        logger.info({ count: unknownContainers.length, containers: unknownContainers }, 'Discovered unknown *arr containers');
    }
    for (const container of unknownContainers) {
        // Try XML extraction (most common for *arr apps)
        const key = await extractFromXml(container, '/config/config.xml');
        if (key) {
            const envKey = `${container.toUpperCase().replace(/-/g, '_')}_API_KEY`;
            logger.info({ container, envKey }, 'Extracted API key from unknown container');
            results[envKey] = key;
        }
    }

    logger.info({ keyCount: Object.keys(results).length, keys: Object.keys(results) }, 'API key extraction complete');
    return results;
};

/**
 * Get detailed extraction results with container info
 */
export const extractArrKeysDetailed = async (): Promise<ExtractedKey[]> => {
    const results: ExtractedKey[] = [];

    const runningContainers = await getRunningContainers();

    for (const service of ARR_SERVICES) {
        const containerName = await findContainerName(service, runningContainers);
        if (!containerName) continue;

        const key = await extractArrApiKey(service, containerName);
        if (key) {
            results.push({
                service: service.id,
                envKey: service.envKey,
                value: key,
                containerName
            });
        }
    }

    // Discover unknown containers
    const unknownContainers = await discoverAdditionalContainers();
    for (const container of unknownContainers) {
        const key = await extractFromXml(container, '/config/config.xml');
        if (key) {
            results.push({
                service: container,
                envKey: `${container.toUpperCase().replace(/-/g, '_')}_API_KEY`,
                value: key,
                containerName: container
            });
        }
    }

    return results;
};

export const writeArrKeysToEnv = (keys: Record<string, string>): void => {
    const keyCount = Object.keys(keys).length;
    if (keyCount === 0) {
        logger.debug('No keys to write to .env');
        return;
    }

    logger.info({ keyCount }, 'Writing API keys to .env file...');
    for (const [envKey, envValue] of Object.entries(keys)) {
        try {
            setEnvValue(envKey, envValue);
            logger.debug({ envKey }, 'Wrote key to .env');
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            logger.error({ envKey, error: message }, 'Failed to write key to .env');
        }
    }
    logger.info({ keyCount }, 'Finished writing API keys to .env');
};

/**
 * Iterates through all known services, extracts their keys, and updates .env
 */
export const bootstrapArrKeys = async (): Promise<Record<string, string>> => {
    logger.info('Starting full bootstrap: extract + write to .env');
    const keys = await extractArrKeys();
    writeArrKeysToEnv(keys);
    logger.info({ keyCount: Object.keys(keys).length }, 'Bootstrap complete');
    return keys;
};
