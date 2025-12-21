import { describe, it, expect, vi, beforeEach } from 'vitest';
import { extractArrApiKey, bootstrapArrKeys, ARR_SERVICES } from '../src/services/arrService.js';
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
            vi.mocked(dockerUtils.runCommand).mockResolvedValue(mockKey);

            const key = await extractArrApiKey('sonarr');

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
            vi.mocked(dockerUtils.runCommand).mockRejectedValue(new Error('container not found'));

            const key = await extractArrApiKey('sonarr');

            expect(key).toBeNull();
        });

        it('should return null if output is empty', async () => {
            vi.mocked(dockerUtils.runCommand).mockResolvedValue('');

            const key = await extractArrApiKey('sonarr');

            expect(key).toBeNull();
        });
    });

    describe('bootstrapArrKeys', () => {
        it('should capture all available keys and set them in env', async () => {
            vi.mocked(dockerUtils.runCommand).mockImplementation(async (_cmd, args) => {
                const container = args[1] as string; // docker exec [container] sed ...
                if (container === 'sonarr') return 'sonarr-key';
                if (container === 'radarr') return 'radarr-key';
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
