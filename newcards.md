# Plan: Dynamic GitHub App Integration & Lifecycle Management

## Overview
Develop a system that allows users to add new applications to the Media Stack by simply providing a GitHub repository link. The system will automatically scrape the repository, generate metadata and documentation modeled after "permanent" apps (e.g., Plex, Sonarr), and provide a one-click removal feature that erases all traces of the added app.

## 1. Core Architecture

### A. Backend: AI-Driven App Scraper & Generator
- **GitHub Link Parsing**: Extract repo details (owner, name) and fetch metadata (description, README, topics, releases).
- **Few-Shot Template Modeling**: Use existing "permanent" app definitions (from `docs-site/src/data/services.ts` and `appData.ts`) as context for an AI prompt.
- **AI Synthesis**: Pass the scraped data to an LLM to generate:
  - **App Metadata**: ID, Name, Category, Lucide Icon, Difficulty, Setup Time.
  - **Documentation Guide**: A full React component (`[AppId]Guide.tsx`) using the `AppGuideLayout` template, populated with setup steps extracted from the README.
  - **Configuration Snippets**: Suggested environment variables or Docker configurations if applicable.

### B. Registry System
- **Apps Registry**: Use `docs-site/src/data/apps-registry.json` as the source of truth for custom apps.
- **File System Automation**:
  - Save the generated `.tsx` guide to `docs-site/src/components/docs/`.
  - Update `docs-site/src/components/docs/index.ts` to export the new guide.
  - Update a dynamic mapping in `docs-site/src/components/docs/appData.ts` to include registry apps.

## 2. User Interface Integration

### A. Add App Flow
- **Submission UI**: A new "Add App" button in the `AppsOverview` section that takes a GitHub URL.
- **Progress Feedback**: Show real-time progress as the AI scrapes and generates the documentation.
- **Success State**: Instant navigation to the newly generated guide.

### B. Managed List & Discovery
- **Hybrid View**: Modify `AppsOverview.tsx` to merge hardcoded apps with registry apps.
- **Visual Distinction**: Custom apps will have a "GitHub" badge.
- **One-Click Deletion**: Each custom app card will feature a "Remove" (trash icon) button.

## 3. "Trace Erase" Deletion System
The system must ensure a clean removal of any app added via this flow:
- **Registry Removal**: Delete the entry from `apps-registry.json`.
- **File Cleanup**: Delete the matching `[AppId]Guide.tsx` file.
- **Source Cleanup**: Revert/Remove the export lines in `docs-site/src/components/docs/index.ts`.
- **Memory Wipe**: Ensure the frontend cache is cleared and the app disappears from the overview.

## 4. Modeling from Permanent Apps
To maintain high quality, the AI generation will strictly follow the structure of:
- **PlexGuide.tsx**: For the layout and section hierarchy.
- **appData.ts**: For categorization and meta-tagging conventions.
- **Lucide Icon Mapping**: Ensure the AI picks icons from the existing import list in the UI for compatibility.

## 5. Security & Validation
- **Path Sanitization**: Ensure app IDs and filenames are sanitized to prevent path traversal.
- **URL Validation**: Verify the GitHub link is reachable and contains valid content before processing.
- **Backup Before Write**: Automatically backup the registry and index files before modification.

---
*Note: This plan has been saved to `newcards.md` as requested. No implementation steps have been taken beyond this planning phase.*
