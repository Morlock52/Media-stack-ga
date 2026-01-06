/**
 * Arr Service Interconnection Knowledge Module
 * Comprehensive knowledge base for diagnosing and fixing Sonarr/Radarr/Prowlarr/qBittorrent interconnection issues
 * Covers API key problems, URL configuration, category mapping, and import failures
 */

import { createLogger } from '../utils/logger.js';
import { getErrorMessage } from '../utils/errors.js';

const logger = createLogger('arrInterconnectionKnowledge');

/** Severity level for issues */
export type IssueSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';

/** Arr service types */
export type ArrService = 'sonarr' | 'radarr' | 'prowlarr' | 'lidarr' | 'readarr' | 'bazarr';

/** Download client types */
export type DownloadClient = 'qbittorrent' | 'transmission' | 'deluge' | 'sabnzbd' | 'nzbget';

/** Diagnostic step */
export interface DiagnosticStep {
    /** Step number */
    order: number;
    /** Description of what to check */
    description: string;
    /** Command to run (if applicable) */
    command?: string;
    /** Expected result */
    expectedResult?: string;
    /** How to interpret the result */
    interpretation?: string;
}

/** Solution to an issue */
export interface Solution {
    /** Solution title */
    title: string;
    /** Detailed explanation */
    description: string;
    /** Steps to implement the solution */
    steps: string[];
    /** Configuration example (if applicable) */
    configExample?: string;
    /** Environment variables to set */
    envVars?: Record<string, string>;
    /** Whether this requires container restart */
    requiresRestart: boolean;
    /** Additional notes or warnings */
    notes?: string;
}

/** Arr interconnection issue pattern */
export interface ArrInterconnectionIssuePattern {
    /** Unique issue identifier */
    id: string;
    /** Issue title */
    title: string;
    /** Detailed description */
    description: string;
    /** Severity level */
    severity: IssueSeverity;
    /** Symptoms to look for */
    symptoms: string[];
    /** Log patterns that indicate this issue (regex) */
    logPatterns?: string[];
    /** Which services this affects */
    affectedServices?: Array<ArrService | DownloadClient>;
    /** Diagnostic steps */
    diagnostics: DiagnosticStep[];
    /** Possible solutions */
    solutions: Solution[];
    /** Related issues */
    relatedIssues?: string[];
    /** Tags for searching */
    tags: string[];
}

/**
 * Arr Interconnection Troubleshooting Knowledge Base
 */
