# Media Stack Anti — Full Product + Code + Docs Review (2025-12-28)

This review covers the **entire repo** (code + scripts + Docker + docs + UI) with a focus on:
- **UI/UX quality** (professional, balanced layout, consistent visual system)
- **Correctness** (routes, build output, runtime issues like blank/white screens)
- **Tech bloat** (unused files, dead components, duplicate flows)
- **Imports/deps hygiene** (unused deps, transitive deps, bundle size)
- **Security posture** (secrets handling, unsafe defaults, persistence)
- A concrete **roadmap** to make this the “best app possible”

## Reality check (scope + what I did / didn’t do)

- Repo snapshot date: **2025-12-28** (your earlier request referenced 12/17–12/18; this doc reflects the current workspace state).
- I can run commands with network access, but I do **not** have a dedicated “web browsing + citations” tool here. I **did not** “watch YouTube” or browse social feeds. I *can* recommend widely adopted patterns and point you to sources to confirm.

## What I validated locally (repeatable)

### UI validation (Playwright)
- Smoke tests: `docs-site/tests/smoke.spec.ts` pass.
- Screenshot harness: `docs-site/tests/ui-review.screenshots.spec.ts` (runs only with `UI_REVIEW=1`) generates:
  - `docs-site/test-results/ui-review/01-home-desktop.png`
  - `docs-site/test-results/ui-review/05-docs-desktop.png`
  - `docs-site/test-results/ui-review/06-settings-desktop.png`
  - `docs-site/test-results/ui-review/07-home-mobile.png`

### Stress tests (added)
- Frontend stress (Playwright, gated): `docs-site/tests/stress.wizard.spec.ts` runs only with `STRESS=1`.
- Backend stress (Node script): `control-server/tests/stress.mjs` supports concurrency + endpoint mix + “don’t mutate by default”.

## Executive summary (what’s good / what still needs work)

### What’s already strong
- **Visual direction** is clear: dark “neon glass” look with gradients, blur, and consistent rounded geometry.
- **Wizard-first IA** is correct for this product: users land on value immediately (generate configs).
- **Docs are integrated** (not a separate site): the guides flow feels like part of the product.
- **Control-server split** is the right long-term architecture (local control plane + UI client).

### What needed fixing (and is now addressed)
- **Blank white screen on deep-link routes** (`/docs`, `/settings`) due to Vite base/asset URL mismatch.
- **UI duplication & clutter** (duplicate header controls, too many wizard “action buttons”).
- **Secrets persisting in localStorage** (OpenAI key and other sensitive config values).
- **Dead UI bloat** (large number of unused components) and some redundant UI sections.

### What still needs attention (high leverage)
- **Docs guide content styling** is not fully token-driven (some guides still hardcode “dark” colors); solved structurally in `AppGuideLayout`, but you should continue migrating guides to semantic tokens or MDX.
- **Docs/search + information architecture**: you’ll want a proper search/filter experience (and “add custom app” flow should be first-class).
- **Security hardening for control-server** if it ever becomes reachable beyond localhost (auth, rate limits, request limits, logging redaction).

---

# UI/UX Review (Senior Designer Pass)

This section is opinionated and practical. The goal is: **premium, consistent, and calm**—no “busy dashboard syndrome”.

## 1) Visual System (what to standardize)

### Typography
- **Body**: Inter is a good default (already present).
- **Headings**: Outfit / Space Grotesk are fine, but pick *one* as “brand heading” and use it consistently (avoid mixing multiple display fonts unless there is a strict hierarchy rule).
- **Code**: JetBrains Mono works well for `.env`, YAML, etc.

Recommendation:
- Keep: `Inter` (body) + `Outfit` (headings) + `JetBrains Mono` (code).
- Remove unused fonts if any remain to reduce render-blocking and layout shift.

### Spacing + radii
You’re already leaning into:
- `rounded-xl` / `rounded-2xl` / `rounded-3xl`
- 8px spacing rhythm

Recommendation:
- Commit to a spacing scale (4/8/12/16/24/32/48/64).
- Standardize card padding: use **24px** for primary panels (`p-6`) and **16px** for secondary (`p-4`).

### Color + contrast
The “neon glass” look only looks premium when contrast is controlled:
- Avoid mixing `text-white`, `text-gray-*` in themed surfaces. Prefer **semantic tokens**: `text-foreground`, `text-muted-foreground`, etc.
- Keep accent usage narrow: one primary gradient and a single secondary accent.

## 2) Home page (landing + wizard handoff)

