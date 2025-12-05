import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// Assuming we are in /src/utils, project root is ../..
// Allow overriding via environment variable (useful for Docker)
export const PROJECT_ROOT = process.env.PROJECT_ROOT || path.resolve(__dirname, '../../');
export const ENV_FILE_PATH = path.join(PROJECT_ROOT, '.env');
export const readEnvFile = () => {
    if (!fs.existsSync(ENV_FILE_PATH))
        return '';
    return fs.readFileSync(ENV_FILE_PATH, 'utf-8');
};
export const writeEnvFile = (content) => {
    fs.writeFileSync(ENV_FILE_PATH, content.replace(/\r\n/g, '\n'));
};
export const setEnvValue = (key, value) => {
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
    if (!updated)
        newLines.push(`${key}=${trimmed}`);
    writeEnvFile(newLines.join('\n') + '\n');
};
export const removeEnvKey = (key) => {
    if (!fs.existsSync(ENV_FILE_PATH))
        return;
    const lines = readEnvFile()
        .split(/\n/)
        .filter((line) => line.length > 0 && !line.startsWith(`${key}=`));
    writeEnvFile(lines.join('\n') + (lines.length ? '\n' : ''));
};
