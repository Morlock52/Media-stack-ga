/**
 * Enhanced Conversation History Persistence
 * Features: Better structure, encryption support, metrics, search
 * Updated: December 2025
 */

import { readFile, writeFile, mkdir, readdir, unlink, stat } from 'fs/promises';
import { join } from 'path';
import { createCipheriv, createDecipheriv, randomBytes, createHash } from 'crypto';
import { PROJECT_ROOT } from '../utils/env.js';
import pino from 'pino';

const logger = pino({
    level: process.env.LOG_LEVEL || 'info',
    transport: { target: 'pino-pretty', options: { colorize: true } }
});

const CONVERSATIONS_DIR = join(PROJECT_ROOT, 'data', 'conversations');
const INDEX_FILE = join(CONVERSATIONS_DIR, '_index.json');
const MAX_CONVERSATIONS = 100;
const MAX_MESSAGES_PER_CONVERSATION = 100;
const ENCRYPTION_ALGORITHM = 'aes-256-gcm';

// Encryption key from env or generate a stable one based on project path
function getEncryptionKey(): Buffer {
    const envKey = process.env.CONVERSATION_ENCRYPTION_KEY;
    if (envKey && envKey.length >= 32) {
        return Buffer.from(envKey.slice(0, 32));
    }
    // Generate deterministic key from project path (for development)
    return createHash('sha256').update(PROJECT_ROOT + '_conversations').digest();
}

export interface ConversationMessage {
    role: 'system' | 'user' | 'assistant' | 'tool';
    content: string;
    timestamp: string;
    agent?: string;
    toolCall?: { name: string; result?: any };
    tokens?: number;
}

export interface Conversation {
    id: string;
    createdAt: string;
    updatedAt: string;
    messages: ConversationMessage[];
    metadata?: {
        agent?: string;
        plan?: any;
        userAgent?: string;
        totalTokens?: number;
        lastModel?: string;
    };
    encrypted?: boolean;
}

interface ConversationIndex {
    version: number;
    conversations: Array<{
        id: string;
        createdAt: string;
        updatedAt: string;
        messageCount: number;
        preview: string;
        agent?: string;
        totalTokens?: number;
    }>;
    lastCleanup: string;
    metrics: {
        totalConversations: number;
        totalMessages: number;
        averageMessagesPerConversation: number;
    };
}

// Encryption helpers
function encrypt(text: string): string {
    const key = getEncryptionKey();
    const iv = randomBytes(16);
    const cipher = createCipheriv(ENCRYPTION_ALGORITHM, key, iv);
    const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
}

function decrypt(encryptedText: string): string {
    try {
        const [ivHex, tagHex, dataHex] = encryptedText.split(':');
        if (!ivHex || !tagHex || !dataHex) throw new Error('Invalid encrypted format');

        const key = getEncryptionKey();
        const iv = Buffer.from(ivHex, 'hex');
        const tag = Buffer.from(tagHex, 'hex');
        const encrypted = Buffer.from(dataHex, 'hex');

        const decipher = createDecipheriv(ENCRYPTION_ALGORITHM, key, iv);
        decipher.setAuthTag(tag);
        return decipher.update(encrypted) + decipher.final('utf8');
    } catch (err) {
        logger.error({ err }, 'Decryption failed');
        throw new Error('Failed to decrypt conversation data');
    }
}

async function ensureDir(): Promise<void> {
    try {
        await mkdir(CONVERSATIONS_DIR, { recursive: true });
    } catch {
        /* exists */
    }
}

export function generateConversationId(): string {
    return `conv_${Date.now().toString(36)}_${randomBytes(4).toString('hex')}`;
}

function getConversationPath(id: string): string {
    const sanitizedId = id.replace(/[^a-zA-Z0-9_-]/g, '');
    return join(CONVERSATIONS_DIR, `${sanitizedId}.json`);
}

async function loadIndex(): Promise<ConversationIndex> {
    try {
        const data = await readFile(INDEX_FILE, 'utf-8');
        return JSON.parse(data);
    } catch {
        return {
            version: 1,
            conversations: [],
            lastCleanup: new Date().toISOString(),
            metrics: {
                totalConversations: 0,
                totalMessages: 0,
                averageMessagesPerConversation: 0
            }
        };
    }
}