### What’s working
- Hero + CTA are strong and readable.
- The “How It Works” topology block is a good mid-page trust builder.
- The overall vertical rhythm is now cleaner (duplicate “Quick Features” block removed).

### Improvements applied
- Removed duplicated feature grid later on the page (kept the hero’s feature cards as the single “value props” section).
- Added a “View Docs” secondary CTA in the hero so users can self-serve without scrolling.
- Reduced heading repetition by renaming the wizard header to “Setup Wizard”.

### Remaining polish (optional but high impact)
- Consider making the “How It Works” block slightly shorter (less vertical whitespace) so the wizard appears sooner on laptops.
- If the logo reads as a “face/avatar”, consider a more neutral brand mark (or remove the “badge above hero” treatment).

## 3) Setup Wizard (the product’s core)

### What’s working
- Stepper + progress bar is clear and gives confidence.
- Wizard card has strong “app-like” focus with the glass panel.

### Improvements applied
- Collapsed “Export/Import/Templates” into a single **Tools** dialog to reduce header clutter.
- Removed a duplicated global action cluster (`TopRightActions`) that was conflicting with the new header patterns.
- Made stack selection step use semantic tokens so it reads correctly across themes.

### Remaining issues (next)
- The wizard still contains a mix of “utility affordances” (profiles, tools, reset). The new Tools dialog helps; next is to:
  - Move “Profiles” into Tools, or
  - Make Profiles a tab inside the Tools dialog (cleaner).

## 4) Docs (guides + modal experience)

### What’s working
- Grid of app cards looks professional and consistent.
- The modal is well-sized and feels like a “product surface” not a “browser alert”.

### Improvements applied
- Added a consistent header action set inside the modal (Theme toggle, Settings link, Close) so users don’t get “stuck”.
- Removed extra top-right controls previously injected into guide pages.
- Added `darkMode: ['class']` to Tailwind config so any `dark:` utility is consistent with your theme toggle.

### Next improvements (recommended)
- Add **search + tags** at the top of the docs page:
  - filter by “Streaming”, “Automation”, “Utilities”, “Monitoring”, “Security”
  - quick search by app name
- Consider moving guides to **MDX** long-term:
  - The current TSX guides are fine, but MDX would make authoring + style consistency easier.

## 5) Settings (API & integrations)

### What’s working
- The “connected/last checked” status strip reads clean and modern.
- Cards are balanced and aligned.

### Improvements applied
- Header includes “Back to wizard”, “Docs”, and theme toggle for consistent navigation.

---

# Technical Review (errors, bloat, imports, risks)

## Repo inventory (tracked)
- Tracked files: ~`260`
- Tracked markdown files: ~`29`
- Tracked JS/TS files: ~`151`

## Documentation review (MD drift + sprawl)

There are many root-level markdown “plan/review/status” files (`README.md`, `plan.md`, `improve.md`, `gui.md`, `REACT_19_MIGRATION.md`, `review-12-18-25.md`, etc.). The main issues are:

### 1) Contradictory claims (example)
- `REACT_19_MIGRATION.md` claims “React 19 migration complete”, but `docs-site/package.json` currently uses React **18.3.x**.

Action:
- Either complete and re-verify the React 19 upgrade, or mark the migration doc as **historical** and move it into an archive folder.

### 2) No single “Start Here”
A new user can’t easily tell which entry path is authoritative:
- web wizard
- `setup.sh`
- “manual docker compose”
- control-server

Action:
- Create `docs/START_HERE.md` that asks 2–3 questions (“Do you want GUI or CLI?”, “Local or remote deploy?”) and routes users to one path.
- Move old plans to `docs/archive/` and add a banner: “historical / not guaranteed current”.

### 3) Examples vs real config drift
Several docs reference `.env` and compose snippets. If examples drift from the actual generator output, users lose trust fast.

Action:
- Add a “golden config” snapshot test:
  - generate wizard output for a fixed input
  - compare generated `.env` / YAML / compose to checked-in fixtures

## 1) Blank white screen (root cause + fix)

Symptom:
- Opening `/docs` or `/settings` directly showed a blank white screen (assets failed to load).

Root cause:
- Vite `base` configured to a relative path (`./`) which breaks nested-route asset resolution in some deployments.

Fix applied:
- Set `docs-site/vite.config.ts` base to `/` so asset URLs resolve correctly on deep links.
- Added Playwright coverage so regressions are caught (`docs-site/tests/smoke.spec.ts`).

## 2) Tech bloat + dead UI

What was happening:
- Many components existed but were not reachable from any route.
- This increases cognitive load, bundle size, and breaks “design consistency” because unused components drift stylistically.

