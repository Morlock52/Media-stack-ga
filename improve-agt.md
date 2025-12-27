# Agentic Features Improvement Plan

**Date:** December 27, 2025
**Status:** Comprehensive Technical Assessment
**Focus:** AI Agent Architecture, UX, Models, and Production Readiness

---

## Executive Summary

Media Stack's current agentic implementation is functional but has significant technical debt and optimization opportunities. This document outlines targeted improvements based on 2025 best practices for AI agent frameworks, voice interfaces, RAG systems, and production reliability.

---

## 1. Critical Technical Issues (Fix Immediately)

### 1.1 Invalid Model References

**Current Problem:**
```typescript
// control-server/src/routes/ai.ts - LINE ~45
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-5.2'  // DOES NOT EXIST
const TTS_MODEL = process.env.OPENAI_TTS_MODEL || 'gpt-5.2-mini-tts'  // DOES NOT EXIST
```

**Fix:**
```typescript
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o'  // or 'gpt-4o-mini' for cost
const TTS_MODEL = process.env.OPENAI_TTS_MODEL || 'tts-1'  // or 'tts-1-hd'
```

### 1.2 Security Vulnerabilities

| Issue | Location | Severity | Fix |
|-------|----------|----------|-----|
| No input sanitization on `serviceName` | `agentTools.ts:restart_service` | HIGH | Add allowlist validation |
| Command injection risk | Docker exec calls | HIGH | Escape/validate container names |
| No rate limiting | `/api/tts`, `/api/agent/chat` | MEDIUM | Add per-IP rate limits |
| Unencrypted API key storage | Settings endpoints | MEDIUM | Use encrypted storage |

### 1.3 Missing Error Context

**Problem:** Generic error messages don't help debugging.

**Current:**
```typescript
catch (err) {
  return { answer: 'Something went wrong', aiPowered: false }
}
```

**Fixed:**
```typescript
catch (err: unknown) {
  const errorContext = {
    code: err instanceof OpenAI.APIError ? err.code : 'UNKNOWN',
    provider: currentProvider,
    retryable: err instanceof OpenAI.RateLimitError,
    message: err instanceof Error ? err.message : 'Unknown error'
  }
  logger.error('Agent chat failed', errorContext)
  return {
    answer: formatUserFriendlyError(errorContext),
    aiPowered: false,
    debug: process.env.NODE_ENV === 'development' ? errorContext : undefined
  }
}
```

---

## 2. Framework Assessment

### 2.1 Recommended: OpenAI Agents SDK

**Why it's the best fit for this project:**

| Criterion | OpenAI Agents SDK | LangGraph | CrewAI |
|-----------|-------------------|-----------|--------|
| Learning curve | Low | High | Medium |
| Existing OpenAI integration | Native | Adapter | Adapter |
| Voice/Realtime support | Native | Manual | None |
| Multi-agent handoffs | Built-in | Manual | Built-in |
| Tool calling | Native functions | Manual | Role-based |
| Streaming | First-class | First-class | Limited |
| Production readiness | High | High | Medium |

**Migration path:**
1. Wrap existing agents in SDK `Agent` class
2. Convert tools to `@function_tool` decorators
3. Add `Handoff` for agent-to-agent delegation
4. Enable built-in tracing via LangSmith-compatible telemetry

### 2.2 Current Architecture vs Recommended

**Current (Homegrown):**
```
User Input → detectAgent() → buildSystemPrompt() → OpenAI API → Parse Response
```

**Recommended (Agents SDK):**
```
User Input → Runner.run() → Agent (with Tools, Guardrails, Handoffs) → Streaming Events → UI
```

**Key Upgrades:**
- **Guardrails:** Input/output validation before/after LLM
- **Handoffs:** Seamless agent switching with context preservation
- **Sessions:** Automatic conversation state management
- **Tracing:** Built-in observability

---

## 3. Model Strategy

### 3.1 Recommended Model Matrix

| Use Case | Primary Model | Fallback | Rationale |
|----------|---------------|----------|-----------|
| Chat (complex) | `claude-sonnet-4` | `gpt-4o` | Better agentic reasoning |
| Chat (simple) | `gpt-4o-mini` | `claude-haiku-3-5` | Cost efficiency |
| Tool calling | `gpt-4o` | `claude-sonnet-4` | Reliable function calling |
| TTS | OpenAI `tts-1-hd` | ElevenLabs | Quality vs cost |
| Realtime voice | `gpt-realtime-mini` | Chained (STT→LLM→TTS) | Sub-200ms latency |

### 3.2 Cost Optimization

