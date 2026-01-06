/**
 * Configuration Fix Generator Service
 * Analyzes detected issues and generates specific configuration fixes
 * Supports .env variables, docker-compose changes, and service settings
 * Updated: January 2026
 */

import { createLogger } from '../utils/logger.js';
import { getErrorMessage } from '../utils/errors.js';
import type { Solution } from '../knowledge/vpnTroubleshooting.js';
import type { VpnDiagnosticData, ArrDiagnosticData, MediaScannerDiagnosticData } from '../tools/diagnosticTools.js';

const logger = createLogger('configFixGenerator');

/**
 * Type of configuration change
 */
export type ConfigChangeType = 'env' | 'compose' | 'service-setting' | 'file';

/**
 * Risk level for configuration change
 */
export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

/**
 * Single configuration change item
 */
export interface ConfigChange {
    /** Type of change */
    type: ConfigChangeType;
    /** Target file or location */
    target: string;
    /** Key/field being changed */
    key: string;
    /** Current value (if exists) */
    currentValue?: string;
    /** New/recommended value */
    newValue: string;
    /** Description of what this change does */
    description: string;
    /** Whether this is optional */
    optional: boolean;
}

/**
 * Backup strategy for configuration changes
 */
export interface BackupStrategy {
    /** Whether backup is required */
    required: boolean;
    /** Files to backup before applying changes */
    filesToBackup: string[];
    /** Backup location suggestion */
    backupLocation?: string;
    /** Restore instructions */
    restoreInstructions?: string[];
}

/**
 * Rollback information
 */
export interface RollbackPlan {
    /** Whether automatic rollback is possible */
    automatic: boolean;
    /** Steps to manually rollback if needed */
    manualSteps: string[];
    /** Validation checks to confirm rollback success */
    validationChecks?: string[];
}

/**
 * Complete configuration fix
 */
export interface ConfigFix {
    /** Unique fix identifier */
    id: string;
    /** Fix title */
    title: string;
    /** Detailed description */
    description: string;
    /** Category of fix */
    category: 'vpn' | 'docker' | 'arr' | 'media' | 'network' | 'general';
    /** Severity of the issue this fixes */
    severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
    /** Risk level of applying this fix */
    riskLevel: RiskLevel;
    /** Services affected by this fix */
    affectedServices: string[];
    /** Configuration changes to apply */
    changes: ConfigChange[];
    /** Backup strategy */
    backup: BackupStrategy;
    /** Rollback plan */
    rollback: RollbackPlan;
    /** Whether services need to be restarted */
    requiresRestart: boolean;
    /** Services that need to be restarted */
    servicesToRestart?: string[];
    /** Step-by-step apply instructions */
    applyInstructions: string[];
    /** Validation steps to confirm fix worked */
    validationSteps?: string[];
    /** Additional notes or warnings */
    notes?: string[];
    /** Original solution from knowledge base (if applicable) */
    originalSolution?: Solution;
    /** Estimated time to apply (in seconds) */
    estimatedTime?: number;
}

/**
 * Options for generating fixes
 */
export interface GenerateFixOptions {
    /** Include low-risk fixes only */
    lowRiskOnly?: boolean;
    /** Specific services to focus on */
    services?: string[];
    /** Exclude certain types of changes */
    excludeTypes?: ConfigChangeType[];
    /** Include detailed diff output */
    includeDiff?: boolean;
}

/**
 * Generated fix summary
 */
export interface GeneratedFixSummary {
    /** Total number of fixes generated */
    totalFixes: number;
    /** Fixes by category */
    byCategory: Record<string, number>;
    /** Fixes by risk level */
    byRiskLevel: Record<RiskLevel, number>;
    /** Critical fixes that should be applied immediately */
    criticalFixes: string[];
    /** All generated fixes */
    fixes: ConfigFix[];
}

/**
 * Parse Solution from knowledge base into ConfigFix
 */