export const ARR_INTERCONNECTION_KB: ArrInterconnectionIssuePattern[] = [
    {
        id: 'api-key-invalid',
        title: 'Invalid or missing API key',
        description: 'Services cannot authenticate with each other due to incorrect, missing, or mismatched API keys. This is the most common interconnection issue.',
        severity: 'high',
        symptoms: [
            'Test connection fails with "Unauthorized" error',
            'API key not accepted',
            '401 Unauthorized in logs',
            'Connection test shows "Invalid API Key"',
            'Prowlarr cannot add Sonarr/Radarr as app'
        ],
        logPatterns: [
            '401.*Unauthorized',
            'API.*key.*invalid',
            'authentication.*failed',
            'Unauthorized.*API',
            'Invalid API Key'
        ],
        affectedServices: ['sonarr', 'radarr', 'prowlarr', 'lidarr', 'readarr'],
        diagnostics: [
            {
                order: 1,
                description: 'Locate API key in source service',
                expectedResult: 'Find API key in Settings → General → Security section',
                interpretation: 'Each *Arr app generates a unique API key on first start. This key is required for all API access.'
            },
            {
                order: 2,
                description: 'Verify API key format',
                expectedResult: 'API key should be a 32-character alphanumeric string',
                interpretation: 'If key is shorter, corrupted, or contains special characters, it may be invalid.'
            },
            {
                order: 3,
                description: 'Test API manually with curl',
                command: 'curl -H "X-Api-Key: YOUR_API_KEY" http://sonarr:8989/api/v3/system/status',
                expectedResult: 'Should return JSON with system status',
                interpretation: 'If this works, API key is valid but may be misconfigured in other service.'
            },
            {
                order: 4,
                description: 'Check if API key has changed',
                expectedResult: 'API keys persist unless config is reset or manually regenerated',
                interpretation: 'If container was recreated without volume persistence, API key may have changed.'
            }
        ],
        solutions: [
            {
                title: 'Copy correct API key',
                description: 'Retrieve and use the exact API key from the source service',
                steps: [
                    'Open source service web UI (e.g., Sonarr at http://localhost:8989)',
                    'Go to Settings → General → Security',
                    'Click the eye icon to reveal API Key',
                    'Copy the entire key (select all and copy)',
                    'Paste into the connecting service exactly as shown',
                    'Ensure no extra spaces or characters',
                    'Test connection'
                ],
                configExample: `# In Prowlarr, adding Sonarr as application:
# 1. Settings → Apps → Add → Sonarr
# 2. Fill in:
Name: Sonarr
Prowlarr Server: http://prowlarr:9696
Sonarr Server: http://sonarr:8989
API Key: [paste from Sonarr Settings → General → API Key]`,
                requiresRestart: false,
                notes: 'API keys are case-sensitive. Copy-paste to avoid typos. Do not include the label "API Key:" only the value.'
            },
            {
                title: 'Regenerate API key if corrupted',
                description: 'Generate a new API key if current one is invalid',
                steps: [
                    'In the source service, go to Settings → General → Security',
                    'Click the regenerate icon next to API Key',
                    'Confirm regeneration',
                    'Copy the new API key',
                    'Update all services that connect to this app with new key',
                    'Test all connections'
                ],
                requiresRestart: false,
                notes: 'Regenerating API key will break all existing integrations. Update all connected services with new key.'
            },
            {
                title: 'Persist API key with Docker volume',
                description: 'Ensure API keys survive container recreation',
                steps: [
                    'Map config directory to Docker volume',
                    'Verify volume path in docker-compose.yml',
                    'Config should persist in /config directory',
                    'API key stored in config.xml file'
                ],
                configExample: `services:
  sonarr:
    image: linuxserver/sonarr
    volumes:
      - ./sonarr-config:/config  # Config persists here
    # API key in ./sonarr-config/config.xml will survive restarts`,
                requiresRestart: false,
                notes: 'Without persistent volume, API keys regenerate on every container recreation.'
            }
        ],
        relatedIssues: ['url-connection-failed', 'test-connection-timeout'],
        tags: ['api-key', 'authentication', 'unauthorized', '401', 'prowlarr', 'sonarr', 'radarr']
    },
    {
        id: 'url-connection-failed',
        title: 'Cannot connect to service URL',
        description: 'Services cannot reach each other due to incorrect URL, DNS resolution failure, or network configuration issues.',
        severity: 'high',
        symptoms: [
            'Connection test fails with timeout',
            'Unable to connect to remote host',
            'DNS resolution failed',
            'Connection refused',
            'No route to host',
            'Service unreachable'
        ],
        logPatterns: [
            'connection.*timeout',
            'unable to connect',
            'connection refused',
            'no route to host',
            'could not resolve',
            'Name or service not known',
            'HttpRequestException'
        ],
        affectedServices: ['sonarr', 'radarr', 'prowlarr', 'qbittorrent'],
        diagnostics: [
            {
                order: 1,
                description: 'Verify URL format',
                expectedResult: 'URL should be http://servicename:port (e.g., http://sonarr:8989)',
                interpretation: 'Common mistakes: using https instead of http, localhost instead of service name, wrong port.'
            },
            {
                order: 2,
                description: 'Test DNS resolution between containers',
                command: 'docker exec prowlarr nslookup sonarr',
                expectedResult: 'Should resolve to IP address of sonarr container',
                interpretation: 'If DNS fails, containers not on same network or name is wrong.'
            },
            {
                order: 3,
                description: 'Test HTTP connectivity',
                command: 'docker exec prowlarr curl -I http://sonarr:8989',
                expectedResult: 'Should return HTTP headers',
                interpretation: 'If fails after DNS works, service not listening or port is wrong.'
            },
            {
                order: 4,
                description: 'Check service is actually running',
                command: 'docker ps | grep sonarr',
                expectedResult: 'Container should be running and healthy',
                interpretation: 'If container not running or restarting, fix that issue first.'
            },
            {
                order: 5,
                description: 'Verify network mode configuration',
                command: 'docker inspect sonarr --format "{{.HostConfig.NetworkMode}}"',
                expectedResult: 'Should be bridge or custom network, not container:X',
                interpretation: 'If using container network mode, URL must point to the shared network container.'
            }
        ],
        solutions: [
            {
                title: 'Use correct container name as hostname',
                description: 'Replace localhost or IP with Docker service name',
                steps: [
                    'Identify service name from docker-compose.yml',
                    'Use http://servicename:port format',
                    'For Sonarr: http://sonarr:8989',
                    'For Radarr: http://radarr:7878',
                    'For Prowlarr: http://prowlarr:9696',
                    'For qBittorrent: http://qbittorrent:8080 (or gluetun:8080 if using VPN)',
                    'Test connection'
                ],
                configExample: `# In Prowlarr Applications settings:
# WRONG:
Sonarr URL: http://localhost:8989  # Will not work across containers

# CORRECT:
Sonarr URL: http://sonarr:8989  # Uses Docker DNS

# If Sonarr uses VPN (network_mode: service:gluetun):
Sonarr URL: http://gluetun:8989  # Use VPN container name`,
                requiresRestart: false,
                notes: 'Never use localhost or 127.0.0.1 when connecting between containers. Use service names from docker-compose.yml.'
            },
            {
                title: 'Fix VPN network mode URLs',
                description: 'Adjust URLs when services use VPN container network',
                steps: [
                    'Identify which services use network_mode: "service:gluetun"',
                    'For services sharing VPN network, use VPN container name',
                    'Example: qBittorrent using Gluetun network',
                    'URL becomes http://gluetun:8080 NOT http://qbittorrent:8080',
                    'Update all *Arr download client settings'
                ],
                configExample: `# docker-compose.yml shows:
qbittorrent:
  network_mode: "service:gluetun"

# In Sonarr/Radarr Download Client settings:
Host: gluetun  # NOT qbittorrent or localhost
Port: 8080     # qBittorrent port published on gluetun
URL Base: /    # Usually leave empty`,
                requiresRestart: false,
                notes: 'Services using container:X or service:X network mode are accessed via the X container name.'
            },
            {
                title: 'Ensure services on same Docker network',
                description: 'Put all *Arr services on the same Docker network for DNS resolution',
                steps: [
                    'Use docker-compose for automatic network creation',
                    'All services in same docker-compose.yml share network by default',
                    'Or explicitly create custom network',
                    'Verify with: docker network inspect <network_name>'
                ],
                configExample: `# Automatic (recommended):
services:
  sonarr:
    # No network specified - uses default compose network
  radarr:
    # Same network as sonarr automatically
  prowlarr:
    # Can reach both sonarr and radarr by name

# Manual custom network:
services:
  sonarr:
    networks:
      - arr-network
  radarr:
    networks:
      - arr-network

networks:
  arr-network:
    driver: bridge`,
                requiresRestart: true,
                notes: 'Docker Compose automatically creates a network. Only specify networks if you need custom configuration.'
            },
            {
                title: 'Use URL base if configured',
                description: 'Include URL base path if service has one configured',
                steps: [
                    'Check if service has URL Base set in Settings → General',
                    'If URL Base is /sonarr, full URL becomes http://sonarr:8989/sonarr',
                    'Most default installs have empty URL Base',
                    'Only needed for reverse proxy setups'
                ],
                configExample: `# If Sonarr has URL Base set to /sonarr:
# In Prowlarr:
Sonarr URL: http://sonarr:8989/sonarr

# Default (no URL Base):
Sonarr URL: http://sonarr:8989`,
                requiresRestart: false,
                notes: 'URL Base is usually empty unless using reverse proxy like Nginx or Traefik.'
            }
        ],
        relatedIssues: ['api-key-invalid', 'test-connection-timeout', 'download-client-unreachable'],
        tags: ['url', 'connection', 'dns', 'network', 'hostname', 'service-name']
    },
    {
        id: 'download-client-unreachable',
        title: 'Download client unreachable or connection failed',
        description: 'Sonarr/Radarr cannot connect to qBittorrent, Transmission, or other download clients.',
        severity: 'high',
        symptoms: [
            'Test download client connection fails',
            'Unable to connect to qBittorrent',
            'Download client not responding',
            'Cannot add torrent to download client',
            'Connection timed out',
            'WebUI works but *Arr cannot connect'
        ],
        logPatterns: [
            'download client.*unreachable',
            'qBittorrent.*connection',
            'unable to connect.*download',
            'timeout.*download client',
            'HttpRequestException.*download'
        ],
        affectedServices: ['sonarr', 'radarr', 'lidarr', 'qbittorrent'],
        diagnostics: [
            {
                order: 1,
                description: 'Verify download client is running',
                command: 'docker ps | grep qbittorrent',
                expectedResult: 'Container should be running',
                interpretation: 'If not running or restarting, fix download client issues first.'
            },
            {
                order: 2,
                description: 'Check download client web UI is accessible',
                expectedResult: 'Should be able to open qBittorrent WebUI in browser',
                interpretation: 'If WebUI does not load, port mapping or service issue.'
            },
            {
                order: 3,
                description: 'Test connectivity from *Arr container',
                command: 'docker exec sonarr curl -I http://qbittorrent:8080',
                expectedResult: 'Should return HTTP headers',
                interpretation: 'If this fails but WebUI works from browser, network configuration issue.'
            },
            {
                order: 4,
                description: 'Verify credentials are correct',
                expectedResult: 'Username and password should match qBittorrent settings',
                interpretation: 'Default qBittorrent username is "admin", password is "adminadmin" (should be changed).'
            },
            {
                order: 5,
                description: 'Check if bypass authentication is enabled',
                expectedResult: 'In qBittorrent → Tools → Options → Web UI → Bypass authentication for localhost',
                interpretation: 'This setting can cause issues. Disable it and use proper credentials.'
            }
        ],
        solutions: [
            {
                title: 'Configure download client with correct hostname',
                description: 'Set up download client connection in Sonarr/Radarr',
                steps: [
                    'In *Arr: Settings → Download Clients → Add → qBittorrent',
                    'Name: qBittorrent (or any name)',
                    'Host: Use container name (qbittorrent or gluetun if VPN)',
                    'Port: 8080 (default qBittorrent port)',
                    'Username: admin (or your configured username)',
                    'Password: (your qBittorrent password)',
                    'Category: tv (for Sonarr), movies (for Radarr)',
                    'Test connection - should succeed',
                    'Save'
                ],
                configExample: `# Sonarr Download Client settings:
Name: qBittorrent
Host: qbittorrent  # Or gluetun if qBit uses VPN network
Port: 8080
Username: admin
Password: yourpassword
Category: tv  # For Sonarr
Use SSL: No  # Usually unchecked for local
URL Base: /  # Usually empty

# Test connection before saving`,
                requiresRestart: false,
                notes: 'If qBittorrent uses VPN network mode, host must be the VPN container name (e.g., gluetun).'
            },
            {
                title: 'Fix qBittorrent authentication settings',
                description: 'Configure qBittorrent to accept API connections',
                steps: [
                    'Open qBittorrent WebUI',
                    'Go to Tools → Options → Web UI',
                    'Set Username and Password',
                    'DISABLE "Bypass authentication for clients on localhost"',
                    'Enable "Enable Host header validation" for security',
                    'Save settings',
                    'Update *Arr with these credentials'
                ],
                configExample: `# qBittorrent Web UI settings:
# Tools → Options → Web UI
Username: admin  # Or your choice
Password: [strong password]
☐ Bypass authentication for clients on localhost  # UNCHECK THIS
☑ Enable Host header validation

# Then use these credentials in Sonarr/Radarr`,
                requiresRestart: false,
                notes: 'Bypass authentication causes issues with Docker networking. Always use proper credentials.'
            },
            {
                title: 'Set correct category in download client',
                description: 'Configure categories for proper organization',
                steps: [
                    'In qBittorrent, categories are auto-created by *Arr apps',
                    'Sonarr should use category "tv" or "sonarr"',
                    'Radarr should use category "movies" or "radarr"',
                    'Categories help organize downloads and imports',
                    'Set in Download Client settings in each *Arr app'
                ],
                configExample: `# In Sonarr Download Client:
Category: tv

# In Radarr Download Client:
Category: movies

# qBittorrent will create these categories automatically
# Downloads appear in respective categories in qBit WebUI`,
                requiresRestart: false,
                notes: 'Using categories prevents import conflicts when multiple *Arr apps use same download client.'
            },
            {
                title: 'Handle VPN network mode correctly',
                description: 'Configure download client connection when using VPN',
                steps: [
                    'If qBittorrent uses network_mode: "service:gluetun"',
                    'Access qBittorrent at http://gluetun:8080',
                    'NOT http://qbittorrent:8080',
                    'Update all *Arr download client settings to use gluetun hostname',
                    'Test connection'
                ],
                configExample: `# When docker-compose.yml has:
qbittorrent:
  network_mode: "service:gluetun"

# In Sonarr/Radarr Download Client:
Host: gluetun  # NOT qbittorrent
Port: 8080

# From browser (host machine):
http://localhost:8080  # Port mapped on gluetun service`,
                requiresRestart: false,
                notes: 'VPN network mode means qBittorrent shares Gluetun network stack. Use Gluetun hostname.'
            }
        ],
        relatedIssues: ['url-connection-failed', 'category-mapping-failed', 'import-failed-no-files'],
        tags: ['download-client', 'qbittorrent', 'transmission', 'connection', 'authentication']
    },
    {
        id: 'prowlarr-sync-failed',
        title: 'Prowlarr cannot sync indexers to Sonarr/Radarr',
        description: 'Prowlarr successfully connects to Sonarr/Radarr but indexers are not syncing, or sync fails with errors.',
        severity: 'medium',
        symptoms: [
            'Indexers not appearing in Sonarr/Radarr',
            'Sync fails with error',
            'Connection test passes but no indexers',
            'Prowlarr shows synced but Sonarr/Radarr empty',
            'Only some indexers sync'
        ],
        logPatterns: [
            'sync.*failed',
            'indexer.*sync',
            'application.*sync.*error',
            'unable to sync'
        ],
        affectedServices: ['prowlarr', 'sonarr', 'radarr'],
        diagnostics: [
            {
                order: 1,
                description: 'Verify Prowlarr application connection',
                expectedResult: 'In Prowlarr: Settings → Apps, connection test should succeed',
                interpretation: 'If test fails, fix API key or URL issues first.'
            },
            {
                order: 2,
                description: 'Check Prowlarr sync settings',
                expectedResult: 'In Prowlarr app settings, "Sync Categories" should be enabled',
                interpretation: 'Without sync enabled, indexers will not push to *Arr apps.'
            },
            {
                order: 3,
                description: 'Verify indexers are enabled in Prowlarr',
                expectedResult: 'Indexers → each indexer should have checkmark (enabled)',
                interpretation: 'Disabled indexers do not sync.'
            },
            {
                order: 4,
                description: 'Check Prowlarr logs for sync errors',
                command: 'docker logs prowlarr | grep -i "sync\\|error"',
                expectedResult: 'Should show sync activity and any errors',
                interpretation: 'Logs reveal specific sync failures and API errors.'
            },
            {
                order: 5,
                description: 'Verify indexer categories match *Arr type',
                expectedResult: 'TV indexers for Sonarr, Movie indexers for Radarr',
                interpretation: 'Prowlarr only syncs indexers with matching categories.'
            }
        ],
        solutions: [
            {
                title: 'Enable full sync in Prowlarr app settings',
                description: 'Configure Prowlarr to sync all indexers to *Arr apps',
                steps: [
                    'In Prowlarr: Settings → Apps → [Your App]',
                    'Enable "Sync Level: Full Sync"',
                    'Enable sync categories appropriate for the app:',
                    '  - For Sonarr: Enable TV categories',
                    '  - For Radarr: Enable Movie categories',
                    'Click Test then Save',
                    'Trigger manual sync or wait for automatic sync'
                ],
                configExample: `# Prowlarr → Settings → Apps → Sonarr
Name: Sonarr
Sync Level: Full Sync  # Important!
Prowlarr Server: http://prowlarr:9696
Sonarr Server: http://sonarr:8989
API Key: [Sonarr API key]

# Sync Categories:
☑ TV/SD
☑ TV/HD
☑ TV/UHD
☑ TV/Anime (if desired)

Test → Save → Sync`,
                requiresRestart: false,
                notes: 'Full Sync pushes all matching indexers. Disabled Sync means manual indexer management.'
            },
            {
                title: 'Force manual sync from Prowlarr',
                description: 'Manually trigger indexer sync to *Arr apps',
                steps: [
                    'In Prowlarr: Settings → Apps',
                    'Find your application (Sonarr/Radarr)',
                    'Click the sync icon (circular arrows)',
                    'Check Sonarr/Radarr: Settings → Indexers',
                    'Prowlarr-synced indexers should appear',
                    'Look for "(Prowlarr)" tag on indexers'
                ],
                requiresRestart: false,
                notes: 'Sync is also automatic on schedule. Manual sync helps verify it is working.'
            },
            {
                title: 'Check indexer category compatibility',
                description: 'Ensure indexers have correct categories for target app',
                steps: [
                    'In Prowlarr: Indexers → [Your Indexer] → Edit',
                    'Check "Categories" section',
                    'For Sonarr sync: indexer must have TV categories (5000-5999)',
                    'For Radarr sync: indexer must have Movie categories (2000-2999)',
                    'If wrong categories, indexer will not sync to that app',
                    'Some indexers support both TV and Movies'
                ],
                configExample: `# Indexer categories (standardized):
Movies: 2000-2999
TV: 5000-5999
Audio: 3000-3999
Books: 7000-7999

# An indexer with only Movie categories (2000-2999):
- Will sync to Radarr ✓
- Will NOT sync to Sonarr ✗

# An indexer with both TV and Movies:
- Will sync to both Sonarr and Radarr ✓`,
                requiresRestart: false,
                notes: 'Prowlarr uses Torznab/Newznab categories. TV indexers only go to Sonarr, Movie only to Radarr.'
            },
            {
                title: 'Remove and re-add application',
                description: 'Reset Prowlarr application connection',
                steps: [
                    'In Prowlarr: Settings → Apps',
                    'Delete the application (Sonarr/Radarr)',
                    'In Sonarr/Radarr: Settings → Indexers',
                    'Delete all Prowlarr-synced indexers (tagged with Prowlarr)',
                    'Back to Prowlarr: Settings → Apps → Add',
                    'Re-add the application with correct settings',
                    'Test connection',
                    'Save and sync',
                    'Verify indexers appear in *Arr'
                ],
                requiresRestart: false,
                notes: 'This clears any sync state issues. Deleting the app in Prowlarr also removes synced indexers from *Arr.'
            },
            {
                title: 'Check Prowlarr and *Arr versions',
                description: 'Ensure compatible versions are running',
                steps: [
                    'Check Prowlarr version: System → Status',
                    'Check Sonarr/Radarr version: System → Status',
                    'Update to latest versions if outdated',
                    'Prowlarr v1.0+ recommended',
                    'Sonarr v3+ and Radarr v4+ recommended'
                ],
                requiresRestart: false,
                notes: 'Old versions may have sync bugs. Keep all *Arr apps updated to latest stable releases.'
            }
        ],
        relatedIssues: ['api-key-invalid', 'url-connection-failed'],
        tags: ['prowlarr', 'indexer', 'sync', 'sonarr', 'radarr', 'integration']
    },
    {
        id: 'category-mapping-failed',
        title: 'Download client category mapping issues',
        description: 'Downloads not appearing in correct category, or import failing due to category mismatch.',
        severity: 'medium',
        symptoms: [
            'Downloads go to wrong category',
            'Import fails with "No files found"',
            'Category not created in download client',
            'Downloads mixed together',
            'Cannot find files to import'
        ],
        logPatterns: [
            'category.*not found',
            'no.*files.*import',
            'import.*failed.*category'
        ],
        affectedServices: ['sonarr', 'radarr', 'qbittorrent'],
        diagnostics: [
            {
                order: 1,
                description: 'Check category in *Arr download client settings',
                expectedResult: 'Sonarr should use "tv", Radarr should use "movies"',
                interpretation: 'Categories help *Arr find downloads and prevent conflicts.'
            },
            {
                order: 2,
                description: 'Verify category exists in download client',
                expectedResult: 'In qBittorrent, check if category is created',
                interpretation: 'qBittorrent auto-creates categories when first used.'
            },
            {
                order: 3,
                description: 'Check download save path',
                expectedResult: 'Category should have correct save path',
                interpretation: 'Wrong save path means *Arr cannot find downloaded files.'
            },
            {
                order: 4,
                description: 'Verify remote path mapping if needed',
                expectedResult: 'If download client and *Arr see different paths, need remote path mapping',
                interpretation: 'Docker volume mounts can cause path mismatches.'
            }
        ],
        solutions: [
            {
                title: 'Set proper categories in download clients',
                description: 'Configure unique categories for each *Arr app',
                steps: [
                    'In Sonarr: Settings → Download Clients → qBittorrent',
                    'Set Category: tv',
                    'In Radarr: Settings → Download Clients → qBittorrent',
                    'Set Category: movies',
                    'Categories are case-sensitive',
                    'Save settings',
                    'qBittorrent will auto-create categories on first use'
                ],
                configExample: `# Sonarr download client:
Category: tv

# Radarr download client:
Category: movies

# In qBittorrent WebUI:
# Categories will appear automatically when first download starts
# Can also manually create: Right-click category area → Add category`,
                requiresRestart: false,
                notes: 'Using distinct categories prevents Sonarr from trying to import Radarr downloads and vice versa.'
            },
            {
                title: 'Configure category save paths',
                description: 'Set download paths for each category in qBittorrent',
                steps: [
                    'In qBittorrent: Tools → Options → Downloads',
                    'Set "Default Save Path": /downloads',
                    'Enable "Use Category paths"',
                    'Each category will use /downloads/categoryname/',
                    'tv downloads go to /downloads/tv/',
                    'movies downloads go to /downloads/movies/'
                ],
                configExample: `# qBittorrent Options → Downloads:
Default Save Path: /downloads
☑ Use Category paths

# Results in:
tv category → /downloads/tv/
movies category → /downloads/movies/

# Ensure these paths are accessible to Sonarr/Radarr via volumes`,
                requiresRestart: false,
                notes: 'Category paths must be within Docker volume mounts for *Arr to access them.'
            },
            {
                title: 'Set up Docker volume mounts correctly',
                description: 'Ensure download client and *Arr apps share same paths',
                steps: [
                    'All services should mount same downloads directory',
                    'Use consistent paths across all containers',
                    'Avoid nested mounts or different mount points',
                    'Recommended: single /data parent with /data/downloads and /data/media'
                ],
                configExample: `services:
  sonarr:
    volumes:
      - ./data:/data  # Shared data directory

  radarr:
    volumes:
      - ./data:/data  # Same mount point

  qbittorrent:
    volumes:
      - ./data/downloads:/downloads  # Downloads subdirectory
    # Downloads go to ./data/downloads/tv/, ./data/downloads/movies/

# Now Sonarr sees downloads at /data/downloads/tv/
# And qBittorrent sees them at /downloads/tv/
# Paths match!`,
                requiresRestart: true,
                notes: 'Path consistency is crucial. If paths differ between containers, use Remote Path Mapping.'
            },
            {
                title: 'Configure remote path mapping if needed',
                description: 'Map different paths between download client and *Arr',
                steps: [
                    'Only needed if containers see different paths',
                    'In Sonarr/Radarr: Settings → Download Clients → Remote Path Mappings',
                    'Add mapping:',
                    '  - Host: qbittorrent (or download client hostname)',
                    '  - Remote Path: /downloads/ (path qBittorrent sees)',
                    '  - Local Path: /data/downloads/ (path *Arr sees)',
                    'Test download to verify'
                ],
                configExample: `# Remote Path Mapping (only if paths differ):
# qBittorrent saves to: /downloads/tv/ShowName/
# But Sonarr sees that location as: /data/downloads/tv/ShowName/

# In Sonarr → Settings → Download Clients → Remote Path Mappings:
Host: qbittorrent
Remote Path: /downloads/
Local Path: /data/downloads/

# Sonarr will translate paths automatically`,
                requiresRestart: false,
                notes: 'Remote path mapping is a workaround. Better solution is to use consistent volume mounts.'
            }
        ],
        relatedIssues: ['import-failed-no-files', 'download-client-unreachable'],
        tags: ['category', 'mapping', 'qbittorrent', 'downloads', 'import', 'path']
    },
    {
        id: 'import-failed-no-files',
        title: 'Import failed - No files found eligible for import',
        description: 'Download completes successfully but Sonarr/Radarr cannot import the files. This is often due to path mismatches or permission issues.',
        severity: 'high',
        symptoms: [
            'Download shows complete in qBittorrent',
            '*Arr shows "No files found eligible for import"',
            'Import fails repeatedly',
            'Downloaded files not moving to library',
            'Activity shows completed download stuck'
        ],
        logPatterns: [
            'No files found.*eligible',
            'import.*failed',
            'no.*files.*found',
            'path.*not.*accessible'
        ],
        affectedServices: ['sonarr', 'radarr', 'lidarr'],
        diagnostics: [
            {
                order: 1,
                description: 'Verify download completed successfully',
                expectedResult: 'In qBittorrent, torrent should show 100% with seeding status',
                interpretation: 'If not complete, wait for download to finish.'
            },
            {
                order: 2,
                description: 'Check if *Arr can see download directory',
                command: 'docker exec sonarr ls -la /downloads/tv/',
                expectedResult: 'Should list downloaded files',
                interpretation: 'If directory empty or not found, volume mount or path issue.'
            },
            {
                order: 3,
                description: 'Verify file permissions',
                command: 'docker exec sonarr ls -la /downloads/tv/',
                expectedResult: 'Files should be readable by *Arr user (typically 1000:1000 or 13001:13001)',
                interpretation: 'Permission denied errors prevent import.'
            },
            {
                order: 4,
                description: 'Check *Arr logs for specific error',
                command: 'docker logs sonarr | tail -50',
                expectedResult: 'Should show import attempt and specific failure reason',
                interpretation: 'Logs reveal if issue is paths, permissions, naming, or quality profile.'
            },
            {
                order: 5,
                description: 'Verify quality profile matches downloaded quality',
                expectedResult: 'Downloaded quality should meet *Arr quality profile requirements',
                interpretation: 'If quality not acceptable, import will fail.'
            }
        ],
        solutions: [
            {
                title: 'Fix volume mount paths',
                description: 'Ensure *Arr and download client share same path to downloads',
                steps: [
                    'Verify docker-compose.yml volume mounts',
                    'Both *Arr and download client should mount same directory',
                    'Use atomic moves (same filesystem) not copy+delete',
                    'Recommended: single /data mount for all'
                ],
                configExample: `# CORRECT - shared data volume:
services:
  sonarr:
    volumes:
      - ./data:/data
    environment:
      - PUID=1000
      - PGID=1000

  qbittorrent:
    volumes:
      - ./data:/data
    environment:
      - PUID=1000
      - PGID=1000

# In qBittorrent: Downloads save to /data/downloads/tv/
# In Sonarr: Can access /data/downloads/tv/ and move to /data/media/tv/
# Same filesystem = instant atomic moves`,
                requiresRestart: true,
                notes: 'Shared data directory enables atomic moves (instant) instead of slow copy operations.'
            },
            {
                title: 'Fix file permissions with PUID/PGID',
                description: 'Set matching user IDs across all containers',
                steps: [
                    'Choose a user ID (typically 1000 or your host user ID)',
                    'Set PUID and PGID environment variables for all containers',
                    'Sonarr, Radarr, qBittorrent should all use same PUID/PGID',
                    'Restart all containers',
                    'Files created by qBittorrent will be readable by *Arr'
                ],
                configExample: `services:
  sonarr:
    environment:
      - PUID=1000
      - PGID=1000

  radarr:
    environment:
      - PUID=1000
      - PGID=1000

  qbittorrent:
    environment:
      - PUID=1000
      - PGID=1000

# All containers run as same user
# Files are readable/writable by all services`,
                envVars: {
                    'PUID': '1000',
                    'PGID': '1000'
                },
                requiresRestart: true,
                notes: 'PUID/PGID must match across all containers that need to access shared files. Use your host user ID.'
            },
            {
                title: 'Check download naming and structure',
                description: 'Ensure downloaded files meet *Arr parsing requirements',
                steps: [
                    'Download folder should contain video files with proper naming',
                    'Sonarr expects: Show.Name.S01E01.Quality.mkv',
                    'Radarr expects: Movie.Name.Year.Quality.mkv',
                    'If files buried in subdirectories, may not be detected',
                    'Check Settings → Media Management → File Management',
                    'Enable "Use hardlinks instead of Copy" for efficiency'
                ],
                configExample: `# Good structure:
/downloads/tv/Show.Name.S01E01.1080p.WEB-DL.mkv  ✓

/downloads/movies/Movie.Name.2023.1080p.BluRay.mkv  ✓

# Bad structure (too nested):
/downloads/tv/torrent_folder/subfolder/video.mkv  ✗

# In *Arr Settings → Media Management:
☑ Use hardlinks instead of Copy  # Saves space, instant
☑ Unmonitor deleted episodes/movies
Episode Naming: Your preference`,
                requiresRestart: false,
                notes: 'Hardlinks require download and library on same filesystem. Use shared /data mount.'
            },
            {
                title: 'Verify quality profile allows import',
                description: 'Check that downloaded quality meets profile requirements',
                steps: [
                    'In *Arr: Settings → Profiles → Quality Profiles',
                    'Check which qualities are enabled',
                    'Downloaded file quality must be in allowed list',
                    'Example: if only 1080p+ enabled, 720p downloads will not import',
                    'Edit profile to include desired qualities'
                ],
                configExample: `# Settings → Profiles → Quality Profiles → [Profile]
# Make sure downloaded quality is checked:
☑ HDTV-720p
☑ WEBDL-720p
☑ HDTV-1080p
☑ WEBDL-1080p
☑ Bluray-1080p

# If you downloaded 720p but only 1080p+ is checked:
# Import will fail with "quality not wanted"`,
                requiresRestart: false,
                notes: 'Quality profile is per series/movie. Check both global profile and specific item settings.'
            },
            {
                title: 'Manually import if automatic fails',
                description: 'Use manual import to troubleshoot and complete import',
                steps: [
                    'In *Arr: Activity → Queue → Completed',
                    'Click "Manual Import" on failed import',
                    'Browse to download directory',
                    'Select files to import',
                    'Verify series/movie mapping is correct',
                    'Check quality detection',
                    'Click Import Selected',
                    'Review results and fix any detected issues'
                ],
                requiresRestart: false,
                notes: 'Manual import shows exactly why automatic import failed. Use it to diagnose naming, quality, or mapping issues.'
            }
        ],
        relatedIssues: ['category-mapping-failed', 'permissions-issue'],
        tags: ['import', 'no-files', 'download', 'permissions', 'path', 'quality']
    },
    {
        id: 'test-connection-timeout',
        title: 'Test connection timeout',
        description: 'Connection test times out when adding services, even though URLs and API keys appear correct.',
        severity: 'medium',
        symptoms: [
            'Test connection times out after 30+ seconds',
            'No response from service',
            'Eventually fails with timeout error',
            'Service is accessible from browser but test fails'
        ],
        logPatterns: [
            'timeout',
            'timed out',
            'request timeout',
            'operation.*timeout'
        ],
        affectedServices: ['sonarr', 'radarr', 'prowlarr', 'qbittorrent'],
        diagnostics: [
            {
                order: 1,
                description: 'Verify service is responsive',
                command: 'docker exec prowlarr curl -I -m 5 http://sonarr:8989',
                expectedResult: 'Should return headers within 5 seconds',
                interpretation: 'If this times out, network or service performance issue.'
            },
            {
                order: 2,
                description: 'Check service CPU and memory',
                command: 'docker stats --no-stream',
                expectedResult: 'Service should not be at 100% CPU or out of memory',
                interpretation: 'High resource usage causes slow responses and timeouts.'
            },
            {
                order: 3,
                description: 'Verify network between containers',
                command: 'docker exec prowlarr ping -c 3 sonarr',
                expectedResult: 'Should have low latency (<10ms)',
                interpretation: 'High ping times indicate network congestion or misconfiguration.'
            },
            {
                order: 4,
                description: 'Check for firewall or rate limiting',
                expectedResult: 'No iptables rules blocking inter-container traffic',
                interpretation: 'Firewall rules can cause delays or drops.'
            }
        ],
        solutions: [
            {
                title: 'Increase timeout values',
                description: 'Give services more time to respond (temporary fix)',
                steps: [
                    'Wait longer during test (some services take 20-30 seconds)',
                    'Try test again after service has warmed up',
                    'Check if service is performing initial database operations',
                    'Monitor service logs during test for slow queries'
                ],
                requiresRestart: false,
                notes: 'Timeout is usually symptom of underlying issue. Fix root cause rather than just increasing timeout.'
            },
            {
                title: 'Restart slow service',
                description: 'Restart service that is not responding quickly',
                steps: [
                    'Identify which service is slow (test from other direction)',
                    'Restart the slow service: docker restart <service>',
                    'Wait for service to fully start',
                    'Check logs for errors during startup',
                    'Retry connection test'
                ],
                requiresRestart: true,
                notes: 'Slow startup can be due to database maintenance, large libraries, or resource constraints.'
            },
            {
                title: 'Check and optimize service performance',
                description: 'Ensure services have adequate resources',
                steps: [
                    'Check docker stats for CPU/memory usage',
                    'Increase container memory limits if needed',
                    'Clean up databases (Settings → System → Backup → Housekeeping)',
                    'Remove old history and blacklist entries',
                    'Consider using faster storage for database'
                ],
                configExample: `services:
  sonarr:
    deploy:
      resources:
        limits:
          memory: 2G  # Increase if needed
        reservations:
          memory: 512M`,
                requiresRestart: false,
                notes: 'Large libraries with many items can slow down *Arr apps. Regular housekeeping helps.'
            },
            {
                title: 'Fix network configuration',
                description: 'Ensure proper network setup between containers',
                steps: [
                    'Verify all services on same Docker network',
                    'Check for network loops or misconfigurations',
                    'Ensure Docker bridge network is healthy',
                    'Restart Docker if network issues persist: sudo systemctl restart docker'
                ],
                requiresRestart: true,
                notes: 'Network issues are rare but can cause timeouts. Usually indicates misconfiguration.'
            }
        ],
        relatedIssues: ['url-connection-failed', 'download-client-unreachable'],
        tags: ['timeout', 'performance', 'slow', 'connection', 'test']
    },
    {
        id: 'indexer-search-failed',
        title: 'Indexer search failures or no results',
        description: 'Searches return no results, indexers fail to respond, or "All search requests failed" errors occur.',
        severity: 'medium',
        symptoms: [
            'Search returns 0 results',
            'All indexers fail',
            'Some indexers timeout',
            'Indexer unavailable errors',
            'Search capability warnings'
        ],
        logPatterns: [
            'indexer.*failed',
            'search.*failed',
            'no results.*indexer',
            'indexer.*unavailable',
            'timeout.*indexer'
        ],
        affectedServices: ['sonarr', 'radarr', 'prowlarr'],
        diagnostics: [
            {
                order: 1,
                description: 'Test individual indexers',
                expectedResult: 'In Settings → Indexers, test each indexer individually',
                interpretation: 'Identify which indexers work and which fail.'
            },
            {
                order: 2,
                description: 'Check Prowlarr indexer status',
                expectedResult: 'Prowlarr should show indexers as green/healthy',
                interpretation: 'If indexers red in Prowlarr, issue is with indexer configuration or availability.'
            },
            {
                order: 3,
                description: 'Verify VPN connection for indexers',
                expectedResult: 'If using VPN, verify Prowlarr routes through VPN',
                interpretation: 'Some indexers block non-VPN connections or specific countries.'
            },
            {
                order: 4,
                description: 'Check indexer search capabilities',
                expectedResult: 'Indexer must support search type being used (TV search, Movie search)',
                interpretation: 'Not all indexers support all search types.'
            }
        ],
        solutions: [
            {
                title: 'Configure Prowlarr for centralized indexers',
                description: 'Use Prowlarr to manage all indexers in one place',
                steps: [
                    'Set up indexers in Prowlarr (Settings → Indexers)',
                    'Add Sonarr and Radarr as Apps in Prowlarr',
                    'Sync indexers from Prowlarr to *Arr apps',
                    'Do not manually add indexers in Sonarr/Radarr',
                    'All indexer management happens in Prowlarr'
                ],
                configExample: `# Best practice architecture:
Prowlarr → manages all indexers
  ↓ syncs
Sonarr → receives TV indexers automatically
Radarr → receives Movie indexers automatically

# Add indexers only in Prowlarr
# They sync to Sonarr/Radarr automatically`,
                requiresRestart: false,
                notes: 'Prowlarr centralizes indexer management and provides better search aggregation.'
            },
            {
                title: 'Route Prowlarr through VPN if needed',
                description: 'Configure Prowlarr to use VPN for indexer access',
                steps: [
                    'If indexers require VPN, add Prowlarr to VPN network',
                    'Set network_mode: "service:gluetun" for Prowlarr',
                    'Move Prowlarr port to Gluetun service',
                    'Update *Arr apps to use gluetun:9696 for Prowlarr URL'
                ],
                configExample: `services:
  gluetun:
    ports:
      - "9696:9696"  # Prowlarr port

  prowlarr:
    network_mode: "service:gluetun"
    depends_on:
      - gluetun

# In Sonarr/Radarr Apps settings:
Prowlarr URL: http://gluetun:9696`,
                requiresRestart: true,
                notes: 'VPN routing prevents ISP from seeing indexer traffic and bypasses regional blocks.'
            },
            {
                title: 'Check and update indexer definitions',
                description: 'Update Prowlarr indexer definitions to latest',
                steps: [
                    'In Prowlarr: System → Updates',
                    'Update to latest version',
                    'Indexer definitions are updated with Prowlarr updates',
                    'Some indexers change APIs and require definition updates'
                ],
                requiresRestart: false,
                notes: 'Outdated indexer definitions cause search failures. Keep Prowlarr updated.'
            },
            {
                title: 'Reduce concurrent searches',
                description: 'Prevent overwhelming indexers with simultaneous requests',
                steps: [
                    'In *Arr: Settings → Indexers',
                    'Check indexer priority levels',
                    'Disable problematic or slow indexers',
                    'Use fewer indexers with better quality',
                    'Quality over quantity'
                ],
                configExample: `# Instead of 20 indexers:
# Use 5-10 high-quality indexers
# Recommended indexers for private trackers:
- TorrentLeech (if member)
- IPTorrents (if member)

# Public indexers via Prowlarr:
- 1337x
- RARBG alternatives
- ThePirateBay (as fallback)`,
                requiresRestart: false,
                notes: 'Too many indexers slow down searches. Focus on reliable, high-quality sources.'
            }
        ],
        relatedIssues: ['prowlarr-sync-failed', 'test-connection-timeout'],
        tags: ['indexer', 'search', 'prowlarr', 'results', 'vpn']
    }
];

