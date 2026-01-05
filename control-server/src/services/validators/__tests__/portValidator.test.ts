import { describe, it, expect, vi, beforeEach } from 'vitest';
import { validatePorts } from '../portValidator.js';
import * as child_process from 'child_process';
import * as dockerUtils from '../../../utils/docker.js';

// Mock child_process
vi.mock('child_process', () => ({
    exec: vi.fn()
}));

// Mock docker utils
vi.mock('../../../utils/docker.js', () => ({
    runCommand: vi.fn()
}));

describe('portValidator', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('validatePorts', () => {
        it('should pass validation when no ports are in use', async () => {
            // Mock docker ps to return no conflicting containers
            vi.mocked(dockerUtils.runCommand).mockResolvedValue('');

            // Mock exec to indicate ports are not in use
            vi.mocked(child_process.exec).mockImplementation((cmd, callback: any) => {
                callback(null, { stdout: '', stderr: '' });
                return {} as any;
            });

            const result = await validatePorts({
                ports: [8080, 9090],
                servicePortMap: {
                    service1: [8080],
                    service2: [9090]
                }
            });

            expect(result.validator).toBe('port');
            expect(result.passed).toBe(true);
            expect(result.issues).toHaveLength(0);
        });

        it('should detect port conflicts between services', async () => {
            // Mock docker ps to return no conflicting containers
            vi.mocked(dockerUtils.runCommand).mockResolvedValue('');

            // Mock exec to indicate ports are not in use
            vi.mocked(child_process.exec).mockImplementation((cmd, callback: any) => {
                callback(null, { stdout: '', stderr: '' });
                return {} as any;
            });

            const result = await validatePorts({
                ports: [8080, 8080], // Duplicate ports
                servicePortMap: {
                    service1: [8080],
                    service2: [8080]
                }
            });

            expect(result.passed).toBe(false);
            expect(result.issues.some(i => i.code === 'PORT_CONFLICT_BETWEEN_SERVICES')).toBe(true);
            const conflictIssue = result.issues.find(i => i.code === 'PORT_CONFLICT_BETWEEN_SERVICES');
            expect(conflictIssue?.severity).toBe('error');
            expect(conflictIssue?.details?.port).toBe(8080);
        });

        it('should allow qbittorrent and gluetun to share ports', async () => {
            // Mock docker ps to return no conflicting containers
            vi.mocked(dockerUtils.runCommand).mockResolvedValue('');

            // Mock exec to indicate ports are not in use
            vi.mocked(child_process.exec).mockImplementation((cmd, callback: any) => {
                callback(null, { stdout: '', stderr: '' });
                return {} as any;
            });

            const result = await validatePorts({
                ports: [8080, 8080],
                servicePortMap: {
                    qbittorrent: [8080],
                    gluetun: [8080]
                }
            });

            expect(result.passed).toBe(true);
            expect(result.issues.every(i => i.code !== 'PORT_CONFLICT_BETWEEN_SERVICES')).toBe(true);
        });

        it('should detect ports in use by Docker containers', async () => {
            // Mock docker ps to return a container using port 8080
            vi.mocked(dockerUtils.runCommand).mockResolvedValue(
                'nginx:latest\t0.0.0.0:8080->80/tcp'
            );

            // Mock exec to indicate ports are not in use by host
            vi.mocked(child_process.exec).mockImplementation((cmd, callback: any) => {
                callback(null, { stdout: '', stderr: '' });
                return {} as any;
            });

            const result = await validatePorts({
                ports: [8080],
                servicePortMap: {
                    service1: [8080]
                }
            });

            expect(result.passed).toBe(false);
            expect(result.issues.some(i => i.code === 'PORT_IN_USE_DOCKER')).toBe(true);
            const dockerIssue = result.issues.find(i => i.code === 'PORT_IN_USE_DOCKER');
            expect(dockerIssue?.severity).toBe('error');
            expect(dockerIssue?.details?.containerImage).toContain('nginx');
        });

        it('should detect ports in use by host processes', async () => {
            // Mock docker ps to return no containers
            vi.mocked(dockerUtils.runCommand).mockResolvedValue('');

            // Mock lsof to indicate port is in use
            vi.mocked(child_process.exec).mockImplementation((cmd: string, callback: any) => {
                if (cmd.includes('lsof')) {
                    callback(null, { stdout: '12345', stderr: '' });
                } else if (cmd.includes('ps -p')) {
                    callback(null, { stdout: 'nginx', stderr: '' });
                } else {
                    callback(null, { stdout: '', stderr: '' });
                }
                return {} as any;
            });

            const result = await validatePorts({
                ports: [8080],
                servicePortMap: {
                    service1: [8080]
                }
            });

            expect(result.passed).toBe(false);
            expect(result.issues.some(i => i.code === 'PORT_IN_USE_HOST')).toBe(true);
            const hostIssue = result.issues.find(i => i.code === 'PORT_IN_USE_HOST');
            expect(hostIssue?.severity).toBe('error');
            expect(hostIssue?.details?.processInfo).toContain('12345');
        });

        it('should warn about privileged ports (80, 443)', async () => {
            // Mock docker ps to return no containers
            vi.mocked(dockerUtils.runCommand).mockResolvedValue('');

            // Mock exec to indicate ports are not in use
            vi.mocked(child_process.exec).mockImplementation((cmd, callback: any) => {
                callback(null, { stdout: '', stderr: '' });
                return {} as any;
            });

            const result = await validatePorts({
                ports: [80, 443],
                servicePortMap: {
                    traefik: [80, 443]
                }
            });

            expect(result.passed).toBe(true); // Warning doesn't fail validation
            expect(result.issues.some(i => i.code === 'PORT_PRIVILEGED')).toBe(true);
            const privilegedIssue = result.issues.find(i => i.code === 'PORT_PRIVILEGED');
            expect(privilegedIssue?.severity).toBe('warning');
        });

        it('should filter out stack containers from conflict check', async () => {
            // Mock docker ps to return a container from the same stack
            vi.mocked(dockerUtils.runCommand).mockResolvedValue(
                'media-stack-service1:latest\t0.0.0.0:8080->8080/tcp'
            );

            // Mock exec to indicate ports are not in use by host
            vi.mocked(child_process.exec).mockImplementation((cmd, callback: any) => {
                callback(null, { stdout: '', stderr: '' });
                return {} as any;
            });

            const result = await validatePorts({
                ports: [8080],
                servicePortMap: {
                    service1: [8080]
                }
            });

            // Should not report conflict if container name suggests it's from the stack
            expect(result.passed).toBe(true);
        });

        it('should handle docker command failures gracefully', async () => {
            // Mock docker command to fail
            vi.mocked(dockerUtils.runCommand).mockRejectedValue(
                new Error('Docker daemon not running')
            );

            // Mock exec to indicate ports are not in use
            vi.mocked(child_process.exec).mockImplementation((cmd, callback: any) => {
                callback(null, { stdout: '', stderr: '' });
                return {} as any;
            });

            const result = await validatePorts({
                ports: [8080],
                servicePortMap: {
                    service1: [8080]
                }
            });

            // Should still validate against host, even if Docker check fails
            expect(result.validator).toBe('port');
            expect(result.passed).toBe(true);
        });

        it('should include metadata in result', async () => {
            vi.mocked(dockerUtils.runCommand).mockResolvedValue('');
            vi.mocked(child_process.exec).mockImplementation((cmd, callback: any) => {
                callback(null, { stdout: '', stderr: '' });
                return {} as any;
            });

            const result = await validatePorts({
                ports: [8080, 9090],
                servicePortMap: {
                    service1: [8080],
                    service2: [9090]
                }
            });

            expect(result.metadata).toBeDefined();
            expect(result.metadata?.portsChecked).toBe(2);
            expect(result.metadata?.durationMs).toBeGreaterThanOrEqual(0);
        });
    });
});
