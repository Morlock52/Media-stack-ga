import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Readable, Writable } from 'stream';
import * as backupService from '../src/services/backupService.js';
import * as encryption from '../src/utils/encryption.js';
import { LocalAdapter } from '../src/services/backup/localAdapter.js';
import * as dockerUtils from '../src/utils/docker.js';
import * as fs from 'fs';
import * as fsPromises from 'fs/promises';
import * as crypto from 'crypto';

// Mock dependencies
vi.mock('../src/utils/docker.js', () => ({
    runCommand: vi.fn()
}));

vi.mock('fs', async (importOriginal) => {
    const actual = await importOriginal<typeof fs>();
    return {
        ...actual,
        createReadStream: vi.fn(),
        createWriteStream: vi.fn(),
    };
});

vi.mock('fs/promises', async (importOriginal) => {
    const actual = await importOriginal<typeof fsPromises>();
    return {
        ...actual,
        mkdir: vi.fn().mockResolvedValue(undefined),
        stat: vi.fn(),
        writeFile: vi.fn().mockResolvedValue(undefined),
        unlink: vi.fn().mockResolvedValue(undefined),
        copyFile: vi.fn().mockResolvedValue(undefined),
        readdir: vi.fn(),
        open: vi.fn(),
    };
});

vi.mock('crypto', async (importOriginal) => {
    const actual = await importOriginal<typeof crypto>();
    return {
        ...actual,
        createHash: vi.fn(),
        createCipheriv: vi.fn(),
        createDecipheriv: vi.fn(),
        pbkdf2: vi.fn(),
        randomBytes: vi.fn(),
    };
});