export function solutionToConfigFix(
    solution: Solution,
    issueId: string,
    category: ConfigFix['category'],
    severity: ConfigFix['severity'],
    affectedServices: string[]
): ConfigFix {
    const fixId = `fix_${issueId}_${Date.now()}`;
    const changes: ConfigChange[] = [];

    // Extract environment variable changes
    if (solution.envVars) {
        for (const [key, value] of Object.entries(solution.envVars)) {
            changes.push({
                type: 'env',
                target: '.env',
                key,
                newValue: value,
                description: `Set ${key} environment variable`,
                optional: false
            });
        }
    }

    // Parse config example for docker-compose changes
    if (solution.configExample) {
        // Try to detect network_mode changes
        const networkModeMatch = solution.configExample.match(/network_mode:\s*["']?([^"'\n]+)["']?/);
        if (networkModeMatch) {
            changes.push({
                type: 'compose',
                target: 'docker-compose.yml',
                key: 'network_mode',
                newValue: networkModeMatch[1],
                description: 'Update container network mode',
                optional: false
            });
        }

        // Try to detect environment variable additions in compose
        const envMatches = solution.configExample.matchAll(/environment:[\s\S]*?-\s+(\w+)=([^\n]+)/g);
        for (const match of envMatches) {
            const [, key, value] = match;
            if (key && value && !solution.envVars?.[key]) {
                changes.push({
                    type: 'compose',
                    target: 'docker-compose.yml',
                    key: `environment.${key}`,
                    newValue: value.trim(),
                    description: `Add ${key} to container environment`,
                    optional: false
                });
            }
        }

        // Try to detect volume additions
        const volumeMatches = solution.configExample.matchAll(/volumes:[\s\S]*?-\s+([^\n]+)/g);
        for (const match of volumeMatches) {
            const volumeSpec = match[1]?.trim();
            if (volumeSpec) {
                changes.push({
                    type: 'compose',
                    target: 'docker-compose.yml',
                    key: 'volumes',
                    newValue: volumeSpec,
                    description: 'Add volume mount',
                    optional: false
                });
            }
        }
    }

    // Determine risk level based on changes and severity
    let riskLevel: RiskLevel = 'low';
    if (severity === 'critical' || severity === 'high') {
        riskLevel = 'medium';
    }
    if (changes.some(c => c.type === 'compose' && c.key === 'network_mode')) {
        riskLevel = 'high'; // Network changes are risky
    }
    if (changes.length > 5) {
        riskLevel = 'high'; // Many changes increase risk
    }

    // Determine which services need restart
    const servicesToRestart = solution.requiresRestart ? affectedServices : [];

    // Generate backup strategy
    const filesToBackup = new Set<string>();
    changes.forEach(change => {
        if (change.target) {
            filesToBackup.add(change.target);
        }
    });

    const backup: BackupStrategy = {
        required: riskLevel === 'high' || riskLevel === 'critical' || servicesToRestart.length > 0,
        filesToBackup: Array.from(filesToBackup),
        backupLocation: './backups',
        restoreInstructions: [
            'Stop affected services: docker-compose stop ' + servicesToRestart.join(' '),
            'Restore backup files from ./backups/',
            'Start services: docker-compose up -d ' + servicesToRestart.join(' ')
        ]
    };

    // Generate rollback plan
    const rollback: RollbackPlan = {
        automatic: false, // Manual rollback for safety
        manualSteps: [
            'If issues occur after applying this fix:',
            '1. Stop affected services',
            '2. Restore configuration files from backup',
            '3. Restart services',
            '4. Verify services are working with: docker-compose ps',
            '5. Check logs for errors: docker-compose logs -f'
        ],
        validationChecks: [
            'Run docker-compose ps to check service status',
            'Check service logs for errors',
            'Test service connectivity'
        ]
    };

    // Generate apply instructions
    const applyInstructions: string[] = [];

    // Step 1: Backup
    if (backup.required) {
        applyInstructions.push('1. Create backup of configuration files:');
        backup.filesToBackup.forEach(file => {
            applyInstructions.push(`   cp ${file} ${file}.backup.$(date +%Y%m%d_%H%M%S)`);
        });
    }

    // Step 2: Apply changes
    let stepNum = backup.required ? 2 : 1;
    applyInstructions.push(`${stepNum}. Apply configuration changes:`);
    changes.forEach((change, idx) => {
        if (change.type === 'env') {
            applyInstructions.push(`   ${String.fromCharCode(97 + idx)}. Add to ${change.target}: ${change.key}=${change.newValue}`);
        } else if (change.type === 'compose') {
            applyInstructions.push(`   ${String.fromCharCode(97 + idx)}. Update ${change.target}: ${change.description}`);
        }
    });

    // Step 3: Restart if needed
    if (servicesToRestart.length > 0) {
        stepNum++;
        applyInstructions.push(`${stepNum}. Restart affected services:`);
        applyInstructions.push(`   docker-compose restart ${servicesToRestart.join(' ')}`);
    }

    // Step 4: Validation
    stepNum++;
    applyInstructions.push(`${stepNum}. Verify the fix:`);
    applyInstructions.push('   docker-compose ps');
    applyInstructions.push('   docker-compose logs -f --tail 50');

    // Estimate time to apply
    const estimatedTime = 30 + (changes.length * 10) + (servicesToRestart.length * 30);

    // Compile notes
    const notes: string[] = [];
    if (solution.notes) {
        notes.push(solution.notes);
    }
    if (riskLevel === 'high' || riskLevel === 'critical') {
        notes.push('⚠️ This fix involves risky changes. Ensure you have backups before proceeding.');
    }
    if (servicesToRestart.length > 0) {
        notes.push(`Services will be restarted: ${servicesToRestart.join(', ')}`);
    }

    return {
        id: fixId,
        title: solution.title,
        description: solution.description,
        category,
        severity,
        riskLevel,
        affectedServices,
        changes,
        backup,
        rollback,
        requiresRestart: solution.requiresRestart,
        servicesToRestart,
        applyInstructions,
        validationSteps: rollback.validationChecks,
        notes: notes.length > 0 ? notes : undefined,
        originalSolution: solution,
        estimatedTime
    };
}

