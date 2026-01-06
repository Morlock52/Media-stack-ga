/**
 * Troubleshooting Session Store
 * Persistent storage for troubleshooting sessions with diagnostic results,
 * attempted fixes, and resolution status
 * Updated: January 2026
 */

import { readFile, writeFile, mkdir, readdir, unlink, stat } from 'fs/promises';
import { join } from 'path';
import { randomBytes } from 'crypto';
import { PROJECT_ROOT } from '../utils/env.js';
import { createLogger } from '../utils/logger.js';
import type { Solution } from '../knowledge/vpnTroubleshooting.js';
import type { VpnDiagnosticData, ArrDiagnosticData, MediaScannerDiagnosticData } from '../tools/diagnosticTools.js';

const logger = createLogger('troubleshootingStore');

const SESSIONS_DIR = join(PROJECT_ROOT, 'data', 'troubleshooting-sessions');
const INDEX_FILE = join(SESSIONS_DIR, '_index.json');
const MAX_SESSIONS = 100;
const MAX_DIAGNOSTICS_PER_SESSION = 50;

/**
 * Category of troubleshooting problem
 */
export type ProblemCategory = 'vpn' | 'docker' | 'arr' | 'media' | 'network' | 'general';

/**
 * Session status
 */
export type SessionStatus = 'open' | 'in_progress' | 'resolved' | 'closed';

/**
 * Diagnostic result from a tool execution
 */
export interface DiagnosticResult {
    /** Timestamp of diagnostic execution */
    timestamp: string;
    /** Tool name that produced this result */
    tool: 'diagnose_vpn_connectivity' | 'diagnose_arr_connections' | 'diagnose_media_scanner' | 'analyze_logs' | 'network_diagnostics';
    /** Diagnostic data (tool-specific structure) */
    results: VpnDiagnosticData | ArrDiagnosticData | MediaScannerDiagnosticData | unknown;
    /** Matched issue patterns with confidence */
    matchedIssues: Array<{
        id: string;
        title: string;
        confidence: 'high' | 'medium' | 'low';
        category?: string;
    }>;
    /** Overall health status from this diagnostic */
    healthy?: boolean;
    /** Summary of findings */
    summary?: string;
}

/**
 * Attempted fix during troubleshooting
 */
export interface AttemptedFix {
    /** Timestamp of fix attempt */
    timestamp: string;
    /** Description of what was attempted */
    description: string;
    /** Solution details from knowledge base */
    solution?: Solution;
    /** Whether the fix was actually applied */
    applied: boolean;
    /** Whether the fix was successful (if applied) */
    successful?: boolean;
    /** Additional notes */
    notes?: string;
    /** Who/what applied the fix */
    appliedBy?: 'user' | 'ai' | 'system';
}

/**
 * Session resolution information
 */
export interface SessionResolution {
    /** Timestamp of resolution */
    timestamp: string;
    /** Summary of how the issue was resolved */
    summary: string;
    /** Final solution that worked */
    finalSolution?: string;
    /** Root cause identified */
    rootCause?: string;
}

/**
 * Troubleshooting session
 */
export interface TroubleshootingSession {
    /** Unique session ID */
    id: string;
    /** Creation timestamp */
    createdAt: string;
    /** Last update timestamp */
    updatedAt: string;
    /** Current status */
    status: SessionStatus;

    /** Problem description */
    problem: {
        /** Category of issue */
        category: ProblemCategory;
        /** User's description of the problem */
        description: string;
        /** Services affected by the issue */
        affectedServices: string[];
        /** Severity of the issue */
        severity?: 'critical' | 'high' | 'medium' | 'low';
    };

    /** Diagnostic results from various tools */
    diagnostics: DiagnosticResult[];

    /** Attempted fixes */
    attemptedFixes: AttemptedFix[];

    /** Resolution (if resolved) */
    resolution?: SessionResolution;