describe('Backup Service', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('discoverBackupTargets', () => {
        it('should discover backup targets from running containers', async () => {
            // Mock docker commands
            vi.mocked(dockerUtils.runCommand).mockImplementation(async (cmd, args) => {
                // docker ps - list running containers
                if (args.includes('ps') && args.includes('{{.Names}}|{{.ID}}')) {
                    return 'sonarr|abc123\nradarr|def456';
                }

                // docker inspect - get mounts
                if (args.includes('inspect') && args.includes('{{json .Mounts}}')) {
                    return JSON.stringify([
                        { Type: 'volume', Source: 'sonarr-config', Destination: '/config' }
                    ]);
                }

                // docker exec test - check if path exists
                if (args.includes('test') && args.includes('-e')) {
                    return ''; // Success = path exists
                }

                // docker exec du - get path size
                if (args.includes('du') && args.includes('-sb')) {
                    return '1048576\t/config';
                }

                // docker run du - get volume size
                if (args.includes('run') && args.includes('du')) {
                    return '2097152\t/data';
                }

                throw new Error('Unexpected command');
            });

            const targets = await backupService.discoverBackupTargets();

            expect(targets).toBeDefined();
            expect(Array.isArray(targets)).toBe(true);
            expect(targets.length).toBeGreaterThan(0);

            // Should find sonarr config
            const sonarrConfig = targets.find(t => t.service === 'sonarr' && t.type === 'config');
            expect(sonarrConfig).toBeDefined();
            expect(sonarrConfig?.path).toContain('sonarr');
        });

        it('should handle containers with no matching services', async () => {
            vi.mocked(dockerUtils.runCommand).mockImplementation(async (cmd, args) => {
                if (args.includes('ps')) {
                    return 'unknown-container|xyz789';
                }
                if (args.includes('inspect')) {
                    return JSON.stringify([]);
                }
                return '';
            });

            const targets = await backupService.discoverBackupTargets();
            expect(targets).toBeDefined();
            expect(Array.isArray(targets)).toBe(true);
        });

        it('should throw error when docker commands fail', async () => {
            vi.mocked(dockerUtils.runCommand).mockRejectedValue(new Error('Docker not running'));

            await expect(backupService.discoverBackupTargets()).rejects.toThrow('Failed to discover backup targets');
        });
    });

    describe('calculateBackupSize', () => {
        it('should calculate total size from estimated sizes', async () => {
            const items = [
                {
                    type: 'config' as const,
                    name: 'sonarr-config',
                    path: 'sonarr:/config',
                    service: 'sonarr',
                    estimatedSize: 1048576, // 1MB
                },
                {
                    type: 'database' as const,
                    name: 'radarr-db',
                    path: 'radarr:/config/radarr.db',
                    service: 'radarr',
                    estimatedSize: 2097152, // 2MB
                },
            ];

            const totalSize = await backupService.calculateBackupSize(items);
            expect(totalSize).toBe(3145728); // 3MB total
        });

        it('should calculate size for items without estimated size', async () => {
            vi.mocked(dockerUtils.runCommand).mockResolvedValue('1048576\t/config');

            const items = [
                {
                    type: 'config' as const,
                    name: 'sonarr-config',
                    path: 'sonarr:/config',
                    service: 'sonarr',
                },
            ];

            const totalSize = await backupService.calculateBackupSize(items);
            expect(totalSize).toBeGreaterThan(0);
        });

        it('should handle volumes', async () => {
            vi.mocked(dockerUtils.runCommand).mockResolvedValue('2097152\t/data');

            const items = [
                {
                    type: 'volume' as const,
                    name: 'sonarr-config',
                    path: 'sonarr-config',
                    service: 'sonarr',
                },
            ];

            const totalSize = await backupService.calculateBackupSize(items);
            expect(totalSize).toBeGreaterThan(0);
        });
    });

    describe('validateBackup', () => {
        it('should validate backup with matching checksums', async () => {
            const manifest = {
                id: 'backup-123',
                version: '1.0',
                createdAt: new Date().toISOString(),
                name: 'test-backup',
                items: [
                    {
                        type: 'config' as const,
                        name: 'sonarr-config',
                        path: 'sonarr:/config',
                        service: 'sonarr',
                        size: 1048576,
                        checksum: 'abc123',
                        compressedSize: 524288,
                    },
                ],
                totalSize: 1048576,
                totalCompressedSize: 524288,
                encrypted: false,
                checksumAlgorithm: 'sha256',
                metadata: {
                    hostname: 'test-host',
                    dockerVersion: 'Docker version 24.0.0',
                },
            };

            // Mock file reading for checksum calculation
            const mockHash = {
                update: vi.fn().mockReturnThis(),
                digest: vi.fn().mockReturnValue('abc123'),
            };

            const mockStream = new Readable({
                read() {
                    this.push('test data');
                    this.push(null);
                }
            });

            vi.mocked(crypto.createHash).mockReturnValue(mockHash as any);
            vi.mocked(fs.createReadStream).mockReturnValue(mockStream as any);

            const result = await backupService.validateBackup(manifest, '/tmp/backup-123');

            expect(result.valid).toBe(true);
            expect(result.errors).toHaveLength(0);
        });

        it('should detect checksum mismatches', async () => {
            const manifest = {
                id: 'backup-123',
                version: '1.0',
                createdAt: new Date().toISOString(),
                name: 'test-backup',
                items: [
                    {
                        type: 'config' as const,
                        name: 'sonarr-config',
                        path: 'sonarr:/config',
                        service: 'sonarr',
                        size: 1048576,
                        checksum: 'abc123',
                        compressedSize: 524288,
                    },
                ],
                totalSize: 1048576,
                totalCompressedSize: 524288,
                encrypted: false,
                checksumAlgorithm: 'sha256',
                metadata: {
                    hostname: 'test-host',
                    dockerVersion: 'Docker version 24.0.0',
                },
            };

            // Mock checksum that doesn't match
            const mockHash = {
                update: vi.fn().mockReturnThis(),
                digest: vi.fn().mockReturnValue('different-hash'),
            };

            const mockStream = new Readable({
                read() {
                    this.push('test data');
                    this.push(null);
                }
            });

            vi.mocked(crypto.createHash).mockReturnValue(mockHash as any);
            vi.mocked(fs.createReadStream).mockReturnValue(mockStream as any);

            const result = await backupService.validateBackup(manifest, '/tmp/backup-123');

            expect(result.valid).toBe(false);
            expect(result.errors.length).toBeGreaterThan(0);
            expect(result.errors[0]).toContain('Checksum mismatch');
        });
    });

    describe('stopContainer and startContainer', () => {
        it('should stop a container successfully', async () => {
            vi.mocked(dockerUtils.runCommand).mockResolvedValue('');

            await expect(backupService.stopContainer('sonarr')).resolves.toBeUndefined();

            expect(dockerUtils.runCommand).toHaveBeenCalledWith(
                'docker',
                ['stop', 'sonarr'],
                expect.objectContaining({ timeoutMs: 60_000 })
            );
        });

        it('should start a container successfully', async () => {
            vi.mocked(dockerUtils.runCommand).mockResolvedValue('');

            await expect(backupService.startContainer('sonarr')).resolves.toBeUndefined();

            expect(dockerUtils.runCommand).toHaveBeenCalledWith(
                'docker',
                ['start', 'sonarr'],
                expect.objectContaining({ timeoutMs: 60_000 })
            );
        });

        it('should throw error when stop fails', async () => {
            vi.mocked(dockerUtils.runCommand).mockRejectedValue(new Error('Container not found'));

            await expect(backupService.stopContainer('unknown')).rejects.toThrow('Failed to stop container');
        });

        it('should throw error when start fails', async () => {
            vi.mocked(dockerUtils.runCommand).mockRejectedValue(new Error('Container not found'));

            await expect(backupService.startContainer('unknown')).rejects.toThrow('Failed to start container');
        });
    });

    describe('extractBackupArchive', () => {
        it('should extract tar.gz archive successfully', async () => {
            vi.mocked(dockerUtils.runCommand).mockResolvedValue('');
            vi.mocked(fsPromises.mkdir).mockResolvedValue(undefined);

            await expect(
                backupService.extractBackupArchive('/tmp/backup.tar.gz', '/tmp/extract')
            ).resolves.toBeUndefined();

            expect(dockerUtils.runCommand).toHaveBeenCalledWith(
                'tar',
                ['-xzf', '/tmp/backup.tar.gz', '-C', '/tmp/extract'],
                expect.objectContaining({ timeoutMs: 300_000 })
            );
        });

        it('should throw error when extraction fails', async () => {
            vi.mocked(dockerUtils.runCommand).mockRejectedValue(new Error('Invalid archive'));

            await expect(
                backupService.extractBackupArchive('/tmp/invalid.tar.gz', '/tmp/extract')
            ).rejects.toThrow('Failed to extract archive');
        });
    });

    describe('restoreToVolume', () => {
        it('should restore files to Docker volume', async () => {
            vi.mocked(dockerUtils.runCommand).mockResolvedValue('');

            await expect(
                backupService.restoreToVolume('sonarr-config', '/tmp/source')
            ).resolves.toBeUndefined();

            expect(dockerUtils.runCommand).toHaveBeenCalledWith(
                'docker',
                expect.arrayContaining(['run', '--rm', '-v', 'sonarr-config:/target']),
                expect.anything()
            );
        });

        it('should throw error when restore fails', async () => {
            vi.mocked(dockerUtils.runCommand).mockRejectedValue(new Error('Volume not found'));

            await expect(
                backupService.restoreToVolume('unknown-volume', '/tmp/source')
            ).rejects.toThrow('Failed to restore volume');
        });
    });

    describe('restoreToContainerPath', () => {
        it('should restore files to container path', async () => {
            vi.mocked(dockerUtils.runCommand).mockResolvedValue('');

            await expect(
                backupService.restoreToContainerPath('sonarr', '/config', '/tmp/source')
            ).resolves.toBeUndefined();

            expect(dockerUtils.runCommand).toHaveBeenCalledWith(
                'docker',
                ['cp', '/tmp/source/.', 'sonarr:/config'],
                expect.anything()
            );
        });

        it('should throw error when restore fails', async () => {
            vi.mocked(dockerUtils.runCommand).mockRejectedValue(new Error('Container not running'));

            await expect(
                backupService.restoreToContainerPath('unknown', '/config', '/tmp/source')
            ).rejects.toThrow('Failed to restore to container');
        });
    });
});

