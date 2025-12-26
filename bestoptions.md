# Best Refactor Options (2025-02-18)

Context: Current stack is Fastify control-server + Vite/React docs UI. Docker actions shell out to the host CLI, auth is optional (Bearer token except `/api/health`), and UI data fetching is ad-hoc. Goal: keep behavior the same while reducing fragility/tech bloat and ensuring reset/restart paths actually work.

Status: Option 1 partially applied — control-server now enforces Docker command timeouts + concurrency limits, scopes compose calls to the project, validates service names, caches compose services, and exposes `/api/system/status` and opt-in `/api/system/reload`. Remaining: request schema validation across routes, PM2/systemd wiring, make-check helper, and frontend data loading upgrades.

Update (applied): request validation added for remote deploy/test, PM2 config + scripts added, and `npm run check` covers lint + control-server tests + docs-site smoke. Still pending: full schema coverage for other routes and frontend data-loading refactor.

## Option 1 — Harden the existing architecture (lowest risk)

- Control-server safety: wrap every route in zod (or Fastify schemas), add `AbortSignal` timeouts and a bounded queue around `runCommand`, and expose `/api/system/status|reload` that shows the compose file/path + cache age and lets PM2/systemd restart the process for a true “reset”. Scope docker calls with `--project-directory "$PROJECT_ROOT"` and validate `serviceName` against `/api/compose/services`.
- Dev/runtime stability: run under PM2/systemd (no nodemon TTY), default `LOG_LEVEL=warn` in dev, and set `DOCKER_STATUS_CACHE_MS`/`DOCKER_STATUS_MAX_PARALLEL` to prevent docker-ps storms. Add early binaries check for `ssh`/`sshpass` in `/api/remote-deploy/test`.
- Frontend data: swap bespoke fetches for TanStack Query or RRv7 loaders + `defer`/`Await`, so `/api/containers` and `/api/compose` are cached/revalidated instead of hammering the API. Keep the new larger logo as-is.
- Verification: `npm run lint && npm run test -w control-server && npm run test -w docs-site -- tests/smoke.spec.ts` plus a manual `/api/system/restart` + `/api/system/reload` smoke to confirm reset semantics.

## Option 2 — Consolidate into a single “BFF” app (medium risk, cleaner long term)

- Fold control-server into the docs UI as a server-side layer (Next.js/Remix w/ server actions or Express/Fastify in `apps/api`), using the Docker Engine API via `dockerode` instead of shelling out. Keep `/api/*` surface compatible but typed.
- Shared runtime: unify auth (Bearer token enforced everywhere except `/api/health`), central logging/metrics, and a single health summary endpoint that bundles compose + container state. Add a restart endpoint that signals the process manager directly.
- Frontend simplification: co-locate data loaders with routes, lazy-load wizard/voice chunks, and replace duplicate CTA/logo blocks with a single component (already started with `LogoBadge`). Keep Vite or move to Next depending on hosting.
- Verification: new e2e that boots the unified app once and drives wizard + restart + remote-deploy test in one Playwright run; drop the separate `npm run dev` concurrency.

## Option 3 — Docker-first runtime only (highest change, minimal host deps)

- Ship a slim control-server container (PM2-managed) that mounts the docker socket and repo; all docker actions run inside the container with explicit `--project-directory /app`.
- Provide a bundled `docker-compose.control.yml` so users never need Node locally; docs UI served from the same container or static hosting hitting the container API over the LAN.
- Add a “factory reset” action that prunes caches, resets `.env` keys to template defaults, restarts PM2, and rebuilds containers with `--pull` to guarantee a clean state.
- Verification: build/push the control-server image, run `docker compose -f docker-compose.control.yml up`, and run Playwright against that environment plus a smoke of `/api/system/restart` and `/api/system/reload`.