**Current estimated costs (per 1000 user sessions):**
- Full conversation (5 turns avg): ~$15 with GPT-4o
- TTS (30 sec avg): ~$0.30 OpenAI, ~$0.45 ElevenLabs

**Recommended optimizations:**
1. **Context compression:** Summarize history beyond 4 messages
2. **Prompt caching:** Use `store: true` with Responses API (40-80% cache hit)
3. **Model tiering:** Route simple queries to `gpt-4o-mini`

```typescript
// Example intelligent routing
function selectModel(query: string, complexity: number): string {
  if (complexity < 0.3) return 'gpt-4o-mini'      // Simple questions
  if (complexity > 0.7) return 'claude-sonnet-4'   // Complex reasoning
  return 'gpt-4o'                                  // Default
}
```

---

## 4. Streaming Implementation (High Priority)

### 4.1 Current Limitation

All responses wait for full completion before display. This creates:
- Poor perceived performance (3-5s wait times)
- No feedback during tool execution
- User uncertainty about agent status

### 4.2 Implementation Plan

**Backend (SSE endpoint):**
```typescript
// control-server/src/routes/ai.ts
app.get('/api/agent/chat/stream', async (request, reply) => {
  reply.raw.setHeader('Content-Type', 'text/event-stream')
  reply.raw.setHeader('Cache-Control', 'no-cache')
  reply.raw.setHeader('Connection', 'keep-alive')

  const stream = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages,
    stream: true,
    tools
  })

  for await (const chunk of stream) {
    const delta = chunk.choices[0]?.delta
    if (delta?.content) {
      reply.raw.write(`data: ${JSON.stringify({ type: 'text', content: delta.content })}\n\n`)
    }
    if (delta?.tool_calls) {
      reply.raw.write(`data: ${JSON.stringify({ type: 'tool_start', tool: delta.tool_calls[0] })}\n\n`)
    }
  }
  reply.raw.write('data: [DONE]\n\n')
  reply.raw.end()
})
```

**Frontend (EventSource):**
```typescript
// docs-site/src/components/AIAssistant.tsx
const streamChat = async (message: string) => {
  const eventSource = new EventSource(`/api/agent/chat/stream?message=${encodeURIComponent(message)}`)

  eventSource.onmessage = (event) => {
    if (event.data === '[DONE]') {
      eventSource.close()
      return
    }
    const { type, content, tool } = JSON.parse(event.data)
    if (type === 'text') appendToCurrentMessage(content)
    if (type === 'tool_start') setStatus('using-computer')
  }
}
```

---

## 5. RAG Integration (Knowledge Base)

### 5.1 Why It's Needed

Current agents rely solely on system prompts. They cannot:
- Answer service-specific configuration questions
- Reference official documentation
- Provide accurate CLI commands for Plex/Sonarr/etc.

### 5.2 Recommended Architecture: Agentic RAG

```
┌─────────────────────────────────────────────────────────┐
│                     Meta-Agent                          │
│  (Orchestrates document retrieval & response)           │
└─────────────┬───────────────────────────┬───────────────┘
              │                           │
     ┌────────▼────────┐         ┌────────▼────────┐
     │  Plex Doc Agent │         │ Sonarr Doc Agent│
     │  (Plex KB chunk)│         │ (Sonarr KB)     │
     └─────────────────┘         └─────────────────┘
```

### 5.3 Implementation with OpenAI File Search

```typescript
// Create vector store per service
const vectorStore = await openai.beta.vectorStores.create({
  name: 'media-stack-docs'
})

// Upload service docs
await openai.beta.vectorStores.fileBatches.uploadAndPoll(vectorStore.id, {
  files: [
    fs.createReadStream('./docs/plex-setup.md'),
    fs.createReadStream('./docs/sonarr-guide.md'),
    fs.createReadStream('./docs/cloudflare-tunnel.md')
  ]
})

// Agent with file search tool
const agent = new Agent({
  name: 'docs-expert',
  model: 'gpt-4o',
  tools: [new FileSearchTool({ vectorStoreIds: [vectorStore.id] })]
})
```

### 5.4 Documentation to Index

| Priority | Document | Source |
|----------|----------|--------|
| P0 | Plex Media Server docs | https://support.plex.tv |
| P0 | Sonarr/Radarr wiki | GitHub wikis |
| P0 | Docker Compose reference | Local + official |
| P1 | Cloudflare Tunnel setup | Cloudflare docs |
| P1 | Authelia configuration | Authelia docs |
| P2 | Gluetun VPN options | GitHub README |

---

## 6. Voice Interface Improvements

### 6.1 Current Limitations