/**
 * Generate configuration fixes from VPN diagnostic results
 */
export function generateVpnFixes(
    diagnosticData: VpnDiagnosticData,
    options?: GenerateFixOptions
): ConfigFix[] {
    const fixes: ConfigFix[] = [];

    try {
        // Generate fixes from matched issues and recommendations
        for (const matchedIssue of diagnosticData.matchedIssues) {
            const issue = matchedIssue.issue;

            // Convert each solution to a ConfigFix
            for (const solution of issue.solutions) {
                const affectedServices = diagnosticData.affectedServices || ['gluetun'];
                const fix = solutionToConfigFix(
                    solution,
                    issue.id,
                    'vpn',
                    issue.severity,
                    affectedServices
                );

                // Apply filters if specified
                if (options?.lowRiskOnly && (fix.riskLevel === 'high' || fix.riskLevel === 'critical')) {
                    continue;
                }
                if (options?.services && !fix.affectedServices.some(s => options.services!.includes(s))) {
                    continue;
                }
                if (options?.excludeTypes && fix.changes.some(c => options.excludeTypes!.includes(c.type))) {
                    continue;
                }

                fixes.push(fix);
            }
        }

        logger.debug({ fixCount: fixes.length }, 'Generated VPN configuration fixes');
    } catch (error) {
        logger.error({ error: getErrorMessage(error) }, 'Error generating VPN fixes');
    }

    return fixes;
}

/**
 * Generate configuration fixes from Arr diagnostic results
 */
export function generateArrFixes(
    diagnosticData: ArrDiagnosticData,
    options?: GenerateFixOptions
): ConfigFix[] {
    const fixes: ConfigFix[] = [];

    try {
        // Generate fixes from matched issues and recommendations
        for (const matchedIssue of diagnosticData.matchedIssues) {
            const issue = matchedIssue.issue;

            // Convert each solution to a ConfigFix
            for (const solution of issue.solutions) {
                const affectedServices = diagnosticData.services
                    .filter(s => s.issues && s.issues.length > 0)
                    .map(s => s.name);

                const fix = solutionToConfigFix(
                    solution,
                    issue.id,
                    'arr',
                    issue.severity,
                    affectedServices.length > 0 ? affectedServices : ['sonarr', 'radarr', 'prowlarr']
                );

                // Apply filters if specified
                if (options?.lowRiskOnly && (fix.riskLevel === 'high' || fix.riskLevel === 'critical')) {
                    continue;
                }
                if (options?.services && !fix.affectedServices.some(s => options.services!.includes(s))) {
                    continue;
                }
                if (options?.excludeTypes && fix.changes.some(c => options.excludeTypes!.includes(c.type))) {
                    continue;
                }

                fixes.push(fix);
            }
        }

        logger.debug({ fixCount: fixes.length }, 'Generated Arr configuration fixes');
    } catch (error) {
        logger.error({ error: getErrorMessage(error) }, 'Error generating Arr fixes');
    }

    return fixes;
}

