import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Fastify from 'fastify';
import { remoteRoutes } from '../src/routes/remote';
import * as child_process from 'child_process';
import * as fs from 'fs';

// Mock child_process
vi.mock('child_process', () => ({
    spawn: vi.fn(),
}));

// Mock fs to avoid temp file IO issues
vi.mock('fs', async (importOriginal) => {
    const actual = await importOriginal<typeof fs>();
    return {
        ...actual,
        promises: {
            ...actual.promises,
            writeFile: vi.fn().mockResolvedValue(undefined),
            unlink: vi.fn().mockResolvedValue(undefined),
        },
        existsSync: vi.fn().mockReturnValue(true), // Pretend .env exists
    };
});

describe('Remote Deploy API', () => {
    let fastify: any;
    let spawnMock: any;

    beforeEach(async () => {
        spawnMock = vi.mocked(child_process.spawn);
        // Setup default spawn behavior to return success
        spawnMock.mockImplementation(() => {
            const listeners: Record<string, any> = {};
            return {
                stdout: { on: (event: string, cb: any) => { if (event === 'data') cb(Buffer.from('Success\n')); } },
                stderr: { on: (event: string, cb: any) => { } },
                on: (event: string, cb: any) => {
                    if (event === 'close') cb(0);
                    listeners[event] = cb;
                }
            };
        });

        fastify = Fastify();
        await fastify.register(remoteRoutes);
    });

    afterEach(() => {
        vi.clearAllMocks();
        fastify.close();
    });

    it('should reject requests without credentials', async () => {
        const response = await fastify.inject({
            method: 'POST',
            url: '/api/remote-deploy',
            payload: {
                host: '1.2.3.4',
                username: 'root'
            }
        });
        expect(response.statusCode).toBe(400);
        expect(JSON.parse(response.payload).error).toContain('Private key is required');
    });

    it('should execute deployment steps successfully', async () => {
        const response = await fastify.inject({
            method: 'POST',
            url: '/api/remote-deploy',
            payload: {
                host: '1.2.3.4',
                username: 'root',
                privateKey: '-----BEGIN RSA PRIVATE KEY-----...'
            }
        });

        expect(response.statusCode).toBe(200);
        const body = JSON.parse(response.payload);
        expect(body.success).toBe(true);
        expect(spawnMock).toHaveBeenCalled();

        // Verify SSH calls were made
        const calls = spawnMock.mock.calls;
        // Arguments to spawn are [command, args]
        // We expect calls to 'ssh' (mkdir, echo, docker checks, start) and 'scp' (upload)
        const sshCalls = calls.filter((c: any) => c[0] === 'ssh');
        const scpCalls = calls.filter((c: any) => c[0] === 'scp');

        expect(sshCalls.length).toBeGreaterThan(0);
        expect(scpCalls.length).toBeGreaterThan(0);
    });

    it('should support password authentication (sshpass)', async () => {
        const response = await fastify.inject({
            method: 'POST',
            url: '/api/remote-deploy',
            payload: {
                host: '1.2.3.4',
                username: 'root',
                authType: 'password',
                password: 'secret'
            }
        });

        expect(response.statusCode).toBe(200);
        const body = JSON.parse(response.payload);
        expect(body.success).toBe(true);

        const calls = spawnMock.mock.calls;
        const sshpassCalls = calls.filter((c: any) => c[0] === 'sshpass');
        expect(sshpassCalls.length).toBeGreaterThan(0);
    });

    it('should handle SSH errors', async () => {
        // Mock failure on specific command
        spawnMock.mockImplementation((cmd: string, args: string[]) => {
            return {
                stdout: { on: () => { } },
                stderr: { on: (event: string, cb: any) => { if (event === 'data') cb(Buffer.from('Connection refused')); } },
                on: (event: string, cb: any) => {
                    if (event === 'close') cb(255); // Error code
                }
            };
        });

        const response = await fastify.inject({
            method: 'POST',
            url: '/api/remote-deploy',
            payload: {
                host: '1.2.3.4',
                username: 'root',
                privateKey: 'key'
            }
        });

        expect(response.statusCode).toBe(500);
        const body = JSON.parse(response.payload);
        expect(body.success).toBe(false);
    });
});
