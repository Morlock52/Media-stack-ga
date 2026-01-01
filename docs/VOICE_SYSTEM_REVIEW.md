# Voice System Architecture Review - January 2026

## Executive Summary

After comprehensive research of the latest OpenAI and ElevenLabs APIs (as of January 2026), I've identified several opportunities to modernize the voice system for significantly improved performance, lower latency, and better user experience.

## Current Architecture Analysis

### What You Have Now

1. **Speech-to-Text (STT)**
   - Primary: `gpt-4o-transcribe` via REST API (file upload)
   - Fallback: `whisper-1`
   - Method: Record audio blob → Upload to server → Server calls OpenAI → Return text
   - **Latency**: ~2-4 seconds (recording + upload + API call)

2. **Text-to-Speech (TTS)**
   - Primary: `gpt-4o-mini-tts` (OpenAI)
   - Alternative: ElevenLabs `eleven_multilingual_v2`
   - Fallback: Browser SpeechSynthesis
   - Method: Fetch entire audio file → Play
   - **Latency**: ~1-3 seconds (API call + full download)

3. **Voice Conversation Flow**
   - Sequential: Record → Transcribe → Send to AI → Get response → TTS → Play
   - Total round-trip: **5-10 seconds** minimum

4. **Realtime API**
   - Exists in `realtimeVoice.ts` but **not connected to frontend**
   - Uses WebSocket (should use WebRTC for production)
   - Model: `gpt-4o-realtime-preview` (outdated - should use GA version)

## Critical Issues Identified

### 1. Not Using Streaming/Realtime for Voice
**Current**: Sequential REST calls
**Problem**: High latency, poor conversational experience
**Solution**: Use OpenAI Realtime API with WebRTC or streaming TTS

### 2. Outdated Model References
- Using `gpt-4o-realtime-preview` (preview suffix)
- Should use `gpt-4o-realtime-preview-2024-12-17` or latest GA

### 3. Missing ElevenLabs Flash v2.5
**Current**: Using `eleven_multilingual_v2`
**Better**: `eleven_flash_v2_5` for 75ms latency (vs ~300ms)

### 4. No WebRTC Integration
**Current**: WebSocket-only Realtime API setup
**Problem**: OpenAI recommends WebRTC for browser apps for lower latency
**Quote from OpenAI**: "WebSockets shouldn't be used in production for client-server, real-time media connections"

### 5. No Streaming TTS
**Current**: Download entire audio file before playing
**Better**: Stream audio chunks as they're generated

### 6. Missing Semantic VAD
**Current**: Basic server_vad with fixed thresholds
**Better**: Use `semantic_vad` mode for more natural turn-taking

### 7. No Realtime Transcription Mode
OpenAI now offers dedicated transcription sessions separate from conversation sessions

## Recommended Architecture (2026 Best Practices)

### Tier 1: Low-Latency Streaming (Recommended)

```
┌─────────────────────────────────────────────────────────────┐
│                        BROWSER                               │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────┐    WebRTC/WebSocket    ┌───────────────┐  │
│  │ Microphone  │ ───────────────────────→ OpenAI        │  │
│  │             │                         │ Realtime API  │  │
│  │ Speaker     │ ←─────────────────────── (streaming)   │  │
│  └─────────────┘                         └───────────────┘  │
│                                                              │
│  OR for TTS-only streaming:                                  │
│  ┌─────────────┐    WebSocket           ┌───────────────┐  │
│  │ Text Input  │ ───────────────────────→ ElevenLabs    │  │
│  │             │                         │ Flash v2.5    │  │
│  │ Speaker     │ ←─────────────────────── (75ms TTFB)   │  │
│  └─────────────┘                         └───────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

**Target Latency**: ~200-500ms voice-to-voice

### Tier 2: Optimized REST (Fallback)

```
┌─────────────────────────────────────────────────────────────┐
│  1. gpt-4o-transcribe (streaming via HTTP if supported)     │
│  2. gpt-4o for response generation                          │
│  3. ElevenLabs Flash v2.5 WebSocket streaming TTS           │
│  4. Browser SpeechSynthesis as final fallback               │
└─────────────────────────────────────────────────────────────┘
```

**Target Latency**: ~1-2 seconds

## Specific Changes to Implement

### Phase 1: Immediate Fixes (Models & Configuration)

1. **Update ElevenLabs model** to `eleven_flash_v2_5` (75ms vs 300ms)
2. **Update Realtime API model** to GA version
3. **Add new OpenAI voices**: `marin`, `cedar` (highest quality)
4. **Fix API version header**: Use `2025-08-28` for latest features

### Phase 2: Streaming TTS

1. **Implement ElevenLabs WebSocket streaming** for real-time audio
2. **Add chunked audio playback** - start playing while still receiving
3. **Implement MediaSource API** for seamless streaming playback

### Phase 3: OpenAI Realtime Integration

1. **Implement WebRTC connection** for browser clients
2. **Add ephemeral key generation** endpoint for secure client auth
3. **Use semantic_vad** for better turn detection
4. **Add transcription-only session type** for STT
5. **Implement proper audio format handling** (PCM16 @ 24kHz)

### Phase 4: Hybrid Architecture

1. **Smart routing**: Use Realtime for conversations, REST for single interactions
2. **Graceful fallback chain**: Realtime → Streaming → REST → Browser
3. **Connection pooling** for WebSocket/WebRTC sessions

## Model Recommendations (January 2026)

| Use Case | Model | Notes |
|----------|-------|-------|
| STT (accuracy) | `gpt-4o-transcribe` | Lowest WER, best for most cases |
| STT (speed) | `gpt-4o-mini-transcribe-2025-12-15` | 89% fewer hallucinations than whisper-1 |
| STT (diarization) | `gpt-4o-transcribe-diarize` | For multi-speaker scenarios |
| TTS (quality) | `gpt-4o-mini-tts` | Voices: cedar, marin (best) |
| TTS (speed) | ElevenLabs `eleven_flash_v2_5` | 75ms TTFB |
| Realtime Voice | `gpt-4o-realtime-preview-2024-12-17` | Full voice-to-voice |
| Chat | `gpt-4o` | Main responses |

## ElevenLabs Configuration Updates

```typescript
// Current (outdated)
const ELEVENLABS_TTS_MODEL = 'eleven_multilingual_v2'; // ~300ms latency

