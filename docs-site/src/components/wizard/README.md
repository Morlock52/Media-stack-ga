# Wizard Component Architecture

This directory contains the modular wizard components that power the Media Stack setup experience. The architecture has been refactored from a monolithic ~1000-line component into smaller, focused, reusable components with clear responsibilities.

## Table of Contents

- [Overview](#overview)
- [Component Hierarchy](#component-hierarchy)
- [Shell Components](#shell-components)
- [Step Components](#step-components)
- [Modal Components](#modal-components)
- [Review Sub-Components](#review-sub-components)
- [State Management](#state-management)
- [Custom Hooks](#custom-hooks)
- [Extension Guide](#extension-guide)

---

## Overview

The wizard architecture follows these principles:

1. **Single Responsibility**: Each component has one clear purpose
2. **State from Store**: Components read from Zustand store via selectors, not props
3. **Composability**: Components are composed together in `SetupWizard.tsx`
4. **Accessibility**: Proper ARIA attributes and keyboard navigation
5. **Animations**: Framer Motion with reduced motion support

### Architecture Pattern

```
SetupWizard.tsx (Main Orchestrator)
├── WizardHeader (Title, actions)
├── WizardProgressBar (Step counter, progress)
├── WizardStepIndicator (Horizontal step dots)
├── <Current Step Component>
│   ├── QuickStartStep
│   ├── WelcomeStep (from ../WelcomeStep.tsx)
│   ├── BasicConfigurationStep
│   ├── StackSelectionStep
│   ├── ServiceConfigStep (from ../ServiceConfigStep.tsx)
│   ├── AdvancedSettingsStep
│   └── ReviewGenerateStep
│       └── Review Sub-Components
├── WizardNavigation (Back/Next buttons)
├── Modal Components (Conditional)
│   ├── DraftRecoveryModal
│   ├── ProfilesPanel
│   ├── ToolsDialog
│   └── VoiceCompanionTrigger
└── VoiceCompanion (Lazy loaded)
```

---

## Component Hierarchy

### Barrel Export (`index.ts`)

All wizard components are exported from a single barrel file for clean imports:

```typescript
import {
  WizardHeader,
  WizardProgressBar,
  QuickStartStep,
  DraftRecoveryModal
} from '@/components/wizard'
```

Components are organized into three groups:
- **Shell Components**: Layout and navigation
- **Modal Components**: Dialogs and panels
- **Step Components**: Individual wizard steps

---

## Shell Components

These components provide the wizard's structure and navigation.

### `WizardHeader.tsx`

**Purpose**: Displays the wizard title, badge, and action buttons.

**Props**:
```typescript
interface WizardHeaderProps {
  onResetClick: () => void
  showResetConfirm: boolean
  onProfilesClick: () => void
  onToolsClick: () => void
}
```

**Features**:
- Animated title with gradient text
- "Interactive Setup Wizard" badge with sparkles icon
- Three action buttons: Reset (destructive), Profiles, Tools
- Reduced motion support for animations
- Reset confirmation state managed by parent

**Usage**:
```tsx
<WizardHeader
  onResetClick={handleReset}
  showResetConfirm={showResetConfirm}
  onProfilesClick={() => setShowProfiles(true)}
  onToolsClick={() => setToolsOpen(true)}
/>
```

---

### `WizardProgressBar.tsx`

**Purpose**: Shows current step progress with percentage and step counter.

**Props**:
```typescript
interface WizardProgressBarProps {
  steps: Array<{ title: string }>
}
```

**State**: Reads `currentStep` from store via selector.

**Features**:
- Animated progress bar fill
- "Step X of Y - N% Complete" text
- Smooth transitions with reduced motion support
- Calculates percentage based on steps array length

**Usage**:
```tsx
<WizardProgressBar steps={steps} />
```

---

### `WizardStepIndicator.tsx`

**Purpose**: Horizontal step indicator with clickable completed steps.

**Props**:
```typescript
interface WizardStepIndicatorProps {
  steps: Array<{ title: string; icon: LucideIcon }>
}
```

**State**: Reads `currentStep` from store and calls `setCurrentStep` for navigation.

**Features**:
- Step icons from Lucide React
- Green checkmarks for completed steps
- Pulse animation on current step
- Animated connection lines between steps
- Click completed steps to navigate back
- Proper accessibility with `role`, `aria-label`, `aria-current`

**Usage**:
```tsx
<WizardStepIndicator steps={steps} />
```

---

### `WizardNavigation.tsx`

**Purpose**: Sticky bottom navigation bar with Back/Next buttons.

**Props**:
```typescript
interface WizardNavigationProps {
  onNext: () => void
  onPrev: () => void
  onReset: () => void
}
```

**State**: Reads `currentStep` from store to determine button rendering.

**Features**:
- Back button (hidden on first step)
- Next button (shows "Start Over" on final step)
- Glass effect background with `glass-ultra` class
- Button lift animation on hover
- Handles wizard completion flow

**Usage**:
```tsx
<WizardNavigation
  onNext={handleNextStep}
  onPrev={prevStep}
  onReset={resetWizard}
/>
```

---

## Step Components

Individual wizard steps that manage their own form state and validation.

### `QuickStartStep.tsx`

**Purpose**: Simplified 2-step onboarding for beginners.

**State**: Uses store directly via `useSetupStore()` hook.

**Features**:
- Password input with validation (8+ characters)
- Three preset options: Just Streaming, Media Manager, Full Stack
- Auto-applies defaults (timezone, local mode, defaults)
- Skips directly to Review step (step 5)
- Back button returns to Welcome step

**Pattern**: Self-contained with internal state for password and preset selection.

---

### `BasicConfigurationStep.tsx`

**Purpose**: Core configuration fields (domain, timezone, password, etc.).

**State**: Uses store directly for config and selectedServices.

**Features**:
- React Hook Form with Zod validation
- Conditional fields based on deployment mode
- Service-specific fields (Plex claim, VPN config)
- Auto-detects timezone
- Field shake animation on validation errors (managed by parent)

**Validation**: Handled by `useWizardValidation` hook in parent component.

---

### `StackSelectionStep.tsx`

**Purpose**: Service selection with deployment mode toggle.

**State**: Uses store directly for `mode`, `selectedServices`, `setMode`, `toggleService`.

**Features**:
- Local vs Cloud deployment mode toggle
- Service cards from `data/services.ts`
- Dependency handling (e.g., VPN requires torrent client)
- Service card animations with Framer Motion

**Pattern**: Reads services data from external file, state from store.

---

### `AdvancedSettingsStep.tsx`

**Purpose**: Optional advanced configuration for power users.

**State**: Uses store directly for config and service configs.

**Features**:
- Per-service configuration options
- Dynamic fields based on selected services
- Optional overrides for defaults
- Skip-friendly (not required for basic setup)

**Validation**: Handled by `useWizardValidation` hook in parent component.

---

### `ReviewGenerateStep.tsx`

**Purpose**: Final review and configuration generation.

**State**: Uses store for config, selectedServices, and deployment state.

**Features**:
- Configuration summary
- Storage layout display
- Local/Cloud deployment options
- File download buttons
- Remote deployment modal integration

**Sub-Components**: See [Review Sub-Components](#review-sub-components) section.

---

## Modal Components

Dialogs and panels that can be conditionally rendered.

### `DraftRecoveryModal.tsx`

**Purpose**: Auto-save draft recovery on wizard mount.

**Props**:
```typescript
interface DraftRecoveryModalProps {
  isOpen: boolean
  draftInfo: { savedAt: number; serviceCount: number } | null
  onRestore: () => void
  onDismiss: () => void
}
```

**Features**:
- Shows draft metadata (timestamp, service count)
- "Resume where you left off" button
- "Start fresh" button
- AnimatePresence for smooth enter/exit

---

### `ProfilesPanel.tsx`

**Purpose**: Save, load, and manage named configuration profiles.

**Props**:
```typescript
interface ProfilesPanelProps {
  isOpen: boolean
  onClose: () => void
}
```

**State**: Reads `savedProfiles` from store directly.

**Features**:
- List of saved profiles with metadata
- Save current config as new profile
- Load profile to restore config
- Delete profile
- Internal state for new profile name input

---

### `ToolsDialog.tsx`

**Purpose**: Import/export and template browsing interface.

**Props**:
```typescript
interface ToolsDialogProps {
  isOpen: boolean
  onClose: () => void
  onTemplatesClick: () => void
  onExportClick: () => void
  onImportClick: () => void
}
```

**Features**:
- Three action buttons: Templates, Export Config, Import Config
- Wraps Radix UI Dialog primitive
- Icon buttons with descriptions

---

### `VoiceCompanionTrigger.tsx`

**Purpose**: Floating action button to launch voice companion.

**Props**:
```typescript
interface VoiceCompanionTriggerProps {
  isVisible: boolean
  onClick: () => void
}
```

**Features**:
- Uses `useWizardAnimations` hook for scaleIn animation
- Microphone icon
- Pulse effect to draw attention
- Positioned fixed at bottom-right

---

## Review Sub-Components

Sub-components extracted from `ReviewGenerateStep.tsx` for better organization.

Located in `./steps/review/` directory.

### `ConfigSummaryCard.tsx`

**Purpose**: Display configuration summary grid.

**Props**:
```typescript
interface ConfigSummaryCardProps {
  deploymentMode: 'local' | 'cloud'
  domain: string
  timezone: string
  mode: 'simple' | 'advanced'
  serviceCount: number
}
```

**Features**:
- Grid layout with 5 key config values
- Icons for each field
- Readable labels and formatting

---

### `StorageLayoutCard.tsx`

**Purpose**: Display storage paths for selected services.

**Props**:
```typescript
interface StorageLayoutCardProps {
  storagePlan: StoragePlan | undefined
  selectedServices: string[]
}
```

**Features**:
- Category labels (Media Players, Media Downloaders, etc.)
- Path display with "Network share" badge for UNC/NFS paths
- Filters to only show paths for selected services

---

### `LocalAccessGuide.tsx`

**Purpose**: Local mode access guide with app URL table.

**Props**:
```typescript
interface LocalAccessGuideProps {
  selectedServices: string[]
  domain: string
}
```

**Features**:
- Server IP/hostname input with persistence
- Quick-select buttons: localhost, Auto-detect LAN IP
- App URL table filtered by selected services
- Uses `controlServer.getNetworkInfo()` for LAN IP detection
- Exports helper functions: `buildLocalHttpUrl`, `isLoopbackHost`, `LOCAL_ACCESS_APPS`

---

### `LocalDeployModal.tsx`

**Purpose**: Local deployment modal with idle/deploying/success states.

**Props**:
```typescript
interface LocalDeployModalProps {
  isOpen: boolean
  onClose: () => void
  selectedServices: string[]
  config: SetupConfig
  composePath: string
}
```

**Features**:
- Three states: idle, deploying, success
- Docker deployment via control server
- Real-time container status polling
- Bootstrap API key extraction panel
- Access URLs with LAN IP detection
- Error handling with manual deployment fallback

**Sub-Component**: `BootstrapKeysPanel.tsx`

---

### `BootstrapKeysPanel.tsx`

**Purpose**: API key extraction from deployed containers.

**Props**:
```typescript
interface BootstrapKeysPanelProps {
  selectedServices: string[]
}
```

**Features**:
- Extracts API keys from Sonarr, Radarr, Prowlarr, Lidarr
- Polling progress with loading states
- Reveal/copy functionality for each key
- Validation status display (✓ or pending)
- Uses control server `/api/arr/extract-keys` endpoint

---

## State Management

### Zustand Store Pattern

The wizard uses a single Zustand store (`store/setupStore.ts`) with:

1. **State Slices** (10 logical groups):
   - Wizard Navigation State
   - Mode & Configuration State
   - Navigation Actions
   - Service Selection Actions
   - Configuration Actions
   - Storage Management Actions
   - Wizard Control Actions
   - Template & Import/Export Actions
   - Profile Management
   - Auto-Save Draft

2. **Selector Hooks** (11 computed selectors):
   - `useIsLocalMode()` - Check if deployment mode is 'local'
   - `useSelectedServiceCount()` - Count of selected services
   - `useHasService(id)` - Check if service is selected
   - `useWizardProgress()` - Calculate % complete
   - `useCanNavigateToStep(step)` - Check if step is accessible
   - `useCurrentStepInfo()` - Get current step metadata
   - `useHasTorrentWithoutVPN()` - Validate torrent + VPN requirement
   - `useIsQuickStartMode()` - Check if in quick start flow
   - `useWizardMode()` - Get simple/advanced mode
   - `useIsSimpleStorageMode()` - Check storage mode
   - `useDataRootPath()` - Get data root path

### Reading from Store

Components use selectors to minimize re-renders:

```typescript
// ✅ Good: Selective subscription
const currentStep = useSetupStore((state) => state.currentStep)
const nextStep = useSetupStore((state) => state.nextStep)

// ✅ Good: Using selector hook
const isLocal = useIsLocalMode()

// ❌ Avoid: Subscribe to entire store
const store = useSetupStore()
```

---

## Custom Hooks

Wizard-specific hooks in `src/hooks/`:

### `useWizardAnimations.ts`

**Purpose**: Provides animation variants that respect reduced motion preferences.

**Returns**:
```typescript
{
  fadeInUp: Variant
  scaleIn: Variant
}
```

**Usage**:
```tsx
const { fadeInUp, scaleIn } = useWizardAnimations()
<motion.div {...fadeInUp}>Content</motion.div>
```

---

### `useConfigGenerators.ts`

**Purpose**: Generate YAML configuration files (Authelia, Cloudflare).

**Returns**:
```typescript
{
  generateAutheliaYaml: () => string
  generateCloudflareYaml: () => string
}
```

**Features**:
- Reads config and selectedServices from store
- Memoized for performance
- Generates full YAML with proper indentation

---

### `useFileDownload.ts`

**Purpose**: File download and clipboard utilities.

**Returns**:
```typescript
{
  copied: boolean
  copyToClipboard: (text: string, filename?: string) => Promise<void>
  downloadFile: (content: string, filename: string) => void
  downloadAllFiles: () => void
  generateEnvFile: () => string
}
```

**Features**:
- Clipboard copy with 2-second feedback
- Blob-based file downloads
- Generates .env file from config
- Downloads all config files as bundle

---

### `useWizardValidation.ts`

**Purpose**: Form validation and step navigation logic.

**Returns**:
```typescript
{
  handleNextStep: () => void
  shakeField: string | null
}
```

**Features**:
- Validates Basic Config (step 1) and Advanced Settings (step 4)
- Manages shake animation state for error fields
- Scrolls to error fields with focus
- Shows toast notifications for errors
- Calls `nextStep()` on successful validation

---

### `useVoicePlanHandler.ts`

**Purpose**: Apply voice companion suggestions to wizard state.

**Returns**:
```typescript
{
  handleApplyVoicePlan: (plan: VoicePlan, onClose?: () => void) => void
}
```

**Features**:
- Applies services, domain, and storage paths from voice plan
- Supports undo with toast notification
- Manages state updates via store actions
- Calls onClose callback for modal management

---

## Extension Guide

### Adding a New Step

1. **Create step component** in `./steps/`:
   ```tsx
   // MyNewStep.tsx
   export function MyNewStep() {
     const { config, updateConfig } = useSetupStore()
     return <div>...</div>
   }
   ```

2. **Add to barrel export** in `index.ts`:
   ```typescript
   export { MyNewStep } from './steps/MyNewStep'
   ```

3. **Update steps array** in `SetupWizard.tsx`:
   ```typescript
   const steps = [
     { title: 'Welcome', icon: Sparkles },
     { title: 'My New Step', icon: MyIcon },
     // ...
   ]
   ```

4. **Add to step renderer** in `SetupWizard.tsx`:
   ```tsx
   {currentStep === 1 && <MyNewStep />}
   ```

---

### Adding a New Modal

1. **Create modal component** in `./`:
   ```tsx
   interface MyModalProps {
     isOpen: boolean
     onClose: () => void
   }

   export function MyModal({ isOpen, onClose }: MyModalProps) {
     return (
       <AnimatePresence>
         {isOpen && <motion.div>...</motion.div>}
       </AnimatePresence>
     )
   }
   ```

2. **Add to barrel export** and use in `SetupWizard.tsx`.

---

### Adding Store State

1. **Add to interface** in `setupStore.ts`:
   ```typescript
   export interface SetupStore {
     // ... existing state
     myNewField: string
     setMyNewField: (value: string) => void
   }
   ```

2. **Add to implementation**:
   ```typescript
   export const useSetupStore = create<SetupStore>()(
     persist(
       (set) => ({
         // ... existing state
         myNewField: '',
         setMyNewField: (value) => set({ myNewField: value }),
       }),
       { name: 'setup-wizard' }
     )
   )
   ```

3. **Add JSDoc** to document purpose.

---

### Adding a Selector Hook

1. **Add to `setupStore.ts`**:
   ```typescript
   export const useMySelector = () =>
     useSetupStore((state) => state.myField === 'something')
   ```

2. **Use in components**:
   ```tsx
   const myValue = useMySelector()
   ```

---

### Adding a Custom Hook

1. **Create hook file** in `src/hooks/`:
   ```typescript
   // useMyFeature.ts
   import { useSetupStore } from '../store/setupStore'

   export function useMyFeature() {
     const config = useSetupStore((state) => state.config)

     const myFunction = useCallback(() => {
       // logic here
     }, [config])

     return { myFunction }
   }
   ```

2. **Import in `SetupWizard.tsx`** or relevant component.

---

## File Organization

```
wizard/
├── index.ts                    # Barrel export
├── README.md                   # This file
├── WizardHeader.tsx            # Shell: Header
├── WizardProgressBar.tsx       # Shell: Progress bar
├── WizardStepIndicator.tsx     # Shell: Step dots
├── WizardNavigation.tsx        # Shell: Back/Next buttons
├── DraftRecoveryModal.tsx      # Modal: Draft recovery
├── ProfilesPanel.tsx           # Modal: Profiles
├── ToolsDialog.tsx             # Modal: Import/export/templates
├── VoiceCompanionTrigger.tsx   # Modal: Voice button
└── steps/
    ├── QuickStartStep.tsx      # Step: Quick start
    ├── BasicConfigurationStep.tsx  # Step: Basic config
    ├── StackSelectionStep.tsx  # Step: Service selection
    ├── AdvancedSettingsStep.tsx    # Step: Advanced settings
    ├── ReviewGenerateStep.tsx  # Step: Review & generate
    └── review/
        ├── ConfigSummaryCard.tsx      # Review: Config summary
        ├── StorageLayoutCard.tsx      # Review: Storage paths
        ├── LocalAccessGuide.tsx       # Review: Local URLs
        ├── LocalDeployModal.tsx       # Review: Deploy modal
        └── BootstrapKeysPanel.tsx     # Review: API key extraction
```

---

## Best Practices

1. **State Management**:
   - Read from store via selectors
   - Keep internal UI state in component (e.g., dropdown open/closed)
   - Use selector hooks for computed values

2. **Props vs Store**:
   - Event handlers as props (e.g., `onClose`, `onClick`)
   - Data from store via selectors
   - Avoid passing large config objects as props

3. **Animations**:
   - Use `useWizardAnimations` hook for consistency
   - Always respect reduced motion preferences
   - Keep animations subtle and purposeful

4. **Forms**:
   - Use React Hook Form + Zod for validation
   - Let `useWizardValidation` handle navigation and errors
   - Provide clear error messages

5. **Accessibility**:
   - Use semantic HTML
   - Add ARIA attributes for screen readers
   - Ensure keyboard navigation works
   - Test with reduced motion enabled

6. **Code Style**:
   - Follow existing TypeScript patterns
   - Add JSDoc comments for complex functions
   - Keep components under 300 lines (extract if larger)
   - Use descriptive variable names

---

## Related Documentation

- **Store**: `src/store/setupStore.ts` - JSDoc comments on all slices
- **Hooks**: `src/hooks/` - Individual hook documentation
- **Data**: `src/data/services.ts`, `src/data/storagePlan.ts` - Service definitions
- **Schemas**: `src/schemas/setupSchema.ts` - Zod validation schemas
- **Main README**: `CLAUDE.md` - Project overview and commands

---

## Migration Notes

This refactoring (completed Jan 2026) reduced SetupWizard.tsx from ~1000 lines to ~400 lines by extracting:

- 4 shell components
- 4 modal components
- 5 review sub-components
- 5 custom hooks

All functionality remains identical. The component structure is now:
- Easier to understand for new contributors
- Easier to test in isolation
- Easier to extend with new features
- Better organized with clear responsibilities

For historical context, see git history around commit `b85959c` (refactor complete).
