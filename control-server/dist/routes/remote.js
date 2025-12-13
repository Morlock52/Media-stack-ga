import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import os from 'os';
import { PROJECT_ROOT } from '../utils/env.js';
const COMPOSE_FILE = path.join(PROJECT_ROOT, 'docker-compose.yml');
// Basic guard to prevent remote-command injection via deployPath
const sanitizeRemotePath = (input) => {
    const fallbackPath = '~/media-stack';
    const candidate = typeof input === 'string' && input.trim().length ? input.trim() : fallbackPath;
    if (!/^[-@./A-Za-z0-9_~]+$/.test(candidate)) {
        throw new Error('Invalid deploy path. Use only letters, numbers, dashes, dots, slashes, underscores, and ~');
    }
    return candidate;
};
async function withTempKey(privateKey, callback) {
    const tmpDir = os.tmpdir();
    const keyPath = path.join(tmpDir, `ssh-key-${Date.now()}-${Math.random().toString(36).substring(7)}`);
    // Ensure key ends with newline to be valid
    const formattedKey = privateKey.endsWith('\n') ? privateKey : `${privateKey}\n`;
    await fs.promises.writeFile(keyPath, formattedKey, { mode: 0o600 });
    try {
        return await callback(keyPath);
    }
    finally {
        try {
            await fs.promises.unlink(keyPath);
        }
        catch (_e) {
            // Ignore cleanup errors
        }
    }
}
function runCommand(command, args) {
    return new Promise((resolve) => {
        const proc = spawn(command, args);
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
async function execSSH(config, command) {
    return withTempKey(config.privateKey, async (keyPath) => {
        const args = [
            '-i', keyPath,
            '-p', config.port.toString(),
            '-o', 'StrictHostKeyChecking=no',
            '-o', 'UserKnownHostsFile=/dev/null',
            `${config.username}@${config.host}`,
            command
        ];
        return runCommand('ssh', args);
    });
}
async function scpFile(config, localPath, remotePath) {
    return withTempKey(config.privateKey, async (keyPath) => {
        const args = [
            '-i', keyPath,
            '-P', config.port.toString(), // SCP uses -P for port
            '-o', 'StrictHostKeyChecking=no',
            '-o', 'UserKnownHostsFile=/dev/null',
            localPath,
            `${config.username}@${config.host}:${remotePath}`
        ];
        return runCommand('scp', args);
    });
}
export async function remoteRoutes(fastify) {
    fastify.post('/api/remote-deploy', async (request, reply) => {
        const { host, port = 22, username, privateKey, deployPath = '~/media-stack' } = request.body;
        if (!host || !username) {
            return reply.status(400).send({ error: 'Host and username are required' });
        }
        if (!privateKey) {
            return reply.status(400).send({ error: 'Private key is required' });
        }
        let safeDeployPath;
        try {
            safeDeployPath = sanitizeRemotePath(deployPath);
        }
        catch (error) {
            return reply.status(400).send({ error: error.message });
        }
        const sshConfig = {
            host,
            port: typeof port === 'string' ? parseInt(port) : port,
            username,
            privateKey
        };
        const steps = [];
        try {
            // Step 1: Connect (Check Echo)
            steps.push({ step: 'Connecting to server...', status: 'running' });
            const homeResult = await execSSH(sshConfig, 'echo $HOME');
            if (homeResult.code !== 0) {
                throw new Error(`Connection failed: ${homeResult.stderr}`);
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
            if (mkdirResult.code !== 0)
                throw new Error(`Mkdir failed: ${mkdirResult.stderr}`);
            steps[steps.length - 1].status = 'done';
            // Step 3: Upload docker-compose.yml
            steps.push({ step: 'Uploading docker-compose.yml...', status: 'running' });
            const uploadCompose = await scpFile(sshConfig, COMPOSE_FILE, `${remoteDeployPath}/docker-compose.yml`);
            if (uploadCompose.code !== 0)
                throw new Error(`Upload failed: ${uploadCompose.stderr}`);
            steps[steps.length - 1].status = 'done';
            // Step 4: Upload .env if exists
            const envFile = path.join(PROJECT_ROOT, '.env');
            if (fs.existsSync(envFile)) {
                steps.push({ step: 'Uploading .env...', status: 'running' });
                const uploadEnv = await scpFile(sshConfig, envFile, `${remoteDeployPath}/.env`);
                if (uploadEnv.code !== 0)
                    throw new Error(`Env upload failed: ${uploadEnv.stderr}`);
                steps[steps.length - 1].status = 'done';
            }
            // Step 5: Check Docker is installed
            steps.push({ step: 'Checking Docker installation...', status: 'running' });
            const dockerCheck = await execSSH(sshConfig, 'docker --version');
            if (dockerCheck.code !== 0) {
                throw new Error('Docker is not installed on the remote server');
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
            const composeV2Check = await execSSH(sshConfig, 'docker compose version');
            const useComposeV2 = composeV2Check.code === 0;
            const composeCommand = useComposeV2 ? 'docker compose' : 'docker-compose';
            // Step 6: Start the stack
            steps.push({ step: 'Starting media stack...', status: 'running' });
            const startResult = await execSSH(sshConfig, `cd ${remoteDeployPath} && ${composeCommand} -f docker-compose.yml up -d`);
            if (startResult.code !== 0 && startResult.stderr && !startResult.stderr.includes('Warning')) {
                throw new Error(startResult.stderr);
            }
            steps[steps.length - 1].status = 'done';
            return {
                success: true,
                message: 'Deployment successful!',
                steps,
                serverInfo: { host, deployPath: remoteDeployPath }
            };
        }
        catch (error) {
            if (steps.length > 0) {
                steps[steps.length - 1].status = 'error';
            }
            fastify.log.error({ err: error, host, username }, '[remote-deploy] failed');
            return reply.status(500).send({
                success: false,
                error: error.message,
                steps
            });
        }
    });
    // Test SSH connection
    fastify.post('/api/remote-deploy/test', async (request, reply) => {
        const { host, port = 22, username, privateKey } = request.body;
        if (!privateKey) {
            return reply.status(400).send({ error: 'Private key is required' });
        }
        const sshConfig = {
            host,
            port: typeof port === 'string' ? parseInt(port) : port,
            username,
            privateKey
        };
        try {
            // Quick checks
            const dockerCheck = await execSSH(sshConfig, 'docker --version');
            const composeV2Check = await execSSH(sshConfig, 'docker compose version');
            const composeV1Check = composeV2Check.code === 0 ? { code: 0 } : await execSSH(sshConfig, 'docker-compose --version');
            return {
                success: true,
                docker: dockerCheck.code === 0,
                dockerCompose: composeV2Check.code === 0 || composeV1Check.code === 0,
                message: dockerCheck.code === 0 ? 'Ready to deploy!' : 'Docker not found on server'
            };
        }
        catch (error) {
            fastify.log.error({ err: error, host, username }, '[remote-deploy/test] failed');
            return reply.status(500).send({
                success: false,
                error: error.message
            });
        }
    });
}
