import { describe, it, expect, vi, beforeEach } from 'vitest'
import { generateEnvFile } from './generateEnvFile'
import { DEFAULT_DATA_ROOT } from '../data/storagePlan'
import type { SetupConfig } from '../store/setupStore'

// Mock crypto.getRandomValues for deterministic tests
const mockGetRandomValues = vi.fn((array: Uint8Array) => {
  for (let i = 0; i < array.length; i++) {
    array[i] = i % 256
  }
  return array
})

beforeEach(() => {
  vi.stubGlobal('crypto', { getRandomValues: mockGetRandomValues })
})

const createMockConfig = (overrides: Partial<SetupConfig> = {}): SetupConfig => ({
  timezone: 'America/New_York',
  puid: '1000',
  pgid: '1000',
  domain: 'example.com',
  password: 'testpassword123',
  deploymentMode: 'local',
  cloudflareToken: '',
  plexClaim: '',
  wireguardPrivateKey: '',
  wireguardAddresses: '',
  storagePlan: undefined,
  serviceConfigs: {},
  ...overrides,
})

describe('generateEnvFile', () => {
  describe('general settings', () => {
    it('should include timezone, puid, pgid, and domain', () => {
      const config = createMockConfig()
      const result = generateEnvFile(config, ['plex'])

      expect(result).toContain('TIMEZONE=America/New_York')
      expect(result).toContain('PUID=1000')
      expect(result).toContain('PGID=1000')
      expect(result).toContain('DOMAIN=example.com')
    })

    it('should include COMPOSE_PROFILES with selected services', () => {
      const config = createMockConfig()
      const result = generateEnvFile(config, ['plex', 'arr', 'torrent'])

      expect(result).toContain('COMPOSE_PROFILES=plex,arr,torrent')
    })

    it('should deduplicate selected services', () => {
      const config = createMockConfig()
      const result = generateEnvFile(config, ['plex', 'plex', 'arr'])

      expect(result).toContain('COMPOSE_PROFILES=plex,arr')
    })
  })

  describe('storage paths', () => {
    it('should use default data root when no storage plan provided', () => {
      const config = createMockConfig()
      const result = generateEnvFile(config, ['plex'])

      expect(result).toContain(`DATA_ROOT=${DEFAULT_DATA_ROOT}`)
      expect(result).toContain(`CONFIG_ROOT=${DEFAULT_DATA_ROOT}/config`)
    })

    it('should include all media paths', () => {
      const config = createMockConfig()
      const result = generateEnvFile(config, ['plex'])

      expect(result).toContain('MOVIES_PATH=')
      expect(result).toContain('TV_SHOWS_PATH=')
      expect(result).toContain('MUSIC_PATH=')
      expect(result).toContain('BOOKS_PATH=')
      expect(result).toContain('AUDIOBOOKS_PATH=')
      expect(result).toContain('PHOTOS_PATH=')
      expect(result).toContain('TRANSCODE_PATH=')
      expect(result).toContain('DOWNLOADS_PATH=')
    })

    it('should use custom storage plan paths when provided', () => {
      const config = createMockConfig({
        storagePlan: {
          dataRoot: { path: '/custom/data', type: 'local' },
          movies: { path: '/nas/movies', type: 'network' },
        },
      })
      const result = generateEnvFile(config, ['plex'])

      expect(result).toContain('DATA_ROOT=/custom/data')
      expect(result).toContain('MOVIES_PATH=/nas/movies')
    })
  })

  describe('deployment modes', () => {
    it('should generate local deployment config', () => {
      const config = createMockConfig({ deploymentMode: 'local' })
      const result = generateEnvFile(config, ['plex'])

      expect(result).toContain('DEPLOYMENT_MODE=local')
      expect(result).toContain('TRAEFIK_DASHBOARD_PORT=8080')
      expect(result).toContain('TRAEFIK_HTTP_PORT=80')
      expect(result).toContain('TRAEFIK_HTTPS_PORT=443')
      expect(result).toContain('LOCAL_DOMAIN=example.com')
    })

    it('should include service URLs for local deployment', () => {
      const config = createMockConfig({ deploymentMode: 'local' })
      const result = generateEnvFile(config, ['plex'])

      expect(result).toContain('PLEX_URL=http://plex.local')
      expect(result).toContain('SONARR_URL=http://sonarr.local')
      expect(result).toContain('RADARR_URL=http://radarr.local')
    })

    it('should generate cloud deployment config', () => {
      const config = createMockConfig({
        deploymentMode: 'cloud',
        cloudflareToken: 'cf-token-123',
      })
      const result = generateEnvFile(config, ['plex'])

      expect(result).toContain('DEPLOYMENT_MODE=cloud')
      expect(result).toContain('CLOUDFLARE_TUNNEL_TOKEN=cf-token-123')
      expect(result).toContain('AUTHELIA_IDENTITY_VALIDATION_RESET_PASSWORD_JWT_SECRET=')
      expect(result).toContain('AUTHELIA_SESSION_SECRET=')
      expect(result).toContain('AUTHELIA_STORAGE_ENCRYPTION_KEY=')
    })
  })

  describe('database credentials', () => {
    it('should include PostgreSQL credentials', () => {
      const config = createMockConfig()
      const result = generateEnvFile(config, ['plex'])

      expect(result).toContain('POSTGRES_USER=mediastack')
      expect(result).toContain('POSTGRES_PASSWORD=')
      // Password should be generated (non-empty)
      const match = result.match(/POSTGRES_PASSWORD=(\S+)/)
      expect(match?.[1]?.length).toBeGreaterThan(0)
    })
  })

  describe('service credentials', () => {
    it('should include Redis password', () => {
      const config = createMockConfig({ password: 'myredispass' })
      const result = generateEnvFile(config, ['plex'])

      expect(result).toContain('REDIS_PASSWORD=myredispass')
    })

    it('should generate Redis password when not provided', () => {
      const config = createMockConfig({ password: '' })
      const result = generateEnvFile(config, ['plex'])

      const match = result.match(/REDIS_PASSWORD=(\S+)/)
      expect(match?.[1]?.length).toBeGreaterThan(0)
    })

    it('should include Plex claim token when provided', () => {
      const config = createMockConfig({ plexClaim: 'claim-abc123' })
      const result = generateEnvFile(config, ['plex'])

      expect(result).toContain('PLEX_CLAIM=claim-abc123')
    })

    it('should include WireGuard config when provided', () => {
      const config = createMockConfig({
        wireguardPrivateKey: 'private-key-123',
        wireguardAddresses: '10.0.0.1/32',
      })
      const result = generateEnvFile(config, ['vpn'])

      expect(result).toContain('WIREGUARD_PRIVATE_KEY=private-key-123')
      expect(result).toContain('WIREGUARD_ADDRESSES=10.0.0.1/32')
    })

    it('should include empty API key placeholders', () => {
      const config = createMockConfig()
      const result = generateEnvFile(config, ['plex', 'arr'])

      expect(result).toContain('PLEX_TOKEN=')
      expect(result).toContain('SONARR_API_KEY=')
      expect(result).toContain('RADARR_API_KEY=')
      expect(result).toContain('PROWLARR_API_KEY=')
    })
  })

  describe('service-specific configuration', () => {
    it('should include service configs for selected services', () => {
      const config = createMockConfig({
        serviceConfigs: {
          plex: { ALLOWED_NETWORKS: '192.168.1.0/24' },
          torrent: { LAN_NETWORK: '10.0.0.0/8' },
        },
      })
      const result = generateEnvFile(config, ['plex', 'torrent'])

      expect(result).toContain('# PLEX CONFIGURATION')
      expect(result).toContain('ALLOWED_NETWORKS=192.168.1.0/24')
      expect(result).toContain('# TORRENT CONFIGURATION')
      expect(result).toContain('LAN_NETWORK=10.0.0.0/8')
    })

    it('should not include configs for unselected services', () => {
      const config = createMockConfig({
        serviceConfigs: {
          plex: { ALLOWED_NETWORKS: '192.168.1.0/24' },
          jellyfin: { SOME_CONFIG: 'value' },
        },
      })
      const result = generateEnvFile(config, ['plex'])

      expect(result).toContain('# PLEX CONFIGURATION')
      expect(result).not.toContain('# JELLYFIN CONFIGURATION')
    })
  })

  describe('file structure', () => {
    it('should include proper section headers', () => {
      const config = createMockConfig()
      const result = generateEnvFile(config, ['plex'])

      expect(result).toContain('# GENERAL SETTINGS')
      expect(result).toContain('# STORAGE & PATHS')
      expect(result).toContain('# DATABASE CREDENTIALS')
      expect(result).toContain('# SERVICE CREDENTIALS & SECRETS')
    })

    it('should include deployment mode comment at top', () => {
      const config = createMockConfig({ deploymentMode: 'local' })
      const result = generateEnvFile(config, ['plex'])

      expect(result).toContain('# Deployment Mode: LOCAL')
    })

    it('should be valid .env format (key=value pairs)', () => {
      const config = createMockConfig()
      const result = generateEnvFile(config, ['plex'])

      const lines = result.split('\n').filter((line) => line.trim() && !line.startsWith('#'))
      lines.forEach((line) => {
        // Each non-comment, non-empty line should be a valid key=value
        expect(line).toMatch(/^[A-Z_][A-Z0-9_]*=.*$/)
      })
    })
  })
})
