/**
 * RAG (Retrieval-Augmented Generation) Service
 * Uses OpenAI File Search API for knowledge base queries
 * Provides service documentation context to agents
 * Updated: December 2025
 */

import { readdir, readFile, stat } from 'fs/promises';
import { join } from 'path';
import { PROJECT_ROOT } from '../utils/env.js';
import pino from 'pino';

const logger = pino({
    level: process.env.LOG_LEVEL || 'info',
    transport: { target: 'pino-pretty', options: { colorize: true } }
});

const DOCS_DIR = join(PROJECT_ROOT, 'docs');
const KNOWLEDGE_BASE_ID = process.env.OPENAI_VECTOR_STORE_ID || '';

export interface KnowledgeDocument {
    id: string;
    title: string;
    content: string;
    source: string;
    category: 'service' | 'setup' | 'troubleshooting' | 'general';
    tags: string[];
    lastUpdated: string;
}

export interface SearchResult {
    document: KnowledgeDocument;
    score: number;
    excerpt: string;
}

// Local knowledge base (fallback when OpenAI not available)
const LOCAL_KNOWLEDGE: KnowledgeDocument[] = [
    {
        id: 'plex-setup',
        title: 'Plex Media Server Setup',
        content: `
# Plex Media Server Configuration

## Initial Setup
1. Access Plex at http://localhost:32400/web
2. Sign in with your Plex account
3. Name your server and configure remote access

## Adding Libraries
- Movies: Point to /data/media/movies
- TV Shows: Point to /data/media/tv
- Music: Point to /data/media/music

## Environment Variables
- PLEX_CLAIM: One-time claim token from plex.tv/claim (expires after 4 minutes)
- PLEX_UID: User ID for file permissions (usually 1000)
- PLEX_GID: Group ID for file permissions (usually 1000)

## Troubleshooting
- If Plex is not accessible, check if the container is running
- Verify port 32400 is not blocked by firewall
- Check logs with: docker logs plex
        `.trim(),
        source: 'local',
        category: 'service',
        tags: ['plex', 'media-server', 'streaming'],
        lastUpdated: new Date().toISOString()
    },
    {
        id: 'sonarr-setup',
        title: 'Sonarr TV Management',
        content: `
# Sonarr Configuration

## Initial Setup
1. Access Sonarr at http://localhost:8989
2. Configure root folder as /data/media/tv
3. Add indexers via Prowlarr integration

## Download Client Setup
- Navigate to Settings > Download Clients
- Add qBittorrent or your preferred client
- Host: qbittorrent, Port: 8080
- Username/Password from qBittorrent config

## Quality Profiles
- Recommended: HD-1080p for most setups
- Use "Any" for maximum availability
- Custom profiles for specific needs

## Environment Variables
- SONARR__AUTH__APIKEY: API key (auto-generated)
- PUID/PGID: User/Group ID for permissions

## Troubleshooting
- Check /config/logs for detailed errors
- Verify download client connectivity
- Ensure root folder has write permissions
        `.trim(),
        source: 'local',
        category: 'service',
        tags: ['sonarr', 'tv', 'automation'],
        lastUpdated: new Date().toISOString()
    },
    {
        id: 'radarr-setup',
        title: 'Radarr Movie Management',
        content: `
# Radarr Configuration

## Initial Setup
1. Access Radarr at http://localhost:7878
2. Configure root folder as /data/media/movies
3. Add indexers via Prowlarr integration

## Download Client Setup
- Navigate to Settings > Download Clients
- Add qBittorrent or your preferred client
- Configuration similar to Sonarr

## Quality Profiles
- Recommended: HD-1080p or Ultra-HD for 4K
- Balance between quality and storage

## Lists Integration
- Add Trakt, IMDb, or TMDb lists
- Automatic movie discovery and addition

## Troubleshooting
- API key mismatch: regenerate in Settings > General
- Import failures: check file permissions
- Slow searches: verify indexer configuration
        `.trim(),
        source: 'local',
        category: 'service',
        tags: ['radarr', 'movies', 'automation'],
        lastUpdated: new Date().toISOString()
    },
    {
        id: 'prowlarr-setup',
        title: 'Prowlarr Indexer Management',
        content: `
# Prowlarr Configuration

## Initial Setup
1. Access Prowlarr at http://localhost:9696
2. Add indexers (Torznab, Newznab, etc.)
3. Connect to Sonarr/Radarr

## Adding Indexers
- Click Indexers > Add Indexer
- Select from available indexers
- Configure credentials and settings

## App Integration
- Settings > Apps > Add Application
- Add Sonarr, Radarr, Lidarr, etc.
- Use localhost for same-Docker network

## Sync Profiles
- Create profiles for different quality/speed needs
- Assign profiles to applications

## FlareSolverr Integration
- Required for Cloudflare-protected indexers
- Add as proxy: http://flaresolverr:8191
        `.trim(),
        source: 'local',
        category: 'service',
        tags: ['prowlarr', 'indexers', 'automation'],
        lastUpdated: new Date().toISOString()
    },
    {
        id: 'gluetun-vpn',
        title: 'Gluetun VPN Configuration',
        content: `
# Gluetun VPN Setup

## Supported Providers
- Mullvad, NordVPN, Surfshark, PIA
- Custom OpenVPN/WireGuard configs

## Environment Variables (Example: Mullvad)
- VPN_SERVICE_PROVIDER=mullvad
- VPN_TYPE=wireguard
- WIREGUARD_PRIVATE_KEY=your_key
- WIREGUARD_ADDRESSES=10.x.x.x/32
- SERVER_CITIES=city1,city2

## Network Configuration
- Other containers route through Gluetun
- Use network_mode: "service:gluetun"

## Troubleshooting
- Check external IP: docker exec gluetun wget -qO- ifconfig.me
- View logs: docker logs gluetun
- Verify kill switch: disconnect VPN and check connectivity
        `.trim(),
        source: 'local',
        category: 'service',
        tags: ['gluetun', 'vpn', 'privacy', 'wireguard'],
        lastUpdated: new Date().toISOString()
    },
    {
        id: 'cloudflare-tunnel',
        title: 'Cloudflare Tunnel Setup',
        content: `
# Cloudflare Tunnel Configuration

## Prerequisites
1. Cloudflare account with domain
2. Create tunnel at dash.cloudflare.com/tunnels
3. Get tunnel token

## Environment Variables
- TUNNEL_TOKEN: Your tunnel token from Cloudflare

## Public Hostname Configuration
- Add routes in Cloudflare dashboard
- Example: plex.yourdomain.com -> http://plex:32400

## Security Features
- Zero Trust access policies
- Email/OAuth authentication
- IP restrictions

## Troubleshooting
- Verify token is correct
- Check tunnel status in Cloudflare dashboard
- Review container logs for connection issues
        `.trim(),
        source: 'local',
        category: 'setup',
        tags: ['cloudflare', 'tunnel', 'remote-access', 'security'],
        lastUpdated: new Date().toISOString()
    }
];

