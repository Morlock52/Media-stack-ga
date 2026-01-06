/**
 * Docker Networking Troubleshooting Knowledge Module
 * Comprehensive knowledge base for diagnosing and fixing Docker networking issues
 * Covers container isolation, DNS resolution, port conflicts, network modes, and inter-container communication
 */

import { createLogger } from '../utils/logger.js';
import { getErrorMessage } from '../utils/errors.js';

const logger = createLogger('dockerNetworkingKnowledge');

/** Severity level for issues */
export type IssueSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';

/** Docker network modes */
export type NetworkMode = 'bridge' | 'host' | 'none' | 'container' | 'custom';

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

/** Docker networking issue pattern */
export interface DockerNetworkingIssuePattern {
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
    /** Which network modes this affects */
    affectedNetworkModes?: NetworkMode[];
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
 * Docker Networking Troubleshooting Knowledge Base
 */
export const DOCKER_NETWORKING_KB: DockerNetworkingIssuePattern[] = [
    {
        id: 'container-no-internet',
        title: 'Container cannot reach the internet',
        description: 'Container is running but cannot access external websites or APIs. This typically indicates DNS, routing, or firewall issues.',
        severity: 'high',
        symptoms: [
            'wget/curl commands timeout',
            'Package manager cannot download updates',
            'API calls to external services fail',
            'Connection timeout errors in logs',
            'DNS resolution works but connections fail'
        ],
        logPatterns: [
            'connection.*timeout',
            'dial.*timeout',
            'network.*unreachable',
            'no route to host',
            'temporary failure.*resolving',
            'could not resolve host'
        ],
        affectedNetworkModes: ['bridge', 'custom'],
        diagnostics: [
            {
                order: 1,
                description: 'Test basic connectivity from inside container',
                command: 'docker exec <container> ping -c 3 8.8.8.8',
                expectedResult: 'Should receive 3 ping replies',
                interpretation: 'If ping works, network is functional. If ping fails, routing issue exists.'
            },
            {
                order: 2,
                description: 'Test DNS resolution',
                command: 'docker exec <container> nslookup google.com',
                expectedResult: 'Should resolve to IP addresses',
                interpretation: 'If DNS fails, need to configure nameservers. If DNS works but connections fail, firewall or routing issue.'
            },
            {
                order: 3,
                description: 'Test HTTP connectivity',
                command: 'docker exec <container> curl -I https://www.google.com',
                expectedResult: 'Should receive HTTP headers',
                interpretation: 'If this fails but ping works, SSL/TLS or proxy issue.'
            },
            {
                order: 4,
                description: 'Check container DNS configuration',
                command: 'docker exec <container> cat /etc/resolv.conf',
                expectedResult: 'Should show valid nameservers (typically 127.0.0.11 for Docker)',
                interpretation: 'Docker embedded DNS server at 127.0.0.11 should be listed. If missing or wrong, DNS configuration issue.'
            },
            {
                order: 5,
                description: 'Check host network connectivity',
                command: 'ping -c 3 8.8.8.8',
                expectedResult: 'Host should be able to reach internet',
                interpretation: 'If host cannot reach internet, issue is not with Docker configuration.'
            }
        ],
        solutions: [
            {
                title: 'Configure custom DNS servers',
                description: 'Set DNS servers in docker-compose.yml to use reliable public DNS',
                steps: [
                    'Open docker-compose.yml',
                    'Add dns section to the affected service',
                    'Use reliable DNS servers like Cloudflare (1.1.1.1) or Google (8.8.8.8)',
                    'Restart the container'
                ],
                configExample: `services:
  myservice:
    image: myimage
    dns:
      - 1.1.1.1
      - 8.8.8.8
    # Alternative: set custom DNS in /etc/docker/daemon.json`,
                requiresRestart: true,
                notes: 'Docker embedded DNS (127.0.0.11) usually works well. Only override if having issues.'
            },
            {
                title: 'Check Docker daemon DNS configuration',
                description: 'Configure Docker daemon to use correct DNS servers',
                steps: [
                    'Edit /etc/docker/daemon.json on the host',
                    'Add dns section with reliable nameservers',
                    'Restart Docker daemon: sudo systemctl restart docker',
                    'Restart affected containers'
                ],
                configExample: `{
  "dns": ["1.1.1.1", "8.8.8.8"]
}`,
                requiresRestart: true,
                notes: 'This affects all containers. Changes require Docker daemon restart.'
            },
            {
                title: 'Disable IPv6 if not needed',
                description: 'IPv6 issues can cause connectivity problems in dual-stack environments',
                steps: [
                    'Edit /etc/docker/daemon.json',
                    'Set ipv6 to false',
                    'Restart Docker daemon',
                    'Recreate containers'
                ],
                configExample: `{
  "ipv6": false,
  "fixed-cidr-v6": null
}`,
                requiresRestart: true,
                notes: 'Only disable IPv6 if your network does not support it properly.'
            },
            {
                title: 'Check host firewall rules',
                description: 'Ensure host firewall allows Docker traffic',
                steps: [
                    'Check if firewall is blocking Docker: sudo iptables -L -n',
                    'Ensure DOCKER chain has ACCEPT rules',
                    'Check for conflicting firewall rules blocking container traffic',
                    'Restart Docker if firewall rules were modified: sudo systemctl restart docker'
                ],
                requiresRestart: false,
                notes: 'Docker manages its own iptables rules. Manual firewall changes can break Docker networking.'
            }
        ],
        relatedIssues: ['dns-resolution-failed', 'bridge-network-mtu-issue'],
        tags: ['connectivity', 'internet', 'dns', 'routing', 'firewall', 'bridge']
    },
    {
        id: 'inter-container-dns-failed',
        title: 'Containers cannot communicate via DNS names',
        description: 'Containers cannot resolve each other by service name or container name. This is crucial for *arr stack interconnection.',
        severity: 'high',
        symptoms: [
            'nslookup of container name fails',
            'Connection to http://containername fails',
            'Services report "unknown host" errors',
            'Must use IP addresses instead of names',
            'Sonarr/Radarr cannot connect to download client by name'
        ],
        logPatterns: [
            'no such host',
            'unknown host',
            'could not resolve.*name',
            'Name or service not known',
            'Temporary failure.*resolving'
        ],
        affectedNetworkModes: ['bridge', 'custom'],
        diagnostics: [
            {
                order: 1,
                description: 'Test DNS resolution between containers',
                command: 'docker exec <container1> nslookup <container2>',
                expectedResult: 'Should resolve to container2 IP address',
                interpretation: 'If fails, containers are not on the same network or Docker DNS is broken.'
            },
            {
                order: 2,
                description: 'Check which networks containers are connected to',
                command: 'docker inspect <container> --format "{{json .NetworkSettings.Networks}}"',
                expectedResult: 'Containers should share at least one common network',
                interpretation: 'Docker DNS only works for containers on the same network.'
            },
            {
                order: 3,
                description: 'Verify Docker embedded DNS is working',
                command: 'docker exec <container> nslookup google.com',
                expectedResult: 'Should resolve external domains',
                interpretation: 'If external DNS works but container names do not, network configuration issue.'
            },
            {
                order: 4,
                description: 'Check if using legacy link instead of networks',
                command: 'docker inspect <container> --format "{{json .HostConfig.Links}}"',
                expectedResult: 'Should be null or empty (links are deprecated)',
                interpretation: 'Legacy links do not work well with modern Docker. Use networks instead.'
            },
            {
                order: 5,
                description: 'Test ping by container name',
                command: 'docker exec <container1> ping -c 3 <container2>',
                expectedResult: 'Should receive ping replies',
                interpretation: 'If ping works but name resolution fails, application may be using wrong hostname.'
            }
        ],
        solutions: [
            {
                title: 'Create custom bridge network',
                description: 'Use a custom Docker network to enable automatic DNS resolution between containers',
                steps: [
                    'Create a custom bridge network: docker network create mediastack',
                    'Add network to docker-compose.yml',
                    'Assign all services to this network',
                    'Restart containers'
                ],
                configExample: `# Create network first:
# docker network create mediastack

services:
  sonarr:
    image: linuxserver/sonarr
    networks:
      - mediastack

  qbittorrent:
    image: linuxserver/qbittorrent
    networks:
      - mediastack

networks:
  mediastack:
    external: true`,
                requiresRestart: true,
                notes: 'Custom networks provide automatic DNS resolution. Default bridge network does not.'
            },
            {
                title: 'Use docker-compose network (automatic)',
                description: 'Docker Compose automatically creates a network and enables DNS resolution',
                steps: [
                    'Ensure all services are in the same docker-compose.yml file',
                    'Do not specify network_mode for services that need to communicate',
                    'Access services using service name as hostname',
                    'Example: http://qbittorrent:8080 not http://localhost:8080'
                ],
                configExample: `services:
  radarr:
    image: linuxserver/radarr
    # No network_mode specified - uses default compose network

  qbittorrent:
    image: linuxserver/qbittorrent
    # Both services can reach each other via name

# Docker Compose creates 'default' network automatically`,
                requiresRestart: false,
                notes: 'Service names automatically become DNS names within Compose network.'
            },
            {
                title: 'Fix network_mode conflicts',
                description: 'Containers using container:name network mode cannot use DNS names',
                steps: [
                    'Identify services using network_mode: "container:other"',
                    'These services share network stack and must use localhost',
                    'Services NOT using network_mode can communicate via names',
                    'Example: qBittorrent using Gluetun network must be accessed at localhost from Gluetun'
                ],
                configExample: `# When qBittorrent uses Gluetun network:
qbittorrent:
  network_mode: "service:gluetun"
  # qBittorrent WebUI is at localhost:8080 FROM Gluetun's perspective

# Other services reach qBittorrent via Gluetun's ports:
sonarr:
  # Uses gluetun:8080 NOT qbittorrent:8080`,
                requiresRestart: false,
                notes: 'When using network_mode: "container:X", the service shares X network namespace. Use localhost or the host container name.'
            },
            {
                title: 'Use container aliases',
                description: 'Add network aliases for additional DNS names',
                steps: [
                    'Add aliases to service network configuration',
                    'Service will be accessible via multiple names',
                    'Useful for legacy configurations or migrations'
                ],
                configExample: `services:
  qbittorrent:
    networks:
      mediastack:
        aliases:
          - qbt
          - downloadclient
          - torrent`,
                requiresRestart: true,
                notes: 'Aliases provide additional DNS names for the same container.'
            }
        ],
        relatedIssues: ['network-mode-misconfigured', 'localhost-not-working'],
        tags: ['dns', 'inter-container', 'communication', 'network', 'service-name', 'arr-stack']
    },
    {
        id: 'port-conflict',
        title: 'Port already in use / Port conflict',
        description: 'Cannot start container because the port is already allocated to another container or host service.',
        severity: 'high',
        symptoms: [
            'Container fails to start with port error',
            'Error: bind: address already in use',
            'Port 8080 is already allocated',
            'Cannot create container',
            'docker-compose up fails'
        ],
        logPatterns: [
            'port.*already.*allocated',
            'address already in use',
            'bind.*failed',
            'port.*in use',
            'Bind for .* failed'
        ],
        diagnostics: [
            {
                order: 1,
                description: 'Identify what is using the port',
                command: 'sudo lsof -i :<port> OR sudo ss -lptn | grep :<port>',
                expectedResult: 'Shows process or container using the port',
                interpretation: 'This tells you what is occupying the port that you need.'
            },
            {
                order: 2,
                description: 'Check for conflicting Docker containers',
                command: 'docker ps --format "table {{.Names}}\\t{{.Ports}}" | grep <port>',
                expectedResult: 'Shows which container is using the port',
                interpretation: 'If another container is using it, you need to change ports or stop that container.'
            },
            {
                order: 3,
                description: 'Check host services using the port',
                command: 'sudo netstat -tlnp | grep :<port>',
                expectedResult: 'Shows if host service (nginx, apache, etc.) is using port',
                interpretation: 'May need to stop host service or change container port mapping.'
            },
            {
                order: 4,
                description: 'Verify port binding in compose file',
                command: 'grep -A 2 "ports:" docker-compose.yml',
                expectedResult: 'Shows all port mappings',
                interpretation: 'Look for duplicate port mappings or conflicts with known services.'
            }
        ],
        solutions: [
            {
                title: 'Change external port mapping',
                description: 'Map container to a different host port',
                steps: [
                    'Open docker-compose.yml',
                    'Change port mapping from "8080:8080" to "8081:8080"',
                    'Format is "HOST_PORT:CONTAINER_PORT"',
                    'Restart container'
                ],
                configExample: `services:
  sonarr:
    ports:
      - "8989:8989"  # Original
      # If port 8989 is taken, change to:
      - "8990:8989"  # Access at http://localhost:8990`,
                requiresRestart: true,
                notes: 'Only change the host port (left side). Container port (right side) should match what service expects.'
            },
            {
                title: 'Stop conflicting container',
                description: 'Stop the other container using the port',
                steps: [
                    'Identify container using port: docker ps | grep <port>',
                    'Stop that container: docker stop <container_name>',
                    'Start your container',
                    'Or remove the conflicting container if not needed'
                ],
                requiresRestart: false,
                notes: 'Make sure you actually do not need the other container before stopping it.'
            },
            {
                title: 'Use host network mode (advanced)',
                description: 'Run container with host networking (eliminates port mapping)',
                steps: [
                    'Set network_mode: "host" in docker-compose.yml',
                    'Remove ports: section (not needed with host mode)',
                    'Service will bind directly to host interfaces',
                    'Restart container'
                ],
                configExample: `services:
  myservice:
    network_mode: "host"
    # No ports section needed
    # Service binds directly to host ports`,
                requiresRestart: true,
                notes: 'Host mode reduces isolation and is generally not recommended unless necessary. Port conflicts will still occur with host services.'
            },
            {
                title: 'Bind to specific IP address',
                description: 'Bind port to specific network interface to avoid conflicts',
                steps: [
                    'Change port mapping to include IP address',
                    'Format: "IP:HOST_PORT:CONTAINER_PORT"',
                    'Example: bind to localhost only: "127.0.0.1:8080:8080"',
                    'Or bind to specific LAN IP: "192.168.1.100:8080:8080"'
                ],
                configExample: `services:
  sonarr:
    ports:
      - "127.0.0.1:8989:8989"  # Only accessible from localhost
      # OR
      - "192.168.1.50:8989:8989"  # Only accessible from this IP`,
                requiresRestart: true,
                notes: 'Binding to 127.0.0.1 means service is only accessible from the host, not from network.'
            }
        ],
        relatedIssues: ['port-mapping-not-working'],
        tags: ['port', 'conflict', 'address-in-use', 'bind', 'allocation']
    },
    {
        id: 'network-mode-misconfigured',
        title: 'Network mode misconfiguration',
        description: 'Incorrect network_mode setting causing connectivity issues, especially with VPN containers like Gluetun.',
        severity: 'high',
        symptoms: [
            'Service not routing through VPN',
            'Cannot access service WebUI',
            'Port mappings do not work',
            'Service reports connectivity issues',
            'localhost connections fail'
        ],
        logPatterns: [
            'connection refused.*localhost',
            'no route to host',
            'network.*not found'
        ],
        affectedNetworkModes: ['container', 'host', 'none'],
        diagnostics: [
            {
                order: 1,
                description: 'Check current network mode',
                command: 'docker inspect <container> --format "{{.HostConfig.NetworkMode}}"',
                expectedResult: 'Shows network mode (bridge, host, container:name, none)',
                interpretation: 'Identifies which network mode is being used.'
            },
            {
                order: 2,
                description: 'Verify network_mode container exists',
                command: 'docker ps -a | grep <target_container>',
                expectedResult: 'Target container should be running',
                interpretation: 'If using network_mode: "container:X", container X must exist and be running first.'
            },
            {
                order: 3,
                description: 'Check port publishing configuration',
                command: 'docker inspect <container> --format "{{json .HostConfig.PortBindings}}"',
                expectedResult: 'Containers using container:X mode should have no port bindings',
                interpretation: 'Ports must be published on the target container, not the dependent one.'
            },
            {
                order: 4,
                description: 'Test network connectivity from container',
                command: 'docker exec <container> curl -I http://localhost:8080',
                expectedResult: 'Should connect if service is on same network stack',
                interpretation: 'When sharing network with container:X, services in X are accessible at localhost.'
            }
        ],
        solutions: [
            {
                title: 'Configure VPN network_mode correctly',
                description: 'Set up services to route through VPN container (Gluetun)',
                steps: [
                    'Identify service that needs VPN (e.g., qbittorrent)',
                    'Set network_mode: "service:gluetun" on that service',
                    'Remove ports: section from that service',
                    'Add all port mappings to gluetun service instead',
                    'Ensure depends_on: - gluetun is set'
                ],
                configExample: `services:
  gluetun:
    image: qmcgaw/gluetun
    ports:
      - "8080:8080"  # qBittorrent WebUI
      - "6881:6881"  # Torrent port

  qbittorrent:
    image: linuxserver/qbittorrent
    network_mode: "service:gluetun"
    depends_on:
      - gluetun
    # NO ports section here!`,
                requiresRestart: true,
                notes: 'When using network_mode: "service:X", all ports must be published on X, not on the dependent service.'
            },
            {
                title: 'Fix depends_on for network_mode containers',
                description: 'Ensure container dependency order is correct',
                steps: [
                    'Add depends_on to service using network_mode',
                    'Target container must start first',
                    'Use depends_on with condition if available',
                    'Consider using restart: unless-stopped on target'
                ],
                configExample: `services:
  gluetun:
    restart: unless-stopped

  qbittorrent:
    network_mode: "service:gluetun"
    depends_on:
      - gluetun
    restart: unless-stopped`,
                requiresRestart: true,
                notes: 'If target container restarts, dependent containers may need restarting too.'
            },
            {
                title: 'Access services using correct hostname',
                description: 'Use appropriate hostname based on network configuration',
                steps: [
                    'For services on same compose network: use service name (e.g., "sonarr")',
                    'For services sharing network_mode: use "localhost" or "127.0.0.1"',
                    'For services using container:X mode: access via X container name',
                    'Update all service configurations to use correct hostname'
                ],
                configExample: `# Radarr connecting to qBittorrent that uses Gluetun network:
# In Radarr download client settings:
Host: gluetun  # NOT qbittorrent or localhost
Port: 8080     # Port published on gluetun

# If checking from within Gluetun container:
Host: localhost  # Services in same network stack
Port: 8080`,
                requiresRestart: false,
                notes: 'Common mistake: trying to use service name for container using different network_mode.'
            },
            {
                title: 'Switch to custom bridge network instead',
                description: 'Use custom network instead of container network mode (if VPN not required)',
                steps: [
                    'Create custom bridge network',
                    'Remove network_mode from services',
                    'Add all services to the custom network',
                    'Use service names for inter-service communication'
                ],
                configExample: `services:
  service1:
    networks:
      - mynetwork
    ports:
      - "8080:8080"

  service2:
    networks:
      - mynetwork
    # Can reach service1 at http://service1:8080

networks:
  mynetwork:
    driver: bridge`,
                requiresRestart: true,
                notes: 'Custom networks are simpler than container mode if VPN routing is not required.'
            }
        ],
        relatedIssues: ['inter-container-dns-failed', 'localhost-not-working'],
        tags: ['network-mode', 'gluetun', 'vpn', 'container-mode', 'configuration']
    },
    {
        id: 'localhost-not-working',
        title: 'Localhost/127.0.0.1 connections not working',
        description: 'Service cannot connect to localhost or 127.0.0.1, which is expected when services are in different containers.',
        severity: 'medium',
        symptoms: [
            'Connection refused to localhost',
            'Cannot connect to 127.0.0.1',
            'Service works with container name but not localhost',
            'API calls to localhost fail'
        ],
        logPatterns: [
            'connection refused.*127\\.0\\.0\\.1',
            'connection refused.*localhost',
            'dial.*localhost.*failed'
        ],
        affectedNetworkModes: ['bridge', 'custom'],
        diagnostics: [
            {
                order: 1,
                description: 'Test localhost connection',
                command: 'docker exec <container> curl http://localhost:8080',
                expectedResult: 'Should fail unless service is in same container',
                interpretation: 'In Docker, localhost refers to the container itself, not the host or other containers.'
            },
            {
                order: 2,
                description: 'Check what network mode container is using',
                command: 'docker inspect <container> --format "{{.HostConfig.NetworkMode}}"',
                expectedResult: 'Shows network mode',
                interpretation: 'Only services in same network stack (host mode or container:X mode) can use localhost.'
            },
            {
                order: 3,
                description: 'Identify correct hostname to use',
                command: 'docker inspect <target_container> --format "{{.Name}}"',
                expectedResult: 'Shows container name to use as hostname',
                interpretation: 'Use this name instead of localhost in service configurations.'
            }
        ],
        solutions: [
            {
                title: 'Use container name instead of localhost',
                description: 'Replace localhost with the actual container/service name',
                steps: [
                    'Identify target container name (from docker-compose.yml service name)',
                    'Replace localhost with container name in configuration',
                    'Example: change http://localhost:8080 to http://qbittorrent:8080',
                    'Ensure both containers are on same Docker network',
                    'Restart service'
                ],
                configExample: `# Sonarr download client configuration:
# WRONG:
Host: localhost
Port: 8080

# CORRECT:
Host: qbittorrent  # Service name from docker-compose.yml
Port: 8080`,
                requiresRestart: false,
                notes: 'This is the most common Docker networking mistake. Localhost means the container itself, not other containers.'
            },
            {
                title: 'Use host.docker.internal for host services',
                description: 'Access services running on Docker host from containers',
                steps: [
                    'Use host.docker.internal as hostname',
                    'This special DNS name resolves to host gateway IP',
                    'Works on Docker Desktop automatically',
                    'On Linux, add --add-host=host.docker.internal:host-gateway'
                ],
                configExample: `services:
  myservice:
    extra_hosts:
      - "host.docker.internal:host-gateway"
    # Now can access host services at:
    # http://host.docker.internal:port`,
                requiresRestart: true,
                notes: 'Use this to access services running on the host machine (outside Docker).'
            },
            {
                title: 'Use host network mode (if appropriate)',
                description: 'Run container with host networking to enable localhost access',
                steps: [
                    'Set network_mode: "host" in docker-compose.yml',
                    'Container will use host network stack directly',
                    'localhost will refer to actual host',
                    'Remove port mappings (not needed in host mode)'
                ],
                configExample: `services:
  myservice:
    network_mode: "host"
    # No ports section needed
    # localhost now refers to host machine`,
                requiresRestart: true,
                notes: 'Host mode reduces isolation. Only use if necessary. Not recommended for most use cases.'
            },
            {
                title: 'Share network namespace for localhost access',
                description: 'Use network_mode: "container:X" to share network stack',
                steps: [
                    'If two services need to communicate via localhost',
                    'Make one use network_mode: "container:other"',
                    'Both will share same network namespace',
                    'localhost will work between them'
                ],
                configExample: `services:
  service1:
    ports:
      - "8080:8080"

  service2:
    network_mode: "service:service1"
    # Can now reach service1 at localhost:8080`,
                requiresRestart: true,
                notes: 'This is mainly useful for sidecar patterns or VPN setups like Gluetun.'
            }
        ],
        relatedIssues: ['inter-container-dns-failed', 'network-mode-misconfigured'],
        tags: ['localhost', '127.0.0.1', 'host', 'inter-container', 'dns']
    },
    {
        id: 'dns-resolution-failed',
        title: 'DNS resolution failures in containers',
        description: 'Containers cannot resolve domain names, causing external and internal connectivity issues.',
        severity: 'high',
        symptoms: [
            'nslookup/dig commands fail',
            'External domains do not resolve',
            'Temporary failure in name resolution',
            'Could not resolve host',
            'Package installations fail'
        ],
        logPatterns: [
            'could not resolve',
            'name resolution.*fail',
            'temporary failure.*resolving',
            'no such host',
            'unknown host',
            'Name or service not known'
        ],
        diagnostics: [
            {
                order: 1,
                description: 'Test external DNS resolution',
                command: 'docker exec <container> nslookup google.com',
                expectedResult: 'Should resolve to IP addresses',
                interpretation: 'If fails, DNS configuration is broken.'
            },
            {
                order: 2,
                description: 'Check container DNS configuration',
                command: 'docker exec <container> cat /etc/resolv.conf',
                expectedResult: 'Should show nameservers (typically 127.0.0.11 for Docker)',
                interpretation: 'If empty or invalid, DNS not configured properly.'
            },
            {
                order: 3,
                description: 'Test Docker embedded DNS server',
                command: 'docker exec <container> nslookup google.com 127.0.0.11',
                expectedResult: 'Should resolve if Docker DNS is working',
                interpretation: 'Docker runs embedded DNS at 127.0.0.11. If this fails, Docker DNS issue.'
            },
            {
                order: 4,
                description: 'Test host DNS resolution',
                command: 'nslookup google.com',
                expectedResult: 'Should work on host',
                interpretation: 'If host DNS fails, issue is not with Docker.'
            },
            {
                order: 5,
                description: 'Check Docker daemon DNS settings',
                command: 'sudo cat /etc/docker/daemon.json',
                expectedResult: 'May show custom DNS configuration',
                interpretation: 'Daemon-level DNS settings affect all containers.'
            }
        ],
        solutions: [
            {
                title: 'Configure container DNS servers',
                description: 'Set reliable DNS servers in container configuration',
                steps: [
                    'Add dns section to service in docker-compose.yml',
                    'Use public DNS: Cloudflare (1.1.1.1), Google (8.8.8.8), Quad9 (9.9.9.9)',
                    'Restart container',
                    'Verify with: docker exec <container> cat /etc/resolv.conf'
                ],
                configExample: `services:
  myservice:
    dns:
      - 1.1.1.1
      - 8.8.8.8
    # Alternatively, use dns_search for domain suffixes:
    dns_search:
      - example.com`,
                requiresRestart: true,
                notes: 'This overrides Docker embedded DNS. Usually only needed when Docker DNS is broken.'
            },
            {
                title: 'Fix Docker daemon DNS configuration',
                description: 'Configure Docker daemon to use correct DNS servers for all containers',
                steps: [
                    'Edit /etc/docker/daemon.json',
                    'Add dns array with reliable nameservers',
                    'Restart Docker daemon: sudo systemctl restart docker',
                    'Recreate containers to pick up new settings'
                ],
                configExample: `{
  "dns": ["1.1.1.1", "8.8.8.8"],
  "dns-opts": ["ndots:0"]
}`,
                requiresRestart: true,
                notes: 'This affects all containers. Requires Docker daemon restart.'
            },
            {
                title: 'Disable systemd-resolved if conflicting',
                description: 'systemd-resolved can interfere with Docker DNS on some Linux systems',
                steps: [
                    'Check if systemd-resolved is running: systemctl status systemd-resolved',
                    'If causing issues, disable it: sudo systemctl disable systemd-resolved',
                    'Configure /etc/resolv.conf manually with nameservers',
                    'Restart Docker daemon'
                ],
                configExample: `# /etc/resolv.conf after disabling systemd-resolved:
nameserver 1.1.1.1
nameserver 8.8.8.8`,
                requiresRestart: true,
                notes: 'Only do this if you understand the implications. May affect host networking.'
            },
            {
                title: 'Use network-specific DNS settings',
                description: 'Configure DNS for specific Docker networks',
                steps: [
                    'Define custom network with DNS configuration',
                    'Assign services to this network',
                    'Network-level DNS settings apply to all connected containers'
                ],
                configExample: `networks:
  mynetwork:
    driver: bridge
    driver_opts:
      com.docker.network.bridge.name: br-mynetwork
    ipam:
      config:
        - subnet: 172.20.0.0/16
          gateway: 172.20.0.1
    # Note: DNS must be set per-container, not per-network in compose`,
                requiresRestart: true,
                notes: 'Network-level DNS options are limited in docker-compose. Use container-level dns: instead.'
            },
            {
                title: 'Check for VPN DNS conflicts',
                description: 'VPN containers may override DNS settings',
                steps: [
                    'If using Gluetun or VPN, check VPN DNS configuration',
                    'VPN may force its own DNS servers',
                    'Configure VPN DNS settings (DOT_PROVIDERS, DNS_ADDRESS)',
                    'See VPN troubleshooting for details'
                ],
                envVars: {
                    'DOT': 'on',
                    'DOT_PROVIDERS': 'cloudflare'
                },
                requiresRestart: true,
                notes: 'Containers using VPN network_mode inherit VPN DNS settings.'
            }
        ],
        relatedIssues: ['container-no-internet', 'inter-container-dns-failed'],
        tags: ['dns', 'resolution', 'nameserver', 'resolv.conf', 'networking']
    },
    {
        id: 'port-mapping-not-working',
        title: 'Port mapping not accessible from outside',
        description: 'Published ports are not accessible from host or network, even though container is running.',
        severity: 'medium',
        symptoms: [
            'Cannot access service WebUI from browser',
            'Port appears in docker ps but connection refused',
            'Telnet to port fails',
            'Service works inside container but not externally'
        ],
        logPatterns: [
            'connection refused',
            'no route to host'
        ],
        diagnostics: [
            {
                order: 1,
                description: 'Verify port mapping is configured',
                command: 'docker ps --format "{{.Names}}: {{.Ports}}"',
                expectedResult: 'Should show port mapping like 0.0.0.0:8080->8080/tcp',
                interpretation: 'If port not shown, not properly mapped in docker-compose.yml.'
            },
            {
                order: 2,
                description: 'Test port from inside container',
                command: 'docker exec <container> curl http://localhost:8080',
                expectedResult: 'Should connect successfully',
                interpretation: 'If this works but external access fails, port mapping or firewall issue.'
            },
            {
                order: 3,
                description: 'Test port from Docker host',
                command: 'curl http://localhost:8080',
                expectedResult: 'Should connect to container service',
                interpretation: 'If works from host but not from network, host firewall blocking external access.'
            },
            {
                order: 4,
                description: 'Check if service is listening',
                command: 'docker exec <container> netstat -tlnp | grep 8080',
                expectedResult: 'Should show service listening on port',
                interpretation: 'If not listening, service configuration issue (not Docker issue).'
            },
            {
                order: 5,
                description: 'Check host firewall',
                command: 'sudo iptables -L -n | grep 8080',
                expectedResult: 'Should show ACCEPT rule for Docker',
                interpretation: 'If blocked, firewall preventing access.'
            }
        ],
        solutions: [
            {
                title: 'Fix port mapping syntax',
                description: 'Ensure correct port mapping format in docker-compose.yml',
                steps: [
                    'Check port mapping syntax: "HOST_PORT:CONTAINER_PORT"',
                    'Ensure using string format with quotes',
                    'Verify container port matches service configuration',
                    'Restart container'
                ],
                configExample: `services:
  sonarr:
    ports:
      - "8989:8989"  # Correct: string format
      # NOT:
      # - 8989:8989  # Works but less clear

      # For specific IP binding:
      - "192.168.1.50:8989:8989"

      # Multiple ports:
      - "8080:8080"
      - "8081:8081"`,
                requiresRestart: true,
                notes: 'Format is "HOST_IP:HOST_PORT:CONTAINER_PORT" or "HOST_PORT:CONTAINER_PORT".'
            },
            {
                title: 'Ensure service is listening on 0.0.0.0',
                description: 'Service must bind to 0.0.0.0 or all interfaces inside container',
                steps: [
                    'Check service configuration inside container',
                    'Ensure service is not binding only to 127.0.0.1',
                    'Configure service to listen on 0.0.0.0 or all interfaces',
                    'Example: change listen address from 127.0.0.1 to 0.0.0.0'
                ],
                configExample: `# Inside container service config:
# WRONG:
listen: 127.0.0.1:8080  # Only accessible within container

# CORRECT:
listen: 0.0.0.0:8080    # Accessible from outside container
# OR
listen: :8080           # Same as 0.0.0.0:8080`,
                requiresRestart: true,
                notes: 'If service only listens on 127.0.0.1 inside container, port mapping will not work.'
            },
            {
                title: 'Allow port through host firewall',
                description: 'Configure host firewall to allow Docker port',
                steps: [
                    'Check current firewall rules: sudo iptables -L -n',
                    'If using ufw: sudo ufw allow 8080/tcp',
                    'If using firewalld: sudo firewall-cmd --add-port=8080/tcp --permanent',
                    'Reload firewall rules',
                    'Test port access again'
                ],
                requiresRestart: false,
                notes: 'Docker should auto-configure iptables, but manual firewall rules may override.'
            },
            {
                title: 'Verify network_mode compatibility',
                description: 'Port mappings do not work with certain network modes',
                steps: [
                    'Check network mode: docker inspect <container> --format "{{.HostConfig.NetworkMode}}"',
                    'If using network_mode: "container:X", ports must be published on container X',
                    'If using network_mode: "host", no port mapping needed (direct access)',
                    'If using network_mode: "none", container has no network access',
                    'Switch to bridge mode if port mapping needed'
                ],
                configExample: `# Port mapping only works with bridge mode:
services:
  myservice:
    # network_mode: bridge  # Default
    ports:
      - "8080:8080"

# With container mode, publish on target:
  gluetun:
    ports:
      - "8080:8080"  # qBittorrent port

  qbittorrent:
    network_mode: "service:gluetun"  # No ports here!`,
                requiresRestart: true,
                notes: 'Container network mode and host mode have different port behaviors.'
            },
            {
                title: 'Check Docker iptables configuration',
                description: 'Ensure Docker can modify iptables for port forwarding',
                steps: [
                    'Check /etc/docker/daemon.json for iptables: false',
                    'If iptables disabled, Docker cannot forward ports automatically',
                    'Set "iptables": true in daemon.json',
                    'Restart Docker daemon: sudo systemctl restart docker'
                ],
                configExample: `{
  "iptables": true,
  "ip-forward": true
}`,
                requiresRestart: true,
                notes: 'Docker requires iptables access to forward ports. Disabling it breaks port mapping.'
            }
        ],
        relatedIssues: ['port-conflict', 'network-mode-misconfigured'],
        tags: ['port-mapping', 'firewall', 'iptables', 'accessibility', 'ports']
    },
    {
        id: 'bridge-network-mtu-issue',
        title: 'MTU (Maximum Transmission Unit) issues causing packet loss',
        description: 'Incorrect MTU settings causing intermittent connectivity issues, slow transfers, or packet fragmentation.',
        severity: 'medium',
        symptoms: [
            'Intermittent connection timeouts',
            'Slow download speeds despite good bandwidth',
            'Large file transfers fail',
            'Small requests work but large responses timeout',
            'Some websites load, others do not'
        ],
        logPatterns: [
            'packet.*too.*large',
            'MTU',
            'fragmentation',
            'message too long'
        ],
        affectedNetworkModes: ['bridge', 'custom'],
        diagnostics: [
            {
                order: 1,
                description: 'Check current MTU setting',
                command: 'docker network inspect bridge --format "{{.Options}}"',
                expectedResult: 'Shows MTU setting (typically 1500)',
                interpretation: 'If MTU is higher than host MTU, packets will be fragmented or dropped.'
            },
            {
                order: 2,
                description: 'Check host interface MTU',
                command: 'ip link show | grep mtu',
                expectedResult: 'Shows MTU for all interfaces',
                interpretation: 'Docker bridge MTU should not exceed host interface MTU.'
            },
            {
                order: 3,
                description: 'Test with large packet',
                command: 'docker exec <container> ping -M do -s 1472 8.8.8.8',
                expectedResult: 'Should succeed without fragmentation',
                interpretation: 'If fails, MTU too high. Try smaller packet: ping -s 1400'
            },
            {
                order: 4,
                description: 'Check container interface MTU',
                command: 'docker exec <container> ip link show eth0',
                expectedResult: 'Shows container interface MTU',
                interpretation: 'Should match Docker network MTU setting.'
            }
        ],
        solutions: [
            {
                title: 'Set Docker bridge MTU',
                description: 'Configure Docker default bridge network MTU',
                steps: [
                    'Edit /etc/docker/daemon.json',
                    'Set mtu to appropriate value (usually 1500 or 1450)',
                    'For VPN/PPPoE: use 1400 or 1350',
                    'Restart Docker daemon',
                    'Recreate containers'
                ],
                configExample: `{
  "mtu": 1450
}`,
                requiresRestart: true,
                notes: 'Common values: 1500 (standard Ethernet), 1450 (VPN/tunnel), 9000 (jumbo frames in datacenter).'
            },
            {
                title: 'Set MTU for custom network',
                description: 'Configure MTU for specific Docker network',
                steps: [
                    'Define MTU in network driver options',
                    'Apply to custom bridge network',
                    'Recreate containers using this network'
                ],
                configExample: `networks:
  mynetwork:
    driver: bridge
    driver_opts:
      com.docker.network.driver.mtu: 1450`,
                requiresRestart: true,
                notes: 'This only affects the specific network, not all Docker networks.'
            },
            {
                title: 'Detect optimal MTU automatically',
                description: 'Find the correct MTU by testing packet sizes',
                steps: [
                    'From container, ping with Do Not Fragment flag and decreasing size',
                    'Start at 1500: docker exec <container> ping -M do -s 1472 8.8.8.8',
                    'If fails, try 1400: ping -M do -s 1372 8.8.8.8',
                    'Continue until finding largest working size',
                    'Add 28 bytes (IP+ICMP headers) to get MTU',
                    'Configure Docker with this MTU'
                ],
                requiresRestart: false,
                notes: 'Ping size is MTU minus 28 bytes. Working size of 1472 = MTU of 1500.'
            },
            {
                title: 'Enable MSS clamping for VPN',
                description: 'Configure TCP MSS clamping to avoid fragmentation over VPN',
                steps: [
                    'Add iptables rule to clamp MSS on VPN interface',
                    'For Gluetun, configure firewall rules',
                    'Set FIREWALL_VPN_MSS_CLAMPING environment variable'
                ],
                envVars: {
                    'FIREWALL_VPN_MSS_CLAMPING': '1400'
                },
                configExample: `# For Gluetun:
gluetun:
  environment:
    - FIREWALL_VPN_MSS_CLAMPING=1400

# Or manual iptables:
# iptables -t mangle -A FORWARD -p tcp --tcp-flags SYN,RST SYN -j TCPMSS --set-mss 1400`,
                requiresRestart: true,
                notes: 'MSS clamping adjusts TCP segment size to prevent fragmentation. Useful for VPN/PPPoE.'
            }
        ],
        relatedIssues: ['container-no-internet', 'slow-transfer-speeds'],
        tags: ['mtu', 'packet-loss', 'fragmentation', 'performance', 'vpn']
    },
    {
        id: 'ipv6-connectivity-issue',
        title: 'IPv6 connectivity problems',
        description: 'Issues with IPv6 networking causing dual-stack connectivity problems or service failures.',
        severity: 'low',
        symptoms: [
            'Some connections fail randomly',
            'Timeouts on certain networks',
            'IPv6 addresses shown but not working',
            'Prefer IPv4 for connections',
            'Error: Cannot assign requested address (IPv6)'
        ],
        logPatterns: [
            'IPv6',
            'address family not supported',
            'Cannot assign requested address.*::',
            'Network unreachable.*::'
        ],
        diagnostics: [
            {
                order: 1,
                description: 'Check if IPv6 is enabled in Docker',
                command: 'docker network inspect bridge --format "{{.EnableIPv6}}"',
                expectedResult: 'Shows true or false',
                interpretation: 'If IPv6 enabled but not working, can cause issues.'
            },
            {
                order: 2,
                description: 'Test IPv6 connectivity from container',
                command: 'docker exec <container> ping6 -c 3 2001:4860:4860::8888',
                expectedResult: 'Should ping Google IPv6 DNS',
                interpretation: 'If fails, IPv6 not properly configured.'
            },
            {
                order: 3,
                description: 'Check host IPv6 support',
                command: 'ping6 -c 3 2001:4860:4860::8888',
                expectedResult: 'Should work on host if IPv6 available',
                interpretation: 'If host has no IPv6, containers cannot use it either.'
            }
        ],
        solutions: [
            {
                title: 'Disable IPv6 in Docker',
                description: 'Disable IPv6 to avoid dual-stack issues',
                steps: [
                    'Edit /etc/docker/daemon.json',
                    'Set ipv6 to false',
                    'Remove fixed-cidr-v6 if present',
                    'Restart Docker daemon',
                    'Recreate containers'
                ],
                configExample: `{
  "ipv6": false
}`,
                requiresRestart: true,
                notes: 'Disabling IPv6 is recommended if your network does not support it properly.'
            },
            {
                title: 'Properly enable IPv6',
                description: 'Configure IPv6 correctly if needed',
                steps: [
                    'Edit /etc/docker/daemon.json',
                    'Enable ipv6 and set fixed-cidr-v6',
                    'Restart Docker daemon',
                    'Verify containers get IPv6 addresses'
                ],
                configExample: `{
  "ipv6": true,
  "fixed-cidr-v6": "2001:db8:1::/64"
}`,
                requiresRestart: true,
                notes: 'Only enable if your network and ISP support IPv6. Requires proper subnet configuration.'
            },
            {
                title: 'Prefer IPv4 in containers',
                description: 'Configure applications to prefer IPv4',
                steps: [
                    'Set environment variable PREFER_IPV4=true',
                    'Or configure application to use IPv4 only',
                    'Some apps have prefer_ipv4 or ipv6_disabled options'
                ],
                configExample: `services:
  myservice:
    environment:
      - PREFER_IPV4=true
      # Or Java apps:
      - JAVA_OPTS=-Djava.net.preferIPv4Stack=true`,
                requiresRestart: true,
                notes: 'This is app-specific. Check application documentation.'
            }
        ],
        relatedIssues: ['container-no-internet', 'dns-resolution-failed'],
        tags: ['ipv6', 'dual-stack', 'connectivity', 'addressing']
    },
    {
        id: 'container-network-isolation',
        title: 'Container cannot reach specific networks or subnets',
        description: 'Container can reach some networks but not others, indicating routing or firewall rules blocking specific subnets.',
        severity: 'medium',
        symptoms: [
            'Can reach internet but not local network',
            'Can reach some containers but not others',
            'Specific IP ranges unreachable',
            'VPN blocking local network access'
        ],
        logPatterns: [
            'no route to host',
            'network unreachable',
            'host unreachable'
        ],
        diagnostics: [
            {
                order: 1,
                description: 'Test connectivity to different networks',
                command: 'docker exec <container> ping -c 3 <target_ip>',
                expectedResult: 'Shows which networks are reachable',
                interpretation: 'Identify pattern of which networks work and which do not.'
            },
            {
                order: 2,
                description: 'Check routing table',
                command: 'docker exec <container> ip route',
                expectedResult: 'Shows routing rules',
                interpretation: 'Look for default route and specific network routes.'
            },
            {
                order: 3,
                description: 'Check if firewall blocking subnet',
                command: 'docker exec <container> traceroute <target_ip>',
                expectedResult: 'Shows where packets are being dropped',
                interpretation: 'If stops at certain hop, routing or firewall issue at that point.'
            }
        ],
        solutions: [
            {
                title: 'Add route to specific subnet',
                description: 'Configure container to route specific networks',
                steps: [
                    'Add extra_hosts or network routes',
                    'For VPN containers, configure FIREWALL_OUTBOUND_SUBNETS',
                    'For custom networks, check IPAM configuration'
                ],
                configExample: `services:
  myservice:
    extra_hosts:
      - "myserver.local:192.168.1.50"

# For Gluetun with local network access:
gluetun:
  environment:
    - FIREWALL_OUTBOUND_SUBNETS=192.168.0.0/16,172.16.0.0/12`,
                requiresRestart: true,
                notes: 'FIREWALL_OUTBOUND_SUBNETS allows VPN containers to access local networks.'
            },
            {
                title: 'Configure network IPAM',
                description: 'Set up IP Address Management for custom networks',
                steps: [
                    'Define ipam configuration in network',
                    'Set subnet and gateway appropriately',
                    'Ensure no conflicts with existing networks'
                ],
                configExample: `networks:
  mynetwork:
    driver: bridge
    ipam:
      config:
        - subnet: 172.20.0.0/16
          gateway: 172.20.0.1`,
                requiresRestart: true,
                notes: 'Proper IPAM configuration prevents subnet conflicts.'
            },
            {
                title: 'Allow traffic through host firewall',
                description: 'Configure host firewall to allow Docker network traffic',
                steps: [
                    'Identify Docker network subnet',
                    'Add firewall rule to allow traffic',
                    'Ensure FORWARD chain allows Docker traffic'
                ],
                configExample: `# Allow Docker network 172.17.0.0/16:
sudo iptables -A FORWARD -s 172.17.0.0/16 -j ACCEPT
sudo iptables -A FORWARD -d 172.17.0.0/16 -j ACCEPT`,
                requiresRestart: false,
                notes: 'Docker usually manages these rules automatically. Only modify if having issues.'
            }
        ],
        relatedIssues: ['container-no-internet', 'vpn-healthy-but-no-connection'],
        tags: ['routing', 'isolation', 'firewall', 'subnet', 'vpn']
    }
];

/**
 * Search knowledge base by tags, symptoms, or keywords
 */
export function searchDockerNetworkingKnowledge(query: string): DockerNetworkingIssuePattern[] {
    const searchTerms = query.toLowerCase().split(/\s+/);
    const results: Array<{ pattern: DockerNetworkingIssuePattern; score: number }> = [];

    for (const pattern of DOCKER_NETWORKING_KB) {
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

    logger.debug({ query, resultCount: results.length }, 'Docker networking knowledge search completed');

    return results.map(r => r.pattern);
}

/**
 * Find issue patterns by network mode
 */
export function getIssuesByNetworkMode(networkMode: NetworkMode): DockerNetworkingIssuePattern[] {
    return DOCKER_NETWORKING_KB.filter(
        pattern => !pattern.affectedNetworkModes || pattern.affectedNetworkModes.includes(networkMode)
    );
}

/**
 * Find issue patterns by severity
 */
export function getIssuesBySeverity(severity: IssueSeverity): DockerNetworkingIssuePattern[] {
    return DOCKER_NETWORKING_KB.filter(pattern => pattern.severity === severity);
}

/**
 * Get all critical issues
 */
export function getCriticalIssues(): DockerNetworkingIssuePattern[] {
    return getIssuesBySeverity('critical');
}

/**
 * Get all high severity issues
 */
export function getHighSeverityIssues(): DockerNetworkingIssuePattern[] {
    return getIssuesBySeverity('high');
}

/**
 * Match log output against known patterns
 */
export function matchLogPatterns(logOutput: string): DockerNetworkingIssuePattern[] {
    const matches: DockerNetworkingIssuePattern[] = [];

    for (const pattern of DOCKER_NETWORKING_KB) {
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
export function getRelatedIssues(issueId: string): DockerNetworkingIssuePattern[] {
    const issue = DOCKER_NETWORKING_KB.find(p => p.id === issueId);
    if (!issue || !issue.relatedIssues) {
        return [];
    }

    return DOCKER_NETWORKING_KB.filter(p => issue.relatedIssues!.includes(p.id));
}

/**
 * Get issue by ID
 */
export function getIssueById(issueId: string): DockerNetworkingIssuePattern | undefined {
    return DOCKER_NETWORKING_KB.find(p => p.id === issueId);
}
