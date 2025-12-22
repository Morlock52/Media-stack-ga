# Modernization Plan

This repo is already a strong “wizard + compose” stack. The goal of this plan is to make it **cleaner to navigate**, **safer to deploy**, and **more reliable to operate**, while keeping changes incremental and reversible.

> **Last reviewed:** December 22, 2025 — Deployment and monitoring stay Docker + SSH only. Refresh screenshots alongside doc edits so the docs-site stays in sync with the UI.

## What changed already (from the shared spec)

- Added a one‑shot post‑deploy checker: `scripts/post_deploy_check.sh`
- Documented it: `docs/operations/POST_DEPLOY_CHECKS.md`
- Exposed it in the Wizard docs UI: `docs-site/src/components/docs/PostDeployChecksGuide.tsx`
- Added an optional self‑hosted GitHub Action: `.github/workflows/post-deploy-check.yml`

## Goals

- **Modern UX**: fast, accessible UI with consistent design tokens and clear information hierarchy.
- **Production‑safe defaults**: secure-by-default configs, minimal foot‑guns.
- **Operational confidence**: repeatable post‑deploy checks + clear troubleshooting paths.
- **Repo hygiene**: fewer “mystery” docs, better folder structure, single source of truth.

## Non‑goals (for now)

- Replacing Traefik/Auth/Tunnel architecture.
- Adding new services by default (keep the core stack stable).
- Huge breaking renames of docker services/container names.

## Phase 1 — Reliability & Ops (1–2 days)

1. Expand `scripts/doctor.sh` into a thin dispatcher:
   - `doctor.sh` (quick local checks)
   - `post_deploy_check.sh` (VPN/Auth/Tunnel)
   - Optional: `scripts/ops/` for more checkers (ports, DNS, storage, permissions)
2. Add a lightweight `/healthz` behind Traefik (and document it) so tunnel checks can hit a stable endpoint.
3. Add “known good” checks:
   - Gluetun: confirm qBittorrent is network‑namespaced behind Gluetun
   - Authelia: verify redirect behavior for protected routes (expect 302)
   - Cloudflared: detect “tunnel connected” log signatures + recent disconnects
4. Improve logs UX:
   - Add a single “Troubleshooting” doc that starts with `docker compose ps` → `logs` → `post_deploy_check.sh`

## Phase 2 — Docs & Information Architecture (1 day)

Problem: many root‑level `.md` files make the repo hard to scan.

Proposed structure (incremental move; keep `README.md` at root):

```
docs/
  getting-started/
  operations/
  security/
  architecture/
  development/
  archive/        # old reviews / scratch docs
```

Steps:

1. Move internal notes (reviews, memory dumps, scratch docs) into `docs/archive/`.
2. Move user‑facing docs into `docs/getting-started/` and `docs/operations/`.
3. Add `docs/README.md` as a table of contents for the docs tree.
4. Update any links in `README.md` and the Wizard docs UI to point to canonical docs.
5. Refresh screenshots when docs change:
   - Local: `cd docs-site && UI_REVIEW=1 npx playwright test tests/ui-review.screenshots.spec.ts --workers=1`
   - Docker-only: `docker compose -f docker-compose.wizard.yml run --rm wizard-web bash -lc "UI_REVIEW=1 npx playwright test tests/ui-review.screenshots.spec.ts --workers=1"`
   - Store updated PNGs in `docs/images/app/` and reference them from `README.md` and docs-site pages.

## Phase 3 — Wizard UI modernization (2–4 days)

1. Design consistency:
   - unify spacing + radii + shadows
   - consistent typography scale and contrast targets
2. Information architecture:
   - add an “Ops” section (post‑deploy checks, backup priorities, update strategy)
   - add a “Security” section (threat model + safe exposure rules)
3. Quality:
   - audit loading states + error surfaces (already strong, but standardize)
   - performance: lazy-load heavy pages and reduce initial bundle

## Phase 4 — Code & Build hygiene (1–2 days)

1. Docker builds:
   - keep workspaces builds stable (lockfile + `npm ci -w ...`)
   - ensure CI uses the same build contexts as local compose
2. Configuration:
   - ensure `.env.example` is the only source of defaults
   - add a “secrets checklist” doc (what must be changed before exposing services)
3. Release workflow:
   - add changelog notes for breaking ops changes

## Acceptance checklist

- `docker compose -f docker-compose.wizard.yml up --build -d` starts cleanly
- Wizard UI loads and docs modal includes “Post‑Deploy Checks”
- `bash ./scripts/post_deploy_check.sh` passes on a correctly configured stack
- CI builds the wizard-api image successfully for scanning
- Screenshots are current (regenerated via Playwright) and linked from `README.md` and docs-site pages
- Docs are discoverable from `README.md` and not scattered across root
