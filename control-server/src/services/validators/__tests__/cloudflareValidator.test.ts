import { describe, it, expect, vi, beforeEach } from 'vitest';
import { validateCloudflare } from '../cloudflareValidator.js';

// Mock fetch for connectivity tests
global.fetch = vi.fn();

describe('cloudflareValidator', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('validateCloudflare - Token Format', () => {
        it('should pass validation for valid Cloudflare tunnel token', async () => {
            // Valid JWT token (header.payload.signature)
            const validToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhIjoiYWNjb3VudF9pZCIsInQiOiJ0dW5uZWxfaWQiLCJzIjoic2VjcmV0In0.signature123';

            const result = await validateCloudflare({
                tunnelToken: validToken,
                testConnectivity: false
            });

            expect(result.validator).toBe('cloudflare');
            expect(result.passed).toBe(true);
            expect(result.issues).toHaveLength(0);
        });

        it('should fail when token is missing', async () => {
            const result = await validateCloudflare({
                tunnelToken: '',
                testConnectivity: false
            });

            expect(result.passed).toBe(false);
            expect(result.issues.some(i => i.code === 'CLOUDFLARE_TOKEN_MISSING')).toBe(true);
            const tokenIssue = result.issues.find(i => i.code === 'CLOUDFLARE_TOKEN_MISSING');
            expect(tokenIssue?.severity).toBe('error');
            expect(tokenIssue?.affectedField).toBe('tunnelToken');
        });

        it('should fail when token does not start with eyJ', async () => {
            const result = await validateCloudflare({
                tunnelToken: 'invalid-token-format',
                testConnectivity: false
            });

            expect(result.passed).toBe(false);
            expect(result.issues.some(i => i.code === 'CLOUDFLARE_TOKEN_INVALID_FORMAT')).toBe(true);
            const formatIssue = result.issues.find(i => i.code === 'CLOUDFLARE_TOKEN_INVALID_FORMAT');
            expect(formatIssue?.severity).toBe('error');
        });

        it('should fail when token does not have three parts', async () => {
            const result = await validateCloudflare({
                tunnelToken: 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0', // Missing signature
                testConnectivity: false
            });

            expect(result.passed).toBe(false);
            expect(result.issues.some(i => i.code === 'CLOUDFLARE_TOKEN_INVALID_STRUCTURE')).toBe(true);
        });

        it('should fail when token cannot be decoded', async () => {
            const result = await validateCloudflare({
                tunnelToken: 'eyJ!!!invalid!!!.eyJ!!!invalid!!!.signature',
                testConnectivity: false
            });

            expect(result.passed).toBe(false);
            expect(result.issues.some(i => i.code === 'CLOUDFLARE_TOKEN_DECODE_FAILED')).toBe(true);
        });

        it('should fail when token is missing required fields', async () => {
            // Token without required Cloudflare fields (a, t, s)
            const tokenWithoutFields = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIn0.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';

            const result = await validateCloudflare({
                tunnelToken: tokenWithoutFields,
                testConnectivity: false
            });

            expect(result.passed).toBe(false);
            expect(result.issues.some(i => i.code === 'CLOUDFLARE_TOKEN_MISSING_FIELDS')).toBe(true);
        });

        it('should warn when token is close to expiration', async () => {
            // Create token that expires in 3 days
            const threeDaysFromNow = Math.floor(Date.now() / 1000) + (3 * 24 * 60 * 60);
            const payload = {
                a: 'account_id',
                t: 'tunnel_id',
                s: 'secret',
                exp: threeDaysFromNow
            };
            const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64')
                .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
            const tokenWithExpiration = `eyJhbGciOiJIUzI1NiJ9.${encodedPayload}.signature`;

            const result = await validateCloudflare({
                tunnelToken: tokenWithExpiration,
                testConnectivity: false
            });

            expect(result.passed).toBe(true); // Warning doesn't fail validation
            expect(result.issues.some(i => i.code === 'CLOUDFLARE_TOKEN_EXPIRING_SOON')).toBe(true);
            const expirationIssue = result.issues.find(i => i.code === 'CLOUDFLARE_TOKEN_EXPIRING_SOON');
            expect(expirationIssue?.severity).toBe('warning');
        });

        it('should fail when token is expired', async () => {
            // Create token that expired yesterday
            const yesterday = Math.floor(Date.now() / 1000) - (24 * 60 * 60);
            const payload = {
                a: 'account_id',
                t: 'tunnel_id',
                s: 'secret',
                exp: yesterday
            };
            const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64')
                .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
            const expiredToken = `eyJhbGciOiJIUzI1NiJ9.${encodedPayload}.signature`;

            const result = await validateCloudflare({
                tunnelToken: expiredToken,
                testConnectivity: false
            });

            expect(result.passed).toBe(false);
            expect(result.issues.some(i => i.code === 'CLOUDFLARE_TOKEN_EXPIRED')).toBe(true);
            const expiredIssue = result.issues.find(i => i.code === 'CLOUDFLARE_TOKEN_EXPIRED');
            expect(expiredIssue?.severity).toBe('error');
        });
    });

    describe('validateCloudflare - Connectivity', () => {
        it('should test connectivity when testConnectivity is true', async () => {
            const validToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhIjoiYWNjb3VudF9pZCIsInQiOiJ0dW5uZWxfaWQiLCJzIjoic2VjcmV0In0.signature123';

            // Mock successful fetch
            vi.mocked(fetch).mockResolvedValue({
                ok: true,
                status: 200
            } as Response);

            const result = await validateCloudflare({
                tunnelToken: validToken,
                testConnectivity: true
            });

            expect(result.passed).toBe(true);
            expect(fetch).toHaveBeenCalledWith(
                expect.stringContaining('cloudflare.com'),
                expect.objectContaining({ signal: expect.any(AbortSignal) })
            );
        });

        it('should warn when connectivity test fails', async () => {
            const validToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhIjoiYWNjb3VudF9pZCIsInQiOiJ0dW5uZWxfaWQiLCJzIjoic2VjcmV0In0.signature123';

            // Mock failed fetch
            vi.mocked(fetch).mockRejectedValue(new Error('Network error'));

            const result = await validateCloudflare({
                tunnelToken: validToken,
                testConnectivity: true
            });

            expect(result.passed).toBe(true); // Connectivity failure is a warning
            expect(result.issues.some(i => i.code === 'CLOUDFLARE_CONNECTIVITY_FAILED')).toBe(true);
            const connectivityIssue = result.issues.find(i => i.code === 'CLOUDFLARE_CONNECTIVITY_FAILED');
            expect(connectivityIssue?.severity).toBe('warning');
        });

        it('should skip connectivity test when testConnectivity is false', async () => {
            const validToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhIjoiYWNjb3VudF9pZCIsInQiOiJ0dW5uZWxfaWQiLCJzIjoic2VjcmV0In0.signature123';

            const result = await validateCloudflare({
                tunnelToken: validToken,
                testConnectivity: false
            });

            expect(result.passed).toBe(true);
            expect(fetch).not.toHaveBeenCalled();
        });

        it('should handle connectivity timeout', async () => {
            const validToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhIjoiYWNjb3VudF9pZCIsInQiOiJ0dW5uZWxfaWQiLCJzIjoic2VjcmV0In0.signature123';

            // Mock timeout error
            vi.mocked(fetch).mockRejectedValue(new Error('The operation was aborted'));

            const result = await validateCloudflare({
                tunnelToken: validToken,
                testConnectivity: true
            });

            expect(result.passed).toBe(true); // Timeout is a warning
            expect(result.issues.some(i => i.code === 'CLOUDFLARE_CONNECTIVITY_FAILED')).toBe(true);
        });
    });

    describe('validateCloudflare - Metadata', () => {
        it('should include metadata in result', async () => {
            const validToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhIjoiYWNjb3VudF9pZCIsInQiOiJ0dW5uZWxfaWQiLCJzIjoic2VjcmV0In0.signature123';

            const result = await validateCloudflare({
                tunnelToken: validToken,
                testConnectivity: false
            });

            expect(result.metadata).toBeDefined();
            expect(result.metadata?.testedConnectivity).toBe(false);
            expect(result.metadata?.durationMs).toBeGreaterThanOrEqual(0);
        });

        it('should indicate when connectivity was tested in metadata', async () => {
            const validToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhIjoiYWNjb3VudF9pZCIsInQiOiJ0dW5uZWxfaWQiLCJzIjoic2VjcmV0In0.signature123';

            vi.mocked(fetch).mockResolvedValue({
                ok: true,
                status: 200
            } as Response);

            const result = await validateCloudflare({
                tunnelToken: validToken,
                testConnectivity: true
            });

            expect(result.metadata?.testedConnectivity).toBe(true);
        });
    });
});