Fix applied:
- Removed a large set of unused components and related dependencies.
- Kept the “modern” design system and reduced duplication.

Ongoing recommendation:
- Run dead-code detection regularly (example tools):
  - `knip` for unused files/exports
  - ESLint rules for unused imports/vars

## 3) Imports and bundle size

High leverage pattern:
- Avoid wildcard imports (`import * as Icons from 'lucide-react'`); prefer direct imports for tree-shaking.

Fixes already applied across parts of the UI:
- Direct icon imports in the modern UI reduce shipped JS.

## 4) Secrets handling (P0)

### Issue
Persisting keys locally is dangerous and easy to leak via:
- browser profile syncing
- shared machines
- accidental screenshots/screen recordings

### Fix applied
`docs-site/src/store/setupStore.ts` now **scrubs sensitive fields** before persistence:
- `openaiApiKey`
- `password`
- `cloudflareToken`
- `plexClaim`
- `wireguardPrivateKey`
- `wireguardAddresses`
It also scrubs those fields inside saved profiles before persisting.

Important nuance:
- The UI can still accept keys during a session; it just won’t silently persist them across reloads.
- For the best UX, store secrets in the **control-server** (local) and keep the browser as “stateless” as possible.

### Next hardening steps
- Treat `CONTROL_SERVER_TOKEN` as mandatory when `CONTROL_SERVER_HOST` is not localhost.
- Add rate limiting and body size limits around AI endpoints.

## 5) Control-server endpoint safety

Good:
- Validation exists in many places (e.g., remote deploy).
- CORS allowlist exists.

Needs improvement if exposed:
- Add per-route limits:
  - max payload size (especially for AI and registry endpoints)
  - request rate limiting
- Redact secrets in logs.

---

# Stress & Function Testing (what to run)

## Frontend (docs-site)

Smoke tests:
- `cd docs-site && npm test`

UI screenshot regression set (manual):
- `cd docs-site && UI_REVIEW=1 npx playwright test tests/ui-review.screenshots.spec.ts --workers=1`

Stress tests (manual):
- `cd docs-site && STRESS=1 STRESS_ROUTE_LOOPS=20 STRESS_WIZARD_LOOPS=5 npx playwright test tests/stress.wizard.spec.ts --workers=1`

## Backend (control-server)

If you have a running control-server at `CONTROL_SERVER_URL`:
- `cd control-server && node tests/stress.mjs`

To start the control-server automatically (requires `npm -w control-server run build` first):
- `cd control-server && START_CONTROL_SERVER=1 TOTAL_REQUESTS=200 CONCURRENT_REQUESTS=30 node tests/stress.mjs`

To include mutating endpoints (off by default):
- `INCLUDE_MUTATING_ENDPOINTS=1 node tests/stress.mjs`

---

# “Best App Possible” Roadmap (concrete plan)

## Phase 0 (now): polish + safety (P0/P1)
- Lock down secrets:
  - keep `.env` untracked
  - ensure wizard never persists secrets (done)
- Add CI gates:
  - docs-site: lint + Playwright smoke
  - control-server: lint + unit tests + minimal API smoke
- Unify docs guide styling:
  - continue migrating guide content away from hardcoded `text-gray-*` and `text-white`

## Phase 1 (1–2 weeks): product UX upgrades
- Docs page:
  - add search box + tag filters
  - add “Add Custom App” as a real flow (backed by registry)
- Wizard:
  - consolidate Profiles into Tools
  - add a “Save/Share” UX that is explicit about what gets saved (and what does not)

## Phase 2 (2–6 weeks): single source of truth

Create a registry package that drives:
- wizard service list
- compose generation
- docs metadata (categories, setup time, ports, URLs)

Benefits:
- removes drift (docs vs compose vs wizard)
- enables generation of docs indexes and templates

## Phase 3 (6–12 weeks): control plane maturity
- Authentication/authorization model for control-server
- Rate limiting + request budgets for AI endpoints
- Optional “remote deploy” hardening (scoped capabilities, better audit trail)

---

# Recommended references (for a web-research pass later)

If you want me to do a targeted web research pass next, these are the areas to validate against current best practice:
- Radix UI + Tailwind composition patterns (“shadcn/ui” style primitives)
- Playwright “visual regression” workflows (snapshot testing + artifact uploads)
- Fastify hardening patterns (rate limit, request size limits, logging redaction)
- “Single source of truth registry” pattern used by modern DevOps UIs (compose/helm generation + docs metadata)
