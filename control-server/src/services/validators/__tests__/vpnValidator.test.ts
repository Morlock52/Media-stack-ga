import { describe, it, expect, vi, beforeEach } from 'vitest';
import { validateVPN } from '../vpnValidator.js';

describe('vpnValidator', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('validateVPN - WireGuard', () => {
        it('should pass validation for valid WireGuard credentials', async () => {
            const result = await validateVPN({
                provider: 'mullvad',
                type: 'wireguard',
                credentials: {
                    privateKey: 'aBcDeFgHiJkLmNoPqRsTuVwXyZ0123456789+/A=',
                    publicKey: 'xYzAbCdEfGhIjKlMnOpQrStUvWxYz0123456789+/=',
                    addresses: '10.13.13.2/32',
                    endpointIp: '192.168.1.1',
                    endpointPort: '51820'
                }
            });

            expect(result.validator).toBe('vpn');
            expect(result.passed).toBe(true);
            expect(result.issues).toHaveLength(0);
        });

        it('should fail when WireGuard private key is missing', async () => {
            const result = await validateVPN({
                provider: 'mullvad',
                type: 'wireguard',
                credentials: {
                    addresses: '10.13.13.2/32'
                }
            });

            expect(result.passed).toBe(false);
            expect(result.issues.some(i => i.code === 'VPN_KEY_MISSING')).toBe(true);
            const keyIssue = result.issues.find(i => i.code === 'VPN_KEY_MISSING');
            expect(keyIssue?.severity).toBe('error');
            expect(keyIssue?.affectedField).toBe('privateKey');
        });

        it('should fail when WireGuard private key has invalid length', async () => {
            const result = await validateVPN({
                provider: 'mullvad',
                type: 'wireguard',
                credentials: {
                    privateKey: 'tooshort',
                    addresses: '10.13.13.2/32'
                }
            });

            expect(result.passed).toBe(false);
            expect(result.issues.some(i => i.code === 'VPN_KEY_INVALID_LENGTH')).toBe(true);
            const lengthIssue = result.issues.find(i => i.code === 'VPN_KEY_INVALID_LENGTH');
            expect(lengthIssue?.severity).toBe('error');
            expect(lengthIssue?.details?.expectedLength).toBe(44);
        });

        it('should fail when WireGuard private key has invalid format', async () => {
            const result = await validateVPN({
                provider: 'mullvad',
                type: 'wireguard',
                credentials: {
                    privateKey: 'invalid!@#$%^&*()_+characters_here!!!==',
                    addresses: '10.13.13.2/32'
                }
            });

            expect(result.passed).toBe(false);
            expect(result.issues.some(i => i.code === 'VPN_KEY_INVALID_FORMAT')).toBe(true);
        });

        it('should fail when WireGuard addresses are missing', async () => {
            const result = await validateVPN({
                provider: 'mullvad',
                type: 'wireguard',
                credentials: {
                    privateKey: 'aBcDeFgHiJkLmNoPqRsTuVwXyZ0123456789+/A='
                }
            });

            expect(result.passed).toBe(false);
            expect(result.issues.some(i => i.code === 'VPN_ADDRESSES_MISSING')).toBe(true);
        });

        it('should fail when WireGuard addresses have invalid CIDR format', async () => {
            const result = await validateVPN({
                provider: 'mullvad',
                type: 'wireguard',
                credentials: {
                    privateKey: 'aBcDeFgHiJkLmNoPqRsTuVwXyZ0123456789+/A=',
                    addresses: '10.13.13.2' // Missing /32 suffix
                }
            });

            expect(result.passed).toBe(false);
            expect(result.issues.some(i => i.code === 'VPN_ADDRESSES_INVALID_FORMAT')).toBe(true);
        });

        it('should accept valid IPv6 CIDR addresses', async () => {
            const result = await validateVPN({
                provider: 'mullvad',
                type: 'wireguard',
                credentials: {
                    privateKey: 'aBcDeFgHiJkLmNoPqRsTuVwXyZ0123456789+/A=',
                    addresses: 'fc00:bbbb:bbbb:bb01::2/128'
                }
            });

            expect(result.passed).toBe(true);
            expect(result.issues).toHaveLength(0);
        });

        it('should accept comma-separated addresses', async () => {
            const result = await validateVPN({
                provider: 'mullvad',
                type: 'wireguard',
                credentials: {
                    privateKey: 'aBcDeFgHiJkLmNoPqRsTuVwXyZ0123456789+/A=',
                    addresses: '10.13.13.2/32,fc00:bbbb:bbbb:bb01::2/128'
                }
            });

            expect(result.passed).toBe(true);
            expect(result.issues).toHaveLength(0);
        });

        it('should validate endpoint IP when provided', async () => {
            const result = await validateVPN({
                provider: 'mullvad',
                type: 'wireguard',
                credentials: {
                    privateKey: 'aBcDeFgHiJkLmNoPqRsTuVwXyZ0123456789+/A=',
                    addresses: '10.13.13.2/32',
                    endpointIp: 'invalid-ip'
                }
            });

            expect(result.passed).toBe(false);
            expect(result.issues.some(i => i.code === 'VPN_ENDPOINT_IP_INVALID')).toBe(true);
        });

        it('should validate endpoint port when provided', async () => {
            const result = await validateVPN({
                provider: 'mullvad',
                type: 'wireguard',
                credentials: {
                    privateKey: 'aBcDeFgHiJkLmNoPqRsTuVwXyZ0123456789+/A=',
                    addresses: '10.13.13.2/32',
                    endpointIp: '192.168.1.1',
                    endpointPort: '99999' // Invalid port
                }
            });

            expect(result.passed).toBe(false);
            expect(result.issues.some(i => i.code === 'VPN_ENDPOINT_PORT_INVALID')).toBe(true);
        });

        it('should accept optional preshared key with correct format', async () => {
            const result = await validateVPN({
                provider: 'mullvad',
                type: 'wireguard',
                credentials: {
                    privateKey: 'aBcDeFgHiJkLmNoPqRsTuVwXyZ0123456789+/A=',
                    addresses: '10.13.13.2/32',
                    presharedKey: 'xYzAbCdEfGhIjKlMnOpQrStUvWxYz0123456789+/='
                }
            });

            expect(result.passed).toBe(true);
            expect(result.issues).toHaveLength(0);
        });
    });

    describe('validateVPN - OpenVPN', () => {
        it('should pass validation for valid OpenVPN credentials', async () => {
            const result = await validateVPN({
                provider: 'nordvpn',
                type: 'openvpn',
                credentials: {
                    username: 'user123',
                    password: 'pass456'
                }
            });

            expect(result.validator).toBe('vpn');
            expect(result.passed).toBe(true);
            expect(result.issues).toHaveLength(0);
        });

        it('should fail when OpenVPN username is missing', async () => {
            const result = await validateVPN({
                provider: 'nordvpn',
                type: 'openvpn',
                credentials: {
                    password: 'pass456'
                }
            });

            expect(result.passed).toBe(false);
            expect(result.issues.some(i => i.code === 'VPN_USERNAME_MISSING')).toBe(true);
        });

        it('should fail when OpenVPN password is missing', async () => {
            const result = await validateVPN({
                provider: 'nordvpn',
                type: 'openvpn',
                credentials: {
                    username: 'user123'
                }
            });

            expect(result.passed).toBe(false);
            expect(result.issues.some(i => i.code === 'VPN_PASSWORD_MISSING')).toBe(true);
        });

        it('should fail when OpenVPN username is too short', async () => {
            const result = await validateVPN({
                provider: 'nordvpn',
                type: 'openvpn',
                credentials: {
                    username: 'ab',
                    password: 'pass456'
                }
            });

            expect(result.passed).toBe(false);
            expect(result.issues.some(i => i.code === 'VPN_USERNAME_TOO_SHORT')).toBe(true);
        });

        it('should fail when OpenVPN password is too short', async () => {
            const result = await validateVPN({
                provider: 'nordvpn',
                type: 'openvpn',
                credentials: {
                    username: 'user123',
                    password: 'ab'
                }
            });

            expect(result.passed).toBe(false);
            expect(result.issues.some(i => i.code === 'VPN_PASSWORD_TOO_SHORT')).toBe(true);
        });
    });

    describe('validateVPN - Provider', () => {
        it('should warn when using unknown VPN provider', async () => {
            const result = await validateVPN({
                provider: 'unknown-provider',
                type: 'wireguard',
                credentials: {
                    privateKey: 'aBcDeFgHiJkLmNoPqRsTuVwXyZ0123456789+/A=',
                    addresses: '10.13.13.2/32'
                }
            });

            expect(result.passed).toBe(true); // Warning doesn't fail validation
            expect(result.issues.some(i => i.code === 'VPN_PROVIDER_UNKNOWN')).toBe(true);
            const providerIssue = result.issues.find(i => i.code === 'VPN_PROVIDER_UNKNOWN');
            expect(providerIssue?.severity).toBe('warning');
        });

        it('should accept known VPN providers', async () => {
            const knownProviders = ['mullvad', 'nordvpn', 'expressvpn', 'surfshark'];

            for (const provider of knownProviders) {
                const result = await validateVPN({
                    provider,
                    type: 'wireguard',
                    credentials: {
                        privateKey: 'aBcDeFgHiJkLmNoPqRsTuVwXyZ0123456789+/A=',
                        addresses: '10.13.13.2/32'
                    }
                });

                expect(result.issues.every(i => i.code !== 'VPN_PROVIDER_UNKNOWN')).toBe(true);
            }
        });
    });

    describe('validateVPN - Metadata', () => {
        it('should include metadata in result', async () => {
            const result = await validateVPN({
                provider: 'mullvad',
                type: 'wireguard',
                credentials: {
                    privateKey: 'aBcDeFgHiJkLmNoPqRsTuVwXyZ0123456789+/A=',
                    addresses: '10.13.13.2/32'
                }
            });

            expect(result.metadata).toBeDefined();
            expect(result.metadata?.provider).toBe('mullvad');
            expect(result.metadata?.type).toBe('wireguard');
            expect(result.metadata?.durationMs).toBeGreaterThanOrEqual(0);
        });
    });
});
