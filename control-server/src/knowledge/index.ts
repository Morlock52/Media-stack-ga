/**
 * Knowledge Base Index
 * Aggregates all knowledge modules and provides unified search across troubleshooting content
 * Central access point for all troubleshooting knowledge
 */

import { createLogger } from '../utils/logger.js';

// Re-export all knowledge bases and their types
export * from './vpnTroubleshooting.js';
export * from './dockerNetworking.js';
export * from './arrInterconnection.js';
export * from './mediaScanning.js';
export * from './errorPatterns.js';

// Import specific items for aggregation
import {
    VPN_TROUBLESHOOTING_KB,
    type VpnIssuePattern,
    searchVpnKnowledge,
    matchLogPatterns as matchVpnLogPatterns,
    getCriticalIssues as getVpnCriticalIssues
} from './vpnTroubleshooting.js';

import {
    DOCKER_NETWORKING_KB,
    type DockerNetworkingIssuePattern,
    searchDockerNetworkingKnowledge,
    matchLogPatterns as matchDockerLogPatterns,
    getCriticalIssues as getDockerCriticalIssues
} from './dockerNetworking.js';

import {
    ARR_INTERCONNECTION_KB,
    type ArrInterconnectionIssuePattern,
    searchArrInterconnectionKnowledge,
    matchLogPatterns as matchArrLogPatterns,
    getCriticalIssues as getArrCriticalIssues
} from './arrInterconnection.js';

import {
    MEDIA_SCANNING_KB,
    type MediaScanningIssuePattern,
    searchMediaScanningKB,
    matchLogPatterns as matchMediaLogPatterns,
    getCriticalIssues as getMediaCriticalIssues
} from './mediaScanning.js';

import {
    ERROR_PATTERNS,
    type ErrorPattern,
    matchErrorPatterns,
    searchErrorPatterns,
    analyzeLogOutput
} from './errorPatterns.js';

import type { IssueSeverity } from './vpnTroubleshooting.js';

const logger = createLogger('knowledgeIndex');

/**
 * Knowledge module types
 */
export type KnowledgeModule = 'vpn' | 'docker' | 'arr' | 'media' | 'error-patterns';

/**
 * Union type of all issue patterns
 */
export type AnyIssuePattern =
    | VpnIssuePattern
    | DockerNetworkingIssuePattern
    | ArrInterconnectionIssuePattern
    | MediaScanningIssuePattern;

/**
 * Unified search result with source tracking
 */
export interface KnowledgeSearchResult {
    /** Source module */
    module: KnowledgeModule;
    /** Issue pattern */
    issue: AnyIssuePattern;
    /** Relevance score (higher = more relevant) */
    score: number;
}

/**
 * Error pattern search result with source tracking
 */
export interface ErrorPatternSearchResult {
    /** Always error-patterns module */
    module: 'error-patterns';
    /** Error pattern */
    pattern: ErrorPattern;
    /** Relevance score */
    score: number;
}

/**
 * Combined search results from all knowledge modules
 */
export interface ComprehensiveSearchResults {
    /** All issue pattern results */
    issues: KnowledgeSearchResult[];
    /** All error pattern results */
    errorPatterns: ErrorPatternSearchResult[];
    /** Combined count */
    totalResults: number;
    /** Query used */
    query: string;
    /** Results by module */
    byModule: {
        vpn: KnowledgeSearchResult[];
        docker: KnowledgeSearchResult[];
        arr: KnowledgeSearchResult[];
        media: KnowledgeSearchResult[];
        errorPatterns: ErrorPatternSearchResult[];
    };
    /** Critical issues found */
    critical: KnowledgeSearchResult[];
    /** High severity issues found */
    high: KnowledgeSearchResult[];
    /** Summary of results */
    summary: string;
}

/**
 * Log analysis results from all modules
 */
export interface ComprehensiveLogAnalysis {
    /** VPN issues found */
    vpnIssues: VpnIssuePattern[];
    /** Docker networking issues found */
    dockerIssues: DockerNetworkingIssuePattern[];
    /** Arr interconnection issues found */
    arrIssues: ArrInterconnectionIssuePattern[];
    /** Media scanning issues found */
    mediaIssues: MediaScanningIssuePattern[];
    /** Error patterns found */
    errorPatterns: ErrorPattern[];
    /** All critical issues across modules */
    allCritical: AnyIssuePattern[];
    /** All high severity issues */
    allHigh: AnyIssuePattern[];
    /** Total issues found */
    totalIssues: number;
    /** Summary text */
    summary: string;
}

/**
 * Statistics about the knowledge base
 */
