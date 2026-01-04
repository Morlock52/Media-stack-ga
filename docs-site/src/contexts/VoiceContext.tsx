/**
 * VoiceContext - Unified voice I/O for the entire application
 *
 * Provides a single voice interface that can be used by:
 * - AI Stack Guide (AIAssistant)
 * - Voice Setup Companion (VoiceCompanion)
 * - Any other component needing voice capabilities
 *
 * Features:
 * - Voice input via browser, server (Whisper), or WebRTC Realtime
 * - Voice output via OpenAI TTS or browser speech
 * - Shared state and configuration
 *
 * Simplified January 2026: OpenAI-only TTS provider
 */

import { createContext, useContext, useCallback, useEffect, useRef, useState, type ReactNode } from 'react'

// Voice logging utility
const VOICE_DEBUG = true // Set to false in production
const log = {
  info: (msg: string, ...args: unknown[]) => VOICE_DEBUG && console.log(`[Voice] ${msg}`, ...args),
  warn: (msg: string, ...args: unknown[]) => console.warn(`[Voice] ${msg}`, ...args),
  error: (msg: string, ...args: unknown[]) => console.error(`[Voice] ${msg}`, ...args),
  debug: (msg: string, ...args: unknown[]) => VOICE_DEBUG && console.debug(`[Voice] ${msg}`, ...args),
}

// Web Speech API type declarations (not included in all TS configs)
interface SpeechRecognitionResultAlternative {
  transcript: string
  confidence: number
}

interface SpeechRecognitionResult {
  readonly length: number
  item(index: number): SpeechRecognitionResultAlternative
  [index: number]: SpeechRecognitionResultAlternative
  isFinal: boolean
}

interface SpeechRecognitionResultList {
  readonly length: number
  item(index: number): SpeechRecognitionResult
  [index: number]: SpeechRecognitionResult
}

interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList
  resultIndex: number
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string
  message?: string
}

interface SpeechRecognition extends EventTarget {
  lang: string
  continuous: boolean
  interimResults: boolean
  onresult: ((event: SpeechRecognitionEvent) => void) | null
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null
  onend: (() => void) | null
  start(): void
  stop(): void
  abort(): void
}
import { buildControlServerUrl, controlServerAuthHeaders } from '../utils/controlServer'
import { useRealtimeVoice } from '../hooks/useRealtimeVoice'
import { useAudioMutex } from '../hooks/useAudioMutex'

export type VoiceInputMode = 'browser' | 'server' | 'realtime' | 'off'
export type VoiceOutputMode = 'openai' | 'browser' | 'off'
export type VoiceStatus = 'idle' | 'connecting' | 'listening' | 'thinking' | 'speaking' | 'error'

interface VoiceCapabilities {
  browserStt: boolean
  serverStt: boolean
  realtimeStt: boolean
  openaiTts: boolean
  browserTts: boolean
}

interface VoiceContextValue {
  // Status
  status: VoiceStatus
  error: string | null
  isListening: boolean
  isSpeaking: boolean

  // Capabilities
  capabilities: VoiceCapabilities

  // Configuration
  inputMode: VoiceInputMode
  outputMode: VoiceOutputMode
  setInputMode: (mode: VoiceInputMode) => void
  setOutputMode: (mode: VoiceOutputMode) => void

  // Actions
  startListening: () => Promise<void>
  stopListening: () => void
  speak: (text: string) => Promise<void>
  stopSpeaking: () => void

  // Transcript
  partialTranscript: string

  // Callbacks
  onTranscript: (callback: (text: string) => void) => void
}

const VoiceContext = createContext<VoiceContextValue | null>(null)

export function useVoice() {
  const context = useContext(VoiceContext)
  if (!context) {
    throw new Error('useVoice must be used within a VoiceProvider')
  }
  return context
}

interface VoiceProviderProps {
  children: ReactNode
}

