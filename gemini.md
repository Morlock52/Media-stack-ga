# Project Gemini: The Ultimate Media Stack Builder

## Core Philosophy
To provide a **modular, choice-driven** media and application stack that caters to both **Newbies** (guided, "just work" experience) and **Experts** (granular control, "TRaSH Guides" optimization).

## Key Features
1.  **Choice-Driven Architecture**:
    *   Users select their preferred components (e.g., Plex vs. Jellyfin, qBittorrent vs. Deluge).
    *   Powered by **Docker Compose Profiles** for seamless enabling/disabling of services.
2.  **Integrated Dashboard**:
    *   **Homepage** is the central hub.
    *   Configuration is dynamically generated based on user selections.
3.  **TRaSH Guides Standards**:
    *   Optimized volume mappings (Atomic Moves/Hardlinks).
    *   Proper permission management (`PUID`/`PGID`).
4.  **Dual-Mode Setup**:
    *   **Newbie Mode**: One-click "Recommended Install" with sensible defaults.
    *   **Expert Mode**: Granular selection of every service and configuration option.

## Technology Stack
-   **Infrastructure**: Docker & Docker Compose
-   **Setup**: Bash (TUI with `gum`) & PowerShell
-   **Dashboard**: Homepage
-   **Auth**: Authelia + Cloudflare Tunnel
-   **Networking**: Gluetun VPN

## Current Status (11/20/25)
-   [x] Basic Stack (Fixed)
-   [ ] Modular Profiles (In Progress)
-   [ ] Dynamic Dashboard (In Progress)
-   [ ] Interactive "Builder" Script (In Progress)
