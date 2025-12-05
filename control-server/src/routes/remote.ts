import { FastifyInstance } from 'fastify';
import { NodeSSH } from 'node-ssh';
import fs from 'fs';
import path from 'path';
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

export async function remoteRoutes(fastify: FastifyInstance) {
    fastify.post<{ Body: RemoteDeployRequest }>('/api/remote-deploy', async (request, reply) => {
        const { host, port = 22, username, authType, password, privateKey, deployPath = '~/media-stack' } = request.body;

        if (!host || !username) {
            return reply.status(400).send({ error: 'Host and username are required' });
        }

        let safeDeployPath;
        try {
            safeDeployPath = sanitizeRemotePath(deployPath);
        } catch (error: any) {
            return reply.status(400).send({ error: error.message });
        }

        const ssh = new NodeSSH();
        const steps: { step: string, status: string }[] = [];

        try {
            // Step 1: Connect
            steps.push({ step: 'Connecting to server...', status: 'running' });

            const connectConfig: any = {
                host,
                port: typeof port === 'string' ? parseInt(port) : port,
                username,
            };

            if (authType === 'password') {
                connectConfig.password = password;
            } else {
                connectConfig.privateKey = privateKey;
            }

            await ssh.connect(connectConfig);
            steps[steps.length - 1].status = 'done';

            // Step 2: Create deploy directory
            steps.push({ step: 'Creating deploy directory...', status: 'running' });
            await ssh.execCommand(`mkdir -p ${safeDeployPath}`);
            steps[steps.length - 1].status = 'done';

            // Step 3: Upload docker-compose.yml
            steps.push({ step: 'Uploading docker-compose.yml...', status: 'running' });
            await ssh.putFile(COMPOSE_FILE, `${safeDeployPath}/docker-compose.yml`);
            steps[steps.length - 1].status = 'done';

            // Step 4: Upload .env if exists
            const envFile = path.join(PROJECT_ROOT, '.env');
            if (fs.existsSync(envFile)) {
                steps.push({ step: 'Uploading .env...', status: 'running' });
                await ssh.putFile(envFile, `${safeDeployPath}/.env`);
                steps[steps.length - 1].status = 'done';
            }

            // Step 5: Check Docker is installed
            steps.push({ step: 'Checking Docker installation...', status: 'running' });
            const dockerCheck = await ssh.execCommand('docker --version');
            if (dockerCheck.code !== 0) {
                throw new Error('Docker is not installed on the remote server');
            }
            steps[steps.length - 1].status = 'done';

            // Step 6: Start the stack
            steps.push({ step: 'Starting media stack...', status: 'running' });
            const startResult = await ssh.execCommand(`cd ${safeDeployPath} && docker compose up -d`);
            if (startResult.code !== 0 && startResult.stderr && !startResult.stderr.includes('Warning')) {
                throw new Error(startResult.stderr);
            }
            steps[steps.length - 1].status = 'done';

            ssh.dispose();

            return {
                success: true,
                message: 'Deployment successful!',
                steps,
                serverInfo: { host, deployPath: safeDeployPath }
            };

        } catch (error: any) {
            ssh.dispose();
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

    // Test SSH connection (doesn't deploy, just validates credentials)
    fastify.post<{ Body: RemoteDeployRequest }>('/api/remote-deploy/test', async (request, reply) => {
        const { host, port = 22, username, authType, password, privateKey } = request.body;

        const ssh = new NodeSSH();

        try {
            const connectConfig: any = {
                host,
                port: typeof port === 'string' ? parseInt(port) : port,
                username,
            };

            if (authType === 'password') {
                connectConfig.password = password;
            } else {
                connectConfig.privateKey = privateKey;
            }

            await ssh.connect(connectConfig);

            // Quick checks
            const dockerCheck = await ssh.execCommand('docker --version');
            const composeCheck = await ssh.execCommand('docker compose version');

            ssh.dispose();

            return {
                success: true,
                docker: dockerCheck.code === 0,
                dockerCompose: composeCheck.code === 0,
                message: dockerCheck.code === 0 ? 'Ready to deploy!' : 'Docker not found on server'
            };

        } catch (error: any) {
            ssh.dispose();
            fastify.log.error({ err: error, host, username }, '[remote-deploy/test] failed');
            return reply.status(500).send({
                success: false,
                error: error.message
            });
        }
    });
}
