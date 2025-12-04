# ESLint Remediation Plan

Track each issue from the latest lint run. Check items off as fixes land.

- [x] `src/components/AIAssistant.tsx`: remove unused `error` parameter (line 143)
- [x] `src/components/AIGuide.tsx`: remove unused `error` parameter (line 165)
- [x] `src/components/DocsViewer.tsx`: rename/ remove unused `node` parameter in `renderers` (line 9)
- [x] `src/components/RemoteDeployModal.tsx`: remove unused `e` in handlers (lines 64, 95)
- [x] `src/components/ServiceConfigStep.tsx`: remove unused `error` (line 140)
- [x] `src/components/SetupWizard.tsx`: remove unused `error` (line 344)
- [x] `src/components/SetupWizard.tsx`: delete unused eslint-disable directives (lines 441, 489)
- [x] `src/hooks/useSystemStatus.ts`: remove unused `e` catch parameter (line 29)

## Observations (2025-11-27)

- [x] Add logging for AI assistant fetch failures (`src/components/AIAssistant.tsx`).
- [x] Add logging for AI guide assistant fetch failures (`src/components/AIGuide.tsx`).
- [x] Add logging for remote deploy modal test/deploy failures (`src/components/RemoteDeployModal.tsx`).
- [x] Log AI suggestion errors in service config step (`src/components/ServiceConfigStep.tsx`).
- [x] Log import failures in setup wizard (`src/components/SetupWizard.tsx`).
- [x] Log polling failures in `useSystemStatus` hook.
- [ ] Improve OpenAI error logging in control server `/api/agent/chat` and `/api/voice-agent` endpoints.
- [ ] Improve `/api/health-snapshot` error handling/logging to surface failures.
