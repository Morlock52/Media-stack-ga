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

type RunCommandOptions = {
    cwd?: string;
    env?: Record<string, string>;
    timeoutMs?: number;
    label?: string;
};

const maxParallel = Math.max(1, parseInt(process.env.DOCKER_STATUS_MAX_PARALLEL || '4', 10) || 4);
let inFlight = 0;
const queue: Array<() => void> = [];

const acquire = () =>
    new Promise<void>((resolve) => {
        if (inFlight < maxParallel) {
            inFlight += 1;
            return resolve();
        }
        queue.push(() => {
            inFlight += 1;
            resolve();
        });
    });

const release = () => {
    inFlight = Math.max(0, inFlight - 1);
    const next = queue.shift();
    if (next) next();
};

const friendlyDockerError = (command: string, err: any) => {
    const raw = err?.message ?? err;
    const msg = String(raw || '').toLowerCase();
    if (msg.includes('enoent') || msg.includes('not found')) {
        return `Required CLI "${command}" is not available. Install Docker Desktop/Engine or ensure "${command}" is on PATH.`;
    }
    if (msg.includes('cannot connect to the docker daemon')) {
        return 'Docker daemon is not running. Start Docker Desktop/Engine and retry.';
    }
    if (msg.includes('timed out')) {
        return `${command} timed out. Docker may be hung; verify the daemon is healthy.`;
    }
    if (typeof raw === 'string' && raw.trim()) {
        return raw.trim();
    }
    return err?.message || `Failed to run ${command}`;
};

export const runCommand = (command: string, args: string[], options: RunCommandOptions = {}): Promise<string> => {
    const cwd = options.cwd || PROJECT_ROOT;
    const timeoutMs = Math.max(0, options.timeoutMs ?? 15_000); // default 15s guardrail
    const label = options.label || command;

    return new Promise((resolve, reject) => {
        const start = async () => {
            await acquire();
            logger.info({ command, args, cwd, timeoutMs, label }, 'executing shell command');

            const child = spawn(command, args, {
                cwd,
                env: options.env ? { ...process.env, ...options.env } : process.env,
            });
            let stdout = '';
            let stderr = '';
            let timedOut = false;

            child.stdout.on('data', (data) => {
                stdout += data.toString();
            });

            child.stderr.on('data', (data) => {
                stderr += data.toString();
            });

            child.on('error', (err) => {
                const message = friendlyDockerError(command, err);
                logger.error({ command, args, err }, 'command failed to start');
                reject(new Error(message));
            });

            let timer: NodeJS.Timeout | null = null;
            if (timeoutMs > 0) {
                timer = setTimeout(() => {
                    timedOut = true;
                    try {
                        child.kill('SIGKILL');
                    } catch {
                        // ignore
                    }
                }, timeoutMs);
            }

            child.on('close', (code) => {
                if (timer) clearTimeout(timer);
                release();

                if (timedOut) {
                    const message = friendlyDockerError(command, new Error('timed out'));
                    logger.error({ command, args, code, stderr: stderr || stdout }, 'command timed out');
                    return reject(new Error(message));
                }

                if (code === 0) {
                    resolve(stdout.trim());
                } else {
                    const message = friendlyDockerError(command, stderr || stdout || `exit code ${code}`);
                    logger.error({ command, args, code, stderr }, 'command failed');
                    reject(new Error(message));
                }
            });

            child.on('exit', () => {
                if (timer) clearTimeout(timer);
                release();
            });
        };

        start().catch((err) => {
            release();
            reject(err as Error);
        });
    });
};
