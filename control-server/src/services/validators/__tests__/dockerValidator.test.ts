import { describe, it, expect, vi, beforeEach } from 'vitest';
import { validateDocker } from '../dockerValidator.js';
import * as dockerUtils from '../../../utils/docker.js';

// Mock docker utils
vi.mock('../../../utils/docker.js', () => ({
    runCommand: vi.fn()
}));

describe('dockerValidator', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('validateDocker - Daemon Check', () => {
        it('should pass validation when Docker is accessible', async () => {
            // Mock successful docker info
            vi.mocked(dockerUtils.runCommand).mockResolvedValue('Docker info output');

            // Mock docker version
            vi.mocked(dockerUtils.runCommand).mockResolvedValueOnce('Docker info output')
                .mockResolvedValueOnce('Docker version 20.10.0, build 1234567');

            const result = await validateDocker({
                minVersion: '20.10.0',
                requireComposeV2: false
            });

            expect(result.validator).toBe('docker');
            expect(result.passed).toBe(true);
        });

        it('should fail when Docker is not installed', async () => {
            const error = new Error('docker: not found');
            vi.mocked(dockerUtils.runCommand).mockRejectedValue(error);

            const result = await validateDocker({
                minVersion: '20.10.0',
                requireComposeV2: false
            });

            expect(result.passed).toBe(false);
            expect(result.issues.some(i => i.code === 'DOCKER_NOT_INSTALLED')).toBe(true);
            const installIssue = result.issues.find(i => i.code === 'DOCKER_NOT_INSTALLED');
            expect(installIssue?.severity).toBe('error');
            expect(installIssue?.fixSuggestion).toContain('Install Docker');
        });

        it('should fail when Docker daemon is not running', async () => {
            const error = new Error('Cannot connect to the Docker daemon');
            vi.mocked(dockerUtils.runCommand).mockRejectedValue(error);

            const result = await validateDocker({
                minVersion: '20.10.0',
                requireComposeV2: false
            });

            expect(result.passed).toBe(false);
            expect(result.issues.some(i => i.code === 'DOCKER_DAEMON_NOT_RUNNING')).toBe(true);
            const daemonIssue = result.issues.find(i => i.code === 'DOCKER_DAEMON_NOT_RUNNING');
            expect(daemonIssue?.severity).toBe('error');
            expect(daemonIssue?.fixSuggestion).toContain('Start Docker');
        });

        it('should fail when Docker permission is denied', async () => {
            const error = new Error('permission denied while trying to connect to the Docker daemon socket');
            vi.mocked(dockerUtils.runCommand).mockRejectedValue(error);

            const result = await validateDocker({
                minVersion: '20.10.0',
                requireComposeV2: false
            });

            expect(result.passed).toBe(false);
            expect(result.issues.some(i => i.code === 'DOCKER_PERMISSION_DENIED')).toBe(true);
            const permissionIssue = result.issues.find(i => i.code === 'DOCKER_PERMISSION_DENIED');
            expect(permissionIssue?.severity).toBe('error');
            expect(permissionIssue?.fixSuggestion).toContain('usermod -aG docker');
        });
    });

    describe('validateDocker - Version Check', () => {
        it('should pass when Docker version meets minimum requirement', async () => {
            vi.mocked(dockerUtils.runCommand)
                .mockResolvedValueOnce('Docker info output')
                .mockResolvedValueOnce('Docker version 20.10.5, build abc123');

            const result = await validateDocker({
                minVersion: '20.10.0',
                requireComposeV2: false
            });

            expect(result.passed).toBe(true);
            expect(result.issues.every(i => i.code !== 'DOCKER_VERSION_TOO_OLD')).toBe(true);
        });

        it('should fail when Docker version is too old', async () => {
            vi.mocked(dockerUtils.runCommand)
                .mockResolvedValueOnce('Docker info output')
                .mockResolvedValueOnce('Docker version 19.03.0, build abc123');

            const result = await validateDocker({
                minVersion: '20.10.0',
                requireComposeV2: false
            });

            expect(result.passed).toBe(false);
            expect(result.issues.some(i => i.code === 'DOCKER_VERSION_TOO_OLD')).toBe(true);
            const versionIssue = result.issues.find(i => i.code === 'DOCKER_VERSION_TOO_OLD');
            expect(versionIssue?.severity).toBe('error');
            expect(versionIssue?.details?.currentVersion).toContain('19.03.0');
            expect(versionIssue?.details?.requiredVersion).toBe('20.10.0');
        });

        it('should handle version parsing correctly', async () => {
            vi.mocked(dockerUtils.runCommand)
                .mockResolvedValueOnce('Docker info output')
                .mockResolvedValueOnce('Docker version 24.0.7, build afdd53b');

            const result = await validateDocker({
                minVersion: '20.10.0',
                requireComposeV2: false
            });

            expect(result.passed).toBe(true);
        });
    });

    describe('validateDocker - Compose Check', () => {
        it('should pass when Docker Compose v2 is available', async () => {
            vi.mocked(dockerUtils.runCommand)
                .mockResolvedValueOnce('Docker info output')
                .mockResolvedValueOnce('Docker version 20.10.5, build abc123')
                .mockResolvedValueOnce('Docker Compose version v2.20.0');

            const result = await validateDocker({
                minVersion: '20.10.0',
                requireComposeV2: true
            });

            expect(result.passed).toBe(true);
            expect(result.issues.every(i => i.code !== 'DOCKER_COMPOSE_V2_REQUIRED')).toBe(true);
        });

        it('should warn when using Docker Compose v1', async () => {
            vi.mocked(dockerUtils.runCommand)
                .mockResolvedValueOnce('Docker info output')
                .mockResolvedValueOnce('Docker version 20.10.5, build abc123')
                .mockResolvedValueOnce('docker-compose version 1.29.2');

            const result = await validateDocker({
                minVersion: '20.10.0',
                requireComposeV2: false
            });

            expect(result.passed).toBe(true); // Warning doesn't fail validation
            expect(result.issues.some(i => i.code === 'DOCKER_COMPOSE_V1_DEPRECATED')).toBe(true);
            const composeIssue = result.issues.find(i => i.code === 'DOCKER_COMPOSE_V1_DEPRECATED');
            expect(composeIssue?.severity).toBe('warning');
        });

        it('should fail when Compose v2 is required but not available', async () => {
            vi.mocked(dockerUtils.runCommand)
                .mockResolvedValueOnce('Docker info output')
                .mockResolvedValueOnce('Docker version 20.10.5, build abc123')
                .mockResolvedValueOnce('docker-compose version 1.29.2');

            const result = await validateDocker({
                minVersion: '20.10.0',
                requireComposeV2: true
            });

            expect(result.passed).toBe(false);
            expect(result.issues.some(i => i.code === 'DOCKER_COMPOSE_V2_REQUIRED')).toBe(true);
        });

        it('should handle Compose not being installed', async () => {
            vi.mocked(dockerUtils.runCommand)
                .mockResolvedValueOnce('Docker info output')
                .mockResolvedValueOnce('Docker version 20.10.5, build abc123')
                .mockRejectedValueOnce(new Error('docker compose: command not found'));

            const result = await validateDocker({
                minVersion: '20.10.0',
                requireComposeV2: false
            });

            expect(result.passed).toBe(false);
            expect(result.issues.some(i => i.code === 'DOCKER_COMPOSE_NOT_FOUND')).toBe(true);
        });
    });

    describe('validateDocker - Network Check', () => {
        it('should pass when networks are normal', async () => {
            vi.mocked(dockerUtils.runCommand)
                .mockResolvedValueOnce('Docker info output')
                .mockResolvedValueOnce('Docker version 20.10.5, build abc123')
                .mockResolvedValueOnce('Docker Compose version v2.20.0')
                .mockResolvedValueOnce('bridge\nhost\nnone');

            const result = await validateDocker({
                minVersion: '20.10.0',
                requireComposeV2: false
            });

            expect(result.passed).toBe(true);
        });

        it('should warn when many networks exist', async () => {
            const manyNetworks = Array.from({ length: 60 }, (_, i) => `network${i}`).join('\n');

            vi.mocked(dockerUtils.runCommand)
                .mockResolvedValueOnce('Docker info output')
                .mockResolvedValueOnce('Docker version 20.10.5, build abc123')
                .mockResolvedValueOnce('Docker Compose version v2.20.0')
                .mockResolvedValueOnce(manyNetworks);

            const result = await validateDocker({
                minVersion: '20.10.0',
                requireComposeV2: false
            });

            expect(result.passed).toBe(true); // Warning doesn't fail validation
            expect(result.issues.some(i => i.code === 'DOCKER_NETWORK_COUNT_HIGH')).toBe(true);
        });

        it('should warn about VPN subnet conflicts', async () => {
            vi.mocked(dockerUtils.runCommand)
                .mockResolvedValueOnce('Docker info output')
                .mockResolvedValueOnce('Docker version 20.10.5, build abc123')
                .mockResolvedValueOnce('Docker Compose version v2.20.0')
                .mockResolvedValueOnce('bridge\ngluetun_network\nvpn_network');

            const result = await validateDocker({
                minVersion: '20.10.0',
                requireComposeV2: false,
                networks: ['10.2.0.0/16']
            });

            expect(result.passed).toBe(true); // Warning doesn't fail validation
            expect(result.issues.some(i => i.code === 'DOCKER_NETWORK_VPN_CONFLICT')).toBe(true);
        });

        it('should handle network listing failure gracefully', async () => {
            vi.mocked(dockerUtils.runCommand)
                .mockResolvedValueOnce('Docker info output')
                .mockResolvedValueOnce('Docker version 20.10.5, build abc123')
                .mockResolvedValueOnce('Docker Compose version v2.20.0')
                .mockRejectedValueOnce(new Error('Network error'));

            const result = await validateDocker({
                minVersion: '20.10.0',
                requireComposeV2: false
            });

            // Should still pass overall validation even if network check fails
            expect(result.passed).toBe(true);
        });
    });

    describe('validateDocker - Short-circuit on daemon failure', () => {
        it('should skip version check if daemon is not accessible', async () => {
            const error = new Error('Cannot connect to the Docker daemon');
            vi.mocked(dockerUtils.runCommand).mockRejectedValue(error);

            const result = await validateDocker({
                minVersion: '20.10.0',
                requireComposeV2: false
            });

            expect(result.passed).toBe(false);
            expect(result.issues).toHaveLength(1);
            expect(result.issues[0].code).toBe('DOCKER_DAEMON_NOT_RUNNING');
            // Should not have version-related issues since daemon check failed
            expect(result.issues.every(i => !i.code.includes('VERSION'))).toBe(true);
        });
    });

    describe('validateDocker - Metadata', () => {
        it('should include metadata in result', async () => {
            vi.mocked(dockerUtils.runCommand)
                .mockResolvedValueOnce('Docker info output')
                .mockResolvedValueOnce('Docker version 20.10.5, build abc123');

            const result = await validateDocker({
                minVersion: '20.10.0',
                requireComposeV2: false
            });

            expect(result.metadata).toBeDefined();
            expect(result.metadata?.minVersion).toBe('20.10.0');
            expect(result.metadata?.requireComposeV2).toBe(false);
            expect(result.metadata?.durationMs).toBeGreaterThanOrEqual(0);
        });
    });
});
