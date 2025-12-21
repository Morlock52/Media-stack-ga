import http from 'node:http'
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'

const DEFAULT_PORT = parseInt(process.env.PORT || '3001', 10)
const DEFAULT_BASE = `http://127.0.0.1:${DEFAULT_PORT}`

const BASE = process.env.CONTROL_SERVER_URL || DEFAULT_BASE
const AUTH_TOKEN = (process.env.CONTROL_SERVER_TOKEN || '').trim()
const CONCURRENT_REQUESTS = parseInt(process.env.CONCURRENT_REQUESTS || '30', 10)
const TOTAL_REQUESTS = parseInt(process.env.TOTAL_REQUESTS || '500', 10)
const REQUEST_TIMEOUT_MS = parseInt(process.env.REQUEST_TIMEOUT_MS || '15000', 10)
const START_CONTROL_SERVER = process.env.START_CONTROL_SERVER === '1'
const INCLUDE_DOCKER_ENDPOINTS = process.env.INCLUDE_DOCKER_ENDPOINTS === '1'
const INCLUDE_MUTATING_ENDPOINTS = process.env.INCLUDE_MUTATING_ENDPOINTS === '1'
const INCLUDE_ARR_BOOTSTRAP = process.env.INCLUDE_ARR_BOOTSTRAP === '1'

const percentile = (sortedValues, p) => {
    if (sortedValues.length === 0) return null
    const idx = Math.max(0, Math.min(sortedValues.length - 1, Math.ceil((p / 100) * sortedValues.length) - 1))
    return sortedValues[idx]
}

const request = (method, requestPath, body) => new Promise((resolve, reject) => {
    const start = Date.now()
    const url = new URL(requestPath, BASE)
    const data = body ? JSON.stringify(body) : ''

    const req = http.request(
        url,
        {
            method,
            headers: {
                ...(AUTH_TOKEN ? { Authorization: `Bearer ${AUTH_TOKEN}` } : null),
                ...(body
                    ? {
                        'Content-Type': 'application/json',
                        'Content-Length': Buffer.byteLength(data),
                    }
                    : null),
            },
        },
        res => {
            res.resume()
            res.on('end', () => {
                resolve({
                    method,
                    path: requestPath,
                    status: res.statusCode,
                    duration: Date.now() - start
                })
            })
        }
    )

    req.setTimeout(REQUEST_TIMEOUT_MS, () => req.destroy(new Error(`timeout after ${REQUEST_TIMEOUT_MS}ms`)))
    req.on('error', reject)
    if (body) req.write(data)
    req.end()
})

const waitForHealth = async (timeoutMs = 15000) => {
    const start = Date.now()
    while (Date.now() - start < timeoutMs) {
        try {
            const res = await request('GET', '/api/health')
            if (res.status === 200) return true
        } catch {
            // ignore
        }
        await new Promise(r => setTimeout(r, 250))
    }
    return false
}

const startControlServerIfRequested = async () => {
    if (!START_CONTROL_SERVER) return null

    const distIndex = path.join(process.cwd(), 'dist', 'index.js')
    if (!fs.existsSync(distIndex)) {
        console.error('❌ START_CONTROL_SERVER=1 but control-server is not built.')
        console.error('   Run: npm -w control-server run build')
        process.exit(1)
    }

    console.log(`ℹ️  Starting control-server (PORT=${DEFAULT_PORT}) for this stress run...`)
    const stressRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'mediastack-control-server-stress-'))
    const child = spawn('node', ['dist/index.js'], {
        stdio: ['ignore', 'pipe', 'pipe'],
        env: {
            ...process.env,
            PORT: String(DEFAULT_PORT),
            CONTROL_SERVER_HOST: '127.0.0.1',
            // Force a clean project root with no `.env` so we don't accidentally hit OpenAI.
            PROJECT_ROOT: stressRoot,
            CONTROL_SERVER_TOKEN: '',
        },
    })

    child.stdout.on('data', (d) => {
        if (process.env.STRESS_LOG_SERVER === '1') process.stdout.write(d.toString())
    })
    child.stderr.on('data', (d) => {
        if (process.env.STRESS_LOG_SERVER === '1') process.stderr.write(d.toString())
    })

    const ok = await waitForHealth()
    if (!ok) {
        child.kill('SIGTERM')
        console.error('❌ control-server did not become healthy in time')
        process.exit(1)
    }

    console.log('✅ control-server is healthy')
    return { child, stressRoot }
}

