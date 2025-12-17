import http from 'node:http'

const BASE = process.env.CONTROL_SERVER_URL || 'http://localhost:3001'
const CONCURRENT_REQUESTS = parseInt(process.env.CONCURRENT_REQUESTS || '20', 10)
const TOTAL_REQUESTS = parseInt(process.env.TOTAL_REQUESTS || '100', 10)
const REQUEST_TIMEOUT_MS = parseInt(process.env.REQUEST_TIMEOUT_MS || '15000', 10)

const percentile = (sortedValues, p) => {
    if (sortedValues.length === 0) return null
    const idx = Math.max(0, Math.min(sortedValues.length - 1, Math.ceil((p / 100) * sortedValues.length) - 1))
    return sortedValues[idx]
}

const get = (path) => new Promise((resolve, reject) => {
    const start = Date.now()
    const req = http.get(new URL(path, BASE), res => {
        let chunks = ''
        res.on('data', d => { chunks += d })
        res.on('end', () => {
            resolve({
                method: 'GET',
                path,
                status: res.statusCode,
                duration: Date.now() - start
            })
        })
    })
    req.setTimeout(REQUEST_TIMEOUT_MS, () => req.destroy(new Error(`timeout after ${REQUEST_TIMEOUT_MS}ms`)))
    req.on('error', reject)
})

const post = (path, body) => new Promise((resolve, reject) => {
    const start = Date.now()
    const data = JSON.stringify(body)
    const req = http.request(
        new URL(path, BASE),
        {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(data)
            }
        },
        res => {
            let chunks = ''
            res.on('data', d => { chunks += d })
            res.on('end', () => {
                resolve({
                    method: 'POST',
                    path,
                    status: res.statusCode,
                    duration: Date.now() - start
                })
            })
        }
    )
    req.setTimeout(REQUEST_TIMEOUT_MS, () => req.destroy(new Error(`timeout after ${REQUEST_TIMEOUT_MS}ms`)))
    req.on('error', reject)
    req.write(data)
    req.end()
})

async function stressTest() {
    console.log(`🔥 Starting stress test: ${TOTAL_REQUESTS} requests (${CONCURRENT_REQUESTS} concurrent)`)
    console.log(`ℹ️  Target: ${BASE}`)

    const errors = []
    const results = []
    let issued = 0

    const worker = async (id) => {
        while (true) {
            const current = ++issued
            if (current > TOTAL_REQUESTS) return
            try {
                // Mix of endpoints
                let res, label
                if (current % 3 === 0) {
                    // Heavy: Docker PS
                    label = 'containers'
                    res = await get('/api/containers')
                } else if (current % 3 === 1) {
                    // Light: Health
                    label = 'health'
                    res = await get('/api/health')
                } else {
                    // Medium: Chat fallback
                    label = 'chat'
                    res = await post('/api/agent/chat', { message: 'hello', agentId: 'general' })
                }

                results.push({ ...res, label })
                if (res.status !== 200) {
                    errors.push(`Req ${current} (${label}): Status ${res.status}`)
                }

                if (current % 10 === 0) process.stdout.write('.')
            } catch (err) {
                const message = err && typeof err === 'object' && 'message' in err ? err.message : String(err)
                errors.push(`Req ${current}: ${message}`)
                results.push({ label: 'error', method: '', path: '', status: 0, duration: null })
            }
        }
    }

    const workers = Array(CONCURRENT_REQUESTS).fill(0).map((_, i) => worker(i))
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
        if (r.status !== 200) acc[k].errors += 1
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
}

stressTest()