/**
 * Search knowledge base by tags, symptoms, or keywords
 */
export function searchArrInterconnectionKnowledge(query: string): ArrInterconnectionIssuePattern[] {
    const searchTerms = query.toLowerCase().split(/\s+/);
    const results: Array<{ pattern: ArrInterconnectionIssuePattern; score: number }> = [];

    for (const pattern of ARR_INTERCONNECTION_KB) {
        let score = 0;

        // Check title
        if (searchTerms.some(term => pattern.title.toLowerCase().includes(term))) {
            score += 10;
        }

        // Check tags
        for (const term of searchTerms) {
            if (pattern.tags.some(tag => tag.includes(term))) {
                score += 5;
            }
        }

        // Check symptoms
        for (const term of searchTerms) {
            if (pattern.symptoms.some(symptom => symptom.toLowerCase().includes(term))) {
                score += 3;
            }
        }

        // Check description
        if (searchTerms.some(term => pattern.description.toLowerCase().includes(term))) {
            score += 2;
        }

        if (score > 0) {
            results.push({ pattern, score });
        }
    }

    // Sort by score descending
    results.sort((a, b) => b.score - a.score);

    logger.debug({ query, resultCount: results.length }, 'Arr interconnection knowledge search completed');

    return results.map(r => r.pattern);
}

