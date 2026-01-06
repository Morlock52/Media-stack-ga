/**
 * VPN Troubleshooting Knowledge Module
 * Comprehensive knowledge base for diagnosing and fixing VPN-related issues
 * Focuses on Gluetun and common VPN connectivity problems
 */

import { createLogger } from '../utils/logger.js';

const logger = createLogger('vpnKnowledge');

/** Severity level for issues */
export type IssueSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';

/** VPN provider types */
export type VpnProvider =
    | 'nordvpn'
    | 'mullvad'
    | 'protonvpn'
    | 'surfshark'
    | 'expressvpn'
    | 'privateinternetaccess'
    | 'windscribe'
    | 'torguard'
    | 'airvpn'
    | 'custom'
    | 'wireguard'
    | 'openvpn';

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

/** VPN issue pattern */
export interface VpnIssuePattern {
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
    /** Which providers this affects */
    affectedProviders?: VpnProvider[];
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
 * VPN Troubleshooting Knowledge Base
 */
export const VPN_TROUBLESHOOTING_KB: VpnIssuePattern[] = [
    {
        id: 'vpn-healthy-but-no-connection',
        title: 'VPN shows healthy but services cannot connect',
        description: 'Gluetun container is running and reports successful VPN connection, but services routed through it (qBittorrent, Prowlarr, etc.) cannot reach the internet or other services.',
        severity: 'high',
        symptoms: [
            'Gluetun logs show "VPN connection established"',
            'Download client cannot connect to trackers',
            'Prowlarr indexer tests fail',
            'Services timeout when trying to reach external URLs',
            'Container health check passes but network is not functional'
        ],
        logPatterns: [
            'ip link set .* up',
            'tunnel interface is .* up',
            'VPN is running',
            'Initialization complete',
            'timeout.*dial.*',
            'no route to host',
            'network unreachable'
        ],
        affectedProviders: ['nordvpn', 'mullvad', 'protonvpn', 'surfshark', 'custom'],
        diagnostics: [
            {
                order: 1,
                description: 'Check Gluetun container status and logs',
                command: 'docker logs gluetun --tail 50',
                expectedResult: 'Should see "VPN is running" or similar success message',
                interpretation: 'If no success message, VPN connection itself has failed. If success message present, issue is with routing/DNS.'
            },
            {
                order: 2,
                description: 'Test connectivity from within Gluetun container',
                command: 'docker exec gluetun wget -qO- https://api.ipify.org',
                expectedResult: 'Should return VPN provider IP (not your real IP)',
                interpretation: 'If this works, Gluetun has internet. If it fails, VPN tunnel is broken.'
            },
            {
                order: 3,
                description: 'Test connectivity from dependent service',
                command: 'docker exec qbittorrent wget -qO- https://api.ipify.org',
                expectedResult: 'Should return same IP as Gluetun test',
                interpretation: 'If this fails but Gluetun works, network_mode configuration is wrong.'
            },
            {
                order: 4,
                description: 'Check DNS resolution inside Gluetun',
                command: 'docker exec gluetun nslookup google.com',
                expectedResult: 'Should resolve to IP addresses',
                interpretation: 'If DNS fails, need to configure DOT_PROVIDERS or DNS settings.'
            },
            {
                order: 5,
                description: 'Verify network_mode configuration',
                command: 'docker inspect qbittorrent --format "{{.HostConfig.NetworkMode}}"',
                expectedResult: 'Should show "container:gluetun" or "service:gluetun"',
                interpretation: 'If shows "bridge" or "default", service is not routing through VPN.'
            }
        ],
        solutions: [
            {
                title: 'Fix network_mode configuration',
                description: 'Ensure dependent services are using Gluetun container as their network',
                steps: [
                    'Open docker-compose.yml',
                    'Find the service that needs VPN (e.g., qbittorrent)',
                    'Remove any "ports:" section from the service',
                    'Add "network_mode: service:gluetun" under the service',
                    'Move all port mappings to the gluetun service',
                    'Restart both containers'
                ],
                configExample: `# Incorrect - service has its own network
qbittorrent:
  image: linuxserver/qbittorrent
  ports:
    - "8080:8080"

# Correct - service uses Gluetun's network
gluetun:
  image: qmcgaw/gluetun
  ports:
    - "8080:8080"  # qBittorrent WebUI
  environment:
    - VPN_SERVICE_PROVIDER=nordvpn

qbittorrent:
  image: linuxserver/qbittorrent
  network_mode: "service:gluetun"  # No ports section!
  depends_on:
    - gluetun`,
                requiresRestart: true,
                notes: 'Services using network_mode cannot have their own ports section. All ports must be published through Gluetun.'
            },
            {
                title: 'Configure DNS resolution',
                description: 'Set up DNS-over-TLS or custom DNS servers for reliable resolution',
                steps: [
                    'Add DOT=on to Gluetun environment variables',
                    'Optionally set DOT_PROVIDERS=cloudflare or other provider',
                    'Alternatively, set DNS servers with DNS_ADDRESS environment variable',
                    'Restart Gluetun container'
                ],
                envVars: {
                    'DOT': 'on',
                    'DOT_PROVIDERS': 'cloudflare',
                    'DNS_ADDRESS': '1.1.1.1'
                },
                requiresRestart: true,
                notes: 'DNS-over-TLS (DOT) encrypts DNS queries and prevents leaks. Cloudflare is reliable but you can use any provider.'
            },
            {
                title: 'Enable firewall forwarding',
                description: 'Configure Gluetun firewall to allow traffic from dependent containers',
                steps: [
                    'Set FIREWALL_OUTBOUND_SUBNETS to include Docker network range',
                    'Typically use 172.16.0.0/12 to cover most Docker networks',
                    'Add VPN_PORT_FORWARDING=on if using port forwarding',
                    'Restart Gluetun'
                ],
                envVars: {
                    'FIREWALL_OUTBOUND_SUBNETS': '172.16.0.0/12',
                    'FIREWALL_VPN_INPUT_PORTS': '8080',
                    'FIREWALL_INPUT_PORTS': ''
                },
                configExample: `gluetun:
  environment:
    - FIREWALL_OUTBOUND_SUBNETS=172.16.0.0/12
    - FIREWALL_VPN_INPUT_PORTS=8080  # qBittorrent WebUI
    - VPN_PORT_FORWARDING=on`,
                requiresRestart: true,
                notes: 'Gluetun built-in firewall blocks traffic by default. Must explicitly allow Docker subnets.'
            }
        ],
        relatedIssues: ['vpn-kill-switch-blocking', 'vpn-dns-leak', 'port-forwarding-failed'],
        tags: ['gluetun', 'connectivity', 'network_mode', 'dns', 'firewall', 'routing']
    },
    {
        id: 'vpn-kill-switch-blocking',
        title: 'VPN kill switch blocking all traffic',
        description: 'Gluetun kill switch is preventing any network traffic, even when VPN is connected. This is often due to overly restrictive firewall rules.',
        severity: 'high',
        symptoms: [
            'All network requests timeout',
            'Cannot reach local network services',
            'Gluetun logs show firewall rules being applied',
            'Services report "connection refused" or "no route to host"'
        ],
        logPatterns: [
            'Setting firewall',
            'iptables.*DROP',
            'Firewall enabled',
            'Kill switch engaged'
        ],
        diagnostics: [
            {
                order: 1,
                description: 'Check Gluetun firewall status',
                command: 'docker exec gluetun iptables -L -n',
                expectedResult: 'Should see ACCEPT rules for VPN interface and Docker subnets',
                interpretation: 'If all rules are DROP or REJECT, firewall is too restrictive'
            },
            {
                order: 2,
                description: 'Test local network access',
                command: 'docker exec gluetun ping -c 3 172.17.0.1',
                expectedResult: 'Should receive ping replies',
                interpretation: 'If ping fails, firewall is blocking local Docker network'
            },
            {
                order: 3,
                description: 'Check VPN tunnel interface',
                command: 'docker exec gluetun ip link show tun0',
                expectedResult: 'Interface should be UP',
                interpretation: 'If interface is DOWN, VPN tunnel has failed'
            }
        ],
        solutions: [
            {
                title: 'Configure firewall to allow local networks',
                description: 'Add Docker subnet to firewall outbound allowlist',
                steps: [
                    'Identify your Docker network subnet (usually 172.17.0.0/16 or 172.16.0.0/12)',
                    'Set FIREWALL_OUTBOUND_SUBNETS environment variable',
                    'Restart Gluetun container',
                    'Verify connectivity to local services'
                ],
                envVars: {
                    'FIREWALL_OUTBOUND_SUBNETS': '172.16.0.0/12,192.168.0.0/16'
                },
                configExample: `gluetun:
  environment:
    - FIREWALL_OUTBOUND_SUBNETS=172.16.0.0/12,192.168.0.0/16
    - FIREWALL=on  # Kill switch enabled
    - VPN_SERVICE_PROVIDER=nordvpn`,
                requiresRestart: true,
                notes: 'This allows traffic to Docker networks and local LAN while maintaining kill switch for internet traffic.'
            },
            {
                title: 'Temporarily disable kill switch for debugging',
                description: 'Disable firewall to verify it is the cause of connectivity issues',
                steps: [
                    'Set FIREWALL=off in Gluetun environment',
                    'Restart Gluetun',
                    'Test connectivity',
                    'If connectivity works, re-enable firewall with proper FIREWALL_OUTBOUND_SUBNETS'
                ],
                envVars: {
                    'FIREWALL': 'off'
                },
                requiresRestart: true,
                notes: 'Only use this temporarily for debugging. Always re-enable firewall for security.'
            }
        ],
        relatedIssues: ['vpn-healthy-but-no-connection', 'local-network-unreachable'],
        tags: ['kill-switch', 'firewall', 'iptables', 'gluetun', 'blocking']
    },
    {
        id: 'gluetun-auth-failed',
        title: 'Gluetun VPN authentication failed',
        description: 'Gluetun cannot authenticate with VPN provider due to incorrect credentials, expired subscription, or provider API issues.',
        severity: 'critical',
        symptoms: [
            'Gluetun logs show "authentication failed"',
            'Container restarts repeatedly',
            'Error messages about invalid credentials',
            'Provider returns 401 or 403 errors'
        ],
        logPatterns: [
            'authentication.*fail',
            'invalid.*credentials',
            'login.*incorrect',
            'unauthorized',
            'AUTH_FAILED',
            'bad.*auth',
            'token.*expired'
        ],
        affectedProviders: ['nordvpn', 'mullvad', 'protonvpn', 'surfshark', 'privateinternetaccess'],
        diagnostics: [
            {
                order: 1,
                description: 'Check Gluetun logs for specific error',
                command: 'docker logs gluetun 2>&1 | grep -i "auth\\|error\\|fail"',
                expectedResult: 'Should show authentication error details',
                interpretation: 'Error message will indicate if credentials are wrong, expired, or if provider is having issues'
            },
            {
                order: 2,
                description: 'Verify credentials are set correctly',
                command: 'docker exec gluetun printenv | grep -E "OPENVPN_USER|OPENVPN_PASSWORD|VPN_SERVICE_PROVIDER"',
                expectedResult: 'Should show provider name and credentials (password will be masked)',
                interpretation: 'If any are missing or empty, credentials not configured'
            },
            {
                order: 3,
                description: 'Test credentials with provider directly',
                expectedResult: 'Login should work on provider website',
                interpretation: 'If cannot login on website, account issue. If website works but Gluetun fails, credential format issue.'
            }
        ],
        solutions: [
            {
                title: 'Update VPN credentials',
                description: 'Set correct username and password for your VPN provider',
                steps: [
                    'Get VPN credentials from your provider (may be different from account password)',
                    'For NordVPN/Surfshark: use service credentials, not account email',
                    'For Mullvad: use account number as username, no password needed',
                    'Set OPENVPN_USER and OPENVPN_PASSWORD in environment',
                    'Restart Gluetun'
                ],
                envVars: {
                    'VPN_SERVICE_PROVIDER': 'nordvpn',
                    'OPENVPN_USER': 'your_service_username',
                    'OPENVPN_PASSWORD': 'your_service_password'
                },
                requiresRestart: true,
                notes: 'Many providers use service credentials different from account login. Check provider documentation.'
            },
            {
                title: 'Use WireGuard instead of OpenVPN',
                description: 'Switch to WireGuard protocol which uses different authentication',
                steps: [
                    'Generate WireGuard private key from provider',
                    'Set VPN_TYPE=wireguard',
                    'Set WIREGUARD_PRIVATE_KEY and WIREGUARD_ADDRESSES',
                    'Remove OPENVPN_USER and OPENVPN_PASSWORD',
                    'Restart Gluetun'
                ],
                envVars: {
                    'VPN_TYPE': 'wireguard',
                    'WIREGUARD_PRIVATE_KEY': 'your_private_key',
                    'WIREGUARD_ADDRESSES': 'provided_by_vpn'
                },
                configExample: `gluetun:
  environment:
    - VPN_SERVICE_PROVIDER=mullvad
    - VPN_TYPE=wireguard
    - WIREGUARD_PRIVATE_KEY=\${WIREGUARD_PRIVATE_KEY}
    - WIREGUARD_ADDRESSES=10.x.x.x/32`,
                requiresRestart: true,
                notes: 'WireGuard is faster and more reliable than OpenVPN for most providers.'
            },
            {
                title: 'Provider-specific credential format',
                description: 'Use correct credential format for specific VPN providers',
                steps: [
                    'NordVPN: Use service credentials from nordvpn.com/account → Services',
                    'Mullvad: Only account number needed, leave password empty',
                    'ProtonVPN: Use OpenVPN/IKEv2 username (starts with random chars, not email)',
                    'Surfshark: Use service credentials from account.surfshark.com → VPN Manual Setup',
                    'PIA: Use p-prefixed username from privateinternetaccess.com → Client Support → PPTP/L2TP/OpenVPN'
                ],
                requiresRestart: true,
                notes: 'Each provider has unique credential requirements. Always check official documentation.'
            }
        ],
        relatedIssues: ['vpn-connection-timeout', 'provider-server-error'],
        tags: ['authentication', 'credentials', 'login', 'gluetun', 'nordvpn', 'mullvad', 'protonvpn']
    },
    {
        id: 'vpn-dns-leak',
        title: 'DNS leak - using ISP DNS instead of VPN',
        description: 'DNS queries are leaking outside the VPN tunnel, potentially revealing browsing activity to ISP or compromising privacy.',
        severity: 'high',
        symptoms: [
            'DNS leak test shows ISP DNS servers',
            'Local domain names resolve when they should not',
            'Privacy-focused indexers block connections',
            'VPN connected but real location detected'
        ],
        logPatterns: [
            'DNS.*leak',
            'nameserver.*192\\.168',
            'nameserver.*10\\.',
            'using system DNS'
        ],
        diagnostics: [
            {
                order: 1,
                description: 'Check DNS servers being used',
                command: 'docker exec gluetun cat /etc/resolv.conf',
                expectedResult: 'Should show VPN provider DNS or configured DNS (not 192.168.x.x or ISP DNS)',
                interpretation: 'If shows local/ISP DNS, Gluetun DNS not configured properly'
            },
            {
                order: 2,
                description: 'Run DNS leak test',
                command: 'docker exec gluetun wget -qO- https://www.dnsleaktest.com/test.php',
                expectedResult: 'Should show VPN provider or configured DNS servers only',
                interpretation: 'If shows ISP DNS servers, DNS is leaking'
            },
            {
                order: 3,
                description: 'Test from dependent service',
                command: 'docker exec qbittorrent cat /etc/resolv.conf',
                expectedResult: 'Should match Gluetun DNS configuration',
                interpretation: 'Services using network_mode inherit Gluetun DNS settings'
            }
        ],
        solutions: [
            {
                title: 'Enable DNS-over-TLS',
                description: 'Use encrypted DNS to prevent leaks and ensure privacy',
                steps: [
                    'Set DOT=on in Gluetun environment',
                    'Configure DOT_PROVIDERS (cloudflare, quad9, google)',
                    'Optionally set DOT_PRIVATE_ADDRESS for custom DNS',
                    'Restart Gluetun and verify with DNS leak test'
                ],
                envVars: {
                    'DOT': 'on',
                    'DOT_PROVIDERS': 'cloudflare',
                    'DOT_CACHING': 'on'
                },
                configExample: `gluetun:
  environment:
    - DOT=on
    - DOT_PROVIDERS=cloudflare
    - DOT_CACHING=on
    - DOT_IPV6=off  # Disable if IPv6 not supported`,
                requiresRestart: true,
                notes: 'DNS-over-TLS encrypts all DNS queries and prevents ISP from seeing DNS traffic.'
            },
            {
                title: 'Use VPN provider DNS',
                description: 'Configure Gluetun to use DNS servers provided by VPN',
                steps: [
                    'Remove custom DNS_ADDRESS if set',
                    'Remove DOT settings',
                    'Gluetun will automatically use provider DNS',
                    'Restart and verify'
                ],
                requiresRestart: true,
                notes: 'Most VPN providers include DNS servers that prevent leaks. This is the simplest approach.'
            },
            {
                title: 'Set custom DNS servers',
                description: 'Manually specify trusted DNS servers',
                steps: [
                    'Choose privacy-focused DNS (Quad9: 9.9.9.9, Cloudflare: 1.1.1.1)',
                    'Set DNS_ADDRESS in Gluetun environment',
                    'Optionally enable DNS_KEEP_NAMESERVER=on',
                    'Restart Gluetun'
                ],
                envVars: {
                    'DNS_ADDRESS': '9.9.9.9',
                    'DNS_KEEP_NAMESERVER': 'on'
                },
                requiresRestart: true,
                notes: 'Use this if VPN provider DNS is unreliable or you want specific DNS provider.'
            }
        ],
        relatedIssues: ['vpn-healthy-but-no-connection', 'privacy-compromise'],
        tags: ['dns', 'leak', 'privacy', 'gluetun', 'dns-over-tls']
    },
    {
        id: 'port-forwarding-failed',
        title: 'VPN port forwarding not working',
        description: 'Gluetun port forwarding is not successfully forwarding ports for torrent client, preventing incoming connections and reducing download speeds.',
        severity: 'medium',
        symptoms: [
            'No incoming connections in qBittorrent',
            'Port shows closed in torrent client',
            'Slow download speeds',
            'Gluetun logs show port forwarding errors',
            'Random port changes on every restart'
        ],
        logPatterns: [
            'port forwarding.*fail',
            'forwarded port.*0',
            'could not forward port',
            'port forwarding.*disabled',
            'NAT.*fail'
        ],
        affectedProviders: ['privateinternetaccess', 'protonvpn', 'nordvpn'],
        diagnostics: [
            {
                order: 1,
                description: 'Check if port forwarding is enabled',
                command: 'docker logs gluetun 2>&1 | grep -i "port forward"',
                expectedResult: 'Should show "port forwarding enabled" and forwarded port number',
                interpretation: 'If no port forwarding logs, feature not enabled or not supported by provider'
            },
            {
                order: 2,
                description: 'Get current forwarded port',
                command: 'docker exec gluetun cat /tmp/gluetun/forwarded_port 2>/dev/null || echo "File not found"',
                expectedResult: 'Should show a port number (e.g., 54321)',
                interpretation: 'If file missing or shows 0, port forwarding has failed'
            },
            {
                order: 3,
                description: 'Test port accessibility',
                expectedResult: 'Should show port as open',
                interpretation: 'Use service like canyouseeme.org to verify external access to forwarded port'
            }
        ],
        solutions: [
            {
                title: 'Enable VPN port forwarding',
                description: 'Configure Gluetun to request and use forwarded port',
                steps: [
                    'Verify your VPN provider supports port forwarding (PIA, ProtonVPN do, NordVPN does not)',
                    'Set VPN_PORT_FORWARDING=on',
                    'Optionally set VPN_PORT_FORWARDING_PROVIDER for custom scripts',
                    'Restart Gluetun',
                    'Check logs for forwarded port number',
                    'Configure torrent client to use this port'
                ],
                envVars: {
                    'VPN_PORT_FORWARDING': 'on',
                    'VPN_PORT_FORWARDING_LISTENING_PORT': '6881'
                },
                configExample: `gluetun:
  environment:
    - VPN_SERVICE_PROVIDER=privateinternetaccess
    - VPN_PORT_FORWARDING=on
    - FIREWALL_VPN_INPUT_PORTS=\${VPN_PORT_FORWARDING_LISTENING_PORT}`,
                requiresRestart: true,
                notes: 'Not all VPN providers support port forwarding. Check provider documentation.'
            },
            {
                title: 'Configure qBittorrent to use forwarded port',
                description: 'Set up qBittorrent to automatically use Gluetun forwarded port',
                steps: [
                    'In qBittorrent, disable "Use random port"',
                    'Check Gluetun logs for forwarded port: docker logs gluetun | grep forwarded',
                    'Set this port in qBittorrent Connection settings',
                    'Or use port forwarding script to auto-update qBittorrent',
                    'Verify port is open using qBittorrent network test'
                ],
                requiresRestart: false,
                notes: 'Port may change when Gluetun restarts. Consider using port forwarding update script.'
            },
            {
                title: 'Set up port forwarding automation',
                description: 'Automatically update qBittorrent when Gluetun port changes',
                steps: [
                    'Create script that reads /tmp/gluetun/forwarded_port',
                    'Script updates qBittorrent config via API',
                    'Run script on Gluetun startup',
                    'Use cron or volume mount to keep script persistent'
                ],
                configExample: `#!/bin/sh
# Update qBittorrent port from Gluetun
FORWARDED_PORT=$(cat /tmp/gluetun/forwarded_port)
curl -X POST "http://localhost:8080/api/v2/app/setPreferences" \\
  --data "json={\\"listen_port\\":$FORWARDED_PORT}"`,
                requiresRestart: false,
                notes: 'This requires some scripting knowledge but ensures port is always correct.'
            }
        ],
        relatedIssues: ['vpn-healthy-but-no-connection', 'slow-download-speeds'],
        tags: ['port-forwarding', 'gluetun', 'qbittorrent', 'pia', 'protonvpn', 'nat']
    },
    {
        id: 'vpn-connection-timeout',
        title: 'VPN connection timeout or slow to establish',
        description: 'Gluetun takes excessive time to connect to VPN server or connection times out before establishing.',
        severity: 'medium',
        symptoms: [
            'Gluetun container takes minutes to start',
            'Logs show "connection timeout"',
            'Multiple retry attempts',
            'Eventually connects after many failures',
            'Container stuck in restarting loop'
        ],
        logPatterns: [
            'connection.*timeout',
            'dial.*timeout',
            'TLS.*timeout',
            'failed to connect.*retry',
            'no response from server'
        ],
        diagnostics: [
            {
                order: 1,
                description: 'Check VPN server connectivity',
                command: 'docker logs gluetun 2>&1 | grep -i "server\\|timeout"',
                expectedResult: 'Should show which server is being attempted and timeout errors',
                interpretation: 'If specific server repeatedly times out, that server may be overloaded or blocked'
            },
            {
                order: 2,
                description: 'Test DNS resolution of VPN server',
                command: 'docker exec gluetun nslookup [vpn-server-hostname]',
                expectedResult: 'Should resolve to IP addresses quickly',
                interpretation: 'If DNS resolution is slow, DNS issue is causing timeout'
            },
            {
                order: 3,
                description: 'Check if firewall blocking VPN',
                expectedResult: 'Ports 1194 (OpenVPN) or 51820 (WireGuard) should be allowed',
                interpretation: 'Local firewall may be blocking VPN traffic'
            }
        ],
        solutions: [
            {
                title: 'Specify faster VPN server',
                description: 'Choose geographically closer or less congested server',
                steps: [
                    'Set SERVER_COUNTRIES to limit to nearby countries',
                    'Or set SERVER_CITIES for more specific location',
                    'Or use SERVER_HOSTNAMES to specify exact server',
                    'Choose server with low load percentage from provider',
                    'Restart Gluetun'
                ],
                envVars: {
                    'SERVER_COUNTRIES': 'United States',
                    'SERVER_CITIES': 'New York',
                    'VPN_SERVICE_PROVIDER': 'nordvpn'
                },
                configExample: `gluetun:
  environment:
    - SERVER_COUNTRIES=Netherlands  # Choose nearby country
    # OR
    - SERVER_CITIES=Amsterdam
    # OR
    - SERVER_HOSTNAMES=nl123.nordvpn.com`,
                requiresRestart: true,
                notes: 'Closer servers generally have lower latency and faster connection times.'
            },
            {
                title: 'Switch to WireGuard protocol',
                description: 'WireGuard connects faster and more reliably than OpenVPN',
                steps: [
                    'Get WireGuard configuration from VPN provider',
                    'Set VPN_TYPE=wireguard',
                    'Configure WIREGUARD_PRIVATE_KEY and WIREGUARD_ADDRESSES',
                    'Remove OpenVPN environment variables',
                    'Restart Gluetun'
                ],
                envVars: {
                    'VPN_TYPE': 'wireguard',
                    'WIREGUARD_PRIVATE_KEY': 'your_private_key',
                    'WIREGUARD_ADDRESSES': '10.x.x.x/32'
                },
                requiresRestart: true,
                notes: 'WireGuard typically connects in under 1 second vs 5-10 seconds for OpenVPN.'
            },
            {
                title: 'Increase timeout values',
                description: 'Give Gluetun more time to establish connection on slow networks',
                steps: [
                    'Set HEALTH_VPN_DURATION_INITIAL to allow more startup time',
                    'Set larger timeout values if on slow internet connection',
                    'Restart Gluetun'
                ],
                envVars: {
                    'HEALTH_VPN_DURATION_INITIAL': '60s',
                    'HEALTH_VPN_DURATION_ADDITION': '30s'
                },
                requiresRestart: true,
                notes: 'This does not fix root cause but prevents false failures on slow connections.'
            }
        ],
        relatedIssues: ['gluetun-auth-failed', 'provider-server-error'],
        tags: ['timeout', 'slow-connection', 'gluetun', 'performance', 'wireguard']
    },
    {
        id: 'local-network-unreachable',
        title: 'Cannot access local network services through VPN',
        description: 'Services using VPN cannot communicate with other local Docker containers or LAN devices, breaking *arr interconnection.',
        severity: 'high',
        symptoms: [
            'qBittorrent cannot connect to Prowlarr',
            'Sonarr/Radarr cannot reach download client',
            'Local API calls fail',
            'Web UI accessible but service connections fail'
        ],
        logPatterns: [
            'connection refused.*172\\.',
            'no route to host',
            'network unreachable',
            'dial.*local'
        ],
        diagnostics: [
            {
                order: 1,
                description: 'Test connectivity to local container',
                command: 'docker exec gluetun ping -c 3 prowlarr',
                expectedResult: 'Should receive ping replies',
                interpretation: 'If ping fails, firewall blocking local Docker network'
            },
            {
                order: 2,
                description: 'Check firewall outbound subnets',
                command: 'docker exec gluetun printenv | grep FIREWALL_OUTBOUND_SUBNETS',
                expectedResult: 'Should include Docker network range (172.16.0.0/12)',
                interpretation: 'If not set or incomplete, local traffic being blocked'
            },
            {
                order: 3,
                description: 'Verify Docker network subnet',
                command: 'docker network inspect bridge --format "{{(index .IPAM.Config 0).Subnet}}"',
                expectedResult: 'Shows Docker network range',
                interpretation: 'This subnet must be in FIREWALL_OUTBOUND_SUBNETS'
            }
        ],
        solutions: [
            {
                title: 'Allow Docker networks in firewall',
                description: 'Configure Gluetun to permit traffic to local Docker containers',
                steps: [
                    'Identify Docker network subnet (usually 172.17.0.0/16)',
                    'Set FIREWALL_OUTBOUND_SUBNETS to include Docker ranges',
                    'Include custom networks if using them',
                    'Restart Gluetun'
                ],
                envVars: {
                    'FIREWALL_OUTBOUND_SUBNETS': '172.16.0.0/12,192.168.0.0/16'
                },
                configExample: `gluetun:
  environment:
    # Allow all Docker networks (172.16-172.31) and local LAN
    - FIREWALL_OUTBOUND_SUBNETS=172.16.0.0/12,192.168.0.0/16`,
                requiresRestart: true,
                notes: '172.16.0.0/12 covers most Docker networks. Add your LAN subnet if also needed.'
            },
            {
                title: 'Use Docker container names for connections',
                description: 'Ensure services reference each other by container name, not localhost',
                steps: [
                    'In Sonarr/Radarr download client settings, use "qbittorrent" not "localhost"',
                    'Use container name as hostname',
                    'Docker DNS will resolve to correct IP',
                    'Do not use 127.0.0.1 or localhost'
                ],
                requiresRestart: false,
                notes: 'When using network_mode, localhost refers to Gluetun container, not the service. Always use container names.'
            }
        ],
        relatedIssues: ['vpn-healthy-but-no-connection', 'vpn-kill-switch-blocking'],
        tags: ['local-network', 'docker-network', 'firewall', 'arr-interconnection']
    }
];

/**
 * Search knowledge base by tags, symptoms, or keywords
 */
export function searchVpnKnowledge(query: string): VpnIssuePattern[] {
    const searchTerms = query.toLowerCase().split(/\s+/);
    const results: Array<{ pattern: VpnIssuePattern; score: number }> = [];

    for (const pattern of VPN_TROUBLESHOOTING_KB) {
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

    logger.debug({ query, resultCount: results.length }, 'VPN knowledge search completed');

    return results.map(r => r.pattern);
}

/**
 * Find issue patterns by provider
 */
export function getIssuesByProvider(provider: VpnProvider): VpnIssuePattern[] {
    return VPN_TROUBLESHOOTING_KB.filter(
        pattern => !pattern.affectedProviders || pattern.affectedProviders.includes(provider)
    );
}

/**
 * Find issue patterns by severity
 */
export function getIssuesBySeverity(severity: IssueSeverity): VpnIssuePattern[] {
    return VPN_TROUBLESHOOTING_KB.filter(pattern => pattern.severity === severity);
}

/**
 * Get all critical issues
 */
export function getCriticalIssues(): VpnIssuePattern[] {
    return getIssuesBySeverity('critical');
}

/**
 * Match log output against known patterns
 */
export function matchLogPatterns(logOutput: string): VpnIssuePattern[] {
    const matches: VpnIssuePattern[] = [];

    for (const pattern of VPN_TROUBLESHOOTING_KB) {
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