async function stressTest() {
    const server = await startControlServerIfRequested()

    console.log(`🔥 Starting stress test: ${TOTAL_REQUESTS} requests (${CONCURRENT_REQUESTS} concurrent)`)
    console.log(`ℹ️  Target: ${BASE}`)
    console.log(`ℹ️  Docker endpoints: ${INCLUDE_DOCKER_ENDPOINTS ? 'enabled' : 'disabled'} (set INCLUDE_DOCKER_ENDPOINTS=1)`)
    console.log(`ℹ️  Mutating endpoints: ${INCLUDE_MUTATING_ENDPOINTS ? 'enabled' : 'disabled'} (set INCLUDE_MUTATING_ENDPOINTS=1)`)
    console.log(`ℹ️  *Arr bootstrap: ${INCLUDE_ARR_BOOTSTRAP ? 'enabled' : 'disabled'} (set INCLUDE_ARR_BOOTSTRAP=1)`)
    console.log(`ℹ️  Auth token: ${AUTH_TOKEN ? 'provided' : 'not provided'} (set CONTROL_SERVER_TOKEN=...)`)

    const errors = []
    const results = []
    let issued = 0

    const requestSpecs = [
        { label: 'root', method: 'GET', path: '/', ok: [200] },
        { label: 'health', method: 'GET', path: '/api/health', ok: [200] },
        { label: 'agents', method: 'GET', path: '/api/agents', ok: [200] },
        { label: 'settings.openai-key.get', method: 'GET', path: '/api/settings/openai-key', ok: [200] },

        { label: 'agent.chat', method: 'POST', path: '/api/agent/chat', ok: [200, 401, 429, 502], body: { message: 'hello', agentId: 'general' } },
        // May require a key; allow common auth/validation failures for stress runs.
        { label: 'voice', method: 'POST', path: '/api/voice-agent', ok: [200, 400, 401, 429, 502], body: { transcript: 'help me pick apps' } },

        // Negative/safety tests (exercise validation paths without doing destructive work)
        { label: 'ai.service-config.bad', method: 'POST', path: '/api/ai/service-config', ok: [400], body: { userContext: 'test' } },
        { label: 'tts.bad', method: 'POST', path: '/api/tts', ok: [400], body: {} },
        { label: 'docker.action.bad', method: 'POST', path: '/api/service/invalid', ok: [400], body: { serviceName: 'does-not-matter' } },
        { label: 'remote.bad', method: 'POST', path: '/api/remote-deploy', ok: [400], body: { host: '1.2.3.4', username: 'root' } },
        { label: 'remote.test.bad', method: 'POST', path: '/api/remote-deploy/test', ok: [400], body: { host: '1.2.3.4', username: 'root' } },
        { label: 'remote.test.unreachable', method: 'POST', path: '/api/remote-deploy/test', ok: [502], body: { host: '127.0.0.1', port: 22, username: 'test', authType: 'password', password: 'bad' } },
        { label: 'remote.deploy.unreachable', method: 'POST', path: '/api/remote-deploy', ok: [200, 409], body: { host: '127.0.0.1', port: 22, username: 'test', authType: 'password', password: 'bad', deployPath: '~/media-stack' } },
        { label: 'settings.openai-key.post.bad', method: 'POST', path: '/api/settings/openai-key', ok: [400], body: { key: 'short' } },
    ]

    if (INCLUDE_DOCKER_ENDPOINTS) {
        requestSpecs.push(
            { label: 'docker.containers', method: 'GET', path: '/api/containers', ok: [200, 500] },
            { label: 'docker.health-snapshot', method: 'GET', path: '/api/health-snapshot', ok: [200, 500] },
            // Valid action but likely fails in non-docker environments; we accept errors for stress.
            { label: 'docker.service.start', method: 'POST', path: '/api/service/start', ok: [200, 400, 500], body: { serviceName: 'nonexistent-service' } },
        )
    }

    if (INCLUDE_ARR_BOOTSTRAP) {
        requestSpecs.push(
            { label: 'arr.bootstrap', method: 'POST', path: '/api/arr/bootstrap', ok: [200, 500] },
        )
    }

    if (INCLUDE_MUTATING_ENDPOINTS) {
        requestSpecs.push(
            // Explicitly mutating: writes to PROJECT_ROOT/.env or deletes key.
            // Only enable when START_CONTROL_SERVER=1 or you accept changes to your target server.
            { label: 'settings.openai-key.post', method: 'POST', path: '/api/settings/openai-key', ok: [200, 500], body: { key: 'sk-test-key-for-stress-0000000000' } },
            { label: 'settings.openai-key.delete', method: 'DELETE', path: '/api/settings/openai-key', ok: [200, 500] },
        )
    }

    const worker = async () => {
        while (true) {
            const current = ++issued
            if (current > TOTAL_REQUESTS) return
            try {
                const spec = requestSpecs[current % requestSpecs.length]
                const res = await request(spec.method, spec.path, spec.body)
                const ok = spec.ok.includes(res.status)
                results.push({ ...res, label: spec.label, ok })

                if (!ok) {
                    errors.push(`Req ${current} (${spec.label}): Status ${res.status}`)
                }

                if (current % 25 === 0) process.stdout.write('.')
            } catch (err) {
                const message = err && typeof err === 'object' && 'message' in err ? err.message : String(err)
                errors.push(`Req ${current}: ${message}`)
                results.push({ label: 'error', method: '', path: '', status: 0, duration: null, ok: false })
            }
        }
    }

    const workers = Array(CONCURRENT_REQUESTS).fill(0).map(() => worker())
    await Promise.all(workers)

    console.log('\n\n📊 Results:')
    console.log(`Total Requests: ${TOTAL_REQUESTS}`)
    console.log(`Errors: ${errors.length}`)
    if (errors.length > 0) {
        console.log('Sample Errors:', errors.slice(0, 5))
    }

    const durations = results.map(r => r.duration).filter(d => typeof d === 'number')
    const sorted = durations.slice().sort((a, b) => a - b)
    const avg = sorted.length ? (sorted.reduce((a, b) => a + b, 0) / sorted.length) : null
    const min = sorted.length ? sorted[0] : null
    const max = sorted.length ? sorted[sorted.length - 1] : null

    console.log(`Min Duration: ${min ?? 'n/a'}ms`)
    console.log(`Avg Duration: ${avg ? avg.toFixed(2) : 'n/a'}ms`)
    console.log(`P50 Duration: ${percentile(sorted, 50) ?? 'n/a'}ms`)
    console.log(`P95 Duration: ${percentile(sorted, 95) ?? 'n/a'}ms`)
    console.log(`P99 Duration: ${percentile(sorted, 99) ?? 'n/a'}ms`)
    console.log(`Max Duration: ${max ?? 'n/a'}ms`)

    const byLabel = results.reduce((acc, r) => {
        const k = r.label || 'unknown'
        acc[k] = acc[k] || { count: 0, errors: 0, durations: [] }
        acc[k].count += 1
        if (r.ok === false) acc[k].errors += 1
        if (typeof r.duration === 'number') acc[k].durations.push(r.duration)
        return acc
    }, {})

    console.log('\n📦 Breakdown:')
    for (const [label, info] of Object.entries(byLabel)) {
        const s = info.durations.slice().sort((a, b) => a - b)
        const a = s.length ? (s.reduce((x, y) => x + y, 0) / s.length) : null
        console.log(
            `- ${label}: count=${info.count} errors=${info.errors} avg=${a ? a.toFixed(1) : 'n/a'}ms p95=${percentile(s, 95) ?? 'n/a'}ms`
        )
    }

    if (server?.child) {
        server.child.kill('SIGTERM')
        try {
            fs.rmSync(server.stressRoot, { recursive: true, force: true })
        } catch {
            // ignore
        }
    }
}

stressTest().catch(err => {
    console.error('❌ Stress test failed:', err)
    process.exitCode = 1
})
