import http from 'node:http'

const BASE = 'http://localhost:3001'
const CONCURRENT_REQUESTS = 20
const TOTAL_REQUESTS = 100

const get = (path) => new Promise((resolve, reject) => {
    const start = Date.now()
    http.get(new URL(path, BASE), res => {
        let chunks = ''
        res.on('data', d => { chunks += d })
        res.on('end', () => {
            resolve({
                status: res.statusCode,
                duration: Date.now() - start
            })
        })
    }).on('error', reject)
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
                    status: res.statusCode,
                    duration: Date.now() - start
                })
            })
        }
    )
    req.on('error', reject)
    req.write(data)
    req.end()
})

async function stressTest() {
    console.log(`🔥 Starting stress test: ${TOTAL_REQUESTS} requests (${CONCURRENT_REQUESTS} concurrent)`)

    const errors = []
    const durations = []
    let completed = 0

    const worker = async (id) => {
        while (completed < TOTAL_REQUESTS) {
            completed++
            const current = completed
            try {
                // Mix of endpoints
                let res
                if (current % 3 === 0) {
                    // Heavy: Docker PS
                    res = await get('/api/containers')
                } else if (current % 3 === 1) {
                    // Light: Health
                    res = await get('/api/health')
                } else {
                    // Medium: Chat fallback
                    res = await post('/api/agent/chat', { message: 'hello', agentId: 'general' })
                }

                durations.push(res.duration)
                if (res.status !== 200) {
                    errors.push(`Req ${current}: Status ${res.status}`)
                }

                if (current % 10 === 0) process.stdout.write('.')
            } catch (err) {
                errors.push(`Req ${current}: ${err.message}`)
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

    const avg = durations.reduce((a, b) => a + b, 0) / durations.length
    const max = Math.max(...durations)
    console.log(`Avg Duration: ${avg.toFixed(2)}ms`)
    console.log(`Max Duration: ${max}ms`)
}

stressTest()
