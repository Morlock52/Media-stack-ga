# Project Review and Issue Discovery

## Overview
Help me review the project and find issues of the app that us not working as designed or discribed


## Workflow Type

**Type**: investigation

**Rationale**: This is not a feature implementation but rather an investigation task to discover issues and bugs. The goal is to systematically analyze the codebase, run tests, and identify discrepancies between expected and actual behavior.

## Task Scope

### Services Involved
- **docs-site** (primary) - React frontend wizard UI that must be verified for functionality
- **control-server** (primary) - Fastify backend API that handles Docker, AI, and remote deployment
- **shared** (reference) - Shared library used by both services

### This Task Will:
- [ ] Run existing test suites to identify failing tests
- [ ] Verify all documented features work as described in CLAUDE.md
- [ ] Check for console errors and JavaScript exceptions
- [ ] Validate API endpoints are responsive and return expected data
- [ ] Verify wizard flow completes successfully end-to-end
- [ ] Check for TypeScript compilation errors
- [ ] Validate linting passes without critical errors
- [ ] Document all discovered issues with reproduction steps

### Out of Scope:
- Implementing fixes for discovered issues (separate tasks)
- Adding new features
- Performance optimization (unless severe issues found)
- Security audit (unless obvious vulnerabilities found)

## Service Context

### docs-site

**Tech Stack:**
- Language: TypeScript
- Framework: React with Vite
- Key directories: `src/`, `tests/`
- State Management: Zustand
- UI: Tailwind CSS, Radix UI, Framer Motion

**Entry Point:** `src/App.tsx`

**How to Run:**
```bash
npm run dev -w docs-site         # Start on port 5173
```

**Port:** 5173 (dev), 3000 (production)

**Key Components to Verify:**
| Component | Purpose | Verification |
|-----------|---------|--------------|
| `SetupWizard.tsx` | Multi-step configuration flow | Wizard completes end-to-end |
| `AIAssistant.tsx` | Voice-enabled config helper | Chat works with control-server |
| `RemoteDeployModal.tsx` | SSH deployment UI | Connection and deployment work |
| `StoragePlanner.tsx` | Bitrate/capacity calculator | Calculations are accurate |
| `HealthDashboard.tsx` | Container status monitoring | Displays Docker container info |
| `VoiceCompanion.tsx` | Voice input/output | Audio works (if API keys present) |

### control-server

**Tech Stack:**
- Language: TypeScript
- Framework: Fastify
- Key directories: `src/`, `test/`
- Logging: Pino

**Entry Point:** `src/index.ts`

**How to Run:**
```bash
npm run dev -w control-server    # Start on port 3001
```

**Port:** 3001

**API Routes to Verify:**
| Route | Purpose | Method |
|-------|---------|--------|
| `/api/health` | Health check | GET |
| `/api/containers` | Container management | GET/POST |
| `/api/logs` | Container logs | GET |
| `/api/agents/*` | AI assistant endpoints | POST |
| `/api/remote-deploy/*` | SSH-based deployment | POST |
| `/api/arr/*` | *Arr stack API key extraction | GET |
| `/api/tts` | Text-to-speech | POST |
| `/api/settings/*` | Settings management | GET/POST |

## Files to Modify

| File | Service | What to Change |
|------|---------|---------------|
| N/A - Investigation only | - | No modifications planned |

## Files to Reference

These files define expected behavior:

| File | Pattern to Copy |
|------|----------------|
| `CLAUDE.md` | Project documentation and expected behavior |
| `docs-site/tests/smoke.spec.ts` | Expected wizard behavior and UI flows |
| `docs-site/tests/settings.cockpit.spec.ts` | Settings page expected behavior |
| `docs-site/tests/arr-stack.spec.ts` | *Arr stack integration expectations |
| `control-server/test/remote.test.ts` | Remote deployment expectations |
| `control-server/test/agent-tools.test.ts` | AI agent tool expectations |

## Patterns to Follow

### Test Execution Pattern

From `CLAUDE.md`:

```bash
npm run check            # Quick lint + control-server tests + docs-site smoke
npm test                 # Run all workspace tests
npm test -w control-server       # Run control-server vitest tests
npm test -w docs-site            # Run docs-site Playwright tests
```

**Key Points:**
- Run `npm run check` first for quick validation
- Use Playwright for E2E tests in docs-site
- Use Vitest for unit tests in control-server

### Expected Wizard Flow

From `docs-site/tests/smoke.spec.ts`:

```typescript
// Step 1: Start wizard (button text: "Let's Go!" or "Start Setup")
await page.getByRole('button', { name: /let'?s go|start setup/i }).first().click()

// Step 2: Basic config (domain + password required)
await expect(page.getByRole('heading', { name: /basic configuration/i })).toBeVisible()

// Step 3: Stack selection -> Expert Mode
await expect(page.getByRole('heading', { name: /choose your stack/i })).toBeVisible()

// Step 4-5: Service config and Advanced (optional fields)
// Step 6: Review & Generate with download all files button
```

