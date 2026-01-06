import { describe, it, expect, vi, beforeEach } from 'vitest';
import { validatePaths } from '../pathValidator.js';
import * as fs from 'fs/promises';
import { constants } from 'fs';

// Mock fs/promises
vi.mock('fs/promises', () => ({
    default: {
        stat: vi.fn(),
        access: vi.fn()
    }
}));

describe('pathValidator', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('validatePaths', () => {
        it('should pass validation for valid paths with correct permissions', async () => {
            // Mock valid directory with read/write permissions
            vi.mocked(fs.stat).mockResolvedValue({
                isDirectory: () => true
            } as any);
            vi.mocked(fs.access).mockResolvedValue(undefined);

            const result = await validatePaths({
                paths: {
                    dataRoot: '/data',
                    configRoot: '/config'
                },
                checkWrite: true
            });

            expect(result.validator).toBe('path');
            expect(result.passed).toBe(true);
            expect(result.issues).toHaveLength(0);
        });

        it('should fail when path does not exist', async () => {
            const error = new Error('ENOENT') as NodeJS.ErrnoException;
            error.code = 'ENOENT';
            vi.mocked(fs.stat).mockRejectedValue(error);

            const result = await validatePaths({
                paths: {
                    dataRoot: '/nonexistent'
                },
                checkWrite: true
            });

            expect(result.passed).toBe(false);
            expect(result.issues).toHaveLength(1);
            expect(result.issues[0].code).toBe('PATH_NOT_FOUND');
            expect(result.issues[0].severity).toBe('error');
            expect(result.issues[0].affectedField).toBe('dataRoot');
            expect(result.issues[0].fixSuggestion).toContain('mkdir -p');
        });

        it('should fail when path is not a directory', async () => {
            vi.mocked(fs.stat).mockResolvedValue({
                isDirectory: () => false
            } as any);

            const result = await validatePaths({
                paths: {
                    dataRoot: '/data/file.txt'
                },
                checkWrite: true
            });

            expect(result.passed).toBe(false);
            expect(result.issues).toHaveLength(1);
            expect(result.issues[0].code).toBe('PATH_NOT_DIRECTORY');
            expect(result.issues[0].severity).toBe('error');
        });

        it('should fail when path is not readable', async () => {
            vi.mocked(fs.stat).mockResolvedValue({
                isDirectory: () => true
            } as any);
            vi.mocked(fs.access).mockImplementation(async (path, mode) => {
                if (mode === constants.R_OK) {
                    throw new Error('No read permission');
                }
            });

            const result = await validatePaths({
                paths: {
                    dataRoot: '/data'
                },
                checkWrite: false
            });

            expect(result.passed).toBe(false);
            expect(result.issues).toHaveLength(1);
            expect(result.issues[0].code).toBe('PATH_NOT_READABLE');
            expect(result.issues[0].severity).toBe('error');
            expect(result.issues[0].fixSuggestion).toContain('chmod +r');
        });

        it('should fail when path is not writable', async () => {
            vi.mocked(fs.stat).mockResolvedValue({
                isDirectory: () => true
            } as any);
            vi.mocked(fs.access).mockImplementation(async (path, mode) => {
                if (mode === constants.R_OK) {
                    return;
                }
                if (mode === constants.W_OK) {
                    throw new Error('No write permission');
                }
            });

            const result = await validatePaths({
                paths: {
                    dataRoot: '/data'
                },
                checkWrite: true
            });

            expect(result.passed).toBe(false);
            expect(result.issues).toHaveLength(1);
            expect(result.issues[0].code).toBe('PATH_NOT_WRITABLE');
            expect(result.issues[0].severity).toBe('error');
            expect(result.issues[0].fixSuggestion).toContain('chmod +w');
        });

        it('should detect TRaSH Guides antipatterns', async () => {
            vi.mocked(fs.stat).mockResolvedValue({
                isDirectory: () => true
            } as any);
            vi.mocked(fs.access).mockResolvedValue(undefined);

            const result = await validatePaths({
                paths: {
                    downloads: '/data/downloads/complete'
                },
                checkWrite: true
            });

            expect(result.passed).toBe(true); // Warning doesn't fail validation
            expect(result.issues).toHaveLength(1);
            expect(result.issues[0].code).toBe('PATH_ANTIPATTERN');
            expect(result.issues[0].severity).toBe('warning');
            expect(result.issues[0].message).toContain('nested folders');
            expect(result.issues[0].fixSuggestion).toContain('TRaSH Guides');
        });

        it('should detect duplicate paths', async () => {
            vi.mocked(fs.stat).mockResolvedValue({
                isDirectory: () => true
            } as any);
            vi.mocked(fs.access).mockResolvedValue(undefined);

            const result = await validatePaths({
                paths: {
                    dataRoot: '/data',
                    configRoot: '/data'
                },
                checkWrite: true
            });

            expect(result.passed).toBe(true); // Warning doesn't fail validation
            expect(result.issues.some(i => i.code === 'PATH_DUPLICATE')).toBe(true);
            const duplicateIssue = result.issues.find(i => i.code === 'PATH_DUPLICATE');
            expect(duplicateIssue?.severity).toBe('warning');
        });

        it('should detect nested paths', async () => {
            vi.mocked(fs.stat).mockResolvedValue({
                isDirectory: () => true
            } as any);
            vi.mocked(fs.access).mockResolvedValue(undefined);

            const result = await validatePaths({
                paths: {
                    dataRoot: '/data',
                    configRoot: '/data/config'
                },
                checkWrite: true
            });

            expect(result.passed).toBe(true); // Info doesn't fail validation
            expect(result.issues.some(i => i.code === 'PATH_NESTED')).toBe(true);
            const nestedIssue = result.issues.find(i => i.code === 'PATH_NESTED');
            expect(nestedIssue?.severity).toBe('info');
        });

        it('should fail for empty paths', async () => {
            const result = await validatePaths({
                paths: {
                    dataRoot: ''
                },
                checkWrite: true
            });

            expect(result.passed).toBe(false);
            expect(result.issues).toHaveLength(1);
            expect(result.issues[0].code).toBe('PATH_EMPTY');
            expect(result.issues[0].severity).toBe('error');
        });

        it('should handle access denied errors', async () => {
            const error = new Error('EACCES') as NodeJS.ErrnoException;
            error.code = 'EACCES';
            vi.mocked(fs.stat).mockRejectedValue(error);

            const result = await validatePaths({
                paths: {
                    dataRoot: '/restricted'
                },
                checkWrite: true
            });

            expect(result.passed).toBe(false);
            expect(result.issues).toHaveLength(1);
            expect(result.issues[0].code).toBe('PATH_ACCESS_DENIED');
            expect(result.issues[0].severity).toBe('error');
        });

        it('should respect checkWrite option when false', async () => {
            vi.mocked(fs.stat).mockResolvedValue({
                isDirectory: () => true
            } as any);
            vi.mocked(fs.access).mockImplementation(async (path, mode) => {
                if (mode === constants.W_OK) {
                    throw new Error('Should not check write permission');
                }
            });

            const result = await validatePaths({
                paths: {
                    dataRoot: '/data'
                },
                checkWrite: false
            });

            expect(result.passed).toBe(true);
            // Should only check read permission, not write
            expect(fs.access).toHaveBeenCalledWith('/data', constants.R_OK);
            expect(fs.access).not.toHaveBeenCalledWith('/data', constants.W_OK);
        });

        it('should include metadata in result', async () => {
            vi.mocked(fs.stat).mockResolvedValue({
                isDirectory: () => true
            } as any);
            vi.mocked(fs.access).mockResolvedValue(undefined);

            const result = await validatePaths({
                paths: {
                    dataRoot: '/data',
                    configRoot: '/config'
                },
                checkWrite: true
            });

            expect(result.metadata).toBeDefined();
            expect(result.metadata?.pathsChecked).toBe(2);
            expect(result.metadata?.checkWritePermissions).toBe(true);
            expect(result.metadata?.durationMs).toBeGreaterThanOrEqual(0);
        });
    });
});