describe('Encryption Utilities', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('encryptFile', () => {
        it('should encrypt a file with password', async () => {
            // Mock crypto functions
            const mockSalt = Buffer.from('mock-salt-32-bytes-long-string!!');
            const mockIv = Buffer.from('mock-iv-16-bytes!');
            const mockAuthTag = Buffer.from('mock-auth-tag-16!');
            const mockKey = Buffer.from('mock-key-32-bytes-long-string!!!');

            vi.mocked(crypto.randomBytes)
                .mockReturnValueOnce(mockSalt) // salt
                .mockReturnValueOnce(mockIv);  // iv

            vi.mocked(crypto.pbkdf2).mockImplementation((password, salt, iterations, keylen, digest, callback) => {
                callback(null, mockKey);
            });

            const mockCipher = {
                getAuthTag: vi.fn().mockReturnValue(mockAuthTag),
                update: vi.fn(),
                final: vi.fn(),
                pipe: vi.fn().mockReturnThis(),
                on: vi.fn(),
                once: vi.fn(),
                emit: vi.fn(),
                write: vi.fn(),
                end: vi.fn(),
            };

            vi.mocked(crypto.createCipheriv).mockReturnValue(mockCipher as any);

            // Mock file streams
            const mockReadStream = new Readable({
                read() {
                    this.push('test data');
                    this.push(null);
                }
            });

            const mockWriteStream = new Writable({
                write(chunk, encoding, callback) {
                    callback();
                },
                final(callback) {
                    callback();
                }
            });

            vi.mocked(fs.createReadStream).mockReturnValue(mockReadStream as any);
            vi.mocked(fs.createWriteStream).mockReturnValue(mockWriteStream as any);

            // Mock fs.promises.open for updating auth tag
            const mockFileHandle = {
                write: vi.fn().mockResolvedValue({ bytesWritten: 16 }),
                close: vi.fn().mockResolvedValue(undefined),
            };
            vi.mocked(fsPromises.open).mockResolvedValue(mockFileHandle as any);

            const result = await encryption.encryptFile('/tmp/test.txt', '/tmp/test.enc', 'password123');

            expect(result).toBeDefined();
            expect(result.algorithm).toBe('aes-256-gcm');
            expect(crypto.randomBytes).toHaveBeenCalledTimes(2);
            expect(crypto.pbkdf2).toHaveBeenCalled();
            expect(crypto.createCipheriv).toHaveBeenCalled();
        });

        it('should clean up on encryption failure', async () => {
            vi.mocked(crypto.randomBytes).mockReturnValue(Buffer.from('mock-bytes'));
            vi.mocked(crypto.pbkdf2).mockImplementation((password, salt, iterations, keylen, digest, callback) => {
                callback(new Error('PBKDF2 failed'), Buffer.from(''));
            });

            await expect(
                encryption.encryptFile('/tmp/test.txt', '/tmp/test.enc', 'password123')
            ).rejects.toThrow('Encryption failed');

            expect(fsPromises.unlink).toHaveBeenCalledWith('/tmp/test.enc');
        });
    });

    describe('decryptFile', () => {
        it('should decrypt an encrypted file with correct password', async () => {
            const mockSalt = Buffer.from('mock-salt-32-bytes-long-string!!');
            const mockIv = Buffer.from('mock-iv-16-bytes!');
            const mockAuthTag = Buffer.from('mock-auth-tag-16!');
            const mockKey = Buffer.from('mock-key-32-bytes-long-string!!!');

            // Mock header reading
            const headerBuffer = Buffer.alloc(73); // 8 + 1 + 32 + 16 + 16
            headerBuffer.write('MSBKUP01', 0);
            headerBuffer.writeUInt8(1, 8);
            mockSalt.copy(headerBuffer, 9);
            mockIv.copy(headerBuffer, 41);
            mockAuthTag.copy(headerBuffer, 57);

            const mockFileHandle = {
                read: vi.fn().mockResolvedValue({ bytesRead: 73, buffer: headerBuffer }),
                close: vi.fn().mockResolvedValue(undefined),
            };
            vi.mocked(fsPromises.open).mockResolvedValue(mockFileHandle as any);

            vi.mocked(crypto.pbkdf2).mockImplementation((password, salt, iterations, keylen, digest, callback) => {
                callback(null, mockKey);
            });

            const mockDecipher = {
                setAuthTag: vi.fn(),
                update: vi.fn(),
                final: vi.fn(),
                pipe: vi.fn().mockReturnThis(),
                on: vi.fn(),
                once: vi.fn(),
                emit: vi.fn(),
            };

            vi.mocked(crypto.createDecipheriv).mockReturnValue(mockDecipher as any);

            const mockReadStream = new Readable({
                read() {
                    this.push('encrypted data');
                    this.push(null);
                }
            });

            const mockWriteStream = new Writable({
                write(chunk, encoding, callback) {
                    callback();
                },
                final(callback) {
                    callback();
                }
            });

            vi.mocked(fs.createReadStream).mockReturnValue(mockReadStream as any);
            vi.mocked(fs.createWriteStream).mockReturnValue(mockWriteStream as any);

            const result = await encryption.decryptFile('/tmp/test.enc', '/tmp/test.txt', 'password123');

            expect(result).toBeDefined();
            expect(mockDecipher.setAuthTag).toHaveBeenCalledWith(mockAuthTag);
            expect(crypto.createDecipheriv).toHaveBeenCalled();
        });

        it('should throw error on invalid password', async () => {
            const headerBuffer = Buffer.alloc(73);
            headerBuffer.write('MSBKUP01', 0);
            headerBuffer.writeUInt8(1, 8);

            const mockFileHandle = {
                read: vi.fn().mockResolvedValue({ bytesRead: 73, buffer: headerBuffer }),
                close: vi.fn().mockResolvedValue(undefined),
            };
            vi.mocked(fsPromises.open).mockResolvedValue(mockFileHandle as any);

            vi.mocked(crypto.pbkdf2).mockImplementation((password, salt, iterations, keylen, digest, callback) => {
                callback(null, Buffer.from('wrong-key'));
            });

            const mockDecipher = {
                setAuthTag: vi.fn(),
                update: vi.fn(),
                final: vi.fn().mockImplementation(() => {
                    throw new Error('Unsupported state or unable to authenticate data');
                }),
            };

            vi.mocked(crypto.createDecipheriv).mockReturnValue(mockDecipher as any);

            const mockReadStream = new Readable({
                read() {
                    this.push(null);
                }
            });

            vi.mocked(fs.createReadStream).mockReturnValue(mockReadStream as any);

            await expect(
                encryption.decryptFile('/tmp/test.enc', '/tmp/test.txt', 'wrong-password')
            ).rejects.toThrow();

            expect(fsPromises.unlink).toHaveBeenCalledWith('/tmp/test.txt');
        });

        it('should throw error on invalid file format', async () => {
            const headerBuffer = Buffer.alloc(73);
            headerBuffer.write('INVALID!', 0); // Wrong magic bytes

            const mockFileHandle = {
                read: vi.fn().mockResolvedValue({ bytesRead: 73, buffer: headerBuffer }),
                close: vi.fn().mockResolvedValue(undefined),
            };
            vi.mocked(fsPromises.open).mockResolvedValue(mockFileHandle as any);

            await expect(
                encryption.decryptFile('/tmp/test.enc', '/tmp/test.txt', 'password123')
            ).rejects.toThrow();
        });
    });

    describe('verifyPassword', () => {
        it('should return true for correct password', async () => {
            const mockSalt = Buffer.from('mock-salt-32-bytes-long-string!!');
            const mockIv = Buffer.from('mock-iv-16-bytes!');
            const mockAuthTag = Buffer.from('mock-auth-tag-16!');

            const headerBuffer = Buffer.alloc(73);
            headerBuffer.write('MSBKUP01', 0);
            headerBuffer.writeUInt8(1, 8);
            mockSalt.copy(headerBuffer, 9);
            mockIv.copy(headerBuffer, 41);
            mockAuthTag.copy(headerBuffer, 57);

            const mockFileHandle = {
                read: vi.fn().mockResolvedValue({ bytesRead: 73, buffer: headerBuffer }),
                close: vi.fn().mockResolvedValue(undefined),
            };
            vi.mocked(fsPromises.open).mockResolvedValue(mockFileHandle as any);

            vi.mocked(crypto.pbkdf2).mockImplementation((password, salt, iterations, keylen, digest, callback) => {
                callback(null, Buffer.from('correct-key'));
            });

            const mockDecipher = {
                setAuthTag: vi.fn(),
                update: vi.fn(),
                final: vi.fn(),
                pipe: vi.fn().mockReturnThis(),
                on: vi.fn(),
                once: vi.fn(),
            };

            vi.mocked(crypto.createDecipheriv).mockReturnValue(mockDecipher as any);

            const mockReadStream = new Readable({
                read() {
                    this.push('test');
                    this.push(null);
                }
            });

            vi.mocked(fs.createReadStream).mockReturnValue(mockReadStream as any);

            const result = await encryption.verifyPassword('/tmp/test.enc', 'correct-password');
            expect(result).toBe(true);
        });

        it('should return false for incorrect password', async () => {
            const mockFileHandle = {
                read: vi.fn().mockRejectedValue(new Error('Read failed')),
                close: vi.fn().mockResolvedValue(undefined),
            };
            vi.mocked(fsPromises.open).mockResolvedValue(mockFileHandle as any);

            const result = await encryption.verifyPassword('/tmp/test.enc', 'wrong-password');
            expect(result).toBe(false);
        });
    });

    describe('getEncryptionInfo', () => {
        it('should return encryption algorithm details', () => {
            const info = encryption.getEncryptionInfo();

            expect(info).toBeDefined();
            expect(info.algorithm).toBe('aes-256-gcm');
            expect(info.keyLength).toBe(32);
            expect(info.iterations).toBe(100_000);
            expect(info.digest).toBe('sha256');
        });
    });
});

