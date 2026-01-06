# Refactor Wizard UI into Modular Components

Break down the large monolithic SetupWizard.tsx component into smaller, reusable components with clear responsibilities. Implement proper state management boundaries and improve code organization.

## Rationale
Technical debt identified in discovery. Large monolithic components make the codebase harder to maintain and test. Modular architecture enables faster feature development and easier onboarding for contributors.

## User Stories
- As a contributor, I want modular wizard components so that I can add new features without understanding the entire codebase

## Acceptance Criteria
- [ ] SetupWizard.tsx split into logical step components (ServiceSelection, StorageConfig, SecurityConfig, etc.)
- [ ] Each component has clear props interface and single responsibility
- [ ] Shared state managed through Zustand store slices
- [ ] Component structure documented for contributors
- [ ] No regression in existing functionality