// Recommended
const ELEVENLABS_TTS_MODEL = 'eleven_flash_v2_5';      // ~75ms latency
const ELEVENLABS_CHUNK_SCHEDULE = [120, 160, 250, 290]; // Optimal for streaming
```

## OpenAI Realtime Configuration Updates

```typescript
// Current (outdated)
const REALTIME_MODEL = 'gpt-4o-realtime-preview';

// Recommended
const REALTIME_MODEL = 'gpt-4o-realtime-preview-2024-12-17';
const REALTIME_API_VERSION = '2025-08-28';

// VAD Configuration
const turnDetection = {
  type: 'semantic_vad',  // Changed from 'server_vad'
  eagerness: 'medium',   // New parameter
  create_response: true,
};
```

## WebRTC Implementation (High Priority)

OpenAI explicitly recommends WebRTC for browser applications:

```typescript
// Ephemeral key generation endpoint (server-side)
app.post('/api/ai/realtime/ephemeral-key', async (req, res) => {
  const response = await fetch('https://api.openai.com/v1/realtime/sessions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-realtime-preview-2024-12-17',
      voice: 'cedar',
    }),
  });
  const { client_secret } = await response.json();
  res.json({ ephemeralKey: client_secret.value });
});

// Client-side WebRTC connection
const pc = new RTCPeerConnection();
const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
pc.addTrack(stream.getTracks()[0]);

const offer = await pc.createOffer();
await pc.setLocalDescription(offer);

// Send offer to OpenAI, get answer
const answer = await sendOfferToOpenAI(offer.sdp, ephemeralKey);
await pc.setRemoteDescription({ type: 'answer', sdp: answer });
```

## Priority Order

1. **CRITICAL**: Fix ElevenLabs model to Flash v2.5 (immediate 4x latency improvement)
2. **HIGH**: Implement streaming TTS with WebSocket
3. **HIGH**: Add WebRTC Realtime API option for voice conversations
4. **MEDIUM**: Add ephemeral key endpoint for secure client connections
5. **MEDIUM**: Implement semantic_vad for better turn detection
6. **LOW**: Add transcription-only Realtime sessions

## Sources

- [OpenAI Realtime API Guide](https://platform.openai.com/docs/guides/realtime)
- [OpenAI Realtime WebRTC Guide](https://platform.openai.com/docs/guides/realtime-webrtc)
- [OpenAI Speech-to-Text Guide](https://platform.openai.com/docs/guides/speech-to-text)
- [OpenAI Audio Models](https://platform.openai.com/docs/models/gpt-4o-transcribe)
- [ElevenLabs WebSocket Documentation](https://elevenlabs.io/docs/developers/websockets)
- [ElevenLabs Models Overview](https://elevenlabs.io/docs/overview/models)
- [ElevenLabs Latency Optimization](https://elevenlabs.io/docs/developers/best-practices/latency-optimization)
