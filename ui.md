# UI Review + 20 State-of-the-Art GUI Imports (12/13/25)

## Current UI (docs-site) — quick review

### Framework & tooling

- **Framework**: React 18
- **Build**: Vite 5
- **Routing**: `react-router-dom` (currently 2 routes: `/` and `/docs`)
- **Styling**: TailwindCSS (custom design tokens via CSS variables) + custom utility classes (glassmorphism, animated gradients, etc.)
- **State**: Zustand (`persist` to localStorage) for the wizard’s “single source of truth” config
- **Forms & validation**: React Hook Form + Zod (`@hookform/resolvers/zod`)
- **Animation**: Framer Motion
- **Icons**: lucide-react
- **Docs rendering**: `react-markdown` + syntax highlighting
- **Deployment**: Vite build served via Nginx in Docker; Netlify for docs hosting/functions
- **Theme**: Matrix HUD (emerald/cyan neon on deep black)

### Key UX surfaces

- **SetupWizard**: multi-step workflow, heavy forms, progressive disclosure, profiles/templates, export/import, “share link”
- **AIAssistant**: floating chat UI, agent selection, suggestions, “toolUsed” display
- **RemoteDeployModal**: modal workflow with step list + progress states

### What’s already good

- The stack is modern and “2025-ready”: Vite + Tailwind + Zustand + RHF/Zod is a strong baseline.
- You have a consistent design language (glass, gradients, micro-interactions) and chunking in Vite config for performance.

### Gaps/opportunities

- **Accessibility primitives** are mostly hand-rolled (modals, combobox, focus management). A11y can be upgraded.
- **Data fetching + caching** is currently ad-hoc (plain `fetch`). A server-state library would improve resilience.
- **Reusable UI primitives** are scattered; a consistent component system would improve velocity.
- **Observability** (frontend error reporting, performance tracking) is not formalized.

---

## 20 GUI imports to modernize the UI (with step-by-step plan)

Each item below is written to fit your current stack (React + Vite + Tailwind). When I say “framework”, I mean the ecosystem the library is designed for.

## 1) shadcn/ui (component copy-in system)

- **Framework**: React + Tailwind (Radix-based components, copied into your repo)
- **Why**: “Copy-paste architecture” gives you full control and avoids heavy dependency lock-in; matches your Tailwind approach.
- **Plan**:

  1. Add shadcn CLI and initialize in `docs-site`.
  2. Configure Tailwind + CSS variables to match your existing tokens.
  3. Import a small starter set: `Button`, `Dialog`, `Tabs`, `Toast`.
  4. Replace one existing modal (RemoteDeployModal) with `Dialog` as a pilot.
  5. Gradually migrate other custom primitives.

## 2) Radix UI Primitives (headless accessibility)

- **Framework**: React
- **Why**: battle-tested keyboard interactions and ARIA semantics without forcing a design system.
- **Plan**:

  1. Add `@radix-ui/react-dialog`, `@radix-ui/react-dropdown-menu`, `@radix-ui/react-tooltip`.
  2. Wrap each primitive with your Tailwind styling.
  3. Standardize focus rings + escape-to-close across the app.
  4. Use Radix as the base if you don’t adopt shadcn.

## 3) React Aria Components (enterprise-grade a11y)

- **Framework**: React
- **Why**: “Accessibility that’s truly first-class” and touch/keyboard parity.
- **Plan**:

  1. Add `react-aria-components` (or React Aria hooks where needed).
  2. Adopt for complex controls: combobox, date pickers, listbox.
  3. Replace your custom combobox input with a React Aria-backed combobox.
  4. Add basic accessibility tests (axe) to CI.

## 4) TanStack Query (server state)

- **Framework**: React
- **Why**: standard 2025 approach to caching/deduping/refetching and “server state” correctness.
- **Plan**:

  1. Add `@tanstack/react-query`.
  2. Add a `QueryClientProvider` at app root.
  3. Wrap existing `fetch` calls (AI, remote deploy, containers endpoints) into query/mutation hooks.
  4. Add retry/backoff + offline-friendly behavior.
  5. Use devtools in development for debugging.

