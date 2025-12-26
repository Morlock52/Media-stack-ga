# Improvement Notes (2025-02-17)

## App intent

- Secure, self-hosted media stack wizard that boots Plex/Jellyfin with Authelia SSO/MFA, VPN-isolated downloads, and Cloudflare Tunnel access. The docs UI doubles as a Matrix-style control panel plus interactive guides.

## Signals from code/logs/MD

- `backend.log`: control-server was polling `docker ps` repeatedly, then nodemon crashed with `Error: read EIO` from TTY; likely a terminated stdin/watch issue. Prefer running the API via `npm run dev -w control-server -- --quiet --legacy-watch` or a PM2/systemd service to avoid TTY-bound restarts, and cap docker polling with the built-in cache (`DOCKER_STATUS_CACHE_MS`).
- `frontend.log`: Vite dev server booted cleanly; no runtime errors reported.
- `results.MD`: highlights existing fixes (compose profile alignment, voice companion, settings stability) and verified baselines (`npm run lint/build/test`, Playwright + stress harness).

## New findings (2025-02-18)

- Control server model: Fastify 4 API, shells out to Docker CLI for every operation (no Docker SDK), in-memory cache for `/api/containers`, optional Bearer token on all routes except `/api/health`. No request schema validation, no execution timeouts, and no circuit breaker; `runCommand` will hang if Docker blocks. Restart/reset today is only `POST /api/system/restart` → `docker compose restart` in `PROJECT_ROOT`, so it will do nothing useful if the control-server process itself is wedged. Recommend: add per-route zod validation, `AbortController`/timeout + max concurrent shell commands, and an explicit `/api/system/reload` that respawns the Fastify process (PM2/systemd) plus a `/api/system/status` that reports compose file being targeted and cache age.
- Docker action safety: `/api/service/:action` and `/api/system/update` don’t check whether Docker is reachable (returns 500), nor do they scope to a known compose file/project name. Set `COMPOSE_FILE`/`--project-directory "${PROJECT_ROOT}"` or pass `PROJECT_ROOT` explicitly into `runCommand` so a mis-set CWD can’t restart the host’s global compose stack. Validate `serviceName` against `/api/compose/services` to avoid no-op commands and to give the UI a better error.
- Dev flakiness: backend log shows `Error: read EIO` from nodemon/TTY. Stick to `npm run dev -w control-server -- --quiet --legacy-watch` locally or run under PM2/systemd in containers to avoid TTY-bound restarts. Add `LOG_LEVEL=warn` for dev and cap docker polling via `DOCKER_STATUS_CACHE_MS` and `DOCKER_STATUS_MAX_PARALLEL` to avoid log spam.
- Remote deploy guardrails: SSH helper uses `sshpass` when password auth is chosen but gives only a generic hint; add an explicit check for `sshpass`/`ssh` in `/api/remote-deploy/test` so failures are early and friendly. Consider enforcing `COMPOSE_PROFILES` allowlist to prevent arbitrary profile injection from the UI payload.
- Front page icon: hero and docs CTA logo were small. Made the same logo asset larger and more saturated (neon halo) without changing layout copy.

## Changes made now

- Navigation Home hover artwork is larger and more vibrant (gradient halo + saturated logo) while remaining pointer-safe: `docs-site/src/components/modern/ModernNavigation.tsx`.
- Added WebP logo + preload for better LCP and swapped all logo renders to `<picture>` with PNG fallback: `docs-site/public/media-stack-logo.webp`, `docs-site/index.html`, `docs-site/src/App.tsx`, `docs-site/src/pages/DocsPage.tsx`, `docs-site/src/pages/SettingsPage.tsx`.
- Added a lightweight nav health chip that polls `/api/health` with auth headers, shows latency when online, and fails gracefully when offline: `docs-site/src/components/modern/ModernNavigation.tsx`.
- Fixed control-server discovery in dev: SPA now defaults to `http://127.0.0.1:3001` when running on loopback so `/api/*` calls work without manual `VITE_CONTROL_SERVER_URL`: `docs-site/src/utils/controlServer.ts`.
- Hardened control-server when Docker isn’t available: spawn errors now return friendly messages (Docker not installed/not running) instead of crashing requests; health/containers/compose endpoints return 503 with clear guidance rather than opaque 500s: `control-server/src/utils/docker.ts`, `control-server/src/routes/docker.ts`.
- Hero/CTA logo made larger and more colorful (same asset, stronger halo) on home: `docs-site/src/components/modern/HeroSection.tsx`, `docs-site/src/App.tsx`.
- Control-server safety pass: added timeouts + bounded concurrency for Docker commands, project-scoped compose calls, service-name validation, cached compose service list, `/api/system/status` (cache/project introspection), and opt-in `/api/system/reload` for PM2/systemd self-exit: `control-server/src/utils/docker.ts`, `control-server/src/routes/docker.ts`.
- Request validation: remote deploy/test endpoints now enforce zod schemas on host/port/auth/keys to fail fast on bad payloads: `control-server/src/routes/remote.ts`.
- PM2 ops helper: added `scripts/pm2.control-server.config.cjs` plus `npm run pm2:start` / `pm2:stop` to run the control-server under PM2 with sane defaults (timeouts, cache hints).

