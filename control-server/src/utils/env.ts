import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getErrorMessage } from './errors.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Assuming we are in /control-server/src/utils, monorepo root is ../../..
// Allow overriding via environment variable (useful for Docker)
export const PROJECT_ROOT = process.env.PROJECT_ROOT || path.resolve(__dirname, '../../../');
export const ENV_FILE_PATH = path.join(PROJECT_ROOT, '.env');

export const readEnvFile = (): string => {
    if (!fs.existsSync(ENV_FILE_PATH)) return '';
    try {
        return fs.readFileSync(ENV_FILE_PATH, 'utf-8');
    } catch (error: unknown) {
        throw new Error(`Failed to read .env at ${ENV_FILE_PATH}: ${getErrorMessage(error)}`);
    }
};

export const writeEnvFile = (content: string): void => {
    try {
        fs.writeFileSync(ENV_FILE_PATH, content.replace(/\r\n/g, '\n'));
    } catch (error: unknown) {
        throw new Error(`Failed to write .env at ${ENV_FILE_PATH}: ${getErrorMessage(error)}`);
    }
};

export const setEnvValue = (key: string, value: string): void => {
    const trimmed = value.trim();
    const lines = readEnvFile().split(/\n/).filter((line) => line.length > 0);
    let updated = false;
    const newLines = lines.map((line) => {
        if (line.startsWith(`${key}=`)) {
            updated = true;
            return `${key}=${trimmed}`;
        }
        return line;
    });
    if (!updated) newLines.push(`${key}=${trimmed}`);
    writeEnvFile(newLines.join('\n') + '\n');
};

export const removeEnvKey = (key: string): void => {
    if (!fs.existsSync(ENV_FILE_PATH)) return;
    const lines = readEnvFile()
        .split(/\n/)
        .filter((line) => line.length > 0 && !line.startsWith(`${key}=`));
    writeEnvFile(lines.join('\n') + (lines.length ? '\n' : ''));
};

// ═══════════════════════════════════════════════════════════════════════════
// API Key Getters - Centralized functions to get API keys from env or .env file
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Get a value from environment variable or .env file
 * Checks process.env first, then falls back to parsing .env file
 */
export const getEnvValue = (key: string): string | null => {
    // Check process.env first (runtime override)
    if (process.env[key]) return process.env[key]!;
    // Fall back to .env file
    const envContent = readEnvFile();
    const match = envContent.match(new RegExp(`^${key}=(.+)$`, 'm'));
    return match ? match[1].trim() : null;
};

/** Get OpenAI API key from env or .env file */
export const getOpenAIKey = (): string | null => getEnvValue('OPENAI_API_KEY');
