# Replan and Architecture Strategy

## Objective
Enable a "Newbie-Proof" Agentic System for managing Apps, Tiles, and Documentation.
- **Easy Addition**: Simple UI/Voice flow to add new items.
- **Easy Modification/Deletion**: Full CRUD capabilities via AI.
- **Agentic**: AI-assisted management (Voice/Chat) is the primary interface for complex tasks.
- **Robustness**: Error handling, logging, testing.

## Implementation Status: ✅ COMPLETE

### Backend Services Created

1. **`registryService.ts`** - Centralized app registry management
   - `loadRegistry()`, `saveRegistry()`, `backup()`
   - `addApp()`, `removeApp()`, `updateApp()`

2. **`docService.ts`** - Documentation file management
   - `createDoc()`, `updateDoc()`, `readDoc()`, `listDocs()`

3. **`appGeneratorService.ts`** - AI-powered app generation
   - `generateAppFromGitHub()` - Uses OpenAI to create app metadata and React documentation
   - `registerAndExportApp()` - Saves guide and updates exports

4. **`github.ts`** - GitHub repository scraping
   - `scrapeGitHubRepo()` - Fetches repo metadata and README

### AI Tools Added to `/api/agent/chat`

| Tool | Description |
|------|-------------|
| `manage_app` | List, add, remove, update apps in registry |
| `manage_doc` | List, read, create, update documentation components |

### API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/registry/apps` | GET | List all custom apps |
| `/api/registry/apps` | POST | Add an app manually |
| `/api/registry/apps/:id` | PUT | Update an app |
| `/api/registry/apps/:id` | DELETE | Remove an app and its guide |
| `/api/registry/scrape` | POST | Scrape GitHub repo, generate docs, register app |

### Frontend Updates

1. **`AppsOverview.tsx`** - Enhanced with:
   - "Add Custom App" button with GitHub URL input
   - AI-powered scraping and documentation generation
   - Custom apps displayed with "Custom" badge
   - One-click removal with confirmation

2. **`appData.ts`** - Added `ICON_MAP` for dynamic icon resolution

3. **`controlServer.ts`** - Added registry API client methods:
   - `getRegistry()`, `scrapeRepo()`, `removeRegistryApp()`

### Tests

- `control-server/test/agent-tools.test.ts` - Unit tests for registry and doc services (5 passing tests)

### Documentation

- Updated `README.md` with new "Agentic System" section explaining AI-powered app management

## How It Works

1. **Via AI Chat**: "Add Paperless-ngx from GitHub" → AI calls `manage_app` tool → generates docs → registers app
2. **Via UI**: Click "Add Custom App" → Enter GitHub URL → AI generates guide → App appears in grid
3. **Via Voice**: "Create a guide for Uptime Kuma" → Voice agent processes → AI tool executes

## Files Modified/Created

```
control-server/src/
├── services/
│   ├── registryService.ts   ✨ NEW
│   ├── docService.ts        ✨ NEW
│   └── appGeneratorService.ts ✨ NEW
├── utils/
│   └── github.ts            ✨ NEW
├── routes/
│   ├── ai.ts                📝 MODIFIED (added manage_app, manage_doc tools)
│   └── registry.ts          📝 MODIFIED (refactored + added scrape endpoint)
└── test/
    └── agent-tools.test.ts  ✨ NEW

docs-site/src/
├── components/docs/
│   ├── AppsOverview.tsx     📝 MODIFIED (full CRUD UI)
│   └── appData.ts           📝 MODIFIED (ICON_MAP export)
└── utils/
    └── controlServer.ts     📝 MODIFIED (registry API methods)

README.md                    📝 MODIFIED (Agentic System section)
```
