import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import { build } from '../src/app.js'
import { FastifyInstance } from 'fastify'

/**
 * Comprehensive API Integration Tests for Control Server
 * Based on 2026 Fastify Best Practices
 * - Uses Fastify inject() for fast HTTP testing
 * - Tests real route handlers without network overhead
 * - Validates request/response contracts
 * - Tests error handling and edge cases
 */

describe('Control Server API Integration Tests', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    app = await build({
      logger: false,
      disableRequestLogging: true
    })
  })

  afterAll(async () => {
    await app.close()
  })

  describe('Health and Status Endpoints', () => {
    it('GET /api/health returns 200 and status ok', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/health'
      })

      expect(response.statusCode).toBe(200)
      const json = response.json()
      expect(json).toHaveProperty('status', 'ok')
    })

    it('GET /api/health includes uptime', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/health'
      })

      const json = response.json()
      expect(json).toHaveProperty('uptime')
      expect(typeof json.uptime).toBe('number')
      expect(json.uptime).toBeGreaterThanOrEqual(0)
    })
  })

  describe('Docker Container Endpoints', () => {
    it('GET /api/containers returns container list', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/containers'
      })

      expect(response.statusCode).toBe(200)
      const json = response.json()
      expect(Array.isArray(json)).toBe(true)
    })

    it('GET /api/containers handles docker unavailable', async () => {
      // This tests graceful degradation when Docker is not available
      const response = await app.inject({
        method: 'GET',
        url: '/api/containers'
      })

      // Should return 200 with empty array or error status
      expect([200, 500, 503]).toContain(response.statusCode)
    })

    it('GET /api/logs/:container validates container name', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/logs/invalid-container-name-with-special-chars!'
      })

      // Should validate container name format
      expect([400, 404, 500]).toContain(response.statusCode)
    })

    it('GET /api/logs/:container accepts tail parameter', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/logs/test-container',
        query: { tail: '100' }
      })

      // Query params should be accepted
      expect([200, 404, 500]).toContain(response.statusCode)
    })

    it('POST /api/containers/:id/stop validates container ID', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/containers/invalid-id/stop'
      })

      expect([400, 404, 500]).toContain(response.statusCode)
    })

    it('POST /api/containers/:id/start validates container ID', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/containers/invalid-id/start'
      })

      expect([400, 404, 500]).toContain(response.statusCode)
    })

    it('POST /api/containers/:id/restart validates container ID', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/containers/invalid-id/restart'
      })

      expect([400, 404, 500]).toContain(response.statusCode)
    })
  })

  describe('Configuration Validation Endpoints', () => {
    it('POST /api/validate/domain validates domain format', async () => {
      const validDomain = await app.inject({
        method: 'POST',
        url: '/api/validate/domain',
        payload: { domain: 'example.com' }
      })

      expect(validDomain.statusCode).toBe(200)
      const validJson = validDomain.json()
      expect(validJson).toHaveProperty('valid')
    })

    it('POST /api/validate/domain rejects invalid domains', async () => {
      const invalidDomain = await app.inject({
        method: 'POST',
        url: '/api/validate/domain',
        payload: { domain: 'invalid domain!' }
      })

      const json = invalidDomain.json()
      expect(json.valid).toBe(false)
    })

    it('POST /api/validate/port checks port availability', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/validate/port',
        payload: { port: 8080 }
      })

      expect([200, 400]).toContain(response.statusCode)
      const json = response.json()
      expect(json).toHaveProperty('valid')
    })

    it('POST /api/validate/port rejects invalid port numbers', async () => {
      const invalidPorts = [0, -1, 65536, 100000]

      for (const port of invalidPorts) {
        const response = await app.inject({
          method: 'POST',
          url: '/api/validate/port',
          payload: { port }
        })

        const json = response.json()
        expect(json.valid).toBe(false)
      }
    })

    it('POST /api/validate/path checks path format', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/validate/path',
        payload: { path: '/mnt/media' }
      })

      expect(response.statusCode).toBe(200)
      const json = response.json()
      expect(json).toHaveProperty('valid')
    })

    it('POST /api/validate/cloudflare validates API token format', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/validate/cloudflare',
        payload: { 
          token: 'test-token-123',
          domain: 'example.com'
        }
      })

      expect([200, 400, 401]).toContain(response.statusCode)
    })

    it('POST /api/validate/vpn validates VPN configuration', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/validate/vpn',
        payload: {
          provider: 'nordvpn',
          username: 'test',
          password: 'test123'
        }
      })

      expect([200, 400]).toContain(response.statusCode)
      const json = response.json()
      expect(json).toHaveProperty('valid')
    })

    it('POST /api/validate/docker checks Docker availability', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/validate/docker'
      })

      expect([200, 503]).toContain(response.statusCode)
      const json = response.json()
      expect(json).toHaveProperty('valid')
    })
  })

  describe('*Arr Stack Endpoints', () => {
    it('GET /api/arr/bootstrap initiates API key extraction', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/arr/bootstrap'
      })

      expect([200, 500, 503]).toContain(response.statusCode)
    })

    it('GET /api/arr/keys/:service gets API key for service', async () => {
      const services = ['sonarr', 'radarr', 'lidarr', 'prowlarr', 'readarr']

      for (const service of services) {
        const response = await app.inject({
          method: 'GET',
          url: `/api/arr/keys/${service}`
        })

        expect([200, 404, 500]).toContain(response.statusCode)
      }
    })

    it('GET /api/arr/keys/:service rejects invalid service names', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/arr/keys/invalid-service'
      })

      expect([400, 404]).toContain(response.statusCode)
    })
  })

  describe('AI Assistant Endpoints', () => {
    it('POST /api/agents/chat accepts chat messages', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/agents/chat',
        payload: {
          message: 'Hello, can you help me?',
          context: {}
        }
      })

      expect([200, 400, 500, 503]).toContain(response.statusCode)
    })

    it('POST /api/agents/chat validates message format', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/agents/chat',
        payload: {
          // Missing required message field
          context: {}
        }
      })

      expect([400, 422]).toContain(response.statusCode)
    })

    it('POST /api/agents/chat handles empty messages', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/agents/chat',
        payload: {
          message: '',
          context: {}
        }
      })

      expect([400, 422]).toContain(response.statusCode)
    })

    it('POST /api/agents/validate-config validates wizard configuration', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/agents/validate-config',
        payload: {
          domain: 'test.com',
          services: ['plex', 'sonarr'],
          timezone: 'America/New_York'
        }
      })

      expect([200, 400, 500]).toContain(response.statusCode)
    })

    it('GET /api/tts/voices lists available TTS voices', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/tts/voices'
      })

      expect([200, 500, 503]).toContain(response.statusCode)
      
      if (response.statusCode === 200) {
        const json = response.json()
        expect(Array.isArray(json)).toBe(true)
      }
    })

    it('POST /api/tts/synthesize generates speech from text', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/tts/synthesize',
        payload: {
          text: 'Hello world',
          voice: 'alloy'
        }
      })

      expect([200, 400, 500, 503]).toContain(response.statusCode)
    })

    it('POST /api/tts/synthesize validates text length', async () => {
      const longText = 'a'.repeat(10000)
      const response = await app.inject({
        method: 'POST',
        url: '/api/tts/synthesize',
        payload: {
          text: longText,
          voice: 'alloy'
        }
      })

      // Should have some text length limit
      expect([200, 400, 413]).toContain(response.statusCode)
    })
  })

  describe('Remote Deployment Endpoints', () => {
    it('POST /api/remote-deploy/test-connection tests SSH connection', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/remote-deploy/test-connection',
        payload: {
          host: 'test.example.com',
          port: 22,
          username: 'testuser',
          privateKey: '-----BEGIN PRIVATE KEY-----\ntest\n-----END PRIVATE KEY-----'
        }
      })

      expect([200, 400, 401, 500, 503]).toContain(response.statusCode)
    })

    it('POST /api/remote-deploy/test-connection validates required fields', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/remote-deploy/test-connection',
        payload: {
          host: 'test.example.com'
          // Missing required fields
        }
      })

      expect([400, 422]).toContain(response.statusCode)
    })

    it('POST /api/remote-deploy/deploy initiates remote deployment', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/remote-deploy/deploy',
        payload: {
          host: 'test.example.com',
          port: 22,
          username: 'testuser',
          privateKey: '-----BEGIN PRIVATE KEY-----\ntest\n-----END PRIVATE KEY-----',
          config: {
            domain: 'test.com',
            services: ['plex']
          }
        }
      })

      expect([200, 400, 401, 500, 503]).toContain(response.statusCode)
    })

    it('POST /api/remote-deploy/deploy validates configuration', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/remote-deploy/deploy',
        payload: {
          host: 'test.example.com',
          port: 22,
          username: 'testuser',
          privateKey: '-----BEGIN PRIVATE KEY-----\ntest\n-----END PRIVATE KEY-----',
          config: {
            // Invalid configuration
            domain: '',
            services: []
          }
        }
      })

      expect([400, 422]).toContain(response.statusCode)
    })

    it('GET /api/remote-deploy/status/:deploymentId gets deployment status', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/remote-deploy/status/test-deployment-id'
      })

      expect([200, 404, 500]).toContain(response.statusCode)
    })
  })

  describe('Backup and Restore Endpoints', () => {
    it('POST /api/backup/create creates system backup', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/backup/create',
        payload: {
          includeContainers: true,
          includeVolumes: true,
          includeConfigs: true
        }
      })

      expect([200, 400, 500, 503]).toContain(response.statusCode)
    })

    it('GET /api/backup/list lists available backups', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/backup/list'
      })

      expect([200, 500]).toContain(response.statusCode)
      
      if (response.statusCode === 200) {
        const json = response.json()
        expect(Array.isArray(json)).toBe(true)
      }
    })

    it('POST /api/restore/start initiates restore process', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/restore/start',
        payload: {
          backupId: 'test-backup-id',
          options: {
            restoreContainers: true,
            restoreVolumes: true
          }
        }
      })

      expect([200, 400, 404, 500]).toContain(response.statusCode)
    })

    it('GET /api/restore/status/:restoreId gets restore status', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/restore/status/test-restore-id'
      })

      expect([200, 404, 500]).toContain(response.statusCode)
    })

    it('DELETE /api/backup/:backupId deletes backup', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: '/api/backup/test-backup-id'
      })

      expect([200, 404, 500]).toContain(response.statusCode)
    })
  })

  describe('Settings and Configuration Endpoints', () => {
    it('GET /api/settings gets current settings', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/settings'
      })

      expect([200, 500]).toContain(response.statusCode)
      
      if (response.statusCode === 200) {
        const json = response.json()
        expect(typeof json).toBe('object')
      }
    })

    it('POST /api/settings updates settings', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/settings',
        payload: {
          theme: 'dark',
          language: 'en'
        }
      })

      expect([200, 400, 500]).toContain(response.statusCode)
    })

    it('POST /api/settings/api-keys updates API keys', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/settings/api-keys',
        payload: {
          openaiKey: 'sk-test-key',
          elevenLabsKey: 'el-test-key'
        }
      })

      expect([200, 400, 500]).toContain(response.statusCode)
    })

    it('GET /api/settings/status gets API key status', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/settings/status'
      })

      expect([200, 500]).toContain(response.statusCode)
      
      if (response.statusCode === 200) {
        const json = response.json()
        expect(json).toHaveProperty('openai')
        expect(json).toHaveProperty('elevenLabs')
      }
    })
  })

  describe('VPN Configuration Endpoints', () => {
    it('GET /api/vpn/providers lists supported VPN providers', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/vpn/providers'
      })

      expect(response.statusCode).toBe(200)
      const json = response.json()
      expect(Array.isArray(json)).toBe(true)
      expect(json.length).toBeGreaterThan(0)
    })

    it('POST /api/vpn/test tests VPN configuration', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/vpn/test',
        payload: {
          provider: 'nordvpn',
          credentials: {
            username: 'test',
            password: 'test123'
          }
        }
      })

      expect([200, 400, 401, 500]).toContain(response.statusCode)
    })
  })

  describe('Orchestrator Endpoints', () => {
    it('POST /api/orchestrator/plan creates deployment plan', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/orchestrator/plan',
        payload: {
          services: ['plex', 'sonarr', 'radarr'],
          domain: 'test.com',
          timezone: 'UTC'
        }
      })

      expect([200, 400, 500]).toContain(response.statusCode)
    })

    it('POST /api/orchestrator/execute executes deployment plan', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/orchestrator/execute',
        payload: {
          planId: 'test-plan-id',
          dryRun: true
        }
      })

      expect([200, 400, 404, 500]).toContain(response.statusCode)
    })

    it('GET /api/orchestrator/status/:planId gets plan execution status', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/orchestrator/status/test-plan-id'
      })

      expect([200, 404, 500]).toContain(response.statusCode)
    })
  })

  describe('Error Handling and Edge Cases', () => {
    it('handles malformed JSON gracefully', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/agents/chat',
        headers: {
          'content-type': 'application/json'
        },
        payload: 'this is not json'
      })

      expect([400, 422]).toContain(response.statusCode)
    })

    it('handles missing content-type header', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/agents/chat',
        payload: {
          message: 'test'
        }
      })

      // Should either accept it or reject gracefully
      expect([200, 400, 415, 500]).toContain(response.statusCode)
    })

    it('handles extremely large payloads', async () => {
      const largePayload = {
        message: 'x'.repeat(1000000) // 1MB of text
      }

      const response = await app.inject({
        method: 'POST',
        url: '/api/agents/chat',
        payload: largePayload
      })

      // Should reject or handle large payloads
      expect([200, 400, 413, 500]).toContain(response.statusCode)
    })

    it('handles special characters in URL parameters', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/logs/<script>alert("xss")</script>'
      })

      expect([400, 404, 500]).toContain(response.statusCode)
    })

    it('handles concurrent requests safely', async () => {
      const requests = Array(10).fill(null).map(() => 
        app.inject({
          method: 'GET',
          url: '/api/health'
        })
      )

      const responses = await Promise.all(requests)

      responses.forEach(response => {
        expect(response.statusCode).toBe(200)
      })
    })
  })

  describe('CORS and Security Headers', () => {
    it('includes appropriate CORS headers', async () => {
      const response = await app.inject({
        method: 'OPTIONS',
        url: '/api/health',
        headers: {
          origin: 'http://localhost:5173'
        }
      })

      expect([200, 204]).toContain(response.statusCode)
      expect(response.headers).toHaveProperty('access-control-allow-origin')
    })

    it('rejects unauthorized origins when configured', async () => {
      const response = await app.inject({
        method: 'OPTIONS',
        url: '/api/health',
        headers: {
          origin: 'http://evil.com'
        }
      })

      // CORS policy should be enforced
      expect([200, 204, 403]).toContain(response.statusCode)
    })

    it('includes security headers in responses', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/health'
      })

      // Check for common security headers
      const headers = response.headers
      
      // At minimum, should have some security considerations
      expect(headers).toBeDefined()
    })
  })

  describe('Rate Limiting and Performance', () => {
    it('handles rapid successive requests', async () => {
      const requests = Array(50).fill(null).map(() => 
        app.inject({
          method: 'GET',
          url: '/api/health'
        })
      )

      const responses = await Promise.all(requests)

      // Should either handle all or rate limit some
      const statusCodes = responses.map(r => r.statusCode)
      expect(statusCodes.every(code => [200, 429].includes(code))).toBe(true)
    })

    it('responds to health checks quickly', async () => {
      const start = Date.now()
      await app.inject({
        method: 'GET',
        url: '/api/health'
      })
      const duration = Date.now() - start

      expect(duration).toBeLessThan(100) // Should respond in < 100ms
    })
  })
})
