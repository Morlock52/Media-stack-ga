# Agentic Workflow Improvements Plan

**Created:** January 2026
**Status:** Planning
**Theme:** Maintain Matrix HUD aesthetic while adding proactive, autonomous AI capabilities

---

## Research Summary (2026 Best Practices)

Based on research from [Skywork AI](https://skywork.ai/blog/agentic-ai-examples-workflow-patterns-2025/), [UX Magazine](https://uxmag.com/articles/secrets-of-agentic-ux-emerging-design-patterns-for-human-interaction-with-ai-agents), [Daito Design](https://www.daitodesign.com/blog/agentic-patterns), and [Vellum AI](https://www.vellum.ai/blog/agentic-workflows-emerging-architectures-and-design-patterns):

### Core Agentic Principles
1. **Proactive Assistance** - AI suggests before being asked
2. **Intent-Based Design** - Users express goals, AI figures out steps
3. **Trust Calibration** - Progressive autonomy based on reliability
4. **Human-Agent Handoff** - Clear control transfer with state preservation
5. **Visible Guardrails** - Override options, confidence indicators, recovery paths
6. **Persistent Memory** - Cross-session context and learning

---

## Current State Analysis

### Existing AI Features
- VoiceCompanion with multi-provider voice I/O
- AIAssistant with 5 specialized agents
- Proactive nudges (basic implementation)
- Tool execution (logs, config validation, bootstrap)
- Wizard step context awareness

### Identified Gaps
1. **No autonomous action execution** - Always requires manual confirmation
2. **No persistent memory** - Session-only context
3. **No predictive warnings** - Only reactive assistance
4. **No wizard auto-fill from voice** - Plan extracted but not applied
5. **No background monitoring** - Health checks only on-demand
6. **No multi-step task tracking** - Single-turn interactions only

---

## Improvement Plan

### Phase 1: Proactive Wizard Assistance (Priority: HIGH)

#### 1.1 Auto-Apply Voice Plans
**Current:** VoiceCompanion extracts plan but user must manually configure wizard
**Improved:** "Apply This Plan" button that auto-fills wizard form fields

**Implementation:**
```typescript
// VoiceCompanion.tsx - Add apply plan handler
const handleApplyPlan = (plan: VoicePlanSummary) => {
  // Update wizard store directly
  if (plan.services) {
    plan.services.forEach(s => toggleService(s, true))
  }
  if (plan.domain) updateConfig({ domain: plan.domain })
  if (plan.storagePaths) {
    Object.entries(plan.storagePaths).forEach(([key, path]) => {
      updateStoragePath(key, { path })
    })
  }
  // Navigate to appropriate step
  if (plan.services?.length) setCurrentStep(2) // Stack selection
  toast.success('Plan applied to wizard!')
}
```

**UI Addition:**
- "Apply Plan" button appears after successful plan generation
- Shows preview of what will be changed
- Animated transition to wizard step

#### 1.2 Proactive Step Suggestions
**Current:** Generic tips per step
**Improved:** Context-aware suggestions based on current selections

**Implementation:**
```typescript
// New hook: useProactiveSuggestions.ts
export function useProactiveSuggestions(step: number, config: SetupConfig) {
  const suggestions = useMemo(() => {
    const items: Suggestion[] = []

    // Step 2: Stack Selection
    if (step === 2) {
      if (config.selectedServices.includes('plex') &&
          !config.selectedServices.includes('tautulli')) {
        items.push({
          id: 'add-tautulli',
          text: 'Add Tautulli for Plex analytics?',
          action: () => toggleService('tautulli', true),
          icon: 'chart'
        })
      }
    }

    // Step 4: Advanced
    if (step === 4) {
      if (!config.cloudflareToken && config.selectedServices.length > 3) {
        items.push({
          id: 'add-cloudflare',
          text: 'Enable Cloudflare Tunnel for secure remote access?',
          action: 'open-cloudflare-guide',
          icon: 'shield'
        })
      }
    }

    return items
  }, [step, config])

  return suggestions
}
```

**UI:**
- Floating suggestion cards that slide in from right
- Dismiss or accept with single click
- Remembers dismissed suggestions

#### 1.3 Intelligent Form Validation
**Current:** Basic field validation
**Improved:** AI-powered validation with fix suggestions

**Implementation:**
- Validate domain format and suggest corrections
- Check if port conflicts with known services
- Warn about common configuration mistakes

---

### Phase 2: Autonomous Health Monitoring (Priority: HIGH)

#### 2.1 Background Health Agent
**New Feature:** Continuous monitoring when wizard is on Review step

**Implementation:**
```typescript
// New component: HealthMonitor.tsx
export function HealthMonitor() {
  const [health, setHealth] = useState<HealthStatus[]>([])
  const isVisible = usePageVisibility()

  useEffect(() => {
    if (!isVisible) return

    const checkHealth = async () => {
      const res = await fetch('/api/agent/health-check')
      const data = await res.json()

      // Proactive alert for issues
      data.issues.forEach(issue => {
        if (issue.severity === 'critical') {
          toast.error(issue.message, {
            action: {
              label: 'Fix Now',
              onClick: () => handleAutoFix(issue)
            }
          })
        }
      })

      setHealth(data.services)
    }

    const interval = setInterval(checkHealth, 30_000)
    checkHealth() // Initial check

    return () => clearInterval(interval)
  }, [isVisible])

  return <HealthStatusBar health={health} />
}
```

#### 2.2 Predictive Issue Detection
**New Feature:** Warn about potential problems before they occur

**Examples:**
- "Disk space is at 85% - consider adding more storage"
- "VPN certificate expires in 7 days"
- "Plex database not backed up in 30 days"

---

### Phase 3: Multi-Step Task Orchestration (Priority: MEDIUM)

#### 3.1 Task Decomposition
**Current:** Single-turn requests
**Improved:** Break complex requests into tracked subtasks

**Implementation:**
```typescript
// New: TaskOrchestrator.tsx
interface Task {
  id: string
  title: string
  status: 'pending' | 'in_progress' | 'done' | 'error'
  subtasks: Task[]
  canUndo: boolean
}

export function TaskOrchestrator({ request }: { request: string }) {
  const [tasks, setTasks] = useState<Task[]>([])

  // AI decomposes request into tasks
  useEffect(() => {
    const decompose = async () => {
      const res = await fetch('/api/agent/decompose-task', {
        method: 'POST',
        body: JSON.stringify({ request })
      })
      const { tasks } = await res.json()
      setTasks(tasks)
    }
    decompose()
  }, [request])

  return (
    <div className="task-list">
      {tasks.map(task => (
        <TaskCard
          key={task.id}
          task={task}
          onExecute={() => executeTask(task)}
          onUndo={() => undoTask(task)}
        />
      ))}
    </div>
  )
}
```

#### 3.2 Execution with Rollback
**New Feature:** Safe execution with undo capability

**Implementation:**
- Capture state before each action
- Execute with timeout and error handling
- Provide "Undo" button for reversible actions
- Audit log of all autonomous actions

---

### Phase 4: Persistent Memory (Priority: MEDIUM)

#### 4.1 Conversation History
**Current:** Lost on page refresh
**Improved:** Persist across sessions

**Implementation:**
```typescript
// IndexedDB storage for conversations
const conversationStore = {
  async save(conversation: Message[]) {
    const db = await openDB('mediastack-ai', 1)
    await db.put('conversations', {
      id: Date.now(),
      messages: conversation,
      config: getCurrentConfig()
    })
  },

  async getRecent(limit = 10) {
    const db = await openDB('mediastack-ai', 1)
    return db.getAll('conversations', null, limit)
  }
}
```

#### 4.2 Learning from Interactions
**New Feature:** Improve suggestions based on user behavior

**Implementation:**
- Track which suggestions are accepted/dismissed
- Store common user configurations
- Pre-fill forms based on past choices
- Surface "You usually enable X when using Y"

---

### Phase 5: Enhanced Voice Interaction (Priority: MEDIUM)

#### 5.1 Clarification Questions
**Current:** One-shot plan generation
**Improved:** Multi-turn clarification before plan

**Implementation:**
```typescript
// Enhanced voice agent flow
const generatePlan = async (transcript: string) => {
  const analysis = await analyzeIntent(transcript)

  if (analysis.ambiguous.length > 0) {
    // Ask clarifying questions
    return {
      type: 'clarification',
      questions: analysis.ambiguous.map(a => ({
        id: a.id,
        question: a.question,
        options: a.options
      }))
    }
  }

  return { type: 'plan', plan: analysis.plan }
}
```

**UI:**
- Voice prompts for clarification
- Quick-select buttons for common options
- "I don't know, decide for me" option

#### 5.2 Hands-Free Wizard Navigation
**New Feature:** Voice commands for wizard control

**Commands:**
- "Next step" / "Go back"
- "Enable Plex" / "Disable VPN"
- "Set domain to example.com"
- "Download my files"
- "Deploy to my server"

---

### Phase 6: Trust & Transparency (Priority: HIGH)

#### 6.1 Action Confidence Indicators
**New Feature:** Show AI confidence level

**Implementation:**
```typescript
interface AgentResponse {
  message: string
  confidence: 'high' | 'medium' | 'low'
  reasoning?: string
  alternatives?: string[]
}

// UI shows confidence badge
<ConfidenceBadge level={response.confidence} />
```

#### 6.2 Audit Trail
**New Feature:** Log all autonomous actions

**Implementation:**
```typescript
const auditLog = {
  async log(action: AgentAction) {
    await db.insert('audit', {
      timestamp: Date.now(),
      action: action.type,
      details: action.details,
      wasAutonomous: action.autonomous,
      userConfirmed: action.confirmed
    })
  },

  async getRecent() {
    return db.query('audit', { limit: 50 })
  }
}
```

**UI:**
- "Recent Actions" panel
- Filter by autonomous vs manual
- Rollback button for reversible actions

---

## Implementation Priority

### Sprint 1 (Immediate - High Impact)
1. [ ] Auto-apply voice plans to wizard (1.1)
2. [ ] Proactive step suggestions (1.2)
3. [ ] Action confidence indicators (6.1)

### Sprint 2 (Near-term)
4. [ ] Background health monitoring (2.1)
5. [ ] Persistent conversation history (4.1)
6. [ ] Clarification questions for voice (5.1)

### Sprint 3 (Future)
7. [ ] Task decomposition & orchestration (3.1)
8. [ ] Predictive issue detection (2.2)
9. [ ] Hands-free wizard navigation (5.2)
10. [ ] Learning from interactions (4.2)

---

## Design Guidelines

### Visual Consistency (Matrix Theme)
- Use existing color palette (emerald/cyan/lime gradients)
- Maintain glassmorphism cards
- Keep animation timing consistent (Framer Motion)
- Use Lucide icons

### Agentic UI Patterns
- **Suggestion Cards**: Slide in from right, dismiss with X or swipe
- **Confidence Badges**: Color-coded (green=high, yellow=medium, red=low)
- **Task Progress**: Vertical timeline with checkmarks
- **Health Status**: Subtle top bar with pulsing indicators
- **Undo Actions**: Toast with undo button (5s timeout)

### Accessibility
- All new interactions keyboard accessible
- Screen reader announcements for autonomous actions
- Reduced motion support for animations
- Clear focus indicators

---

## Success Metrics

1. **Wizard Completion Rate**: Target 20% increase
2. **Voice Plan Application Rate**: Target 60% of generated plans applied
3. **Suggestion Acceptance Rate**: Target 40%
4. **Time to First Deploy**: Target 30% reduction
5. **Support Query Reduction**: Target 25% fewer "how do I" questions

---

## Risk Mitigation

1. **Over-automation**: All autonomous actions have undo capability
2. **Trust erosion**: Confidence indicators and explanations
3. **Performance**: Lazy loading, visibility-aware polling
4. **Complexity**: Progressive disclosure, simple defaults
5. **Accessibility**: Test with screen readers, keyboard navigation

---

## Next Steps

1. Review this plan for completeness
2. Confirm implementation priority with current project needs
3. Begin Sprint 1 implementation
4. Test each feature in isolation
5. Integration testing
6. Stress and smoke testing