/**
 * Find issue patterns by service
 */
export function getIssuesByService(service: ArrService | DownloadClient): ArrInterconnectionIssuePattern[] {
    return ARR_INTERCONNECTION_KB.filter(
        pattern => !pattern.affectedServices || pattern.affectedServices.includes(service)
    );
}

/**
 * Find issue patterns by severity
 */
export function getIssuesBySeverity(severity: IssueSeverity): ArrInterconnectionIssuePattern[] {
    return ARR_INTERCONNECTION_KB.filter(pattern => pattern.severity === severity);
}

/**
 * Get all critical issues
 */
export function getCriticalIssues(): ArrInterconnectionIssuePattern[] {
    return getIssuesBySeverity('critical');
}

/**
 * Get all high severity issues
 */
export function getHighSeverityIssues(): ArrInterconnectionIssuePattern[] {
    return getIssuesBySeverity('high');
}

/**
 * Match log output against known patterns
 */
export function matchLogPatterns(logOutput: string): ArrInterconnectionIssuePattern[] {
    const matches: ArrInterconnectionIssuePattern[] = [];

    for (const pattern of ARR_INTERCONNECTION_KB) {
        if (!pattern.logPatterns) continue;

        for (const logPattern of pattern.logPatterns) {
            try {
                const regex = new RegExp(logPattern, 'i');
                if (regex.test(logOutput)) {
                    matches.push(pattern);
                    break; // Only add pattern once even if multiple patterns match
                }
            } catch (error) {
                logger.warn({ logPattern, error: getErrorMessage(error) }, 'Invalid regex pattern');
            }
        }
    }

    logger.debug({ matchCount: matches.length }, 'Log pattern matching completed');

    return matches;
}