## 5) TanStack Router (optional routing upgrade)

- **Framework**: React
- **Why**: type-safe routing, data-loading patterns, and strong integration with TanStack Query.
- **Plan**:

  1. Evaluate if the app is growing beyond 2 routes.
  2. If yes: migrate `/` and `/docs` to TanStack Router.
  3. Co-locate loaders + route-level error boundaries.
  4. Add route prefetching for faster navigation.

## 6) TanStack Table (datagrid)

- **Framework**: React
- **Why**: headless, powerful, and customizable; pairs well with Tailwind.
- **Plan**:

  1. Add `@tanstack/react-table`.
  2. Build a “Containers table” view (name/status/ports) as first usage.
  3. Add sorting/filtering/search.
  4. Combine with virtualization (below) for scale.

## 7) TanStack Virtual or React Virtuoso (virtualization)

- **Framework**: React
- **Why**: 60fps rendering for large lists (logs, registries, docs search results).
- **Plan**:

  1. Choose one: `@tanstack/react-virtual` (headless) or `react-virtuoso` (batteries included).
  2. Apply to any list that can exceed ~200 rows.
  3. Virtualize logs view (if/when you add one) and/or docs search results.

## 8) Sonner (modern toasts)

- **Framework**: React
- **Why**: clean toast UX; commonly paired with shadcn.
- **Plan**:

  1. Add `sonner`.
  2. Add a single global `<Toaster />`.
  3. Replace `alert()` usage (wizard import failures, share link copy) with toasts.

## 9) Floating UI (tooltips/popovers positioning)

- **Framework**: React
- **Why**: robust positioning engine; fixes edge cases with popovers and tooltips.
- **Plan**:

  1. Add `@floating-ui/react`.
  2. Wrap tooltip/popover components.
  3. Apply to icon-only buttons (help tooltips, deploy status chips).

## 10) cmdk (command palette)

- **Framework**: React
- **Why**: modern UX for power users: “Search actions, jump to step, open docs, run deploy”.
- **Plan**:

  1. Add `cmdk`.
  2. Create “CommandPalette” component.
  3. Add actions: jump wizard step, open remote deploy, open docs page, copy generated config.
  4. Bind `⌘K`.

## 11) dnd-kit (drag & drop)

- **Framework**: React
- **Why**: modern drag-and-drop without HTML5 DnD pain.
- **Plan**:

  1. Add `@dnd-kit/core` + sortable.
  2. Use for reordering selected services in the wizard.
  3. Save ordering in Zustand.

## 12) React Hook Form DevTools (DX)

- **Framework**: React
- **Why**: speeds up debugging complex multi-step forms.
- **Plan**:

  1. Add `@hookform/devtools`.
  2. Enable only in dev builds.
  3. Use on wizard forms to diagnose validation and default values.

## 13) zod-i18n (localized validation errors)

- **Framework**: JS/TS
- **Why**: if you internationalize, your validation messages must follow.
- **Plan**:

  1. Add `zod-i18n-map`.
  2. Plug into your Zod schema error map.
  3. Swap hardcoded English errors to localized messages.

## 14) react-i18next (i18n)

- **Framework**: React
- **Why**: if you want “newbie-proof” global adoption, localization is the multiplier.
- **Plan**:

  1. Add `i18next` + `react-i18next`.
  2. Wrap app in `I18nextProvider`.
  3. Move static strings (wizard steps, feature text) into translation JSON.

## 15) Sentry (frontend error reporting)

- **Framework**: React
- **Why**: production-grade error capture + traces; complements your ErrorBoundary.
- **Plan**:

  1. Add `@sentry/react`.
  2. Initialize in `main.tsx` using env-based DSN.
  3. Capture errors from wizard, assistant, deploy modal.
  4. Add release tagging in CI.

## 16) PostHog (product analytics + feature flags)

- **Framework**: JS/React
- **Why**: understand drop-offs in wizard steps; ship feature flags safely.
- **Plan**:

  1. Add `posthog-js`.
  2. Track wizard step transitions and export/import usage.
  3. Use feature flags for experimental UI components.

