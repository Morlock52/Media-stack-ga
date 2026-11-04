import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest'
import type { FastifyInstance } from 'fastify'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { gunzipSync } from 'node:zlib'

/**
 * API integration tests for the control server.
 *
 * Exercises the real Fastify app from `buildApp()` through `app.inject()`, so the
 * CORS / auth / rate-limit / compression wiring in src/app.ts and every registered
 * route module are covered together.
 *
 * Determinism (CI runs on ubuntu with no Docker daemon, no network, no API keys):
 * - `child_process` is replaced by a programmable fake. Every docker / ssh / scp /
 *   sshpass invocation (src/utils/docker.ts and src/routes/remote.ts) and every
 *   lsof/ss/netstat probe (port validator) goes through it. By default a spawned
 *   binary behaves like it is not installed (ENOENT), which is what CI looks like.
 * - global `fetch` is stubbed; any outbound call that a test did not set up fails.
 * - PROJECT_ROOT points at a fresh temp dir, so .env writes, conversation /
 *   troubleshooting / schedule / metrics stores and backup temp files never touch the
 *   repo. The dir is removed after the suite.
 */

type ProcResult = {
  stdout?: string
  stderr?: string
  code?: number
  /** Simulate the binary not being installed (spawn emits ENOENT). */
  missing?: boolean
  /** Delay before the fake process finishes. */
  delayMs?: number
}
type ProcHandler = (cmd: string, args: string[]) => ProcResult
type ProcCall = { cmd: string; args: string[]; env?: Record<string, string | undefined> }

const h = await vi.hoisted(async () => {
  const fsMod = await import('node:fs')
  const osMod = await import('node:os')
  const pathMod = await import('node:path')
  const { EventEmitter } = await import('node:events')

  const root = fsMod.mkdtempSync(pathMod.join(osMod.tmpdir(), 'cs-api-it-'))

  // Must be set before any src module is imported (PROJECT_ROOT and several model
  // names are read at module load time).
  process.env.PROJECT_ROOT = root
  process.env.LOG_LEVEL = 'silent'
  process.env.DOCKER_STATUS_CACHE_MS = '0'
  process.env.REMOTE_DEPLOY_LOCK_MS = '0'
  for (const key of [
    'OPENAI_API_KEY',
    'OPENAI_MODEL',
    'OPENAI_TTS_MODEL',
    'OPENAI_TTS_FALLBACK_MODEL',
    'OPENAI_TTS_VOICE',
    'OPENAI_STT_MODEL',
    'OPENAI_REALTIME_MODEL',
    'PRIMARY_AI_PROVIDER',
    'CONTROL_SERVER_TOKEN',
    'CONTROL_SERVER_CORS_ORIGINS',
    'CONTROL_SERVER_RATE_LIMIT_DISABLED',
    'CONTROL_SERVER_RATE_LIMIT_MAX',
    'CONTROL_SERVER_RATE_LIMIT_WINDOW',
    'CONTROL_SERVER_ALLOW_SELF_RELOAD',
    'CONVERSATION_ENCRYPTION_KEY',
  ]) {
    delete process.env[key]
  }

  const notInstalled = () => ({ missing: true })
  const state: { handler: (cmd: string, args: string[]) => any } = { handler: notInstalled }
  const calls: Array<{ cmd: string; args: string[]; env?: Record<string, string | undefined> }> = []

  const spawn = vi.fn((cmd: string, args: string[] = [], opts?: { env?: Record<string, string | undefined> }) => {
    calls.push({ cmd, args: [...args], env: opts?.env })
    const child: any = new EventEmitter()
    child.stdout = new EventEmitter()
    child.stderr = new EventEmitter()
    child.pid = 4242
    child.kill = vi.fn()
    const result = state.handler(cmd, [...args]) || {}
    const finish = () => {
      if (result.missing) {
        // Same event sequence Node emits when the binary does not exist.
        const err: any = new Error(`spawn ${cmd} ENOENT`)
        err.code = 'ENOENT'
        child.emit('error', err)
        child.emit('close', -2)
        return
      }
      if (result.stdout) child.stdout.emit('data', Buffer.from(result.stdout))
      if (result.stderr) child.stderr.emit('data', Buffer.from(result.stderr))
      const code = result.code ?? 0
      child.emit('exit', code)
      child.emit('close', code)
    }
    if (result.delayMs) setTimeout(finish, result.delayMs)
    else setImmediate(finish)
    return child
  })

  // exec/execFile are only used for host port probes (lsof/ss/netstat): report "not available".
  const failingExec = vi.fn((...args: any[]) => {
    const cb = args[args.length - 1]
    if (typeof cb === 'function') setImmediate(() => cb(new Error('command not available in tests'), '', ''))
    return { kill: () => {}, on: () => {} }
  })

  const fetchMock = vi.fn()

  return {
    root,
    spawn,
    exec: failingExec,
    calls,
    fetchMock,
    setHandler: (fn: (cmd: string, args: string[]) => any) => {
      state.handler = fn
    },
    resetProcesses: () => {
      state.handler = notInstalled
      calls.length = 0
    },
  }
})

vi.mock('child_process', async (importOriginal) => {
  const actual = await importOriginal<typeof import('child_process')>()
  return {
    ...actual,
    spawn: h.spawn,
    exec: h.exec,
    execFile: h.exec,
  }
})

import { buildApp } from '../src/app.js'

// ─── helpers ────────────────────────────────────────────────────────────────

const ENV_FILE = path.join(h.root, '.env')
const VALID_OPENAI_KEY = 'sk-test_integration_key_0123456789'

const setProcesses = (handler: ProcHandler) => h.setHandler(handler)
const procCalls = (): ProcCall[] => h.calls
const dockerCalls = () => procCalls().filter((c) => c.cmd === 'docker')

/** Route docker invocations by matching the joined argv against substrings/regexes, in order. */
const dockerRouter =
  (routes: Array<[string | RegExp, ProcResult]>, fallback: ProcResult = { code: 1, stderr: 'unexpected docker call' }): ProcHandler =>
  (cmd, args) => {
    if (cmd !== 'docker') return { missing: true }
    const joined = args.join(' ')
    for (const [pattern, result] of routes) {
      if (typeof pattern === 'string' ? joined.includes(pattern) : pattern.test(joined)) return result
    }
    return fallback
  }

const DAEMON_DOWN: ProcResult = {
  code: 1,
  stderr: 'Cannot connect to the Docker daemon at unix:///var/run/docker.sock. Is the docker daemon running?',
}

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

const chatCompletion = (content: string) =>
  jsonResponse({
    id: 'chatcmpl-test',
    choices: [{ message: { role: 'assistant', content }, finish_reason: 'stop' }],
    usage: { prompt_tokens: 11, completion_tokens: 7, total_tokens: 18 },
  })

const fetchCalls = () => h.fetchMock.mock.calls.map(([url, init]) => ({ url: String(url), init: init as RequestInit }))

const useOpenAIKey = () => {
  process.env.OPENAI_API_KEY = VALID_OPENAI_KEY
}

const readEnvFile = () => (fs.existsSync(ENV_FILE) ? fs.readFileSync(ENV_FILE, 'utf-8') : '')

const multipartAudio = (bytes: number, filename = 'clip.webm') => {
  const boundary = '----control-server-test-boundary'
  const payload = Buffer.concat([
    Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${filename}"\r\nContent-Type: audio/webm\r\n\r\n`
    ),
    Buffer.alloc(bytes, 7),
    Buffer.from(`\r\n--${boundary}--\r\n`),
  ])
  return { payload, headers: { 'content-type': `multipart/form-data; boundary=${boundary}` } }
}

const localDestination = (name: string) => ({ type: 'local' as const, path: path.join(h.root, 'backups', name) })

// ─── suite ──────────────────────────────────────────────────────────────────

