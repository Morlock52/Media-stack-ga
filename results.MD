# Results / Notes (2025-12-17)

This file is a running log of what was tested, what was found, and what was changed while reviewing stress tests + wizard/assistant behavior.

---

## Scope

- Validate `control-server` load behavior (smoke + stress).
- Validate `docs-site` wizard UX flows + AI assistant/voice companion behavior.
- Identify performance/safety issues and fix them where practical.
- Prefer “best choice” tech as of 2025-12-17 based on *tests actually run* (not “newest at all costs”).

---

## Baseline commands (will be filled as they run)

- `npm run lint`
- `npm run build`
- `npm test`
- `node control-server/tests/smoke.mjs`
- `node control-server/tests/stress.mjs`
- `npx playwright test` (docs-site)

---

## Findings (running)

### 1) Stress/Smoke harness issues

- `control-server/tests/smoke.mjs` and `control-server/tests/stress.mjs` were being run while the API was not running → `ECONNREFUSED`, and `stress.mjs` produced `NaN/-Infinity` because all requests failed.
- `control-server/tests/smoke.mjs` defaulted to `http://localhost:3001` which can resolve to IPv6 `::1` on some hosts; the server was bound to `127.0.0.1`.

Changes made:
- Added env configurability + timeouts + percentiles + endpoint breakdown to `control-server/tests/stress.mjs`.
- Ran smoke/stress by starting `control-server` locally and setting `CONTROL_SERVER_URL=http://127.0.0.1:3001` for tests.

Latest results (with `TOTAL_REQUESTS=300`, `CONCURRENT_REQUESTS=30`):
- Errors: `0`
- P50: `39ms`
- P95: `250ms`
- P99: `306ms`
- Max: `318ms`
- Breakdown:
  - health avg `27.9ms` p95 `79ms`
  - containers avg `45.0ms` p95 `170ms`
  - chat avg `186.4ms` p95 `288ms`

---

### 2) Control-server performance (docker polling)

Observation:
- The `/api/containers` endpoint shells out to `docker ps -a`. Under load, this is expensive and can dominate response latency.

Change made:
- Added a small in-memory cache + in-flight dedupe for docker status calls in `control-server/src/routes/docker.ts`.
  - Controlled by `DOCKER_STATUS_CACHE_MS` (default `1500ms`).

---

### 3) Docs-site wizard correctness bug (P0)

Found via Playwright:
- Wizard advanced step was silently resetting previously-entered **domain** and **master password** back to defaults (`example.com` and blank).
- Symptom: review step showed `DOMAIN=example.com` and `REDIS_PASSWORD=` even after filling the Basic Config step.
- Root cause: `step4Form` (advanced settings) was initialized with `defaultValues: config` (full config), and then the wizard saved `step4Form.getValues()` back into global config. In practice, this could re-introduce stale defaults into fields not meant to be changed in that step.

Fix:
- Restrict advanced form `defaultValues` to only advanced fields.
- When saving advanced settings, only write back those fields.
- File: `docs-site/src/components/SetupWizard.tsx`.

---

### 4) Wizard output correctness (compose + profiles)

Issues:
- Wizard service list contained per-service profiles (`sonarr`, `radarr`, …) but root compose only supported the aggregated `arr` profile. This mismatch leads to “service selected but not started”.

Fixes:
- Added an explicit `*Arr Stack` option in `docs-site/src/data/services.ts` (profile `arr`).
- Added per-service profiles in root `docker-compose.yml` (`sonarr`, `radarr`, `prowlarr`, `bazarr`, `overseerr`) while keeping `arr` as the “bundle” profile.
- Wizard now downloads the repository’s `docker-compose.yml` template directly (Vite `?raw` import) to eliminate generator drift:
  - File: `docs-site/src/components/SetupWizard.tsx`

---

### 5) Wizard + assistant automated checks

Added/updated Playwright coverage in `docs-site/tests/smoke.spec.ts`:
- Wizard can progress through steps, generate preview, and download 4 files.
- AI assistant can open and complete a basic chat round trip (with `control-server` running).

