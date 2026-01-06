# Knowledge Base Module

Comprehensive troubleshooting knowledge base for Media Stack services.

## Overview

This module provides specialized knowledge bases for diagnosing and fixing common issues across all Media Stack services:

- **VPN Troubleshooting** - Gluetun VPN connectivity issues
- **Docker Networking** - Container networking and communication problems
- **Arr Interconnection** - Sonarr/Radarr/Prowlarr/qBittorrent integration issues
- **Media Scanning** - Plex/Jellyfin library and transcoding problems
- **Error Patterns** - Common log error pattern matching

## Usage

### Search Across All Modules

```typescript
import { searchKnowledge } from './knowledge/index.js';

// Search for VPN connectivity issues
const results = searchKnowledge('vpn shows healthy but cannot connect');

console.log(results.summary); // "Found 2 critical issue(s), 3 troubleshooting guide(s)"
console.log(results.totalResults); // 5

// Get top result
const topIssue = results.issues[0];
console.log(topIssue.module); // 'vpn'
console.log(topIssue.issue.title); // 'VPN shows healthy but services cannot connect'
console.log(topIssue.issue.solutions); // Array of solutions
```

### Search with Filters

```typescript
// Search only VPN and Docker modules
const vpnDockerResults = searchKnowledge('timeout', {
    modules: ['vpn', 'docker'],
    limit: 5
});

// Search only critical issues
const criticalResults = searchKnowledge('connection failed', {
    minSeverity: 'critical'
});

// Get results by module
const vpnIssues = vpnDockerResults.byModule.vpn;
const dockerIssues = vpnDockerResults.byModule.docker;
```

### Analyze Logs

```typescript
import { analyzeLogsComprehensive } from './knowledge/index.js';

const logOutput = `
[ERROR] Failed to connect to VPN server
[WARN] Connection timeout after 30s
[ERROR] API authentication failed: 401 Unauthorized
`;

const analysis = analyzeLogsComprehensive(logOutput);

console.log(analysis.summary); // "Detected 2 critical issue(s) | Issues: 1 VPN, 1 Arr, 3 error pattern(s)"
console.log(analysis.totalIssues); // 5

// Get specific issues
console.log(analysis.vpnIssues); // VPN issues found
console.log(analysis.arrIssues); // Arr issues found
console.log(analysis.errorPatterns); // Error patterns matched
console.log(analysis.allCritical); // All critical issues
```

### Get Statistics

```typescript
import { getKnowledgeBaseStats } from './knowledge/index.js';

const stats = getKnowledgeBaseStats();

console.log(stats.totalIssues); // Total issue patterns
console.log(stats.byModule); // Count per module
console.log(stats.bySeverity); // Count per severity level
```

### Get Specific Issue by ID

```typescript
import { getIssueById } from './knowledge/index.js';

const issue = getIssueById('vpn-healthy-but-no-connection');
if (issue) {
    console.log(issue.title);
    console.log(issue.diagnostics);
    console.log(issue.solutions);
}
```

### Find Related Issues

```typescript
import { findRelatedIssues } from './knowledge/index.js';

const related = findRelatedIssues('vpn-healthy-but-no-connection');
// Returns issues that reference this one in their relatedIssues array
```

## Module-Specific Usage

### VPN Troubleshooting

```typescript
import {
    searchVpnKnowledge,
    getIssuesByProvider,
    matchLogPatterns as matchVpnLogs
} from './knowledge/index.js';

// Search VPN knowledge
const vpnIssues = searchVpnKnowledge('kill switch blocking');

// Get provider-specific issues
const nordVpnIssues = getIssuesByProvider('nordvpn');

// Match log patterns
const matches = matchVpnLogs(gluetunLogOutput);
```

### Docker Networking

```typescript
import {
    searchDockerNetworkingKnowledge,
    getIssuesByNetworkMode
} from './knowledge/index.js';

// Search Docker networking issues
const dockerIssues = searchDockerNetworkingKnowledge('dns resolution failed');

// Get issues for specific network mode
const containerModeIssues = getIssuesByNetworkMode('container');
```

### Arr Interconnection

```typescript
import {
    searchArrInterconnectionKnowledge,
    getIssuesByService,
    getCommonConnectionIssues
} from './knowledge/index.js';

// Search Arr issues
const arrIssues = searchArrInterconnectionKnowledge('api key invalid');

// Get service-specific issues
const sonarrIssues = getIssuesByService('sonarr');

// Get common connection problems
const commonIssues = getCommonConnectionIssues();
```

### Media Scanning