// In-memory index for local search
const searchIndex = new Map<string, Set<string>>();

function buildSearchIndex(): void {
    searchIndex.clear();
    for (const doc of LOCAL_KNOWLEDGE) {
        const words = `${doc.title} ${doc.content} ${doc.tags.join(' ')}`
            .toLowerCase()
            .split(/\W+/)
            .filter(w => w.length > 2);

        for (const word of words) {
            if (!searchIndex.has(word)) {
                searchIndex.set(word, new Set());
            }
            searchIndex.get(word)!.add(doc.id);
        }
    }
}

// Build index on module load
buildSearchIndex();

/**
 * Search local knowledge base
 */
export function searchLocalKnowledge(query: string, limit = 5): SearchResult[] {
    const queryWords = query.toLowerCase().split(/\W+/).filter(w => w.length > 2);
    const docScores = new Map<string, number>();

    // Score documents based on word matches
    for (const word of queryWords) {
        // Exact match
        if (searchIndex.has(word)) {
            for (const docId of searchIndex.get(word)!) {
                docScores.set(docId, (docScores.get(docId) || 0) + 2);
            }
        }
        // Prefix match
        for (const [indexWord, docIds] of searchIndex) {
            if (indexWord.startsWith(word) || word.startsWith(indexWord)) {
                for (const docId of docIds) {
                    docScores.set(docId, (docScores.get(docId) || 0) + 1);
                }
            }
        }
    }

    // Sort by score and return top results
    const results: SearchResult[] = [];
    const sortedDocs = [...docScores.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, limit);

    for (const [docId, score] of sortedDocs) {
        const doc = LOCAL_KNOWLEDGE.find(d => d.id === docId);
        if (doc) {
            // Find relevant excerpt
            const queryLower = query.toLowerCase();
            const contentLines = doc.content.split('\n');
            const excerpt = contentLines.find(line =>
                line.toLowerCase().includes(queryLower)
            ) || contentLines.slice(0, 3).join('\n');

            results.push({
                document: doc,
                score: score / (queryWords.length * 2), // Normalize to 0-1
                excerpt: excerpt.substring(0, 200)
            });
        }
    }

    return results;
}

/**
 * Get document by ID
 */
export function getDocument(id: string): KnowledgeDocument | undefined {
    return LOCAL_KNOWLEDGE.find(d => d.id === id);
}

/**
 * Get documents by category
 */
