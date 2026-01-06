/**
 * Encryption Utilities
 * AES-256-GCM encryption for backup archives with PBKDF2 key derivation
 */

import {
    createCipheriv,
    createDecipheriv,
    pbkdf2,
    randomBytes,
} from 'crypto';
import { createReadStream, createWriteStream } from 'fs';
import { unlink } from 'fs/promises';
import { pipeline } from 'stream/promises';
import { createLogger } from './logger.js';
import { getErrorMessage } from './errors.js';

const logger = createLogger('encryption');

// Encryption constants
const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32; // 256 bits
const IV_LENGTH = 16; // 128 bits
const SALT_LENGTH = 32; // 256 bits
const AUTH_TAG_LENGTH = 16; // 128 bits
const PBKDF2_ITERATIONS = 100_000;
const PBKDF2_DIGEST = 'sha256';

// File header for encrypted files
const HEADER_MAGIC = Buffer.from('MSBKUP01', 'utf8'); // Media Stack Backup v1
const HEADER_VERSION = 1;

interface EncryptionMetadata {
    algorithm: string;
    salt: Buffer;
    iv: Buffer;
    authTag: Buffer;
}

/**
 * Derive encryption key from password using PBKDF2
 */
async function deriveKey(password: string, salt: Buffer): Promise<Buffer> {
    return new Promise((resolve, reject) => {
        pbkdf2(password, salt, PBKDF2_ITERATIONS, KEY_LENGTH, PBKDF2_DIGEST, (err, derivedKey) => {
            if (err) {
                reject(err);
            } else {
                resolve(derivedKey);
            }
        });
    });
}

/**
 * Write encryption metadata header to file
 */
function writeHeader(metadata: EncryptionMetadata): Buffer {
    const header = Buffer.allocUnsafe(
        HEADER_MAGIC.length +
        1 + // version byte
        SALT_LENGTH +
        IV_LENGTH +
        AUTH_TAG_LENGTH
    );

    let offset = 0;

    // Magic bytes
    HEADER_MAGIC.copy(header, offset);
    offset += HEADER_MAGIC.length;

    // Version
    header.writeUInt8(HEADER_VERSION, offset);
    offset += 1;

    // Salt
    metadata.salt.copy(header, offset);
    offset += SALT_LENGTH;

    // IV
    metadata.iv.copy(header, offset);
    offset += IV_LENGTH;

    // Auth tag (placeholder, will be updated after encryption)
    metadata.authTag.copy(header, offset);

    return header;
}

/**
 * Read encryption metadata header from file
 */
function readHeader(headerBuffer: Buffer): EncryptionMetadata {
    let offset = 0;

    // Verify magic bytes
    const magic = headerBuffer.subarray(offset, offset + HEADER_MAGIC.length);
    offset += HEADER_MAGIC.length;

    if (!magic.equals(HEADER_MAGIC)) {
        throw new Error('Invalid encrypted file format: magic bytes mismatch');
    }

    // Verify version
    const version = headerBuffer.readUInt8(offset);
    offset += 1;

    if (version !== HEADER_VERSION) {
        throw new Error(`Unsupported encryption version: ${version}`);
    }

    // Read salt
    const salt = headerBuffer.subarray(offset, offset + SALT_LENGTH);
    offset += SALT_LENGTH;

    // Read IV
    const iv = headerBuffer.subarray(offset, offset + IV_LENGTH);
    offset += IV_LENGTH;

    // Read auth tag
    const authTag = headerBuffer.subarray(offset, offset + AUTH_TAG_LENGTH);

    return {
        algorithm: ALGORITHM,
        salt: Buffer.from(salt),
        iv: Buffer.from(iv),
        authTag: Buffer.from(authTag),
    };
}

/**
 * Encrypt a file with password-based encryption
 *
 * @param inputPath - Path to file to encrypt
 * @param outputPath - Path to write encrypted file
 * @param password - Encryption password
 * @returns Encryption metadata
 */
