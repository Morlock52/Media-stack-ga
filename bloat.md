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
**Status**: ✅ OPTIMIZED
### `framer-motion`
- **Size**: Large bundle impact (~30KB+ gzipped).
- **Usage**: High.
- **Decision**: Retained for UX quality.

### `react-syntax-highlighter`
- **Status**: ✅ FIXED
- **Action**: Switched to `PrismLight` build and registered specific languages (Bash, YAML, JSON, Docker, TS) only.
- **Impact**: Significant bundle size reduction (removed unused languages).

## 3. Docker & Infrastructure
**Status**: ✅ OPTIMIZED
### Unused / Heavy Containers
- **Action**: Modified `.env` to default `COMPOSE_PROFILES` to empty ("Wizard Mode").
- **Result**: Heavy apps (Plex, *Arr, Tdarr) no longer auto-start.

### Database Bloat
- **Redis & Postgres**:
    - **Analysis**: Authelia is configured to use SQLite for its primary database (Users/Config).
    - **Redis**: Strictly required by Authelia for session management. Cannot be removed without replacing Authelia.
    - **Conclusion**: Current setup (SQLite + Redis) is the minimal viable architecture for this stack.

## 4. Code Architecture
- **Missing `src` in Control Server**: ✅ RESOLVED (Standardized to dist/src structure via build).

## 5. Future Optimization Roadmap (Q1 2026)

### Phase 1: Frontend Bundle Diet
**Goal**: Reduce `docs-site` initial load size by 40%.

1.  **Motion Library Migration**
    *   **Context**: `framer-motion` is powerful but huge (~30KB).
    *   **Plan**: Migrate simple transitions to `motion-one` (~5KB) or pure CSS.
    *   **Example**:
        ```tsx
        // Current (Framer Motion)
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} />

        // Future (Motion One)
        import { animate } from "motion"
        useEffect(() => { animate("#target", { opacity: 1 }) }, [])
        ```

2.  **Tree-Shaking Audit**
    *   **Context**: `lucide-react` icons can bloat bundles if imported incorrectly.
    *   **Plan**: Install `rollup-plugin-visualizer` to identify large chunks.
    *   **Check**: Verify `import { Home } from 'lucide-react'` isn't bundling the entire library.

### Phase 2: Control Server Hardening
**Goal**: Zero-dependency architecture where possible.

1.  **Drop `node-ssh`**
    *   **Context**: `node-ssh` adds significant weight for simple SSH connections.
    *   **Plan**: Use native system SSH client via `child_process.spawn`.
    *   **Benefit**: Removes a complex dependency chain; relies on OS-level stability.
    *   **Example**:
        ```javascript
        spawn('ssh', ['-i', keyPath, 'user@host', 'docker ps'])
        ```

2.  **Schema-Based Validation**
    *   **Context**: Manual `if (!body.x)` checks are verbose and error-prone.
    *   **Plan**: Use Fastify's native JSON Schema validation for routes.
    *   ** Benefit**: Less code, standard errors, faster execution.

### Phase 3: Asset & Image Optimization
**Goal**: Minimize static asset footprint.

1.  **Icon Vectorization**
    *   **Context**: `public/icons` contains raster (PNG) images for services.
    *   **Plan**: Convert all service logos (Plex, Sonarr, etc.) to SVG.
    *   **Benefit**: Crisp scaling on all displays, typically smaller file size (<2KB per logo).

2.  **Gzip/Brotli Pre-Compression**
    *   **Plan**: Configure Vite to pre-compress assets during build.
    *   **Benefit**: Nginx serves static compressed files directly without CPU overhead.

### Phase 4: CI/CD Hygiene
1.  **Dependency Caching**: Ensure `~/.npm` is cached between workflow runs to speed up CI by ~50%.
2.  **Lint-Staged**: Prevent "bloat" code (console.logs, unused imports) from ever entering the repo via pre-commit hooks.