export function getDocumentsByCategory(category: KnowledgeDocument['category']): KnowledgeDocument[] {
    return LOCAL_KNOWLEDGE.filter(d => d.category === category);
}

/**
 * Get documents by tag
 */
export function getDocumentsByTag(tag: string): KnowledgeDocument[] {
    return LOCAL_KNOWLEDGE.filter(d => d.tags.includes(tag.toLowerCase()));
}

/**
 * Search with OpenAI File Search API (if configured)
 */
export async function searchWithOpenAI(query: string, limit = 5): Promise<SearchResult[]> {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey || !KNOWLEDGE_BASE_ID) {
        logger.debug('OpenAI File Search not configured, using local knowledge');
        return searchLocalKnowledge(query, limit);
    }

    try {
        // Use OpenAI's file search API
        const response = await fetch('https://api.openai.com/v1/vector_stores/' + KNOWLEDGE_BASE_ID + '/search', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
                'OpenAI-Beta': 'assistants=v2'
            },
            body: JSON.stringify({
                query,
                max_results: limit
            })
        });

        if (!response.ok) {
            logger.warn({ status: response.status }, 'OpenAI File Search failed, using local');
            return searchLocalKnowledge(query, limit);
        }

        const data = await response.json();

        // Transform OpenAI results to our format
        return data.results?.map((r: any) => ({
            document: {
                id: r.file_id,
                title: r.filename || 'Unknown',
                content: r.content?.[0]?.text || '',
                source: 'openai',
                category: 'general' as const,
                tags: [],
                lastUpdated: new Date().toISOString()
            },
            score: r.score || 0,
            excerpt: r.content?.[0]?.text?.substring(0, 200) || ''
        })) || [];
    } catch (err) {
        logger.error({ err }, 'OpenAI File Search error');
        return searchLocalKnowledge(query, limit);
    }
}

/**
 * Augment a prompt with relevant knowledge
 */
export async function augmentWithKnowledge(
    userQuery: string,
    options: { maxDocs?: number; useOpenAI?: boolean } = {}
): Promise<string> {
    const { maxDocs = 3, useOpenAI = true } = options;

    const results = useOpenAI
        ? await searchWithOpenAI(userQuery, maxDocs)
        : searchLocalKnowledge(userQuery, maxDocs);

    if (results.length === 0) {
        return '';
    }

    const context = results
        .map(r => `### ${r.document.title}\n${r.excerpt}`)
        .join('\n\n');

    return `
## Relevant Documentation
The following documentation may be helpful for answering the user's question:

${context}

---
Use this information to provide accurate, context-aware responses.
`.trim();
}

/**
 * Load custom documentation from project docs folder
 */
export async function loadCustomDocs(): Promise<void> {
    try {
        const files = await readdir(DOCS_DIR);
        for (const file of files) {
            if (!file.endsWith('.md')) continue;

            try {
                const filePath = join(DOCS_DIR, file);
                const content = await readFile(filePath, 'utf-8');
                const stats = await stat(filePath);

                const id = file.replace('.md', '').toLowerCase().replace(/\s+/g, '-');
                const title = file.replace('.md', '').replace(/_/g, ' ');

                // Check if already exists
                const existingIdx = LOCAL_KNOWLEDGE.findIndex(d => d.id === id);
                const doc: KnowledgeDocument = {
                    id,
                    title,
                    content,
                    source: 'custom',
                    category: 'general',
                    tags: extractTags(content),
                    lastUpdated: stats.mtime.toISOString()
                };

                if (existingIdx >= 0) {
                    LOCAL_KNOWLEDGE[existingIdx] = doc;
                } else {
                    LOCAL_KNOWLEDGE.push(doc);
                }

                logger.info({ file, id }, 'Loaded custom documentation');
            } catch (err) {
                logger.warn({ file, err }, 'Failed to load custom doc');
            }
        }

        // Rebuild search index
        buildSearchIndex();
    } catch {
        // Docs dir may not exist
    }
}

function extractTags(content: string): string[] {
    const tags = new Set<string>();

    // Extract service names
    const serviceMatches = content.match(/\b(plex|sonarr|radarr|prowlarr|jellyfin|qbittorrent|gluetun|authelia|cloudflare)\b/gi);
    if (serviceMatches) {
        serviceMatches.forEach(m => tags.add(m.toLowerCase()));
    }

    // Extract common topics
    const topicMatches = content.match(/\b(setup|configuration|troubleshooting|security|vpn|docker)\b/gi);
    if (topicMatches) {
        topicMatches.forEach(m => tags.add(m.toLowerCase()));
    }

    return [...tags];
}

// Load custom docs on startup
loadCustomDocs().catch(() => { /* ignore */ });