export interface KnowledgeBaseStats {
    /** Total issue patterns */
    totalIssues: number;
    /** Total error patterns */
    totalErrorPatterns: number;
    /** Count by module */
    byModule: {
        vpn: number;
        docker: number;
        arr: number;
        media: number;
        errorPatterns: number;
    };
    /** Count by severity */
    bySeverity: {
        critical: number;
        high: number;
        medium: number;
        low: number;
        info: number;
    };
}

/**
 * Search across all knowledge modules for relevant troubleshooting information
 * Provides unified search with relevance scoring and module tracking
 *
 * @param query - Search query (keywords, symptoms, error messages)
 * @param options - Search options
 * @returns Comprehensive search results from all modules
 */
export function searchKnowledge(
    query: string,
    options: {
        /** Limit results per module (default: 10) */
        limit?: number;
        /** Filter by specific modules */
        modules?: KnowledgeModule[];
        /** Filter by minimum severity */
        minSeverity?: IssueSeverity;
        /** Include error patterns in search (default: true) */
        includeErrorPatterns?: boolean;
    } = {}
): ComprehensiveSearchResults {
    const {
        limit = 10,
        modules,
        minSeverity,
        includeErrorPatterns = true
    } = options;

    const issues: KnowledgeSearchResult[] = [];
    const errorPatternsResults: ErrorPatternSearchResult[] = [];

    // Search VPN module
    if (!modules || modules.includes('vpn')) {
        const vpnResults = searchVpnKnowledge(query);
        for (const issue of vpnResults.slice(0, limit)) {
            issues.push({
                module: 'vpn',
                issue,
                score: calculateRelevanceScore(query, issue)
            });
        }
    }

    // Search Docker module
    if (!modules || modules.includes('docker')) {
        const dockerResults = searchDockerNetworkingKnowledge(query);
        for (const issue of dockerResults.slice(0, limit)) {
            issues.push({
                module: 'docker',
                issue,
                score: calculateRelevanceScore(query, issue)
            });
        }
    }

    // Search Arr module
    if (!modules || modules.includes('arr')) {
        const arrResults = searchArrInterconnectionKnowledge(query);
        for (const issue of arrResults.slice(0, limit)) {
            issues.push({
                module: 'arr',
                issue,
                score: calculateRelevanceScore(query, issue)
            });
        }
    }

    // Search Media module
    if (!modules || modules.includes('media')) {
        const mediaResults = searchMediaScanningKB(query);
        for (const issue of mediaResults.slice(0, limit)) {
            issues.push({
                module: 'media',
                issue,
                score: calculateRelevanceScore(query, issue)
            });
        }
    }

    // Search error patterns
    if (includeErrorPatterns && (!modules || modules.includes('error-patterns'))) {
        const patterns = searchErrorPatterns(query);
        for (const pattern of patterns.slice(0, limit)) {
            errorPatternsResults.push({
                module: 'error-patterns',
                pattern,
                score: calculateErrorPatternScore(query, pattern)
            });
        }
    }

    // Filter by severity if specified
    let filteredIssues = issues;
    if (minSeverity) {
        const severityOrder: Record<IssueSeverity, number> = {
            critical: 5,
            high: 4,
            medium: 3,
            low: 2,
            info: 1
        };
        const minSeverityValue = severityOrder[minSeverity];
        filteredIssues = issues.filter(
            result => severityOrder[result.issue.severity] >= minSeverityValue
        );
    }

    // Sort all results by score
    filteredIssues.sort((a, b) => b.score - a.score);
    errorPatternsResults.sort((a, b) => b.score - a.score);

    // Group by module
    const byModule = {
        vpn: filteredIssues.filter(r => r.module === 'vpn'),
        docker: filteredIssues.filter(r => r.module === 'docker'),
        arr: filteredIssues.filter(r => r.module === 'arr'),
        media: filteredIssues.filter(r => r.module === 'media'),
        errorPatterns: errorPatternsResults
    };

    // Get critical and high severity issues
    const critical = filteredIssues.filter(r => r.issue.severity === 'critical');
    const high = filteredIssues.filter(r => r.issue.severity === 'high');

    // Generate summary
    const summary = generateSearchSummary(filteredIssues, errorPatternsResults, critical, high);

    logger.debug(
        {
            query,
            totalResults: filteredIssues.length + errorPatternsResults.length,
            criticalCount: critical.length,
            highCount: high.length
        },
        'Knowledge base search completed'
    );

    return {
        issues: filteredIssues,
        errorPatterns: errorPatternsResults,
        totalResults: filteredIssues.length + errorPatternsResults.length,
        query,
        byModule,
        critical,
        high,
        summary
    };
}

/**
 * Analyze log output against all knowledge modules
 * Identifies known issues based on log patterns
 *
 * @param logOutput - Log content to analyze
 * @param options - Analysis options
 * @returns Comprehensive analysis results from all modules
 */