**Key Points:**
- Wizard has 6 steps
- Domain and password are required in step 2
- Downloads should produce 4 files: .env, cloudflare config, docker-compose, authelia config

## Requirements

### Functional Requirements

1. **Build and Lint Pass**
   - Description: Project must build without errors and pass linting
   - Acceptance: `npm run build` and `npm run lint` complete successfully

2. **Test Suite Passes**
   - Description: All existing tests must pass
   - Acceptance: `npm run check` and `npm test` complete with 0 failures

3. **Wizard Completes End-to-End**
   - Description: Setup wizard generates all configuration files
   - Acceptance: Downloads 4 files with correct content (see smoke.spec.ts)

4. **AI Assistant Responds**
   - Description: AI chat works with control-server
   - Acceptance: Sending "hello" produces assistant response

5. **API Endpoints Responsive**
   - Description: All documented API routes return valid responses
   - Acceptance: `/api/health` returns 200, other routes don't 500

### Edge Cases

1. **Missing API Keys** - AI/TTS features should gracefully degrade
2. **Docker Not Running** - Container endpoints should error gracefully
3. **Empty Form Fields** - Validation should prevent proceeding
4. **Network Timeouts** - Frontend should show appropriate errors

## Implementation Notes

### DO
- Run tests first to identify known failures
- Check browser console for JavaScript errors
- Verify API responses match documentation
- Document issues with reproduction steps
- Check TypeScript compilation errors

### DON'T
- Attempt to fix issues during investigation (document only)
- Skip test execution
- Ignore console warnings that might indicate issues
- Make assumptions about intended behavior without documentation

## Development Environment

### Start Services

```bash
npm run dev              # Start both services concurrently
# OR separately:
npm run dev -w control-server    # Port 3001
npm run dev -w docs-site         # Port 5173
```

### Service URLs
- Frontend: http://localhost:5173
- Backend API: http://localhost:3001
- API Proxy (dev): http://localhost:5173/api -> http://localhost:3001

### Required Environment Variables
- `OPENAI_API_KEY`: Required for AI assistant (optional for basic testing)
- `ELEVENLABS_API_KEY`: Required for TTS (optional)
- `ANTHROPIC_API_KEY`: Required for AI features (optional)

## Success Criteria

The task is complete when:

1. [ ] `npm run build` completes without errors
2. [ ] `npm run lint` passes (or issues documented)
3. [ ] `npm run check` passes (or failures documented)
4. [ ] All Playwright tests pass (or failures documented)
5. [ ] All Vitest tests pass (or failures documented)
6. [ ] Wizard flow verified manually in browser
7. [ ] AI Assistant verified (if API keys available)
8. [ ] All issues documented with reproduction steps
9. [ ] No critical console errors on page load

## QA Acceptance Criteria

**CRITICAL**: These criteria must be verified by the QA Agent before sign-off.

### Unit Tests
| Test | File | What to Verify |
|------|------|----------------|
| Agent Tools | `control-server/test/agent-tools.test.ts` | AI tool functions work correctly |
| Remote Deploy | `control-server/test/remote.test.ts` | SSH deployment logic works |

### Integration Tests
| Test | Services | What to Verify |
|------|----------|----------------|
| AI Chat | docs-site ↔ control-server | Frontend sends message, backend responds |
| Settings API | docs-site ↔ control-server | Settings can be saved and retrieved |

### End-to-End Tests
| Flow | Steps | Expected Outcome |
|------|-------|------------------|
| Wizard Complete | 1. Start wizard 2. Fill required fields 3. Select services 4. Generate configs | 4 config files downloaded |
| Deep Link Routes | 1. Navigate to /docs 2. Navigate to /settings | Pages render without blank screen |
| No JS Errors | 1. Load homepage 2. Check console | Zero critical JavaScript errors |

### Browser Verification (if frontend)
| Page/Component | URL | Checks |
|----------------|-----|--------|
| Homepage | `http://localhost:5173/` | Hero section visible, nav present |
| Settings | `http://localhost:5173/settings` | Page loads without errors |
| Docs | `http://localhost:5173/docs` | Content renders correctly |

### API Verification
| Endpoint | Method | Expected Response |
|----------|--------|-------------------|
| `/api/health` | GET | 200 OK with health status |
| `/` | GET | 200 OK root response |

### QA Sign-off Requirements
- [ ] All unit tests pass
- [ ] All integration tests pass
- [ ] All E2E tests pass
- [ ] Browser verification complete
- [ ] API endpoints verified
- [ ] No regressions in existing functionality
- [ ] All discovered issues documented with:
  - Clear description
  - Reproduction steps
  - Expected vs actual behavior
  - Severity classification (critical/major/minor)

## Issue Documentation Template

For each discovered issue, document:

```markdown
### Issue: [Brief Title]

**Severity**: Critical / Major / Minor

**Description**: [What is wrong]

**Expected Behavior**: [What should happen]

**Actual Behavior**: [What actually happens]

**Reproduction Steps**:
1. [Step 1]
2. [Step 2]
3. [Step 3]

**Location**: [File path or URL]

**Evidence**: [Console output, screenshot reference, test failure]
```