## Efficiency + deep-loading ideas (grounded in 2025 web perf patterns)

- Frontend data: wrap API calls with TanStack Query or React Router v7 loaders + `defer`/`Await` so `/api/containers` and `/api/compose` prefetch on hover and stay cached with background revalidation instead of refetching per view.
- Bundles: split wizard panels and AI/voice components with `React.lazy` + route-level `Suspense`; use Vite’s `build.rollupOptions.output.manualChunks` to keep the hero/docs shell lean (<150KB gz) and lazy-load heavy code (Playwright traces, diagram renderers).
- Assets: convert `media-stack-logo.png` and hero art to WebP/AVIF with a PNG fallback, add `<link rel="preload">` for the logo and display fonts, and set `priority`/`fetchpriority="high"` on the hero image to avoid LCP stalls.
- Rendering: gate motion with `prefers-reduced-motion`, enable `React.useTransition` on theme/sidebar toggles to keep nav interactions responsive, and memoize nav lists/Framer variants.
- Server/API: keep docker status polling behind `DOCKER_STATUS_CACHE_MS` and optional `DOCKER_STATUS_MAX_PARALLEL` to prevent command storms under load; add HTTP cache headers for static docs responses; expose a `/api/health/summary` that bundles compose/container checks to reduce round-trips.

## Visual/UX ideas next (hero-first and media-focused)

- Extend the hero/nav “matrix” look with subtle aurora noise, saturated gradients, and staggered entrance motion on the first fold; add a compact CTA ribbon for “Launch Wizard / View Docs / Remote Deploy”.
- Add a small status chip near the logo that reflects control-server health (uses existing `/api/health`), giving a quick at-a-glance read without opening Settings.
- Make the logo asset truly LCP-friendly: provide `200–320px` WebP at 1x/2x, preload it, and give it `fetchpriority=high` plus an inline `aspect-ratio` to avoid layout shift.
- Add a “Media quality bar” row under the hero that links to Plex/Jellyfin presets and GPU profiles; anchor it to the CTA to keep the page purpose-driven.
- Lean on Tailwind tokens for consistent glows: define `--glow-emerald`, `--glow-cyan`, `--glow-amber` and reuse them across cards, buttons, and nav badges to avoid ad-hoc colors.

## Stability/ops quick wins

- Run control-server under PM2/systemd (no TTY) or `npm run dev -w control-server -- --quiet --legacy-watch` to avoid `read EIO` restarts.
- Add lightweight `pino` log rotation and keep docker ps polling to cached intervals.
- Add a `make check` (lint + smoke + targeted Playwright) to avoid forgetting per-package scripts.

## Suggested near-term task list

- Ship: add TanStack Query for `/api/containers` with hover prefetch and background revalidation.
- Iterate: split wizard steps into lazy chunks; add CTA ribbon + aurora background; gate animations with `prefers-reduced-motion`.
- Validate: run LCP/CLS via Lighthouse CI against docs-site; capture Playwright trace for the hero to confirm no layout shift.

## Validation just ran

- `npm run lint`
- `npm test -w control-server`
- `npm run test -w docs-site -- tests/smoke.spec.ts`
- `npm run build`
