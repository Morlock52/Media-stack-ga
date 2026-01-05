# Gotchas & Pitfalls

Things to watch out for in this codebase.

## [2026-01-05 17:27]
npm and node commands are blocked in this review environment - cannot run actual builds or tests

_Context: Attempting to run 'npm run build' for subtask-1-1 resulted in command block. Static analysis of TypeScript configs is the alternative._

## [2026-01-05 17:30]
npm and node commands are blocked in this review environment. All Phase 1 tasks (build, lint, test) can only be analyzed statically, not executed.

_Context: Environment restrictions prevent running npm run lint, npm run build, npm test commands_

## [2026-01-05 17:33]
smoke.spec.ts 'homepage loads and displays hero section' test populates consoleErrors array but NEVER asserts on it - errors are silently ignored

_Context: Lines 23-29 set up error collection, but there's no expect(consoleErrors).toHaveLength(0) at the end of the test_

## [2026-01-05 17:33]
smoke.spec.ts uses waitForTimeout() anti-pattern (lines 57, 100) which can cause flaky tests - should use waitFor with specific conditions instead

_Context: Playwright docs recommend avoiding waitForTimeout in favor of explicit wait conditions_

## [2026-01-05 17:33]
smoke.spec.ts uses 'any' type for download handler (line 162) and non-null assertions without guards (lines 181, 186)

_Context: Type safety issues that could hide runtime errors - dl parameter should be typed as Download from @playwright/test_