export async function encryptFile(
    inputPath: string,
    outputPath: string,
    password: string
): Promise<EncryptionMetadata> {
    logger.info({ inputPath, outputPath }, 'Starting file encryption');

    try {
        // Generate random salt and IV
        const salt = randomBytes(SALT_LENGTH);
        const iv = randomBytes(IV_LENGTH);

        // Derive encryption key from password
        const key = await deriveKey(password, salt);

        // Create cipher
        const cipher = createCipheriv(ALGORITHM, key, iv);

        // Prepare metadata (authTag will be set after encryption)
        const metadata: EncryptionMetadata = {
            algorithm: ALGORITHM,
            salt,
            iv,
            authTag: Buffer.alloc(AUTH_TAG_LENGTH),
        };

        // Write header (with placeholder authTag)
        const header = writeHeader(metadata);
        const outputStream = createWriteStream(outputPath);
        outputStream.write(header);

        // Create read stream and encrypt
        const inputStream = createReadStream(inputPath);

        // Pipe through cipher and write to output
        await pipeline(inputStream, cipher, outputStream);

        // Get auth tag after encryption completes
        metadata.authTag = cipher.getAuthTag();

        // Update header with real auth tag
        const fs = await import('fs');
        const fd = await fs.promises.open(outputPath, 'r+');
        try {
            const authTagOffset = HEADER_MAGIC.length + 1 + SALT_LENGTH + IV_LENGTH;
            await fd.write(metadata.authTag, 0, AUTH_TAG_LENGTH, authTagOffset);
        } finally {
            await fd.close();
        }

        logger.info({ outputPath }, 'File encryption completed');

        return metadata;
    } catch (error) {
        const message = getErrorMessage(error);
        logger.error({ error: message, inputPath, outputPath }, 'File encryption failed');

        // Clean up partial encrypted file on error
        try {
            await unlink(outputPath);
        } catch {
            // Ignore cleanup errors
        }

        throw new Error(`Encryption failed: ${message}`);
    }
}

/**
 * Decrypt an encrypted file
 *
 * @param inputPath - Path to encrypted file
 * @param outputPath - Path to write decrypted file
 * @param password - Decryption password
 * @returns Decryption metadata
 */
export async function decryptFile(
    inputPath: string,
    outputPath: string,
    password: string
): Promise<EncryptionMetadata> {
    logger.info({ inputPath, outputPath }, 'Starting file decryption');

    try {
        // Read header
        const fs = await import('fs');
        const fd = await fs.promises.open(inputPath, 'r');
        const headerSize = HEADER_MAGIC.length + 1 + SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH;
        const headerBuffer = Buffer.allocUnsafe(headerSize);

        try {
            await fd.read(headerBuffer, 0, headerSize, 0);
        } finally {
            await fd.close();
        }

        // Parse metadata from header
        const metadata = readHeader(headerBuffer);

        // Derive decryption key from password
        const key = await deriveKey(password, metadata.salt);

        // Create decipher
        const decipher = createDecipheriv(ALGORITHM, key, metadata.iv);
        decipher.setAuthTag(metadata.authTag);

        // Create read stream (skip header) and decrypt
        const inputStream = createReadStream(inputPath, { start: headerSize });
        const outputStream = createWriteStream(outputPath);

        // Pipe through decipher and write to output
        await pipeline(inputStream, decipher, outputStream);

        logger.info({ outputPath }, 'File decryption completed');

        return metadata;
    } catch (error) {
        const message = getErrorMessage(error);
        logger.error({ error: message, inputPath, outputPath }, 'File decryption failed');

        // Clean up partial decrypted file on error
        try {
            await unlink(outputPath);
        } catch {
            // Ignore cleanup errors
        }

        // Check for authentication failure
        if (message.includes('Unsupported state') || message.includes('auth')) {
            throw new Error('Decryption failed: Invalid password or corrupted file');
        }

        throw new Error(`Decryption failed: ${message}`);
    }
}

/**
 * Verify that a password can decrypt an encrypted file
 * Tests decryption without writing the full output
 *
 * @param inputPath - Path to encrypted file
 * @param password - Password to test
 * @returns True if password is correct
 */
export async function verifyPassword(
    inputPath: string,
    password: string
): Promise<boolean> {
    logger.debug({ inputPath }, 'Verifying decryption password');

    try {
        // Read header
        const fs = await import('fs');
        const fd = await fs.promises.open(inputPath, 'r');
        const headerSize = HEADER_MAGIC.length + 1 + SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH;
        const headerBuffer = Buffer.allocUnsafe(headerSize);

        try {
            await fd.read(headerBuffer, 0, headerSize, 0);
        } finally {
            await fd.close();
        }

        // Parse metadata
        const metadata = readHeader(headerBuffer);

        // Derive key
        const key = await deriveKey(password, metadata.salt);

        // Create decipher with auth tag
        const decipher = createDecipheriv(ALGORITHM, key, metadata.iv);
        decipher.setAuthTag(metadata.authTag);

        // Try to decrypt a small chunk
        const inputStream = createReadStream(inputPath, {
            start: headerSize,
            end: headerSize + 1024 // Read just 1KB
        });

        // Test decryption
        await pipeline(inputStream, decipher);

        logger.debug({ inputPath }, 'Password verification successful');
        return true;
    } catch (error) {
        const message = getErrorMessage(error);
        logger.debug({ error: message, inputPath }, 'Password verification failed');
        return false;
    }
}

/**
 * Get encryption algorithm info
 */
export function getEncryptionInfo() {
    return {
        algorithm: ALGORITHM,
        keyLength: KEY_LENGTH,
        iterations: PBKDF2_ITERATIONS,
        digest: PBKDF2_DIGEST,
    };
}