/**
 * Generate configuration fixes from Media Scanner diagnostic results
 */
export function generateMediaScannerFixes(
    diagnosticData: MediaScannerDiagnosticData,
    options?: GenerateFixOptions
): ConfigFix[] {
    const fixes: ConfigFix[] = [];

    try {
        // Generate fixes from matched issues and recommendations
        for (const matchedIssue of diagnosticData.matchedIssues) {
            const issue = matchedIssue.issue;

            // Convert each solution to a ConfigFix
            for (const solution of issue.solutions) {
                const affectedServices = diagnosticData.servers
                    .filter(s => s.issues && s.issues.length > 0)
                    .map(s => s.containerName || 'media-server');

                const fix = solutionToConfigFix(
                    solution,
                    issue.id,
                    'media',
                    issue.severity,
                    affectedServices.length > 0 ? affectedServices : ['plex']
                );

                // Apply filters if specified
                if (options?.lowRiskOnly && (fix.riskLevel === 'high' || fix.riskLevel === 'critical')) {
                    continue;
                }
                if (options?.services && !fix.affectedServices.some(s => options.services!.includes(s))) {
                    continue;
                }
                if (options?.excludeTypes && fix.changes.some(c => options.excludeTypes!.includes(c.type))) {
                    continue;
                }

                fixes.push(fix);
            }
        }

        logger.debug({ fixCount: fixes.length }, 'Generated Media Scanner configuration fixes');
    } catch (error) {
        logger.error({ error: getErrorMessage(error) }, 'Error generating Media Scanner fixes');
    }

    return fixes;
}

/**
 * Generate comprehensive fix summary from diagnostic results
 */
export function generateFixSummary(
    diagnosticResults: {
        vpn?: VpnDiagnosticData;
        arr?: ArrDiagnosticData;
        media?: MediaScannerDiagnosticData;
    },
    options?: GenerateFixOptions
): GeneratedFixSummary {
    const allFixes: ConfigFix[] = [];

    // Generate fixes from each diagnostic type
    if (diagnosticResults.vpn) {
        allFixes.push(...generateVpnFixes(diagnosticResults.vpn, options));
    }
    if (diagnosticResults.arr) {
        allFixes.push(...generateArrFixes(diagnosticResults.arr, options));
    }
    if (diagnosticResults.media) {
        allFixes.push(...generateMediaScannerFixes(diagnosticResults.media, options));
    }

    // Calculate statistics
    const byCategory: Record<string, number> = {};
    const byRiskLevel: Record<RiskLevel, number> = { low: 0, medium: 0, high: 0, critical: 0 };
    const criticalFixes: string[] = [];

    for (const fix of allFixes) {
        // Count by category
        byCategory[fix.category] = (byCategory[fix.category] || 0) + 1;

        // Count by risk level
        byRiskLevel[fix.riskLevel]++;

        // Track critical fixes
        if (fix.severity === 'critical' || fix.riskLevel === 'critical') {
            criticalFixes.push(fix.id);
        }
    }

    return {
        totalFixes: allFixes.length,
        byCategory,
        byRiskLevel,
        criticalFixes,
        fixes: allFixes
    };
}

/**
 * Format configuration fix as human-readable text
 */
