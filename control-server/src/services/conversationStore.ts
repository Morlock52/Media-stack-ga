/**
 * Conversation History Persistence
 * Stores conversation history to disk with session management
 */

import { readFile, writeFile, mkdir, readdir, unlink } from 'fs/promises';
import { join } from 'path';
import { PROJECT_ROOT } from '../utils/env.js';
import pino from 'pino';

const logger = pino({
    level: process.env.LOG_LEVEL || 'info',
    transport: { target: 'pino-pretty', options: { colorize: true } }
});

const CONVERSATIONS_DIR = join(PROJECT_ROOT, 'data', 'conversations');
const MAX_CONVERSATIONS = 50;
const MAX_MESSAGES_PER_CONVERSATION = 100;

export interface ConversationMessage {
    role: 'system' | 'user' | 'assistant';
    content: string;
    timestamp: string;
    agent?: string;
}

export interface Conversation {
    id: string;
    createdAt: string;
    updatedAt: string;
    messages: ConversationMessage[];
    metadata?: { agent?: string; plan?: any; userAgent?: string; };
}

async function ensureDir(): Promise<void> {
    try { await mkdir(CONVERSATIONS_DIR, { recursive: true }); } catch { /* exists */ }
}

export function generateConversationId(): string {
    return `conv_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 8)}`;
}

function getConversationPath(id: string): string {
    return join(CONVERSATIONS_DIR, `${id.replace(/[^a-zA-Z0-9_-]/g, '')}.json`);
}

export async function createConversation(initialMessage?: ConversationMessage, metadata?: Conversation['metadata']): Promise<Conversation> {
    await ensureDir();
    const now = new Date().toISOString();
    const conversation: Conversation = { id: generateConversationId(), createdAt: now, updatedAt: now, messages: initialMessage ? [initialMessage] : [], metadata };
    await saveConversation(conversation);
    logger.info({ conversationId: conversation.id }, 'Created new conversation');
    await cleanupOldConversations();
    return conversation;
}

export async function getConversation(id: string): Promise<Conversation | null> {
    try {
          const data = await readFile(getConversationPath(id), 'utf-8');
          return JSON.parse(data) as Conversation;
    } catch { return null; }
}

export async function saveConversation(conversation: Conversation): Promise<void> {
    await ensureDir();
    conversation.updatedAt = new Date().toISOString();
    if (conversation.messages.length > MAX_MESSAGES_PER_CONVERSATION) {
          const systemMsg = conversation.messages.find(m => m.role === 'system');
          const otherMsgs = conversation.messages.filter(m => m.role !== 'system').slice(-MAX_MESSAGES_PER_CONVERSATION + 1);
          conversation.messages = systemMsg ? [systemMsg, ...otherMsgs] : otherMsgs;
    }
    await writeFile(getConversationPath(conversation.id), JSON.stringify(conversation, null, 2));
}

export async function addMessage(conversationId: string, message: Omit<ConversationMessage, 'timestamp'>): Promise<Conversation | null> {
    const conversation = await getConversation(conversationId);
    if (!conversation) return null;
    conversation.messages.push({ ...message, timestamp: new Date().toISOString() });
    await saveConversation(conversation);
    return conversation;
}

export async function deleteConversation(id: string): Promise<boolean> {
    try { await unlink(getConversationPath(id)); logger.info({ conversationId: id }, 'Deleted conversation'); return true; } catch { return false; }
}

export async function listConversations(limit = 20): Promise<Array<{ id: string; createdAt: string; updatedAt: string; messageCount: number; preview: string; }>> {
    await ensureDir();
    try {
          const files = await readdir(CONVERSATIONS_DIR);
          const conversations: Conversation[] = [];
          for (const file of files) {
                  if (!file.endsWith('.json')) continue;
                  try { conversations.push(JSON.parse(await readFile(join(CONVERSATIONS_DIR, file), 'utf-8'))); } catch { /* skip */ }
          }
          conversations.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
          return conversations.slice(0, limit).map(c => ({
                  id: c.id, createdAt: c.createdAt, updatedAt: c.updatedAt, messageCount: c.messages.length,
                  preview: c.messages.filter(m => m.role === 'user').pop()?.content.substring(0, 100) || 'Empty'
          }));
    } catch { return []; }
}

export async function getRecentMessages(conversationId: string, count = 10): Promise<ConversationMessage[]> {
    const conversation = await getConversation(conversationId);
    if (!conversation) return [];
    const systemMsg = conversation.messages.find(m => m.role === 'system');
    const recent = conversation.messages.filter(m => m.role !== 'system').slice(-count);
    return systemMsg ? [systemMsg, ...recent] : recent;
}

async function cleanupOldConversations(): Promise<void> {
    try {
          const files = await readdir(CONVERSATIONS_DIR);
          if (files.length <= MAX_CONVERSATIONS) return;
          const stats: Array<{ file: string; mtime: number }> = [];
          for (const file of files) {
                  if (!file.endsWith('.json')) continue;
                  try {
                            const conv = JSON.parse(await readFile(join(CONVERSATIONS_DIR, file), 'utf-8')) as Conversation;
                            stats.push({ file, mtime: new Date(conv.updatedAt).getTime() });
                  } catch { stats.push({ file, mtime: 0 }); }
          }
          stats.sort((a, b) => a.mtime - b.mtime);
          for (const { file } of stats.slice(0, files.length - MAX_CONVERSATIONS)) {
                  try { await unlink(join(CONVERSATIONS_DIR, file)); logger.info({ file }, 'Cleaned up old conversation'); } catch { /* skip */ }
          }
    } catch (err) { logger.error({ err }, 'Conversation cleanup failed'); }
}
