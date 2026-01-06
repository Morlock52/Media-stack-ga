/**
 * Common Error Patterns Database
 * Comprehensive database mapping log messages to known issues and solutions across all services
 * Provides rapid pattern matching for log analysis
 */

import { createLogger } from '../utils/logger.js';
import { getErrorMessage } from '../utils/errors.js';

const logger = createLogger('errorPatterns');

/** Severity level for issues */
export type IssueSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';

/** Service categories */
export type ServiceCategory =
    | 'vpn'
    | 'docker'
    | 'arr'
    | 'media-server'
    | 'download-client'
    | 'reverse-proxy'
    | 'general';

/** Error pattern with regex matching and solutions */
export interface ErrorPattern {
    /** Unique pattern identifier */
    id: string;
    /** Service category this pattern applies to */
    category: ServiceCategory;
    /** Specific services affected (optional) */
    services?: string[];
    /** Human-readable error title */
    title: string;
    /** Detailed description */
    description: string;
    /** Severity level */
    severity: IssueSeverity;
    /** Regex patterns to match in logs (case-insensitive) */
    patterns: string[];
    /** Common causes */
    causes: string[];
    /** Quick fixes */
    fixes: string[];
    /** Link to detailed knowledge base issue ID */
    knowledgeBaseRef?: {
        module: 'vpn' | 'docker' | 'arr' | 'media';
        issueId: string;
    };
    /** Tags for searching */
    tags: string[];
}

/**
 * Comprehensive Error Patterns Database
 * Organized by service category for easier maintenance
 */
