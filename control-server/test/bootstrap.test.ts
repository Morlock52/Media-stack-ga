import { describe, it, expect, vi, beforeEach } from 'vitest';
import { extractArrApiKey, bootstrapArrKeys, ARR_SERVICES, findContainerName } from '../src/services/arrService.js';
import * as dockerUtils from '../src/utils/docker.js';
import * as envUtils from '../src/utils/env.js';

vi.mock('../src/utils/docker.js', () => ({
    runCommand: vi.fn()
}));

vi.mock('../src/utils/env.js', () => ({
    setEnvValue: vi.fn(),
    PROJECT_ROOT: '/test/root'
}));

describe('arrService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('extractArrApiKey', () => {
        it('should extract API key correctly from docker exec output', async () => {
            const mockKey = 'abc-123-def';
            // Find the sonarr service definition
            const sonarrService = ARR_SERVICES.find(s => s.id === 'sonarr')!;

            vi.mocked(dockerUtils.runCommand).mockResolvedValue(mockKey);

            const key = await extractArrApiKey(sonarrService, 'sonarr');

            expect(key).toBe(mockKey);
            expect(dockerUtils.runCommand).toHaveBeenCalledWith('docker', [
                'exec',
                'sonarr',
                'sed',
                '-n',
                's:.*<ApiKey>\\(.*\\)</ApiKey>.*:\\1:p',
                '/config/config.xml'
            ]);
        });

        it('should return null if command fails', async () => {
            const sonarrService = ARR_SERVICES.find(s => s.id === 'sonarr')!;
            vi.mocked(dockerUtils.runCommand).mockRejectedValue(new Error('container not found'));

            const key = await extractArrApiKey(sonarrService, 'sonarr');

            expect(key).toBeNull();
        });

        it('should return null if output is empty', async () => {
            const sonarrService = ARR_SERVICES.find(s => s.id === 'sonarr')!;
            vi.mocked(dockerUtils.runCommand).mockResolvedValue('');

            const key = await extractArrApiKey(sonarrService, 'sonarr');

            expect(key).toBeNull();
        });
    });

    describe('bootstrapArrKeys', () => {
        it('should capture all available keys and set them in env', async () => {
            // Mock docker inspect for container running checks and docker exec for key extraction
            vi.mocked(dockerUtils.runCommand).mockImplementation(async (cmd, args) => {
                // docker ps --format {{.Names}} for getRunningContainers
                if (args.includes('--format') && args.includes('{{.Names}}')) {
                    return 'sonarr\nradarr';
                }

                // docker inspect for isContainerRunning checks
                if (args.includes('inspect') && args.includes('{{.State.Running}}')) {
                    const containerName = args[args.indexOf('-f') + 2];
                    if (containerName === 'sonarr' || containerName === 'radarr') {
                        return 'true';
                    }
                    return 'false';
                }

                // docker inspect for env extraction
                if (args.includes('inspect') && args.includes('{{range .Config.Env}}')) {
                    return '';
                }

                // docker exec for file existence check (test -f)
                if (args.includes('test') && args.includes('-f')) {
                    return '';
                }

                // docker exec sed for XML key extraction
                if (args.includes('exec') && args.includes('sed')) {
                    const container = args[1] as string;
                    if (container === 'sonarr') return 'sonarr-key';
                    if (container === 'radarr') return 'radarr-key';
                    return '';
                }

                // docker exec cat for other config types
                if (args.includes('exec') && args.includes('cat')) {
                    return '';
                }

                throw new Error('not running');
            });

            const results = await bootstrapArrKeys();

            expect(results).toEqual({
                SONARR_API_KEY: 'sonarr-key',
                RADARR_API_KEY: 'radarr-key'
            });

            expect(envUtils.setEnvValue).toHaveBeenCalledWith('SONARR_API_KEY', 'sonarr-key');
            expect(envUtils.setEnvValue).toHaveBeenCalledWith('RADARR_API_KEY', 'radarr-key');
        });
    });
});