async function saveIndex(index: ConversationIndex): Promise<void> {
    await ensureDir();
    // Update metrics
    index.metrics.totalConversations = index.conversations.length;
    index.metrics.totalMessages = index.conversations.reduce((sum, c) => sum + c.messageCount, 0);
    index.metrics.averageMessagesPerConversation =
        index.conversations.length > 0
            ? Math.round(index.metrics.totalMessages / index.conversations.length)
            : 0;
    await writeFile(INDEX_FILE, JSON.stringify(index, null, 2));
}

async function updateIndex(conversation: Conversation): Promise<void> {
    const index = await loadIndex();
    const existingIdx = index.conversations.findIndex(c => c.id === conversation.id);
    const preview = conversation.messages
        .filter(m => m.role === 'user')
        .pop()?.content.substring(0, 100) || 'Empty';

    const entry = {
        id: conversation.id,
        createdAt: conversation.createdAt,
        updatedAt: conversation.updatedAt,
        messageCount: conversation.messages.length,
        preview,
        agent: conversation.metadata?.agent,
        totalTokens: conversation.metadata?.totalTokens
    };

    if (existingIdx >= 0) {
        index.conversations[existingIdx] = entry;
    } else {
        index.conversations.unshift(entry);
    }

    // Sort by updatedAt descending
    index.conversations.sort((a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );

    await saveIndex(index);
}

export async function createConversation(
    initialMessage?: ConversationMessage,
    metadata?: Conversation['metadata'],
    options?: { encrypt?: boolean }
): Promise<Conversation> {
    await ensureDir();
    const now = new Date().toISOString();
    const conversation: Conversation = {
        id: generateConversationId(),
        createdAt: now,
        updatedAt: now,
        messages: initialMessage ? [initialMessage] : [],
        metadata,
        encrypted: options?.encrypt ?? false
    };

    await saveConversation(conversation);
    logger.info({ conversationId: conversation.id, encrypted: conversation.encrypted }, 'Created new conversation');
    await cleanupOldConversations();
    return conversation;
}

export async function getConversation(id: string): Promise<Conversation | null> {
    try {
        const data = await readFile(getConversationPath(id), 'utf-8');
        const conversation = JSON.parse(data) as Conversation;

        // Decrypt if needed
        if (conversation.encrypted) {
            conversation.messages = conversation.messages.map(m => ({
                ...m,
                content: m.content.includes(':') ? decrypt(m.content) : m.content
            }));
        }

        return conversation;
    } catch {
        return null;
    }
}

export async function saveConversation(conversation: Conversation): Promise<void> {
    await ensureDir();
    conversation.updatedAt = new Date().toISOString();

    // Truncate if too many messages
    if (conversation.messages.length > MAX_MESSAGES_PER_CONVERSATION) {
        const systemMsg = conversation.messages.find(m => m.role === 'system');
        const otherMsgs = conversation.messages
            .filter(m => m.role !== 'system')
            .slice(-MAX_MESSAGES_PER_CONVERSATION + 1);
        conversation.messages = systemMsg ? [systemMsg, ...otherMsgs] : otherMsgs;
    }

    // Calculate total tokens if not set
    if (!conversation.metadata) conversation.metadata = {};
    conversation.metadata.totalTokens = conversation.messages.reduce(
        (sum, m) => sum + (m.tokens || Math.ceil(m.content.length / 4)),
        0
    );

    // Create saveable copy (with encryption if enabled)
    let saveableConversation = conversation;
    if (conversation.encrypted) {
        saveableConversation = {
            ...conversation,
            messages: conversation.messages.map(m => ({
                ...m,
                content: encrypt(m.content)
            }))
        };
    }

    await writeFile(getConversationPath(conversation.id), JSON.stringify(saveableConversation, null, 2));
    await updateIndex(conversation);
}

export async function addMessage(
    conversationId: string,
    message: Omit<ConversationMessage, 'timestamp'>
): Promise<Conversation | null> {
    const conversation = await getConversation(conversationId);
    if (!conversation) return null;
    conversation.messages.push({ ...message, timestamp: new Date().toISOString() });
    await saveConversation(conversation);
    return conversation;
}

export async function deleteConversation(id: string): Promise<boolean> {
    try {
        await unlink(getConversationPath(id));

        // Update index
        const index = await loadIndex();
        index.conversations = index.conversations.filter(c => c.id !== id);
        await saveIndex(index);

        logger.info({ conversationId: id }, 'Deleted conversation');
        return true;
    } catch {
        return false;
    }
}

export async function listConversations(
    limit = 20,
    options?: { agent?: string; search?: string }
): Promise<Array<{
    id: string;
    createdAt: string;
    updatedAt: string;
    messageCount: number;
    preview: string;
    agent?: string;
    totalTokens?: number;
}>> {
    const index = await loadIndex();
    let conversations = index.conversations;

    // Filter by agent if specified
    if (options?.agent) {
        conversations = conversations.filter(c => c.agent === options.agent);
    }

    // Search in preview if specified
    if (options?.search) {
        const searchLower = options.search.toLowerCase();
        conversations = conversations.filter(c =>
            c.preview.toLowerCase().includes(searchLower)
        );
    }

    return conversations.slice(0, limit);
}

export async function getRecentMessages(conversationId: string, count = 10): Promise<ConversationMessage[]> {
    const conversation = await getConversation(conversationId);
    if (!conversation) return [];
    const systemMsg = conversation.messages.find(m => m.role === 'system');
    const recent = conversation.messages.filter(m => m.role !== 'system').slice(-count);
    return systemMsg ? [systemMsg, ...recent] : recent;
}

export async function searchConversations(query: string, limit = 10): Promise<Conversation[]> {
    const index = await loadIndex();
    const searchLower = query.toLowerCase();

    // Filter by preview match
    const matchingIds = index.conversations
        .filter(c => c.preview.toLowerCase().includes(searchLower))
        .slice(0, limit)
        .map(c => c.id);

    const results: Conversation[] = [];
    for (const id of matchingIds) {
        const conv = await getConversation(id);
        if (conv) results.push(conv);
    }
    return results;
}

export async function getConversationMetrics(): Promise<{
    totalConversations: number;
    totalMessages: number;
    averageMessagesPerConversation: number;
    storageBytes: number;
}> {
    const index = await loadIndex();

    // Calculate storage size
    let storageBytes = 0;
    try {
        const files = await readdir(CONVERSATIONS_DIR);
        for (const file of files) {
            if (!file.endsWith('.json')) continue;
            try {
                const s = await stat(join(CONVERSATIONS_DIR, file));
                storageBytes += s.size;
            } catch {
                /* skip */
            }
        }
    } catch {
        /* skip */
    }

    return {
        ...index.metrics,
        storageBytes
    };
}

async function cleanupOldConversations(): Promise<void> {
    try {
        const index = await loadIndex();
        if (index.conversations.length <= MAX_CONVERSATIONS) return;

        // Delete oldest conversations
        const toDelete = index.conversations.slice(MAX_CONVERSATIONS);
        for (const conv of toDelete) {
            try {
                await unlink(getConversationPath(conv.id));
                logger.info({ conversationId: conv.id }, 'Cleaned up old conversation');
            } catch {
                /* skip */
            }
        }

        // Update index
        index.conversations = index.conversations.slice(0, MAX_CONVERSATIONS);
        index.lastCleanup = new Date().toISOString();
        await saveIndex(index);
    } catch (err) {
        logger.error({ err }, 'Conversation cleanup failed');
    }
}

// Export token estimation helper
export function estimateTokens(text: string): number {
    // Rough estimate: ~4 characters per token for English
    return Math.ceil(text.length / 4);
}

// Conversation context compression (for long conversations)
export async function compressConversation(conversationId: string): Promise<boolean> {
    const conversation = await getConversation(conversationId);
    if (!conversation || conversation.messages.length < 20) return false;

    // Keep system message and last 10 messages, summarize the rest
    const systemMsg = conversation.messages.find(m => m.role === 'system');
    const recentMsgs = conversation.messages.filter(m => m.role !== 'system').slice(-10);
    const oldMsgs = conversation.messages.filter(m => m.role !== 'system').slice(0, -10);

    if (oldMsgs.length < 5) return false;

    // Create summary message
    const summary = `[Previous ${oldMsgs.length} messages summarized]`;
    const summaryMsg: ConversationMessage = {
        role: 'assistant',
        content: summary,
        timestamp: new Date().toISOString()
    };

    conversation.messages = systemMsg
        ? [systemMsg, summaryMsg, ...recentMsgs]
        : [summaryMsg, ...recentMsgs];

    await saveConversation(conversation);
    logger.info({ conversationId, compressedMessages: oldMsgs.length }, 'Compressed conversation');
    return true;
}
