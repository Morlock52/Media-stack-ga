# Project Improvement Plan

## ✅ Completed Improvements

### 1. Fix Authelia Configuration Mismatch
- **Status**: **Done**
- Updated `setup.sh`, `setup_auto.sh`, and `setup.ps1` to use `AUTHELIA_IDENTITY_VALIDATION_RESET_PASSWORD_JWT_SECRET`.
- Validated `.env` generation.

### 2. Enhance Setup Script Validation
- **Status**: **Done**
- Added validation for `CLOUDFLARE_TUNNEL_TOKEN` in setup scripts.
- Added warnings for default/empty values.

### 3. Documentation Updates
- **Status**: **Done**
- Updated `README.md` and `QUICK_REFERENCE.md` with correct variable names.
- Added secret rotation instructions.

### 4. Security Improvements
- **Status**: **In Progress**
- Created `rotate_secrets.sh` for automated secret regeneration.
- **Next**: Implement VPN profile check in wizard.

---

## 🚀 New Enhancement Plan (2025)

### 1. GUI Improvements (React & Design Trends) 🎨
*Focus on "Premium" feel and "Micro-interactions"*

1.  **Bento Grid Dashboard Layout**:
    -   **Concept**: Replace standard lists with a modular, responsive "Bento Grid" layout for service cards.
    -   **Benefit**: Modern, organized, and information-dense without clutter. Fits the "Dashboard" aesthetic perfectly.
    -   **Tech**: CSS Grid v3, `framer-motion` for layout transitions.

2.  **Refined Glassmorphism 2.0**:
    -   **Concept**: Update the "Deep Glass" look with multi-layered backdrops, noise textures, and dynamic borders that react to cursor movement.
    -   **Benefit**: Increases depth and perceived quality of the UI.
    -   **Tech**: `backdrop-filter`, `mix-blend-mode`, and CSS variables for dynamic lighting.

3.  **Micro-Interactions & Haptics**:
    -   **Concept**: Add subtle animations for *every* user interaction (button presses, toggle switches, card hovers).
    -   **Benefit**: Makes the application feel "alive" and responsive.
    -   **Tech**: `framer-motion` (spring animations), `use-sound` for subtle UI sounds (optional).

4.  **Command Palette (Cmd+K)**:
    -   **Concept**: Global search and command bar to navigate anywhere or trigger actions (e.g., "Restart Sonarr", "Go to Logs").
    -   **Benefit**: Power user efficiency.
    -   **Tech**: `cmdk` library.

5.  **Real-Time "Island" Notifications**:
    -   **Concept**: Dynamic status indicator (like Dynamic Island) for active background tasks (e.g., "Deploying Stack...", "Backing up...").
    -   **Benefit**: Non-intrusive but highly visible system status.

### 2. AI Improvements (Agentic DevOps) 🧠
*Focus on "Self-Healing" and "Contextual Intelligence"*

1.  **"Dr. Debug" Log Analysis Agent**:
    -   **Concept**: A specialized agent that tails `docker logs`, parses errors, and correlates them with a local vector database of known issues (e.g., "Database locked" -> Suggests removing `.lock` file).
    -   **Tech**: Vector Search (local), Regex patterns, LLM for explanation.

2.  **Predictive Resource Analytics**:
    -   **Concept**: AI analyzes historical CPU/RAM/Disk usage to predict future bottlenecks (e.g., "Warning: Plex metadata will fill disk in 4 days").
    -   **Tech**: Simple linear regression models running in `control-server`.

3.  **Natural Language Infrastructure Querying**:
    -   **Concept**: "Chat with your Stack". Ask: "Why is Radarr failing to grab releases?" -> Agent checks Prowlarr connectivity and Radarr logs.
    -   **Tech**: RAG (Retrieval Augmented Generation) over system state.

4.  **Intelligent Config Validator (Pre-flight)**:
    -   **Concept**: AI validates `config.yml` and `.env` files not just for syntax, but for *logic* (e.g., "You enabled VPN but didn't set a provider").
    -   **Tech**: LLM-based validation rules.

5.  **Self-Healing "Auto-Fix" Actions**:
    -   **Concept**: If a container is unhealthy for >5 minutes, the AI proposes (or executes) a fix (e.g., `docker restart <container>`).
    -   **Tech**: Docker Healthcheck hooks + Agent decision logic.

### 3. Backend Improvements (Node.js & Infrastructure) ⚙️
*Focus on "Performance" and "Modularity"*

1.  **Migration to Fastify**:
    -   **Concept**: Switch `control-server` from Express (implied) to Fastify.
    -   **Benefit**: 2x-5x performance increase, built-in schema validation, better async/await support.

2.  **Structured Logging (Pino)**:
    -   **Concept**: Replace `console.log` with `pino` for high-performance, structured JSON logging.
    -   **Benefit**: Easier for the AI agent to parse and analyze logs.

3.  **Modular "Include" Architecture**:
    -   **Concept**: Refactor `docker-compose.yml` to use the `include` directive (Docker Compose v2.20+).
    -   **Benefit**: Decouple services into separate files (e.g., `compose.arr.yml`, `compose.media.yml`).

4.  **Type-Safe Backend (TypeScript)**:
    -   **Concept**: Migrate `control-server` to TypeScript.
    -   **Benefit**: Prevents runtime errors, better developer experience, easier refactoring.

5.  **Edge-Ready Caching**:
    -   **Concept**: Implement aggressive caching for static assets and API responses using Redis or in-memory caching.
    -   **Benefit**: Instant UI load times.

### 4. System to Add New Apps (Plugin Architecture) 🧩

**"Drop-in App System"**

*   **Structure**:
    ```text
    /apps
      /sonarr
        compose.yml      # Service definition
        metadata.json    # UI details (icon, description, category)
        config/          # Default config files
    ```
*   **Mechanism**:
    1.  **Discovery**: The `control-server` scans the `/apps` directory on startup.
    2.  **Registration**: It reads `metadata.json` to populate the "App Store" in the UI.
    3.  **Deployment**: When a user selects an app, the system adds the app's `compose.yml` path to the main `COMPOSE_FILE` environment variable (e.g., `COMPOSE_FILE=docker-compose.yml:apps/sonarr/compose.yml`).
    4.  **Config**: Default configs are copied to the user's config directory.

*   **Benefit**:
    -   Zero-touch core updates (adding an app doesn't touch the main `docker-compose.yml`).
    -   Community-friendly (users can share "App Packs").

---

## Execution Order

1.  **Refactor Backend to Fastify & TypeScript** (Solid foundation)
2.  **Implement "Drop-in" App System** (Scalability)
3.  **Build Bento Grid Dashboard** (Visual Upgrade)
4.  **Deploy "Dr. Debug" Agent** (Intelligence)
5.  **Documentation Overhaul** (Support)
