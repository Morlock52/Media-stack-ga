# Project Changes Log

## Configuration Updates
- [x] Generated secure secrets for `.env`
    - `AUTHELIA_JWT_SECRET`
    - `AUTHELIA_SESSION_SECRET`
    - `AUTHELIA_STORAGE_ENCRYPTION_KEY`
- [x] Updated Credentials
    - Set `REDIS_PASSWORD` to user-provided value
    - Removed unused Nextcloud/Postgres credential placeholders from `.env`
    - Updated `config/authelia/users_database.yml`:
        - Replaced `admin` user with `morlock`
        - Updated password hash for `Morlock52$`
- [x] Updated Authelia configuration
    - Replaced placeholder secrets with generated values
    - Configured `AUTHELIA_SESSION_REDIS_PASSWORD` via environment variable
    - Updated Redis password in config to match user request
- [x] Updated Cloudflare Tunnel configuration
    - Verified ingress rules match the domain in `.env` and cover all key media stack services (including Bazarr, Tautulli, Tdarr, and Notifiarr).
    - **ACTION REQUIRED**: User must set `CLOUDFLARE_TUNNEL_TOKEN` in `.env` and `tunnel` ID in `config/cloudflared/config.yml`.

## Docker & Media Expert Improvements
- [x] Docker Image Tags
    - Verified `latest` tags for LinuxServer.io and Authelia images track stable releases.
- [x] Healthchecks
    - Added `healthcheck` to `authelia` service
    - Added `healthcheck` to `redis` service
- [x] Security
    - Enforced strong passwords for all services
    - Passed sensitive Redis password to Authelia via environment variable
- [x] Setup Script Fixes
    - Updated `setup.sh` to pre-create config subdirectories for all services. This prevents Docker from creating them as `root` and causing permission errors.

## 2025 Expert Improvements (Planned)

The following 10 improvements are being implemented to modernize the stack, improve security, and enhance usability.

1.  **Interactive Setup Script**
    *   **Why**: Reduces configuration errors by prompting users for essential values (Domain, Passwords) while providing safe defaults.
2.  **Watchtower**
    *   **Why**: Keeps containers up-to-date automatically, patching security vulnerabilities without manual intervention.
3.  **Dozzle**
    *   **Why**: Provides a lightweight, web-based log viewer. Much faster than Portainer for simply checking "why is this container failing?".
4.  **Homepage**
    *   **Why**: Replaces browser bookmarks with a modern, auto-discovering dashboard. Shows service status and stats at a glance.
5.  **FlareSolverr**
    *   **Why**: Essential for Prowlarr. Many torrent indexers use Cloudflare protection; FlareSolverr bypasses this to ensure reliable searches.
6.  **Tdarr**
    *   **Why**: Automates media transcoding (e.g., H264 -> H265) to save significant disk space without noticeable quality loss.
7.  **Gluetun VPN**
    *   **Why**: **Critical Privacy**. Routes qBittorrent traffic through a VPN tunnel to hide IP address from ISPs and peers.
8.  **Notifiarr**
    *   **Why**: Centralized notification system. Sends alerts to Discord for download completions, server health, and issues.
9.  **Redis Persistence**
    *   **Why**: By default, Redis might lose data on restart. Enabling persistence ensures Authelia sessions remain valid after server reboots.
10. **Expanded Authelia/Cloudflare Coverage**
    *   **Why**: Ensures every externally reachable service is consistently protected behind Authelia and exposed via Cloudflare Tunnel with clean, memorable hostnames.

## Setup Script Enhancements
- [x] Container Safety Checks
    - **Why**: Prevents errors if containers with the same names already exist. Prompts the user to delete/replace or skip them.
    - **Feature**: Added option to start the stack immediately after setup.
- [x] Beautiful GUI (TUI)
    - **Why**: Enhances user experience with a modern, styled terminal interface.
    - **Tech**: Uses `gum` (by Charm) for inputs, spinners, and dialogs. Automatically installs `gum` via Homebrew if missing.
- [x] Cross-Platform Support
    - **Why**: Ensures the setup script runs on any major OS.
    - **Support**: Added automatic package detection and installation for:
        - **macOS** (Homebrew)
        - **Debian/Ubuntu** (`apt`)
        - **Fedora/CentOS** (`dnf`)
        - **Arch Linux** (`pacman`)
- [x] Windows Support
    - **New Script**: Created `setup.ps1` for native Windows support.
    - **Features**: Parity with `setup.ps1` (TUI, auto-install Gum via Winget/Scoop/Choco, path handling).
