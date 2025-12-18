# Media-stack-anti Agent Notes

## Repo structure

- `docs-site/`: Vite + React docs / UI
- `control-server/`: Fastify API server used by parts of the UI (agents, settings, voice agent)
- Root `package.json` uses npm workspaces.

## Common commands (run from repo root)

- `npm run dev`
  - Runs both `control-server` and `docs-site` concurrently.
- `npm run preview`
  - Runs `vite preview` for `docs-site` (serves the built `docs-site/dist`).

## Workspace commands

- Docs site
  - `npm run dev -w docs-site`
  - `npm run build -w docs-site`
  - `npm run preview -w docs-site`
- Control server
  - `npm run dev -w control-server`
  - `npm run build -w control-server`
  - `npm run start -w control-server`

## Ports / URLs

- Control server default: `http://localhost:3001`
- Docs site:
  - `vite dev` defaults to `http://localhost:5173` (unless occupied)
  - `vite preview` prints the actual port on start (often `http://localhost:4173`+)

## Control server URL selection (docs-site)

The frontend builds control-server URLs using:

- `VITE_CONTROL_SERVER_URL` (if set)
- else (when running on localhost) defaults to `http://localhost:3001`

### AI & Automation Tools
- `bootstrap_arr`: Automatically extract API keys from running containers via `docker exec`.
- `manage_app`: Add/remove apps from the registry.
- `analyze_logs`: Real-time log analysis.

## UI Features
- **Premium UI**: Glassmorphism and intelligent animations (respects reduced motion).
- **SVG Export**: Each configuration row can be exported as an SVG visual asset.

## Security

- Never commit API keys.
- If a key is exposed in chat/logs/history, revoke/rotate it immediately.
