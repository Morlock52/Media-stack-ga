# Voice System Fix Plan + Implementation Notes (Jan 2026)

This document captures (1) the investigation plan, (2) what was found, (3) what was changed in the repo to fix voice connectivity + transcription, and (4) how to verify.

---

## 1) Symptoms reported

- “Voice isn’t working.”
- “When you try to connect it doesn’t load.”
- “It doesn’t understand me.”

In this repo, “Voice” spans **three** input modes and **four** output modes:

- **Voice input**
  - Browser SpeechRecognition (`SpeechRecognition` / `webkitSpeechRecognition`)
  - Server STT (`POST /api/transcribe` → OpenAI transcription)
  - Realtime voice (WebRTC → OpenAI Realtime API)
- **Voice output**
  - Browser SpeechSynthesis
  - OpenAI TTS (`POST /api/tts`)
  - ElevenLabs TTS (`POST /api/tts`) + ElevenLabs streaming (`/api/tts/streaming/config`)
  - Realtime audio output (WebRTC remote track)

---

## 2) Investigation plan (what to check, in order)

### A. Confirm control-server reachability + auth

1. Verify control server is reachable:
   - `GET /api/health`
2. Verify the UI is calling the intended control-server base URL:
   - Docs UI uses `docs-site/src/utils/controlServer.ts`
3. If `CONTROL_SERVER_TOKEN` is enabled, verify browser requests include it:
   - `Authorization: Bearer <token>`

### B. Validate key-dependent capabilities

1. **Server STT available?**
   - `GET /api/settings/stt` → `hasKey`
2. **TTS available?**
   - `GET /api/settings/tts` → provider + `hasKey`
3. **Realtime available?**
   - `GET /api/ai/realtime/status` → `available/configured`

### C. Trace the exact voice flow you’re using

1. Browser voice input:
   - UI starts `SpeechRecognition.start()` and expects interim + final transcripts.
   - Requires secure context (HTTPS) except localhost, and browser support (Chrome is safest).
2. Server STT voice input:
   - UI records audio using `MediaRecorder` and uploads via multipart form data to `/api/transcribe`.
   - Requires a working OpenAI key on the control-server.
3. Realtime voice input:
   - UI calls `/api/ai/realtime/ephemeral-key` to generate a short-lived client token.
   - UI does WebRTC SDP exchange with OpenAI and then streams mic audio + receives audio back.

### D. Look for “silent failure” spots

1. Places where the UI considers “recording started” even if the underlying connection failed.
2. Places where partial transcripts are reused for multiple roles (user vs assistant), causing confusing UX.
3. Places where the audio file’s **real format** doesn’t match the uploaded filename extension (Safari/Apple devices are common culprits).

---

## 3) Root causes found

### Root cause #1 — Server STT uploads could be mislabeled (Safari/`audio/mp4` sent as `.webm`)

`docs-site/src/components/VoiceCompanion.tsx` always uploaded recorded audio as `audio.webm`.

However, on browsers that record as `audio/mp4` (Safari is the big one), uploading that payload with a `.webm` filename causes a downstream mismatch:

- The control-server uses the **filename extension** to set the upstream OpenAI `file` MIME type.
- Result: OpenAI STT may reject the file as an invalid/unsupported format.
- Symptom: “doesn’t understand me” (no or failed transcription).

### Root cause #2 — Realtime voice “connect” could stall / feel like it never loads

The WebRTC flow had multiple practical problems:

- No “connecting” UX state (it looked idle while negotiation was happening).
- SDP was sent immediately, without waiting for ICE gathering to complete (can break on some browser/network combos).
- No fetch timeout for the SDP exchange (can hang).
- Missing Realtime beta header in the WebRTC SDP exchange flow (the control-server *tracked* API version but didn’t pass it into the WebRTC flow).
- The UI could mark itself “recording” even if the realtime connect ultimately failed, preventing fallbacks.

### Root cause #3 — Realtime UI mixed “user live transcript” and “assistant streaming response”

`partialTranscript` was used for:

- live user speech (intended)
- AND streamed assistant text deltas (Realtime mode)

That caused confusing output (“it doesn’t understand me”) and also made the “live transcription” bubble show assistant text.

### Root cause #4 — Voice agent fallback wasn’t explained

`POST /api/voice-agent` returns a fallback response when OpenAI isn’t configured (or errors), but the UI didn’t surface *why*.

That can feel like “it doesn’t understand me” even when transcription works, because the response quality is intentionally basic without OpenAI.

---

## 4) Fixes implemented in this repo

### A. Fix server STT upload naming (Safari-safe)

**File:** `docs-site/src/components/VoiceCompanion.tsx`