export function formatConfigFix(fix: ConfigFix, includeDetails = true): string {
    const lines: string[] = [];

    // Header
    lines.push(`## ${fix.title}`);
    lines.push('');
    lines.push(fix.description);
    lines.push('');

    // Metadata
    lines.push(`**Category:** ${fix.category}`);
    lines.push(`**Severity:** ${fix.severity}`);
    lines.push(`**Risk Level:** ${fix.riskLevel}`);
    lines.push(`**Affected Services:** ${fix.affectedServices.join(', ')}`);
    if (fix.estimatedTime) {
        lines.push(`**Estimated Time:** ${fix.estimatedTime}s`);
    }
    lines.push('');

    if (includeDetails) {
        // Changes
        lines.push('### Changes to Apply');
        lines.push('');
        for (const change of fix.changes) {
            lines.push(`- **${change.type}** (${change.target}):`);
            lines.push(`  - ${change.description}`);
            if (change.currentValue) {
                lines.push(`  - Current: \`${change.currentValue}\``);
            }
            lines.push(`  - New: \`${change.newValue}\``);
            lines.push('');
        }

        // Apply Instructions
        lines.push('### How to Apply');
        lines.push('');
        for (const instruction of fix.applyInstructions) {
            lines.push(instruction);
        }
        lines.push('');

        // Notes
        if (fix.notes && fix.notes.length > 0) {
            lines.push('### Important Notes');
            lines.push('');
            for (const note of fix.notes) {
                lines.push(`- ${note}`);
            }
            lines.push('');
        }

        // Rollback
        if (fix.rollback.manualSteps.length > 0) {
            lines.push('### Rollback Instructions');
            lines.push('');
            for (const step of fix.rollback.manualSteps) {
                lines.push(step);
            }
            lines.push('');
        }
    }

    return lines.join('\n');
}

/**
 * Generate diff-style output for configuration changes
 */
export function generateConfigDiff(fix: ConfigFix): string {
    const lines: string[] = [];

    lines.push(`--- ${fix.title} ---`);
    lines.push('');

    for (const change of fix.changes) {
        lines.push(`--- ${change.target}`);
        lines.push(`+++ ${change.target}`);

        if (change.currentValue) {
            lines.push(`- ${change.key}=${change.currentValue}`);
        }
        lines.push(`+ ${change.key}=${change.newValue}`);
        lines.push('');
    }

    return lines.join('\n');
}

/**
 * Create a custom configuration fix manually
 */
export function createCustomConfigFix(params: {
    title: string;
    description: string;
    category: ConfigFix['category'];
    severity: ConfigFix['severity'];
    affectedServices: string[];
    changes: ConfigChange[];
    requiresRestart: boolean;
    notes?: string[];
}): ConfigFix {
    const fixId = `custom_fix_${Date.now()}`;

    // Determine risk level
    let riskLevel: RiskLevel = 'low';
    if (params.severity === 'critical') riskLevel = 'critical';
    else if (params.severity === 'high') riskLevel = 'high';
    else if (params.changes.some(c => c.type === 'compose')) riskLevel = 'medium';

    // Generate backup strategy
    const filesToBackup = [...new Set(params.changes.map(c => c.target))];
    const backup: BackupStrategy = {
        required: riskLevel !== 'low' || params.requiresRestart,
        filesToBackup,
        backupLocation: './backups',
        restoreInstructions: [
            'Restore backup files from ./backups/',
            'Restart affected services if needed'
        ]
    };

    // Generate rollback plan
    const rollback: RollbackPlan = {
        automatic: false,
        manualSteps: [
            'Stop affected services',
            'Restore configuration from backup',
            'Restart services',
            'Verify functionality'
        ]
    };

    // Generate apply instructions
    const applyInstructions: string[] = [
        '1. Backup configuration files',
        '2. Apply the changes listed above',
        '3. Restart services if required',
        '4. Verify the fix worked'
    ];

    return {
        id: fixId,
        title: params.title,
        description: params.description,
        category: params.category,
        severity: params.severity,
        riskLevel,
        affectedServices: params.affectedServices,
        changes: params.changes,
        backup,
        rollback,
        requiresRestart: params.requiresRestart,
        servicesToRestart: params.requiresRestart ? params.affectedServices : undefined,
        applyInstructions,
        notes: params.notes,
        estimatedTime: 30 + (params.changes.length * 10)
    };
}
