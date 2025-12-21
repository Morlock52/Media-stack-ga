import assert from 'node:assert/strict'
import http from 'node:http'

const BASE = process.env.CONTROL_SERVER_URL || 'http://localhost:3001'
const TOKEN = (process.env.CONTROL_SERVER_TOKEN || '').trim()

const authHeaders = TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {}

const post = (path, body) => new Promise((resolve, reject) => {
  const data = JSON.stringify(body)
  const req = http.request(
    new URL(path, BASE),
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data),
        ...authHeaders,
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
  const url = new URL(path, BASE)
  const req = http.request(
    url,
    {
      method: 'GET',
      headers: {
        ...authHeaders,
      },
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
  req.end()
})

async function run() {
  console.log('ℹ️  Running smoke tests against', BASE)

  const health = await get('/api/health')
  assert.equal(health.status, 200)
  assert.equal(health.body.status, 'online')
  console.log('✅ /api/health')

  const chat = await post('/api/agent/chat', { message: 'hello there' })
  if (chat.status === 401) {
    console.warn('⚠️  /api/agent/chat requires CONTROL_SERVER_TOKEN; skipping check')
  } else {
    assert.equal(chat.status, 200)
    assert.ok(chat.body.answer)
    console.log('✅ /api/agent/chat fallback response works')
  }

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
  if (snapshot.status === 401) {
    console.warn('⚠️  /api/health-snapshot requires CONTROL_SERVER_TOKEN; skipping check')
  } else {
    assert.ok(snapshot.status === 200 || snapshot.status === 500)
    console.log('✅ /api/health-snapshot reachable (status %d)', snapshot.status)
  }

  const remoteTest = await post('/api/remote-deploy/test', {
    host: '127.0.0.1',
    port: 22,
    username: 'test',
    authType: 'password',
    password: 'bad'
  })
  assert.equal(remoteTest.status, 502)
  assert.equal(remoteTest.body.success, false)
  assert.ok(String(remoteTest.body.error || '').toLowerCase().includes('ssh connection failed'))
  console.log('✅ /api/remote-deploy/test returns expected 502 on unreachable SSH')

  const [deployA, deployB] = await Promise.all([
    post('/api/remote-deploy', {
      host: '127.0.0.1',
      port: 22,
      username: 'test',
      authType: 'password',
      password: 'bad',
      deployPath: '~/media-stack',
    }),
    post('/api/remote-deploy', {
      host: '127.0.0.1',
      port: 22,
      username: 'test',
      authType: 'password',
      password: 'bad',
      deployPath: '~/media-stack',
    }),
  ])

  const statuses = [deployA.status, deployB.status]
  assert.ok(statuses.includes(200), `Expected one 200 response, got ${statuses.join(', ')}`)
  assert.ok(statuses.includes(409), `Expected one 409 response, got ${statuses.join(', ')}`)

  const okResp = deployA.status === 200 ? deployA : deployB
  const lockedResp = deployA.status === 409 ? deployA : deployB

  assert.equal(okResp.body.success, false)
  assert.ok(typeof okResp.body.error === 'string' && okResp.body.error.length > 0)
  assert.equal(lockedResp.body.success, false)
  assert.ok(String(lockedResp.body.error || '').toLowerCase().includes('already in progress'))
  console.log('✅ /api/remote-deploy prevents concurrent deploys (409 when locked)')
}

run().catch(err => {
  console.error('❌ Smoke tests failed', err)
  process.exitCode = 1
})
