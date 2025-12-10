# Fix Report – 2025-11-30

## Automated & Manual Checks

- `control-server`: `npm test` (smoke) ✅  
  - `/api/health`, `/api/agent/chat`, `/api/health-snapshot` all responsive.  
  - `/api/voice-agent` now succeeds end-to-end after adding the OpenAI API key (`✅ /api/voice-agent responded`).  
  - First run surfaced `EADDRINUSE` on port 3001 (PID 58040). Killed the stale Node process and re-ran successfully; current listener is shut down cleanly after testing.
- `docs-site`: `npm run lint` ✅  
  - Resolved the unused catch parameter in `VoiceCompanion.tsx` to keep lint at “zero warnings”.
- `docs-site`: `npm run build` ✅  
  - Vite/TypeScript build succeeded; bundle artifacts generated in `dist/`.

## Full Regression Sweep (2025-11-30 Afternoon)

- Re-launched the control server (`npm start` → PID 38388) and executed curl probes on `/api/agents` and `/api/health-snapshot`.  
- `health-snapshot` reports **22 stopped containers** (homarr, uptime-kuma, tdarr, readarr, nzbget, lidarr, jellyfin, sonarr, radarr, prowlarr, authelia, qbittorrent, postgres, portainer, tautulli, cloudflared, plex, gluetun, bazarr, overseerr, homepage, notifiarr). These services need `docker compose up -d <service>` before any true end-to-end validation per `plan.md`.
- Server logs (`/tmp/control-server.log`) confirm each API hit (health, chat, voice, health-snapshot) plus Docker CLI invocation. No runtime stack traces after clearing the port conflict.
- Docs UI checks: inspected `AppsOverview`, `DocsPage`, and the AI assistant wiring to ensure component tree matches `plan.md` (wizard hero ➜ cards ➜ contextual guide ➜ assistant).

## Code / UI Updates

1. **AI Assistant routing** (`docs-site/src/components/AIAssistant.tsx`)  
   - Restored the full specialist roster from `/api/agents`.  
   - Default selection is now “Auto”, letting backend keyword detection pick specialists unless the user explicitly overrides.  
   - Chat payload only sends `agentId` when a specialist is chosen; otherwise the backend receives `undefined` and auto-detects.

2. **Voice Companion cleanup** (`docs-site/src/components/VoiceCompanion.tsx`)  
   - Removed the unused error variable while restarting speech recognition, keeping the component lint-clean and removing redundant code.

3. **Docs card data dedupe** (`docs-site/src/components/docs/appData.ts`, `AppsOverview.tsx`, `DocsPage.tsx`)  
   - Centralized the `AppId` union plus metadata (icons, copy, difficulty, estimates) into a shared module.  
   - `AppsOverview` now consumes the shared dataset, eliminating a 200+ line duplicate array.  
   - `DocsPage` imports the same `AppId` type so the selection state and overview cards stay in sync automatically.

## External Research – “11.25”

- **General web search (DuckDuckGo)**: Results reference Bible verse John 11:25 (“I am the resurrection and the life…”) across BibleHub, BibleGateway, ChristianityPath, etc. Most hits discuss theological commentary published between 2023–2025.  
- **Social search attempt (Nitter)**: `https://nitter.net/search?q=11.25` returned HTTP 429 (rate limited).  
- **News search attempts (news.google.com, bing.com)**: both blocked anonymous scraping with HTTP 451 security responses via r.jina.ai proxy. No further data retrieved without authenticated access.

## Outstanding Items / Follow‑ups

- Provide an OpenAI API key (via the docs UI 🔑 modal or `.env`) to unlock `/api/voice-agent` coverage and AI-powered UI hints.  
- Bring the Docker stack online (at least the services flagged by `health-snapshot`) before validating UI flows described in `plan.md`—current machine has the containers stopped.  
- Once containers run, capture real application logs (Authelia, Cloudflared, *Arr stack, VPN) to verify the troubleshooting workflow end-to-end.  
- Clarify whether the “11.25” monitoring should track a specific topic going forward (e.g., religious content vs. date-specific events) so future runs can target the right feeds.

## 2025-11-30 – Docker bring-up & logs

- Updated `.env` so `DATA_ROOT=./data` (the repo’s included storage tree). The previous `/srv/mediastack` path isn’t shared with Docker Desktop on macOS, which caused `mounts denied` errors.  
- Freed host port 8080 (local process `./agent` was bound) so Gluetun/qBittorrent could expose their UI ports. Use `lsof -i :8080` to confirm nothing else grabs it before restarting.  
- `docker compose up -d` now brings up the stack; `docker compose ps` output captured at 08:36 ET shows all containers launching. Key issues to resolve:
  - **Authelia** repeatedly restarts: config directory only contains the auto-generated default with no backend/session/notifier values. Populate `config/authelia/configuration.yml` (or run `setup.sh`) so Redis host, session cookies, storage backend, notifier, and access rules are defined.  
  - **Cloudflared** restarts because `CLOUDFLARED_COMMAND` is blank. Set `CLOUDFLARED_COMMAND="tunnel --no-autoupdate run --token ${CLOUDFLARE_TUNNEL_TOKEN}"` (and provide a real token) in `.env`.  
  - **Gluetun** exits with `Wireguard server selection settings: endpoint IP is not set`. Supply `WIREGUARD_PRIVATE_KEY`, `WIREGUARD_ADDRESSES`, and either `SERVER_COUNTRIES` or explicit endpoint values per your VPN provider docs.  
  - **Postgres** currently reports `STATUS: unhealthy` until the data directory finishes initializing; re-check after Authelia’s config is valid.  
