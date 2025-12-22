# Plan: Dynamic GitHub App Integration & Lifecycle Management

## Overview

Design a scalable system to add new apps and cards (like the current `AppsOverview` grid) and integrate them into the stack. The system should support:

- Manual app entry (fast path)
- Registry-backed apps (source of truth)
- Optional AI + internet research ingestion (agent/MCP driven)
- Real stack integration (container detection + “Open app” actions)
- Safe removal (no orphaned UI state)

This plan is aligned to the current implementation:

- **Cards data**: `docs-site/src/components/docs/appData.ts` exports `appCards: AppInfo[]`
- **Cards UI**: `docs-site/src/components/docs/AppsOverview.tsx` renders the card grid and calls `onSelectApp(app.id)`
- **Docs modal**: `docs-site/src/pages/DocsPage.tsx` opens a modal and renders a guide component via a hard-coded `selectedAppId === 'plex' && <PlexGuide />` mapping

## 1. Goals & Non-Goals

### Goals

- Add an app without editing React code for cards.
- Add a guide without adding a new `selectedAppId === ...` JSX line.
- Allow apps to be “aware of the stack” (detect if running via control-server Docker endpoints).
- Support a curated builtin catalog plus user-added apps.

### Non-Goals (initial phase)

- Fully autonomous modifications to `docker-compose.yml` without explicit user confirmation.
- Unreviewed AI changes to code files.

## 2. Core Architecture (Registry + Renderer)

### A. App Registry (single source of truth)

Introduce a registry format that can represent both built-in and custom apps.

Recommended fields (superset of current `AppInfo`):

- **id**: stable slug (matches current `AppId` concept)
- **name**
- **category**
- **description**
- **iconKey** (string key mapped to `lucide-react`, replacing direct `LucideIcon` in data)
- **difficulty** (`Easy|Medium|Advanced`)
- **time** (string)
- **links**: `{ homepage?, docs?, github?, support? }`
- **stack**: `{ dockerServiceNames?: string[], defaultPort?: number, urlTemplate?: string }`
- **tags**: string[]
- **source**: `builtin|custom`
- **createdAt/updatedAt**

Why `iconKey` instead of `LucideIcon`?

- `appData.ts` currently imports icons and stores the function reference in `appCards`.
- A registry (JSON) can’t store functions; using a key keeps the registry portable.

### B. Storage strategy (two viable options)

#### Option 1 (recommended): control-server owns custom apps

- Store custom registry entries under the control-server (persist across UI builds).
- Frontend fetches at runtime.

Proposed storage:

- `control-server/data/apps-registry.json`
- `control-server/data/app-guides/<appId>.md` (or `.mdx` if desired)

#### Option 2: docs-site owns registry (build-time)

- Store registry in `docs-site/src/data/apps-registry.json`.
- Requires a rebuild to add apps.
- Simpler but not “integrated into the stack” at runtime.

### C. Frontend renderer changes

#### Cards

- Replace `const allApps = appCards` with `useAppsRegistry()` that returns:
  - builtin apps (existing `appCards` can remain as a builtin list)
  - plus custom apps from the registry API
- Convert `iconKey` → actual icon component using the existing `ICON_MAP` pattern in `appData.ts`.

#### Guides

Current state:

- `DocsPage.tsx` renders a modal and uses a long hard-coded `selectedAppId === 'plex' && <PlexGuide />` list.

Proposed state:

- Maintain a **builtin guide map**: `Record<AppId, React.ComponentType>`
- For **custom apps**, render a markdown guide fetched from the control-server:
  - `GET /api/apps/:id/guide` → markdown
  - `MarkdownGuideRenderer` in the docs-site

This lets you add apps without generating `.tsx` guides or updating `index.ts` exports.

## 3. Stack Integration (“make it real”)

Use the existing control-server Docker endpoints (`/api/containers`, `/api/health-snapshot`) to power per-app status.

### A. Container ↔ App mapping

Add optional mapping fields in registry:

- `stack.dockerServiceNames`: e.g. `["plex", "plex-meta-manager"]`

UI behaviors:

- Card can show:
  - “Running / Stopped / Missing”
  - number of containers matched
- Card actions:
  - “Open” (when running and URL known)
  - “Install / Add to stack” (links to wizard step or compose snippet)

### B. URL resolution

For apps with predictable URLs:

- `stack.urlTemplate`: e.g. `http://{host}:{port}`
- Use the same host as the control-server’s host (or user-configured “stack host”).

If ports are not known, show a safer action:

- “View docs”
- “Find in Portainer/Homepage”