Playwright infra:
- `docs-site/playwright.config.ts` now boots `control-server` as part of `webServer` so `/api/*` calls work during UI tests.

---

### 6) Dependency/tech “best choice” updates (based on failures seen)

- Upgraded `vitest` to `4.0.16` to fix Node 24 + esbuild-related test failures (validated by `npm test`).
- Upgraded `react-syntax-highlighter` to `16.1.0` to resolve `npm audit --omit=dev` finding (PrismJS DOM clobbering path).
- `npm audit --omit=dev` now reports `0 vulnerabilities`.

---

## Latest verification runs

- `npm run lint` ✅
- `npm run build` ✅
- `npm test` ✅ (Vitest + Playwright)
- `CONTROL_SERVER_URL=http://127.0.0.1:3001 node control-server/tests/smoke.mjs` ✅
- `CONTROL_SERVER_URL=http://127.0.0.1:3001 TOTAL_REQUESTS=300 CONCURRENT_REQUESTS=30 node control-server/tests/stress.mjs` ✅
- `npm audit --omit=dev` ✅

---

## 7) Newbie assistant voice quality (OpenAI key available)

Goal: improve the “Voice Companion” voice output when the user has an OpenAI API key.

Changes:
- Added a high-quality TTS backend endpoint: `control-server/src/routes/ai.ts` (`POST /api/tts`)
  - Uses `OPENAI_TTS_MODEL` (default `gpt-4o-mini-tts`) with fallback `OPENAI_TTS_FALLBACK_MODEL` (default `tts-1`)
  - Supports `mp3`/`wav`/`opus` response formats (default `mp3`)
- Updated `docs-site/src/components/VoiceCompanion.tsx`:
  - Passes `openaiKey` through to `/api/voice-agent` (so voice chat works even if the server hasn’t stored the key)
  - Uses `/api/tts` for audio playback when `openaiKey` exists and the user has interacted (avoids autoplay/cost surprises)
  - Adds a “Voice output” selector (Off / Browser / OpenAI HQ) with safe fallbacks to browser `speechSynthesis`
- Updated `docs-site/src/components/SetupWizard.tsx` to pass `config.openaiApiKey` into `VoiceCompanion`

Tests:
- Added route-level coverage for TTS: `control-server/test/ai.tts.test.ts`

---

## 8) Dedicated OpenAI settings page

- Added `/settings` route in the docs UI with a full-page experience for viewing connection status, storing/removing API keys, and linking back to the wizard.
- Hooked navigation (header + modals) so the new screen is discoverable, while keeping the lightweight modal for quick edits.
- The page mirrors the control server endpoints (`/api/settings/openai-key`) and reports whether the key is persisted server-side or only stored locally.

Verification:
- `npm run build -w docs-site` ✅ (~4m14s, cold cache)

---

## 9) Settings page stability + light-mode touch-ups (2025-12-17)

- Fixed `/settings` crash: `useSetupStore` was destructured into a new object every render, so Zustand considered the snapshot “changed” and React re-rendered indefinitely. Switching to individual selectors removed the feedback loop and restored the page.
- Added a reusable `.chip-muted` utility and applied it to Docs assistant quick-action buttons so they render with proper contrast in both themes (no more dark-mode-only tokens leaking into light mode).
- Captured regression screenshots (`preview-settings-dev.png`, `preview-settings-dev-fixed.png`) for before/after validation.

Verification:
- `npm run lint -w docs-site` ✅ (44s)

---

## 10) AI endpoints smoke (blocked awaiting real OpenAI key)

- Built and launched `control-server` locally (`node control-server/dist/index.js` on port 3001).
- `/api/health` responds `200` as expected.
- `/api/agent/chat`, `/api/ai/service-config`, and `/api/tts` all return `401 invalid_api_key` when invoked with the placeholder `sk-test` key—this shows the new error handling paths work, but we still need a real OpenAI key to complete the success-path verification.
- Next step: provide a valid key via `curl -X POST http://127.0.0.1:3001/api/settings/openai-key -d '{"key":"sk-..."}'` and rerun the three endpoints (or drive them through the docs UI) to confirm full functionality.