export const ERROR_PATTERNS: ErrorPattern[] = [
    // ============================================================================
    // VPN / GLUETUN ERRORS
    // ============================================================================
    {
        id: 'vpn-auth-failed',
        category: 'vpn',
        services: ['gluetun'],
        title: 'VPN Authentication Failed',
        description: 'VPN provider rejected authentication credentials',
        severity: 'critical',
        patterns: [
            'auth.*failed',
            'authentication.*failed',
            'incorrect.*password',
            'invalid.*credentials',
            'username.*password.*incorrect',
            'AUTH_FAILED',
            'authorization.*denied'
        ],
        causes: [
            'Invalid VPN username or password',
            'Credentials expired or changed',
            'Account suspended by provider',
            'Wrong server group for account type'
        ],
        fixes: [
            'Verify OPENVPN_USER and OPENVPN_PASSWORD environment variables',
            'Check if VPN account is active and paid',
            'Ensure credentials match provider requirements',
            'Try different VPN server or region'
        ],
        knowledgeBaseRef: {
            module: 'vpn',
            issueId: 'auth-failed'
        },
        tags: ['vpn', 'authentication', 'credentials', 'gluetun', 'openvpn']
    },
    {
        id: 'vpn-connection-timeout',
        category: 'vpn',
        services: ['gluetun'],
        title: 'VPN Connection Timeout',
        description: 'VPN connection attempt timed out before establishing',
        severity: 'high',
        patterns: [
            'connection.*timeout',
            'timeout.*connecting',
            'TLS.*handshake.*timeout',
            'connection attempt failed',
            'could not connect',
            'dial.*timeout'
        ],
        causes: [
            'VPN server unreachable or down',
            'Firewall blocking VPN protocol',
            'ISP blocking VPN connections',
            'Incorrect VPN port or protocol'
        ],
        fixes: [
            'Try different VPN server region',
            'Check SERVER_REGIONS environment variable',
            'Verify firewall allows VPN traffic (UDP 1194 or TCP 443)',
            'Try switching between UDP and OpenVPN protocols'
        ],
        knowledgeBaseRef: {
            module: 'vpn',
            issueId: 'connection-timeout'
        },
        tags: ['vpn', 'timeout', 'connection', 'firewall', 'gluetun']
    },
    {
        id: 'vpn-dns-leak',
        category: 'vpn',
        services: ['gluetun'],
        title: 'VPN DNS Leak Detected',
        description: 'DNS queries bypassing VPN tunnel',
        severity: 'high',
        patterns: [
            'DNS.*leak',
            'using.*non-VPN.*DNS',
            'DNS.*not.*through.*VPN',
            'resolver.*leak'
        ],
        causes: [
            'DOT (DNS over TLS) disabled',
            'Custom DNS not configured',
            'Container using host DNS instead of VPN DNS'
        ],
        fixes: [
            'Enable DOT: set DOT=on',
            'Configure DNS servers: DNS_ADDRESS=1.1.1.1',
            'Restart container to apply DNS changes',
            'Verify with: docker exec gluetun nslookup google.com'
        ],
        knowledgeBaseRef: {
            module: 'vpn',
            issueId: 'dns-leak'
        },
        tags: ['vpn', 'dns', 'privacy', 'leak', 'security']
    },
    {
        id: 'vpn-port-forwarding-failed',
        category: 'vpn',
        services: ['gluetun'],
        title: 'VPN Port Forwarding Failed',
        description: 'Unable to obtain forwarded port from VPN provider',
        severity: 'medium',
        patterns: [
            'port.*forward.*failed',
            'could not.*forward.*port',
            'NAT-PMP.*failed',
            'port forwarding.*not.*available',
            'forwarded port.*0'
        ],
        causes: [
            'VPN provider does not support port forwarding',
            'Server region does not support port forwarding',
            'Port forwarding not enabled in provider settings',
            'Network mode incompatible with port forwarding'
        ],
        fixes: [
            'Check if provider supports port forwarding (PIA, Proton, Windscribe)',
            'Ensure VPN_PORT_FORWARDING=on',
            'Select server that supports port forwarding',
            'For PIA: verify account has port forwarding enabled'
        ],
        knowledgeBaseRef: {
            module: 'vpn',
            issueId: 'port-forwarding-failed'
        },
        tags: ['vpn', 'port-forwarding', 'nat', 'torrenting']
    },
    {
        id: 'vpn-kill-switch-blocking',
        category: 'vpn',
        services: ['gluetun'],
        title: 'VPN Kill Switch Blocking All Traffic',
        description: 'Firewall kill switch preventing all network access',
        severity: 'high',
        patterns: [
            'firewall.*blocking',
            'kill.*switch.*active',
            'all.*traffic.*blocked',
            'no.*route.*available',
            'FIREWALL.*DROP'
        ],
        causes: [
            'VPN disconnected and kill switch activated',
            'Firewall blocking local network access',
            'FIREWALL_OUTBOUND_SUBNETS not configured for local access'
        ],
        fixes: [
            'Check VPN connection status',
            'Configure FIREWALL_OUTBOUND_SUBNETS for local network',
            'Example: FIREWALL_OUTBOUND_SUBNETS=192.168.0.0/16,172.16.0.0/12',
            'Temporarily disable kill switch: FIREWALL_VPN_INPUT_PORTS=all'
        ],
        knowledgeBaseRef: {
            module: 'vpn',
            issueId: 'kill-switch-blocking'
        },
        tags: ['vpn', 'firewall', 'kill-switch', 'networking', 'gluetun']
    },

    // ============================================================================
    // DOCKER NETWORKING ERRORS
    // ============================================================================
    {
        id: 'docker-dns-resolution-failed',
        category: 'docker',
        title: 'DNS Resolution Failed',
        description: 'Container cannot resolve domain names to IP addresses',
        severity: 'high',
        patterns: [
            'could not resolve',
            'Name or service not known',
            'temporary failure.*resolving',
            'nodename nor servname provided',
            'DNS.*resolution.*failed',
            'no such host',
            'unknown host'
        ],
        causes: [
            'Docker DNS server (127.0.0.11) not accessible',
            'Host DNS configuration issues',
            'Firewall blocking DNS queries',
            'Custom DNS servers misconfigured'
        ],
        fixes: [
            'Check /etc/resolv.conf in container',
            'Set custom DNS: dns: ["8.8.8.8", "8.8.4.4"]',
            'Restart Docker daemon',
            'Test: docker exec <container> nslookup google.com'
        ],
        knowledgeBaseRef: {
            module: 'docker',
            issueId: 'dns-resolution-failed'
        },
        tags: ['docker', 'dns', 'networking', 'resolution']
    },
    {
        id: 'docker-port-conflict',
        category: 'docker',
        title: 'Port Already in Use',
        description: 'Cannot bind to port because it is already allocated',
        severity: 'high',
        patterns: [
            'port.*already.*allocated',
            'address already in use',
            'bind.*failed.*port.*in.*use',
            'port is already allocated',
            'cannot.*bind.*address'
        ],
        causes: [
            'Another container using the same port',
            'Host service using the port',
            'Previous container not fully stopped',
            'Multiple services configured with same port'
        ],
        fixes: [
            'Check what is using port: sudo lsof -i :<port>',
            'Stop conflicting service or container',
            'Change port mapping in docker-compose.yml',
            'Use different host port: "8081:8080"'
        ],
        knowledgeBaseRef: {
            module: 'docker',
            issueId: 'port-conflict'
        },
        tags: ['docker', 'port', 'conflict', 'networking', 'bind']
    },
    {
        id: 'docker-network-not-found',
        category: 'docker',
        title: 'Docker Network Not Found',
        description: 'Referenced network does not exist',
        severity: 'medium',
        patterns: [
            'network.*not found',
            'network.*does not exist',
            'could not find.*network',
            'network.*invalid',
            'no such network'
        ],
        causes: [
            'Network not created before starting container',
            'Network name typo in docker-compose.yml',
            'External network does not exist',
            'Docker network pruned or removed'
        ],
        fixes: [
            'Create network: docker network create <network_name>',
            'Remove external: true if network should be created automatically',
            'Check network name spelling in docker-compose.yml',
            'List networks: docker network ls'
        ],
        knowledgeBaseRef: {
            module: 'docker',
            issueId: 'network-not-found'
        },
        tags: ['docker', 'network', 'configuration']
    },
    {
        id: 'docker-container-network-mode-invalid',
        category: 'docker',
        title: 'Invalid Network Mode Configuration',
        description: 'Network mode configuration is incorrect or incompatible',
        severity: 'high',
        patterns: [
            'network mode.*invalid',
            'container.*network.*not.*found',
            'network.*mode.*not.*supported',
            'cannot use.*network.*mode'
        ],
        causes: [
            'Using network_mode: "container:X" with non-existent container',
            'Mixing network_mode with ports (incompatible)',
            'Target container not running when dependent starts',
            'Network mode syntax error'
        ],
        fixes: [
            'Verify target container exists and is running',
            'Remove port mappings when using container network mode',
            'Use depends_on to ensure container start order',
            'For VPN: put ports on VPN container, not dependent services'
        ],
        knowledgeBaseRef: {
            module: 'docker',
            issueId: 'network-mode-misconfigured'
        },
        tags: ['docker', 'network-mode', 'container', 'configuration']
    },
    {
        id: 'docker-no-internet-access',
        category: 'docker',
        title: 'Container Has No Internet Access',
        description: 'Container cannot reach external internet',
        severity: 'high',
        patterns: [
            'network.*unreachable',
            'no route to host',
            'connection.*refused',
            'timeout.*connecting.*internet'
        ],
        causes: [
            'Docker bridge network misconfigured',
            'Host firewall blocking forwarding',
            'IP forwarding disabled on host',
            'MTU mismatch causing packet loss'
        ],
        fixes: [
            'Enable IP forwarding: sysctl net.ipv4.ip_forward=1',
            'Check Docker iptables: iptables -L DOCKER',
            'Test: docker exec <container> ping 8.8.8.8',
            'Restart Docker daemon'
        ],
        knowledgeBaseRef: {
            module: 'docker',
            issueId: 'container-no-internet'
        },
        tags: ['docker', 'internet', 'networking', 'connectivity']
    },
    {
        id: 'docker-inter-container-dns-failed',
        category: 'docker',
        title: 'Containers Cannot Reach Each Other by Name',
        description: 'Service discovery failing between containers',
        severity: 'high',
        patterns: [
            'could not resolve.*<service>',
            'no such host.*<container>',
            'Name or service not known.*container'
        ],
        causes: [
            'Containers on different networks',
            'Using container name instead of service name',
            'Docker embedded DNS not working',
            'Network not shared between containers'
        ],
        fixes: [
            'Ensure containers on same network',
            'Use service name (from docker-compose.yml) not container name',
            'Check: docker-compose exec <service> nslookup <other-service>',
            'Verify both services in same networks: section'
        ],
        knowledgeBaseRef: {
            module: 'docker',
            issueId: 'inter-container-dns-failed'
        },
        tags: ['docker', 'dns', 'inter-container', 'service-discovery']
    },

    // ============================================================================
    // ARR SERVICE ERRORS (*arr stack)
    // ============================================================================
    {
        id: 'arr-api-unauthorized',
        category: 'arr',
        services: ['sonarr', 'radarr', 'prowlarr', 'lidarr', 'readarr'],
        title: 'API Key Invalid or Missing',
        description: 'Authentication failed due to incorrect API key',
        severity: 'high',
        patterns: [
            '401.*Unauthorized',
            'API.*key.*invalid',
            'Invalid API Key',
            'authentication.*failed',
            'Unauthorized.*API'
        ],
        causes: [
            'Wrong API key configured',
            'API key copied incorrectly (trailing spaces)',
            'API key changed after configuration',
            'Service not providing API key in request'
        ],
        fixes: [
            'Get API key from Settings → General → Security',
            'Copy API key carefully (no extra spaces)',
            'Update API key in connecting service',
            'Test connection after updating'
        ],
        knowledgeBaseRef: {
            module: 'arr',
            issueId: 'api-key-invalid'
        },
        tags: ['arr', 'api', 'authentication', 'unauthorized']
    },
    {
        id: 'arr-connection-refused',
        category: 'arr',
        services: ['sonarr', 'radarr', 'prowlarr'],
        title: 'Cannot Connect to Service',
        description: 'Connection refused when trying to reach another service',
        severity: 'high',
        patterns: [
            'connection.*refused',
            'unable to connect to',
            'connection.*failed',
            'No connection could be made',
            'timeout.*connecting'
        ],
        causes: [
            'Wrong URL or port configured',
            'Service not running',
            'Using localhost when should use container name',
            'Network mode preventing communication'
        ],
        fixes: [
            'Use container/service name, not localhost: http://sonarr:8989',
            'For VPN network mode, use VPN container name: http://gluetun:8989',
            'Verify service is running: docker ps',
            'Check network connectivity: docker exec sonarr ping radarr'
        ],
        knowledgeBaseRef: {
            module: 'arr',
            issueId: 'url-connection-failed'
        },
        tags: ['arr', 'connection', 'networking', 'url']
    },
    {
        id: 'arr-download-client-unreachable',
        category: 'arr',
        services: ['sonarr', 'radarr', 'lidarr'],
        title: 'Download Client Unreachable',
        description: 'Cannot connect to qBittorrent/Transmission/etc',
        severity: 'critical',
        patterns: [
            'download client.*unreachable',
            'qBittorrent.*connection.*failed',
            'Transmission.*not.*responding',
            'download client.*test.*failed'
        ],
        causes: [
            'Download client behind VPN, wrong URL',
            'Download client not started',
            'Incorrect port configuration',
            'Authentication credentials wrong'
        ],
        fixes: [
            'If download client uses VPN network mode, use VPN container name',
            'Example: http://gluetun:8080 (not http://qbittorrent:8080)',
            'Verify download client is running',
            'Check download client username/password'
        ],
        knowledgeBaseRef: {
            module: 'arr',
            issueId: 'download-client-unreachable'
        },
        tags: ['arr', 'download-client', 'qbittorrent', 'transmission', 'vpn']
    },
    {
        id: 'arr-import-failed-no-files',
        category: 'arr',
        services: ['sonarr', 'radarr', 'lidarr'],
        title: 'Import Failed - No Files Found',
        description: 'Downloaded files not found for import',
        severity: 'high',
        patterns: [
            'No files found.*eligible.*import',
            'import.*failed.*no.*files',
            'download folder.*empty',
            'completed download.*not.*found'
        ],
        causes: [
            'Path mapping mismatch',
            'Download and *arr see different paths',
            'File permissions preventing access',
            'Files not in expected location'
        ],
        fixes: [
            'Ensure volume mounts match between download client and *arr',
            'Example: both should have /downloads:/downloads',
            'Check PUID/PGID environment variables match',
            'Verify: docker exec sonarr ls -la /downloads'
        ],
        knowledgeBaseRef: {
            module: 'arr',
            issueId: 'import-failed-no-files'
        },
        tags: ['arr', 'import', 'path-mapping', 'permissions', 'downloads']
    },
    {
        id: 'arr-prowlarr-sync-failed',
        category: 'arr',
        services: ['prowlarr', 'sonarr', 'radarr'],
        title: 'Prowlarr Sync Failed',
        description: 'Prowlarr cannot sync indexers to *arr apps',
        severity: 'medium',
        patterns: [
            'sync.*failed',
            'application.*not.*responding',
            'could not add indexer',
            'sync.*error.*application'
        ],
        causes: [
            'Wrong Sonarr/Radarr URL in Prowlarr',
            'Incorrect API key',
            'Base URL mismatch',
            'Network connectivity issue'
        ],
        fixes: [
            'In Prowlarr Settings → Apps, verify URL format: http://sonarr:8989',
            'Verify API key is correct',
            'Check Base URL settings in both apps match',
            'Test sync manually from Prowlarr'
        ],
        knowledgeBaseRef: {
            module: 'arr',
            issueId: 'prowlarr-sync-failed'
        },
        tags: ['arr', 'prowlarr', 'sync', 'indexers']
    },
    {
        id: 'arr-category-mismatch',
        category: 'arr',
        services: ['sonarr', 'radarr', 'lidarr'],
        title: 'Download Client Category Not Found',
        description: 'Category configured in *arr does not exist in download client',
        severity: 'medium',
        patterns: [
            'category.*not.*found',
            'category.*does not exist',
            'invalid.*category',
            'category.*mapping.*failed'
        ],
        causes: [
            'Category not created in qBittorrent/Transmission',
            'Category name mismatch (case sensitive)',
            'Category deleted from download client',
            'Download client reset to defaults'
        ],
        fixes: [
            'Create category in download client first',
            'In qBittorrent: Tools → Options → Downloads → Categories',
            'Ensure category name exactly matches (case-sensitive)',
            'Set save path for category if needed'
        ],
        knowledgeBaseRef: {
            module: 'arr',
            issueId: 'category-mapping-failed'
        },
        tags: ['arr', 'category', 'download-client', 'configuration']
    },

    // ============================================================================
    // MEDIA SERVER ERRORS (Plex/Jellyfin)
    // ============================================================================
    {
        id: 'media-permission-denied',
        category: 'media-server',
        services: ['plex', 'jellyfin', 'emby'],
        title: 'Permission Denied Accessing Media Files',
        description: 'Media server cannot read media files due to permissions',
        severity: 'critical',
        patterns: [
            'permission denied',
            'access.*denied',
            'cannot.*read.*file',
            'insufficient.*permissions',
            'operation not permitted'
        ],
        causes: [
            'PUID/PGID mismatch',
            'Files owned by different user',
            'Incorrect volume mount permissions',
            'SELinux blocking access'
        ],
        fixes: [
            'Set PUID and PGID to match file owner',
            'Check file ownership: ls -ln /path/to/media',
            'Set permissions: sudo chown -R <uid>:<gid> /path/to/media',
            'Verify PUID/PGID in docker-compose.yml environment'
        ],
        knowledgeBaseRef: {
            module: 'media',
            issueId: 'permission-denied'
        },
        tags: ['media-server', 'permissions', 'puid', 'pgid', 'access']
    },
    {
        id: 'media-library-not-updating',
        category: 'media-server',
        services: ['plex', 'jellyfin'],
        title: 'Library Not Scanning New Files',
        description: 'New media files not appearing in library',
        severity: 'high',
        patterns: [
            'Scan complete.*0.*items',
            'Library.*not.*found',
            'Path.*not.*accessible',
            'no.*new.*media.*found',
            'scanner.*nothing.*added'
        ],
        causes: [
            'Incorrect file naming',
            'Path not accessible to container',
            'File permissions blocking access',
            'Automatic scanning disabled'
        ],
        fixes: [
            'Verify path exists in container: docker exec plex ls /media',
            'Check file naming follows Plex/Jellyfin conventions',
            'Enable automatic library scanning',
            'Trigger manual scan from web UI'
        ],
        knowledgeBaseRef: {
            module: 'media',
            issueId: 'library-not-updating'
        },
        tags: ['media-server', 'library', 'scanning', 'files']
    },
    {
        id: 'media-transcoding-failed',
        category: 'media-server',
        services: ['plex', 'jellyfin'],
        title: 'Transcoding Failed',
        description: 'Media server cannot transcode video',
        severity: 'high',
        patterns: [
            'transcode.*failed',
            'FFmpeg.*error',
            'transcoding.*error',
            'conversion failed',
            'could not.*transcode'
        ],
        causes: [
            'Missing codec or FFmpeg',
            'Insufficient resources (CPU/RAM)',
            'Hardware acceleration misconfigured',
            '/transcode directory full or not writable'
        ],
        fixes: [
            'Check /tmp or /transcode has free space',
            'Add tmpfs for transcoding: tmpfs: /tmp',
            'Verify hardware acceleration settings',
            'Check FFmpeg is available: docker exec plex ffmpeg -version'
        ],
        knowledgeBaseRef: {
            module: 'media',
            issueId: 'transcoding-failed'
        },
        tags: ['media-server', 'transcoding', 'ffmpeg', 'hardware-acceleration']
    },
    {
        id: 'media-codec-not-supported',
        category: 'media-server',
        title: 'Codec Not Supported',
        description: 'Media file uses unsupported codec',
        severity: 'medium',
        patterns: [
            'codec.*not.*supported',
            'unknown.*codec',
            'unsupported.*format',
            'could not.*decode'
        ],
        causes: [
            'Client does not support codec',
            'Server missing codec support',
            'DRM-protected content',
            'Corrupted media file'
        ],
        fixes: [
            'Enable transcoding for this client',
            'Re-encode file to compatible format',
            'Update client to support more codecs',
            'Check if file plays in VLC (test for corruption)'
        ],
        knowledgeBaseRef: {
            module: 'media',
            issueId: 'codec-not-supported'
        },
        tags: ['media-server', 'codec', 'compatibility', 'transcoding']
    },
    {
        id: 'plex-claim-failed',
        category: 'media-server',
        services: ['plex'],
        title: 'Plex Server Claim Failed',
        description: 'Cannot claim Plex server with account',
        severity: 'high',
        patterns: [
            'claim.*failed',
            'claim.*token.*invalid',
            'could not.*claim.*server',
            'token.*expired'
        ],
        causes: [
            'Claim token expired (valid 4 minutes)',
            'PLEX_CLAIM not set or incorrect',
            'Server already claimed to different account',
            'Network preventing claim verification'
        ],
        fixes: [
            'Get new claim token from plex.tv/claim',
            'Set PLEX_CLAIM in docker-compose.yml immediately after getting token',
            'Restart container within 4 minutes of getting token',
            'Check server is reachable from internet for claim'
        ],
        knowledgeBaseRef: {
            module: 'media',
            issueId: 'plex-claim-failed'
        },
        tags: ['plex', 'claim', 'authentication', 'setup']
    },
    {
        id: 'media-metadata-not-loading',
        category: 'media-server',
        services: ['plex', 'jellyfin'],
        title: 'Metadata Not Loading',
        description: 'Posters, descriptions, and metadata missing',
        severity: 'medium',
        patterns: [
            'metadata.*failed',
            'could not.*fetch.*metadata',
            'agent.*not.*responding',
            'no.*metadata.*found'
        ],
        causes: [
            'Metadata agent misconfigured',
            'No internet access from container',
            'Incorrect file naming preventing match',
            'Metadata provider API rate limit'
        ],
        fixes: [
            'Verify container has internet access',
            'Check file naming matches TMDB/TVDB format',
            'Refresh metadata manually',
            'Check metadata agent settings in library settings'
        ],
        knowledgeBaseRef: {
            module: 'media',
            issueId: 'metadata-not-loading'
        },
        tags: ['media-server', 'metadata', 'posters', 'agents']
    },

    // ============================================================================
    // DOWNLOAD CLIENT ERRORS
    // ============================================================================
    {
        id: 'qbittorrent-webui-unreachable',
        category: 'download-client',
        services: ['qbittorrent'],
        title: 'qBittorrent WebUI Not Accessible',
        description: 'Cannot access qBittorrent web interface',
        severity: 'high',
        patterns: [
            'WebUI.*not.*responding',
            'could not connect.*8080',
            'ERR_CONNECTION_REFUSED.*8080'
        ],
        causes: [
            'VPN connection blocking WebUI',
            'WEBUI_PORT environment variable incorrect',
            'Container not exposing port correctly',
            'Accessing on wrong network'
        ],
        fixes: [
            'If using VPN network mode, ports must be on VPN container',
            'Access via VPN container IP or name',
            'Verify port mapping: docker ps | grep qbittorrent',
            'Check VPN_PORT_FORWARDING if needed'
        ],
        tags: ['qbittorrent', 'webui', 'port', 'vpn']
    },
    {
        id: 'qbittorrent-connection-status-firewalled',
        category: 'download-client',
        services: ['qbittorrent'],
        title: 'qBittorrent Shows Firewalled Status',
        description: 'Connection status shows firewalled, limiting peers',
        severity: 'medium',
        patterns: [
            'firewalled',
            'connection status.*firewalled',
            'no incoming connections'
        ],
        causes: [
            'VPN port forwarding not configured',
            'Forwarded port not matching qBittorrent listening port',
            'Firewall blocking incoming connections'
        ],
        fixes: [
            'Enable VPN port forwarding: VPN_PORT_FORWARDING=on',
            'Match qBittorrent listening port to forwarded port',
            'Restart containers after changing settings',
            'Test port forwarding with external tool'
        ],
        tags: ['qbittorrent', 'firewall', 'port-forwarding', 'vpn', 'torrenting']
    },

    // ============================================================================
    // GENERAL / COMMON ERRORS
    // ============================================================================
    {
        id: 'general-out-of-memory',
        category: 'general',
        title: 'Out of Memory Error',
        description: 'Container or process ran out of memory',
        severity: 'critical',
        patterns: [
            'out of memory',
            'OOM',
            'cannot allocate memory',
            'memory.*exhausted',
            'killed.*oom'
        ],
        causes: [
            'Container memory limit too low',
            'Host system out of memory',
            'Memory leak in application',
            'Too many concurrent operations'
        ],
        fixes: [
            'Increase container memory limit: mem_limit: 4g',
            'Check host memory: free -h',
            'Restart container to clear memory',
            'Reduce concurrent operations or quality settings'
        ],
        tags: ['memory', 'oom', 'resources', 'performance']
    },
    {
        id: 'general-disk-full',
        category: 'general',
        title: 'Disk Space Full',
        description: 'No space left on device',
        severity: 'critical',
        patterns: [
            'no space left on device',
            'disk.*full',
            'filesystem.*full',
            'write.*failed.*space',
            'ENOSPC'
        ],
        causes: [
            'Download directory full',
            'Docker volumes using too much space',
            'Logs consuming disk space',
            'Temporary files not cleaned up'
        ],
        fixes: [
            'Check disk usage: df -h',
            'Clear old downloads or media',
            'Prune Docker: docker system prune -a',
            'Rotate or truncate logs'
        ],
        tags: ['disk', 'space', 'storage', 'cleanup']
    },
    {
        id: 'general-file-not-found',
        category: 'general',
        title: 'File or Directory Not Found',
        description: 'Required file or directory does not exist',
        severity: 'medium',
        patterns: [
            'no such file or directory',
            'file.*not found',
            'ENOENT',
            'cannot.*find.*file'
        ],
        causes: [
            'Volume mount path incorrect',
            'File deleted or moved',
            'Path typo in configuration',
            'Permissions preventing file visibility'
        ],
        fixes: [
            'Verify path exists on host',
            'Check volume mounts in docker-compose.yml',
            'Ensure path is absolute, not relative',
            'Check file permissions and ownership'
        ],
        tags: ['file', 'path', 'volume', 'mount']
    },
    {
        id: 'general-timeout',
        category: 'general',
        title: 'Operation Timeout',
        description: 'Operation took too long and timed out',
        severity: 'medium',
        patterns: [
            'timeout',
            'timed out',
            'deadline exceeded',
            'operation.*timeout'
        ],
        causes: [
            'Network latency or congestion',
            'Service overloaded or slow',
            'Timeout setting too aggressive',
            'Resource constraints'
        ],
        fixes: [
            'Increase timeout settings if available',
            'Check network connectivity',
            'Verify target service is responsive',
            'Reduce concurrent operations'
        ],
        tags: ['timeout', 'performance', 'network']
    },
    {
        id: 'general-ssl-certificate-error',
        category: 'general',
        title: 'SSL Certificate Verification Failed',
        description: 'HTTPS connection failed due to certificate issues',
        severity: 'medium',
        patterns: [
            'SSL.*certificate.*verify.*failed',
            'certificate.*invalid',
            'certificate.*expired',
            'SSL.*handshake.*failed',
            'CERTIFICATE_VERIFY_FAILED'
        ],
        causes: [
            'Self-signed certificate',
            'Expired certificate',
            'Certificate chain incomplete',
            'System clock incorrect'
        ],
        fixes: [
            'Verify system time is correct',
            'Update CA certificates: update-ca-certificates',
            'Disable SSL verification (testing only): SSL_VERIFY=false',
            'Install proper SSL certificate'
        ],
        tags: ['ssl', 'certificate', 'https', 'security']
    }
];