- Uses deprecated Web Speech API (inconsistent cross-browser)
- Separate TTS call after response generation (latency)
- No interruption handling
- No emotion/intent detection

### 6.2 Recommended: OpenAI Realtime API

**Why migrate:**
- Sub-200ms voice-to-voice latency
- Native speech-to-speech (no STT→LLM→TTS chain)
- Tool calling during voice conversations
- Emotion and intent preserved in audio

**Implementation:**
```typescript
// WebSocket connection for server-side
import WebSocket from 'ws'

const ws = new WebSocket('wss://api.openai.com/v1/realtime?model=gpt-realtime-mini', {
  headers: { 'Authorization': `Bearer ${OPENAI_API_KEY}` }
})

ws.on('open', () => {
  ws.send(JSON.stringify({
    type: 'session.update',
    session: {
      modalities: ['text', 'audio'],
      voice: 'alloy',
      tools: agentTools,
      instructions: systemPrompt
    }
  }))
})

// Handle audio chunks from client
ws.on('message', (data) => {
  const event = JSON.parse(data.toString())
  if (event.type === 'response.audio.delta') {
    // Stream audio back to client
    broadcastToClient(event.delta)
  }
})
```

### 6.3 Hybrid Voice Mode

Support both architectures for reliability:

```typescript
interface VoiceConfig {
  mode: 'realtime' | 'chained' | 'browser'
  fallbackChain: ['realtime', 'chained', 'browser']
}

async function processVoice(audio: ArrayBuffer, config: VoiceConfig) {
  for (const mode of config.fallbackChain) {
    try {
      if (mode === 'realtime') return await realtimeProcess(audio)
      if (mode === 'chained') return await chainedProcess(audio) // STT → LLM → TTS
      if (mode === 'browser') return await browserProcess(audio)
    } catch (e) {
      console.warn(`${mode} failed, trying next...`)
    }
  }
  throw new Error('All voice modes failed')
}
```

---

## 7. Error Handling & Recovery

### 7.1 Circuit Breaker Pattern

```typescript
// control-server/src/services/circuitBreaker.ts
interface CircuitBreakerState {
  failures: number
  lastFailure: Date | null
  state: 'closed' | 'open' | 'half-open'
}

class CircuitBreaker {
  private state: CircuitBreakerState = { failures: 0, lastFailure: null, state: 'closed' }
  private readonly threshold = 5
  private readonly resetTimeout = 30000

  async execute<T>(fn: () => Promise<T>, fallback: () => T): Promise<T> {
    if (this.state.state === 'open') {
      if (Date.now() - this.state.lastFailure!.getTime() > this.resetTimeout) {
        this.state.state = 'half-open'
      } else {
        return fallback()
      }
    }

    try {
      const result = await fn()
      this.state = { failures: 0, lastFailure: null, state: 'closed' }
      return result
    } catch (e) {
      this.state.failures++
      this.state.lastFailure = new Date()
      if (this.state.failures >= this.threshold) {
        this.state.state = 'open'
      }
      return fallback()
    }
  }
}

// Usage
const openaiCircuit = new CircuitBreaker()
const response = await openaiCircuit.execute(
  () => openai.chat.completions.create({ ... }),
  () => fallbackResponse(agentId)
)
```

### 7.2 Retry with Exponential Backoff

```typescript
async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  baseDelay = 1000
): Promise<T> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn()
    } catch (e) {
      if (attempt === maxRetries - 1) throw e
      if (e instanceof OpenAI.RateLimitError) {
        const delay = baseDelay * Math.pow(2, attempt) + Math.random() * 1000
        await sleep(delay)
      } else {
        throw e // Non-retryable error
      }
    }
  }
  throw new Error('Max retries exceeded')
}
```

### 7.3 Graceful Degradation Hierarchy

```
OpenAI GPT-4o (Primary)
    ↓ (failure)
Claude Sonnet 4 (Secondary)
    ↓ (failure)
GPT-4o-mini (Tertiary)
    ↓ (failure)
Cached/Canned Responses (Fallback)
    ↓ (no match)
Helpful Error with Retry Option (Last Resort)
```

---

## 8. UI/UX Improvements

### 8.1 Agentic UX Patterns (2025 Best Practices)

| Pattern | Current State | Recommendation |
|---------|---------------|----------------|
| **Transparency** | Shows "thinking" status | Add step-by-step reasoning display |
| **Control** | Agent auto-selects | Let users override agent selection |
| **Proactive Nudges** | Good (implemented) | Add dismissible + "don't show again" |
| **Multimodal** | Voice OR chat | Seamless voice + chat + visual |
| **Error Recovery** | Basic retry | Show error reason + suggested actions |

