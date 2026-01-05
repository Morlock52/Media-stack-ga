/**
 * Diagnostic Tools for Media Stack Troubleshooting
 * Specialized diagnostic capabilities for VPN connectivity, Arr interconnection, and media scanning issues
 * Works with knowledge base modules to provide detailed analysis and recommendations
 *
 * Tools: diagnose_vpn_connectivity, diagnose_arr_connections, diagnose_media_scanner
 *
 * Security: Input validation with allowlists to prevent injection
 * Updated: January 2026
 */

import { runCommand } from '../utils/docker.js';
import { createLogger } from '../utils/logger.js';
import { getErrorMessage } from '../utils/errors.js';
import {
    VPN_TROUBLESHOOTING_KB,
    searchVpnKnowledge,
    matchLogPatterns as matchVpnLogPatterns,
    type VpnIssuePattern,
    type DiagnosticStep,
    type Solution
} from '../knowledge/vpnTroubleshooting.js';
import {
    ARR_INTERCONNECTION_KB,
    matchLogPatterns as matchArrLogPatterns,
    type ArrInterconnectionIssuePattern,
    type ArrService,
    type DownloadClient
} from '../knowledge/arrInterconnection.js';
import {
    MEDIA_SCANNING_KB,
    matchLogPatterns as matchMediaLogPatterns,
    getIssueById as getMediaIssueById,
    getScanningIssues,
    getPermissionIssues,
    type MediaScanningIssuePattern,
    type MediaServer
} from '../knowledge/mediaScanning.js';
import { checkServiceHealth, type ServiceHealth, type ToolResult } from './agentTools.js';
import * as arrService from '../services/arrService.js';

const logger = createLogger('diagnosticTools');

// Security: Allowlist of valid service names to prevent injection
const ALLOWED_SERVICES = new Set([
    'plex', 'jellyfin', 'emby', 'sonarr', 'radarr', 'prowlarr', 'lidarr',
    'readarr', 'bazarr', 'overseerr', 'tautulli', 'qbittorrent', 'sabnzbd',
    'nzbget', 'transmission', 'deluge', 'gluetun', 'traefik', 'nginx',
    'authelia', 'cloudflared', 'portainer', 'watchtower', 'homepage',
    'homarr', 'organizr', 'flaresolverr', 'recyclarr', 'notifiarr',
    'autobrr', 'unpackerr', 'tdarr', 'handbrake', 'makemkv'
]);

// Validate service name against allowlist
function validateServiceName(name: string | undefined): { valid: boolean; sanitized?: string; error?: string } {
    if (!name || typeof name !== 'string') {
        return { valid: false, error: 'Service name is required' };
    }

    const sanitized = name.toLowerCase().trim().replace(/[^a-z0-9_-]/g, '');

    if (sanitized.length === 0) {
        return { valid: false, error: 'Invalid service name format' };
    }

    if (sanitized.length > 64) {
        return { valid: false, error: 'Service name too long' };
    }

    // Check if it matches a known service or follows valid Docker naming
    const isAllowed = ALLOWED_SERVICES.has(sanitized) ||
                      Array.from(ALLOWED_SERVICES).some(s => sanitized.startsWith(s + '_') || sanitized.startsWith(s + '-'));

    if (!isAllowed) {
        logger.warn({ serviceName: sanitized }, 'Service name not in allowlist, proceeding with caution');
    }

    return { valid: true, sanitized };
}

/**
 * Diagnostic check result
 */
export interface DiagnosticCheck {
    /** Check name/description */
    check: string;
    /** Status: pass, fail, skip, unknown */
    status: 'pass' | 'fail' | 'skip' | 'unknown';
    /** Detailed message */
    message?: string;
    /** Raw output from command */
    output?: string;
    /** Expected result */
    expected?: string;
    /** Actual result */
    actual?: string;
}

/**
 * VPN diagnostic result data
 */
export interface VpnDiagnosticData {
    /** Overall VPN health status */
    vpnHealthy: boolean;
    /** Gluetun service health */
    gluetunService?: ServiceHealth;
    /** Diagnostic checks performed */
    checks: DiagnosticCheck[];
    /** Matched issue patterns from knowledge base */
    matchedIssues: Array<{
        issue: VpnIssuePattern;
        confidence: 'high' | 'medium' | 'low';
        reason: string;
    }>;
    /** Recommended solutions */
    recommendations: Array<{
        title: string;
        description: string;
        priority: 'critical' | 'high' | 'medium' | 'low';
        solution: Solution;
    }>;
    /** Summary message */
    summary: string;
    /** Related services that may be affected */
    affectedServices?: string[];
}

/**
 * Arr interconnection diagnostic result data
 */
export interface ArrDiagnosticData {
    /** Overall health of Arr interconnections */
    healthy: boolean;
    /** Status of each Arr service */
    services: Array<{
        name: string;
        running: boolean;
        apiKeyValid?: boolean;
        reachable?: boolean;
        issues?: string[];
    }>;
    /** Download client connectivity */
    downloadClients: Array<{
        name: string;
        running: boolean;
        reachable?: boolean;
        configured?: boolean;
        issues?: string[];
    }>;
    /** Diagnostic checks performed */
    checks: DiagnosticCheck[];
    /** Matched issue patterns from knowledge base */
    matchedIssues: Array<{
        issue: ArrInterconnectionIssuePattern;
        confidence: 'high' | 'medium' | 'low';
        reason: string;
    }>;
    /** Recommended solutions */
    recommendations: Array<{
        title: string;
        description: string;
        priority: 'critical' | 'high' | 'medium' | 'low';
        solution: Solution;
    }>;
    /** Summary message */
    summary: string;
    /** Configuration issues detected */
    configurationIssues?: Array<{
        service: string;
        issue: string;
        severity: 'critical' | 'high' | 'medium' | 'low';
    }>;
}

/**
 * Media scanner diagnostic result data
 */
export interface MediaScannerDiagnosticData {
    /** Overall health of media server scanning */
    healthy: boolean;
    /** Media servers detected and their status */
    servers: Array<{
        name: MediaServer;
        running: boolean;
        containerName?: string;
        issues?: string[];
    }>;
    /** Library path checks */
    libraryPaths: Array<{
        path: string;
        accessible: boolean;
        hasMedia?: boolean;
        fileCount?: number;
        issues?: string[];
    }>;
    /** File permission checks */
    permissions: {
        puid?: string;
        pgid?: string;
        configured: boolean;
        issues?: string[];
    };
    /** File naming convention checks */
    namingConventions: {
        checked: boolean;
        sampleFiles?: string[];
        issues?: string[];
    };
    /** Diagnostic checks performed */
    checks: DiagnosticCheck[];
    /** Matched issue patterns from knowledge base */
    matchedIssues: Array<{
        issue: MediaScanningIssuePattern;
        confidence: 'high' | 'medium' | 'low';
        reason: string;
    }>;
    /** Recommended solutions */
    recommendations: Array<{
        title: string;
        description: string;
        priority: 'critical' | 'high' | 'medium' | 'low';
        solution: Solution;
    }>;
    /** Summary message */
    summary: string;
}

/**
 * Run a single diagnostic step safely
 */