/**
 * Match log output against all error patterns
 * @param logOutput - Log text to analyze
 * @param category - Optional filter by service category
 * @returns Matched error patterns sorted by severity
 */
export function matchErrorPatterns(
    logOutput: string,
    category?: ServiceCategory
): ErrorPattern[] {
    const matches: ErrorPattern[] = [];
    const logLower = logOutput.toLowerCase();

    // Filter patterns by category if specified
    const patternsToCheck = category
        ? ERROR_PATTERNS.filter(p => p.category === category)
        : ERROR_PATTERNS;

    for (const pattern of patternsToCheck) {
        // Check if any regex pattern matches
        let matched = false;
        for (const regex of pattern.patterns) {
            try {
                const re = new RegExp(regex, 'i');
                if (re.test(logOutput)) {
                    matched = true;
                    break;
                }
            } catch (error) {
                logger.warn(
                    { pattern: pattern.id, regex, error: getErrorMessage(error) },
                    'Invalid regex pattern'
                );
            }
        }

        if (matched) {
            matches.push(pattern);
        }
    }

    // Sort by severity (critical first)
    const severityOrder: Record<IssueSeverity, number> = {
        critical: 0,
        high: 1,
        medium: 2,
        low: 3,
        info: 4
    };

    matches.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

    logger.debug(
        { matchCount: matches.length, category },
        'Error pattern matching completed'
    );

    return matches;
}

