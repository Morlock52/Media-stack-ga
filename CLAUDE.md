# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Media Stack is a self-hosted media platform with a Matrix HUD wizard UI. It generates Docker Compose configurations for Plex, Jellyfin, and the \*Arr stack with Cloudflare Tunnel and Authelia SSO integration.

## Repository Structure

This is an npm workspaces monorepo with two packages:

- **control-server/** - Fastify backend API (TypeScript, Node.js)
- **docs-site/** - React frontend wizard UI (Vite, TypeScript, Tailwind CSS)

## Common Commands

### Development
```bash
npm run dev              # Start both control-server and docs-site concurrently
npm run dev -w control-server    # Start only control-server (port 3001)
npm run dev -w docs-site         # Start only docs-site (port 5173)
```

### Building
```bash
npm run build            # Build all workspaces
npm run build -w control-server  # Build control-server only
npm run build -w docs-site       # Build docs-site only
```

### Testing
```bash
npm run check            # Quick lint + control-server tests + docs-site smoke
npm test                 # Run all workspace tests
npm test -w control-server       # Run control-server vitest tests
npm test -w docs-site            # Run docs-site Playwright tests
npm test -w docs-site -- tests/smoke.spec.ts  # Run single Playwright test
```

### Linting
```bash
npm run lint             # Lint all workspaces
npm run check            # Lint + run smoke tests
```

### Screenshots
```bash
cd docs-site && UI_REVIEW=1 npx playwright test tests/ui-review.screenshots.spec.ts --workers=1
```

## Architecture

### Control Server (control-server/)

Fastify-based API server that provides:
- **Docker routes** (`/api/containers`, `/api/logs`) - Container management via Docker socket
- **AI routes** (`/api/agents/*`) - AI assistant endpoints for config validation
- **Remote routes** (`/api/remote-deploy/*`) - SSH-based remote deployment
- **Arr routes** (`/api/arr/*`) - \*Arr stack API key extraction
- **TTS + Settings** (`/api/tts`, `/api/settings/*`) - OpenAI/ElevenLabs voice output plus API key/status management

Key files:
- `src/index.ts` - Server entrypoint with security checks for exposed hosts
- `src/app.ts` - Fastify app builder with CORS and auth middleware
- `src/routes/` - Route handlers

Environment variables:
- `PORT` (default: 3001)
- `CONTROL_SERVER_HOST` (default: 127.0.0.1)
- `CONTROL_SERVER_TOKEN` - Required when binding to non-localhost
- `CONTROL_SERVER_CORS_ORIGINS` - Comma-separated allowed origins

### Docs Site (docs-site/)

React SPA with Vite that provides:
- **Setup Wizard** - Multi-step configuration flow
- **Storage Planner** - Bitrate/capacity calculator
- **Remote Deploy** - SSH deployment UI
- **AI Assistant** - Voice-enabled config helper

Key files:
- `src/App.tsx` - Router and main layout
- `src/store/setupStore.ts` - Zustand state management for wizard
- `src/components/SetupWizard.tsx` - Main wizard component
- `src/components/RemoteDeployModal.tsx` - Remote deploy UI
- `src/data/services.ts` - Service definitions for the stack

Uses:
- `@/` path alias maps to `./src/`
- Framer Motion for animations
- Radix UI primitives (dialog, tooltip, etc.)
- Tailwind CSS with custom Matrix theme colors

### API Proxy

In development, the Vite dev server proxies `/api` requests to the control server at `http://127.0.0.1:3001`. For production, set `VITE_CONTROL_SERVER_URL`.

## Docker Compose Files

- `docker-compose.yml` - Main media stack configuration
- `docker-compose.wizard.yml` - Runs the wizard UI + control server
- `docker-compose.wizard.secure.yml` - Hardened wizard deployment

## Testing Notes

Playwright tests require both servers running. The `playwright.config.ts` handles this automatically with `webServer` configuration:
1. Builds and starts control-server on port 3001
2. Starts Vite dev server on port 5175 (configurable via `PLAYWRIGHT_UI_PORT`)

For stress testing:
```bash
npm run stress:api       # API stress tests
npm run stress:ui        # UI stress tests with Playwright
npm run stress           # Both
```
