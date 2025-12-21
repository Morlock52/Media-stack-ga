import { FastifyInstance } from 'fastify';
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import os from 'os';
import { PROJECT_ROOT } from '../utils/env.js';
import { RemoteDeployRequest } from '../types/index.js';

const COMPOSE_FILE = path.join(PROJECT_ROOT, 'docker-compose.yml');

// Basic guard to prevent remote-command injection via deployPath
const sanitizeRemotePath = (input: any) => {
    const fallbackPath = '~/media-stack';
    const candidate = typeof input === 'string' && input.trim().length ? input.trim() : fallbackPath;
    if (!/^[-@./A-Za-z0-9_~]+$/.test(candidate)) {
        throw new Error('Invalid deploy path. Use only letters, numbers, dashes, dots, slashes, underscores, and ~');
    }
    return candidate;
};

interface SSHConfig {
    host: string;
    port: number;
    username: string;
    authType: 'key' | 'password';
    privateKey?: string;
    password?: string;
}

interface ExecResult {
    code: number;
    stdout: string;
    stderr: string;
}

const cleanRemoteOutput = (value: string) => {
    const lines = (value || '').replace(/\r\n/g, '\n').split('\n');
    return lines
        .filter((line) => {
            const trimmed = line.trim();
            if (!trimmed) return false;
            if (/^Warning: Permanently added .* to the list of known hosts\.?$/i.test(trimmed)) return false;
            if (/^time=".*"\s+level=warning\s+msg="The \".*\" variable is not set\.? Defaulting to a blank string\.?"$/i.test(trimmed)) return false;
            if (/^The \".*\" variable is not set\.? Defaulting to a blank string\.?$/i.test(trimmed)) return false;
            return true;
        })
        .join('\n')
        .trim();
};

const sshCommonOptions = [
    '-o', 'StrictHostKeyChecking=no',
    '-o', 'UserKnownHostsFile=/dev/null',
    '-o', 'ConnectTimeout=12',
    '-o', 'ConnectionAttempts=1',
    '-o', 'ServerAliveInterval=15',
    '-o', 'ServerAliveCountMax=2',
];

const isMissingBinaryError = (stderr: string) =>
    /ENOENT/i.test(stderr) || /not found/i.test(stderr) || /spawn\s+\w+\s+ENOENT/i.test(stderr);

const isDockerPermissionError = (value: string) =>
    /permission denied/i.test(value) && (/docker\.sock/i.test(value) || /connect to the docker daemon/i.test(value));

const isDockerDaemonUnavailableError = (value: string) =>
    /cannot connect to the docker daemon/i.test(value) || /is the docker daemon running\?/i.test(value);

const isCommandNotFound = (value: string) =>
    /command not found/i.test(value) || /not found/i.test(value);

async function withTempKey<T>(privateKey: string, callback: (keyPath: string) => Promise<T>): Promise<T> {
    const tmpDir = os.tmpdir();
    const keyPath = path.join(tmpDir, `ssh-key-${Date.now()}-${Math.random().toString(36).substring(7)}`);

    // Ensure key ends with newline to be valid
    const formattedKey = privateKey.endsWith('\n') ? privateKey : `${privateKey}\n`;

    await fs.promises.writeFile(keyPath, formattedKey, { mode: 0o600 });
    try {
        return await callback(keyPath);
    } finally {
        try {
            await fs.promises.unlink(keyPath);
        } catch {
            // Ignore cleanup errors
        }
    }
}

function runCommand(command: string, args: string[], env?: Record<string, string>): Promise<ExecResult> {
    return new Promise((resolve) => {
        const proc = spawn(command, args, env ? { env: { ...process.env, ...env } } : undefined);
        let stdout = '';
        let stderr = '';

        proc.stdout.on('data', (data) => { stdout += data.toString(); });
        proc.stderr.on('data', (data) => { stderr += data.toString(); });

        proc.on('close', (code) => {
            resolve({ code: code ?? 1, stdout, stderr });
        });

        proc.on('error', (err) => {
            resolve({ code: 1, stdout, stderr: err.message });
        });
    });
}

async function execSSH(config: SSHConfig, command: string): Promise<ExecResult> {
    if (config.authType === 'password') {
        if (!config.password) {
            return { code: 1, stdout: '', stderr: 'Password is required for password authentication' };
        }
        const args = [
            '-e',
            'ssh',
            '-p', config.port.toString(),
            '-o', 'PreferredAuthentications=password',
            '-o', 'PubkeyAuthentication=no',
            ...sshCommonOptions,
            `${config.username}@${config.host}`,
            command
        ];
        const result = await runCommand('sshpass', args, { SSHPASS: config.password });
        // Provide helpful error if sshpass is not installed
        if (result.code !== 0 && isMissingBinaryError(result.stderr)) {
            return {
                code: 1,
                stdout: '',
                stderr: 'sshpass is not installed. Install it with: apt-get install sshpass (Ubuntu/Debian) or brew install sshpass (macOS)'
            };
        }
        return { ...result, stderr: cleanRemoteOutput(result.stderr) };
    }

    if (!config.privateKey) {
        return { code: 1, stdout: '', stderr: 'Private key is required for key authentication' };
    }

    return withTempKey(config.privateKey, async (keyPath) => {
        const args = [
            '-i', keyPath,
            '-p', config.port.toString(),
            ...sshCommonOptions,
            `${config.username}@${config.host}`,
            command
        ];
        const result = await runCommand('ssh', args);
        if (result.code !== 0 && isMissingBinaryError(result.stderr)) {
            return {
                code: 1,
                stdout: '',
                stderr: 'ssh is not installed in the control server environment. Install OpenSSH client (e.g. apt-get install openssh-client, apk add openssh-client, or brew install openssh).'
            };
        }
        return { ...result, stderr: cleanRemoteOutput(result.stderr) };
    });
}

async function scpFile(config: SSHConfig, localPath: string, remotePath: string): Promise<ExecResult> {
    if (config.authType === 'password') {
        if (!config.password) {
            return { code: 1, stdout: '', stderr: 'Password is required for password authentication' };
        }
        const args = [
            '-e',
            'scp',
            '-P', config.port.toString(), // SCP uses -P for port
            '-o', 'PreferredAuthentications=password',
            '-o', 'PubkeyAuthentication=no',
            ...sshCommonOptions,
            localPath,
            `${config.username}@${config.host}:${remotePath}`
        ];
        const result = await runCommand('sshpass', args, { SSHPASS: config.password });
        // Provide helpful error if sshpass is not installed
        if (result.code !== 0 && isMissingBinaryError(result.stderr)) {
            return {
                code: 1,
                stdout: '',
                stderr: 'sshpass is not installed. Install it with: apt-get install sshpass (Ubuntu/Debian) or brew install sshpass (macOS)'
            };
        }
        return { ...result, stderr: cleanRemoteOutput(result.stderr) };
    }

    if (!config.privateKey) {
        return { code: 1, stdout: '', stderr: 'Private key is required for key authentication' };
    }

    return withTempKey(config.privateKey, async (keyPath) => {
        const args = [
            '-i', keyPath,
            '-P', config.port.toString(), // SCP uses -P for port
            ...sshCommonOptions,
            localPath,
            `${config.username}@${config.host}:${remotePath}`
        ];
        const result = await runCommand('scp', args);
        if (result.code !== 0 && isMissingBinaryError(result.stderr)) {
            return {
                code: 1,
                stdout: '',
                stderr: 'scp is not installed in the control server environment. Install OpenSSH client (e.g. apt-get install openssh-client, apk add openssh-client, or brew install openssh).'
            };
        }
        return { ...result, stderr: cleanRemoteOutput(result.stderr) };
    });
}

export async function remoteRoutes(fastify: FastifyInstance) {
    fastify.post<{ Body: RemoteDeployRequest }>('/api/remote-deploy', async (request, reply) => {
        const { host, port = 22, username, privateKey, password, deployPath = '~/media-stack' } = request.body;
        const authType: 'key' | 'password' = request.body.authType || (password ? 'password' : 'key');

        if (!host || !username) {
            return reply.status(400).send({ error: 'Host and username are required' });
        }

        // Validate authentication credentials
        if (authType === 'key') {
            if (!privateKey) {
                return reply.status(400).send({ error: 'Private key is required for SSH key authentication' });
            }
        } else if (authType === 'password') {
            if (!password) {
                return reply.status(400).send({ error: 'Password is required for password authentication' });
            }
        } else {
            return reply.status(400).send({ error: 'Invalid authentication type. Must be "key" or "password"' });
        }

        let safeDeployPath;
        try {
            safeDeployPath = sanitizeRemotePath(deployPath);
        } catch (error: any) {
            return reply.status(400).send({ error: error.message });
        }

        const sshConfig: SSHConfig = {
            host,
            port: typeof port === 'string' ? parseInt(port) : port,
            username,
            authType,
            privateKey,
            password
        };

        const steps: { step: string, status: string }[] = [];
        let tmpDir: string | null = null;

        try {
            // Optional: accept generated compose/.env directly from the UI.
            const composeYmlBody = typeof request.body.composeYml === 'string' ? request.body.composeYml : '';
            const envFileBody = typeof request.body.envFile === 'string' ? request.body.envFile : '';

            let localComposeFile = COMPOSE_FILE;
            let localEnvFile: string | null = null;

            if (composeYmlBody.trim() || envFileBody.trim()) {
                tmpDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'mediastack-deploy-'));
                if (composeYmlBody.trim()) {
                    localComposeFile = path.join(tmpDir, 'docker-compose.yml');
                    await fs.promises.writeFile(localComposeFile, composeYmlBody, 'utf-8');
                }
                if (envFileBody.trim()) {
                    localEnvFile = path.join(tmpDir, '.env');
                    await fs.promises.writeFile(localEnvFile, envFileBody, 'utf-8');
                }
            }

            // Step 1: Connect (Check Echo)
            steps.push({ step: 'Connecting to server...', status: 'running' });

            const homeResult = await execSSH(sshConfig, 'echo $HOME');
            if (homeResult.code !== 0) {
                const detail = cleanRemoteOutput(homeResult.stderr || homeResult.stdout);
                throw new Error(`Connection failed: ${detail || 'unknown error'}`);
            }
            steps[steps.length - 1].status = 'done';

            const remoteHome = (homeResult.stdout || '').trim();
            const remoteDeployPath = safeDeployPath.startsWith('~/')
                ? `${remoteHome}/${safeDeployPath.slice(2)}`
                : safeDeployPath === '~'
                    ? remoteHome
                    : safeDeployPath;

            // Step 2: Create deploy directory
            steps.push({ step: 'Creating deploy directory...', status: 'running' });
            const mkdirResult = await execSSH(sshConfig, `mkdir -p ${remoteDeployPath}`);
            if (mkdirResult.code !== 0) {
                const detail = cleanRemoteOutput(mkdirResult.stderr || mkdirResult.stdout);
                throw new Error(`Mkdir failed: ${detail || 'unknown error'}`);
            }
            steps[steps.length - 1].status = 'done';

            // Step 3: Upload docker-compose.yml
            steps.push({ step: 'Uploading docker-compose.yml...', status: 'running' });
            const uploadCompose = await scpFile(sshConfig, localComposeFile, `${remoteDeployPath}/docker-compose.yml`);
            if (uploadCompose.code !== 0) {
                const detail = cleanRemoteOutput(uploadCompose.stderr || uploadCompose.stdout);
                throw new Error(`Upload failed: ${detail || 'unknown error'}`);
            }
            steps[steps.length - 1].status = 'done';

            // Step 4: Upload .env if provided or exists
            const envFile = localEnvFile || path.join(PROJECT_ROOT, '.env');
            if (fs.existsSync(envFile)) {
                steps.push({ step: 'Uploading .env...', status: 'running' });
                const uploadEnv = await scpFile(sshConfig, envFile, `${remoteDeployPath}/.env`);
                if (uploadEnv.code !== 0) {
                    const detail = cleanRemoteOutput(uploadEnv.stderr || uploadEnv.stdout);
                    throw new Error(`Env upload failed: ${detail || 'unknown error'}`);
                }
                steps[steps.length - 1].status = 'done';
            }

            // Step 5: Check Docker is installed
            steps.push({ step: 'Checking Docker installation...', status: 'running' });
            const dockerCheck = await execSSH(sshConfig, 'docker --version');
            if (dockerCheck.code !== 0) {
                throw new Error('Docker is not installed on the remote server');
            }
            steps[steps.length - 1].status = 'done';

            // Step 5.25: Check Docker daemon access
            steps.push({ step: 'Checking Docker daemon access...', status: 'running' });
            const dockerInfo = await execSSH(sshConfig, 'docker info');
            if (dockerInfo.code !== 0) {
                const detail = cleanRemoteOutput(dockerInfo.stderr || dockerInfo.stdout);
                if (isDockerPermissionError(detail)) {
                    throw new Error(
                        'Docker is installed, but your SSH user does not have permission to access the Docker daemon. ' +
                            'Fix on the remote host: add the user to the docker group (e.g. `sudo usermod -aG docker $USER` and re-login) ' +
                            'or run Docker commands via sudo/root.'
                    );
                }
                if (isDockerDaemonUnavailableError(detail)) {
                    throw new Error(
                        'Docker is installed, but the Docker daemon is not reachable. ' +
                            'Fix on the remote host: ensure the Docker service is running (e.g. `sudo systemctl start docker`).'
                    );
                }
                throw new Error(`Docker daemon check failed: ${detail || 'unknown error'}`);
            }
            steps[steps.length - 1].status = 'done';

            // Step 5.5: Verify compose file exists on remote
            steps.push({ step: 'Verifying docker-compose.yml on remote...', status: 'running' });
            const composeFileCheck = await execSSH(sshConfig, `cd ${remoteDeployPath} && test -f docker-compose.yml`);
            if (composeFileCheck.code !== 0) {
                throw new Error('docker-compose.yml not found on remote server after upload');
            }
            steps[steps.length - 1].status = 'done';

            // Determine compose command (Docker Compose v2 vs legacy docker-compose)
            steps.push({ step: 'Checking Docker Compose...', status: 'running' });
            const composeV2Check = await execSSH(sshConfig, 'docker compose version');
            const useComposeV2 = composeV2Check.code === 0;

            let composeCommand = 'docker compose';
            if (!useComposeV2) {
                const composeV1Check = await execSSH(sshConfig, 'docker-compose --version');
                if (composeV1Check.code !== 0) {
                    const detail = cleanRemoteOutput(
                        (composeV2Check.stderr || composeV2Check.stdout || '') +
                            '\n' +
                            (composeV1Check.stderr || composeV1Check.stdout || '')
                    );
                    if (isCommandNotFound(detail)) {
                        throw new Error(
                            'Docker Compose is not installed on the remote server. ' +
                                'Install Compose v2 (recommended) or docker-compose v1, then retry deploy.'
                        );
                    }
                    throw new Error(`Docker Compose check failed: ${detail || 'unknown error'}`);
                }
                composeCommand = 'docker-compose';
            }
            steps[steps.length - 1].status = 'done';

            // Step 6: Start the stack
            steps.push({ step: 'Starting media stack...', status: 'running' });
            const startResult = await execSSH(sshConfig, `cd ${remoteDeployPath} && ${composeCommand} up -d`);
            if (startResult.code !== 0) {
                const errorMsg = cleanRemoteOutput(startResult.stderr || startResult.stdout) || 'Docker compose command failed';
                throw new Error(errorMsg);
            }
            steps[steps.length - 1].status = 'done';

            return {
                success: true,
                message: 'Deployment successful!',
                steps,
                serverInfo: { host, deployPath: remoteDeployPath }
            };

        } catch (error: any) {
            if (steps.length > 0) {
                steps[steps.length - 1].status = 'error';
            }
            fastify.log.error({ err: error, host, username }, '[remote-deploy] failed');
            return reply.status(200).send({
                success: false,
                error: cleanRemoteOutput(error?.message || '') || 'Remote deployment failed',
                steps
            });
        } finally {
            if (tmpDir) {
                try {
                    await fs.promises.rm(tmpDir, { recursive: true, force: true });
                } catch {
                    // Best-effort cleanup
                }
            }
        }
    });

    // Test SSH connection
    fastify.post<{ Body: RemoteDeployRequest }>('/api/remote-deploy/test', async (request, reply) => {
        const { host, port = 22, username, privateKey, password } = request.body;
        const authType: 'key' | 'password' = request.body.authType || (password ? 'password' : 'key');

        if (!host || !username) {
            return reply.status(400).send({ error: 'Host and username are required' });
        }

        // Validate authentication credentials
        if (authType === 'key') {
            if (!privateKey) {
                return reply.status(400).send({ error: 'Private key is required for SSH key authentication' });
            }
        } else if (authType === 'password') {
            if (!password) {
                return reply.status(400).send({ error: 'Password is required for password authentication' });
            }
        } else {
            return reply.status(400).send({ error: 'Invalid authentication type. Must be "key" or "password"' });
        }

        const sshConfig: SSHConfig = {
            host,
            port: typeof port === 'string' ? parseInt(port) : port,
            username,
            authType,
            privateKey,
            password
        };

        try {
            const connectCheck = await execSSH(sshConfig, 'echo mediastack-ok && echo $HOME');
            if (connectCheck.code !== 0) {
                return reply.status(502).send({
                    success: false,
                    error: `SSH connection failed: ${cleanRemoteOutput(connectCheck.stderr || connectCheck.stdout) || 'unknown error'}`,
                });
            }

            const dockerVersion = await execSSH(sshConfig, 'docker --version');
            const dockerInstalled = dockerVersion.code === 0;

            let dockerDaemonOk = false;
            let dockerProblem = '';
            if (dockerInstalled) {
                const dockerInfo = await execSSH(sshConfig, 'docker info');
                dockerDaemonOk = dockerInfo.code === 0;
                if (!dockerDaemonOk) {
                    const detail = cleanRemoteOutput(dockerInfo.stderr || dockerInfo.stdout);
                    if (isDockerPermissionError(detail)) {
                        dockerProblem =
                            'Docker installed but permission denied to the Docker daemon. Add your user to the docker group and re-login, or use a user with Docker access.';
                    } else if (isDockerDaemonUnavailableError(detail)) {
                        dockerProblem = 'Docker installed but the Docker daemon is not running/reachable.';
                    } else {
                        dockerProblem = detail || 'Docker daemon not reachable.';
                    }
                }
            }

            const composeV2Check = await execSSH(sshConfig, 'docker compose version');
            const composeV1Check = composeV2Check.code === 0
                ? { code: 0, stdout: '', stderr: '' }
                : await execSSH(sshConfig, 'docker-compose --version');
            const dockerComposeOk = composeV2Check.code === 0 || composeV1Check.code === 0;

            const ready = dockerInstalled && dockerDaemonOk && dockerComposeOk;
            let message = 'Ready to deploy!';
            if (!dockerInstalled) message = 'Docker not found on server';
            else if (!dockerDaemonOk) message = dockerProblem || 'Docker daemon not accessible';
            else if (!dockerComposeOk) message = 'Docker Compose not found on server';

            return {
                success: true,
                ssh: true,
                docker: dockerDaemonOk,
                dockerCompose: dockerComposeOk,
                dockerInstalled,
                message
            };

        } catch (error: any) {
            fastify.log.error({ err: error, host, username }, '[remote-deploy/test] failed');
            return reply.status(500).send({
                success: false,
                error: error.message
            });
        }
    });
}
