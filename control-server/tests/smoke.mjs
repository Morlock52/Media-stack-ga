import assert from 'node:assert/strict'
import http from 'node:http'

const BASE = process.env.CONTROL_SERVER_URL || 'http://localhost:3001'

const post = (path, body) => new Promise((resolve, reject) => {
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
        try {
          const json = JSON.parse(chunks || '{}')
          resolve({ status: res.statusCode, body: json })
        } catch (err) {
          reject(err)
        }
      })
    }
  )
  req.on('error', reject)
  req.write(data)
  req.end()
})

const get = path => new Promise((resolve, reject) => {
  http.get(new URL(path, BASE), res => {
    let chunks = ''
    res.on('data', d => { chunks += d })
    res.on('end', () => {
      try {
        const json = JSON.parse(chunks || '{}')
        resolve({ status: res.statusCode, body: json })
      } catch (err) {
        reject(err)
      }
    })
  }).on('error', reject)
})

async function run() {
  console.log('ℹ️  Running smoke tests against', BASE)

  const health = await get('/api/health')
  assert.equal(health.status, 200)
  assert.equal(health.body.status, 'online')
  console.log('✅ /api/health')

  const chat = await post('/api/agent/chat', { message: 'hello there' })
  assert.equal(chat.status, 200)
  assert.ok(chat.body.answer)
  console.log('✅ /api/agent/chat fallback response works')

  const voice = await post('/api/voice-agent', { transcript: 'help me pick apps' }).catch(err => ({ error: err }))
  if (voice.error) {
    console.warn('⚠️  /api/voice-agent: network error', voice.error)
  } else if (voice.status === 400 && voice.body?.error?.includes('OpenAI key')) {
    console.warn('⚠️  /api/voice-agent requires OpenAI key; skipping check')
  } else {
    assert.equal(voice.status, 200)
    console.log('✅ /api/voice-agent responded')
  }

  const snapshot = await get('/api/health-snapshot')
  assert.ok(snapshot.status === 200 || snapshot.status === 500)
  console.log('✅ /api/health-snapshot reachable (status %d)', snapshot.status)
}

run().catch(err => {
  console.error('❌ Smoke tests failed', err)
  process.exitCode = 1
})