- Upload filename extension now matches the recorded blob’s `mimeType`:
  - `audio/mp4` → `audio.mp4`
  - `audio/ogg` → `audio.ogg`
  - `audio/webm` → `audio.webm`
  - etc.

This prevents OpenAI STT from rejecting valid audio due to a mislabeled upload.

### B. Make realtime voice connect reliable + bounded

**File:** `docs-site/src/hooks/useRealtimeVoice.ts`

- `connect()` now returns `Promise<boolean>` so callers can fall back cleanly.
- Waits for ICE gathering to complete before sending SDP.
- Adds SDP fetch timeout (AbortController) so it can’t hang forever.
- Attempts `audio.play()` on the remote track (autoplay-only can fail on some browsers).
- Handles more transcription event shapes (delta + nested transcription text).
- Adds a small STUN set to improve NAT connectivity in the real world.

### C. Fix realtime server-side ephemeral key generation + client headers

**File:** `control-server/src/routes/ai.ts`

- `/api/ai/realtime/ephemeral-key` now:
  - includes `OpenAI-Beta: realtime=<apiVersion>` when calling OpenAI
  - returns `apiVersion` to the client
  - returns `sdpUrl` with an explicit `?model=...` query param

**Why:** keeps the WebRTC flow aligned with the same Realtime API versioning the server uses, and reduces “connect never finishes” cases.

### D. Fix realtime UI/UX (no more mixed transcripts, add connecting state)

**File:** `docs-site/src/components/VoiceCompanion.tsx`

- Adds a first-class `connecting` status + spinner indicator.
- Disables Start while connecting (prevents double-connect spam).
- Stop button in realtime mode now disconnects (so you can cancel a stuck connect).
- Splits:
  - `partialTranscript` → live user speech / brief status text
  - `partialAssistantResponse` → live assistant streamed deltas (Realtime mode)
- Adds a dedicated “Responding…” bubble for streamed assistant output.

### E. Explain when the voice agent is in fallback mode

**File:** `control-server/src/routes/ai.ts`

- `/api/voice-agent` now returns `meta.usedFallback` + a reason when it can’t use OpenAI.

**File:** `docs-site/src/components/VoiceCompanion.tsx`

- Shows a one-time transcript notice if the assistant is using fallback due to:
  - missing OpenAI key
  - invalid OpenAI key
  - rate limiting

---

## 5) How to verify (manual)

### Wizard-in-Docker (recommended)

1. Start wizard:
   - `docker compose -f docker-compose.wizard.yml up --build -d`
2. Open:
   - `http://localhost:3002`
3. In the UI, open **Settings → OpenAI Key** and set a valid key (required for Server STT + Realtime + OpenAI TTS).

### Test A — Browser voice (Chrome desktop)

1. Voice Settings → Input: `Browser`
2. Click **Start Speaking**
3. Confirm:
   - live user transcript appears
   - transcript finalizes into the chat
   - assistant responds

### Test B — Server STT (works best on Safari + “no SpeechRecognition” browsers)

1. Voice Settings → Input: `OpenAI`
2. Click **Start Speaking**, speak 2–4 seconds, click **Stop**
3. Confirm:
   - transcription succeeds (no “invalid format” errors)
   - if using Safari (records `audio/mp4`), transcription still works

### Test C — Realtime (WebRTC)

1. Voice Settings → Input: `Realtime`
2. Click **Start Speaking**
3. Confirm:
   - Status shows **Connecting…** then Ready/Connected
   - live user speech appears in the “Listening…” bubble
   - assistant streamed response appears in the “Responding…” bubble
   - remote audio plays (if blocked, click Start again)

---

## 6) How to verify (API sanity)

From your terminal (control-server reachable at `http://127.0.0.1:3001` in wizard mode):

- `curl http://127.0.0.1:3001/api/health`
- `curl http://127.0.0.1:3001/api/settings/stt`
- `curl http://127.0.0.1:3001/api/settings/tts`
- `curl http://127.0.0.1:3001/api/ai/realtime/status`

---

## 7) What I ran locally (validation)

- `npm run lint -w docs-site`
- `npm run build -w docs-site`
- `npm test -w control-server`
- `npm test -w docs-site -- tests/smoke.spec.ts`

---

## 8) Notes / follow-ups (if you still see issues)

1. **If browser SpeechRecognition fails**
   - Use Server STT or Realtime.
   - Ensure HTTPS when not on localhost (SpeechRecognition often requires it).
2. **If Realtime connects but no audio**
   - Browser autoplay policy: click Start Speaking again.
   - Confirm microphone permissions (site settings).
3. **If everything works but responses feel “generic”**
   - Confirm the control-server has a valid OpenAI key:
     - Settings → OpenAI Key (or `GET /api/settings/openai-key`)