### 8.2 Agent Status Improvements

**Current states:** `thinking`, `using-computer`, `responding`, `idle`

**Recommended additions:**
```typescript
type AgentStatus =
  | 'idle'
  | 'listening'        // Voice input active
  | 'thinking'         // LLM processing
  | 'searching'        // RAG retrieval
  | 'tool:check'       // Running health check
  | 'tool:docker'      // Docker operation
  | 'tool:network'     // Network diagnostics
  | 'generating'       // Streaming response
  | 'speaking'         // TTS output
  | 'error'            // Recoverable error
  | 'offline'          // No connectivity
```

### 8.3 Conversation Memory Display

Add visual memory indicator:
```tsx
<div className="flex items-center gap-2 text-xs text-muted">
  <BrainIcon className="h-3 w-3" />
  <span>Remembers {messageCount} messages ({tokenCount} tokens)</span>
  {tokenCount > 3000 && (
    <button onClick={clearHistory} className="text-amber-500">
      (Clear to save tokens)
    </button>
  )}
</div>
```

---

## 9. Tool Improvements

### 9.1 Current Tools Assessment

| Tool | Status | Issues | Improvements |
|------|--------|--------|--------------|
| `check_service_health` | Working | Basic stats only | Add memory/CPU trends |
| `restart_service` | Working | No pre-flight checks | Add dependency check |
| `generate_env_diff` | Working | No suggestions | Add fix recommendations |
| `run_post_deploy_check` | Working | Limited scope | Add network diagnostics |
| `list_running_services` | Working | No issues | - |

### 9.2 New Tools to Add

```typescript
// control-server/src/tools/agentTools.ts

/** Analyze logs for errors/warnings */
const analyzeLogsSchema = {
  name: 'analyze_logs',
  description: 'Search container logs for errors, warnings, or patterns',
  parameters: {
    type: 'object',
    properties: {
      serviceName: { type: 'string', description: 'Container name' },
      pattern: { type: 'string', description: 'Regex pattern to search' },
      severity: { enum: ['error', 'warning', 'info'], description: 'Min severity' },
      lines: { type: 'number', description: 'Last N lines (default 100)' }
    },
    required: ['serviceName']
  }
}

/** Network connectivity diagnostics */
const networkDiagnosticsSchema = {
  name: 'network_diagnostics',
  description: 'Check DNS resolution, port connectivity, and VPN status',
  parameters: {
    type: 'object',
    properties: {
      checkDns: { type: 'boolean', description: 'Test DNS resolution' },
      checkPorts: { type: 'array', items: { type: 'number' }, description: 'Ports to test' },
      checkVpn: { type: 'boolean', description: 'Verify VPN connectivity' }
    }
  }
}

/** Generate optimized service configuration */
const optimizeConfigSchema = {
  name: 'optimize_config',
  description: 'Suggest performance optimizations for a service',
  parameters: {
    type: 'object',
    properties: {
      serviceName: { type: 'string' },
      focus: { enum: ['memory', 'cpu', 'network', 'storage'], description: 'Optimization focus' }
    },
    required: ['serviceName']
  }
}
```

---

## 10. Conversation Persistence Improvements

### 10.1 Current Issues

- File-based storage (not scalable)
- No user isolation
- No encryption
- 50 conversation limit (arbitrary)

### 10.2 Recommended: SQLite with WAL

```typescript
// control-server/src/services/conversationStore.ts
import Database from 'better-sqlite3'

const db = new Database('./data/conversations.db')
db.pragma('journal_mode = WAL')

db.exec(`
  CREATE TABLE IF NOT EXISTS conversations (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    agent_id TEXT,
    created_at INTEGER,
    updated_at INTEGER,
    metadata TEXT
  );

  CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    conversation_id TEXT REFERENCES conversations(id),
    role TEXT CHECK(role IN ('user', 'assistant', 'system', 'tool')),
    content TEXT,
    created_at INTEGER,
    metadata TEXT
  );

  CREATE INDEX idx_conversations_user ON conversations(user_id, updated_at DESC);
  CREATE INDEX idx_messages_conv ON messages(conversation_id, created_at);
`)
```

### 10.3 Encryption for Sensitive Data

```typescript
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'

const ENCRYPTION_KEY = process.env.CONVERSATION_ENCRYPTION_KEY || randomBytes(32)

function encrypt(text: string): string {
  const iv = randomBytes(16)
  const cipher = createCipheriv('aes-256-gcm', ENCRYPTION_KEY, iv)
  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`
}
```

---

## 11. Observability & Monitoring

### 11.1 Metrics to Track

```typescript
// control-server/src/metrics.ts
interface AgentMetrics {
  // Latency
  responseTimeMs: Histogram
  ttfbMs: Histogram  // Time to first byte (streaming)

