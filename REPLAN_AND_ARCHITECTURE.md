# Replan and Architecture Strategy

## Objective
Enable a "Newbie-Proof" Agentic System for managing Apps, Tiles, and Documentation.
- **Easy Addition**: Simple UI/Voice flow to add new items.
- **Easy Modification/Deletion**: Full CRUD capabilities via AI.
- **Agentic**: AI-assisted management (Voice/Chat) is the primary interface for complex tasks.
- **Robustness**: Error handling, logging, testing.

## Current State Analysis
- **Backend**: 
  - `registry.ts` supports CRUD for custom apps (`custom-apps.json`).
  - `ai.ts` supports `run_command`, `analyze_logs`, `validate_config`.
  - **Gap**: AI cannot currently "Add App" or "Delete App" directly via tool calls. It has to suggest commands or be manually guided.
- **Frontend**:
  - `DashboardBentoGrid` displays *running containers* via `docker ps` (implied).
  - No explicit "App Store" or "Registry Manager" UI found for adding custom apps easily.
  - `AIAssistant` is available but limited by backend tools.

## Architecture Plan

### 1. Enhanced AI capabilities (Backend)
We will add new tools to the AI Agent in `control-server/src/routes/ai.ts`:
- `manage_app`:
  - Actions: `list`, `add`, `remove`, `update`.
  - Arguments: `appName`, `repoUrl`, `description`, etc.
  - Implementation: reuse logic from `registry.ts`.
- `manage_doc`:
  - Actions: `create`, `update`, `read`.
  - Arguments: `path`, `content`.

### 2. Frontend Integration
- The Dashboard tracks *running containers*. To "Add a Tile", the user effectively needs to "Add an App and Start it".
- The AI Agent will be the primary interface for this. "Add Paperless-ngx" -> AI adds to registry -> AI generates config -> AI starts container.

### 3. Documentation & Testing
- We will document this "Agentic Workflow" in `README.md`.
- We will add a test script `scripts/test-agent-tools.ts` to verify the new AI tools.

## Implementation Steps
1.  **Refactor Registry**: Ensure `registry.ts` logic is reusable (extract to `services/registryService.ts` or similar if needed, or just import).
2.  **Update AI Routes**: Add `manage_app` and `manage_doc` tools definition and implementation in `ai.ts`.
3.  **Test**: Write a script to verify the AI can add a dummy app and create a doc.
4.  **Docs**: Update `README.md` with instructions on how to use the new features.