export function analyzeLogsComprehensive(
    logOutput: string,
    options: {
        /** Filter by specific modules */
        modules?: KnowledgeModule[];
    } = {}
): ComprehensiveLogAnalysis {
    const { modules } = options;

    let vpnIssues: VpnIssuePattern[] = [];
    let dockerIssues: DockerNetworkingIssuePattern[] = [];
    let arrIssues: ArrInterconnectionIssuePattern[] = [];
    let mediaIssues: MediaScanningIssuePattern[] = [];
    let errorPatterns: ErrorPattern[] = [];

    // Analyze with each module
    if (!modules || modules.includes('vpn')) {
        vpnIssues = matchVpnLogPatterns(logOutput);
    }

    if (!modules || modules.includes('docker')) {
        dockerIssues = matchDockerLogPatterns(logOutput);
    }

    if (!modules || modules.includes('arr')) {
        arrIssues = matchArrLogPatterns(logOutput);
    }

    if (!modules || modules.includes('media')) {
        mediaIssues = matchMediaLogPatterns(logOutput);
    }

    if (!modules || modules.includes('error-patterns')) {
        const analysis = analyzeLogOutput(logOutput);
        errorPatterns = analysis.matches;
    }

    // Aggregate all issues
    const allIssues: AnyIssuePattern[] = [
        ...vpnIssues,
        ...dockerIssues,
        ...arrIssues,
        ...mediaIssues
    ];

    // Get critical and high severity
    const allCritical = allIssues.filter(issue => issue.severity === 'critical');
    const allHigh = allIssues.filter(issue => issue.severity === 'high');

    // Generate summary
    const summary = generateLogAnalysisSummary(
        vpnIssues.length,
        dockerIssues.length,
        arrIssues.length,
        mediaIssues.length,
        errorPatterns.length,
        allCritical.length,
        allHigh.length
    );

    logger.info(
        {
            totalIssues: allIssues.length + errorPatterns.length,
            criticalCount: allCritical.length,
            highCount: allHigh.length
        },
        'Comprehensive log analysis completed'
    );

    return {
        vpnIssues,
        dockerIssues,
        arrIssues,
        mediaIssues,
        errorPatterns,
        allCritical,
        allHigh,
        totalIssues: allIssues.length + errorPatterns.length,
        summary
    };
}

/**
 * Get all critical issues from all modules
 */
export function getAllCriticalIssues(): AnyIssuePattern[] {
    return [
        ...getVpnCriticalIssues(),
        ...getDockerCriticalIssues(),
        ...getArrCriticalIssues(),
        ...getMediaCriticalIssues()
    ];
}

/**
 * Get statistics about the knowledge base
 */
export function getKnowledgeBaseStats(): KnowledgeBaseStats {
    const allIssues = [
        ...VPN_TROUBLESHOOTING_KB,
        ...DOCKER_NETWORKING_KB,
        ...ARR_INTERCONNECTION_KB,
        ...MEDIA_SCANNING_KB
    ];

    const bySeverity = {
        critical: allIssues.filter(i => i.severity === 'critical').length,
        high: allIssues.filter(i => i.severity === 'high').length,
        medium: allIssues.filter(i => i.severity === 'medium').length,
        low: allIssues.filter(i => i.severity === 'low').length,
        info: allIssues.filter(i => i.severity === 'info').length
    };

    return {
        totalIssues: allIssues.length,
        totalErrorPatterns: ERROR_PATTERNS.length,
        byModule: {
            vpn: VPN_TROUBLESHOOTING_KB.length,
            docker: DOCKER_NETWORKING_KB.length,
            arr: ARR_INTERCONNECTION_KB.length,
            media: MEDIA_SCANNING_KB.length,
            errorPatterns: ERROR_PATTERNS.length
        },
        bySeverity
    };
}

/**
 * Get issue by ID from any module
 */
export function getIssueById(issueId: string): AnyIssuePattern | ErrorPattern | undefined {
    // Check each module
    const vpnIssue = VPN_TROUBLESHOOTING_KB.find(i => i.id === issueId);
    if (vpnIssue) return vpnIssue;

    const dockerIssue = DOCKER_NETWORKING_KB.find(i => i.id === issueId);
    if (dockerIssue) return dockerIssue;

    const arrIssue = ARR_INTERCONNECTION_KB.find(i => i.id === issueId);
    if (arrIssue) return arrIssue;

    const mediaIssue = MEDIA_SCANNING_KB.find(i => i.id === issueId);
    if (mediaIssue) return mediaIssue;

    const errorPattern = ERROR_PATTERNS.find(p => p.id === issueId);
    if (errorPattern) return errorPattern;

    return undefined;
}