/**
 * Search error patterns by keyword
 * @param query - Search query
 * @returns Matching patterns sorted by relevance
 */
export function searchErrorPatterns(query: string): ErrorPattern[] {
    const searchTerms = query.toLowerCase().split(/\s+/);
    const results: Array<{ pattern: ErrorPattern; score: number }> = [];

    for (const pattern of ERROR_PATTERNS) {
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

        // Check description
        if (searchTerms.some(term => pattern.description.toLowerCase().includes(term))) {
            score += 3;
        }

        // Check causes
        for (const term of searchTerms) {
            if (pattern.causes.some(cause => cause.toLowerCase().includes(term))) {
                score += 2;
            }
        }

        if (score > 0) {
            results.push({ pattern, score });
        }
    }

    // Sort by score descending
    results.sort((a, b) => b.score - a.score);

    logger.debug({ query, resultCount: results.length }, 'Error pattern search completed');

    return results.map(r => r.pattern);
}

/**
 * Get error patterns by category
 */
export function getPatternsByCategory(category: ServiceCategory): ErrorPattern[] {
    return ERROR_PATTERNS.filter(p => p.category === category);
}

/**
 * Get error patterns by severity
 */
export function getPatternsBySeverity(severity: IssueSeverity): ErrorPattern[] {
    return ERROR_PATTERNS.filter(p => p.severity === severity);
}

