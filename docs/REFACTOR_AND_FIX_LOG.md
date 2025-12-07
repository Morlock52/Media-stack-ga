# Refactor and Fix Log - Agentic System

**Objective**: Fix the broken "Add/Manage App" feature, ensure robust connectivity between Frontend and Backend, and refactor using modern best practices (Vite Proxy, React Query if needed).

## Status
- [ ] **Phase 1: Diagnosis**
    - [ ] Verify Backend API health (`curl`).
    - [ ] Identify connectivity blocker (CORS vs Network).
- [ ] **Phase 2: Architecture Refactor**
    - [ ] Implement Vite Proxy to eliminate CORS/Port issues during dev.
    - [ ] Update Frontend Client (`controlServer.ts`) to use relative paths.
    - [ ] Ensure Backend (`ai.ts`) handles JSON read/write safely with proper locking or atomic writes (optional but good).
- [ ] **Phase 3: Testing**
    - [ ] automated smoke test of API.
    - [ ] Browser verification of "Add App" flow.

## Log
- **Session Start**: Detected connectivity issue ("System I'm having trouble connecting").
- **Hypothesis**: The frontend (port 5173) cannot reliably hit `localhost:3001` due to browser quirks or network binding (IPv4 vs IPv6).
- **Solution**: Use Vite's `server.proxy` to forward `/api` requests to `http://localhost:3001`. This is the industry standard for local dev.

## Architecture Decisions
1.  **Vite Proxy**: We will route all `/api/*` requests from the frontend to the backend. This mimics production (where Nginx usually handles this) and simplifies local dev.
2.  **Relative URLs**: The frontend will simply call `/api/agent/chat`, making it environment-agnostic.