    /** Metadata */
    metadata?: {
        /** Linked conversation ID */
        conversationId?: string;
        /** User agent string */
        userAgent?: string;
        /** Tags for categorization */
        tags?: string[];
        /** Custom fields */
        [key: string]: unknown;
    };
}

/**
 * Session index for fast listing
 */
interface SessionIndex {
    version: number;
    sessions: Array<{
        id: string;
        createdAt: string;
        updatedAt: string;
        status: SessionStatus;
        category: ProblemCategory;
        preview: string;
        affectedServices: string[];
        diagnosticCount: number;
        fixCount: number;
        resolved: boolean;
    }>;
    lastCleanup: string;
    metrics: {
        totalSessions: number;
        resolvedSessions: number;
        averageDiagnosticsPerSession: number;
        averageFixesPerSession: number;
        resolutionRate: number;
    };
}

async function ensureDir(): Promise<void> {
    try {
        await mkdir(SESSIONS_DIR, { recursive: true });
    } catch {
        /* exists */
    }
}

export function generateSessionId(): string {
    return `ts_${Date.now().toString(36)}_${randomBytes(4).toString('hex')}`;
}

function getSessionPath(id: string): string {
    const sanitizedId = id.replace(/[^a-zA-Z0-9_-]/g, '');
    return join(SESSIONS_DIR, `${sanitizedId}.json`);
}

async function loadIndex(): Promise<SessionIndex> {
    try {
        const data = await readFile(INDEX_FILE, 'utf-8');
        return JSON.parse(data);
    } catch {
        return {
            version: 1,
            sessions: [],
            lastCleanup: new Date().toISOString(),
            metrics: {
                totalSessions: 0,
                resolvedSessions: 0,
                averageDiagnosticsPerSession: 0,
                averageFixesPerSession: 0,
                resolutionRate: 0
            }
        };
    }
}

async function saveIndex(index: SessionIndex): Promise<void> {
    await ensureDir();

    // Update metrics
    index.metrics.totalSessions = index.sessions.length;
    index.metrics.resolvedSessions = index.sessions.filter(s => s.resolved).length;
    index.metrics.resolutionRate = index.metrics.totalSessions > 0
        ? Math.round((index.metrics.resolvedSessions / index.metrics.totalSessions) * 100)
        : 0;

    const totalDiagnostics = index.sessions.reduce((sum, s) => sum + s.diagnosticCount, 0);
    const totalFixes = index.sessions.reduce((sum, s) => sum + s.fixCount, 0);

    index.metrics.averageDiagnosticsPerSession = index.metrics.totalSessions > 0
        ? Math.round(totalDiagnostics / index.metrics.totalSessions)
        : 0;
    index.metrics.averageFixesPerSession = index.metrics.totalSessions > 0
        ? Math.round(totalFixes / index.metrics.totalSessions)
        : 0;

    await writeFile(INDEX_FILE, JSON.stringify(index, null, 2));
}