/**
 * Get all critical error patterns
 */
export function getCriticalPatterns(): ErrorPattern[] {
    return getPatternsBySeverity('critical');
}

/**
 * Get error pattern by ID
 */
export function getPatternById(id: string): ErrorPattern | undefined {
    return ERROR_PATTERNS.find(p => p.id === id);
}

/**
 * Get patterns for specific service
 */
export function getPatternsByService(serviceName: string): ErrorPattern[] {
    const serviceLower = serviceName.toLowerCase();
    return ERROR_PATTERNS.filter(
        p => p.services && p.services.some(s => s.toLowerCase() === serviceLower)
    );
}

/**
 * Analyze log output and return comprehensive results
 */
export interface LogAnalysisResult {
    /** All matched patterns */
    matches: ErrorPattern[];
    /** Critical issues found */
    critical: ErrorPattern[];
    /** High severity issues */
    high: ErrorPattern[];
    /** Issues grouped by category */
    byCategory: Map<ServiceCategory, ErrorPattern[]>;
    /** Quick summary */
    summary: string;
}

/**
 * Comprehensive log analysis
 */
export function analyzeLogOutput(logOutput: string): LogAnalysisResult {
    const matches = matchErrorPatterns(logOutput);
    const critical = matches.filter(m => m.severity === 'critical');
    const high = matches.filter(m => m.severity === 'high');

    // Group by category
    const byCategory = new Map<ServiceCategory, ErrorPattern[]>();
    for (const match of matches) {
        const existing = byCategory.get(match.category) || [];
        existing.push(match);
        byCategory.set(match.category, existing);
    }

    // Generate summary
    let summary = '';
    if (matches.length === 0) {
        summary = 'No known error patterns detected in logs';
    } else {
        const parts: string[] = [];
        if (critical.length > 0) {
            parts.push(`${critical.length} critical issue(s)`);
        }
        if (high.length > 0) {
            parts.push(`${high.length} high severity issue(s)`);
        }
        if (matches.length - critical.length - high.length > 0) {
            parts.push(
                `${matches.length - critical.length - high.length} other issue(s)`
            );
        }
        summary = `Found ${parts.join(', ')} in logs`;
    }

    return {
        matches,
        critical,
        high,
        byCategory,
        summary
    };
}