describe('Control Server API integration (buildApp)', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    vi.stubGlobal('fetch', h.fetchMock)
    app = await buildApp()
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
    vi.unstubAllGlobals()
    fs.rmSync(h.root, { recursive: true, force: true })
  })

  beforeEach(() => {
    h.resetProcesses()
    h.fetchMock.mockReset()
    h.fetchMock.mockImplementation(async (url: unknown) => {
      throw new Error(`Unexpected outbound fetch in test: ${String(url)}`)
    })
  })

  afterEach(() => {
    delete process.env.OPENAI_API_KEY
    delete process.env.CONTROL_SERVER_TOKEN
    fs.rmSync(ENV_FILE, { force: true })
  })

  // ── Health & status ─────────────────────────────────────────────────────

  describe('health and status', () => {
    it('GET /api/health reports the service as online', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/health' })

      expect(res.statusCode).toBe(200)
      expect(res.headers['content-type']).toContain('application/json')
      expect(res.json()).toEqual({ status: 'online', version: '2.0.0', backend: 'fastify' })
    })

    it('GET / describes the service and its entry points', async () => {
      const res = await app.inject({ method: 'GET', url: '/' })

      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body).toMatchObject({ service: 'Media Stack Control Server', status: 'running', version: '2.0.0' })
      expect(body.endpoints).toEqual(expect.arrayContaining(['/api/health', '/api/containers', '/api/agents']))
    })

    it('GET /api/system/status reports the compose target under PROJECT_ROOT', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/system/status' })

      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.projectRoot).toBe(h.root)
      expect(body.composeFile).toBe(`${h.root}/docker-compose.yml`)
      expect(body.limits).toEqual({ maxParallel: '4', cacheMs: 0 })
      expect(body.cache).toMatchObject({ containersCount: 0, composeServicesCount: 0 })
    })

    it('GET /api/system/network returns host addressing info', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/system/network' })

      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.success).toBe(true)
      expect(body.hostname).toBe(os.hostname())
      expect(Array.isArray(body.ipv4)).toBe(true)
      expect(Array.isArray(body.ipv6)).toBe(true)
      expect(typeof body.inContainer).toBe('boolean')
    })

    it('POST /api/system/reload is refused unless self-reload is enabled', async () => {
      const res = await app.inject({ method: 'POST', url: '/api/system/reload' })

      expect(res.statusCode).toBe(405)
      expect(res.json().error).toMatch(/self-reload disabled/)
    })
  })

  // ── Optional bearer-token auth ──────────────────────────────────────────

  describe('optional API token (CONTROL_SERVER_TOKEN)', () => {
    beforeEach(() => {
      process.env.CONTROL_SERVER_TOKEN = 'integration-token'
    })

    it('rejects requests without the bearer token', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/system/status' })

      expect(res.statusCode).toBe(401)
      expect(res.json()).toEqual({ error: 'Unauthorized' })
    })

    it('rejects a wrong bearer token', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/system/status',
        headers: { authorization: 'Bearer not-the-token' },
      })

      expect(res.statusCode).toBe(401)
    })

    it('accepts the configured bearer token', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/system/status',
        headers: { authorization: 'Bearer integration-token' },
      })

      expect(res.statusCode).toBe(200)
      expect(res.json().projectRoot).toBe(h.root)
    })

    it('keeps /api/health open for probes', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/health' })

      expect(res.statusCode).toBe(200)
      expect(res.json().status).toBe('online')
    })
  })

  // ── Docker containers & system actions ──────────────────────────────────

  describe('containers', () => {
    it('GET /api/containers parses docker ps output', async () => {
      setProcesses(
        dockerRouter([
          [
            'ps -a --format',
            {
              stdout:
                '"a1b2c3|sonarr|Up 2 hours (healthy)|running|0.0.0.0:8989->8989/tcp"\n' +
                '"d4e5f6|radarr|Exited (1) 5 minutes ago|exited|"\n',
            },
          ],
        ])
      )

      const res = await app.inject({ method: 'GET', url: '/api/containers' })

      expect(res.statusCode).toBe(200)
      expect(res.json()).toEqual([
        { id: 'a1b2c3', name: 'sonarr', status: 'Up 2 hours (healthy)', state: 'running', ports: '0.0.0.0:8989->8989/tcp' },
        { id: 'd4e5f6', name: 'radarr', status: 'Exited (1) 5 minutes ago', state: 'exited', ports: '' },
      ])
    })

    it('GET /api/containers returns 503 when the docker CLI is not installed', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/containers' })

      expect(res.statusCode).toBe(503)
      const body = res.json()
      expect(body.error).toBe('docker_unavailable')
      expect(body.containers).toEqual([])
      expect(body.message).toContain('Required CLI "docker" is not available')
    })

    it('GET /api/containers returns 503 when the docker daemon is down', async () => {
      setProcesses(dockerRouter([['ps -a', DAEMON_DOWN]]))

      const res = await app.inject({ method: 'GET', url: '/api/containers' })

      expect(res.statusCode).toBe(503)
      expect(res.json().message).toMatch(/Docker daemon is not running/)
    })

    it('GET /api/containers returns 500 for other docker failures', async () => {
      setProcesses(dockerRouter([['ps -a', { code: 1, stderr: 'unexpected EOF' }]]))

      const res = await app.inject({ method: 'GET', url: '/api/containers' })

      expect(res.statusCode).toBe(500)
      expect(res.json()).toEqual({ error: 'unexpected EOF' })
    })

    for (const action of ['restart', 'start', 'stop'] as const) {
      it(`POST /api/containers/${action}/:name runs docker ${action} for a valid name`, async () => {
        setProcesses(dockerRouter([[`${action} my-app_1.web`, { stdout: 'my-app_1.web' }]]))

        const res = await app.inject({ method: 'POST', url: `/api/containers/${action}/my-app_1.web` })

        expect(res.statusCode).toBe(200)
        expect(res.json().success).toBe(true)
        expect(dockerCalls().map((c) => c.args)).toEqual([[action, 'my-app_1.web']])
      })
    }

    it.each([
      ['restart', '-rm'],
      ['start', '.hidden'],
      ['stop', 'foo;rm -rf /'],
      ['restart', '$(reboot)'],
      ['stop', '<script>alert(1)</script>'],
      ['start', 'name with spaces'],
    ])('POST /api/containers/%s rejects unsafe container name %j without running docker', async (action, name) => {
      const res = await app.inject({ method: 'POST', url: `/api/containers/${action}/${encodeURIComponent(name)}` })

      expect(res.statusCode).toBe(400)
      expect(res.json()).toEqual({ error: 'Invalid container name' })
      expect(procCalls()).toHaveLength(0)
    })

    it('POST /api/containers/restart/:name reports docker failures as 500', async () => {
      setProcesses(dockerRouter([['restart ghost', { code: 1, stderr: 'Error response from daemon: No such container: ghost' }]]))

      const res = await app.inject({ method: 'POST', url: '/api/containers/restart/ghost' })

      expect(res.statusCode).toBe(500)
      expect(res.json()).toEqual({
        error: 'Failed to restart container',
        message: 'Error response from daemon: No such container: ghost',
      })
    })
  })

  describe('compose services and system actions', () => {
    const composeServices: [string, ProcResult] = ['config --services', { stdout: 'sonarr\nradarr\n' }]

    it('GET /api/compose/services lists compose services', async () => {
      setProcesses(dockerRouter([composeServices]))

      const res = await app.inject({ method: 'GET', url: '/api/compose/services' })

      expect(res.statusCode).toBe(200)
      expect(res.json()).toEqual({ services: ['sonarr', 'radarr'] })
      expect(dockerCalls()[0].args).toEqual(['compose', '--project-directory', h.root, 'config', '--services'])
    })

    it('GET /api/compose/services returns an empty list when compose config is incomplete', async () => {
      setProcesses(dockerRouter([['config --services', { code: 1, stderr: 'required variable DATA_ROOT is missing a value' }]]))

      const res = await app.inject({ method: 'GET', url: '/api/compose/services' })

      expect(res.statusCode).toBe(200)
      expect(res.json().services).toEqual([])
    })

    it('GET /api/compose/services returns 503 without docker', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/compose/services' })

      expect(res.statusCode).toBe(503)
      expect(res.json()).toEqual({ error: 'Docker is not running or not installed', services: [] })
    })

    it('POST /api/service/:action restarts a known compose service', async () => {
      setProcesses(dockerRouter([composeServices, ['restart sonarr', { stdout: '' }]]))

      const res = await app.inject({ method: 'POST', url: '/api/service/restart', payload: { serviceName: 'sonarr' } })

      expect(res.statusCode).toBe(200)
      expect(res.json()).toEqual({ success: true, message: 'Service sonarr restarted successfully' })
      expect(dockerCalls().map((c) => c.args)).toContainEqual(['compose', '--project-directory', h.root, 'restart', 'sonarr'])
    })

    it('POST /api/service/:action rejects services that are not in the compose file', async () => {
      setProcesses(dockerRouter([composeServices]))

      const res = await app.inject({ method: 'POST', url: '/api/service/start', payload: { serviceName: 'evil; rm -rf /' } })

      expect(res.statusCode).toBe(400)
      expect(res.json().error).toBe('Unknown service "evil; rm -rf /". Known services: sonarr, radarr')
      expect(dockerCalls()).toHaveLength(1) // only the compose config lookup
    })

    it('POST /api/service/:action rejects unknown actions and missing service names', async () => {
      const badAction = await app.inject({ method: 'POST', url: '/api/service/destroy', payload: { serviceName: 'sonarr' } })
      expect(badAction.statusCode).toBe(400)
      expect(badAction.json()).toEqual({ error: 'Invalid action' })

      const noName = await app.inject({ method: 'POST', url: '/api/service/start', payload: {} })
      expect(noName.statusCode).toBe(400)
      expect(noName.json()).toEqual({ error: 'Invalid service name' })

      expect(procCalls()).toHaveLength(0)
    })

    it('POST /api/system/update pulls, recreates and prunes in order', async () => {
      setProcesses(dockerRouter([[/./, { stdout: '' }]]))

      const res = await app.inject({ method: 'POST', url: '/api/system/update' })

      expect(res.statusCode).toBe(200)
      expect(res.json()).toEqual({ success: true, message: 'System updated successfully' })
      expect(dockerCalls().map((c) => c.args)).toEqual([
        ['compose', '--project-directory', h.root, 'pull'],
        ['compose', '--project-directory', h.root, 'up', '-d', '--remove-orphans'],
        ['image', 'prune', '-f'],
      ])
    })

    it('POST /api/system/restart reports docker failures as 500', async () => {
      const res = await app.inject({ method: 'POST', url: '/api/system/restart' })

      expect(res.statusCode).toBe(500)
      expect(res.json().error).toContain('Required CLI "docker" is not available')
    })
  })

  describe('health snapshot and dashboard', () => {
    it('GET /api/health-snapshot summarises stopped containers with suggestions', async () => {
      setProcesses(
        dockerRouter([
          ['ps -a --format', { stdout: '"sonarr|Up 2 hours (healthy)|running"\n"radarr|Exited (1) 3 minutes ago|exited"\n' }],
        ])
      )

      const res = await app.inject({ method: 'GET', url: '/api/health-snapshot' })

      expect(res.statusCode).toBe(200)
      expect(res.json()).toEqual({
        healthy: false,
        summary: '1 issue detected: radarr is stopped',
        issues: [{ type: 'stopped', service: 'radarr', message: 'radarr is stopped' }],
        suggestions: [{ action: 'start', service: 'radarr', label: 'Start radarr' }],
        containerCount: 2,
        runningCount: 1,
      })
    })

    it('GET /api/health-snapshot reports healthy when everything runs', async () => {
      setProcesses(dockerRouter([['ps -a --format', { stdout: '"sonarr|Up 2 hours|running"\n' }]]))

      const res = await app.inject({ method: 'GET', url: '/api/health-snapshot' })

      expect(res.statusCode).toBe(200)
      expect(res.json()).toMatchObject({ healthy: true, issues: [], containerCount: 1, runningCount: 1 })
      expect(res.json().summary).toMatch(/^All services healthy/)
    })

    it('GET /api/health-snapshot returns 503 without docker', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/health-snapshot' })

      expect(res.statusCode).toBe(503)
      expect(res.json()).toMatchObject({
        healthy: false,
        summary: 'Docker is not running or not installed',
        containerCount: 0,
        runningCount: 0,
      })
    })

    it('GET /api/health-dashboard aggregates container health', async () => {
      const line = (o: Record<string, string>) => JSON.stringify(o)
      setProcesses(
        dockerRouter([
          [
            'ps -a --format {{json .}}',
            {
              stdout: [
                line({ ID: 'a1', Names: 'sonarr', Image: 'lscr.io/sonarr', Status: 'Up 2 hours (healthy)', State: 'running' }),
                line({ ID: 'b2', Names: 'radarr', Image: 'lscr.io/radarr', Status: 'Up 1 hour (unhealthy)', State: 'running' }),
                line({ ID: 'c3', Names: 'bazarr', Image: 'lscr.io/bazarr', Status: 'Exited (0) 3 hours ago', State: 'exited' }),
                'not-json',
              ].join('\n'),
            },
          ],
          ['system df', { code: 1, stderr: 'df not supported' }],
        ])
      )

      const res = await app.inject({ method: 'GET', url: '/api/health-dashboard' })

      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.summary).toEqual({ total: 3, healthy: 1, unhealthy: 1, running: 2, stopped: 1, starting: 0 })
      expect(body.containers.map((c: { name: string; health: string }) => [c.name, c.health])).toEqual([
        ['sonarr', 'healthy'],
        ['radarr', 'unhealthy'],
        ['bazarr', 'stopped'],
      ])
      expect(body.systemStats).toBeNull()
      expect(body.actions).toMatchObject({
        restart: '/api/containers/restart/:name',
        start: '/api/containers/start/:name',
        stop: '/api/containers/stop/:name',
      })
    })

    it('GET /api/health-dashboard returns 503 without docker', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/health-dashboard' })

      expect(res.statusCode).toBe(503)
      expect(res.json().error).toBe('Docker is not available')
    })
  })

  describe('local deploy', () => {
    it('POST /api/local-deploy validates the request body', async () => {
      const res = await app.inject({ method: 'POST', url: '/api/local-deploy', payload: { envContent: 'A=1', profiles: [] } })

      expect(res.statusCode).toBe(400)
      expect(res.json()).toMatchObject({ success: false, error: 'Invalid request body' })
      expect(fs.existsSync(ENV_FILE)).toBe(false)
    })

    it('POST /api/local-deploy writes .env, creates data dirs and starts the selected profiles', async () => {
      const dataRoot = path.join(h.root, 'deploy-data')
      const configRoot = path.join(h.root, 'deploy-config')
      const envContent = `DATA_ROOT=${dataRoot}\nCONFIG_ROOT=${configRoot}\nTZ=UTC\n`
      setProcesses(
        dockerRouter([
          [' up -d --remove-orphans', { stdout: '' }],
          ['ps -a --format', { stdout: '"sonarr|running"\n"radarr|exited"\n' }],
        ])
      )

      const res = await app.inject({
        method: 'POST',
        url: '/api/local-deploy',
        payload: { envContent, profiles: ['arr', 'media'] },
      })

      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body).toMatchObject({ success: true, message: 'Deployed 2 service profiles' })
      expect(body.containers).toEqual([
        { name: 'sonarr', on: true },
        { name: 'radarr', on: false },
      ])
      expect(body.steps.every((s: { status: string }) => s.status === 'done')).toBe(true)

      expect(readEnvFile()).toBe(envContent)
      expect(fs.statSync(path.join(dataRoot, 'media', 'movies')).isDirectory()).toBe(true)
      expect(fs.statSync(path.join(configRoot, 'homepage')).isDirectory()).toBe(true)

      const up = dockerCalls().find((c) => c.args.includes('up'))!
      expect(up.args).toEqual(['compose', '--project-directory', h.root, '-f', 'docker-compose.local.yml', 'up', '-d', '--remove-orphans'])
      expect(up.env?.COMPOSE_PROFILES).toBe('arr,media')
    })

    it('POST /api/local-deploy reports a friendly port conflict when compose fails', async () => {
      setProcesses(dockerRouter([[' up -d', { code: 1, stderr: 'Error: Bind for 0.0.0.0:8989 failed: port is already allocated' }]]))

      const res = await app.inject({
        method: 'POST',
        url: '/api/local-deploy',
        payload: { envContent: `DATA_ROOT=${path.join(h.root, 'deploy-fail')}\n`, profiles: ['arr'] },
      })

      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.success).toBe(false)
      expect(body.error).toMatch(/^Port 8989 is already in use/)
      expect(body.steps.at(-1)).toMatchObject({ status: 'error' })
    })
  })

  // ── *arr endpoints ──────────────────────────────────────────────────────

  describe('*arr endpoints', () => {
    const arrDocker = dockerRouter([
      [/^ps --format \{\{\.Names\}\}$/, { stdout: 'sonarr\nradarr\nnginx\nmylarr\n' }],
      ['exec sonarr sed', { stdout: 'sonarr-key-123\n' }],
      ['exec radarr sed', { stdout: 'radarr-key-456\n' }],
      ['exec mylarr sed', { stdout: '' }],
      ['test -f', { code: 0 }],
    ])

    it('GET /api/arr/services lists every supported service', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/arr/services' })

      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.success).toBe(true)
      expect(body.count).toBe(body.services.length)
      expect(body.services).toContainEqual({ id: 'sonarr', envKey: 'SONARR_API_KEY', configType: 'xml', aliases: [] })
      expect(body.services).toContainEqual(expect.objectContaining({ id: 'overseerr', aliases: ['jellyseerr'] }))
    })

    it('GET /api/arr/containers lists running and discovered *arr containers', async () => {
      setProcesses(arrDocker)

      const res = await app.inject({ method: 'GET', url: '/api/arr/containers' })

      expect(res.statusCode).toBe(200)
      expect(res.json()).toEqual({
        success: true,
        containers: ['sonarr', 'radarr', 'nginx', 'mylarr'],
        discovered: ['mylarr'],
        count: 4,
      })
    })

    it('GET /api/arr/status reports running and ready services', async () => {
      setProcesses(arrDocker)

      const res = await app.inject({ method: 'GET', url: '/api/arr/status' })

      expect(res.statusCode).toBe(200)
      const services = res.json().services as Array<{ id: string; running: boolean; ready: boolean; containerName?: string }>
      expect(services.find((s) => s.id === 'sonarr')).toEqual({ id: 'sonarr', running: true, ready: true, containerName: 'sonarr' })
      expect(services.find((s) => s.id === 'prowlarr')).toEqual({ id: 'prowlarr', running: false, ready: false })
    })

    it('POST /api/arr/bootstrap extracts keys and writes them to .env', async () => {
      setProcesses(arrDocker)

      const res = await app.inject({ method: 'POST', url: '/api/arr/bootstrap' })

      expect(res.statusCode).toBe(200)
      expect(res.json()).toEqual({
        success: true,
        keys: { SONARR_API_KEY: 'sonarr-key-123', RADARR_API_KEY: 'radarr-key-456' },
      })
      const env = readEnvFile()
      expect(env).toContain('SONARR_API_KEY=sonarr-key-123\n')
      expect(env).toContain('RADARR_API_KEY=radarr-key-456\n')
    })

    it('POST /api/arr/bootstrap reports when no keys can be found', async () => {
      const res = await app.inject({ method: 'POST', url: '/api/arr/bootstrap' })

      expect(res.statusCode).toBe(200)
      expect(res.json()).toMatchObject({ success: false, keys: {} })
      expect(res.json().error).toMatch(/No keys were found/)
      expect(fs.existsSync(ENV_FILE)).toBe(false)
    })

    it('GET /api/arr/extract returns detailed keys without touching .env', async () => {
      setProcesses(arrDocker)

      const res = await app.inject({ method: 'GET', url: '/api/arr/extract' })

      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.success).toBe(true)
      expect(body.count).toBe(2)
      expect(body.keys).toEqual(
        expect.arrayContaining([
          { service: 'sonarr', envKey: 'SONARR_API_KEY', value: 'sonarr-key-123', containerName: 'sonarr' },
          { service: 'radarr', envKey: 'RADARR_API_KEY', value: 'radarr-key-456', containerName: 'radarr' },
        ])
      )
      expect(fs.existsSync(ENV_FILE)).toBe(false)
    })

    it('POST /api/arr/wait-ready returns not ready immediately when nothing is running', async () => {
      const res = await app.inject({ method: 'POST', url: '/api/arr/wait-ready', payload: { timeout: 1000, pollInterval: 10 } })

      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.success).toBe(false)
      expect(body.ready).toBe(false)
      expect(body.services.every((s: { running: boolean }) => s.running === false)).toBe(true)
    })

    it('POST /api/arr/bootstrap-remote validates connection details', async () => {
      const noBody = await app.inject({ method: 'POST', url: '/api/arr/bootstrap-remote' })
      expect(noBody.statusCode).toBe(400)
      expect(noBody.json()).toEqual({ success: false, error: 'Host and username are required' })

      const noKey = await app.inject({
        method: 'POST',
        url: '/api/arr/bootstrap-remote',
        payload: { host: '10.0.0.5', username: 'media' },
      })
      expect(noKey.statusCode).toBe(400)
      expect(noKey.json().error).toBe('Private key is required for SSH key authentication')

      const badEnvPath = await app.inject({
        method: 'POST',
        url: '/api/arr/bootstrap-remote',
        payload: { host: '10.0.0.5', username: 'media', password: 'pw', envPath: '~/.env; rm -rf /' },
      })
      expect(badEnvPath.statusCode).toBe(400)
      expect(badEnvPath.json().error).toMatch(/^Invalid path/)
      expect(procCalls()).toHaveLength(0)
    })

    it('POST /api/arr/auto-bootstrap-remote validates connection details', async () => {
      const noBody = await app.inject({ method: 'POST', url: '/api/arr/auto-bootstrap-remote' })
      expect(noBody.statusCode).toBe(400)
      expect(noBody.json()).toEqual({ success: false, error: 'Host and username are required' })

      const noPassword = await app.inject({
        method: 'POST',
        url: '/api/arr/auto-bootstrap-remote',
        payload: { host: '10.0.0.5', username: 'media', authType: 'password' },
      })
      expect(noPassword.statusCode).toBe(400)
      expect(noPassword.json().error).toBe('Password is required for password authentication')
    })
  })

  // ── Agents / AI ─────────────────────────────────────────────────────────

  describe('agents and AI chat', () => {
    it('GET /api/agents lists the specialist agents', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/agents' })

      expect(res.statusCode).toBe(200)
      const ids = res.json().agents.map((a: { id: string }) => a.id)
      expect(ids).toEqual(expect.arrayContaining(['setup', 'troubleshoot', 'apps', 'deploy', 'general']))
      for (const agent of res.json().agents) {
        expect(agent).toEqual({
          id: expect.any(String),
          name: expect.any(String),
          icon: expect.any(String),
          color: expect.any(String),
          description: expect.any(String),
        })
      }
    })

    it('POST /api/agent/chat answers from the offline fallback without an API key', async () => {
      const res = await app.inject({ method: 'POST', url: '/api/agent/chat', payload: { message: 'how do I set up plex?' } })

      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.aiPowered).toBe(false)
      expect(body.agent).toEqual({ id: 'apps', name: 'App Expert', icon: expect.any(String) })
      expect(body.answer).toContain('32400')
      expect(res.headers['x-ratelimit-limit']).toBe('30')
      expect(h.fetchMock).not.toHaveBeenCalled()
    })

    it('POST /api/agent/chat honours an explicit agentId and wizard context', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/agent/chat',
        payload: { message: 'hello', agentId: 'deploy', context: { wizardStep: 1 } },
      })

      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.agent.id).toBe('deploy')
      expect(body.nextSteps).toEqual(expect.arrayContaining(['Set timezone, PUID, and PGID for file permissions.']))
    })

    it('POST /api/agent/chat rejects a missing message', async () => {
      const empty = await app.inject({ method: 'POST', url: '/api/agent/chat', payload: {} })
      expect(empty.statusCode).toBe(400)
      expect(empty.json()).toEqual({ error: 'Message is required' })

      const noBody = await app.inject({ method: 'POST', url: '/api/agent/chat' })
      expect(noBody.statusCode).toBe(400)
      expect(noBody.json()).toEqual({ error: 'Message is required' })
    })

    it('POST /api/agent/chat calls OpenAI when a key is configured', async () => {
      useOpenAIKey()
      h.fetchMock.mockResolvedValueOnce(chatCompletion('Add a library under Settings > Libraries.'))

      const res = await app.inject({
        method: 'POST',
        url: '/api/agent/chat',
        payload: { message: 'How do I add a library in plex?', agentId: 'apps' },
      })

      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body).toMatchObject({
        answer: 'Add a library under Settings > Libraries.',
        aiPowered: true,
        agent: { id: 'apps' },
        toolUsed: null,
      })
      expect(typeof body.model).toBe('string')
      expect(Array.isArray(body.sources)).toBe(true)

      const [call] = fetchCalls()
      expect(call.url).toBe('https://api.openai.com/v1/chat/completions')
      expect((call.init.headers as Record<string, string>).Authorization).toBe(`Bearer ${VALID_OPENAI_KEY}`)
      const sent = JSON.parse(String(call.init.body))
      expect(sent.messages.at(-1)).toEqual({ role: 'user', content: 'How do I add a library in plex?' })
      expect(sent.tools.map((t: { function: { name: string } }) => t.function.name)).toEqual([
        'analyze_logs',
        'validate_config',
        'bootstrap_arr',
      ])
    })

    it('POST /api/agent/chat maps an upstream 401 to invalid_api_key', async () => {
      useOpenAIKey()
      h.fetchMock.mockResolvedValueOnce(jsonResponse({ error: { message: 'bad key' } }, 401))

      const res = await app.inject({ method: 'POST', url: '/api/agent/chat', payload: { message: 'hi there' } })

      expect(res.statusCode).toBe(401)
      expect(res.json()).toEqual({ error: 'OpenAI authentication failed', reason: 'invalid_api_key' })
    })

    it('GET /api/agent/chat/stream validates message and key before streaming', async () => {
      const noMessage = await app.inject({ method: 'GET', url: '/api/agent/chat/stream' })
      expect(noMessage.statusCode).toBe(400)
      expect(noMessage.json()).toEqual({ error: 'Message is required' })

      const noKey = await app.inject({ method: 'GET', url: '/api/agent/chat/stream?message=hello' })
      expect(noKey.statusCode).toBe(400)
      expect(noKey.json()).toEqual({ error: 'OpenAI API key not configured' })
    })

    it('POST /api/agent/chat/stream validates message and key before streaming', async () => {
      const noMessage = await app.inject({ method: 'POST', url: '/api/agent/chat/stream', payload: {} })
      expect(noMessage.statusCode).toBe(400)
      expect(noMessage.json()).toEqual({ error: 'Message is required' })

      const noKey = await app.inject({ method: 'POST', url: '/api/agent/chat/stream', payload: { message: 'hello' } })
      expect(noKey.statusCode).toBe(400)
      expect(noKey.json()).toEqual({ error: 'OpenAI API key not configured' })
    })

    it('POST /api/agent/suggestions returns app-specific prompts', async () => {
      const sonarr = await app.inject({ method: 'POST', url: '/api/agent/suggestions', payload: { currentApp: 'sonarr' } })
      expect(sonarr.statusCode).toBe(200)
      expect(sonarr.json().suggestions).toEqual([
        { text: 'Connect to Prowlarr', agent: 'apps' },
        { text: 'Add download client', agent: 'apps' },
        { text: 'Set quality profiles', agent: 'apps' },
      ])

      const unknown = await app.inject({ method: 'POST', url: '/api/agent/suggestions', payload: { currentApp: 'nope' } })
      expect(unknown.json()).toEqual({ suggestions: [] })

      const noBody = await app.inject({ method: 'POST', url: '/api/agent/suggestions' })
      expect(noBody.statusCode).toBe(200)
      expect(noBody.json()).toEqual({ suggestions: [] })
    })

    it('POST /api/voice-agent requires a transcript', async () => {
      const res = await app.inject({ method: 'POST', url: '/api/voice-agent', payload: {} })

      expect(res.statusCode).toBe(400)
      expect(res.json()).toEqual({ error: 'transcript is required' })
    })

    it('POST /api/voice-agent extracts a plan and falls back without a key', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/voice-agent',
        payload: { transcript: 'I want Plex and Sonarr on my Synology at media.example.com' },
      })

      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.plan).toEqual({ services: ['plex', 'sonarr'], hosting: 'nas', domain: 'media.example.com' })
      expect(body.meta).toEqual({ usedFallback: true, reason: 'missing_api_key' })
      expect(typeof body.agentResponse).toBe('string')
    })

    it('POST /api/ai/service-config validates input and requires a key', async () => {
      const noService = await app.inject({ method: 'POST', url: '/api/ai/service-config', payload: {} })
      expect(noService.statusCode).toBe(400)
      expect(noService.json()).toEqual({ error: 'serviceId is required' })

      const noKey = await app.inject({ method: 'POST', url: '/api/ai/service-config', payload: { serviceId: 'sonarr' } })
      expect(noKey.statusCode).toBe(400)
      expect(noKey.json()).toEqual({ error: 'OpenAI API key is required', reason: 'missing_api_key' })
    })

    it('POST /api/ai/service-config returns the model JSON suggestion', async () => {
      useOpenAIKey()
      const suggestion = { suggestion: 'Use defaults', reasoning: 'Simple', config: { TZ: 'UTC' } }
      h.fetchMock.mockResolvedValueOnce(chatCompletion(JSON.stringify(suggestion)))

      const res = await app.inject({
        method: 'POST',
        url: '/api/ai/service-config',
        payload: { serviceId: 'sonarr', config: { timezone: 'UTC' } },
      })

      expect(res.statusCode).toBe(200)
      expect(res.json()).toEqual(suggestion)
      const sent = JSON.parse(String(fetchCalls()[0].init.body))
      expect(sent.response_format).toEqual({ type: 'json_object' })
      expect(sent.messages[1].content).toContain('The user is setting up sonarr.')
    })

    it('POST /api/ai/service-config maps an upstream 429 to rate_limited', async () => {
      useOpenAIKey()
      h.fetchMock.mockResolvedValueOnce(jsonResponse({ error: 'slow down' }, 429))

      const res = await app.inject({ method: 'POST', url: '/api/ai/service-config', payload: { serviceId: 'sonarr' } })

      expect(res.statusCode).toBe(429)
      expect(res.json()).toEqual({ error: 'OpenAI rate limited', reason: 'rate_limited' })
    })
  })

  describe('AI tools, knowledge and observability', () => {
    it('GET /api/ai/tools lists agent tools with descriptions', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/ai/tools' })

      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.tools).toEqual(expect.arrayContaining(['check_service_health', 'restart_service', 'analyze_logs']))
      for (const tool of body.tools) {
        expect(typeof body.descriptions[tool]).toBe('string')
      }
    })

    it('POST /api/ai/tools/:toolName returns 404 for unknown tools', async () => {
      const res = await app.inject({ method: 'POST', url: '/api/ai/tools/rm_rf', payload: {} })

      expect(res.statusCode).toBe(404)
      expect(res.json()).toEqual({ error: 'Tool "rm_rf" not found' })
    })

    it('GET /api/ai/providers reports OpenAI availability from the key', async () => {
      const off = await app.inject({ method: 'GET', url: '/api/ai/providers' })
      expect(off.json()).toEqual({ providers: { openai: false }, primary: 'openai' })

      useOpenAIKey()
      const on = await app.inject({ method: 'GET', url: '/api/ai/providers' })
      expect(on.json()).toEqual({ providers: { openai: true }, primary: 'openai' })
    })

    it('GET /api/ai/health, /api/ai/metrics and /api/ai/costs return metric summaries', async () => {
      const health = await app.inject({ method: 'GET', url: '/api/ai/health' })
      expect(health.statusCode).toBe(200)
      expect(health.json()).toEqual({
        status: expect.any(String),
        recentErrorRate: expect.any(Number),
        recentFallbackRate: expect.any(Number),
        averageLatencyMs: expect.any(Number),
        lastHourRequests: expect.any(Number),
      })

      const metrics = await app.inject({ method: 'GET', url: '/api/ai/metrics?agent=apps' })
      expect(metrics.statusCode).toBe(200)
      expect(Array.isArray(metrics.json().requests)).toBe(true)
      expect(metrics.json().aggregated).toMatchObject({ totalRequests: expect.any(Number), errorRate: expect.any(Number) })

      const costs = await app.inject({ method: 'GET', url: '/api/ai/costs' })
      expect(costs.statusCode).toBe(200)
      expect(costs.json()).toEqual({ totalCost: expect.any(Number), byModel: expect.any(Object), byAgent: expect.any(Object) })
    })

    it('GET /api/ai/knowledge/search requires q and returns ranked documents', async () => {
      const missing = await app.inject({ method: 'GET', url: '/api/ai/knowledge/search' })
      expect(missing.statusCode).toBe(400)
      expect(missing.json()).toEqual({ error: 'Query parameter q is required' })

      const res = await app.inject({ method: 'GET', url: '/api/ai/knowledge/search?q=gluetun%20vpn' })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.query).toBe('gluetun vpn')
      expect(body.results.length).toBeGreaterThan(0)
      expect(body.results[0].document).toMatchObject({ id: expect.any(String), title: expect.any(String) })

      const doc = await app.inject({ method: 'GET', url: `/api/ai/knowledge/${body.results[0].document.id}` })
      expect(doc.statusCode).toBe(200)
      expect(doc.json().id).toBe(body.results[0].document.id)
    })

    it('GET /api/ai/knowledge/:id returns 404 for unknown documents', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/ai/knowledge/does-not-exist' })

      expect(res.statusCode).toBe(404)
      expect(res.json()).toEqual({ error: 'Document not found' })
    })

    it('realtime endpoints require an OpenAI key', async () => {
      const status = await app.inject({ method: 'GET', url: '/api/ai/realtime/status' })
      expect(status.statusCode).toBe(200)
      expect(status.json()).toMatchObject({ available: false, configured: false })
      expect(status.json().features).toContain('voice-to-voice')

      const session = await app.inject({ method: 'POST', url: '/api/ai/realtime/session', payload: {} })
      expect(session.statusCode).toBe(400)
      expect(session.json()).toEqual({ error: 'OpenAI API key not configured' })

      const ephemeral = await app.inject({ method: 'POST', url: '/api/ai/realtime/ephemeral-key', payload: {} })
      expect(ephemeral.statusCode).toBe(400)
      expect(ephemeral.json()).toEqual({ error: 'OpenAI API key not configured' })
    })

    it('POST /api/ai/realtime/session returns websocket session config with a key', async () => {
      useOpenAIKey()

      const res = await app.inject({ method: 'POST', url: '/api/ai/realtime/session' })

      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.websocketUrl).toMatch(/^wss:\/\/api\.openai\.com\/.*\?model=/)
      expect(body.model).toBe('gpt-4o-realtime-preview-2024-12-17')
      expect(body.sessionConfig).toBeTruthy()
      expect(JSON.stringify(body)).not.toContain(VALID_OPENAI_KEY)
    })

    it('POST /api/ai/realtime/ephemeral-key exchanges the key for a short-lived token', async () => {
      useOpenAIKey()
      h.fetchMock.mockResolvedValueOnce(
        jsonResponse({
          id: 'sess_123',
          client_secret: { value: 'ek_test_value', expires_at: 1893456000 },
          model: 'gpt-4o-realtime-preview-2024-12-17',
          voice: 'cedar',
        })
      )

      const res = await app.inject({ method: 'POST', url: '/api/ai/realtime/ephemeral-key', payload: { voice: 'cedar' } })

      expect(res.statusCode).toBe(200)
      expect(res.json()).toMatchObject({
        ephemeralKey: 'ek_test_value',
        expiresAt: 1893456000,
        sessionId: 'sess_123',
        voice: 'cedar',
        sdpUrl: 'https://api.openai.com/v1/realtime/sdp?model=gpt-4o-realtime-preview-2024-12-17',
      })
      const [call] = fetchCalls()
      expect(call.url).toBe('https://api.openai.com/v1/realtime/sessions')
      expect((call.init.headers as Record<string, string>)['OpenAI-Beta']).toMatch(/^realtime=/)
      expect(JSON.stringify(res.json())).not.toContain(VALID_OPENAI_KEY)
    })
  })

  describe('conversations and troubleshooting sessions', () => {
    it('supports the conversation lifecycle', async () => {
      const created = await app.inject({
        method: 'POST',
        url: '/api/ai/conversations',
        payload: { message: 'My VPN keeps dropping', metadata: { agentId: 'troubleshoot' } },
      })
      expect(created.statusCode).toBe(200)
      const conversation = created.json()
      expect(conversation.id).toMatch(/^conv_[a-z0-9]+_[0-9a-f]{8}$/)
      expect(conversation.messages).toEqual([expect.objectContaining({ role: 'user', content: 'My VPN keeps dropping' })])
      expect(fs.existsSync(path.join(h.root, 'data', 'conversations', `${conversation.id}.json`))).toBe(true)

      const fetched = await app.inject({ method: 'GET', url: `/api/ai/conversations/${conversation.id}` })
      expect(fetched.statusCode).toBe(200)
      expect(fetched.json()).toMatchObject({ id: conversation.id, metadata: { agentId: 'troubleshoot' } })

      const listed = await app.inject({ method: 'GET', url: '/api/ai/conversations?limit=5' })
      expect(listed.statusCode).toBe(200)
      expect(listed.json().conversations.map((c: { id: string }) => c.id)).toContain(conversation.id)

      const deleted = await app.inject({ method: 'DELETE', url: `/api/ai/conversations/${conversation.id}` })
      expect(deleted.json()).toEqual({ deleted: true })

      const gone = await app.inject({ method: 'GET', url: `/api/ai/conversations/${conversation.id}` })
      expect(gone.statusCode).toBe(404)
      expect(gone.json()).toEqual({ error: 'Conversation not found' })
    })

    it('POST /api/ai/conversations without a body creates an empty conversation', async () => {
      const res = await app.inject({ method: 'POST', url: '/api/ai/conversations' })

      expect(res.statusCode).toBe(200)
      expect(res.json().messages).toEqual([])
    })

    it('GET /api/ai/conversations/:id does not follow path traversal', async () => {
      const res = await app.inject({ method: 'GET', url: `/api/ai/conversations/${encodeURIComponent('../../../etc/passwd')}` })

      expect(res.statusCode).toBe(404)
    })

    it('POST /api/ai/troubleshooting/sessions validates the problem description', async () => {
      const noBody = await app.inject({ method: 'POST', url: '/api/ai/troubleshooting/sessions' })
      expect(noBody.statusCode).toBe(400)
      expect(noBody.json()).toEqual({ error: 'problem.category and problem.description are required' })

      const noServices = await app.inject({
        method: 'POST',
        url: '/api/ai/troubleshooting/sessions',
        payload: { problem: { category: 'vpn', description: 'Gluetun unhealthy' } },
      })
      expect(noServices.statusCode).toBe(400)
      expect(noServices.json()).toEqual({ error: 'problem.affectedServices must be an array' })
    })

    it('supports the troubleshooting session lifecycle', async () => {
      const created = await app.inject({
        method: 'POST',
        url: '/api/ai/troubleshooting/sessions',
        payload: {
          problem: { category: 'vpn', description: 'Gluetun unhealthy', affectedServices: ['gluetun'], severity: 'high' },
        },
      })
      expect(created.statusCode).toBe(201)
      const session = created.json()
      expect(session).toMatchObject({ status: 'open', diagnostics: [], attemptedFixes: [] })
      expect(session.id).toMatch(/^ts_/)

      const needsResolution = await app.inject({
        method: 'PATCH',
        url: `/api/ai/troubleshooting/sessions/${session.id}`,
        payload: { status: 'resolved' },
      })
      expect(needsResolution.statusCode).toBe(400)
      expect(needsResolution.json()).toEqual({ error: 'resolution is required when status is "resolved"' })

      const noStatus = await app.inject({ method: 'PATCH', url: `/api/ai/troubleshooting/sessions/${session.id}` })
      expect(noStatus.statusCode).toBe(400)
      expect(noStatus.json()).toEqual({ error: 'status is required' })

      const resolved = await app.inject({
        method: 'PATCH',
        url: `/api/ai/troubleshooting/sessions/${session.id}`,
        payload: { status: 'resolved', resolution: { summary: 'Rotated WireGuard key' } },
      })
      expect(resolved.statusCode).toBe(200)
      expect(resolved.json()).toMatchObject({ id: session.id, status: 'resolved' })

      const filtered = await app.inject({ method: 'GET', url: '/api/ai/troubleshooting/sessions?category=vpn' })
      expect(filtered.json().sessions.map((s: { id: string }) => s.id)).toContain(session.id)

      const deleted = await app.inject({ method: 'DELETE', url: `/api/ai/troubleshooting/sessions/${session.id}` })
      expect(deleted.json()).toEqual({ deleted: true })

      const gone = await app.inject({ method: 'GET', url: `/api/ai/troubleshooting/sessions/${session.id}` })
      expect(gone.statusCode).toBe(404)
    })

    it('troubleshooting endpoints return 404 for unknown sessions', async () => {
      const patch = await app.inject({
        method: 'PATCH',
        url: '/api/ai/troubleshooting/sessions/ts_missing',
        payload: { status: 'closed' },
      })
      expect(patch.statusCode).toBe(404)

      const del = await app.inject({ method: 'DELETE', url: '/api/ai/troubleshooting/sessions/ts_missing' })
      expect(del.statusCode).toBe(404)
      expect(del.json()).toEqual({ error: 'Troubleshooting session not found' })
    })

    it('GET /api/ai/troubleshooting/metrics summarises sessions by category and status', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/ai/troubleshooting/metrics' })

      expect(res.statusCode).toBe(200)
      expect(Object.keys(res.json().sessionsByCategory).sort()).toEqual(['arr', 'docker', 'general', 'media', 'network', 'vpn'])
      expect(Object.keys(res.json().sessionsByStatus).sort()).toEqual(['closed', 'in_progress', 'open', 'resolved'])
    })
  })

  // ── Settings: OpenAI key, TTS, STT ──────────────────────────────────────

  describe('settings: openai-key, tts, stt', () => {
    it('GET /api/settings/openai-key reports no key by default', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/settings/openai-key' })

      expect(res.statusCode).toBe(200)
      expect(res.json()).toEqual({ hasKey: false, model: 'gpt-4o', ttsModel: 'tts-1-hd', ttsVoice: 'alloy' })
    })

    it.each([
      [{}, 'OpenAI API key is required.'],
      [{ key: 'pk-not-openai-0123456789' }, 'Invalid API key format: must start with "sk-"'],
      [{ key: 'sk-short' }, 'Invalid API key length: expected 20-200 characters'],
      [{ key: 'sk-has spaces and $ymbols!!' }, 'Invalid API key format: contains invalid characters'],
    ])('POST /api/settings/openai-key rejects %j', async (payload, error) => {
      const res = await app.inject({ method: 'POST', url: '/api/settings/openai-key', payload })

      expect(res.statusCode).toBe(400)
      expect(res.json()).toEqual({ error })
      expect(fs.existsSync(ENV_FILE)).toBe(false)
    })

    it('saves, reports and removes the OpenAI key via the .env file', async () => {
      const saved = await app.inject({ method: 'POST', url: '/api/settings/openai-key', payload: { openaiKey: ` ${VALID_OPENAI_KEY} ` } })
      expect(saved.statusCode).toBe(200)
      expect(saved.json()).toEqual({ success: true })
      expect(readEnvFile()).toBe(`OPENAI_API_KEY=${VALID_OPENAI_KEY}\n`)

      for (const url of ['/api/settings/openai-key', '/api/settings/openai-key/status', '/api/settings/tts', '/api/settings/stt']) {
        const res = await app.inject({ method: 'GET', url })
        expect(res.json().hasKey, url).toBe(true)
        expect(res.payload, url).not.toContain(VALID_OPENAI_KEY)
      }

      const removed = await app.inject({ method: 'DELETE', url: '/api/settings/openai-key' })
      expect(removed.statusCode).toBe(200)
      expect(removed.json()).toEqual({ success: true })
      expect(readEnvFile()).not.toContain('OPENAI_API_KEY')
      expect((await app.inject({ method: 'GET', url: '/api/settings/openai-key/status' })).json()).toEqual({
        hasKey: false,
        model: 'gpt-4o',
      })
    })

    it('reads a key stored only in the .env file', async () => {
      fs.writeFileSync(ENV_FILE, `OPENAI_API_KEY=${VALID_OPENAI_KEY}\n`)

      const res = await app.inject({ method: 'GET', url: '/api/settings/openai-key/status' })

      expect(res.json().hasKey).toBe(true)
    })

    it('GET /api/settings/tts and /api/settings/tts/status describe the TTS provider', async () => {
      const tts = await app.inject({ method: 'GET', url: '/api/settings/tts' })
      expect(tts.json()).toEqual({ provider: 'openai', hasKey: false, ttsModel: 'tts-1-hd', ttsVoice: 'alloy' })

      const status = await app.inject({ method: 'GET', url: '/api/settings/tts/status' })
      expect(status.json()).toEqual({ provider: 'openai', hasKey: false, model: 'tts-1-hd', voice: 'alloy' })
    })

    it('GET /api/settings/stt describes the transcription models', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/settings/stt' })

      expect(res.statusCode).toBe(200)
      expect(res.json()).toEqual({
        hasKey: false,
        model: 'gpt-4o-transcribe',
        fallbackModel: 'whisper-1',
        supportedFormats: ['mp3', 'mp4', 'mpeg', 'mpga', 'm4a', 'wav', 'webm', 'ogg'],
      })
    })
  })

  describe('text-to-speech and transcription', () => {
    it('POST /api/tts validates text', async () => {
      const missing = await app.inject({ method: 'POST', url: '/api/tts', payload: {} })
      expect(missing.statusCode).toBe(400)
      expect(missing.json()).toEqual({ error: 'text is required' })

      const blank = await app.inject({ method: 'POST', url: '/api/tts', payload: { text: '   ' } })
      expect(blank.statusCode).toBe(400)

      const tooLong = await app.inject({ method: 'POST', url: '/api/tts', payload: { text: 'a'.repeat(4001) } })
      expect(tooLong.statusCode).toBe(413)
      expect(tooLong.json()).toEqual({ error: 'text is too long' })
    })

    it('POST /api/tts requires an OpenAI key', async () => {
      const res = await app.inject({ method: 'POST', url: '/api/tts', payload: { text: 'Hello' } })

      expect(res.statusCode).toBe(400)
      expect(res.json()).toEqual({ error: 'OpenAI API key is required for TTS', reason: 'missing_api_key' })
      expect(h.fetchMock).not.toHaveBeenCalled()
    })

    it('POST /api/tts streams audio from OpenAI', async () => {
      useOpenAIKey()
      h.fetchMock.mockResolvedValueOnce(new Response(new Uint8Array([1, 2, 3, 4]), { status: 200 }))

      const res = await app.inject({ method: 'POST', url: '/api/tts', payload: { text: ' Hello ', format: 'wav', speed: 9 } })

      expect(res.statusCode).toBe(200)
      expect(res.headers['content-type']).toBe('audio/wav')
      expect(res.headers['cache-control']).toBe('no-store')
      expect(res.headers['x-tts-provider']).toBe('openai')
      expect(res.headers['x-tts-model']).toBe('tts-1-hd')
      expect([...res.rawPayload]).toEqual([1, 2, 3, 4])

      const sent = JSON.parse(String(fetchCalls()[0].init.body))
      // out-of-range speed is dropped rather than forwarded
      expect(sent).toEqual({ model: 'tts-1-hd', voice: 'alloy', input: 'Hello', response_format: 'wav' })
    })

    it('POST /api/tts maps upstream auth failures to 401', async () => {
      useOpenAIKey()
      h.fetchMock.mockImplementation(async () => new Response('denied', { status: 403 }))

      const res = await app.inject({ method: 'POST', url: '/api/tts', payload: { text: 'Hello' } })

      expect(res.statusCode).toBe(401)
      expect(res.json()).toEqual({ error: 'OpenAI authentication failed', reason: 'invalid_api_key', upstreamStatus: 403 })
      expect(h.fetchMock).toHaveBeenCalledTimes(2) // primary + fallback model
    })

    it('POST /api/transcribe requires an OpenAI key', async () => {
      const res = await app.inject({ method: 'POST', url: '/api/transcribe', ...multipartAudio(256) })

      expect(res.statusCode).toBe(400)
      expect(res.json()).toEqual({ error: 'OpenAI API key is required for transcription', reason: 'missing_api_key' })
    })

    it('POST /api/transcribe rejects recordings that are too short', async () => {
      useOpenAIKey()

      const res = await app.inject({ method: 'POST', url: '/api/transcribe', ...multipartAudio(10) })

      expect(res.statusCode).toBe(400)
      expect(res.json()).toEqual({ error: 'Audio recording too short', reason: 'audio_too_short' })
      expect(h.fetchMock).not.toHaveBeenCalled()
    })

    it('POST /api/transcribe transcribes multipart audio', async () => {
      useOpenAIKey()
      h.fetchMock.mockResolvedValueOnce(jsonResponse({ text: 'deploy the stack' }))

      const res = await app.inject({ method: 'POST', url: '/api/transcribe', ...multipartAudio(512) })

      expect(res.statusCode).toBe(200)
      expect(res.json()).toEqual({ text: 'deploy the stack', model: 'gpt-4o-transcribe' })
      const [call] = fetchCalls()
      expect(call.url).toBe('https://api.openai.com/v1/audio/transcriptions')
      const form = call.init.body as FormData
      expect(form.get('model')).toBe('gpt-4o-transcribe')
      expect((form.get('file') as File).size).toBe(512)
    })

    it('POST /api/transcribe falls back to whisper-1 when the primary model fails', async () => {
      useOpenAIKey()
      h.fetchMock
        .mockResolvedValueOnce(new Response('model not found', { status: 404 }))
        .mockResolvedValueOnce(jsonResponse({ text: 'fallback text' }))

      const res = await app.inject({ method: 'POST', url: '/api/transcribe', ...multipartAudio(512) })

      expect(res.statusCode).toBe(200)
      expect(res.json()).toEqual({ text: 'fallback text', model: 'whisper-1', fallback: true })
      expect((fetchCalls()[1].init.body as FormData).get('model')).toBe('whisper-1')
    })
  })

  // ── Orchestrator ────────────────────────────────────────────────────────

  describe('orchestrator', () => {
    it('GET /api/orchestrator/capabilities lists agents, tools and categories', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/orchestrator/capabilities' })

      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.success).toBe(true)
      expect(body.agents.map((a: { id: string }) => a.id)).toEqual(expect.arrayContaining(['setup', 'troubleshoot', 'deploy']))
      expect(body.tools.all).toEqual([...body.tools.agent, ...body.tools.orchestrator])
      expect(body.tools.orchestrator).toEqual(expect.arrayContaining(['start_category', 'deploy_stack']))
      expect(body.categories.pvr).toEqual(expect.arrayContaining(['sonarr', 'radarr']))
    })

    it('POST /api/orchestrator/chat validates the message', async () => {
      const notString = await app.inject({ method: 'POST', url: '/api/orchestrator/chat', payload: { message: 42 } })
      expect(notString.statusCode).toBe(400)
      expect(notString.json()).toEqual({ success: false, error: 'Message is required and must be a string' })

      const noBody = await app.inject({ method: 'POST', url: '/api/orchestrator/chat' })
      expect(noBody.statusCode).toBe(400)
      expect(noBody.json()).toEqual({ success: false, error: 'Message is required and must be a string' })
    })

    it('POST /api/orchestrator/chat reports a missing OpenAI key as an unsuccessful result', async () => {
      const res = await app.inject({ method: 'POST', url: '/api/orchestrator/chat', payload: { message: 'What is plex?' } })

      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.success).toBe(false)
      expect(body.agent).toBe('orchestrator')
      expect(body.error).toContain('OPENAI_API_KEY not configured')
    })

    it('POST /api/orchestrator/chat routes simple questions to a single agent', async () => {
      useOpenAIKey()
      h.fetchMock.mockResolvedValueOnce(chatCompletion('Plex is a media server.'))

      const res = await app.inject({ method: 'POST', url: '/api/orchestrator/chat', payload: { message: 'What is plex?' } })

      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body).toMatchObject({ success: true, response: 'Plex is a media server.' })
      expect(body.executionDetails).toMatchObject({ totalTasks: 1, completedTasks: 1, tokensUsed: { input: 11, output: 7 } })
      expect(fetchCalls().map((c) => c.url)).toEqual(['https://api.openai.com/v1/chat/completions'])
    })

    it('plan, task and abort endpoints return 404 for unknown plans', async () => {
      for (const [method, url] of [
        ['GET', '/api/orchestrator/plan/nope'],
        ['GET', '/api/orchestrator/tasks/nope'],
        ['POST', '/api/orchestrator/abort/nope'],
      ] as const) {
        const res = await app.inject({ method, url })
        expect(res.statusCode, url).toBe(404)
        expect(res.json().success, url).toBe(false)
      }
    })

    it('swarm endpoints initialise, spawn and report status in direct mode', async () => {
      const init = await app.inject({ method: 'POST', url: '/api/orchestrator/swarm/init', payload: { maxAgents: 2 } })
      expect(init.statusCode).toBe(200)
      expect(init.json()).toMatchObject({ success: true, provider: 'direct' })

      const noType = await app.inject({ method: 'POST', url: '/api/orchestrator/swarm/spawn', payload: {} })
      expect(noType.statusCode).toBe(400)
      expect(noType.json()).toEqual({ success: false, error: 'Agent type is required' })

      const spawned = await app.inject({ method: 'POST', url: '/api/orchestrator/swarm/spawn', payload: { type: 'coder', name: 'helper' } })
      expect(spawned.statusCode).toBe(200)
      expect(spawned.json()).toMatchObject({ success: true, agent: { name: 'helper' } })

      const status = await app.inject({ method: 'GET', url: '/api/orchestrator/swarm/status' })
      expect(status.statusCode).toBe(200)
      expect(status.json()).toMatchObject({ success: true, initialized: true, provider: 'direct' })
      expect(status.json().agents.map((a: { name: string }) => a.name)).toContain('helper')

      const cleanup = await app.inject({ method: 'POST', url: '/api/orchestrator/cleanup' })
      expect(cleanup.json()).toEqual({ success: true, message: 'Orchestrator resources cleaned up' })

      const stats = await app.inject({ method: 'GET', url: '/api/orchestrator/memory/stats' })
      expect(stats.json()).toMatchObject({ success: true, totalPlans: 0 })
    })

    it('POST /api/orchestrator/tools/execute validates the tool name', async () => {
      const missing = await app.inject({ method: 'POST', url: '/api/orchestrator/tools/execute', payload: {} })
      expect(missing.statusCode).toBe(400)
      expect(missing.json()).toEqual({ success: false, error: 'Tool name is required' })

      const noBody = await app.inject({ method: 'POST', url: '/api/orchestrator/tools/execute' })
      expect(noBody.statusCode).toBe(400)

      const unknown = await app.inject({ method: 'POST', url: '/api/orchestrator/tools/execute', payload: { tool: 'format_disk' } })
      expect(unknown.statusCode).toBe(200)
      expect(unknown.json()).toEqual({ success: false, tool: 'format_disk', error: 'Unknown tool: format_disk' })
      expect(procCalls()).toHaveLength(0)
    })

    it('POST /api/orchestrator/category/:action validates action and category', async () => {
      const badAction = await app.inject({ method: 'POST', url: '/api/orchestrator/category/destroy', payload: { category: 'pvr' } })
      expect(badAction.statusCode).toBe(400)
      expect(badAction.json()).toEqual({ success: false, error: 'Action must be "start" or "stop"' })

      const noCategory = await app.inject({ method: 'POST', url: '/api/orchestrator/category/start' })
      expect(noCategory.statusCode).toBe(400)
      expect(noCategory.json()).toEqual({ success: false, error: 'Category is required' })

      const unknown = await app.inject({ method: 'POST', url: '/api/orchestrator/category/stop', payload: { category: 'nope' } })
      expect(unknown.statusCode).toBe(200)
      expect(unknown.json()).toMatchObject({ success: false, category: 'nope', action: 'stop', services: [] })
      expect(unknown.json().message).toMatch(/^Unknown category: nope/)
    })

    it('POST /api/orchestrator/category/start starts the matching containers', async () => {
      setProcesses(
        dockerRouter([
          ['--filter name=gluetun', { stdout: 'gluetun\n' }],
          ['start gluetun', { stdout: 'gluetun' }],
        ])
      )

      const res = await app.inject({ method: 'POST', url: '/api/orchestrator/category/start', payload: { category: 'vpn' } })

      expect(res.statusCode).toBe(200)
      expect(res.json()).toMatchObject({ success: true, category: 'vpn', action: 'start', services: ['gluetun'] })
    })

    it('POST /api/orchestrator/deploy reports docker failures', async () => {
      const res = await app.inject({ method: 'POST', url: '/api/orchestrator/deploy', payload: { services: ['sonarr'] } })

      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.success).toBe(false)
      expect(body.deployed).toEqual([])
      expect(body.message).toContain('Required CLI "docker" is not available')
    })
  })

  // ── Remote deploy ───────────────────────────────────────────────────────

  describe('remote deploy', () => {
    // Pasted as a single line with escaped newlines, as UIs often send it.
    const TEST_KEY = '-----BEGIN OPENSSH PRIVATE KEY-----\\nabc123\\n-----END OPENSSH PRIVATE KEY-----'

    it.each([
      [{}, 'Invalid request'],
      [{ host: '10.0.0.5', username: 'media', port: 70000, privateKey: 'k' }, 'Invalid request'],
      [{ host: '10.0.0.5', username: 'media', authType: 'token', password: 'x' }, 'Invalid request'],
      [{ host: '10.0.0.5', username: 'media' }, 'Private key is required for SSH key authentication'],
      [{ host: '10.0.0.5', username: 'media', authType: 'password' }, 'Password is required for password authentication'],
    ])('POST /api/remote-deploy rejects %j', async (payload, error) => {
      const res = await app.inject({ method: 'POST', url: '/api/remote-deploy', payload })

      expect(res.statusCode).toBe(400)
      expect(res.json().error).toBe(error)
      expect(procCalls()).toHaveLength(0)
    })

    it('POST /api/remote-deploy rejects deploy paths that could inject shell commands', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/remote-deploy',
        payload: { host: '10.0.0.5', username: 'media', privateKey: TEST_KEY, deployPath: '~/stack; curl evil | sh' },
      })

      expect(res.statusCode).toBe(400)
      expect(res.json().error).toMatch(/^Invalid deploy path/)
      expect(procCalls()).toHaveLength(0)
    })

    it('POST /api/remote-deploy reports an SSH connection failure without deploying', async () => {
      setProcesses((cmd) => (cmd === 'ssh' ? { code: 255, stderr: 'ssh: connect to host 10.0.0.5 port 22: Connection refused' } : { missing: true }))

      const res = await app.inject({
        method: 'POST',
        url: '/api/remote-deploy',
        payload: { host: '10.0.0.5', username: 'media', privateKey: TEST_KEY },
      })

      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.success).toBe(false)
      expect(body.error).toMatch(/^Connection failed: ssh: connect to host 10\.0\.0\.5 port 22: Connection refused/)
      expect(body.steps).toEqual([{ step: 'Connecting to server...', status: 'error' }])
      expect(procCalls().map((c) => c.cmd)).toEqual(['ssh'])
    })

    it('POST /api/remote-deploy/test validates input', async () => {
      const res = await app.inject({ method: 'POST', url: '/api/remote-deploy/test', payload: { host: '', username: 'media' } })

      expect(res.statusCode).toBe(400)
      expect(res.json().error).toBe('Invalid request')
    })

    it('POST /api/remote-deploy/test checks SSH, Docker and Compose with key auth', async () => {
      const keyFiles: Array<{ path: string; existed: boolean; content: string; mode: number }> = []
      setProcesses((cmd, args) => {
        if (cmd !== 'ssh') return { missing: true }
        const keyPath = args[args.indexOf('-i') + 1]
        const exists = fs.existsSync(keyPath)
        keyFiles.push({
          path: keyPath,
          existed: exists,
          content: exists ? fs.readFileSync(keyPath, 'utf-8') : '',
          mode: exists ? fs.statSync(keyPath).mode & 0o777 : 0,
        })
        const command = args.at(-1)!
        if (command.startsWith('echo mediastack-ok')) return { stdout: 'mediastack-ok\n/home/media\n' }
        if (command === 'docker --version') return { stdout: 'Docker version 27.0.1\n' }
        if (command === 'docker info') return { stdout: 'Server: ok\n' }
        if (command === 'docker compose version') return { stdout: 'Docker Compose version v2.29.0\n' }
        return { code: 1, stderr: 'unexpected' }
      })

      const res = await app.inject({
        method: 'POST',
        url: '/api/remote-deploy/test',
        payload: { host: 'nas.local', port: '2222', username: 'media', privateKey: TEST_KEY },
      })

      expect(res.statusCode).toBe(200)
      expect(res.json()).toEqual({
        success: true,
        ssh: true,
        docker: true,
        dockerCompose: true,
        dockerInstalled: true,
        message: 'Ready to deploy!',
      })

      const sshCalls = procCalls().filter((c) => c.cmd === 'ssh')
      expect(sshCalls).toHaveLength(4)
      for (const call of sshCalls) {
        expect(call.args).toEqual(expect.arrayContaining(['-p', '2222', 'media@nas.local']))
        expect(call.args).toContain('StrictHostKeyChecking=accept-new')
      }
      // The private key is written to a 0600 temp file for each call and removed afterwards.
      expect(keyFiles).toHaveLength(4)
      for (const key of keyFiles) {
        expect(key.existed).toBe(true)
        expect(key.mode).toBe(0o600)
        expect(key.content).toBe('-----BEGIN OPENSSH PRIVATE KEY-----\nabc123\n-----END OPENSSH PRIVATE KEY-----\n')
        expect(fs.existsSync(key.path)).toBe(false)
      }
    })

    it('POST /api/remote-deploy/test passes passwords to sshpass via the environment only', async () => {
      setProcesses((cmd, args) => {
        if (cmd !== 'sshpass') return { missing: true }
        const command = args.at(-1)!
        if (command.startsWith('echo mediastack-ok')) return { stdout: 'mediastack-ok\n/home/media\n' }
        if (command === 'docker --version') return { code: 127, stderr: 'bash: docker: command not found' }
        if (command === 'docker compose version') return { code: 127, stderr: 'bash: docker: command not found' }
        if (command === 'docker-compose --version') return { code: 127, stderr: 'bash: docker-compose: command not found' }
        return { code: 1 }
      })

      const res = await app.inject({
        method: 'POST',
        url: '/api/remote-deploy/test',
        payload: { host: '10.0.0.5', username: 'media', password: 's3cret-pass' },
      })

      expect(res.statusCode).toBe(200)
      expect(res.json()).toMatchObject({ success: true, ssh: true, docker: false, dockerInstalled: false, message: 'Docker not found on server' })
      const calls = procCalls()
      expect(calls.length).toBeGreaterThan(0)
      for (const call of calls) {
        expect(call.cmd).toBe('sshpass')
        expect(call.args.slice(0, 2)).toEqual(['-e', 'ssh'])
        expect(call.args.join(' ')).not.toContain('s3cret-pass')
        expect(call.env?.SSHPASS).toBe('s3cret-pass')
      }
    })

    it('POST /api/remote-deploy/test returns 502 when SSH authentication fails', async () => {
      setProcesses((cmd) => (cmd === 'ssh' ? { code: 255, stderr: 'media@10.0.0.5: Permission denied (publickey).' } : { missing: true }))

      const res = await app.inject({
        method: 'POST',
        url: '/api/remote-deploy/test',
        payload: { host: '10.0.0.5', username: 'media', privateKey: TEST_KEY },
      })

      expect(res.statusCode).toBe(502)
      expect(res.json().success).toBe(false)
      expect(res.json().error).toMatch(/^SSH connection failed: media@10\.0\.0\.5: Permission denied \(publickey\)\./)
    })
  })

  // ── Backup & restore ────────────────────────────────────────────────────

  describe('backup and restore', () => {
    it('POST /api/backup/create validates the backup configuration', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/backup/create',
        payload: { destination: { type: 'ftp' }, items: [], encryption: { enabled: false } },
      })

      expect(res.statusCode).toBe(400)
      expect(res.json()).toMatchObject({ success: false, error: 'Invalid backup configuration' })
      expect(res.json().details.length).toBeGreaterThan(0)
    })

    it('POST /api/backup/create requires a password when encryption is enabled', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/backup/create',
        payload: {
          destination: localDestination('enc'),
          items: [{ type: 'config', name: 'sonarr', path: '/config' }],
          encryption: { enabled: true },
        },
      })

      expect(res.statusCode).toBe(400)
      expect(res.json().details).toEqual(expect.arrayContaining([expect.objectContaining({ path: ['encryption', 'password'] })]))
    })

    it('POST /api/backup/create starts a tracked background backup', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/backup/create',
        payload: {
          destination: localDestination('create'),
          items: [{ type: 'config', name: 'sonarr', path: '/config', service: 'sonarr' }],
          encryption: { enabled: false },
        },
      })

      expect(res.statusCode).toBe(202)
      const { backupId } = res.json()
      expect(res.json()).toEqual({ success: true, backupId: expect.any(String), message: 'Backup started' })

      const status = await app.inject({ method: 'GET', url: `/api/backup/status/${backupId}` })
      expect(status.statusCode).toBe(200)
      expect(status.json().progress).toMatchObject({ id: backupId, itemsTotal: 1 })
    })

    it('GET /api/backup/status/:id returns 404 for unknown backups', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/backup/status/unknown' })

      expect(res.statusCode).toBe(404)
      expect(res.json()).toEqual({ success: false, error: 'Backup not found' })
    })

    it('POST /api/backup/list lists an empty local destination', async () => {
      const res = await app.inject({ method: 'POST', url: '/api/backup/list', payload: { destination: localDestination('list') } })

      expect(res.statusCode).toBe(200)
      expect(res.json()).toEqual({ success: true, backups: [], total: 0, limit: 100, offset: 0 })
    })

    it('POST /api/backup/list returns backups that have a manifest', async () => {
      const dest = localDestination('list-found')
      fs.mkdirSync(dest.path, { recursive: true })
      const manifest = (id: string, createdAt: string) => ({
        id,
        name: `Backup ${id}`,
        createdAt,
        totalSize: 2048,
        totalCompressedSize: 1024,
        encrypted: false,
        items: [{ name: 'sonarr' }],
      })
      fs.writeFileSync(path.join(dest.path, 'old-1-manifest.json'), JSON.stringify(manifest('old-1', '2026-01-01T00:00:00.000Z')))
      fs.writeFileSync(path.join(dest.path, 'old-1.tar.gz'), 'archive')
      fs.writeFileSync(path.join(dest.path, 'new-2-manifest.json'), JSON.stringify(manifest('new-2', '2026-02-01T00:00:00.000Z')))
      fs.writeFileSync(path.join(dest.path, 'notes.txt'), 'not a backup')

      const res = await app.inject({ method: 'POST', url: '/api/backup/list', payload: { destination: dest } })

      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.total).toBe(2)
      expect(body.backups.map((b: { id: string }) => b.id)).toEqual(['new-2', 'old-1'])
      expect(body.backups[0]).toMatchObject({ itemCount: 1, size: 2048, encrypted: false, status: 'completed' })
    })

    it('scheduled retention deletes old backups and keeps shared archives still in use', async () => {
      const { applyRetentionPolicy } = await import('../src/services/backupScheduler.js')
      const dest = localDestination('retention')
      fs.mkdirSync(dest.path, { recursive: true })
      const write = (name: string, body = 'x') => fs.writeFileSync(path.join(dest.path, name), body)
      const manifest = (id: string, day: number, items: string[]) =>
        write(`${id}-manifest.json`, JSON.stringify({
          id,
          createdAt: `2026-01-0${day}T00:00:00.000Z`,
          encrypted: false,
          items: items.map((name) => ({ name })),
        }))

      // Made from the API: one archive per item, named after the item
      manifest('m-1', 1, ['sonarr', 'radarr'])
      write('sonarr.tar.gz')
      write('radarr.tar.gz')
      // Scheduled: one archive named after the backup id
      manifest('s-1', 2, ['lidarr']); write('s-1.tar.gz')
      manifest('s-2', 3, ['lidarr']); write('s-2.tar.gz')
      manifest('m-2', 4, ['sonarr'])
      manifest('s-3', 5, ['lidarr']); write('s-3.tar.gz')
      // Current naming: archives carry the backup id and are never shared
      manifest('n-0', 1, ['bazarr']); write('n-0-bazarr.tar.gz')
      // A manifest whose id would point outside the folder is never acted on
      write('evil-manifest.json', JSON.stringify({ id: '../outside', createdAt: '2025-01-01T00:00:00.000Z', items: [] }))
      fs.writeFileSync(path.join(dest.path, '..', 'outside-manifest.json'), 'keep me')

      await applyRetentionPolicy({ id: 'sched-1', retentionCount: 3, config: { destination: dest } } as never)

      expect(fs.readdirSync(dest.path).sort()).toEqual([
        'evil-manifest.json',
        'm-2-manifest.json',
        's-2-manifest.json',
        's-2.tar.gz',
        's-3-manifest.json',
        's-3.tar.gz',
        'sonarr.tar.gz',
      ])
      expect(fs.existsSync(path.join(dest.path, '..', 'outside-manifest.json'))).toBe(true)
    })

    it('keeps each backup of the same item separate so validate, restore and delete get the right one', async () => {
      const { uploadBackupFiles } = await import('../src/services/backup/backupTransfer.js')
      const { createAdapter } = await import('../src/services/backup/destinationAdapter.js')
      const { createHash } = await import('node:crypto')
      const dest = localDestination('per-backup-names')
      const tempDir = path.join(h.root, 'data', 'temp')
      const adapter = await createAdapter(dest)

      // Store two backups of the same item, the way createBackupArchive leaves them in temp
      const store = async (id: string, content: string, password?: string) => {
        fs.mkdirSync(tempDir, { recursive: true })
        fs.writeFileSync(path.join(tempDir, 'sonarr.tar.gz'), content)
        const manifest = {
          id,
          version: '1.0',
          name: id,
          createdAt: '2026-03-01T00:00:00.000Z',
          items: [{ type: 'config', name: 'sonarr', path: 'sonarr:/config', size: content.length, checksum: createHash('sha256').update(content).digest('hex') }],
          totalSize: content.length,
          totalCompressedSize: content.length,
          encrypted: !!password,
          checksumAlgorithm: 'sha256',
          metadata: {},
        }
        fs.writeFileSync(path.join(tempDir, `${id}-manifest.json`), JSON.stringify(manifest))
        return uploadBackupFiles(adapter, manifest as never, { tempDir, encryptionPassword: password })
      }

      expect(await store('bk-a', 'first backup of sonarr')).toEqual(['bk-a-sonarr.tar.gz', 'bk-a-manifest.json'])
      expect(await store('bk-b', 'second backup of sonarr')).toEqual(['bk-b-sonarr.tar.gz', 'bk-b-manifest.json'])
      expect(await store('bk-c', 'encrypted sonarr', 'correct horse battery')).toEqual(['bk-c-sonarr.tar.gz.enc', 'bk-c-manifest.json'])
      // Temp archives are cleaned up after upload
      expect(fs.existsSync(path.join(tempDir, 'sonarr.tar.gz'))).toBe(false)

      const validate = (backupId: string, decryptionPassword?: string) =>
        app.inject({ method: 'POST', url: '/api/backup/validate', payload: { backupId, destination: dest, decryptionPassword } })

      // With shared names the second backup overwrote the first, so the older one failed its checksum
      for (const id of ['bk-a', 'bk-b']) {
        const res = await validate(id)
        expect(res.json(), id).toMatchObject({ valid: true, errors: [] })
      }
      expect((await validate('bk-c', 'correct horse battery')).json()).toMatchObject({ valid: true, errors: [] })

      // Deleting one backup leaves the other's archive alone
      const del = await app.inject({ method: 'DELETE', url: '/api/backup/bk-a', payload: { destination: dest } })
      expect(del.json()).toMatchObject({ success: true, deletedFiles: ['bk-a-sonarr.tar.gz', 'bk-a-manifest.json'] })
      expect(fs.existsSync(path.join(dest.path, 'bk-b-sonarr.tar.gz'))).toBe(true)
      expect((await validate('bk-b')).json()).toMatchObject({ valid: true })
    })

    it('still validates and deletes older backups stored under the shared item name', async () => {
      const { createHash } = await import('node:crypto')
      const dest = localDestination('legacy-names')
      fs.mkdirSync(dest.path, { recursive: true })
      const content = 'legacy sonarr archive'
      fs.writeFileSync(path.join(dest.path, 'sonarr.tar.gz'), content)
      fs.writeFileSync(path.join(dest.path, 'old-1-manifest.json'), JSON.stringify({
        id: 'old-1', name: 'old-1', createdAt: '2025-12-01T00:00:00.000Z', encrypted: false, checksumAlgorithm: 'sha256',
        totalSize: 1, totalCompressedSize: 1, metadata: {},
        items: [{ type: 'config', name: 'sonarr', path: 'sonarr:/config', size: 1, checksum: createHash('sha256').update(content).digest('hex') }],
      }))

      const res = await app.inject({ method: 'POST', url: '/api/backup/validate', payload: { backupId: 'old-1', destination: dest } })
      expect(res.json()).toMatchObject({ valid: true, errors: [] })

      const del = await app.inject({ method: 'DELETE', url: '/api/backup/old-1', payload: { destination: dest } })
      expect(del.json()).toMatchObject({ success: true, deletedFiles: ['sonarr.tar.gz', 'old-1-manifest.json'] })
    })

    it('rejects backup ids that could reach outside the backup folder', async () => {
      const dest = localDestination('traversal')
      for (const backupId of ['../secrets', '..', 'a/b', 'x.y', '.hidden']) {
        const validate = await app.inject({ method: 'POST', url: '/api/backup/validate', payload: { backupId, destination: dest } })
        expect(validate.statusCode, `validate ${backupId}`).toBe(400)

        const preview = await app.inject({ method: 'POST', url: '/api/restore/preview', payload: { backupId, destination: dest } })
        expect(preview.statusCode, `preview ${backupId}`).toBe(400)

        const restore = await app.inject({ method: 'POST', url: '/api/restore/execute', payload: { backupId, destination: dest } })
        expect(restore.statusCode, `restore ${backupId}`).toBe(400)
      }

      const del = await app.inject({ method: 'DELETE', url: '/api/backup/..%2Fsecrets', payload: { destination: dest } })
      expect(del.statusCode).toBe(400)
    })

    it('POST /api/backup/list validates the destination', async () => {
      const res = await app.inject({ method: 'POST', url: '/api/backup/list', payload: { destination: { type: 's3' } } })

      expect(res.statusCode).toBe(400)
      expect(res.json()).toMatchObject({ success: false, error: 'Invalid request' })
    })

    it('POST /api/backup/test-connection tests a local destination', async () => {
      const ok = await app.inject({ method: 'POST', url: '/api/backup/test-connection', payload: localDestination('conn') })
      expect(ok.statusCode).toBe(200)
      expect(ok.json()).toEqual({ success: true, connected: true, message: 'Connection successful' })

      const invalid = await app.inject({ method: 'POST', url: '/api/backup/test-connection', payload: {} })
      expect(invalid.statusCode).toBe(400)
      expect(invalid.json()).toEqual({ success: false, error: 'Invalid destination configuration' })
    })

    it('POST /api/backup/validate returns 404 when the backup manifest is missing', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/backup/validate',
        payload: { backupId: 'missing', destination: localDestination('validate') },
      })

      expect(res.statusCode).toBe(404)
      expect(res.json().success).toBe(false)
    })

    it('DELETE /api/backup/:id validates the destination', async () => {
      const noBody = await app.inject({ method: 'DELETE', url: '/api/backup/bk-1' })
      expect(noBody.statusCode).toBe(400)
      expect(noBody.json()).toMatchObject({ success: false, error: 'Invalid request' })

      const missing = await app.inject({
        method: 'DELETE',
        url: '/api/backup/bk-404',
        payload: { destination: localDestination('delete') },
      })
      expect(missing.statusCode).toBe(404)
      expect(missing.json().success).toBe(false)
    })

    it('GET /api/backup/discover reports docker failures', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/backup/discover' })

      expect(res.statusCode).toBe(500)
      expect(res.json()).toMatchObject({ success: false, targets: [], totalSize: 0, count: 0 })
    })

    it('supports the backup schedule lifecycle', async () => {
      const invalid = await app.inject({ method: 'POST', url: '/api/backup/schedules', payload: { frequency: 'daily' } })
      expect(invalid.statusCode).toBe(400)
      expect(invalid.json().error).toMatch(/^Missing required fields/)

      const noBody = await app.inject({ method: 'POST', url: '/api/backup/schedules' })
      expect(noBody.statusCode).toBe(400)

      const created = await app.inject({
        method: 'POST',
        url: '/api/backup/schedules',
        payload: {
          enabled: false,
          frequency: 'daily',
          time: '03:30',
          retentionCount: 3,
          config: {
            destination: localDestination('scheduled'),
            items: [{ type: 'config', name: 'sonarr', path: '/config' }],
            encryption: { enabled: false },
            compress: true,
          },
        },
      })
      expect(created.statusCode).toBe(201)
      const schedule = created.json().schedule
      expect(schedule).toMatchObject({ enabled: false, frequency: 'daily', time: '03:30', id: expect.any(String) })
      expect(fs.existsSync(path.join(h.root, 'data', 'schedules', 'backup_schedules.json'))).toBe(true)

      const listed = await app.inject({ method: 'GET', url: '/api/backup/schedules' })
      expect(listed.json().schedules.map((s: { id: string }) => s.id)).toContain(schedule.id)

      const updated = await app.inject({ method: 'PUT', url: `/api/backup/schedules/${schedule.id}`, payload: { time: '04:45' } })
      expect(updated.statusCode).toBe(200)
      expect(updated.json().schedule).toMatchObject({ id: schedule.id, time: '04:45' })

      const fetched = await app.inject({ method: 'GET', url: `/api/backup/schedules/${schedule.id}` })
      expect(fetched.json().schedule.time).toBe('04:45')

      const removed = await app.inject({ method: 'DELETE', url: `/api/backup/schedules/${schedule.id}` })
      expect(removed.json()).toEqual({ success: true, message: 'Schedule deleted successfully' })

      for (const [method, url] of [
        ['GET', `/api/backup/schedules/${schedule.id}`],
        ['PUT', `/api/backup/schedules/${schedule.id}`],
        ['DELETE', `/api/backup/schedules/${schedule.id}`],
        ['POST', `/api/backup/schedules/${schedule.id}/trigger`],
      ] as const) {
        const res = await app.inject({ method, url, ...(method === 'PUT' ? { payload: { time: '05:00' } } : {}) })
        expect(res.statusCode, `${method} ${url}`).toBe(404)
        expect(res.json(), `${method} ${url}`).toEqual({ success: false, error: 'Schedule not found' })
      }
    })

    it('starts an enabled schedule as a cron task and removes it when disabled or deleted', async () => {
      const cron = (await import('node-cron')).default
      const taskFor = (id: string) => [...cron.getTasks().values()].find((t) => t.name === `backup-${id}`)

      const created = await app.inject({
        method: 'POST',
        url: '/api/backup/schedules',
        payload: {
          enabled: true,
          frequency: 'daily',
          time: '02:15',
          retentionCount: 2,
          config: {
            destination: localDestination('cron'),
            items: [{ type: 'config', name: 'radarr', path: '/config' }],
            encryption: { enabled: false },
            compress: true,
          },
        },
      })
      expect(created.statusCode).toBe(201)
      const { id } = created.json().schedule

      const task = taskFor(id)
      expect(task, 'enabled schedule has a cron task').toBeDefined()
      expect(task!.getStatus()).not.toBe('stopped')
      expect(task!.getPattern()).toBe('15 2 * * *')

      const disabled = await app.inject({ method: 'PUT', url: `/api/backup/schedules/${id}`, payload: { enabled: false } })
      expect(disabled.statusCode).toBe(200)
      expect(taskFor(id), 'disabled schedule has no cron task').toBeUndefined()

      const enabled = await app.inject({ method: 'PUT', url: `/api/backup/schedules/${id}`, payload: { enabled: true } })
      expect(enabled.statusCode).toBe(200)
      expect(taskFor(id)).toBeDefined()

      await app.inject({ method: 'DELETE', url: `/api/backup/schedules/${id}` })
      expect(taskFor(id), 'deleted schedule has no cron task').toBeUndefined()
    })

    it('POST /api/restore/preview validates input and returns 404 for unknown backups', async () => {
      const invalid = await app.inject({ method: 'POST', url: '/api/restore/preview', payload: { backupId: '' } })
      expect(invalid.statusCode).toBe(400)

      const missing = await app.inject({
        method: 'POST',
        url: '/api/restore/preview',
        payload: { backupId: 'nope', destination: localDestination('restore') },
      })
      expect(missing.statusCode).toBe(404)
      expect(missing.json()).toEqual({ success: false, error: 'Backup not found: nope' })
    })

    it('POST /api/restore/preview describes a stored backup and flags encryption', async () => {
      const dest = localDestination('preview')
      fs.mkdirSync(dest.path, { recursive: true })
      const manifest = {
        id: 'bk-2',
        name: 'weekly',
        createdAt: '2026-02-01T00:00:00.000Z',
        totalSize: 10,
        totalCompressedSize: 5,
        encrypted: false,
        items: [{ type: 'config', name: 'radarr', path: '/config', service: 'radarr', size: 10, compressedSize: 5 }],
        metadata: { version: '2.0.0' },
      }
      fs.writeFileSync(path.join(dest.path, 'bk-2-manifest.json'), JSON.stringify(manifest))
      fs.writeFileSync(path.join(dest.path, 'bk-3-manifest.json'), JSON.stringify({ ...manifest, id: 'bk-3', encrypted: true }))

      const plain = await app.inject({ method: 'POST', url: '/api/restore/preview', payload: { backupId: 'bk-2', destination: dest } })
      expect(plain.statusCode).toBe(200)
      expect(plain.json().preview).toMatchObject({
        id: 'bk-2',
        name: 'weekly',
        encrypted: false,
        items: [{ type: 'config', name: 'radarr', path: '/config', service: 'radarr', size: 10, compressedSize: 5 }],
      })

      const encrypted = await app.inject({ method: 'POST', url: '/api/restore/preview', payload: { backupId: 'bk-3', destination: dest } })
      expect(encrypted.statusCode).toBe(400)
      expect(encrypted.json()).toEqual({
        success: false,
        error: 'Backup is encrypted but no decryption password provided',
        encrypted: true,
      })
    })

    it('POST /api/restore/execute starts a tracked restore; status 404s for unknown ids', async () => {
      const invalid = await app.inject({ method: 'POST', url: '/api/restore/execute', payload: { backupId: 'x' } })
      expect(invalid.statusCode).toBe(400)
      expect(invalid.json()).toMatchObject({ success: false, error: 'Invalid restore configuration' })

      const started = await app.inject({
        method: 'POST',
        url: '/api/restore/execute',
        payload: { backupId: 'missing', destination: localDestination('restore-exec'), stopServices: false, backupBeforeRestore: false },
      })
      expect(started.statusCode).toBe(202)
      const { restoreId } = started.json()
      expect(started.json()).toEqual({ success: true, restoreId: expect.any(String), message: 'Restore started' })

      // The manifest does not exist, so the background restore must end up failed.
      await vi.waitFor(async () => {
        const status = await app.inject({ method: 'GET', url: `/api/restore/status/${restoreId}` })
        expect(status.statusCode).toBe(200)
        expect(status.json().progress).toMatchObject({ id: restoreId, status: 'failed' })
      })
      expect(dockerCalls()).toHaveLength(0)

      const unknown = await app.inject({ method: 'GET', url: '/api/restore/status/nope' })
      expect(unknown.statusCode).toBe(404)
      expect(unknown.json()).toEqual({ success: false, error: 'Restore operation not found' })
    })
  })

  // ── Configuration validation & VPN ──────────────────────────────────────

  describe('configuration validation', () => {
    beforeEach(async () => {
      await app.inject({ method: 'POST', url: '/api/validate/clear-cache' })
    })

    it('POST /api/validate requires a config object', async () => {
      const res = await app.inject({ method: 'POST', url: '/api/validate', payload: { validators: ['path'] } })

      expect(res.statusCode).toBe(400)
      expect(res.json().error).toBe('Invalid request body')
    })

    it('POST /api/validate rejects unknown validator names', async () => {
      const res = await app.inject({ method: 'POST', url: '/api/validate', payload: { config: {}, validators: ['shell'] } })

      expect(res.statusCode).toBe(400)
    })

    it('POST /api/validate aggregates path and port results', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/validate',
        payload: {
          config: { dataRoot: h.root, configRoot: `${h.root}-missing-config`, ports: [8989] },
          validators: ['path', 'port'],
        },
      })

      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.passed).toBe(false)
      expect(body.errorCount).toBe(1)
      expect(body.results.map((r: { validator: string }) => r.validator)).toEqual(['path', 'port'])
      expect(body.results[0].issues).toEqual([
        expect.objectContaining({ code: 'PATH_NOT_FOUND', severity: 'error', affectedField: 'configRoot' }),
      ])
      expect(body.results[1]).toMatchObject({ validator: 'port', passed: true })
    })

    it('POST /api/validate skips validators disabled in validatorConfigs', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/validate',
        payload: { config: {}, validators: ['docker'], validatorConfigs: { docker: { enabled: false } } },
      })

      expect(res.statusCode).toBe(200)
      expect(res.json()).toMatchObject({ passed: true, errorCount: 0, results: [] })
      expect(procCalls()).toHaveLength(0)
    })

    it('POST /api/validate/paths validates the configured paths', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/validate/paths',
        payload: { config: { dataRoot: h.root, configRoot: h.root } },
      })

      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.passed).toBe(true)
      expect(body.results[0].issues.map((i: { code: string }) => i.code)).toEqual(['PATH_DUPLICATE'])
    })

    it('POST /api/validate/ports flags privileged and conflicting ports', async () => {
      const res = await app.inject({ method: 'POST', url: '/api/validate/ports', payload: { config: { ports: [80, 3000] } } })

      expect(res.statusCode).toBe(200)
      const codes = res.json().results[0].issues.map((i: { code: string }) => i.code)
      expect(codes).toContain('PORT_PRIVILEGED')
      expect(codes).toContain('PORT_CONFLICT_SERVICES') // homepage and grafana both default to 3000
      expect(codes).toContain('PORT_COMMON_CONFLICT')
    })

    it('POST /api/validate/ports reports host ports already in use by other containers', async () => {
      setProcesses(dockerRouter([['ps --format', { stdout: 'some-other-app\t0.0.0.0:8989->80/tcp\n' }]]))

      const res = await app.inject({ method: 'POST', url: '/api/validate/ports', payload: { config: { ports: [8989] } } })

      expect(res.statusCode).toBe(200)
      expect(res.json().passed).toBe(false)
      expect(res.json().results[0].issues).toEqual([
        expect.objectContaining({ code: 'PORT_IN_USE_DOCKER', details: { port: 8989, containers: ['some-other-app'] } }),
      ])
    })

    it('POST /api/validate/docker reports a stopped docker daemon', async () => {
      setProcesses(dockerRouter([['info', DAEMON_DOWN]]))

      const res = await app.inject({ method: 'POST', url: '/api/validate/docker', payload: { config: {} } })

      expect(res.statusCode).toBe(200)
      expect(res.json()).toMatchObject({ passed: false, errorCount: 1 })
      expect(res.json().results[0].issues).toEqual([expect.objectContaining({ code: 'DOCKER_DAEMON_NOT_RUNNING' })])
    })

    it('POST /api/validate/docker passes against a healthy docker', async () => {
      setProcesses(
        dockerRouter([
          [/^info$/, { stdout: 'ok' }],
          ['version --format', { stdout: '27.0.1' }],
          ['compose version', { stdout: 'Docker Compose version v2.29.0' }],
          ['network ls', { stdout: 'bridge\tbridge\tlocal\nhost\thost\tlocal\n' }],
          ['network inspect', { stdout: '[]' }],
        ])
      )

      const res = await app.inject({ method: 'POST', url: '/api/validate/docker', payload: { config: {} } })

      expect(res.statusCode).toBe(200)
      expect(res.json()).toMatchObject({ passed: true, errorCount: 0 })
      expect(res.json().results[0].metadata).toMatchObject({ daemonAccessible: true })
    })

    it('POST /api/validate/vpn checks VPN credentials', async () => {
      const ok = await app.inject({
        method: 'POST',
        url: '/api/validate/vpn',
        payload: { config: { vpn: { type: 'openvpn', provider: 'protonvpn', credentials: { username: 'someuser', password: 'somepassword1' } } } },
      })
      expect(ok.statusCode).toBe(200)
      expect(ok.json()).toMatchObject({ passed: true, infoCount: 1 })
      expect(ok.json().results[0].issues[0].code).toBe('VPN_VALIDATION_SUCCESS')

      const bad = await app.inject({
        method: 'POST',
        url: '/api/validate/vpn',
        payload: { config: { vpn: { type: 'wireguard', credentials: { privateKey: 'short', addresses: '10.2.0.2/32' } } } },
      })
      expect(bad.statusCode).toBe(200)
      expect(bad.json().passed).toBe(false)
      expect(bad.json().results[0].issues.map((i: { code: string }) => i.code)).toContain('VPN_KEY_INVALID_LENGTH')
    })

    it('POST /api/validate/cloudflare rejects malformed tunnel tokens without network calls', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/validate/cloudflare',
        payload: { config: { cloudflare: { tunnelToken: 'not-a-jwt' } } },
      })

      expect(res.statusCode).toBe(200)
      expect(res.json().passed).toBe(false)
      expect(res.json().results[0].issues[0].code).toBe('CLOUDFLARE_TOKEN_INVALID_FORMAT')
      expect(h.fetchMock).not.toHaveBeenCalled()
    })

    it.each(['/api/validate/paths', '/api/validate/ports', '/api/validate/vpn', '/api/validate/cloudflare', '/api/validate/docker'])(
      'POST %s requires a config object',
      async (url) => {
        const res = await app.inject({ method: 'POST', url, payload: { config: 'nope' } })

        expect(res.statusCode).toBe(400)
        expect(res.json().error).toBe('Invalid request body')
      }
    )

    it('GET /api/validate/quick runs the docker and path checks', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/validate/quick?dataRoot=${encodeURIComponent(h.root)}&configRoot=${encodeURIComponent(h.root)}`,
      })

      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.results.map((r: { validator: string }) => r.validator).sort()).toEqual(['docker', 'path'])
      expect(body.results.find((r: { validator: string }) => r.validator === 'path').passed).toBe(true)
      expect(body.results.find((r: { validator: string }) => r.validator === 'docker').passed).toBe(false)
    })

    it('caches /api/validate results unless x-bypass-cache is set', async () => {
      const payload = { config: { ports: [8989] }, validators: ['port'] }
      setProcesses(dockerRouter([['ps --format', { stdout: '' }]]))

      await app.inject({ method: 'POST', url: '/api/validate', payload })
      await app.inject({ method: 'POST', url: '/api/validate', payload })
      expect(dockerCalls()).toHaveLength(1)

      await app.inject({ method: 'POST', url: '/api/validate', payload, headers: { 'x-bypass-cache': 'true' } })
      expect(dockerCalls()).toHaveLength(2)

      const cleared = await app.inject({ method: 'POST', url: '/api/validate/clear-cache' })
      expect(cleared.json()).toEqual({ success: true, message: 'Validation cache cleared' })
      await app.inject({ method: 'POST', url: '/api/validate', payload })
      expect(dockerCalls()).toHaveLength(3)
    })
  })

  describe('VPN pre-deploy validation', () => {
    const WG_KEY = 'yAnz5TF+lXXJte14tji3zlMNq+hd2rYUIgJBgB3fBmk='

    it('POST /api/vpn/validate rejects malformed requests', async () => {
      const res = await app.inject({ method: 'POST', url: '/api/vpn/validate', payload: { provider: '', protocol: 'pptp', credentials: {} } })

      expect(res.statusCode).toBe(400)
      const body = res.json()
      expect(body).toMatchObject({ success: false, valid: false, warnings: [] })
      expect(body.errors).toEqual(expect.arrayContaining(['provider: Provider is required']))
      expect(body.errors.some((e: string) => e.startsWith('protocol:'))).toBe(true)
    })

    it('POST /api/vpn/validate accepts well-formed WireGuard credentials', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/vpn/validate',
        payload: { provider: 'mullvad', protocol: 'wireguard', credentials: { WIREGUARD_PRIVATE_KEY: WG_KEY, WIREGUARD_ADDRESSES: '10.64.0.2/32' } },
      })

      expect(res.statusCode).toBe(200)
      expect(res.json()).toEqual({
        success: true,
        valid: true,
        errors: [],
        warnings: [],
        details: { wireGuard: { privateKeyValid: true, addressesValid: true } },
      })
    })

    it('POST /api/vpn/validate reports invalid keys and port-forwarding support', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/vpn/validate',
        payload: {
          provider: 'nordvpn',
          protocol: 'wireguard',
          credentials: { WIREGUARD_PRIVATE_KEY: 'not base64!', WIREGUARD_ADDRESSES: '10.5.0.2' },
          portForwardingEnabled: true,
        },
      })

      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.valid).toBe(false)
      expect(body.errors).toEqual(
        expect.arrayContaining(['Private key has invalid length (expected ~44 characters, got 11)', 'Private key is not valid base64 format'])
      )
      expect(body.warnings).toEqual(
        expect.arrayContaining([
          expect.stringMatching(/^Port forwarding is not supported by nordvpn/),
          'NordVPN does not support port forwarding. Consider switching to Mullvad or ProtonVPN.',
        ])
      )
    })

    it('POST /api/vpn/validate requires OpenVPN username and password', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/vpn/validate',
        payload: { provider: 'protonvpn', protocol: 'openvpn', credentials: { OPENVPN_USER: 'me' } },
      })

      expect(res.statusCode).toBe(200)
      expect(res.json()).toMatchObject({ valid: false, errors: ['OpenVPN password is required'] })
    })
  })

  // ── Error handling & edge cases ─────────────────────────────────────────

  describe('error handling and edge cases', () => {
    it('rejects malformed JSON with 400', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/orchestrator/chat',
        headers: { 'content-type': 'application/json' },
        payload: '{"message": "unterminated',
      })

      expect(res.statusCode).toBe(400)
      expect(res.json()).toMatchObject({ statusCode: 400, code: 'FST_ERR_CTP_INVALID_JSON_BODY', error: 'Bad Request' })
    })

    it('rejects an empty JSON body with 400', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/vpn/validate',
        headers: { 'content-type': 'application/json' },
        payload: '',
      })

      expect(res.statusCode).toBe(400)
      expect(res.json().code).toBe('FST_ERR_CTP_EMPTY_JSON_BODY')
    })

    it('rejects unsupported content types with 415', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/vpn/validate',
        headers: { 'content-type': 'application/xml' },
        payload: '<vpn/>',
      })

      expect(res.statusCode).toBe(415)
      expect(res.json().code).toBe('FST_ERR_CTP_INVALID_MEDIA_TYPE')
    })

    it('rejects bodies over the 1 MiB limit with 413', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/agent/chat',
        payload: { message: 'x'.repeat(1024 * 1024 + 1) },
      })

      expect(res.statusCode).toBe(413)
      expect(res.json().code).toBe('FST_ERR_CTP_BODY_TOO_LARGE')
    })

    it('accepts large bodies under the limit', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/orchestrator/tools/execute',
        payload: { tool: 'nope', params: { blob: 'x'.repeat(900_000) } },
      })

      expect(res.statusCode).toBe(200)
      expect(res.json().error).toBe('Unknown tool: nope')
    })

    it('returns a JSON 404 for unknown routes and wrong methods', async () => {
      const unknown = await app.inject({ method: 'GET', url: '/api/does-not-exist' })
      expect(unknown.statusCode).toBe(404)
      expect(unknown.json()).toEqual({ message: 'Route GET:/api/does-not-exist not found', error: 'Not Found', statusCode: 404 })

      const wrongMethod = await app.inject({ method: 'GET', url: '/api/tts' })
      expect(wrongMethod.statusCode).toBe(404)
    })

    it('handles unicode and markup in chat messages', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/agent/chat',
        payload: { message: '¿Cómo configuro Plex? 🎬 <script>alert("x")</script>', agentId: 'apps' },
      })

      expect(res.statusCode).toBe(200)
      expect(res.json().agent.id).toBe('apps')
    })

    it('treats URL-encoded special characters in params as data', async () => {
      const res = await app.inject({ method: 'GET', url: `/api/backup/status/${encodeURIComponent('../../etc/passwd')}` })

      expect(res.statusCode).toBe(404)
      expect(res.json()).toEqual({ success: false, error: 'Backup not found' })
    })
  })

  // ── CORS, headers, compression ──────────────────────────────────────────

  describe('CORS and response headers', () => {
    it('answers preflight requests from the local docs-site origin', async () => {
      const res = await app.inject({
        method: 'OPTIONS',
        url: '/api/agent/chat',
        headers: { origin: 'http://localhost:5173', 'access-control-request-method': 'POST' },
      })

      expect(res.statusCode).toBe(204)
      expect(res.headers['access-control-allow-origin']).toBe('http://localhost:5173')
      expect(String(res.headers['access-control-allow-methods'])).toContain('POST')
    })

    it.each(['http://192.168.1.50:3002', 'http://10.0.0.8:5173', 'http://mediaserver.local', 'http://[::1]:3000'])(
      'allows local-network origin %s by default',
      async (origin) => {
        const res = await app.inject({ method: 'GET', url: '/api/health', headers: { origin } })

        expect(res.statusCode).toBe(200)
        expect(res.headers['access-control-allow-origin']).toBe(origin)
        expect(String(res.headers.vary)).toContain('Origin')
      }
    )

    it.each(['https://evil.example.com', 'http://8.8.8.8', 'null'])('rejects non-local origin %s with 403', async (origin) => {
      const res = await app.inject({ method: 'GET', url: '/api/system/status', headers: { origin } })

      expect(res.statusCode).toBe(403)
      expect(res.json()).toMatchObject({ statusCode: 403, message: 'Not allowed by CORS' })
      expect(res.headers['access-control-allow-origin']).toBeUndefined()
    })

    it('does not add CORS headers to requests without an Origin', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/health' })

      expect(res.statusCode).toBe(200)
      expect(res.headers['access-control-allow-origin']).toBeUndefined()
    })

    it('restricts origins to CONTROL_SERVER_CORS_ORIGINS when it is set', async () => {
      process.env.CONTROL_SERVER_CORS_ORIGINS = 'https://ui.example.com, https://admin.example.com'
      const restricted = await buildApp()
      try {
        await restricted.ready()
        const allowed = await restricted.inject({ method: 'GET', url: '/api/health', headers: { origin: 'https://admin.example.com' } })
        expect(allowed.statusCode).toBe(200)
        expect(allowed.headers['access-control-allow-origin']).toBe('https://admin.example.com')

        const lan = await restricted.inject({ method: 'GET', url: '/api/health', headers: { origin: 'http://192.168.1.50:3002' } })
        expect(lan.statusCode).toBe(403)
      } finally {
        delete process.env.CONTROL_SERVER_CORS_ORIGINS
        await restricted.close()
      }
    })

    it('does not advertise the server implementation', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/health' })

      expect(res.headers['x-powered-by']).toBeUndefined()
      expect(res.headers.server).toBeUndefined()
    })

    it('adds rate-limit headers to API responses but not to the health check', async () => {
      const status = await app.inject({ method: 'GET', url: '/api/system/status' })
      expect(status.headers['x-ratelimit-limit']).toBe('1000')
      expect(Number(status.headers['x-ratelimit-remaining'])).toBeLessThan(1000)

      const health = await app.inject({ method: 'GET', url: '/api/health' })
      expect(health.headers['x-ratelimit-limit']).toBeUndefined()
    })

    it('gzips large JSON responses when the client accepts it', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/orchestrator/capabilities',
        headers: { 'accept-encoding': 'gzip' },
      })

      expect(res.statusCode).toBe(200)
      expect(res.headers['content-encoding']).toBe('gzip')
      const body = JSON.parse(gunzipSync(res.rawPayload).toString('utf-8'))
      expect(body.success).toBe(true)
    })

    it('does not compress small responses', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/health', headers: { 'accept-encoding': 'gzip' } })

      expect(res.headers['content-encoding']).toBeUndefined()
      expect(res.json().status).toBe('online')
    })
  })

  // ── Concurrency & rate limiting ─────────────────────────────────────────

  describe('concurrent and rapid requests', () => {
    it('serves concurrent health checks consistently', async () => {
      const responses = await Promise.all(Array.from({ length: 25 }, () => app.inject({ method: 'GET', url: '/api/health' })))

      for (const res of responses) {
        expect(res.statusCode).toBe(200)
        expect(res.json()).toEqual({ status: 'online', version: '2.0.0', backend: 'fastify' })
      }
    })

    it('never rate-limits the health check', async () => {
      const codes = new Set<number>()
      for (let i = 0; i < 60; i++) codes.add((await app.inject({ method: 'GET', url: '/api/health' })).statusCode)

      expect([...codes]).toEqual([200])
    })

    it('coalesces concurrent container listings into one docker call', async () => {
      setProcesses(dockerRouter([['ps -a --format', { stdout: '"id1|sonarr|Up|running|"\n', delayMs: 50 }]]))

      const responses = await Promise.all(Array.from({ length: 10 }, () => app.inject({ method: 'GET', url: '/api/containers' })))

      for (const res of responses) {
        expect(res.statusCode).toBe(200)
        expect(res.json()).toEqual([{ id: 'id1', name: 'sonarr', status: 'Up', state: 'running', ports: '' }])
      }
      expect(dockerCalls()).toHaveLength(1)
    })

    it('keeps concurrent mixed requests isolated', async () => {
      const [agents, status, missing, invalidName] = await Promise.all([
        app.inject({ method: 'GET', url: '/api/agents' }),
        app.inject({ method: 'GET', url: '/api/system/status' }),
        app.inject({ method: 'GET', url: '/api/orchestrator/plan/missing' }),
        app.inject({ method: 'POST', url: '/api/containers/stop/%24%28id%29' }),
      ])

      expect(agents.statusCode).toBe(200)
      expect(status.statusCode).toBe(200)
      expect(missing.statusCode).toBe(404)
      expect(invalidName.statusCode).toBe(400)
    })

    it('enforces the global rate limit (CONTROL_SERVER_RATE_LIMIT_MAX)', async () => {
      process.env.CONTROL_SERVER_RATE_LIMIT_MAX = '3'
      const limited = await buildApp()
      try {
        await limited.ready()
        const codes: number[] = []
        for (let i = 0; i < 4; i++) codes.push((await limited.inject({ method: 'GET', url: '/api/system/status' })).statusCode)
        expect(codes).toEqual([200, 200, 200, 429])

        const blocked = await limited.inject({ method: 'GET', url: '/api/system/status' })
        expect(blocked.statusCode).toBe(429)
        expect(blocked.json()).toEqual({
          statusCode: 429,
          error: 'Too Many Requests',
          message: expect.stringMatching(/^Rate limit exceeded\. Try again in \d+ seconds\.$/),
          retryAfter: expect.any(Number),
        })
        expect(blocked.headers['retry-after']).toBeDefined()

        const health = await limited.inject({ method: 'GET', url: '/api/health' })
        expect(health.statusCode).toBe(200)
      } finally {
        delete process.env.CONTROL_SERVER_RATE_LIMIT_MAX
        await limited.close()
      }
    })

    it('applies the stricter per-prefix limits (orchestrator 10/min, agent 15/min, tts 20/min)', async () => {
      const limited = await buildApp()
      try {
        await limited.ready()
        const hit = async (method: 'GET' | 'POST', url: string, n: number) => {
          const codes: number[] = []
          for (let i = 0; i < n; i++) codes.push((await limited.inject({ method, url, payload: method === 'POST' ? {} : undefined })).statusCode)
          return codes
        }

        const orchestrator = await hit('GET', '/api/orchestrator/capabilities', 11)
        expect(orchestrator.slice(0, 10)).toEqual(Array(10).fill(200))
        expect(orchestrator[10]).toBe(429)
        const blocked = await limited.inject({ method: 'GET', url: '/api/orchestrator/capabilities' })
        expect(blocked.json()).toMatchObject({ statusCode: 429, error: 'Orchestrator Rate Limit Exceeded' })
        expect(blocked.headers['x-ratelimit-limit']).toBe('10')

        const agent = await hit('POST', '/api/agent/suggestions', 16)
        expect(agent.filter((c) => c === 429)).toHaveLength(1)
        expect(agent[15]).toBe(429)

        // Separate buckets: other endpoints are unaffected
        expect((await limited.inject({ method: 'GET', url: '/api/system/status' })).statusCode).toBe(200)
      } finally {
        await limited.close()
      }
    })

    it('can disable rate limiting (CONTROL_SERVER_RATE_LIMIT_DISABLED)', async () => {
      process.env.CONTROL_SERVER_RATE_LIMIT_DISABLED = 'true'
      process.env.CONTROL_SERVER_RATE_LIMIT_MAX = '1'
      const unlimited = await buildApp()
      try {
        await unlimited.ready()
        const responses = await Promise.all(Array.from({ length: 5 }, () => unlimited.inject({ method: 'GET', url: '/api/system/status' })))
        expect(responses.map((r) => r.statusCode)).toEqual([200, 200, 200, 200, 200])
        expect(responses[0].headers['x-ratelimit-limit']).toBeUndefined()
      } finally {
        delete process.env.CONTROL_SERVER_RATE_LIMIT_DISABLED
        delete process.env.CONTROL_SERVER_RATE_LIMIT_MAX
        await unlimited.close()
      }
    })
  })
})
