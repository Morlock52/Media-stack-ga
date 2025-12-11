# Tech Bloat Review & Reduction Plan - 2025-12-11

## Overview
This document tracks "tech bloat"—unnecessary dependencies, unmanaged files, and over-engineered configurations—and outlines steps to reduce it.

## 1. Unmanaged Dependencies (Critical)
### Control Server
**Status**: 🚨 CRITICAL
**Issue**: No `package.json` file exists in `control-server`.
**Impact**: Dependencies are effectively unmanaged. The `node_modules` folder contains ~190 packages, likely mostly unused or leftovers.
**Action**:
- [x] Analyze `server.js` imports to identify actual dependencies.
- [x] Create `package.json` with minimal strict dependencies (Fastify stack detected in dist).
- [x] Delete `node_modules` and fresh install.
- [x] Remove redundancy: Deleted `server.js` (Express bloat) and `agents.js` (Root redundant).

## 2. Frontend Dependencies (Docs Site)
**Status**: ⚠️ MODERATE
### `framer-motion`
- **Size**: Large bundle impact (~30KB+ gzipped).
- **Usage**: High (imported in 10+ components).
- **Recommendation**: Retain for now due to high refactor cost, but consider transitioning to `motion-one` or Tailwind `animate-*` classes for new components.

### `react-syntax-highlighter`
- **Size**: Heavy syntax highlighting engine.
- **Usage**: Low (only in `DocsViewer.tsx`).
- **Recommendation**: Replace with a lighter alternative like `microlight.js`, `prismjs` (core only), or just CSS-styled `<pre><code>` blocks if syntax highlighting isn't critical.

## 3. Docker & Infrastructure
**Status**: ⚠️ OPTIMIZABLE
### Unused / Heavy Containers
- **Tdarr / Jellyfin**: These are media processing heavyweights. On macOS credentials (without `/dev/dri` GPU passthrough), they are CPU intensive and large images.
- **Recommendation**: If this is a "Wizard" / "Docs" app, do we need the full media stack running?
    - **Optimized Profile**: Ensure `COMPOSE_PROFILES` defaults to *excluding* the heavy media stack unless explicitly enabled.

### Database Bloat
- **Redis & Postgres**: Running full DB instances for a simple "Control Server" might be overkill if `sqlite` (which Authelia also supports) is sufficient.
    - **Refactor Idea**: Migrate internal tools to SQLite to remove Postgres dependency if *Arr apps aren't the primary focus of this specific repo (which seems to be the "Media Stack **Anti**" / Wizard).

## 4. Code Architecture
- **Missing `src` in Control Server**: The `server.js` file sits in the root. A standardized `src/` structure would be cleaner (as implied by some existing metadata), but for a simple server, the root file is acceptable if `package.json` is present.

## Next Steps
1. Create `control-server/package.json` (Priority 1).
2. Refactor `configuration.yml` (Authelia) to clean formatting (Completed).
3. Investigate `DocsViewer` for lighter syntax highlighting.