  // Reliability
  successRate: Gauge
  fallbackRate: Gauge
  circuitBreakerState: Gauge

  // Usage
  tokensUsed: Counter
  toolCallsTotal: Counter
  conversationsActive: Gauge

  // Costs
  estimatedCostUsd: Counter

  // Errors
  errorsByType: Counter  // Labels: rate_limit, auth, timeout, unknown
}
```

### 11.2 Structured Logging

```typescript
import pino from 'pino'

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  formatters: {
    level: (label) => ({ level: label })
  }
})

// Usage
logger.info({
  event: 'agent_response',
  agent: agentId,
  model: modelUsed,
  tokens: { prompt: 150, completion: 200 },
  latencyMs: 1234,
  toolsUsed: ['check_service_health'],
  success: true
})
```

---

## 12. Implementation Roadmap

### Phase 1: Critical Fixes (Week 1)
- [ ] Fix invalid model references
- [ ] Add input validation to tools
- [ ] Implement basic rate limiting
- [ ] Add structured error handling

### Phase 2: Streaming & Performance (Week 2)
- [ ] Implement SSE streaming endpoint
- [ ] Update frontend to handle streaming
- [ ] Add prompt caching with Responses API
- [ ] Implement intelligent model routing

### Phase 3: RAG Integration (Week 3)
- [ ] Set up vector store with service documentation
- [ ] Create File Search tool integration
- [ ] Test knowledge retrieval accuracy
- [ ] Add documentation update pipeline

### Phase 4: Voice Modernization (Week 4)
- [ ] Implement OpenAI Realtime API connection
- [ ] Add WebSocket handler for voice streaming
- [ ] Maintain chained fallback for reliability
- [ ] Add voice-specific UI indicators

### Phase 5: Production Hardening (Week 5)
- [ ] Migrate to SQLite conversation store
- [ ] Add encryption for API keys and conversations
- [ ] Implement circuit breakers
- [ ] Add comprehensive observability

### Phase 6: Agent Framework Migration (Week 6)
- [ ] Refactor to OpenAI Agents SDK
- [ ] Add handoffs between specialist agents
- [ ] Implement guardrails for input/output
- [ ] Enable built-in tracing

---

## 13. References

### Frameworks
- [OpenAI Agents SDK](https://platform.openai.com/docs/guides/agents-sdk)
- [LangGraph](https://www.langflow.org/blog/the-complete-guide-to-choosing-an-ai-agent-framework-in-2025)
- [CrewAI vs LangGraph vs AutoGen](https://www.datacamp.com/tutorial/crewai-vs-langgraph-vs-autogen)

### UX Patterns
- [Agentic Design Patterns](https://agentic-design.ai/patterns/ui-ux-patterns)
- [Microsoft UX Design for Agents](https://microsoft.design/articles/ux-design-for-agents/)
- [Shape of AI - UX Patterns](https://www.shapeof.ai)

### Voice
- [OpenAI Realtime API](https://platform.openai.com/docs/guides/realtime)
- [Voice Agents Guide](https://platform.openai.com/docs/guides/voice-agents)

### RAG
- [RAG Architectures 2025](https://humanloop.com/blog/rag-architectures)
- [Enterprise Knowledge Base with RAG](https://xenoss.io/blog/enterprise-knowledge-base-llm-rag-architecture)

### Error Handling
- [Error Recovery in AI Agents](https://www.gocodeo.com/post/error-recovery-and-fallback-strategies-in-ai-agent-development)
- [7 Types of AI Agent Failure](https://galileo.ai/blog/prevent-ai-agent-failure)

### Models
- [Claude Sonnet 4.5 vs GPT-5](https://portkey.ai/blog/claude-sonnet-4-5-vs-gpt-5/)
- [API Pricing Comparison 2025](https://intuitionlabs.ai/articles/llm-api-pricing-comparison-2025)

---

## Appendix: Quick Wins Checklist

Immediate changes that can be made today:

- [ ] Change `gpt-5.2` → `gpt-4o` in `ai.ts`
- [ ] Change `gpt-5.2-mini-tts` → `tts-1` in `ai.ts`
- [ ] Add `serviceName` allowlist validation in `agentTools.ts`
- [ ] Add `X-RateLimit-*` headers to AI endpoints
- [ ] Enable `store: true` in OpenAI API calls for caching
- [ ] Add try-catch with specific error types around all API calls
- [ ] Log token usage for cost tracking