async function updateIndex(session: TroubleshootingSession): Promise<void> {
    const index = await loadIndex();
    const existingIdx = index.sessions.findIndex(s => s.id === session.id);
    const preview = session.problem.description.substring(0, 100);

    const entry = {
        id: session.id,
        createdAt: session.createdAt,
        updatedAt: session.updatedAt,
        status: session.status,
        category: session.problem.category,
        preview,
        affectedServices: session.problem.affectedServices,
        diagnosticCount: session.diagnostics.length,
        fixCount: session.attemptedFixes.length,
        resolved: session.status === 'resolved'
    };

    if (existingIdx >= 0) {
        index.sessions[existingIdx] = entry;
    } else {
        index.sessions.unshift(entry);
    }

    // Sort by updatedAt descending
    index.sessions.sort((a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );

    await saveIndex(index);
}

/**
 * Create a new troubleshooting session
 */
export async function createSession(
    problem: TroubleshootingSession['problem'],
    metadata?: TroubleshootingSession['metadata']
): Promise<TroubleshootingSession> {
    await ensureDir();
    const now = new Date().toISOString();

    const session: TroubleshootingSession = {
        id: generateSessionId(),
        createdAt: now,
        updatedAt: now,
        status: 'open',
        problem,
        diagnostics: [],
        attemptedFixes: [],
        metadata
    };

    await saveSession(session);
    logger.info({ sessionId: session.id, category: problem.category }, 'Created new troubleshooting session');
    await cleanupOldSessions();
    return session;
}

/**
 * Get a troubleshooting session by ID
 */
export async function getSession(id: string): Promise<TroubleshootingSession | null> {
    try {
        const data = await readFile(getSessionPath(id), 'utf-8');
        return JSON.parse(data) as TroubleshootingSession;
    } catch {
        return null;
    }
}

/**
 * Save a troubleshooting session
 */
export async function saveSession(session: TroubleshootingSession): Promise<void> {
    await ensureDir();
    session.updatedAt = new Date().toISOString();

    // Truncate diagnostics if too many
    if (session.diagnostics.length > MAX_DIAGNOSTICS_PER_SESSION) {
        session.diagnostics = session.diagnostics.slice(-MAX_DIAGNOSTICS_PER_SESSION);
        logger.warn({ sessionId: session.id }, 'Truncated diagnostics to stay within limit');
    }

    await writeFile(getSessionPath(session.id), JSON.stringify(session, null, 2));
    await updateIndex(session);
}

/**
 * Update session status
 */
export async function updateSessionStatus(
    sessionId: string,
    status: SessionStatus,
    resolution?: SessionResolution
): Promise<TroubleshootingSession | null> {
    const session = await getSession(sessionId);
    if (!session) return null;

    session.status = status;
    if (status === 'resolved' && resolution) {
        session.resolution = resolution;
    }

    await saveSession(session);
    logger.info({ sessionId, status }, 'Updated session status');
    return session;
}

/**
 * Add a diagnostic result to a session
 */
export async function addDiagnostic(
    sessionId: string,
    diagnostic: Omit<DiagnosticResult, 'timestamp'>
): Promise<TroubleshootingSession | null> {
    const session = await getSession(sessionId);
    if (!session) return null;

    session.diagnostics.push({
        ...diagnostic,
        timestamp: new Date().toISOString()
    });

    // Auto-update status if not already in progress
    if (session.status === 'open') {
        session.status = 'in_progress';
    }

    await saveSession(session);
    logger.info({ sessionId, tool: diagnostic.tool }, 'Added diagnostic to session');
    return session;
}

/**
 * Add an attempted fix to a session
 */
export async function addAttemptedFix(
    sessionId: string,
    fix: Omit<AttemptedFix, 'timestamp'>
): Promise<TroubleshootingSession | null> {
    const session = await getSession(sessionId);
    if (!session) return null;

    session.attemptedFixes.push({
        ...fix,
        timestamp: new Date().toISOString()
    });

    await saveSession(session);
    logger.info({ sessionId, applied: fix.applied, successful: fix.successful }, 'Added attempted fix to session');
    return session;
}

/**
 * Delete a troubleshooting session
 */
export async function deleteSession(id: string): Promise<boolean> {
    try {
        await unlink(getSessionPath(id));

        // Update index
        const index = await loadIndex();
        index.sessions = index.sessions.filter(s => s.id !== id);
        await saveIndex(index);

        logger.info({ sessionId: id }, 'Deleted troubleshooting session');
        return true;
    } catch {
        return false;
    }
}

/**
 * List troubleshooting sessions with optional filtering
 */
export async function listSessions(
    limit = 20,
    options?: {
        status?: SessionStatus;
        category?: ProblemCategory;
        resolved?: boolean;
        search?: string;
        affectedService?: string;
    }
): Promise<Array<{
    id: string;
    createdAt: string;
    updatedAt: string;
    status: SessionStatus;
    category: ProblemCategory;
    preview: string;
    affectedServices: string[];
    diagnosticCount: number;
    fixCount: number;
    resolved: boolean;
}>> {
    const index = await loadIndex();
    let sessions = index.sessions;

    // Apply filters
    if (options?.status) {
        sessions = sessions.filter(s => s.status === options.status);
    }

    if (options?.category) {
        sessions = sessions.filter(s => s.category === options.category);
    }

    if (options?.resolved !== undefined) {
        sessions = sessions.filter(s => s.resolved === options.resolved);
    }

    if (options?.affectedService) {
        const serviceLower = options.affectedService.toLowerCase();
        sessions = sessions.filter(s =>
            s.affectedServices.some(svc => svc.toLowerCase().includes(serviceLower))
        );
    }

    if (options?.search) {
        const searchLower = options.search.toLowerCase();
        sessions = sessions.filter(s =>
            s.preview.toLowerCase().includes(searchLower) ||
            s.affectedServices.some(svc => svc.toLowerCase().includes(searchLower))
        );
    }

    return sessions.slice(0, limit);
}

/**
 * Get recent sessions for a specific service
 */
export async function getRecentSessionsForService(
    serviceName: string,
    limit = 5
): Promise<TroubleshootingSession[]> {
    const index = await loadIndex();
    const serviceLower = serviceName.toLowerCase();

    const matchingSessions = index.sessions
        .filter(s => s.affectedServices.some(svc => svc.toLowerCase().includes(serviceLower)))
        .slice(0, limit)
        .map(s => s.id);

    const results: TroubleshootingSession[] = [];
    for (const id of matchingSessions) {
        const session = await getSession(id);
        if (session) results.push(session);
    }
    return results;
}

/**
 * Get sessions linked to a conversation
 */
export async function getSessionsByConversation(
    conversationId: string,
    limit = 10
): Promise<TroubleshootingSession[]> {
    const index = await loadIndex();
    const sessionIds = index.sessions.slice(0, 50).map(s => s.id); // Check recent sessions

    const results: TroubleshootingSession[] = [];
    for (const id of sessionIds) {
        const session = await getSession(id);
        if (session?.metadata?.conversationId === conversationId) {
            results.push(session);
            if (results.length >= limit) break;
        }
    }
    return results;
}

/**
 * Search sessions by problem description or notes
 */
export async function searchSessions(query: string, limit = 10): Promise<TroubleshootingSession[]> {
    const index = await loadIndex();
    const searchLower = query.toLowerCase();

    // Filter by preview match
    const matchingIds = index.sessions
        .filter(s => s.preview.toLowerCase().includes(searchLower))
        .slice(0, limit)
        .map(s => s.id);

    const results: TroubleshootingSession[] = [];
    for (const id of matchingIds) {
        const session = await getSession(id);
        if (session) results.push(session);
    }
    return results;
}

/**
 * Get troubleshooting metrics
 */
export async function getSessionMetrics(): Promise<{
    totalSessions: number;
    resolvedSessions: number;
    resolutionRate: number;
    averageDiagnosticsPerSession: number;
    averageFixesPerSession: number;
    storageBytes: number;
    sessionsByCategory: Record<ProblemCategory, number>;
    sessionsByStatus: Record<SessionStatus, number>;
}> {
    const index = await loadIndex();

    // Calculate storage size
    let storageBytes = 0;
    try {
        const files = await readdir(SESSIONS_DIR);
        for (const file of files) {
            if (!file.endsWith('.json')) continue;
            try {
                const s = await stat(join(SESSIONS_DIR, file));
                storageBytes += s.size;
            } catch {
                /* skip */
            }
        }
    } catch {
        /* skip */
    }

    // Count by category
    const sessionsByCategory: Record<ProblemCategory, number> = {
        vpn: 0,
        docker: 0,
        arr: 0,
        media: 0,
        network: 0,
        general: 0
    };
    for (const session of index.sessions) {
        sessionsByCategory[session.category] = (sessionsByCategory[session.category] || 0) + 1;
    }

    // Count by status
    const sessionsByStatus: Record<SessionStatus, number> = {
        open: 0,
        in_progress: 0,
        resolved: 0,
        closed: 0
    };
    for (const session of index.sessions) {
        sessionsByStatus[session.status] = (sessionsByStatus[session.status] || 0) + 1;
    }

    return {
        ...index.metrics,
        storageBytes,
        sessionsByCategory,
        sessionsByStatus
    };
}

/**
 * Get context summary for a session (useful for AI prompts)
 */
export async function getSessionContext(sessionId: string): Promise<string | null> {
    const session = await getSession(sessionId);
    if (!session) return null;

    let context = `# Troubleshooting Session: ${session.id}\n\n`;
    context += `**Status:** ${session.status}\n`;
    context += `**Category:** ${session.problem.category}\n`;
    context += `**Problem:** ${session.problem.description}\n`;
    context += `**Affected Services:** ${session.problem.affectedServices.join(', ')}\n\n`;

    if (session.diagnostics.length > 0) {
        context += `## Diagnostics Run (${session.diagnostics.length})\n`;
        for (const diag of session.diagnostics.slice(-3)) { // Last 3 diagnostics
            context += `- ${diag.tool}: ${diag.summary || 'No summary'} (${diag.matchedIssues.length} issues found)\n`;
        }
        context += '\n';
    }

    if (session.attemptedFixes.length > 0) {
        context += `## Attempted Fixes (${session.attemptedFixes.length})\n`;
        for (const fix of session.attemptedFixes.slice(-3)) { // Last 3 fixes
            const status = fix.applied ? (fix.successful ? '✓ Success' : '✗ Failed') : '○ Not applied';
            context += `- ${status}: ${fix.description}\n`;
        }
        context += '\n';
    }

    if (session.resolution) {
        context += `## Resolution\n`;
        context += `${session.resolution.summary}\n`;
        if (session.resolution.rootCause) {
            context += `**Root Cause:** ${session.resolution.rootCause}\n`;
        }
    }

    return context;
}

/**
 * Cleanup old sessions
 */
async function cleanupOldSessions(): Promise<void> {
    try {
        const index = await loadIndex();
        if (index.sessions.length <= MAX_SESSIONS) return;

        // Delete oldest sessions
        const toDelete = index.sessions.slice(MAX_SESSIONS);
        for (const session of toDelete) {
            try {
                await unlink(getSessionPath(session.id));
                logger.info({ sessionId: session.id }, 'Cleaned up old troubleshooting session');
            } catch {
                /* skip */
            }
        }

        // Update index
        index.sessions = index.sessions.slice(0, MAX_SESSIONS);
        index.lastCleanup = new Date().toISOString();
        await saveIndex(index);
    } catch (err) {
        logger.error({ err }, 'Troubleshooting session cleanup failed');
    }
}

/**
 * Get active (non-resolved) sessions
 */
export async function getActiveSessions(limit = 10): Promise<TroubleshootingSession[]> {
    return listSessions(limit, { resolved: false }).then(async sessionList => {
        const results: TroubleshootingSession[] = [];
        for (const sessionInfo of sessionList) {
            const session = await getSession(sessionInfo.id);
            if (session) results.push(session);
        }
        return results;
    });
}

/**
 * Get recently resolved sessions (for learning from past solutions)
 */
export async function getRecentlyResolvedSessions(limit = 10): Promise<TroubleshootingSession[]> {
    return listSessions(limit, { resolved: true }).then(async sessionList => {
        const results: TroubleshootingSession[] = [];
        for (const sessionInfo of sessionList) {
            const session = await getSession(sessionInfo.id);
            if (session) results.push(session);
        }
        return results;
    });
}
