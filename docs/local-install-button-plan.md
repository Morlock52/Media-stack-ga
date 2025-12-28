# Local Install Button Plan

Goal: surface a “Local Install” action only after the user applies the **Local Install** template, and have it trigger the existing local deploy flow (docker-compose.local.yml) from the wizard UI.

## Current state (what we have)

- Templates live in `docs-site/src/data/templates.ts`; the `local-install` template sets `deploymentMode: 'local'` and the service list.
- Template selection is handled in `TemplateSelector` → `SetupWizard.handleTemplateSelect` → `useSetupStore.loadTemplate()`, but the chosen template ID is not persisted anywhere.
- The Review step already renders a `Deploy Locally` button when `config.deploymentMode === 'local'` (`docs-site/src/components/wizard/steps/ReviewGenerateStep.tsx`).
- Control server already exposes `/api/local-deploy`, and the UI client calls it via `controlServer.localDeploy(...)` with a compose file override.

## Plan (code changes)

1) Track which template was applied

- Add `appliedTemplateId: string | null` to `useSetupStore` with persistence.  
- Set it inside `loadTemplate(template.services, template.config)`; default to `null` on reset/import.  
- Ensure `loadTemplate` also sets `deploymentMode` from the template config (fallback to current value).

1) Gate the CTA strictly to the local template

- Derive `const isLocalTemplate = appliedTemplateId === 'local-install'` (and `config.deploymentMode === 'local'`).  
- Update `ReviewGenerateStep` to render the local deploy button only when `isLocalTemplate` is true. If a different template is chosen or the wizard is reset, the button disappears.

1) Wire the button to local install behavior

- Keep using `controlServer.localDeploy` with `composeFile: 'docker-compose.local.yml'` and the selected service profiles; surface its status in the existing modal.  
- Add a lightweight fallback link to download/run `deploy-local.sh` if the control server is unreachable (reuse the existing download helpers).

1) UX copy and docs touch

- Label the CTA “Run Local Install” so it’s distinct from the remote deploy button.  
- In `docs/getting-started/START_HERE.md`, note that picking the **Local Install** template unlocks the in-wizard local installer.

## Acceptance / test notes

- Selecting the **Local Install** template shows the CTA; selecting any other template or hitting Reset hides it.  
- Local deploy uses `docker-compose.local.yml` and the current profiles; errors surface in the modal.  
- If the control server is offline, users can still download `.env` + `deploy-local.sh` from the same panel.