## 17) Recharts or Visx (charts)

- **Framework**: React
- **Why**: for “stack health”, storage usage, service counts, progress stats.
- **Plan**:

  1. Pick one: `recharts` (easy) or `@visx/*` (more control).
  2. Add a “Health Overview” panel (containers healthy/unhealthy, count).
  3. Add sparkline-style indicators.

## 18) Monaco Editor or CodeMirror (config editor)

- **Framework**: React
- **Why**: in Review step, users will want to edit `.env`, compose, YAML with syntax highlighting.
- **Plan**:

  1. Choose `@monaco-editor/react` (full IDE feel) or CodeMirror (lighter).
  2. Add a read-only viewer first.
  3. Then add an “Edit mode” with validation + copy/download.

## 19) react-dropzone (file import UX)

- **Framework**: React
- **Why**: improve import flow (drag JSON config in).
- **Plan**:

  1. Add `react-dropzone`.
  2. Replace the hidden `<input type=file>` flow.
  3. Add validation + toast feedback.

## 20) Playwright Component/Visual testing (UI stability)

- **Framework**: Playwright (already present in deps)
- **Why**: “state-of-the-art” UI teams ship with visual regression and flow tests.
- **Plan**:

  1. Add Playwright tests for: wizard happy-path, import/export, remote deploy modal open/close.
  2. Add screenshot assertions for critical pages.
  3. Run in CI on PRs.

---

## Recommended adoption order (lowest risk → highest impact)

1. **Sonner** (toasts)
2. **Floating UI** (positioning)
3. **React Aria / Radix** (accessibility primitives)
4. **TanStack Query** (server state)
5. **Command palette (cmdk)**
6. **Table + virtualization**
7. **Charts**
8. **Editor**
9. **Analytics + Sentry**

---

## Deploying UI updates

This repo has two common ways you’ll run/deploy the UI:

- **Vite dev server** (fast local development)
- **Static build served by Nginx** (Docker/Wizard deploy) or **Netlify** (hosted docs + functions)

### A) Local development (fastest feedback)

1. Start the docs-site UI:

   - `npm run dev -w docs-site -- --host 127.0.0.1 --port 5173`

2. Open:

   - `http://127.0.0.1:5173`

3. Ensure the Control Server API is running separately (default `http://localhost:3001`) so UI features like Remote Deploy + AI Assistant work.

### B) Production build (what Netlify/Docker will run)

1. Build:

   - `npm run build -w docs-site`

2. Verify:

   - `npm run preview -w docs-site` (then open the printed URL)

### C) Deploy docs-site to Netlify (recommended for the hosted docs UI)

Netlify is configured via the repo-root `netlify.toml`:

- `base = "docs-site"`
- `publish = "dist"`
- `functions = "netlify/functions"`

Step-by-step:

1. Commit your UI changes.

2. Push to the branch connected to Netlify.

3. In Netlify project settings, set required environment variables for Functions:

   - `OPENAI_API_KEY` (required for the assistant function)
   - `OPENAI_MODEL` (optional; defaults in code)

4. Confirm deploy output:

   - Build command: `npm run build`
   - Publish directory: `docs-site/dist` (via `base` + `publish`)

### D) Deploy the Wizard UI via Docker (self-hostable)

This uses `docker-compose.wizard.yml`:

- `wizard-web` builds `docs-site/Dockerfile` and serves static assets via Nginx
- `wizard-api` builds `control-server/Dockerfile` and exposes API on `3001`

Step-by-step:

1. Build and start:

   - `docker compose -f docker-compose.wizard.yml up --build -d`

2. Open:

   - UI: `http://localhost:3002`
   - API: `http://localhost:3001`

3. Update/redeploy after changes:

   - `docker compose -f docker-compose.wizard.yml up --build -d`

## Notes

- This document is intentionally written to match your existing stack (React + Vite + Tailwind). If you later move to Next.js/Remix, the recommended libraries still mostly apply.