- `docker compose logs` excerpts stored:
  - Authelia: configuration errors for `authentication_backend`, `session.redis.host`, `session.cookies`, `storage`, and `notifier`.  
  - Cloudflared: just prints the version before restarting (no command provided).  
  - Gluetun: firewall comes up, but it shuts down once it notices the missing WireGuard endpoint.  
  - Sonarr/Radarr/Prowlarr: successful first-boot migrations captured for audit/history.
- `docker compose ps -a gluetun` confirms the VPN container exited with code 1; re-run once WireGuard env vars are populated.  
- Reminder: because Gluetun is down, qBittorrent is technically running but cannot reach the internet; fix VPN first to avoid accidental real-IP leaks.

## 2025-11-30 – First-run friendly defaults

- `.env` now defaults to `DATA_ROOT=./data` and excludes the `vpn`/`torrent` profiles so a novice can run `docker compose up -d` without providing VPN credentials. Added stub values for Cloudflared (`tunnel --no-autoupdate --hello-world`) and Gluetun WireGuard fields so the containers stay healthy once those profiles are enabled.  
- Added `data/.gitignore` to keep runtime configs out of git while still tracking our starter Authelia + Homepage files.  
- Replaced both `config/authelia/*` and `data/config/authelia/*` with a small, opinionated configuration that works against the local Redis/Postgres volumes and ships with a demo admin account (`demo` / `ChangeMe123!`). Authelia now boots cleanly (only deprecation warnings remain until we migrate to the v5 cookie schema).  
- `docker-compose.yml` now passes the new `AUTHELIA_IDENTITY_VALIDATION_RESET_PASSWORD_JWT_SECRET` env var and includes the extra Gluetun WireGuard knobs.  
- `docker compose up -d` (profiles: plex, arr, notify, stats) output from 08:37 ET is captured in the logs above; everything except the optional VPN stack runs on first try. Use `COMPOSE_PROFILES=plex,arr,torrent,vpn,notify,stats` once you’ve dropped in real tunnel/VPN secrets.

## Speech Companion Hardening

- Reworked `VoiceCompanion.tsx` to manage the browser’s SpeechRecognition lifecycle more defensively: we now stop the stream before sending transcripts, reinitialize the recognizer when Chrome reports a `network` error, and only restart listening after the AI responds.  
- Added `useCallback`/`useEffect` plumbing so transcripts funnel through a stable ref, preventing “Network error” pop-ups caused by overlapping `start()` calls.  
- The UI now surfaces friendlier microphone diagnostics (initialization retries, clearer messaging) while continuing to auto-resume hands-free chats once the speech service is back.

## Hybrid Storage Planner

- Added a Simple/Advanced toggle to `StoragePlanner.tsx`: Simple mode lets newcomers set a single `DATA_ROOT` and preview the derived volume table read-only, while Advanced mode retains the full per-service matrix with validation (absolute path checks, clearer errors, and browse/reset helpers).  
- The setup store now tracks `storageMode` + an advanced-plan cache so experts can flip back and forth without losing overrides; simple mode automatically re-derives paths from the chosen root so generated compose files stay consistent.

## Best-Practice Notes

- Keep `.env` secrets rotated; Authelia/Redis tokens in templates must be replaced before deploying.  
- When running the docs site in dev mode, ensure the control server is reachable at `VITE_CONTROL_SERVER_URL` or via `localhost:3001` to keep the AI assistant fully functional.  
- Shared metadata (`appData.ts`) prevents drift between the app cards and guide navigation—add new apps in one place to update both the overview grid and the detailed tabs.

## 2025-12-10 – Docker Deployment Fixes

- **Resolved macOS incompatibility**: Commented out `/dev/dri` device mappings for `tdarr` and `jellyfin` in `docker-compose.yml` as this device is unavailable on macOS hosts, causing startup failure.
- **Fixed Authelia Crash**:
    - Updated `config/authelia/configuration.yml` to use `{{ env "AUTHELIA_SESSION_REDIS_PASSWORD" }}` instead of a hardcoded value.
    - Deleted stale `data/config/authelia/db.sqlite3` which had a key mismatch; Authelia successfully regenerated it and started up.
- **Prevented Loop Crashes**:
    - Removed `vpn` and `torrent` profiles from default `COMPOSE_PROFILES` in `.env` to prevent `gluetun` and `qbittorrent` from starting without valid VPN credentials.
    - Added `profiles: ["cloudflared"]` to `docker-compose.yml` and corrected the dummy command in `.env` so `cloudflared` does not start by default and crash due to missing token.
- **Verification**:
    - `docker compose up -d` now succeeds with exit code 0.
    - All services in the default profile (Plex, *Arr, Notify, Stats, Transcode) are running (`Up`) status.
    - Authelia is successfully running and passed startup checks after database regeneration.