- [x] Documentation Sync
    - **Updated**: `README.md` and `QUICK_REFERENCE.md` now reflect the removal of Nextcloud and the addition of new services.
    - **Added**: Instructions for Windows setup and TUI usage.

## Docs Site Modernization (2025)
- [x] **UI Overhaul**
    - Implemented premium glassmorphism design system.
    - Added smooth animations and transitions.
    - Responsive layout for all devices.
- [x] **Newbie Mode**
    - Added toggle to switch between simplified instructions and expert details.
    - Synced all content with `plan.md`.
- [x] **Interactive Elements**
    - Sticky navigation sidebar.
    - Copy-to-clipboard functionality for all commands.
    - "Quick Start" shortcuts.

## Project Focus Alignment (Newbie & Expert)
- [x] **README Restructure**
    - Split "Quick Start" into distinct **Beginner** (Interactive) and **Expert** (Automated/Manual) paths.
    - Prominently linked the new **Interactive Documentation Site**.
- [x] **Setup Script Enhancements**
    - Added prompts to launch the documentation site after setup.

## Gemini Project: Modular Builder & Dashboard
- [x] **Project Memory**
    - Created `gemini.md` to document core philosophy and architecture.
- [x] **Modular Architecture**
    - Implemented **Docker Compose Profiles** (`plex`, `arr`, `torrent`, `vpn`, etc.) for dynamic service enabling.
- [x] **Interactive Builder (`setup.sh`)**
    - **Newbie Mode**: One-click "Recommended Stack" installation.
    - **Expert Mode**: Granular multi-select menu for custom stacks.
    - Generates `.env` with `COMPOSE_PROFILES` based on selection.
- [x] **Dynamic Dashboard**
    - Added `homepage.*` Docker labels to all services.
    - Configured Homepage for **Docker Discovery** (automatic widget generation).

## AI Assistant System (November 2025)

### Multi-Agent Architecture
- [x] **Specialized AI Agents**
    - 🚀 **Setup Guide** - Helps configure media stack from scratch
    - 🔍 **Dr. Debug** - Diagnoses and fixes problems with services
    - 📱 **App Expert** - Deep knowledge about each app in the stack
    - 🚢 **Deploy Captain** - Helps deploy stack to remote servers
    - 🤖 **Stack Assistant** - General help and routing to specialists

### Voice Companion (Newbie Mode)
- [x] **Voice-Powered Setup**
    - Web Speech API integration for voice capture
    - Auto-opens for users selecting "Newbie" template
    - Generates structured setup plans from conversation
    - Auto-fills wizard with recommended settings

### AI Transparency UI
- [x] **Status Chips**
    - Real-time display of AI state (idle/thinking/responding)
    - Visual feedback during processing
- [x] **Proactive Nudges**
    - Context-aware suggestions after AI responses
    - Dismissible and actionable

### Health Monitoring & Observability
- [x] **Health Snapshot Endpoint** (`/api/health-snapshot`)
    - Auto-detects stopped/unhealthy/restarting containers
    - Generates issue summary and fix suggestions
- [x] **StatusWidget Enhancements**
    - AI-generated health summaries
    - One-click remediation buttons

### OpenAI Key Management
- [x] **Settings UI** (TopRightActions)
    - Key icon shows status (green when configured)
    - Modal for adding/updating/removing API key
    - Persists to project's `.env` file
- [x] **Server Improvements**
    - Dynamic key loading from `.env`
    - Accepts both `key` and `openaiKey` field names
    - Fixed `const` reassignment error

### Bug Fixes
- [x] Fixed `ENV_OPENAI_KEY` const reassignment error in server.js
- [x] Fixed field name mismatch between frontend (`key`) and backend (`openaiKey`)
- [x] Added AIAssistant to main App.tsx (was missing)
- [x] Improved fetch error handling to avoid empty `{}` console errors
- [x] Added fallback agents when server unavailable

### UX Improvements
- [x] Added API key configuration hint in AI Assistant empty state
- [x] Added default quick suggestions ("How do I set up Plex?", "Help me get started", etc.)
- [x] Clear messaging about "Basic mode" vs "AI-powered" responses

### Components Created/Modified
- `docs-site/src/components/AIAssistant.tsx` - Multi-agent chat UI
- `docs-site/src/components/VoiceCompanion.tsx` - Voice-powered onboarding
- `docs-site/src/components/StatusWidget.tsx` - Health monitoring
- `docs-site/src/components/layout/TopRightActions.tsx` - API key settings
- `control-server/server.js` - AI endpoints and key management
- `control-server/agents.js` - Agent definitions and prompts