/**
 * Get issues related to a specific issue ID
 */
export function getRelatedIssues(issueId: string): ArrInterconnectionIssuePattern[] {
    const issue = ARR_INTERCONNECTION_KB.find(p => p.id === issueId);
    if (!issue || !issue.relatedIssues) {
        return [];
    }

    return ARR_INTERCONNECTION_KB.filter(p => issue.relatedIssues!.includes(p.id));
}

/**
 * Get issue by ID
 */
export function getIssueById(issueId: string): ArrInterconnectionIssuePattern | undefined {
    return ARR_INTERCONNECTION_KB.find(p => p.id === issueId);
}

/**
 * Get common Sonarr/Radarr connection issues
 */
export function getCommonConnectionIssues(): ArrInterconnectionIssuePattern[] {
    return ARR_INTERCONNECTION_KB.filter(p =>
        p.tags.includes('connection') || p.tags.includes('api-key') || p.tags.includes('url')
    );
}

/**
 * Get download client specific issues
 */
export function getDownloadClientIssues(): ArrInterconnectionIssuePattern[] {
    return ARR_INTERCONNECTION_KB.filter(p =>
        p.tags.includes('download-client') || p.tags.includes('qbittorrent') || p.tags.includes('import')
    );
}

/**
 * Get Prowlarr integration issues
 */
export function getProwlarrIssues(): ArrInterconnectionIssuePattern[] {
    return ARR_INTERCONNECTION_KB.filter(p =>
        p.tags.includes('prowlarr')
    );
}
