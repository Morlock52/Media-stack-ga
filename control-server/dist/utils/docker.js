import { spawn } from 'child_process';
import { PROJECT_ROOT } from './env.js';
import pino from 'pino';
const logger = pino({
    level: process.env.LOG_LEVEL || 'info',
    transport: {
        target: 'pino-pretty',
        options: {
            colorize: true
        }
    }
});
export const runCommand = (command, args, cwd = PROJECT_ROOT) => {
    return new Promise((resolve, reject) => {
        logger.info({ command, args, cwd }, 'executing shell command');
        const process = spawn(command, args, { cwd });
        let stdout = '';
        let stderr = '';
        process.stdout.on('data', (data) => {
            stdout += data.toString();
        });
        process.stderr.on('data', (data) => {
            stderr += data.toString();
        });
        process.on('close', (code) => {
            if (code === 0) {
                resolve(stdout.trim());
            }
            else {
                logger.error({ command, args, code, stderr }, 'command failed');
                reject(new Error(stderr || stdout));
            }
        });
    });
};