describe('Local Adapter', () => {
    let adapter: LocalAdapter;

    beforeEach(() => {
        vi.clearAllMocks();
        adapter = new LocalAdapter({ type: 'local', path: '/tmp/backups' });
    });

    describe('upload', () => {
        it('should upload file to local destination', async () => {
            vi.mocked(fsPromises.mkdir).mockResolvedValue(undefined);
            vi.mocked(fsPromises.stat).mockResolvedValue({ size: 1024 } as any);
            vi.mocked(fsPromises.copyFile).mockResolvedValue(undefined);

            const progressCallback = vi.fn();
            await adapter.upload('/tmp/source.tar.gz', 'backup-123.tar.gz', progressCallback);

            expect(fsPromises.mkdir).toHaveBeenCalled();
            expect(fsPromises.copyFile).toHaveBeenCalledWith(
                '/tmp/source.tar.gz',
                expect.stringContaining('backup-123.tar.gz')
            );
            expect(progressCallback).toHaveBeenCalledWith(
                expect.objectContaining({ percentage: 100 })
            );
        });

        it('should throw error on upload failure', async () => {
            vi.mocked(fsPromises.copyFile).mockRejectedValue(new Error('Permission denied'));

            await expect(
                adapter.upload('/tmp/source.tar.gz', 'backup-123.tar.gz')
            ).rejects.toThrow('Failed to upload to local destination');
        });
    });

    describe('download', () => {
        it('should download file from local destination', async () => {
            vi.mocked(fsPromises.mkdir).mockResolvedValue(undefined);
            vi.mocked(fsPromises.stat).mockResolvedValue({ size: 2048 } as any);
            vi.mocked(fsPromises.copyFile).mockResolvedValue(undefined);

            const progressCallback = vi.fn();
            await adapter.download('backup-123.tar.gz', '/tmp/target.tar.gz', progressCallback);

            expect(fsPromises.copyFile).toHaveBeenCalledWith(
                expect.stringContaining('backup-123.tar.gz'),
                '/tmp/target.tar.gz'
            );
            expect(progressCallback).toHaveBeenCalledWith(
                expect.objectContaining({ percentage: 100 })
            );
        });

        it('should throw error on download failure', async () => {
            vi.mocked(fsPromises.stat).mockRejectedValue(new Error('File not found'));

            await expect(
                adapter.download('missing.tar.gz', '/tmp/target.tar.gz')
            ).rejects.toThrow('Failed to download from local destination');
        });
    });

    describe('list', () => {
        it('should list backup files in destination', async () => {
            vi.mocked(fsPromises.mkdir).mockResolvedValue(undefined);
            vi.mocked(fsPromises.readdir).mockResolvedValue([
                { name: 'backup-123.tar.gz', isFile: () => true, isDirectory: () => false } as any,
                { name: 'backup-456.enc', isFile: () => true, isDirectory: () => false } as any,
                { name: 'other.txt', isFile: () => true, isDirectory: () => false } as any,
            ]);

            vi.mocked(fsPromises.stat).mockImplementation(async (path) => ({
                size: 1024,
                mtime: new Date('2024-01-01'),
            } as any));

            const files = await adapter.list();

            expect(files).toHaveLength(2); // Only .tar.gz and .enc files
            expect(files[0].name).toContain('backup-');
            expect(files[0].size).toBe(1024);
            expect(files[0].id).toBeDefined();
        });

        it('should return empty array when no backups found', async () => {
            vi.mocked(fsPromises.mkdir).mockResolvedValue(undefined);
            vi.mocked(fsPromises.readdir).mockResolvedValue([]);

            const files = await adapter.list();
            expect(files).toHaveLength(0);
        });

        it('should throw error on list failure', async () => {
            vi.mocked(fsPromises.readdir).mockRejectedValue(new Error('Permission denied'));

            await expect(adapter.list()).rejects.toThrow('Failed to list local backups');
        });
    });

    describe('delete', () => {
        it('should delete file from local destination', async () => {
            vi.mocked(fsPromises.unlink).mockResolvedValue(undefined);

            await adapter.delete('backup-123.tar.gz');

            expect(fsPromises.unlink).toHaveBeenCalledWith(
                expect.stringContaining('backup-123.tar.gz')
            );
        });

        it('should throw error on delete failure', async () => {
            vi.mocked(fsPromises.unlink).mockRejectedValue(new Error('File not found'));

            await expect(adapter.delete('missing.tar.gz')).rejects.toThrow('Failed to delete local backup');
        });
    });

    describe('testConnection', () => {
        it('should return true for accessible path', async () => {
            vi.mocked(fsPromises.mkdir).mockResolvedValue(undefined);

            const mockWriteStream = new Writable({
                write(chunk, encoding, callback) {
                    callback();
                }
            });
            mockWriteStream.end = vi.fn((data, callback?: any) => {
                if (typeof callback === 'function') callback();
                setTimeout(() => mockWriteStream.emit('finish'), 0);
                return mockWriteStream;
            }) as any;

            vi.mocked(fs.createWriteStream).mockReturnValue(mockWriteStream as any);
            vi.mocked(fsPromises.unlink).mockResolvedValue(undefined);

            const result = await adapter.testConnection();
            expect(result).toBe(true);
        });

        it('should return false for inaccessible path', async () => {
            vi.mocked(fsPromises.mkdir).mockRejectedValue(new Error('Permission denied'));

            const result = await adapter.testConnection();
            expect(result).toBe(false);
        });
    });
});