## 4. AI-Assisted App Ingestion (agent + MCP)

### A. User flow

- Add an “Add App” button in `AppsOverview`.
- Inputs:
  - app name (free text) OR GitHub URL OR Docker image
  - optional category override
- Output:
  - new registry entry
  - optional generated guide markdown

### B. Agent architecture

Implement a control-server “ingestion pipeline” that can be run with or without AI.

Suggested steps:

1. **Normalize input** (parse GitHub URL / image name)
2. **Fetch sources** (internet research)
   - GitHub README
   - official docs site
   - docker image metadata
3. **Extract facts** (ports, env vars, volumes, auth defaults)
4. **Generate proposal** (metadata + guide markdown)
5. **Validate + sanitize** (IDs, filenames, length limits)
6. **Human review required** (diff-style preview)
7. **Persist registry + guide**

### C. MCP usage (as of 12/21/25)

Make the internet research step pluggable via MCP tools.

- **MCP “fetchers”**: GitHub MCP, generic web fetch MCP, docker hub MCP (if available)
- **Fallback**: plain HTTP fetch from the control-server with allowlisted domains

Important safety constraints:

- Never execute remote scripts.
- Never auto-edit compose files without explicit confirmation.
- Treat all fetched text as untrusted.

### D. AI prompt strategy

Few-shot using your existing catalog:

- Current fields in `appData.ts` are the “golden” format for cards.
- The guide markdown should match your UI’s guide style (step-by-step, non-technical).

Generated artifacts:

- `AppRegistryEntry` (JSON)
- `GuideMarkdown` (Markdown)
- Optional: `ComposeSnippet` (text block only; never applied automatically)

## 5. API Design (control-server)

### A. Registry endpoints

- `GET /api/apps` → list registry entries (builtin + custom if desired)
- `POST /api/apps` → create custom app (manual or AI-proposed)
- `DELETE /api/apps/:id` → remove custom app
- `GET /api/apps/:id/guide` → markdown
- `PUT /api/apps/:id/guide` → update markdown

### B. Ingestion endpoints

- `POST /api/apps/ingest` → start ingestion job (returns job id)
- `GET /api/apps/ingest/:jobId` → job status + progress + proposed artifacts
- `POST /api/apps/ingest/:jobId/apply` → persist after human approval

## 6. UI Integration Details (docs-site)

### A. AppsOverview

- Merge builtin + registry apps.
- Render badges:
  - “Builtin” vs “Custom”
  - “Running” status (if mapping exists)
- Add per-card actions:
  - “Open” (if URL known)
  - “Guide” (opens modal)
  - “Remove” (custom only)

### B. DocsPage / guide display

Phase 1 (minimal change):

- Keep the modal UX.
- Replace the long `selectedAppId === ...` list with:
  - builtin guide map lookup
  - else markdown guide renderer

Phase 2 (better UX):

- Add route `/docs/:appId` so guides are linkable and refresh-safe.
- Keep modal optional.

## 7. Deletion / “Trace Erase”

With the recommended runtime registry approach, deletion is straightforward and safe:

- Delete registry entry from `control-server/data/apps-registry.json`
- Delete `control-server/data/app-guides/<id>.md`
- UI updates on next fetch (or optimistic update)

No React source files are modified, so there is no need to patch:

- `docs-site/src/components/docs/index.ts`
- `DocsPage.tsx` conditional guide list

## 8. Validation & Security

- **ID sanitization**: allow `[a-z0-9-]` only, max length.
- **Collision policy**: prevent overwriting builtin IDs.
- **Content limits**: cap markdown size; strip HTML; escape dangerous links.
- **Domain allowlist** for fetchers.
- **Auth**: require `CONTROL_SERVER_TOKEN` (same pattern as other control-server endpoints) for write endpoints.

## 9. Milestones (phased)

### Milestone 1: Data-driven registry (no AI)

- Add registry schema + loader
- Merge builtin + custom in `AppsOverview`
- Replace `DocsPage` conditional list with builtin-map + markdown fallback

### Milestone 2: Stack-aware cards

- Add service mapping and status display using `/api/containers`
- Add “Open” link support (host/port resolution)

### Milestone 3: AI/MCP ingestion

- Implement ingestion job endpoints
- Add UI workflow for “propose → review → apply”
- Add MCP fetcher adapters + safe allowlist

### Milestone 4: Deep-linkable guides

- `/docs/:appId` route, shareable links, refresh-safe

---
*Note: This plan is intentionally architecture-first. Implementation can start with Milestone 1 without touching Docker Compose or requiring codegen of new React guide components.*