```typescript
import {
    searchMediaScanningKB,
    getIssuesByServer,
    getPlexIssues,
    getJellyfinIssues
} from './knowledge/index.js';

// Search media scanning issues
const mediaIssues = searchMediaScanningKB('library not updating');

// Get server-specific issues
const plexIssues = getPlexIssues();
const jellyfinIssues = getJellyfinIssues();
```

### Error Patterns

```typescript
import {
    matchErrorPatterns,
    searchErrorPatterns,
    analyzeLogOutput,
    getPatternsByCategory
} from './knowledge/index.js';

// Match error patterns in logs
const matches = matchErrorPatterns(logOutput, {
    category: 'vpn'
});

// Search error patterns
const patterns = searchErrorPatterns('timeout');

// Comprehensive log analysis
const analysis = analyzeLogOutput(logOutput);
console.log(analysis.summary);
console.log(analysis.critical);
console.log(analysis.high);

// Get patterns by category
const vpnPatterns = getPatternsByCategory('vpn');
```

## Knowledge Base Structure

### Issue Pattern Structure

All issue patterns (VPN, Docker, Arr, Media) have this structure:

```typescript
{
    id: string;                    // Unique identifier
    title: string;                 // Human-readable title
    description: string;           // Detailed description
    severity: IssueSeverity;       // 'critical' | 'high' | 'medium' | 'low' | 'info'
    symptoms: string[];            // Observable symptoms
    logPatterns?: string[];        // Regex patterns to match in logs
    diagnostics: DiagnosticStep[]; // Step-by-step diagnostic instructions
    solutions: Solution[];         // Possible solutions with config examples
    relatedIssues?: string[];      // IDs of related issues
    tags: string[];                // Search tags
}
```

### Error Pattern Structure

```typescript
{
    id: string;
    category: ServiceCategory;     // 'vpn' | 'docker' | 'arr' | 'media-server' | etc.
    services?: string[];           // Specific services affected
    title: string;
    description: string;
    severity: IssueSeverity;
    patterns: string[];            // Regex patterns for log matching
    causes: string[];              // Common causes
    fixes: string[];               // Quick fixes
    knowledgeBaseRef?: {           // Link to detailed issue
        module: 'vpn' | 'docker' | 'arr' | 'media';
        issueId: string;
    };
    tags: string[];
}
```

## Coverage

### VPN Issues (7 patterns)
- VPN shows healthy but services can't connect
- Kill switch blocking local network
- VPN authentication failed
- DNS leak detection
- Port forwarding failures
- Connection timeouts
- Local network unreachable

### Docker Networking (11 patterns)
- Container cannot reach internet
- Inter-container DNS failures
- Port conflicts
- Network mode misconfiguration
- Localhost not working from container
- DNS resolution failures
- Port mapping not working
- Bridge network MTU issues
- IPv6 connectivity issues
- Container network isolation

### Arr Interconnection (8 patterns)
- Invalid/missing API keys
- URL connection failures
- Download client unreachable
- Prowlarr sync failures
- Category mapping problems
- Import failures (no files found)
- Connection test timeouts
- Indexer search failures

### Media Scanning (10 patterns)
- Library not updating
- File naming incorrect
- Permission denied errors
- Transcoding failures
- Transcoding permission issues
- Metadata not loading
- Codec not supported
- Plex claim failures
- Jellyfin reverse proxy issues

### Error Patterns (30+ patterns)
- VPN errors (5 patterns)
- Docker networking errors (6 patterns)
- Arr stack errors (6 patterns)
- Media server errors (6 patterns)
- Download client errors (2 patterns)
- General errors (5+ patterns)

## Integration with AI Assistant

The knowledge base is designed to be used by the AI troubleshooting assistant (Dr. Debug):

```typescript
// In AI tool handler
import { searchKnowledge, analyzeLogsComprehensive } from './knowledge/index.js';

// When user asks about an issue
const results = searchKnowledge(userQuery);

// When analyzing logs
const analysis = analyzeLogsComprehensive(containerLogs);

// Present results to user with solutions and diagnostic steps
```

## Performance

- **Fast in-memory search**: All data is in memory, no database queries
- **Relevance scoring**: Results ranked by relevance to query
- **Module filtering**: Search only relevant modules to reduce noise
- **Regex caching**: Log patterns compiled once

## Adding New Knowledge

To add new troubleshooting knowledge:

1. Add issue pattern to the appropriate module (`vpnTroubleshooting.ts`, `dockerNetworking.ts`, etc.)
2. Add corresponding error patterns to `errorPatterns.ts` if applicable
3. Update cross-references in `relatedIssues` fields
4. Add relevant tags for searchability

The knowledge index will automatically include new patterns without modification.
