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
// Docker networking imports - will be used in future diagnostic tools
// import {
//     DOCKER_NETWORKING_KB,
//     searchDockerNetworkingKnowledge
// } from '../knowledge/dockerNetworking.js';
import { checkServiceHealth, type ServiceHealth, type ToolResult } from './agentTools.js';

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
 * Export all diagnostic tools
 */
export const diagnosticTools = {
    diagnose_vpn_connectivity: diagnoseVpnConnectivity
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
    }
};
