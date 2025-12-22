#!/usr/bin/env bash
set -euo pipefail

# Docker-only k6 stress test for the control server API.
# Requires Docker; no local Node/Playwright needed.

: "${TARGET_BASE:=http://localhost:3001}"
: "${DURATION:=1m}"
: "${VUS:=10}"

docker run --rm -i \
  --network=host \
  -e TARGET_BASE="$TARGET_BASE" \
  -e DURATION="$DURATION" \
  -e VUS="$VUS" \
  -e K6_SUMMARY_TIME_UNIT=ms \
  grafana/k6 run - <<'EOF'
import http from 'k6/http'
import { check, sleep } from 'k6'
import { Trend, Counter } from 'k6/metrics'

const base = __ENV.TARGET_BASE || 'http://localhost:3001'

export const options = {
  vus: Number(__ENV.VUS || 10),
  duration: __ENV.DURATION || '1m',
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<500'],
  },
}

const healthLatency = new Trend('health_latency')
const settingsLatency = new Trend('settings_latency')
const errors = new Counter('errors')

export default function () {
  const health = http.get(`${base}/api/health`)
  healthLatency.add(health.timings.duration)
  check(health, { 'health 200': (r) => r.status === 200 }) || errors.add(1)

  const keyStatus = http.get(`${base}/api/settings/openai-key/status`)
  settingsLatency.add(keyStatus.timings.duration)
  check(keyStatus, { 'key status ok': (r) => r.status === 200 }) || errors.add(1)

  const ttsStatus = http.get(`${base}/api/settings/tts/status`)
  check(ttsStatus, {
    'tts status ok or disabled': (r) => r.status === 200 || r.status === 404,
  }) || errors.add(1)

  sleep(0.5)
}
EOF
