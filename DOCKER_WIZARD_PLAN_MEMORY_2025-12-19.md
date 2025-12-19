# Media Stack “Procker” (Wizard) — Docker Plan + Memory (2025-12-19)

This is a dated, living “plan + memory” doc to keep the Media Stack Wizard (“procker”) reliably runnable **from its own Docker containers**.

## What “runs in Docker” means here

The Wizard is a **control plane**:

- `wizard-web` = static UI served by Nginx (built from `docs-site`)
- `wizard-api` = Fastify API (built from `control-server`)
- `wizard-api` mounts the host Docker socket so it can **orchestrate Docker on the host** (create/inspect containers, generate compose outputs, remote deploy, etc.)

This is **not** Docker-in-Docker; it’s “Docker-out-of-Docker” via `/var/run/docker.sock`.

## Current source of truth (repo entrypoints)

- Main stack: `docker-compose.yml`
- Dockerized Wizard: `docker-compose.wizard.yml`
- Wizard images:
  - UI: `docs-site/Dockerfile`
  - API: `control-server/Dockerfile`
- Docker-mode notes: `README_DOCKER.md`

## Verified working (local smoke test, 2025-12-19)

Host: macOS (Docker Desktop / linux VM context), Docker Engine `28.3.2`, Compose V2.

1) Build + start:

```bash
docker compose -f docker-compose.wizard.yml up --build -d
```

1) Confirm containers:

```bash
docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}' | rg 'media-stack-wizard-(api|web)'
```

1) Smoke checks:

```bash
curl -fsS http://localhost:3001/api/health
curl -I http://localhost:3002 | head -n 5
```

Expected:

- API returns JSON with `"status":"online"`.
- UI returns `HTTP/1.1 200 OK`.
- Remote deploy uses the Wizard-generated `.env` + `docker-compose.yml` content (no dependency on a repo-mounted `.env` file).

Stop:

```bash
docker compose -f docker-compose.wizard.yml down
```

## Required environment + host assumptions

### 1) Absolute paths in `.env` (important)

The Wizard runs inside containers, but it ultimately asks the **host Docker daemon** to mount host paths.

If `.env` uses relative paths like `DATA_ROOT=./data`, those paths frequently won’t resolve as intended for bind mounts.

Recommended: set `DATA_ROOT` (and any path vars) to **absolute host paths**, e.g.:

- `DATA_ROOT=/Users/<you>/media-stack/data` (macOS)
- `DATA_ROOT=/srv/mediastack/data` (Linux)

### 2) Docker socket access (security-critical)

`docker-compose.wizard.yml` mounts:

- `/var/run/docker.sock:/var/run/docker.sock`

Anyone who can call the API effectively has **root-equivalent control** over Docker on the host.

Minimum safety:

- Keep Wizard ports bound to localhost (current defaults: `127.0.0.1:3002`, `127.0.0.1:3001`).
- Set `CONTROL_SERVER_TOKEN` and require `Authorization: Bearer <token>` if you ever expose it beyond localhost.

### 3) CORS / UI URL alignment

If you access the UI from a different URL than `http://localhost:3002`, set:

- `CONTROL_SERVER_CORS_ORIGINS` (comma-separated) for the API
- `VITE_CONTROL_SERVER_URL` build arg for the UI (or run the UI through the built-in nginx proxy rules in `docs-site/nginx.conf`)

## Common failures (and fixes)

### Ports already in use

- Symptom: compose fails to start, or web/api is unreachable.
- Fix: free ports `3001`/`3002`, or change mappings in `docker-compose.wizard.yml`.

### “permission denied” on docker socket (mostly Linux)

- Symptom: API endpoints that talk to Docker fail.
- Fix options:
  - Run `wizard-api` as root (default is typically fine), or
  - Match the socket group on the host via `group_add`, or
  - If using rootless Docker, mount the correct socket (often under `/run/user/<uid>/docker.sock`) and set `DOCKER_HOST=unix:///path/to/socket`.

### Paths mount but containers can’t see your media/config

- Symptom: services start but configs/media are missing.
- Fix: ensure `.env` uses **absolute host paths** for `DATA_ROOT`, `CONFIG_ROOT`, and media dirs.

### UI loads but API calls fail

- Symptom: browser console shows CORS/network errors.
- Fix:
  - Ensure `wizard-api` is reachable at the URL baked into the UI (`VITE_CONTROL_SERVER_URL`).
  - Ensure `CONTROL_SERVER_CORS_ORIGINS` includes your UI origin.

## Plan (next steps to make Docker mode “bulletproof”)

### P0 — Make Docker mode the most reliable path

- [ ] Add a short “Pick one path” doc (host mode vs docker wizard vs power user) and link it from `README.md`.
- [ ] Ensure every doc that mentions docker wizard uses the same ports (`3002` UI, `3001` API) and the same command (`docker compose -f docker-compose.wizard.yml up --build -d`).
- [ ] Add an explicit `.env` section for Docker Wizard mode (absolute paths + minimal required vars).

### P0 — Security hardening if used beyond localhost

- [ ] Require `CONTROL_SERVER_TOKEN` by default when `CONTROL_SERVER_HOST=0.0.0.0`.
- [ ] Optional: place a restricted Docker API proxy between the API container and the host socket (example: `tecnativa/docker-socket-proxy`) to limit what the wizard can do.

### P1 — Reduce drift between generated compose and repo compose

- [ ] Pick a single “source of truth” for service definitions (`docker-compose.yml` vs wizard generator vs setup scripts).
- [ ] Add CI/automation step: validate any generated compose with `docker compose config` before shipping it to users.

### P2 — Developer experience improvements

- [ ] Add a `docker-compose.wizard.override.yml` template (ports, socket path variants, dev logging).
- [ ] Remove the Dockerfile lint warning (`FromAsCasing`) by standardizing `FROM ... AS ...`.

## Memory (what to keep in mind later)

- The Wizard containers are already functional; don’t “re-dockerize” the monorepo—focus on reliability, docs alignment, and security posture.
- The biggest real-world failure mode is **host path resolution**; treat “absolute paths” as a first-class requirement for Docker mode.
- Any exposure of the API + mounted docker socket is a high-risk surface; token-gate it if there’s any chance it won’t stay localhost-only.
