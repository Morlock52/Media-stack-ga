# Tech Bloat Review & Reduction Plan - 2025-12-12

## Overview
This document tracks "tech bloat"—unnecessary dependencies, unmanaged files, and over-engineered configurations—and outlines steps to reduce it.

## 1. Unmanaged Dependencies (Critical)
### Control Server
**Status**: ✅ FIXED
**Issue**: No `package.json` file existing previously.
**Action**:
- [x] Analyzed imports.
- [x] Created `package.json` with minimal strict dependencies.
- [x] Deleted `node_modules` and fresh install.
- [x] Removed redundancy (server.js, agents.js).

## 2. Frontend Dependencies (Docs Site)
**Status**: ✅ OPTIMIZED
### `framer-motion`
- **Size**: Large bundle impact (~30KB+ gzipped).
- **Usage**: High.
- **Decision**: Retained for UX quality.

### `react-syntax-highlighter`
- **Status**: ✅ FIXED
- **Action**: Switched to `PrismLight` build.
- **Impact**: Significant bundle size reduction.

## 3. Docker & Infrastructure
**Status**: ✅ OPTIMIZED
### Unused / Heavy Containers
- **Action**: Modified `.env` to default `COMPOSE_PROFILES` to empty.
- **Result**: Heavy apps (Plex, *Arr, Tdarr) no longer auto-start.

### Database Bloat
- **Redis & Postgres**:
- **Conclusion**: Current setup (SQLite + Redis) is the minimal viable architecture.

## 4. Code Architecture
- **Missing `src` in Control Server**: ✅ RESOLVED.

## 5. Optimization Roadmap (Q1 2026) - EXECUTION STATUS

### Phase 1: Frontend Bundle Diet
**Goal**: Reduce `docs-site` initial load size.

1.  **Motion Library Migration**
    *   **Status**: DEFERRED (Retained Framer Motion for now due to heavy usage in UI components).

2.  **Tree-Shaking Audit**
    *   **Status**: ✅ COMPLETED
    *   **Action**: Installed `rollup-plugin-visualizer` in `vite.config.ts`. Run `npm run build` to view analysis at `stats.html`.

### Phase 2: Control Server Hardening
**Goal**: Zero-dependency architecture where possible.

1.  **Drop `node-ssh`**
    *   **Status**: ✅ COMPLETED
    *   **Action**: Replaced `node-ssh` with native `child_process.spawn` calling `ssh` and `scp`. 
    *   **Note**: Password authentication support dropped (Keys only).

2.  **Schema-Based Validation**
    *   **Status**: ✅ COMPLETED
    *   **Action**: Implemented Fastify Schema validation for `remote-deploy` endpoints.

### Phase 3: Asset & Image Optimization
**Goal**: Minimize static asset footprint.

1.  **Icon Vectorization**
    *   **Status**: ✅ VERIFIED
    *   **Note**: `public/icons` directory does not exist. Application uses `lucide-react` SVGs primarily. No raster icons found to convert.

2.  **Gzip/Brotli Pre-Compression**
    *   **Status**: ✅ COMPLETED
    *   **Action**: Configured `vite-plugin-compression` in `vite.config.ts` to generate `.gz` and `.br` files at build time.

### Phase 4: CI/CD Hygiene
1.  **Dependency Caching**: Implementation in CI pipeline configuration (pending CI setup).
2.  **Lint-Staged**: Pending.