async function runDiagnosticStep(step: DiagnosticStep): Promise<DiagnosticCheck> {
    if (!step.command) {
        return {
            check: step.description,
            status: 'skip',
            message: 'No command specified',
            expected: step.expectedResult
        };
    }

    try {
        // Parse command and args
        const parts = step.command.split(/\s+/);
        const command = parts[0];
        const args = parts.slice(1);

        // Execute with timeout
        const output = await runCommand(command, args, { timeoutMs: 10000 });

        // Determine if check passed based on output
        let status: DiagnosticCheck['status'] = 'unknown';
        let message = '';

        if (step.expectedResult) {
            // Simple pattern matching against expected result
            const expectedLower = step.expectedResult.toLowerCase();
            const outputLower = output.toLowerCase();

            if (expectedLower.includes('should return') || expectedLower.includes('should show')) {
                // Extract what we're looking for
                const lookingFor = expectedLower.split(/should return|should show/)[1]?.trim();
                if (lookingFor && outputLower.includes(lookingFor.replace(/['"]/g, ''))) {
                    status = 'pass';
                    message = 'Output matches expected result';
                } else if (output.trim()) {
                    status = 'fail';
                    message = 'Output does not match expected result';
                } else {
                    status = 'fail';
                    message = 'No output received';
                }
            } else if (output.trim()) {
                status = 'pass';
                message = 'Command executed successfully';
            } else {
                status = 'fail';
                message = 'No output received';
            }
        } else if (output.trim()) {
            status = 'pass';
            message = 'Command executed successfully';
        }

        return {
            check: step.description,
            status,
            message,
            output: output.trim().substring(0, 500), // Limit output length
            expected: step.expectedResult,
            actual: output.trim().substring(0, 200)
        };
    } catch (err: unknown) {
        return {
            check: step.description,
            status: 'fail',
            message: getErrorMessage(err),
            expected: step.expectedResult
        };
    }
}

/**
 * Diagnose VPN connectivity issues
 *
 * This tool checks:
 * - Gluetun container health and logs
 * - Routing configuration (network_mode)
 * - DNS resolution through VPN
 * - Port forwarding configuration
 * - Service network attachment
 *
 * @param options Diagnostic options
 * @returns Detailed VPN diagnostic analysis with recommendations
 */
export async function diagnoseVpnConnectivity(options: {
    /** Services to check for VPN routing (defaults to common download clients) */
    dependentServices?: string[];
    /** Include detailed log analysis */
    includeLogAnalysis?: boolean;
    /** Number of log lines to analyze */
    logLines?: number;
} = {}): Promise<ToolResult<VpnDiagnosticData>> {
    const {
        dependentServices = ['qbittorrent', 'transmission', 'deluge', 'prowlarr'],
        includeLogAnalysis = true,
        logLines = 100
    } = options;

    try {
        logger.info({ dependentServices, includeLogAnalysis }, 'Starting VPN connectivity diagnosis');

        const checks: DiagnosticCheck[] = [];
        const matchedIssues: VpnDiagnosticData['matchedIssues'] = [];
        const recommendations: VpnDiagnosticData['recommendations'] = [];
        let affectedServices: string[] = [];

        // Step 1: Check if Gluetun is running
        const gluetunHealth = await checkServiceHealth('gluetun');
        const gluetunServices = gluetunHealth.data?.services ?? [];

        if (!gluetunHealth.success || gluetunServices.length === 0) {
            return {
                success: false,
                data: {
                    vpnHealthy: false,
                    checks: [{
                        check: 'Gluetun Service Status',
                        status: 'fail',
                        message: 'Gluetun container not found or not running'
                    }],
                    matchedIssues: [],
                    recommendations: [{
                        title: 'Start Gluetun',
                        description: 'Gluetun VPN container is not running. This is required for VPN functionality.',
                        priority: 'critical',
                        solution: {
                            title: 'Start Gluetun container',
                            description: 'Deploy or start the Gluetun VPN container',
                            steps: [
                                'Ensure Gluetun is defined in docker-compose.yml',
                                'Run: docker-compose up -d gluetun',
                                'Check logs: docker logs gluetun'
                            ],
                            requiresRestart: true
                        }
                    }],
                    summary: 'VPN diagnostic failed: Gluetun container not found'
                }
            };
        }

        const gluetunService = gluetunServices[0];
        checks.push({
            check: 'Gluetun Service Status',
            status: gluetunService.status === 'running' ? 'pass' : 'fail',
            message: `Gluetun is ${gluetunService.status}`,
            actual: gluetunService.status
        });

        // Step 2: Analyze Gluetun logs if requested
        let gluetunLogs = '';
        if (includeLogAnalysis) {
            try {
                gluetunLogs = await runCommand('docker', ['logs', '--tail', logLines.toString(), 'gluetun'], { timeoutMs: 15000 });

                // Match against VPN log patterns
                const logMatches = matchVpnLogPatterns(gluetunLogs);

                if (logMatches.length > 0) {
                    checks.push({
                        check: 'VPN Log Analysis',
                        status: 'pass',
                        message: `Found ${logMatches.length} matching issue pattern(s) in logs`,
                        output: logMatches.slice(0, 3).map(issue => issue.title).join(', ')
                    });

                    // Add matched issues
                    for (const issue of logMatches) {
                        matchedIssues.push({
                            issue,
                            confidence: 'high',
                            reason: `Log patterns matched in Gluetun logs`
                        });
                    }
                } else {
                    checks.push({
                        check: 'VPN Log Analysis',
                        status: 'pass',
                        message: 'No known error patterns found in logs'
                    });
                }
            } catch (err: unknown) {
                checks.push({
                    check: 'VPN Log Analysis',
                    status: 'fail',
                    message: `Failed to retrieve logs: ${getErrorMessage(err)}`
                });
            }
        }

        // Step 3: Run diagnostic steps from "vpn-healthy-but-no-connection" issue pattern
        const primaryIssue = VPN_TROUBLESHOOTING_KB.find(kb => kb.id === 'vpn-healthy-but-no-connection');

        if (primaryIssue) {
            logger.info('Running diagnostic steps for vpn-healthy-but-no-connection');

            for (const diagStep of primaryIssue.diagnostics) {
                const result = await runDiagnosticStep(diagStep);
                checks.push(result);

                // If this is the network_mode check, track which services fail
                if (diagStep.description.toLowerCase().includes('network_mode') && result.status === 'fail') {
                    const serviceName = diagStep.command?.match(/docker inspect (\w+)/)?.[1];
                    if (serviceName) {
                        affectedServices.push(serviceName);
                    }
                }
            }
        }

        // Step 4: Check network_mode for dependent services
        for (const serviceName of dependentServices) {
            const validation = validateServiceName(serviceName);
            if (!validation.valid || !validation.sanitized) {
                continue;
            }

            try {
                const networkMode = await runCommand('docker', [
                    'inspect',
                    validation.sanitized,
                    '--format',
                    '{{.HostConfig.NetworkMode}}'
                ], { timeoutMs: 5000 });

                const isCorrect = networkMode.trim().includes('gluetun') || networkMode.trim().includes('container:gluetun');

                checks.push({
                    check: `Network Mode: ${serviceName}`,
                    status: isCorrect ? 'pass' : 'fail',
                    message: isCorrect
                        ? `Correctly configured to route through Gluetun`
                        : `Not routing through VPN (network_mode: ${networkMode.trim()})`,
                    expected: 'service:gluetun or container:gluetun',
                    actual: networkMode.trim()
                });

                if (!isCorrect) {
                    affectedServices.push(serviceName);
                }
            } catch (err: unknown) {
                // Service might not exist, skip silently
                checks.push({
                    check: `Network Mode: ${serviceName}`,
                    status: 'skip',
                    message: 'Service not found'
                });
            }
        }

        // Step 5: Test VPN connectivity from Gluetun container
        try {
            const vpnIp = await runCommand('docker', [
                'exec',
                'gluetun',
                'wget',
                '-qO-',
                '--timeout=5',
                'https://api.ipify.org'
            ], { timeoutMs: 10000 });

            checks.push({
                check: 'VPN External Connectivity',
                status: 'pass',
                message: `Successfully reached internet through VPN`,
                actual: `VPN IP: ${vpnIp.trim()}`
            });
        } catch (err: unknown) {
            checks.push({
                check: 'VPN External Connectivity',
                status: 'fail',
                message: `Cannot reach internet through VPN: ${getErrorMessage(err)}`
            });

            // This is a critical issue - add to matched issues
            const connectivityIssue = VPN_TROUBLESHOOTING_KB.find(kb =>
                kb.id === 'vpn-healthy-but-no-connection' || kb.id === 'vpn-connection-timeout'
            );
            if (connectivityIssue && !matchedIssues.find(m => m.issue.id === connectivityIssue.id)) {
                matchedIssues.push({
                    issue: connectivityIssue,
                    confidence: 'high',
                    reason: 'VPN container cannot reach external internet'
                });
            }
        }

        // Step 6: Test DNS resolution through VPN
        try {
            const dnsResult = await runCommand('docker', [
                'exec',
                'gluetun',
                'nslookup',
                'google.com'
            ], { timeoutMs: 8000 });

            const dnsWorking = dnsResult.includes('Address') || dnsResult.includes('answer');

            checks.push({
                check: 'VPN DNS Resolution',
                status: dnsWorking ? 'pass' : 'fail',
                message: dnsWorking ? 'DNS resolution working through VPN' : 'DNS resolution failing',
                output: dnsResult.substring(0, 200)
            });

            if (!dnsWorking) {
                // Find DNS-related issue
                const dnsIssue = VPN_TROUBLESHOOTING_KB.find(kb => kb.id === 'vpn-dns-leak');
                if (dnsIssue && !matchedIssues.find(m => m.issue.id === dnsIssue.id)) {
                    matchedIssues.push({
                        issue: dnsIssue,
                        confidence: 'medium',
                        reason: 'DNS resolution test failed'
                    });
                }
            }
        } catch (err: unknown) {
            checks.push({
                check: 'VPN DNS Resolution',
                status: 'fail',
                message: `DNS test failed: ${getErrorMessage(err)}`
            });
        }

        // Step 7: Check for port forwarding if needed
        try {
            const envCheck = await runCommand('docker', [
                'exec',
                'gluetun',
                'printenv',
                'VPN_PORT_FORWARDING'
            ], { timeoutMs: 3000 });

            if (envCheck.trim().toLowerCase() === 'on' || envCheck.trim() === '1') {
                checks.push({
                    check: 'Port Forwarding Configuration',
                    status: 'pass',
                    message: 'VPN port forwarding is enabled',
                    actual: 'Enabled'
                });
            } else {
                checks.push({
                    check: 'Port Forwarding Configuration',
                    status: 'skip',
                    message: 'VPN port forwarding not configured (may not be needed)'
                });
            }
        } catch {
            checks.push({
                check: 'Port Forwarding Configuration',
                status: 'skip',
                message: 'Cannot determine port forwarding status'
            });
        }

        // Step 8: Generate recommendations based on matched issues
        for (const matched of matchedIssues) {
            for (const solution of matched.issue.solutions) {
                // Determine priority based on issue severity and confidence
                let priority: VpnDiagnosticData['recommendations'][0]['priority'] = 'medium';
                if (matched.issue.severity === 'critical') {
                    priority = 'critical';
                } else if (matched.issue.severity === 'high' && matched.confidence === 'high') {
                    priority = 'high';
                } else if (matched.issue.severity === 'medium') {
                    priority = 'medium';
                } else {
                    priority = 'low';
                }

                recommendations.push({
                    title: solution.title,
                    description: solution.description,
                    priority,
                    solution
                });
            }
        }

        // Step 9: Add recommendations for network_mode issues if detected
        if (affectedServices.length > 0) {
            const networkModeIssue = VPN_TROUBLESHOOTING_KB.find(kb => kb.id === 'vpn-healthy-but-no-connection');
            if (networkModeIssue) {
                const networkModeSolution = networkModeIssue.solutions.find(s =>
                    s.title.toLowerCase().includes('network_mode')
                );
                if (networkModeSolution && !recommendations.find(r => r.title === networkModeSolution.title)) {
                    recommendations.push({
                        title: networkModeSolution.title,
                        description: `Services not routing through VPN: ${affectedServices.join(', ')}`,
                        priority: 'high',
                        solution: networkModeSolution
                    });
                }
            }
        }

        // Step 10: Determine overall VPN health
        const failedChecks = checks.filter(c => c.status === 'fail').length;
        const criticalChecks = checks.filter(c =>
            c.check.includes('Service Status') ||
            c.check.includes('External Connectivity') ||
            c.check.includes('DNS Resolution')
        );
        const criticalFailures = criticalChecks.filter(c => c.status === 'fail').length;

        const vpnHealthy = gluetunService.status === 'running' && criticalFailures === 0;

        // Generate summary
        let summary = '';
        if (vpnHealthy) {
            if (failedChecks === 0) {
                summary = 'VPN is healthy and all checks passed successfully.';
            } else if (affectedServices.length > 0) {
                summary = `VPN is operational but ${affectedServices.length} service(s) not properly configured: ${affectedServices.join(', ')}`;
            } else {
                summary = `VPN is operational but ${failedChecks} check(s) failed. Review recommendations.`;
            }
        } else {
            summary = `VPN has critical issues: ${criticalFailures} critical check(s) failed. Immediate attention required.`;
        }

        // Sort recommendations by priority
        const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
        recommendations.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

        return {
            success: true,
            data: {
                vpnHealthy,
                gluetunService,
                checks,
                matchedIssues,
                recommendations,
                summary,
                affectedServices: affectedServices.length > 0 ? affectedServices : undefined
            }
        };

    } catch (err: unknown) {
        logger.error({ err }, 'VPN connectivity diagnosis failed');
        return {
            success: false,
            error: getErrorMessage(err)
        };
    }
}

/**
 * Diagnose Arr service interconnection issues
 *
 * This tool checks:
 * - Arr service health and running status
 * - API key validity
 * - Service-to-service connectivity (DNS, HTTP)
 * - Download client connectivity
 * - Network mode configuration (especially VPN)
 * - Path permissions and import issues
 *
 * @param options Diagnostic options
 * @returns Detailed Arr interconnection diagnostic analysis with recommendations
 */
export async function diagnoseArrConnections(options: {
    /** Specific Arr services to check (defaults to common ones) */
    arrServices?: ArrService[];
    /** Specific download clients to check */
    downloadClients?: DownloadClient[];
    /** Include detailed log analysis */
    includeLogAnalysis?: boolean;
    /** Number of log lines to analyze per service */
    logLines?: number;
} = {}): Promise<ToolResult<ArrDiagnosticData>> {
    const {
        arrServices: requestedArrServices = ['sonarr', 'radarr', 'prowlarr'] as ArrService[],
        downloadClients: requestedDownloadClients = ['qbittorrent', 'transmission', 'deluge'] as DownloadClient[],
        includeLogAnalysis = true,
        logLines = 100
    } = options;

    try {
        logger.info({ arrServices: requestedArrServices, downloadClients: requestedDownloadClients }, 'Starting Arr interconnection diagnosis');

        const checks: DiagnosticCheck[] = [];
        const matchedIssues: ArrDiagnosticData['matchedIssues'] = [];
        const recommendations: ArrDiagnosticData['recommendations'] = [];
        const configurationIssues: ArrDiagnosticData['configurationIssues'] = [];
        const servicesData: ArrDiagnosticData['services'] = [];
        const downloadClientsData: ArrDiagnosticData['downloadClients'] = [];

        // Step 1: Check Arr service status
        logger.info('Step 1: Checking Arr service status');
        const arrServicesStatus = await arrService.getArrServicesStatus();

        for (const serviceName of requestedArrServices) {
            const serviceStatus = arrServicesStatus.find(s => s.id === serviceName);
            const running = serviceStatus?.running ?? false;
            const ready = serviceStatus?.ready ?? false;

            checks.push({
                check: `${serviceName} Service Status`,
                status: running ? 'pass' : 'fail',
                message: running
                    ? (ready ? `${serviceName} is running and ready` : `${serviceName} is running but not ready`)
                    : `${serviceName} container not found or not running`,
                actual: running ? 'running' : 'not running'
            });

            servicesData.push({
                name: serviceName,
                running,
                issues: running ? [] : ['Service not running']
            });

            if (!running) {
                configurationIssues.push({
                    service: serviceName,
                    issue: 'Service not running',
                    severity: 'high'
                });
            }
        }

        // Step 2: Extract and validate API keys
        logger.info('Step 2: Validating API keys');
        let extractedKeys: Record<string, string> = {};
        try {
            extractedKeys = await arrService.extractArrKeys();

            if (Object.keys(extractedKeys).length > 0) {
                const validations = await arrService.validateArrKeys(extractedKeys, arrServicesStatus);

                for (const [envKey, validation] of Object.entries(validations)) {
                    const serviceName = envKey.replace('_API_KEY', '').toLowerCase();

                    if (!requestedArrServices.includes(serviceName as ArrService)) {
                        continue;
                    }

                    const serviceData = servicesData.find(s => s.name === serviceName);

                    if (validation.tested) {
                        checks.push({
                            check: `${serviceName} API Key Validation`,
                            status: validation.ok ? 'pass' : 'fail',
                            message: validation.ok
                                ? 'API key is valid and accepted'
                                : `API key validation failed: ${validation.error || 'Unauthorized'}`,
                            expected: 'HTTP 200 with valid response',
                            actual: validation.status ? `HTTP ${validation.status}` : validation.error
                        });

                        if (serviceData) {
                            serviceData.apiKeyValid = validation.ok;
                            if (!validation.ok) {
                                serviceData.issues?.push('Invalid API key');
                                configurationIssues.push({
                                    service: serviceName,
                                    issue: 'API key validation failed',
                                    severity: 'high'
                                });

                                // Match against knowledge base
                                const apiKeyIssue = ARR_INTERCONNECTION_KB.find(kb => kb.id === 'api-key-invalid');
                                if (apiKeyIssue && !matchedIssues.find(m => m.issue.id === apiKeyIssue.id)) {
                                    matchedIssues.push({
                                        issue: apiKeyIssue,
                                        confidence: 'high',
                                        reason: `API key validation failed for ${serviceName}`
                                    });
                                }
                            }
                        }
                    } else {
                        checks.push({
                            check: `${serviceName} API Key Validation`,
                            status: 'skip',
                            message: `Could not test API key: ${validation.error || 'Service not accessible'}`
                        });

                        if (serviceData && !serviceData.apiKeyValid) {
                            serviceData.apiKeyValid = false;
                        }
                    }
                }
            } else {
                checks.push({
                    check: 'API Key Extraction',
                    status: 'fail',
                    message: 'No API keys could be extracted from running services'
                });
            }
        } catch (err: unknown) {
            checks.push({
                check: 'API Key Extraction',
                status: 'fail',
                message: `Failed to extract API keys: ${getErrorMessage(err)}`
            });
        }

        // Step 3: Test service-to-service connectivity (DNS and HTTP)
        logger.info('Step 3: Testing service-to-service connectivity');
        const runningArrServices = arrServicesStatus.filter(s =>
            s.running && requestedArrServices.includes(s.id as ArrService)
        );

        for (let i = 0; i < runningArrServices.length; i++) {
            const sourceService = runningArrServices[i];

            for (let j = i + 1; j < runningArrServices.length; j++) {
                const targetService = runningArrServices[j];

                // Test DNS resolution
                try {
                    const dnsResult = await runCommand('docker', [
                        'exec',
                        sourceService.containerName!,
                        'nslookup',
                        targetService.id
                    ], { timeoutMs: 5000 });

                    const dnsWorking = dnsResult.toLowerCase().includes('address') ||
                                      dnsResult.toLowerCase().includes('name:');

                    checks.push({
                        check: `DNS: ${sourceService.id} → ${targetService.id}`,
                        status: dnsWorking ? 'pass' : 'fail',
                        message: dnsWorking
                            ? 'DNS resolution successful'
                            : 'DNS resolution failed',
                        output: dnsResult.substring(0, 200)
                    });

                    if (!dnsWorking) {
                        const urlIssue = ARR_INTERCONNECTION_KB.find(kb => kb.id === 'url-connection-failed');
                        if (urlIssue && !matchedIssues.find(m => m.issue.id === urlIssue.id)) {
                            matchedIssues.push({
                                issue: urlIssue,
                                confidence: 'high',
                                reason: `DNS resolution failed between ${sourceService.id} and ${targetService.id}`
                            });
                        }

                        configurationIssues.push({
                            service: `${sourceService.id}-${targetService.id}`,
                            issue: 'DNS resolution failed - services may not be on same network',
                            severity: 'high'
                        });
                    }
                } catch (err: unknown) {
                    checks.push({
                        check: `DNS: ${sourceService.id} → ${targetService.id}`,
                        status: 'fail',
                        message: `DNS test failed: ${getErrorMessage(err)}`
                    });
                }

                // Test HTTP connectivity (common ports)
                const portMap: Record<string, number> = {
                    sonarr: 8989,
                    radarr: 7878,
                    prowlarr: 9696,
                    lidarr: 8686,
                    readarr: 8787,
                    bazarr: 6767
                };

                const targetPort = portMap[targetService.id];
                if (targetPort) {
                    try {
                        const httpResult = await runCommand('docker', [
                            'exec',
                            sourceService.containerName!,
                            'curl',
                            '-I',
                            '-s',
                            '--connect-timeout', '5',
                            `http://${targetService.id}:${targetPort}`
                        ], { timeoutMs: 8000 });

                        const httpWorking = httpResult.toLowerCase().includes('http/');

                        checks.push({
                            check: `HTTP: ${sourceService.id} → ${targetService.id}:${targetPort}`,
                            status: httpWorking ? 'pass' : 'fail',
                            message: httpWorking
                                ? 'HTTP connectivity successful'
                                : 'HTTP connectivity failed',
                            output: httpResult.substring(0, 200)
                        });

                        const serviceData = servicesData.find(s => s.name === targetService.id);
                        if (serviceData) {
                            serviceData.reachable = httpWorking;
                            if (!httpWorking) {
                                serviceData.issues?.push(`Not reachable from ${sourceService.id}`);
                            }
                        }

                        if (!httpWorking) {
                            const urlIssue = ARR_INTERCONNECTION_KB.find(kb => kb.id === 'url-connection-failed');
                            if (urlIssue && !matchedIssues.find(m => m.issue.id === urlIssue.id)) {
                                matchedIssues.push({
                                    issue: urlIssue,
                                    confidence: 'high',
                                    reason: `HTTP connectivity failed from ${sourceService.id} to ${targetService.id}`
                                });
                            }
                        }
                    } catch (err: unknown) {
                        checks.push({
                            check: `HTTP: ${sourceService.id} → ${targetService.id}:${targetPort}`,
                            status: 'fail',
                            message: `HTTP test failed: ${getErrorMessage(err)}`
                        });
                    }
                }
            }
        }

        // Step 4: Check download client connectivity
        logger.info('Step 4: Checking download client connectivity');
        for (const clientName of requestedDownloadClients) {
            const validation = validateServiceName(clientName);
            if (!validation.valid || !validation.sanitized) {
                continue;
            }

            const clientRunning = await arrService.isContainerRunning(validation.sanitized);

            const clientData: ArrDiagnosticData['downloadClients'][0] = {
                name: clientName,
                running: clientRunning,
                issues: []
            };

            checks.push({
                check: `${clientName} Status`,
                status: clientRunning ? 'pass' : 'skip',
                message: clientRunning
                    ? `${clientName} is running`
                    : `${clientName} container not found`
            });

            if (clientRunning) {
                // Check if client is reachable from Arr services
                const portMap: Record<string, number> = {
                    qbittorrent: 8080,
                    transmission: 9091,
                    deluge: 8112,
                    sabnzbd: 8080,
                    nzbget: 6789
                };

                const clientPort = portMap[clientName];

                // Determine the correct hostname (might be gluetun if using VPN)
                let targetHostname = clientName;
                try {
                    const networkMode = await runCommand('docker', [
                        'inspect',
                        validation.sanitized,
                        '--format',
                        '{{.HostConfig.NetworkMode}}'
                    ], { timeoutMs: 5000 });

                    if (networkMode.trim().includes('gluetun') || networkMode.trim().includes('container:gluetun')) {
                        targetHostname = 'gluetun';
                        clientData.issues?.push('Using VPN network mode - must be accessed via gluetun');

                        checks.push({
                            check: `${clientName} Network Mode`,
                            status: 'pass',
                            message: `Using VPN network mode (access via ${targetHostname})`,
                            expected: 'container:gluetun or service:gluetun',
                            actual: networkMode.trim()
                        });
                    } else {
                        checks.push({
                            check: `${clientName} Network Mode`,
                            status: 'pass',
                            message: 'Using standard network mode',
                            actual: networkMode.trim()
                        });
                    }
                } catch (err: unknown) {
                    checks.push({
                        check: `${clientName} Network Mode`,
                        status: 'skip',
                        message: `Could not determine network mode: ${getErrorMessage(err)}`
                    });
                }

                // Test connectivity from first available Arr service
                if (runningArrServices.length > 0 && clientPort) {
                    const testService = runningArrServices[0];

                    try {
                        const httpResult = await runCommand('docker', [
                            'exec',
                            testService.containerName!,
                            'curl',
                            '-I',
                            '-s',
                            '--connect-timeout', '5',
                            `http://${targetHostname}:${clientPort}`
                        ], { timeoutMs: 8000 });

                        const reachable = httpResult.toLowerCase().includes('http/');

                        checks.push({
                            check: `Download Client: ${testService.id} → ${targetHostname}:${clientPort}`,
                            status: reachable ? 'pass' : 'fail',
                            message: reachable
                                ? `Download client reachable from ${testService.id}`
                                : `Download client NOT reachable from ${testService.id}`,
                            output: httpResult.substring(0, 200)
                        });

                        clientData.reachable = reachable;

                        if (!reachable) {
                            clientData.issues?.push(`Not reachable from ${testService.id}`);
                            configurationIssues.push({
                                service: clientName,
                                issue: `Download client not reachable from Arr services`,
                                severity: 'high'
                            });

                            const downloadClientIssue = ARR_INTERCONNECTION_KB.find(kb => kb.id === 'download-client-unreachable');
                            if (downloadClientIssue && !matchedIssues.find(m => m.issue.id === downloadClientIssue.id)) {
                                matchedIssues.push({
                                    issue: downloadClientIssue,
                                    confidence: 'high',
                                    reason: `Download client ${clientName} not reachable from ${testService.id}`
                                });
                            }
                        }
                    } catch (err: unknown) {
                        checks.push({
                            check: `Download Client: ${testService.id} → ${targetHostname}:${clientPort}`,
                            status: 'fail',
                            message: `Connectivity test failed: ${getErrorMessage(err)}`
                        });

                        clientData.reachable = false;
                        clientData.issues?.push('Connectivity test failed');
                    }
                }
            }

            downloadClientsData.push(clientData);
        }

        // Step 5: Analyze logs if requested
        if (includeLogAnalysis) {
            logger.info('Step 5: Analyzing service logs');

            for (const service of runningArrServices) {
                try {
                    const logs = await runCommand('docker', [
                        'logs',
                        '--tail',
                        logLines.toString(),
                        service.containerName!
                    ], { timeoutMs: 15000 });

                    const logMatches = matchArrLogPatterns(logs);

                    if (logMatches.length > 0) {
                        checks.push({
                            check: `${service.id} Log Analysis`,
                            status: 'pass',
                            message: `Found ${logMatches.length} matching issue pattern(s) in logs`,
                            output: logMatches.slice(0, 3).map(issue => issue.title).join(', ')
                        });

                        // Add matched issues
                        for (const issue of logMatches) {
                            if (!matchedIssues.find(m => m.issue.id === issue.id)) {
                                matchedIssues.push({
                                    issue,
                                    confidence: 'high',
                                    reason: `Log patterns matched in ${service.id} logs`
                                });
                            }
                        }
                    } else {
                        checks.push({
                            check: `${service.id} Log Analysis`,
                            status: 'pass',
                            message: 'No known error patterns found in logs'
                        });
                    }
                } catch (err: unknown) {
                    checks.push({
                        check: `${service.id} Log Analysis`,
                        status: 'skip',
                        message: `Failed to retrieve logs: ${getErrorMessage(err)}`
                    });
                }
            }
        }

        // Step 6: Generate recommendations based on matched issues
        logger.info('Step 6: Generating recommendations');
        for (const matched of matchedIssues) {
            for (const solution of matched.issue.solutions) {
                // Determine priority based on issue severity and confidence
                let priority: ArrDiagnosticData['recommendations'][0]['priority'] = 'medium';
                if (matched.issue.severity === 'critical') {
                    priority = 'critical';
                } else if (matched.issue.severity === 'high' && matched.confidence === 'high') {
                    priority = 'high';
                } else if (matched.issue.severity === 'medium') {
                    priority = 'medium';
                } else {
                    priority = 'low';
                }

                // Avoid duplicate recommendations
                if (!recommendations.find(r => r.title === solution.title)) {
                    recommendations.push({
                        title: solution.title,
                        description: solution.description,
                        priority,
                        solution
                    });
                }
            }
        }

        // Step 7: Determine overall health
        const failedChecks = checks.filter(c => c.status === 'fail').length;
        const criticalIssues = configurationIssues.filter(i => i.severity === 'critical').length;
        const highIssues = configurationIssues.filter(i => i.severity === 'high').length;

        const healthy = failedChecks === 0 && criticalIssues === 0;

        // Generate summary
        let summary = '';
        const runningCount = servicesData.filter(s => s.running).length;
        const totalRequested = requestedArrServices.length;

        if (healthy) {
            summary = `All Arr services are healthy. ${runningCount}/${totalRequested} services running with no connectivity issues detected.`;
        } else if (criticalIssues > 0) {
            summary = `Critical issues detected: ${criticalIssues} critical problem(s). ${runningCount}/${totalRequested} services running. Immediate attention required.`;
        } else if (highIssues > 0) {
            summary = `Configuration issues detected: ${highIssues} high-severity problem(s). ${runningCount}/${totalRequested} services running. Review recommendations.`;
        } else {
            summary = `${runningCount}/${totalRequested} services running with ${failedChecks} check(s) failed. Review recommendations for improvements.`;
        }

        // Sort recommendations by priority
        const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
        recommendations.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

        return {
            success: true,
            data: {
                healthy,
                services: servicesData,
                downloadClients: downloadClientsData,
                checks,
                matchedIssues,
                recommendations,
                summary,
                configurationIssues: configurationIssues.length > 0 ? configurationIssues : undefined
            }
        };

    } catch (err: unknown) {
        logger.error({ err }, 'Arr interconnection diagnosis failed');
        return {
            success: false,
            error: getErrorMessage(err)
        };
    }
}

/**
 * Diagnose Plex/Jellyfin/Emby media scanning issues
 *
 * This tool checks:
 * - Media server container health and logs
 * - Library path accessibility and mounts
 * - File permissions (PUID/PGID configuration)
 * - File naming conventions
 * - Sample media file detection
 *
 * @param options Diagnostic options
 * @returns Detailed media scanner diagnostic analysis with recommendations
 */
export async function diagnoseMediaScanner(options: {
    /** Specific media servers to check (defaults to plex, jellyfin, emby) */
    servers?: MediaServer[];
    /** Library paths to check inside containers (e.g., /data/movies, /data/tv) */
    libraryPaths?: string[];
    /** Include detailed log analysis */
    includeLogAnalysis?: boolean;
    /** Number of log lines to analyze per server */
    logLines?: number;
    /** Check file naming conventions */
    checkNaming?: boolean;
} = {}): Promise<ToolResult<MediaScannerDiagnosticData>> {
    const {
        servers: requestedServers = ['plex', 'jellyfin', 'emby'] as MediaServer[],
        libraryPaths = ['/data/movies', '/data/tv', '/data/media'],
        includeLogAnalysis = true,
        logLines = 100,
        checkNaming = true
    } = options;

    try {
        logger.info({ servers: requestedServers, libraryPaths }, 'Starting media scanner diagnosis');

        const checks: DiagnosticCheck[] = [];
        const matchedIssues: MediaScannerDiagnosticData['matchedIssues'] = [];
        const recommendations: MediaScannerDiagnosticData['recommendations'] = [];
        const serversData: MediaScannerDiagnosticData['servers'] = [];
        const libraryPathsData: MediaScannerDiagnosticData['libraryPaths'] = [];
        const permissionsData: MediaScannerDiagnosticData['permissions'] = {
            configured: false,
            issues: []
        };
        const namingConventionsData: MediaScannerDiagnosticData['namingConventions'] = {
            checked: false,
            issues: []
        };

        // Step 1: Check which media servers are running
        logger.info('Step 1: Checking media server status');
        for (const serverName of requestedServers) {
            const validation = validateServiceName(serverName);
            if (!validation.valid || !validation.sanitized) {
                continue;
            }

            const isRunning = await arrService.isContainerRunning(validation.sanitized);

            const serverData: MediaScannerDiagnosticData['servers'][0] = {
                name: serverName,
                running: isRunning,
                containerName: isRunning ? validation.sanitized : undefined,
                issues: []
            };

            checks.push({
                check: `${serverName} Service Status`,
                status: isRunning ? 'pass' : 'skip',
                message: isRunning
                    ? `${serverName} is running`
                    : `${serverName} container not found`,
                actual: isRunning ? 'running' : 'not running'
            });

            if (!isRunning) {
                serverData.issues?.push('Container not running');
            }

            serversData.push(serverData);
        }

        const runningServers = serversData.filter(s => s.running);

        if (runningServers.length === 0) {
            return {
                success: false,
                data: {
                    healthy: false,
                    servers: serversData,
                    libraryPaths: [],
                    permissions: permissionsData,
                    namingConventions: namingConventionsData,
                    checks,
                    matchedIssues: [],
                    recommendations: [{
                        title: 'Start media server',
                        description: 'No media servers (Plex, Jellyfin, Emby) are currently running.',
                        priority: 'critical',
                        solution: {
                            title: 'Deploy media server',
                            description: 'Start a media server container to scan and organize your media',
                            steps: [
                                'Configure media server in docker-compose.yml',
                                'Run: docker-compose up -d plex (or jellyfin/emby)',
                                'Access web UI to complete initial setup',
                                'Add library paths and configure scanning'
                            ],
                            requiresRestart: true
                        }
                    }],
                    summary: 'No media servers found. Deploy Plex, Jellyfin, or Emby to get started.'
                }
            };
        }

        // Use first running server for subsequent checks
        const primaryServer = runningServers[0];
        const containerName = primaryServer.containerName!;

        // Step 2: Check PUID/PGID configuration
        logger.info('Step 2: Checking file permission configuration (PUID/PGID)');
        try {
            const puidResult = await runCommand('docker', [
                'exec',
                containerName,
                'printenv',
                'PUID'
            ], { timeoutMs: 3000 });

            const pgidResult = await runCommand('docker', [
                'exec',
                containerName,
                'printenv',
                'PGID'
            ], { timeoutMs: 3000 });

            permissionsData.puid = puidResult.trim();
            permissionsData.pgid = pgidResult.trim();
            permissionsData.configured = true;

            checks.push({
                check: 'PUID/PGID Configuration',
                status: 'pass',
                message: `PUID=${permissionsData.puid}, PGID=${permissionsData.pgid}`,
                actual: `PUID=${permissionsData.puid}, PGID=${permissionsData.pgid}`
            });
        } catch (err: unknown) {
            permissionsData.configured = false;
            permissionsData.issues?.push('PUID/PGID environment variables not set');

            checks.push({
                check: 'PUID/PGID Configuration',
                status: 'fail',
                message: 'PUID/PGID not configured - may cause permission issues',
                expected: 'PUID and PGID environment variables should be set'
            });

            // Match against permission-denied issue
            const permissionIssue = getMediaIssueById('permission-denied');
            if (permissionIssue && !matchedIssues.find(m => m.issue.id === permissionIssue.id)) {
                matchedIssues.push({
                    issue: permissionIssue,
                    confidence: 'medium',
                    reason: 'PUID/PGID not configured - potential permission issues'
                });
            }
        }

        // Step 3: Check library paths
        logger.info('Step 3: Checking library path accessibility');
        for (const libPath of libraryPaths) {
            try {
                // Check if path exists
                const lsResult = await runCommand('docker', [
                    'exec',
                    containerName,
                    'ls',
                    '-la',
                    libPath
                ], { timeoutMs: 8000 });

                const pathData: MediaScannerDiagnosticData['libraryPaths'][0] = {
                    path: libPath,
                    accessible: true,
                    issues: []
                };

                // Check if path has media files
                try {
                    const findResult = await runCommand('docker', [
                        'exec',
                        containerName,
                        'find',
                        libPath,
                        '-type',
                        'f',
                        '-regex',
                        '.*\\.(mkv|mp4|avi|mov|m4v|wmv|flv)$',
                        '-print'
                    ], { timeoutMs: 15000 });

                    const files = findResult.trim().split('\n').filter(f => f.length > 0).slice(0, 20);
                    pathData.hasMedia = files.length > 0;
                    pathData.fileCount = files.length;

                    if (files.length > 0) {
                        checks.push({
                            check: `Library Path: ${libPath}`,
                            status: 'pass',
                            message: `Path accessible with ${files.length} media file(s) detected`,
                            output: files.slice(0, 5).join('\n')
                        });
                    } else {
                        checks.push({
                            check: `Library Path: ${libPath}`,
                            status: 'pass',
                            message: 'Path accessible but no media files found',
                            output: lsResult.substring(0, 300)
                        });
                        pathData.issues?.push('No media files found');
                    }
                } catch (findErr: unknown) {
                    // Find command failed, but path is accessible
                    checks.push({
                        check: `Library Path: ${libPath}`,
                        status: 'pass',
                        message: 'Path accessible (could not scan for media files)',
                        output: lsResult.substring(0, 300)
                    });
                }

                libraryPathsData.push(pathData);

            } catch (err: unknown) {
                const errorMsg = getErrorMessage(err);
                const isPermissionDenied = errorMsg.toLowerCase().includes('permission denied');
                const isNotFound = errorMsg.toLowerCase().includes('no such file') ||
                                   errorMsg.toLowerCase().includes('not found');

                libraryPathsData.push({
                    path: libPath,
                    accessible: false,
                    issues: [isPermissionDenied ? 'Permission denied' : isNotFound ? 'Path not found' : 'Cannot access path']
                });

                checks.push({
                    check: `Library Path: ${libPath}`,
                    status: 'fail',
                    message: isPermissionDenied
                        ? 'Permission denied - cannot read library path'
                        : isNotFound
                            ? 'Path not found - volume not mounted or incorrect path'
                            : `Cannot access path: ${errorMsg}`,
                    expected: 'Path should be readable'
                });

                // Match against known issues
                if (isPermissionDenied) {
                    const permissionIssue = getMediaIssueById('permission-denied');
                    if (permissionIssue && !matchedIssues.find(m => m.issue.id === permissionIssue.id)) {
                        matchedIssues.push({
                            issue: permissionIssue,
                            confidence: 'high',
                            reason: `Permission denied accessing ${libPath}`
                        });
                    }
                } else if (isNotFound) {
                    const libraryIssue = getMediaIssueById('library-not-updating');
                    if (libraryIssue && !matchedIssues.find(m => m.issue.id === libraryIssue.id)) {
                        matchedIssues.push({
                            issue: libraryIssue,
                            confidence: 'high',
                            reason: `Library path ${libPath} not found - volume mount issue`
                        });
                    }
                }
            }
        }

        // Step 4: Check file naming conventions if requested
        if (checkNaming) {
            logger.info('Step 4: Checking file naming conventions');
            namingConventionsData.checked = true;

            const accessiblePaths = libraryPathsData.filter(p => p.accessible && p.hasMedia);

            if (accessiblePaths.length > 0) {
                const samplePath = accessiblePaths[0].path;

                try {
                    const sampleFiles = await runCommand('docker', [
                        'exec',
                        containerName,
                        'find',
                        samplePath,
                        '-type',
                        'f',
                        '-regex',
                        '.*\\.(mkv|mp4|avi|mov)$'
                    ], { timeoutMs: 15000 });

                    const files = sampleFiles.trim().split('\n').filter(f => f.length > 0).slice(0, 10);
                    namingConventionsData.sampleFiles = files;

                    // Check for common naming issues
                    const namingIssues: string[] = [];

                    for (const file of files) {
                        const basename = file.split('/').pop() || '';

                        // Check for year in movies (should have (YYYY))
                        if (samplePath.toLowerCase().includes('movie')) {
                            if (!/\(\d{4}\)/.test(basename)) {
                                namingIssues.push(`Missing year: ${basename}`);
                            }
                        }

                        // Check for TV show format (should have SxxExx)
                        if (samplePath.toLowerCase().includes('tv') || samplePath.toLowerCase().includes('show')) {
                            if (!/[Ss]\d{2}[Ee]\d{2}/.test(basename)) {
                                namingIssues.push(`Missing episode format: ${basename}`);
                            }
                        }

                        // Check for problematic characters
                        if (/[^\x00-\x7F]/.test(basename)) {
                            namingIssues.push(`Non-ASCII characters: ${basename}`);
                        }
                    }

                    if (namingIssues.length > 0) {
                        namingConventionsData.issues = namingIssues;

                        checks.push({
                            check: 'File Naming Conventions',
                            status: 'fail',
                            message: `${namingIssues.length} naming issue(s) detected`,
                            output: namingIssues.slice(0, 3).join('\n')
                        });

                        const namingIssue = getMediaIssueById('file-naming-incorrect');
                        if (namingIssue && !matchedIssues.find(m => m.issue.id === namingIssue.id)) {
                            matchedIssues.push({
                                issue: namingIssue,
                                confidence: 'medium',
                                reason: `${namingIssues.length} file(s) with naming convention issues`
                            });
                        }
                    } else {
                        checks.push({
                            check: 'File Naming Conventions',
                            status: 'pass',
                            message: 'Sample files follow naming conventions',
                            output: files.slice(0, 3).join('\n')
                        });
                    }
                } catch (err: unknown) {
                    checks.push({
                        check: 'File Naming Conventions',
                        status: 'skip',
                        message: `Could not check naming: ${getErrorMessage(err)}`
                    });
                }
            } else {
                checks.push({
                    check: 'File Naming Conventions',
                    status: 'skip',
                    message: 'No accessible media files to check'
                });
            }
        }

        // Step 5: Analyze logs if requested
        if (includeLogAnalysis) {
            logger.info('Step 5: Analyzing media server logs');

            for (const server of runningServers) {
                try {
                    const logs = await runCommand('docker', [
                        'logs',
                        '--tail',
                        logLines.toString(),
                        server.containerName!
                    ], { timeoutMs: 15000 });

                    const logMatches = matchMediaLogPatterns(logs);

                    if (logMatches.length > 0) {
                        checks.push({
                            check: `${server.name} Log Analysis`,
                            status: 'pass',
                            message: `Found ${logMatches.length} matching issue pattern(s) in logs`,
                            output: logMatches.slice(0, 3).map(issue => issue.title).join(', ')
                        });

                        // Add matched issues
                        for (const issue of logMatches) {
                            if (!matchedIssues.find(m => m.issue.id === issue.id)) {
                                matchedIssues.push({
                                    issue,
                                    confidence: 'high',
                                    reason: `Log patterns matched in ${server.name} logs`
                                });
                            }
                        }
                    } else {
                        checks.push({
                            check: `${server.name} Log Analysis`,
                            status: 'pass',
                            message: 'No known error patterns found in logs'
                        });
                    }
                } catch (err: unknown) {
                    checks.push({
                        check: `${server.name} Log Analysis`,
                        status: 'skip',
                        message: `Failed to retrieve logs: ${getErrorMessage(err)}`
                    });
                }
            }
        }

        // Step 6: Generate recommendations based on matched issues
        logger.info('Step 6: Generating recommendations');
        for (const matched of matchedIssues) {
            for (const solution of matched.issue.solutions) {
                // Determine priority based on issue severity and confidence
                let priority: MediaScannerDiagnosticData['recommendations'][0]['priority'] = 'medium';
                if (matched.issue.severity === 'critical') {
                    priority = 'critical';
                } else if (matched.issue.severity === 'high' && matched.confidence === 'high') {
                    priority = 'high';
                } else if (matched.issue.severity === 'medium') {
                    priority = 'medium';
                } else {
                    priority = 'low';
                }

                // Avoid duplicate recommendations
                if (!recommendations.find(r => r.title === solution.title)) {
                    recommendations.push({
                        title: solution.title,
                        description: solution.description,
                        priority,
                        solution
                    });
                }
            }
        }

        // Step 7: Determine overall health
        const failedChecks = checks.filter(c => c.status === 'fail').length;
        const criticalIssues = matchedIssues.filter(m => m.issue.severity === 'critical').length;
        const highIssues = matchedIssues.filter(m => m.issue.severity === 'high').length;

        const healthy = failedChecks === 0 && criticalIssues === 0;

        // Generate summary
        let summary = '';
        const runningCount = runningServers.length;
        const accessiblePaths = libraryPathsData.filter(p => p.accessible).length;
        const pathsWithMedia = libraryPathsData.filter(p => p.hasMedia).length;

        if (healthy) {
            summary = `Media server healthy. ${runningCount} server(s) running, ${pathsWithMedia}/${libraryPaths.length} library path(s) with media detected.`;
        } else if (criticalIssues > 0) {
            summary = `Critical issues detected: ${criticalIssues} critical problem(s). ${runningCount} server(s) running, ${accessiblePaths}/${libraryPaths.length} path(s) accessible. Immediate attention required.`;
        } else if (highIssues > 0 || failedChecks > 2) {
            summary = `Issues detected: ${failedChecks} check(s) failed. ${runningCount} server(s) running, ${accessiblePaths}/${libraryPaths.length} path(s) accessible. Review recommendations.`;
        } else {
            summary = `${runningCount} server(s) running with minor issues. ${accessiblePaths}/${libraryPaths.length} path(s) accessible, ${pathsWithMedia} with media.`;
        }

        // Sort recommendations by priority
        const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
        recommendations.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

        return {
            success: true,
            data: {
                healthy,
                servers: serversData,
                libraryPaths: libraryPathsData,
                permissions: permissionsData,
                namingConventions: namingConventionsData,
                checks,
                matchedIssues,
                recommendations,
                summary
            }
        };

    } catch (err: unknown) {
        logger.error({ err }, 'Media scanner diagnosis failed');
        return {
            success: false,
            error: getErrorMessage(err)
        };
    }
}

/**
 * Diagnostic command execution types
 */
export type DiagnosticCommandType = 'ping' | 'traceroute' | 'nslookup' | 'curl' | 'wget';

/**
 * Diagnostic command result
 */
export interface DiagnosticCommandResult {
    /** Command type executed */
    commandType: DiagnosticCommandType;
    /** Target (hostname, IP, or URL) */
    target: string;
    /** Container the command was executed in */
    container: string;
    /** Whether command succeeded */
    success: boolean;
    /** Command output */
    output?: string;
    /** Error message if failed */
    error?: string;
    /** Execution time in milliseconds */
    executionTimeMs: number;
    /** Interpreted result (human-readable summary) */
    summary: string;
}

/**
 * Safe diagnostic command runner options
 */
export interface RunDiagnosticCommandOptions {
    /** Type of diagnostic command to run */
    commandType: DiagnosticCommandType;
    /** Target hostname, IP, or URL */
    target: string;
    /** Container to execute command in (defaults to first available arr service or gluetun) */
    container?: string;
    /** Additional safe arguments for the command */
    args?: string[];
    /** Timeout in milliseconds (default: 10000, max: 30000) */
    timeoutMs?: number;
}

/**
 * Validate diagnostic command target
 */
function validateTarget(target: string | undefined): { valid: boolean; sanitized?: string; error?: string } {
    if (!target || typeof target !== 'string') {
        return { valid: false, error: 'Target is required' };
    }

    const sanitized = target.trim();

    // Prevent command injection
    if (sanitized.includes(';') || sanitized.includes('&') || sanitized.includes('|') ||
        sanitized.includes('$') || sanitized.includes('`') || sanitized.includes('\n')) {
        return { valid: false, error: 'Invalid target: contains unsafe characters' };
    }

    // Basic validation for hostname/IP/URL
    if (sanitized.length === 0 || sanitized.length > 253) {
        return { valid: false, error: 'Invalid target length' };
    }

    // Allow hostname, IP, or URL
    const hostnameRegex = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
    const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/;
    const urlRegex = /^https?:\/\/[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*(:\d{1,5})?(\/.*)?$/;

    const targetWithoutProtocol = sanitized.replace(/^https?:\/\//, '').split('/')[0].split(':')[0];

    if (!hostnameRegex.test(targetWithoutProtocol) && !ipRegex.test(targetWithoutProtocol) && !urlRegex.test(sanitized)) {
        return { valid: false, error: 'Invalid target format (must be hostname, IP, or URL)' };
    }

    return { valid: true, sanitized };
}

/**
 * Validate and sanitize command arguments
 */
function validateCommandArgs(args: string[] | undefined, commandType: DiagnosticCommandType): { valid: boolean; sanitized?: string[]; error?: string } {
    if (!args || args.length === 0) {
        return { valid: true, sanitized: [] };
    }

    // Allowlist of safe arguments per command type
    const allowedArgs: Record<DiagnosticCommandType, Set<string>> = {
        ping: new Set(['-c', '-i', '-W', '-w', '-4', '-6']),
        traceroute: new Set(['-m', '-q', '-w', '-4', '-6', '-I', '-T', '-U']),
        nslookup: new Set(['-type', '-timeout']),
        curl: new Set(['-I', '-L', '-s', '-S', '-m', '--connect-timeout', '--max-time', '-4', '-6', '-k', '--head', '--location']),
        wget: new Set(['-q', '-O', '-T', '--timeout', '--tries', '-4', '-6', '--spider', '--no-check-certificate'])
    };

    const allowed = allowedArgs[commandType];
    const sanitized: string[] = [];

    for (const arg of args) {
        const trimmed = arg.trim();

        // Check for command injection
        if (trimmed.includes(';') || trimmed.includes('&') || trimmed.includes('|') ||
            trimmed.includes('$') || trimmed.includes('`') || trimmed.includes('\n')) {
            return { valid: false, error: `Invalid argument: ${trimmed} contains unsafe characters` };
        }

        // For flag-style args (starting with -), must be in allowlist
        if (trimmed.startsWith('-')) {
            const flag = trimmed.split('=')[0]; // Handle --flag=value format
            if (!allowed.has(flag)) {
                return { valid: false, error: `Argument ${flag} not allowed for ${commandType}` };
            }
        }

        // For value args, basic validation
        if (trimmed.length > 0 && trimmed.length <= 100) {
            sanitized.push(trimmed);
        } else {
            return { valid: false, error: `Invalid argument length: ${trimmed}` };
        }
    }

    return { valid: true, sanitized };
}

/**
 * Build safe command arguments for diagnostic commands
 */
function buildDiagnosticCommand(commandType: DiagnosticCommandType, target: string, args: string[]): string[] {
    const baseCommands: Record<DiagnosticCommandType, string[]> = {
        ping: ['ping', '-c', '4', '-W', '5'],
        traceroute: ['traceroute', '-m', '20', '-w', '5'],
        nslookup: ['nslookup'],
        curl: ['curl', '-I', '-s', '-S', '-m', '10'],
        wget: ['wget', '-q', '-O', '-', '-T', '10', '--spider']
    };

    const baseArgs = baseCommands[commandType];
    const customArgs = args.filter(arg => !baseArgs.some(base => arg.startsWith(base.split('=')[0])));

    return [...baseArgs, ...customArgs, target];
}

/**
 * Interpret diagnostic command output
 */
function interpretDiagnosticOutput(commandType: DiagnosticCommandType, output: string, success: boolean): string {
    if (!success) {
        return 'Command failed or timed out. Check error details.';
    }

    const lowerOutput = output.toLowerCase();

    switch (commandType) {
        case 'ping':
            if (lowerOutput.includes('0 received') || lowerOutput.includes('100% packet loss')) {
                return 'No response - host is unreachable or blocking ICMP packets';
            } else if (lowerOutput.includes('time=')) {
                const times = output.match(/time=(\d+\.?\d*)\s*ms/g);
                if (times && times.length > 0) {
                    const avgMatch = output.match(/avg[^=]*=\s*(\d+\.?\d*)/);
                    const avg = avgMatch ? avgMatch[1] : 'N/A';
                    return `Host is reachable. Average latency: ${avg}ms`;
                }
                return 'Host is reachable';
            }
            return 'Ping completed with unknown result';

        case 'traceroute':
            const hops = output.split('\n').filter(line => /^\s*\d+\s+/.test(line)).length;
            if (hops === 0) {
                return 'No route to host - connection blocked or target unreachable';
            }
            return `Route traced with ${hops} hop(s). Check output for network path details.`;

        case 'nslookup':
            if (lowerOutput.includes('can\'t find') || lowerOutput.includes('nxdomain')) {
                return 'DNS resolution failed - domain not found';
            } else if (lowerOutput.includes('address:') || lowerOutput.includes('addresses:')) {
                const addresses = output.match(/Address(?:es)?:\s*(.+)/gi);
                if (addresses && addresses.length > 0) {
                    return `DNS resolution successful. ${addresses.length} address(es) found.`;
                }
                return 'DNS resolution successful';
            } else if (lowerOutput.includes('timeout') || lowerOutput.includes('no servers')) {
                return 'DNS query timed out or no DNS servers available';
            }
            return 'DNS query completed';

        case 'curl':
            if (lowerOutput.includes('http/')) {
                const statusMatch = output.match(/HTTP\/[\d.]+\s+(\d+)/);
                if (statusMatch) {
                    const status = parseInt(statusMatch[1]);
                    if (status >= 200 && status < 300) {
                        return `HTTP connection successful (Status: ${status})`;
                    } else if (status >= 300 && status < 400) {
                        return `HTTP redirect received (Status: ${status})`;
                    } else if (status >= 400 && status < 500) {
                        return `HTTP client error (Status: ${status})`;
                    } else if (status >= 500) {
                        return `HTTP server error (Status: ${status})`;
                    }
                }
                return 'HTTP connection established';
            } else if (lowerOutput.includes('could not resolve')) {
                return 'DNS resolution failed - cannot resolve hostname';
            } else if (lowerOutput.includes('connection refused')) {
                return 'Connection refused - port is closed or service not listening';
            } else if (lowerOutput.includes('timeout')) {
                return 'Connection timed out - host unreachable or firewall blocking';
            }
            return 'cURL request completed';

        case 'wget':
            if (lowerOutput.includes('200 ok') || lowerOutput.includes('remote file exists')) {
                return 'HTTP connection successful - resource exists';
            } else if (lowerOutput.includes('404')) {
                return 'HTTP 404 - resource not found';
            } else if (lowerOutput.includes('unable to resolve')) {
                return 'DNS resolution failed - cannot resolve hostname';
            } else if (lowerOutput.includes('connection refused')) {
                return 'Connection refused - port is closed or service not listening';
            } else if (lowerOutput.includes('timeout')) {
                return 'Connection timed out - host unreachable or firewall blocking';
            }
            return 'wget request completed';

        default:
            return 'Command completed';
    }
}

/**
 * Run diagnostic command with safety checks and user consent tracking
 *
 * This tool executes network diagnostic commands (ping, traceroute, nslookup, curl, wget)
 * safely within Docker containers. All inputs are validated and sanitized.
 *
 * **User Consent Flow:**
 * - Frontend should request user approval before calling this tool
 * - Command type, target, and container should be displayed to user
 * - User must explicitly approve the diagnostic command execution
 *
 * @param options Command options with validation
 * @returns Diagnostic command result with interpreted output
 */
export async function runDiagnosticCommand(options: RunDiagnosticCommandOptions): Promise<ToolResult<DiagnosticCommandResult>> {
    const {
        commandType,
        target,
        container,
        args = [],
        timeoutMs = 10000
    } = options;

    try {
        logger.info({ commandType, target, container }, 'Running diagnostic command with user consent');

        // Step 1: Validate command type
        const validCommands: DiagnosticCommandType[] = ['ping', 'traceroute', 'nslookup', 'curl', 'wget'];
        if (!validCommands.includes(commandType)) {
            return {
                success: false,
                error: `Invalid command type: ${commandType}. Allowed: ${validCommands.join(', ')}`
            };
        }

        // Step 2: Validate target
        const targetValidation = validateTarget(target);
        if (!targetValidation.valid || !targetValidation.sanitized) {
            return {
                success: false,
                error: targetValidation.error || 'Invalid target'
            };
        }
        const sanitizedTarget = targetValidation.sanitized;

        // Step 3: Validate arguments
        const argsValidation = validateCommandArgs(args, commandType);
        if (!argsValidation.valid) {
            return {
                success: false,
                error: argsValidation.error || 'Invalid arguments'
            };
        }
        const sanitizedArgs = argsValidation.sanitized || [];

        // Step 4: Validate timeout
        const maxTimeout = 30000;
        const validTimeout = Math.min(Math.max(timeoutMs, 1000), maxTimeout);

        // Step 5: Determine container to execute in
        let execContainer = container;
        if (!execContainer) {
            // Try to find a suitable container (prefer gluetun for network diagnostics)
            try {
                const gluetunRunning = await arrService.isContainerRunning('gluetun');
                if (gluetunRunning) {
                    execContainer = 'gluetun';
                } else {
                    // Fallback to first available arr service
                    const arrStatus = await arrService.getArrServicesStatus();
                    const runningArr = arrStatus.find(s => s.running);
                    if (runningArr?.containerName) {
                        execContainer = runningArr.containerName;
                    }
                }
            } catch (err: unknown) {
                logger.warn({ err }, 'Failed to auto-detect container for diagnostic command');
            }

            if (!execContainer) {
                return {
                    success: false,
                    error: 'No suitable container found for diagnostic command. Please specify a container.'
                };
            }
        }

        // Step 6: Validate container name
        const containerValidation = validateServiceName(execContainer);
        if (!containerValidation.valid || !containerValidation.sanitized) {
            return {
                success: false,
                error: containerValidation.error || 'Invalid container name'
            };
        }
        const sanitizedContainer = containerValidation.sanitized;

        // Step 7: Build command arguments
        const commandArgs = buildDiagnosticCommand(commandType, sanitizedTarget, sanitizedArgs);

        logger.info({ container: sanitizedContainer, command: commandArgs }, 'Executing diagnostic command');

        // Step 8: Execute command in container
        const startTime = Date.now();
        let output = '';
        let success = true;
        let error: string | undefined;

        try {
            output = await runCommand('docker', [
                'exec',
                sanitizedContainer,
                ...commandArgs
            ], { timeoutMs: validTimeout });

            logger.debug({ output: output.substring(0, 500) }, 'Diagnostic command completed');
        } catch (err: unknown) {
            success = false;
            error = getErrorMessage(err);
            output = error;
            logger.warn({ err, commandType, target }, 'Diagnostic command failed');
        }

        const executionTimeMs = Date.now() - startTime;

        // Step 9: Interpret output
        const summary = interpretDiagnosticOutput(commandType, output, success);

        return {
            success: true,
            data: {
                commandType,
                target: sanitizedTarget,
                container: sanitizedContainer,
                success,
                output: output.substring(0, 2000), // Limit output size
                error,
                executionTimeMs,
                summary
            }
        };

    } catch (err: unknown) {
        logger.error({ err, commandType, target }, 'Diagnostic command execution failed');
        return {
            success: false,
            error: getErrorMessage(err)
        };
    }
}

/**
 * Export all diagnostic tools
 */
export const diagnosticTools = {
    diagnose_vpn_connectivity: diagnoseVpnConnectivity,
    diagnose_arr_connections: diagnoseArrConnections,
    diagnose_media_scanner: diagnoseMediaScanner,
    run_diagnostic_command: runDiagnosticCommand
};

/**
 * Tool metadata for diagnostic tools
 */
export interface DiagnosticToolMetadata {
    name: string;
    description: string;
    category: 'vpn' | 'arr' | 'media' | 'network' | 'general';
    estimatedDurationMs: number;
    knowledgeModules: string[];
    riskLevel: 'low' | 'medium' | 'high';
}

export const DIAGNOSTIC_TOOL_METADATA: Record<string, DiagnosticToolMetadata> = {
    diagnose_vpn_connectivity: {
        name: 'diagnose_vpn_connectivity',
        description: 'Comprehensive VPN connectivity diagnosis including routing, DNS, and service network attachment',
        category: 'vpn',
        estimatedDurationMs: 30000,
        knowledgeModules: ['vpnTroubleshooting', 'dockerNetworking'],
        riskLevel: 'low'
    },
    diagnose_arr_connections: {
        name: 'diagnose_arr_connections',
        description: 'Comprehensive Arr service interconnection diagnosis including API keys, service connectivity, and download client configuration',
        category: 'arr',
        estimatedDurationMs: 45000,
        knowledgeModules: ['arrInterconnection', 'dockerNetworking'],
        riskLevel: 'low'
    },
    diagnose_media_scanner: {
        name: 'diagnose_media_scanner',
        description: 'Comprehensive Plex/Jellyfin/Emby media scanning diagnosis including library paths, file permissions, naming conventions, and log analysis',
        category: 'media',
        estimatedDurationMs: 40000,
        knowledgeModules: ['mediaScanning'],
        riskLevel: 'low'
    },
    run_diagnostic_command: {
        name: 'run_diagnostic_command',
        description: 'Execute safe network diagnostic commands (ping, traceroute, nslookup, curl, wget) with explicit user consent and comprehensive validation',
        category: 'network',
        estimatedDurationMs: 15000,
        knowledgeModules: [],
        riskLevel: 'low'
    }
};
