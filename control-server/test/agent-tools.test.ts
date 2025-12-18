import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as registryService from '../src/services/registryService.js';
import * as docService from '../src/services/docService.js';
import fs from 'fs';

vi.mock('fs');
vi.mock('../src/utils/env.js', () => ({
    PROJECT_ROOT: '/mock/root',
    readEnvFile: vi.fn(),
    setEnvValue: vi.fn()
}));

describe('Registry Service', () => {
    beforeEach(() => {
        vi.resetAllMocks();
    });

    it('should load an empty registry if file does not exist', () => {
        (fs.existsSync as any).mockReturnValue(false);
        const registry = registryService.loadRegistry();
        expect(registry).toEqual([]);
    });

    it('should add an app to the registry', () => {
        (fs.existsSync as any).mockReturnValue(true);
        (fs.readFileSync as any).mockReturnValue('[]');
        const app = { id: 'test-app', name: 'Test App', description: 'Test Description' };
        registryService.addApp(app);
        expect(fs.writeFileSync).toHaveBeenCalled();
    });

    it('should throw error if adding duplicate app', () => {
        (fs.existsSync as any).mockReturnValue(true);
        (fs.readFileSync as any).mockReturnValue(JSON.stringify([{ id: 'test-app' }]));
        const app = { id: 'test-app', name: 'Test App', description: 'Test Description' };
        expect(() => registryService.addApp(app)).toThrow('App with ID test-app already exists');
    });
});

describe('Doc Service', () => {
    beforeEach(() => {
        vi.resetAllMocks();
    });

    it('should list docs', () => {
        (fs.existsSync as any).mockReturnValue(true);
        (fs.readdirSync as any).mockReturnValue(['PlexGuide.tsx', 'Other.txt']);
        const docs = docService.listDocs();
        expect(docs).toEqual(['PlexGuide']);
    });

    it('should create a doc', () => {
        (fs.existsSync as any).mockReturnValue(true);
        docService.createDoc('TestGuide', 'content');
        expect(fs.writeFileSync).toHaveBeenCalled();
    });
});