export function VoiceProvider({ children }: VoiceProviderProps) {
  const [status, setStatus] = useState<VoiceStatus>('idle')
  const [error, setError] = useState<string | null>(null)
  const [partialTranscript, setPartialTranscript] = useState('')

  const [inputMode, setInputMode] = useState<VoiceInputMode>('browser')
  const [outputMode, setOutputMode] = useState<VoiceOutputMode>('browser')

  const [capabilities, setCapabilities] = useState<VoiceCapabilities>({
    browserStt: false,
    serverStt: false,
    realtimeStt: false,
    openaiTts: false,
    browserTts: false,
  })

  const transcriptCallbackRef = useRef<((text: string) => void) | null>(null)
  const speechRecognitionRef = useRef<SpeechRecognition | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const hasInteractedRef = useRef(false)

  // Realtime voice hook
  const realtimeVoice = useRealtimeVoice({
    voice: 'cedar',
    onTranscript: (text, isFinal) => {
      if (isFinal) {
        setPartialTranscript('')
        transcriptCallbackRef.current?.(text)
      } else {
        setPartialTranscript(text)
      }
    },
    onStatusChange: (newStatus) => {
      if (newStatus === 'listening') setStatus('listening')
      else if (newStatus === 'processing') setStatus('thinking')
      else if (newStatus === 'speaking') setStatus('speaking')
      else if (newStatus === 'connected') setStatus('idle')
    },
    onError: (err) => setError(err),
  })

  // Audio mutex to prevent concurrent playback
  const audioMutex = useAudioMutex({
    onAcquire: () => log.debug('Audio mutex acquired'),
    onRelease: () => log.debug('Audio mutex released'),
    onWaiting: () => log.debug('Waiting for audio mutex...'),
    onForceStop: () => {
      log.info('Force stopping current audio playback')
      // Stop any playing audio
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current.currentTime = 0
      }
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel()
      }
    },
  })

  // Check capabilities on mount
  useEffect(() => {
    const checkCapabilities = async () => {
      log.info('Checking voice capabilities...')
      const caps: VoiceCapabilities = {
        browserStt: false,
        serverStt: false,
        realtimeStt: false,
        openaiTts: false,
        browserTts: false,
      }

      // Browser STT
      if (typeof window !== 'undefined') {
        const SpeechRecognitionCtor = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
        caps.browserStt = Boolean(SpeechRecognitionCtor)
        caps.browserTts = Boolean(window.speechSynthesis)
        log.debug('Browser capabilities:', { stt: caps.browserStt, tts: caps.browserTts })
      }

      // Server capabilities (OpenAI only)
      try {
        log.debug('Checking server capabilities...')
        const [sttRes, ttsRes] = await Promise.all([
          fetch(buildControlServerUrl('/api/settings/stt'), { headers: controlServerAuthHeaders() }),
          fetch(buildControlServerUrl('/api/settings/tts'), { headers: controlServerAuthHeaders() }),
        ])

        if (sttRes.ok) {
          const sttData = await sttRes.json()
          caps.serverStt = sttData.hasKey
          log.debug('Server STT available:', caps.serverStt)
        } else {
          log.warn('Server STT check failed:', sttRes.status)
        }

        if (ttsRes.ok) {
          const ttsData = await ttsRes.json()
          caps.openaiTts = ttsData.hasKey
          log.debug('Server TTS (OpenAI):', caps.openaiTts)
        } else {
          log.warn('Server TTS check failed:', ttsRes.status)
        }
      } catch (err) {
        log.warn('Server not available:', err)
      }

      // Realtime
      caps.realtimeStt = realtimeVoice.isAvailable ?? false
      log.debug('Realtime STT available:', caps.realtimeStt)

      setCapabilities(caps)
      log.info('Voice capabilities:', caps)

      // Auto-select best available modes
      // For input: prefer browser (real-time) over server (record-then-transcribe)
      // Only use realtime if available since it's also real-time
      if (caps.realtimeStt) {
        log.info('Auto-selecting REALTIME input mode (lowest latency)')
        setInputMode('realtime')
        setOutputMode('off') // Realtime handles its own output
      } else if (caps.browserStt) {
        // Browser mode gives real-time feedback - better for chat UX
        log.info('Auto-selecting BROWSER input mode (real-time feedback)')
        setInputMode('browser')
      } else if (caps.serverStt) {
        // Server mode requires stop to transcribe - fallback only
        log.info('Auto-selecting SERVER input mode (record-then-transcribe)')
        setInputMode('server')
      } else {
        log.warn('No voice input available!')
        setInputMode('off')
      }

      // For output: prefer OpenAI TTS over browser TTS
      if (caps.openaiTts) {
        log.info('Auto-selecting OpenAI TTS')
        setOutputMode('openai')
      } else if (caps.browserTts) {
        log.info('Using browser TTS (fallback)')
        setOutputMode('browser')
      }
    }

    checkCapabilities()
  }, [realtimeVoice.isAvailable])

  // Browser speech recognition
  const initBrowserSpeechRecognition = useCallback(() => {
    log.info('Initializing browser speech recognition...')

    if (typeof window === 'undefined') {
      log.error('Window not available (SSR?)')
      return null
    }

    const SpeechRecognitionCtor = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SpeechRecognitionCtor) {
      log.error('SpeechRecognition API not available in this browser')
      return null
    }

    try {
      const recognition = new SpeechRecognitionCtor()
      recognition.lang = 'en-US'
      recognition.continuous = true
      recognition.interimResults = true
      log.info('Speech recognition configured:', { lang: 'en-US', continuous: true, interimResults: true })

      recognition.onresult = (event: SpeechRecognitionEvent) => {
        let interim = ''
        let final = ''

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript
          const confidence = event.results[i][0].confidence
          if (event.results[i].isFinal) {
            final += transcript + ' '
            log.info(`FINAL transcript: "${transcript}" (confidence: ${(confidence * 100).toFixed(1)}%)`)
          } else {
            interim += transcript
          }
        }

        if (interim) {
          log.debug('Interim:', interim)
        }
        setPartialTranscript(interim)

        if (final.trim()) {
          log.info('>>> Sending final transcript to callback:', final.trim())
          if (transcriptCallbackRef.current) {
            log.info('Callback is registered, calling it now')
            try {
              transcriptCallbackRef.current(final.trim())
              log.info('Callback executed successfully')
            } catch (err) {
              log.error('Callback threw error:', err)
            }
          } else {
            log.warn('NO CALLBACK REGISTERED! Transcript lost:', final.trim())
          }
        }
      }

      recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
        log.error('Speech recognition error:', event.error, event.message)
        if (event.error === 'aborted') {
          log.debug('Recognition was aborted (normal on stop)')
          return
        }
        if (event.error === 'no-speech') {
          log.warn('No speech detected - try speaking louder or closer to mic')
          return
        }
        if (event.error === 'not-allowed') {
          log.error('Microphone permission denied!')
          setError('Microphone permission denied. Please allow microphone access.')
        } else {
          setError(`Speech error: ${event.error}`)
        }
        setStatus('error')
      }

      recognition.onstart = () => {
        log.info('Speech recognition STARTED - listening for speech...')
      }

      recognition.onspeechstart = () => {
        log.info('Speech DETECTED - user is talking')
      }

      recognition.onspeechend = () => {
        log.info('Speech ENDED - processing...')
      }

      recognition.onend = () => {
        log.debug('Recognition ended, status:', status, 'ref exists:', !!speechRecognitionRef.current)
        if (status === 'listening' && speechRecognitionRef.current) {
          log.debug('Restarting recognition (continuous mode)')
          try {
            recognition.start()
          } catch (err) {
            log.error('Failed to restart recognition:', err)
            setStatus('idle')
          }
        }
      }

      log.info('Browser speech recognition initialized successfully')
      return recognition
    } catch (err) {
      log.error('Failed to initialize speech recognition:', err)
      return null
    }
  }, [status])

  // Server transcription
  const transcribeWithServer = useCallback(async (audioBlob: Blob): Promise<string | null> => {
    log.info('Transcribing audio with server (Whisper)...')
    log.debug('Audio blob:', { size: audioBlob.size, type: audioBlob.type })

    try {
      const formData = new FormData()
      const mimeType = audioBlob.type.toLowerCase()
      const extension = mimeType.includes('webm') ? 'webm' :
                       mimeType.includes('mp4') ? 'mp4' :
                       mimeType.includes('ogg') ? 'ogg' : 'webm'

      formData.append('file', audioBlob, `audio.${extension}`)
      log.debug('Sending audio as:', `audio.${extension}`)

      const response = await fetch(buildControlServerUrl('/api/transcribe'), {
        method: 'POST',
        headers: controlServerAuthHeaders(),
        body: formData,
      })

      if (!response.ok) {
        log.error('Server transcription failed:', response.status, response.statusText)
        return null
      }

      const data = await response.json()
      log.info('Server transcription result:', data.text || '(empty)')
      return data.text || null
    } catch (err) {
      log.error('Server transcription error:', err)
      return null
    }
  }, [])

  // Start listening based on input mode
  const startListening = useCallback(async () => {
    log.info('=== START LISTENING ===')
    log.info('Input mode:', inputMode)
    log.info('Capabilities:', capabilities)
    log.info('Callback registered:', !!transcriptCallbackRef.current)
    setError(null)
    hasInteractedRef.current = true

    if (inputMode === 'off') {
      log.warn('Voice input is OFF')
      return
    }

    if (inputMode === 'realtime' && realtimeVoice.isAvailable) {
      log.info('Using REALTIME mode')
      setStatus('connecting')
      try {
        const connected = await realtimeVoice.connect()
        if (!connected) {
          log.error('Failed to connect to realtime voice')
          setError('Failed to connect to realtime voice')
          setStatus('error')
        }
      } catch (err) {
        log.error('Realtime connection error:', err)
        setError('Realtime connection failed')
        setStatus('error')
      }
      return
    }

    if (inputMode === 'server' && capabilities.serverStt) {
      log.info('Using SERVER STT mode (record then transcribe)')
      try {
        log.debug('Requesting microphone access...')
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true }
        })
        log.info('Microphone access granted')

        audioChunksRef.current = []
        const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
          ? 'audio/webm;codecs=opus'
          : 'audio/webm'

        const recorder = new MediaRecorder(stream, { mimeType })

        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) {
            audioChunksRef.current.push(e.data)
            log.debug('Audio chunk received:', e.data.size, 'bytes')
          }
        }

        recorder.onstop = async () => {
          log.info('Recording stopped, processing...')
          stream.getTracks().forEach(t => t.stop())

          if (audioChunksRef.current.length === 0) {
            log.warn('No audio data recorded - did you speak?')
            setStatus('idle')
            return
          }

          const blob = new Blob(audioChunksRef.current, { type: mimeType })
          log.info('Audio recorded:', blob.size, 'bytes in', audioChunksRef.current.length, 'chunks')
          setStatus('thinking')
          setPartialTranscript('Transcribing...')

          const text = await transcribeWithServer(blob)
          setPartialTranscript('')

          if (text) {
            log.info('>>> Sending server transcript to callback:', text)
            if (transcriptCallbackRef.current) {
              try {
                transcriptCallbackRef.current(text)
                log.info('Callback executed successfully')
              } catch (err) {
                log.error('Callback threw error:', err)
              }
            } else {
              log.warn('NO CALLBACK REGISTERED! Transcript lost:', text)
            }
          } else {
            log.warn('No text returned from transcription')
          }
          setStatus('idle')
        }

        recorder.onerror = (event) => {
          log.error('MediaRecorder error:', event)
          setError('Recording failed')
          setStatus('error')
        }

        mediaRecorderRef.current = recorder
        recorder.start()
        log.info('Recording started (server mode) - speak now!')
        setStatus('listening')
      } catch (err) {
        log.error('Failed to start server recording:', err)
        setError('Microphone access denied')
        setStatus('error')
      }
      return
    }

    // Browser speech recognition
    log.info('Using BROWSER speech recognition mode')
    if (!speechRecognitionRef.current) {
      log.debug('Initializing speech recognition instance...')
      speechRecognitionRef.current = initBrowserSpeechRecognition()
    }

    if (speechRecognitionRef.current) {
      try {
        log.debug('Requesting microphone permission...')
        await navigator.mediaDevices.getUserMedia({ audio: true })
          .then(s => {
            log.info('Microphone permission granted')
            s.getTracks().forEach(t => t.stop())
          })

        log.info('Starting speech recognition - speak now!')
        speechRecognitionRef.current.start()
        setStatus('listening')
      } catch (err) {
        log.error('Failed to get microphone permission:', err)
        setError('Microphone access denied')
        setStatus('error')
      }
    } else {
      log.error('Speech recognition not available in this browser')
      setError('Speech recognition not available in this browser')
      setStatus('error')
    }
  }, [inputMode, realtimeVoice, capabilities.serverStt, transcribeWithServer, initBrowserSpeechRecognition])

  // Stop listening
  const stopListening = useCallback(() => {
    log.info('=== STOP LISTENING ===')
    log.debug('Current input mode:', inputMode)

    if (inputMode === 'realtime') {
      log.info('Disconnecting realtime voice')
      realtimeVoice.disconnect()
    } else if (inputMode === 'server' && mediaRecorderRef.current) {
      log.info('Stopping server recording (will trigger transcription)')
      mediaRecorderRef.current.stop()
      mediaRecorderRef.current = null
    } else if (speechRecognitionRef.current) {
      log.info('Stopping browser speech recognition')
      speechRecognitionRef.current.stop()
    } else {
      log.debug('Nothing to stop')
    }

    setPartialTranscript('')
    setStatus('idle')
  }, [inputMode, realtimeVoice])

  // Speak text (with mutex to prevent overlapping audio)
  const speak = useCallback(async (text: string) => {
    if (outputMode === 'off') {
      log.debug('TTS is OFF, ignoring speak request')
      return
    }
    if (!text.trim()) {
      log.debug('Empty text, ignoring speak request')
      return
    }

    log.info('=== SPEAK ===')
    log.info('Text:', text.length > 50 ? text.slice(0, 50) + '...' : text)
    log.info('Output mode:', outputMode)
    log.info('Mutex locked:', audioMutex.isLocked())

    // Acquire mutex to prevent concurrent audio playback
    const release = await audioMutex.acquire()
    log.debug('Mutex acquired, starting TTS')

    try {
      hasInteractedRef.current = true

      // OpenAI TTS (server)
      if (outputMode === 'openai' && capabilities.openaiTts) {
        log.info('Using server TTS (OpenAI)')
        try {
          setStatus('speaking')

          const response = await fetch(buildControlServerUrl('/api/tts'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...controlServerAuthHeaders() },
            body: JSON.stringify({ text }),
          })

          if (response.ok) {
            log.debug('TTS audio received, playing...')
            const blob = await response.blob()
            const url = URL.createObjectURL(blob)

            const audio = audioRef.current || new Audio()
            audioRef.current = audio
            audio.src = url

            // Wait for audio to complete before releasing mutex
            await new Promise<void>((resolve, reject) => {
              audio.onended = () => {
                log.debug('Audio playback ended')
                URL.revokeObjectURL(url)
                setStatus('idle')
                resolve()
              }

              audio.onerror = (e) => {
                log.error('Audio playback error:', e)
                URL.revokeObjectURL(url)
                setStatus('idle')
                reject(new Error('Audio playback failed'))
              }

              audio.play().catch(reject)
            })

            log.info('Audio playback completed')
            return
          } else {
            log.warn('Server TTS failed:', response.status, response.statusText)
          }
        } catch (err) {
          log.warn('Server TTS error, falling back to browser:', err)
        }
      }

      // Browser TTS fallback
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        log.info('Using browser TTS (fallback)')
        const utterance = new SpeechSynthesisUtterance(text)
        utterance.lang = 'en-US'
        utterance.rate = 1.0

        // Wait for browser TTS to complete before releasing mutex
        await new Promise<void>((resolve) => {
          utterance.onstart = () => {
            log.debug('Browser TTS started')
            setStatus('speaking')
          }
          utterance.onend = () => {
            log.debug('Browser TTS ended')
            setStatus('idle')
            resolve()
          }
          utterance.onerror = (e) => {
            log.error('Browser TTS error:', e)
            setStatus('idle')
            resolve() // Resolve anyway to release mutex
          }

          window.speechSynthesis.speak(utterance)
        })
      } else {
        log.error('No TTS available!')
      }
    } finally {
      // ALWAYS release mutex when done (success or error)
      log.debug('Releasing audio mutex')
      release()
    }
  }, [outputMode, capabilities, audioMutex])

  // Stop speaking (force releases mutex to allow new audio)
  const stopSpeaking = useCallback(() => {
    log.info('=== STOP SPEAKING ===')

    if (audioRef.current) {
      log.debug('Stopping audio element')
      audioRef.current.pause()
      audioRef.current.currentTime = 0
    }

    if (typeof window !== 'undefined' && window.speechSynthesis) {
      log.debug('Canceling browser speech synthesis')
      window.speechSynthesis.cancel()
    }

    // Force release mutex to allow new audio immediately
    log.debug('Force releasing audio mutex')
    audioMutex.forceRelease()

    setStatus('idle')
  }, [audioMutex])

  // Register transcript callback
  const onTranscript = useCallback((callback: (text: string) => void) => {
    log.info('Registering transcript callback')
    transcriptCallbackRef.current = callback
    log.debug('Callback registered:', !!transcriptCallbackRef.current)
  }, [])

  // Log mode changes
  useEffect(() => {
    log.info('Input mode changed to:', inputMode)
  }, [inputMode])

  useEffect(() => {
    log.info('Output mode changed to:', outputMode)
  }, [outputMode])

  // Cleanup
  useEffect(() => {
    return () => {
      log.info('VoiceContext cleanup - stopping voice services')
      stopListening()
      stopSpeaking()
    }
  }, [stopListening, stopSpeaking])

  const value: VoiceContextValue = {
    status,
    error,
    isListening: status === 'listening',
    isSpeaking: status === 'speaking',
    capabilities,
    inputMode,
    outputMode,
    setInputMode,
    setOutputMode,
    startListening,
    stopListening,
    speak,
    stopSpeaking,
    partialTranscript,
    onTranscript,
  }

  return (
    <VoiceContext.Provider value={value}>
      {children}
    </VoiceContext.Provider>
  )
}