/**
 * Get related issues across all modules
 */
export function findRelatedIssues(issueId: string): AnyIssuePattern[] {
    const allIssues = [
        ...VPN_TROUBLESHOOTING_KB,
        ...DOCKER_NETWORKING_KB,
        ...ARR_INTERCONNECTION_KB,
        ...MEDIA_SCANNING_KB
    ];

    const related: AnyIssuePattern[] = [];

    for (const issue of allIssues) {
        if (issue.relatedIssues?.includes(issueId)) {
            related.push(issue);
        }
    }

    return related;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Calculate relevance score for an issue based on query
 */
function calculateRelevanceScore(query: string, issue: AnyIssuePattern): number {
    const searchTerms = query.toLowerCase().split(/\s+/);
    let score = 0;

    // Check title (highest weight)
    for (const term of searchTerms) {
        if (issue.title.toLowerCase().includes(term)) {
            score += 10;
        }
    }

    // Check tags
    for (const term of searchTerms) {
        if (issue.tags.some(tag => tag.toLowerCase().includes(term))) {
            score += 5;
        }
    }

    // Check symptoms
    for (const term of searchTerms) {
        if (issue.symptoms.some(symptom => symptom.toLowerCase().includes(term))) {
            score += 3;
        }
    }

    // Check description
    for (const term of searchTerms) {
        if (issue.description.toLowerCase().includes(term)) {
            score += 2;
        }
    }

    // Boost critical issues slightly
    if (issue.severity === 'critical') {
        score += 1;
    }

    return score;
}

/**
 * Calculate relevance score for an error pattern
 */
function calculateErrorPatternScore(query: string, pattern: ErrorPattern): number {
    const searchTerms = query.toLowerCase().split(/\s+/);
    let score = 0;

    // Check title
    for (const term of searchTerms) {
        if (pattern.title.toLowerCase().includes(term)) {
            score += 10;
        }
    }

    // Check tags
    for (const term of searchTerms) {
        if (pattern.tags.some(tag => tag.toLowerCase().includes(term))) {
            score += 5;
        }
    }

    // Check causes
    for (const term of searchTerms) {
        if (pattern.causes.some(cause => cause.toLowerCase().includes(term))) {
            score += 3;
        }
    }

    // Check description
    for (const term of searchTerms) {
        if (pattern.description.toLowerCase().includes(term)) {
            score += 2;
        }
    }

    // Boost critical patterns
    if (pattern.severity === 'critical') {
        score += 1;
    }

    return score;
}

/**
 * Generate summary text for search results
 */
function generateSearchSummary(
    issues: KnowledgeSearchResult[],
    errorPatterns: ErrorPatternSearchResult[],
    critical: KnowledgeSearchResult[],
    high: KnowledgeSearchResult[]
): string {
    const totalResults = issues.length + errorPatterns.length;

    if (totalResults === 0) {
        return 'No matching troubleshooting information found';
    }

    const parts: string[] = [];

    if (critical.length > 0) {
        parts.push(`${critical.length} critical issue(s)`);
    }

    if (high.length > 0) {
        parts.push(`${high.length} high severity issue(s)`);
    }

    if (issues.length > 0) {
        parts.push(`${issues.length} troubleshooting guide(s)`);
    }

    if (errorPatterns.length > 0) {
        parts.push(`${errorPatterns.length} error pattern(s)`);
    }

    return `Found ${parts.join(', ')}`;
}

/**
 * Generate summary text for log analysis
 */
function generateLogAnalysisSummary(
    vpnCount: number,
    dockerCount: number,
    arrCount: number,
    mediaCount: number,
    errorPatternCount: number,
    criticalCount: number,
    highCount: number
): string {
    const totalIssues = vpnCount + dockerCount + arrCount + mediaCount + errorPatternCount;

    if (totalIssues === 0) {
        return 'No known issues detected in logs';
    }

    const parts: string[] = [];

    if (criticalCount > 0) {
        parts.push(`${criticalCount} critical issue(s)`);
    }

    if (highCount > 0) {
        parts.push(`${highCount} high severity issue(s)`);
    }

    const categoryParts: string[] = [];
    if (vpnCount > 0) categoryParts.push(`${vpnCount} VPN`);
    if (dockerCount > 0) categoryParts.push(`${dockerCount} Docker`);
    if (arrCount > 0) categoryParts.push(`${arrCount} Arr`);
    if (mediaCount > 0) categoryParts.push(`${mediaCount} media`);
    if (errorPatternCount > 0) categoryParts.push(`${errorPatternCount} error pattern(s)`);

    if (categoryParts.length > 0) {
        parts.push(`Issues: ${categoryParts.join(', ')}`);
    }

    return `Detected ${parts.join(' | ')}`;
}
