# Voice Repair Guide - TTS Synchronization & Error Handling

**Created**: January 3, 2026
**Author**: Senior Developer Analysis
**Status**: Research Complete - Implementation Ready

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Current Implementation Analysis](#current-implementation-analysis)
3. [Identified Issues](#identified-issues)
4. [Research Findings](#research-findings)
5. [Recommended Solutions](#recommended-solutions)
6. [Implementation Guide](#implementation-guide)
7. [Error Handling Patterns](#error-handling-patterns)
8. [Audio Queue Management](#audio-queue-management)
9. [Testing Strategy](#testing-strategy)
10. [References](#references)

---

## Executive Summary

This document addresses voice/TTS timing synchronization issues where audio doesn't sync with text. It covers comprehensive error handling, locking mechanisms, and race condition prevention for the voice system.

### Key Problems to Solve

1. **Audio-Text Desync**: Audio playback not synchronized with displayed text
2. **Race Conditions**: Concurrent speak() calls causing overlapping audio
3. **State Management**: AudioContext states not properly managed
4. **Error Recovery**: Graceful degradation when voice services fail
5. **Queue Management**: Multiple audio chunks playing out of order

---

## Current Implementation Analysis

### Architecture Overview

The voice system consists of three main hooks:

```
VoiceContext.tsx (Main orchestrator)
├── useRealtimeVoice.ts (WebRTC-based OpenAI Realtime API)
├── useStreamingTts.ts (WebSocket-based ElevenLabs streaming)
└── Browser APIs (Web Speech API, SpeechSynthesis)
```

### Current Flow

```
User speaks → STT (3 modes) → Transcript callback → AI response → TTS (4 modes)
```

### Voice Modes Available

**Input (STT)**:
- `browser`: Web Speech API (real-time, no cost)
- `server`: Whisper API (record-then-transcribe)
- `realtime`: OpenAI Realtime WebRTC (lowest latency)
- `off`: Disabled

**Output (TTS)**:
- `openai`: OpenAI TTS API (gpt-4o-mini-tts)
- `elevenlabs`: ElevenLabs (streaming WebSocket or HTTP)
- `browser`: Web Speech Synthesis
- `off`: Disabled

### Current Issues in Code

#### 1. No Audio Queue Lock (VoiceContext.tsx:576-678)
```typescript
// speak() has no mutex - concurrent calls cause overlapping audio
const speak = useCallback(async (text: string) => {
  // No lock acquisition here!
  if (outputMode === 'off') return
  // ... audio playback starts immediately
})
```

#### 2. No Text-Audio Alignment (useStreamingTts.ts)
```typescript
// Audio chunks decoded but no timestamp alignment
const decodeAudioChunk = useCallback(async (base64Audio: string) => {
  // Missing: character/word timestamps for sync
  return await audioContext.decodeAudioData(bytes.buffer)
})
```

#### 3. AudioContext State Not Checked (useStreamingTts.ts:147-151)
```typescript
// Only checks 'suspended', misses 'closed' and 'interrupted'
if (audioContext.state === 'suspended') {
  await audioContext.resume()
}
// Should also handle: closed, interrupted (iOS Safari)
```

---

## Identified Issues

### Issue 1: Race Conditions in speak()

**Problem**: Multiple rapid speak() calls cause audio overlap.

**Current Code**:
```typescript
const speak = useCallback(async (text: string) => {
  // No protection against concurrent calls
  setStatus('speaking')
  const audio = new Audio()
  await audio.play()  // Can overlap with previous audio
})
```

**Impact**: Audio plays over itself, unintelligible output.

### Issue 2: Missing Word-Level Timestamps

**Problem**: Text highlighting can't sync with audio playback.

**ElevenLabs Response** (unused):
```json
{
  "audio": "base64...",
  "alignment": {
    "characters": ["H", "e", "l", "l", "o"],
    "character_start_times_seconds": [0.0, 0.1, 0.2, 0.3, 0.4],
    "character_end_times_seconds": [0.1, 0.2, 0.3, 0.4, 0.5]
  }
}
```

### Issue 3: AudioContext Lifecycle Issues

**Problem**: AudioContext can enter invalid states, causing silent failures.

**States to Handle**:
- `suspended`: Requires user interaction to resume
- `running`: Normal operation
- `closed`: Cannot be reopened, must create new
- `interrupted`: iOS Safari when backgrounded

### Issue 4: No Graceful Degradation

**Problem**: When primary TTS fails, fallback chain isn't reliable.

**Current Fallback Order**:
```
ElevenLabs Streaming → OpenAI/ElevenLabs HTTP → Browser Speech
```

**Missing**: Proper error handling at each level.

### Issue 5: Callback Lost on Unmount

**Problem**: Transcript callbacks can be lost if component unmounts during processing.

---

## Research Findings

### Best Practices from Industry (2025)

#### 1. TTS Timing Synchronization

From [ElevenLabs Documentation](https://elevenlabs.io/docs/api-reference/streaming-with-timestamps):
> "Character-level timing information allows you to synchronize text with audio playback. This is useful for subtitles or word-by-word highlighting."

**Implementation**: Request alignment data with TTS and use it to highlight text.

#### 2. AudioContext Management

From [MDN Web Audio Best Practices](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API/Best_practices):
> "Create one AudioContext and reuse it instead of initializing a new one each time."
> "Handle state changes with event listeners to respond appropriately."

**Key Pattern**:
```typescript
// Singleton AudioContext with state management
const getAudioContext = () => {
  if (!audioCtx || audioCtx.state === 'closed') {
    audioCtx = new AudioContext()
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume()
  }
  return audioCtx
}
```

#### 3. Mutex for Audio Operations

From [async-mutex npm](https://www.npmjs.com/package/async-mutex):
> "Locking the mutex will return a promise that resolves once the mutex becomes available."

**Key Pattern**:
```typescript
import { Mutex } from 'async-mutex'

const speakMutex = new Mutex()

const speak = async (text: string) => {
  const release = await speakMutex.acquire()
  try {
    await actuallySpeak(text)
  } finally {
    release()  // ALWAYS release in finally block
  }
}
```

#### 4. Audio Queue Pattern

From [DEV Community - Audio Queue](https://dev.to/amnish04/an-audio-player-hook-for-your-react-app-4gn9):
> "Make sure there was always only one instance of the audio queue throughout the application."

**Pattern**:
```typescript
interface AudioQueueItem {
  id: string
  text: string
  audioUrl?: string
  timestamps?: WordTimestamp[]
}

const audioQueue: AudioQueueItem[] = []
let isPlaying = false

const playNext = async () => {
  if (isPlaying || audioQueue.length === 0) return
  isPlaying = true
  const item = audioQueue.shift()!
  await playItem(item)
  isPlaying = false
  playNext()  // Process next item
}
```

#### 5. OpenAI TTS Recommendations

From [OpenAI TTS Documentation](https://platform.openai.com/docs/guides/text-to-speech):
> "For the fastest response times, wav or pcm formats are recommended."
> "The Speech API provides support for real time audio streaming using chunk transfer encoding."

**Latency Options**:
- `tts-1`: Optimized for speed (~250ms TTFB)
- `tts-1-hd`: Higher quality (~400ms TTFB)
- `gpt-4o-mini-tts`: Latest model, best balance

#### 6. ElevenLabs Streaming

From [ElevenLabs WebSocket Docs](https://elevenlabs.io/docs/api-reference/text-to-speech/v-1-text-to-speech-voice-id-stream-input):
> "The more text that is sent in a WebSocket connection, the better the audio quality."

**Optimization**: Send text in sentences, not words.

---

## Recommended Solutions

### Solution 1: Audio Mutex Lock

**File**: `docs-site/src/hooks/useAudioMutex.ts` (new)

```typescript
import { Mutex, MutexInterface } from 'async-mutex'

class AudioMutexManager {
  private mutex = new Mutex()
  private currentRelease: MutexInterface.Releaser | null = null

  async acquire(): Promise<MutexInterface.Releaser> {
    // If something is playing, stop it first
    if (this.currentRelease) {
      // Signal current playback to stop
    }

    const release = await this.mutex.acquire()
    this.currentRelease = release

    return () => {
      this.currentRelease = null
      release()
    }
  }

  isLocked(): boolean {
    return this.mutex.isLocked()
  }
}

export const audioMutex = new AudioMutexManager()
```

### Solution 2: Word-Level Timestamp Support

**File**: `docs-site/src/hooks/useStreamingTts.ts` (modify)

```typescript
interface TimestampedChunk {
  audio: AudioBuffer
  alignment?: {
    characters: string[]
    startTimes: number[]
    endTimes: number[]
  }
}

// Request timestamps in WebSocket config
ws.send(JSON.stringify({
  text: ' ',
  voice_settings: { stability: 0.5, similarity_boost: 0.75 },
  // ADD: Request alignment data
  output_format: 'mp3_44100_128',
  alignment: true,  // Request character timestamps
}))

// Handle alignment in message handler
ws.onmessage = async (event) => {
  const data = JSON.parse(event.data)

  if (data.audio) {
    const buffer = await decodeAudioChunk(data.audio)
    if (buffer) {
      // Store with alignment data
      audioQueueRef.current.push({
        audio: buffer,
        alignment: data.alignment || null,
      })
    }
  }
}
```

### Solution 3: Robust AudioContext Manager

**File**: `docs-site/src/hooks/useAudioContext.ts` (new)

```typescript
import { useCallback, useRef, useEffect } from 'react'

type AudioContextState = 'suspended' | 'running' | 'closed' | 'interrupted'

export function useAudioContext() {
  const contextRef = useRef<AudioContext | null>(null)
  const stateRef = useRef<AudioContextState>('suspended')

  const ensureContext = useCallback(async (): Promise<AudioContext> => {
    // Create if needed
    if (!contextRef.current || contextRef.current.state === 'closed') {
      contextRef.current = new AudioContext({ sampleRate: 44100 })
    }

    const ctx = contextRef.current

    // Handle all states
    if (ctx.state === 'suspended' || ctx.state === 'interrupted') {
      try {
        await ctx.resume()
      } catch (err) {
        console.warn('Failed to resume AudioContext:', err)
        // Create fresh context
        contextRef.current = new AudioContext({ sampleRate: 44100 })
        return contextRef.current
      }
    }

    return ctx
  }, [])

  // Listen for state changes
  useEffect(() => {
    const ctx = contextRef.current
    if (!ctx) return

    const handleStateChange = () => {
      stateRef.current = ctx.state as AudioContextState
      console.log('AudioContext state:', ctx.state)

      // iOS Safari: Handle interruption
      if (ctx.state === 'interrupted') {
        // Will auto-resume when user returns to page
        console.log('AudioContext interrupted (iOS background)')
      }
    }

    ctx.addEventListener('statechange', handleStateChange)
    return () => ctx.removeEventListener('statechange', handleStateChange)
  }, [])

  const close = useCallback(() => {
    if (contextRef.current) {
      contextRef.current.close()
      contextRef.current = null
    }
  }, [])

  return {
    ensureContext,
    close,
    getState: () => stateRef.current,
  }
}
```

### Solution 4: Enhanced Fallback Chain

**File**: `docs-site/src/contexts/VoiceContext.tsx` (modify speak function)

```typescript
const speak = useCallback(async (text: string) => {
  if (outputMode === 'off' || !text.trim()) return

  // Acquire mutex to prevent overlapping audio
  const release = await audioMutex.acquire()

  try {
    hasInteractedRef.current = true

    // Fallback chain with proper error handling
    const fallbackChain = [
      // Priority 1: Streaming (lowest latency)
      async () => {
        if (outputMode === 'elevenlabs' && streamingTts.isAvailable) {
          await streamingTts.speak(text)
          return true
        }
        return false
      },

      // Priority 2: Server TTS
      async () => {
        const provider = outputMode === 'elevenlabs' ? 'elevenlabs' : 'openai'
        if ((outputMode === 'openai' && capabilities.openaiTts) ||
            (outputMode === 'elevenlabs' && capabilities.elevenlabsTts)) {
          await speakWithServer(text, provider)
          return true
        }
        return false
      },

      // Priority 3: Browser TTS (always available)
      async () => {
        if (capabilities.browserTts) {
          await speakWithBrowser(text)
          return true
        }
        return false
      },
    ]

    setStatus('speaking')

    for (const attempt of fallbackChain) {
      try {
        const success = await attempt()
        if (success) return
      } catch (err) {
        log.warn('TTS attempt failed, trying fallback:', err)
        continue
      }
    }

    log.error('All TTS methods failed!')
    setError('Voice output unavailable')

  } finally {
    release()  // ALWAYS release mutex
    setStatus('idle')
  }
}, [outputMode, capabilities, streamingTts, audioMutex])
```

### Solution 5: Text-Audio Sync Component

**File**: `docs-site/src/components/SyncedAudioText.tsx` (new)

```typescript
import { useState, useEffect, useRef } from 'react'

interface WordTimestamp {
  word: string
  start: number
  end: number
}

interface SyncedAudioTextProps {
  text: string
  timestamps: WordTimestamp[]
  audioRef: React.RefObject<HTMLAudioElement>
  onWordHighlight?: (index: number) => void
}

export function SyncedAudioText({
  text,
  timestamps,
  audioRef,
  onWordHighlight
}: SyncedAudioTextProps) {
  const [currentWordIndex, setCurrentWordIndex] = useState(-1)
  const animationFrameRef = useRef<number>()

  useEffect(() => {
    const audio = audioRef.current
    if (!audio || timestamps.length === 0) return

    const updateHighlight = () => {
      const currentTime = audio.currentTime

      // Find current word based on timestamp
      const wordIndex = timestamps.findIndex(
        (ts, i) => currentTime >= ts.start &&
                   (i === timestamps.length - 1 || currentTime < timestamps[i + 1].start)
      )

      if (wordIndex !== currentWordIndex) {
        setCurrentWordIndex(wordIndex)
        onWordHighlight?.(wordIndex)
      }

      if (!audio.paused) {
        animationFrameRef.current = requestAnimationFrame(updateHighlight)
      }
    }

    audio.addEventListener('play', () => {
      animationFrameRef.current = requestAnimationFrame(updateHighlight)
    })

    audio.addEventListener('pause', () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
    })

    audio.addEventListener('ended', () => {
      setCurrentWordIndex(-1)
    })

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
    }
  }, [timestamps, audioRef, currentWordIndex, onWordHighlight])

  const words = text.split(/\s+/)

  return (
    <span className="synced-audio-text">
      {words.map((word, i) => (
        <span
          key={i}
          className={`
            transition-all duration-100
            ${i === currentWordIndex
              ? 'bg-matrix-green/30 text-matrix-green font-medium'
              : 'text-white/80'}
          `}
        >
          {word}{' '}
        </span>
      ))}
    </span>
  )
}
```

---

## Error Handling Patterns

### Pattern 1: Retry with Exponential Backoff

```typescript
async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  baseDelayMs = 1000
): Promise<T> {
  let lastError: Error | null = null

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn()
    } catch (err) {
      lastError = err as Error
      const delay = baseDelayMs * Math.pow(2, attempt)
      console.warn(`Attempt ${attempt + 1} failed, retrying in ${delay}ms`)
      await new Promise(r => setTimeout(r, delay))
    }
  }

  throw lastError
}
```

### Pattern 2: Timeout Wrapper

```typescript
async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  errorMessage = 'Operation timed out'
): Promise<T> {
  let timeoutId: NodeJS.Timeout

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(errorMessage)), timeoutMs)
  })

  try {
    return await Promise.race([promise, timeoutPromise])
  } finally {
    clearTimeout(timeoutId!)
  }
}
```

### Pattern 3: Error Boundary for Voice

```typescript
interface VoiceErrorBoundaryState {
  hasError: boolean
  error: Error | null
  fallbackMode: 'browser' | 'off'
}

class VoiceErrorBoundary extends Component<Props, VoiceErrorBoundaryState> {
  state = { hasError: false, error: null, fallbackMode: 'browser' as const }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error, fallbackMode: 'browser' }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Voice system error:', error, info)
    // Report to error tracking service
  }

  render() {
    if (this.state.hasError) {
      return (
        <VoiceContextFallback mode={this.state.fallbackMode}>
          {this.props.children}
        </VoiceContextFallback>
      )
    }
    return this.props.children
  }
}
```

---

## Audio Queue Management

### Queue Implementation

```typescript
interface QueuedAudio {
  id: string
  text: string
  priority: 'high' | 'normal' | 'low'
  audioBuffer?: AudioBuffer
  timestamps?: WordTimestamp[]
  status: 'pending' | 'loading' | 'ready' | 'playing' | 'done' | 'error'
  createdAt: number
}

class AudioQueueManager {
  private queue: QueuedAudio[] = []
  private isProcessing = false
  private currentItem: QueuedAudio | null = null
  private audioContext: AudioContext | null = null
  private onStatusChange?: (item: QueuedAudio) => void

  constructor(options?: { onStatusChange?: (item: QueuedAudio) => void }) {
    this.onStatusChange = options?.onStatusChange
  }

  enqueue(text: string, priority: 'high' | 'normal' | 'low' = 'normal'): string {
    const id = crypto.randomUUID()

    const item: QueuedAudio = {
      id,
      text,
      priority,
      status: 'pending',
      createdAt: Date.now(),
    }

    // Insert based on priority
    if (priority === 'high') {
      this.queue.unshift(item)
    } else {
      this.queue.push(item)
    }

    this.processNext()
    return id
  }

  async processNext() {
    if (this.isProcessing || this.queue.length === 0) return

    this.isProcessing = true
    this.currentItem = this.queue.shift()!

    try {
      // Update status
      this.currentItem.status = 'loading'
      this.onStatusChange?.(this.currentItem)

      // Fetch TTS audio
      const audioBuffer = await this.fetchAudio(this.currentItem.text)
      this.currentItem.audioBuffer = audioBuffer
      this.currentItem.status = 'ready'

      // Play audio
      this.currentItem.status = 'playing'
      this.onStatusChange?.(this.currentItem)
      await this.playBuffer(audioBuffer)

      this.currentItem.status = 'done'
      this.onStatusChange?.(this.currentItem)

    } catch (err) {
      if (this.currentItem) {
        this.currentItem.status = 'error'
        this.onStatusChange?.(this.currentItem)
      }
      console.error('Audio queue error:', err)
    } finally {
      this.currentItem = null
      this.isProcessing = false
      this.processNext()  // Process next item
    }
  }

  cancel(id: string) {
    const index = this.queue.findIndex(item => item.id === id)
    if (index !== -1) {
      this.queue.splice(index, 1)
    }
  }

  clear() {
    this.queue = []
    // Stop current audio if playing
    if (this.currentItem?.status === 'playing') {
      this.stopCurrent()
    }
  }

  private async fetchAudio(text: string): Promise<AudioBuffer> {
    // Implementation depends on TTS provider
    throw new Error('Not implemented')
  }

  private async playBuffer(buffer: AudioBuffer): Promise<void> {
    if (!this.audioContext) {
      this.audioContext = new AudioContext()
    }

    const source = this.audioContext.createBufferSource()
    source.buffer = buffer
    source.connect(this.audioContext.destination)

    return new Promise((resolve) => {
      source.onended = () => resolve()
      source.start()
    })
  }

  private stopCurrent() {
    // Implementation for stopping current playback
  }
}
```

---

## Testing Strategy

### Unit Tests

```typescript
// useAudioMutex.test.ts
describe('AudioMutex', () => {
  it('prevents concurrent speak calls', async () => {
    const mutex = new AudioMutexManager()
    const results: number[] = []

    const task = async (id: number) => {
      const release = await mutex.acquire()
      results.push(id)
      await new Promise(r => setTimeout(r, 100))
      release()
    }

    await Promise.all([task(1), task(2), task(3)])

    expect(results).toEqual([1, 2, 3])  // Sequential, not interleaved
  })

  it('releases lock even on error', async () => {
    const mutex = new AudioMutexManager()

    try {
      const release = await mutex.acquire()
      throw new Error('Test error')
    } catch {
      // Expected
    }

    // Should be able to acquire again
    const release2 = await mutex.acquire()
    expect(release2).toBeDefined()
    release2()
  })
})
```

### Integration Tests

```typescript
// VoiceContext.integration.test.ts
describe('VoiceContext Integration', () => {
  it('falls back to browser TTS when server fails', async () => {
    // Mock server failure
    vi.spyOn(global, 'fetch').mockRejectedValue(new Error('Server down'))

    const { result } = renderHook(() => useVoice())

    await act(async () => {
      await result.current.speak('Test message')
    })

    // Should have used browser TTS
    expect(window.speechSynthesis.speak).toHaveBeenCalled()
  })
})
```

### E2E Tests

```typescript
// voice.e2e.spec.ts
test('voice output completes without errors', async ({ page }) => {
  await page.goto('/')

  // Open AI assistant
  await page.getByTitle('Ask AI Assistant').click()

  // Type a message
  await page.getByPlaceholder(/Type a message/i).fill('Hello')
  await page.keyboard.press('Enter')

  // Wait for response with audio
  const response = page.locator('.whitespace-pre-wrap').nth(1)
  await expect(response).not.toHaveText('', { timeout: 15000 })

  // Check no console errors related to audio
  const audioErrors = await page.evaluate(() => {
    return (window as any).__audioErrors || []
  })
  expect(audioErrors).toHaveLength(0)
})
```

---

## Implementation Checklist

- [ ] Install `async-mutex` dependency: `npm install async-mutex`
- [ ] Create `useAudioMutex.ts` hook
- [ ] Create `useAudioContext.ts` hook with state management
- [ ] Update `speak()` in VoiceContext to use mutex
- [ ] Add word-level timestamp support to streaming TTS
- [ ] Create `SyncedAudioText` component for visual sync
- [ ] Implement proper fallback chain with error handling
- [ ] Add AudioContext state change listeners
- [ ] Handle iOS Safari `interrupted` state
- [ ] Add retry logic with exponential backoff
- [ ] Write unit tests for mutex behavior
- [ ] Write integration tests for fallback chain
- [ ] Update E2E tests for voice functionality

---

## References

### Official Documentation

- [MDN Web Audio API Best Practices](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API/Best_practices)
- [MDN AudioContext](https://developer.mozilla.org/en-US/docs/Web/API/AudioContext)
- [OpenAI TTS Documentation](https://platform.openai.com/docs/guides/text-to-speech)
- [OpenAI Realtime API](https://platform.openai.com/docs/guides/audio)
- [ElevenLabs Streaming with Timestamps](https://elevenlabs.io/docs/api-reference/streaming-with-timestamps)
- [ElevenLabs WebSocket API](https://elevenlabs.io/docs/api-reference/text-to-speech/v-1-text-to-speech-voice-id-stream-input)

### Libraries

- [async-mutex (npm)](https://www.npmjs.com/package/async-mutex)
- [async-mutex (GitHub)](https://github.com/DirtyHairy/async-mutex)

### Articles & Guides

- [JavaScript Mutex: Synchronizing Async Operations](https://blog.mayflower.de/6369-javascript-mutex-synchronizing-async-operations.html)
- [Real-Time Audio Streaming in React.js](https://medium.com/@sandeeplakhiwal/real-time-audio-streaming-in-react-js-handling-and-playing-live-audio-buffers-c72ec38c91fa)
- [Advanced Concurrency Patterns in JavaScript](https://medium.com/@artemkhrenov/advanced-concurrency-patterns-in-javascript-semaphore-mutex-read-write-lock-deadlock-prevention-79e8bffb5b81)

### Performance Benchmarks (2025)

| Provider | Model | TTFB | Quality |
|----------|-------|------|---------|
| Cartesia | Sonic-3 | 40-90ms | High |
| Speechmatics | Default | ~150ms | High |
| OpenAI | tts-1 | ~250ms | Good |
| OpenAI | gpt-4o-mini-tts | ~200ms | Best |
| ElevenLabs | Flash v2.5 | ~75ms | Excellent |
| Inworld | Default | <250ms | Good |

---

## Appendix: Full Code Examples

### Complete useAudioMutex Implementation

```typescript
// hooks/useAudioMutex.ts
import { Mutex, MutexInterface } from 'async-mutex'
import { useCallback, useRef } from 'react'

interface AudioMutexOptions {
  onAcquire?: () => void
  onRelease?: () => void
  onWaiting?: () => void
}

export function useAudioMutex(options: AudioMutexOptions = {}) {
  const mutexRef = useRef(new Mutex())
  const releaseRef = useRef<MutexInterface.Releaser | null>(null)

  const acquire = useCallback(async () => {
    if (mutexRef.current.isLocked()) {
      options.onWaiting?.()
    }

    const release = await mutexRef.current.acquire()
    releaseRef.current = release
    options.onAcquire?.()

    return () => {
      releaseRef.current = null
      options.onRelease?.()
      release()
    }
  }, [options])

  const forceRelease = useCallback(() => {
    if (releaseRef.current) {
      releaseRef.current()
      releaseRef.current = null
    }
  }, [])

  return {
    acquire,
    forceRelease,
    isLocked: () => mutexRef.current.isLocked(),
  }
}
```

---

*Document Version: 1.0*
*Last Updated: January 3, 2026*
