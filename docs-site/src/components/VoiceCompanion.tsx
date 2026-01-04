import { useCallback, useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Mic, StopCircle, Loader2, Sparkles, CheckCircle2, AlertTriangle, Send, Volume2, VolumeX, Settings2, Headphones, Zap, Radio, X } from 'lucide-react'
import { buildControlServerUrl, controlServerAuthHeaders } from '../utils/controlServer'
import { useControlServerTtsStatus } from '../hooks/useControlServerTtsStatus'
import { useRealtimeVoice } from '../hooks/useRealtimeVoice'
import { Button } from './ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip'

interface SttStatus {
  hasKey: boolean
  model: string
  fallbackModel: string
  supportedFormats: string[]
}

interface TranscriptItem {
  id: number
  type: 'user' | 'assistant' | 'system'
  content: string
  audioStatus?: 'loading' | 'playing' | 'done' | 'failed' | 'skipped'
}

export interface VoicePlanSummary {
  services: string[]
  hosting?: string
  storagePaths?: Record<string, string>
  domain?: string
  notes?: string
}

interface VoiceCompanionProps {
  isOpen: boolean
  onClose: () => void
  onApplyPlan: (plan: VoicePlanSummary) => void
  templateMode: 'newbie' | 'expert' | null
}

export function VoiceCompanion({ isOpen, onClose, onApplyPlan, templateMode }: VoiceCompanionProps) {
  const [isRecording, setIsRecording] = useState(false)
  const [transcriptItems, setTranscriptItems] = useState<TranscriptItem[]>([])
  const [status, setStatus] = useState<'idle' | 'connecting' | 'listening' | 'thinking' | 'loading_audio' | 'speaking'>('idle')
  const [plan, setPlan] = useState<VoicePlanSummary | null>(null)
  const [error, setError] = useState<string | null>(null)
  const speechRecognitionRef = useRef<any>(null)
  // Live "what I'm hearing" transcript (user speech + short status strings like "Transcribing…")
  const [partialTranscript, setPartialTranscript] = useState('')
  // Live assistant response (Realtime mode streams deltas)
  const [partialAssistantResponse, setPartialAssistantResponse] = useState('')
  const historyRef = useRef<{ role: 'user' | 'assistant'; content: string }[]>([])
  // Initialize speech support detection immediately
  const [isSpeechSupported, setIsSpeechSupported] = useState(() => {
    if (typeof window === 'undefined') return false
    const recognitionConstructor = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    return Boolean(recognitionConstructor)
  })
  const isRecordingRef = useRef(false)
  const processTranscriptRef = useRef<(text: string) => void>(() => { })
  const [manualInput, setManualInput] = useState('')
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const audioUrlRef = useRef<string | null>(null)
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([])
  const { openai } = useControlServerTtsStatus()
  const hasOpenAiTts = Boolean(openai?.hasKey)
  // Default to browser TTS - works without any API keys
  const [voiceOutput, setVoiceOutput] = useState<'openai' | 'browser' | 'off'>('browser')
  const [hasUserInteracted, setHasUserInteracted] = useState(false)
  const hasUserSetVoiceOutputRef = useRef(false)
  // Track if we've shown the "no API key" welcome message
  const hasShownNoApiKeyWelcomeRef = useRef(false)
  const transcriptIdRef = useRef(0)
  const currentAudioItemIdRef = useRef<number | null>(null)
  const transcriptEndRef = useRef<HTMLDivElement>(null)
  const hasShownAiFallbackNoticeRef = useRef(false)

  // Server-side STT - default to browser (works without API keys)
  const [sttStatus, setSttStatus] = useState<SttStatus | null>(null)
  const [voiceInput, setVoiceInput] = useState<'server' | 'browser' | 'realtime'>('browser')
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const hasUserSetVoiceInputRef = useRef(false)
  // Track if we should auto-upgrade to server STT when available
  const hasCheckedSttRef = useRef(false)

  // Ref to hold partialAssistantResponse for use in callbacks (avoids stale closure)
  const partialAssistantResponseRef = useRef(partialAssistantResponse)
  useEffect(() => {
    partialAssistantResponseRef.current = partialAssistantResponse
  }, [partialAssistantResponse])

  // Helper to add a transcript item (defined early for use in hooks)
  const addTranscriptItemInternal = useCallback((type: TranscriptItem['type'], content: string, audioStatus?: TranscriptItem['audioStatus']) => {
    const id = ++transcriptIdRef.current
    setTranscriptItems(prev => [...prev, { id, type, content, audioStatus }])
    // Auto-scroll to bottom
    setTimeout(() => transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
    return id
  }, [])

  // WebRTC Realtime Voice (lowest latency ~200ms voice-to-voice)
  const realtimeVoice = useRealtimeVoice({
    voice: 'cedar',
    onTranscript: (text, isFinal) => {
      if (isFinal) {
        setPartialTranscript('')
        addTranscriptItemInternal('user', text)
        historyRef.current = [...historyRef.current, { role: 'user', content: text }]
      } else {
        setPartialTranscript(text)
      }
    },
    onResponse: (text) => {
      // Streaming response from assistant
      setPartialAssistantResponse(prev => prev + text)
    },
    onAudioStart: () => {
      setStatus('speaking')
    },
    onAudioEnd: () => {
      // Finalize the streamed response using ref to get latest value.
      // Keep this separate from the live user transcript so we don't mix roles.
      const currentPartial = partialAssistantResponseRef.current
      if (currentPartial) {
        addTranscriptItemInternal('assistant', currentPartial, 'done')
        historyRef.current = [...historyRef.current, { role: 'assistant', content: currentPartial }]
        setPartialAssistantResponse('')
      }
      setStatus('listening')
    },
    onError: (err) => {
      setError(err)
    },
    onStatusChange: (newStatus) => {
      if (newStatus === 'connecting') setStatus('connecting')
      else if (newStatus === 'listening') setStatus('listening')
      else if (newStatus === 'processing') setStatus('thinking')
      else if (newStatus === 'speaking') setStatus('speaking')
      else if (newStatus === 'connected') setStatus('idle')
      else if (newStatus === 'disconnected') setStatus('idle')
      else if (newStatus === 'error') setStatus('idle')
    },
  })

  // Fetch STT status on mount - but don't auto-upgrade away from browser
  useEffect(() => {
    const fetchSttStatus = async () => {
      if (hasCheckedSttRef.current) return
      hasCheckedSttRef.current = true

      try {
        const response = await fetch(buildControlServerUrl('/api/settings/stt'), {
          headers: controlServerAuthHeaders(),
        })
        if (response.ok) {
          const data = await response.json()
          setSttStatus(data)
          // Only auto-select server STT if user explicitly hasn't chosen browser
          // and server has a valid key - this keeps browser as the reliable default
          if (data.hasKey && !hasUserSetVoiceInputRef.current && voiceInput === 'browser') {
            // Optionally upgrade to server for better accuracy
            // But don't force it - browser works without API keys
            // setVoiceInput('server')
          }
        }
      } catch {
        // Server STT not available - browser mode will work fine
        setSttStatus(null)
      }
    }
    fetchSttStatus()
  }, [voiceInput])

  useEffect(() => {
    if (!hasOpenAiTts && voiceOutput === 'openai') setVoiceOutput('browser')

    if (!hasUserSetVoiceOutputRef.current && voiceOutput === 'browser') {
      if (hasOpenAiTts) setVoiceOutput('openai')
    }
  }, [hasOpenAiTts, voiceOutput])

  const handleVoiceOutputChange = useCallback((value: 'openai' | 'browser' | 'off') => {
    hasUserSetVoiceOutputRef.current = true
    setVoiceOutput(value)
  }, [])

  const handleVoiceInputChange = useCallback((value: 'server' | 'browser' | 'realtime') => {
    hasUserSetVoiceInputRef.current = true
    setVoiceInput(value)

    // If switching to realtime, connect immediately
    if (value === 'realtime' && realtimeVoice.isAvailable && !realtimeVoice.isConnected) {
      void realtimeVoice.connect()
    }
    // If switching away from realtime, disconnect
    if (value !== 'realtime' && realtimeVoice.isConnected) {
      realtimeVoice.disconnect()
    }
  }, [realtimeVoice])

  // Server-side transcription function - returns { text, error } for better error handling
  const transcribeWithServer = useCallback(async (audioBlob: Blob): Promise<{ text: string | null; error?: string }> => {
    try {
      const formData = new FormData()
      const mimeType = (audioBlob.type || '').toLowerCase()
      const extension =
        mimeType.includes('mp4') || mimeType.includes('m4a') ? 'mp4'
          : mimeType.includes('mpeg') || mimeType.includes('mp3') ? 'mp3'
            : mimeType.includes('wav') ? 'wav'
              : mimeType.includes('ogg') ? 'ogg'
                : mimeType.includes('webm') ? 'webm'
                  : 'webm'

      // IMPORTANT: match the filename extension to the recorded mime type.
      // The control server uses the filename extension to set the upstream OpenAI
      // `file` content-type. A mismatch (e.g. Safari `audio/mp4` uploaded as
      // `audio.webm`) can cause OpenAI STT to reject the file as an invalid format.
      formData.append('file', audioBlob, `audio.${extension}`)

      const response = await fetch(buildControlServerUrl('/api/transcribe'), {
        method: 'POST',
        headers: controlServerAuthHeaders(),
        body: formData,
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        console.warn('Server transcription failed:', response.status, errorData)

        // Return user-friendly error messages based on reason
        if (errorData.reason === 'invalid_api_key') {
          return { text: null, error: 'OpenAI API key is invalid. Please check Settings.' }
        }
        if (errorData.reason === 'rate_limited') {
          return { text: null, error: 'Rate limit reached. Please wait a moment and try again.' }
        }
        if (errorData.reason === 'audio_too_short') {
          return { text: null, error: 'Recording was too short. Please speak for at least 1 second.' }
        }
        if (errorData.reason === 'invalid_format') {
          return { text: null, error: 'Audio format not supported. Try using browser voice input.' }
        }
        return { text: null, error: errorData.error || 'Transcription failed. Try again or switch to browser voice input.' }
      }

      const data = await response.json()
      return { text: data.text || null }
    } catch (err) {
      console.error('Server transcription error:', err)
      return { text: null, error: 'Network error. Check your connection and try again.' }
    }
  }, [])

  // Start recording for server-side transcription with high quality settings
  const startServerRecording = useCallback(async () => {
    try {
      // Request high-quality audio for better transcription accuracy
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 48000, // Higher sample rate for better quality
          channelCount: 1, // Mono is better for speech recognition
        }
      })
      audioChunksRef.current = []

      // Try codecs in order of quality for transcription
      // webm/opus is best for speech, then mp4/aac
      const mimeTypes = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/mp4',
        'audio/ogg;codecs=opus',
      ]
      const supportedMime = mimeTypes.find(mime => MediaRecorder.isTypeSupported(mime)) || 'audio/webm'

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: supportedMime,
        audioBitsPerSecond: 128000, // 128kbps for high quality speech
      })

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data)
        }
      }

      mediaRecorder.onstop = async () => {
        // Stop all tracks
        stream.getTracks().forEach(track => track.stop())

        if (audioChunksRef.current.length === 0) {
          setError('No audio recorded. Please try again.')
          setStatus('idle')
          return
        }

        const audioBlob = new Blob(audioChunksRef.current, { type: mediaRecorder.mimeType })
        setStatus('thinking')
        setPartialTranscript('Transcribing...')

        const result = await transcribeWithServer(audioBlob)
        setPartialTranscript('')

        if (result.text) {
          processTranscriptRef.current(result.text)
        } else {
          setError(result.error || 'Transcription failed. Try again or switch to browser voice input.')
          setStatus('idle')
        }
      }

      mediaRecorderRef.current = mediaRecorder
      mediaRecorder.start()
      setStatus('listening')
      setIsRecording(true)
      isRecordingRef.current = true
      setHasUserInteracted(true)
      setError(null)
    } catch (err: any) {
      console.error('Media recording error:', err)
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setError('Microphone access denied. Please allow microphone permissions.')
      } else {
        setError(`Recording error: ${err.message || err.name}`)
      }
    }
  }, [transcribeWithServer])

  const stopServerRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop()
    }
    isRecordingRef.current = false
    setIsRecording(false)
  }, [])

  const getSpeechSupportError = useCallback((): string | null => {
    if (typeof window === 'undefined') return 'Voice recognition is unavailable in this environment.'

    const recognitionConstructor = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!recognitionConstructor) {
      return 'Voice recognition is not supported in this browser. Please use Chrome desktop or type below.'
    }

    // SpeechRecognition is generally restricted to secure contexts (https) with localhost exceptions.
    // Preview proxies and some browsers may still report "network" failures; we treat that as unavailable.
    const hostname = window.location.hostname
    const isLocal = hostname === 'localhost' || hostname === '127.0.0.1'
    if (!window.isSecureContext && !isLocal) {
      return 'Voice recognition requires a secure context (HTTPS). Please use the deployed site over HTTPS or use text input.'
    }

    return null
  }, [])

  // Check if any voice input method is available (browser, server, or realtime)
  const isAnyVoiceInputAvailable = useCallback((): boolean => {
    // Server STT is available if we have an API key
    if (sttStatus?.hasKey) return true
    // Realtime voice is available
    if (realtimeVoice.isAvailable) return true
    // Browser speech recognition is available
    if (isSpeechSupported) return true
    // Check if browser speech could work (constructor exists)
    if (typeof window !== 'undefined') {
      const recognitionConstructor = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
      if (recognitionConstructor) return true
    }
    return false
  }, [sttStatus?.hasKey, realtimeVoice.isAvailable, isSpeechSupported])

  const statusMessages: Record<typeof status, string> = {
    idle: 'Ready to help',
    connecting: 'Connecting...',
    listening: 'Listening... speak now',
    thinking: 'Thinking...',
    loading_audio: 'Preparing voice response...',
    speaking: 'Speaking...',
  }

  // Alias for addTranscriptItemInternal (defined earlier for use in hooks)
  const addTranscriptItem = addTranscriptItemInternal

  // Helper to update audio status of a transcript item
  const updateTranscriptAudioStatus = useCallback((id: number, audioStatus: TranscriptItem['audioStatus']) => {
    setTranscriptItems(prev => prev.map(item =>
      item.id === id ? { ...item, audioStatus } : item
    ))
  }, [])

  const stopSpeaking = useCallback(() => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel()
    }
    const audio = audioRef.current
    if (audio) {
      audio.pause()
      audio.currentTime = 0
    }
    if (audioUrlRef.current) {
      URL.revokeObjectURL(audioUrlRef.current)
      audioUrlRef.current = null
    }
  }, [])

  const pickBestBrowserVoice = useCallback((voices: SpeechSynthesisVoice[]) => {
    const english = voices.filter(v => (v.lang || '').toLowerCase().startsWith('en'))
    const candidates = english.length ? english : voices

    const preferred = [
      /google.*(us|en).*(english)/i,
      /microsoft.*(natural|online)/i,
      /\bsamantha\b/i,
      /\balex\b/i,
      /\bava\b/i,
      /\bkaren\b/i,
    ]

    for (const pattern of preferred) {
      const match = candidates.find(v => pattern.test(v.name))
      if (match) return match
    }

    const defaultVoice = candidates.find(v => v.default)
    return defaultVoice || candidates[0]
  }, [])

  // Speak function that handles audio loading with proper status updates
  const speak = useCallback((text: string, itemId?: number) => {
    void (async () => {
      stopSpeaking()

      // If voice is off, mark as skipped
      if (voiceOutput === 'off') {
        if (itemId) updateTranscriptAudioStatus(itemId, 'skipped')
        setStatus('idle')
        return
      }

      const trimmed = text.trim()
      if (!trimmed) {
        if (itemId) updateTranscriptAudioStatus(itemId, 'skipped')
        setStatus('idle')
        return
      }

      const useRemoteTts = voiceOutput === 'openai' && hasOpenAiTts

      if (useRemoteTts && hasUserInteracted) {
        try {
          // Show loading state while fetching audio
          setStatus('loading_audio')
          if (itemId) {
            updateTranscriptAudioStatus(itemId, 'loading')
            currentAudioItemIdRef.current = itemId
          }

          const response = await fetch(buildControlServerUrl('/api/tts'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...controlServerAuthHeaders() },
            body: JSON.stringify({
              text: trimmed,
              provider: 'openai',
            }),
          })

          if (!response.ok) {
            let reason: string | null = null
            try {
              const body = await response.json()
              reason = typeof body?.reason === 'string' ? body.reason : null
            } catch {
              reason = null
            }

            if (response.status === 401 || reason === 'invalid_api_key') {
              setError('OpenAI key invalid; using browser voice.')
              handleVoiceOutputChange('browser')
              if (itemId) updateTranscriptAudioStatus(itemId, 'failed')
              throw new Error('invalid_api_key')
            }

            if (response.status === 429 || reason === 'rate_limited') {
              setError('OpenAI rate limited; using browser voice.')
              handleVoiceOutputChange('browser')
              if (itemId) updateTranscriptAudioStatus(itemId, 'failed')
              throw new Error('rate_limited')
            }

            if (itemId) updateTranscriptAudioStatus(itemId, 'failed')
            setError('Voice service unavailable; using browser voice.')
            handleVoiceOutputChange('browser')
            throw new Error('tts_failed')
          }

          const blob = await response.blob()
          const url = URL.createObjectURL(blob)
          audioUrlRef.current = url

          const audio = audioRef.current || new Audio()
          audioRef.current = audio
          audio.src = url

          // Update status when audio actually starts playing
          audio.onplay = () => {
            setStatus('speaking')
            if (itemId) updateTranscriptAudioStatus(itemId, 'playing')
          }

          audio.onended = () => {
            if (itemId) updateTranscriptAudioStatus(itemId, 'done')
            currentAudioItemIdRef.current = null
            if (isRecordingRef.current) setStatus('listening')
            else setStatus('idle')
          }

          audio.onerror = () => {
            if (itemId) updateTranscriptAudioStatus(itemId, 'failed')
            currentAudioItemIdRef.current = null
            setStatus('idle')
          }

          await audio.play()
          return
        } catch (e) {
          if (e instanceof Error && (e.message === 'invalid_api_key' || e.message === 'rate_limited' || e.message === 'tts_failed')) {
            // Already handled - fall through to browser TTS
          } else {
            console.warn('Remote TTS failed; falling back to browser TTS:', e)
            if (itemId) updateTranscriptAudioStatus(itemId, 'failed')
          }
        }
      }

      // Browser TTS fallback
      if (typeof window === 'undefined' || !window.speechSynthesis) {
        if (itemId) updateTranscriptAudioStatus(itemId, 'skipped')
        setStatus('idle')
        return
      }

      const utterance = new SpeechSynthesisUtterance(trimmed)
      utterance.lang = 'en-US'
      utterance.rate = 1.0
      utterance.pitch = 1.0

      const voices = availableVoices.length ? availableVoices : window.speechSynthesis.getVoices()
      const bestVoice = pickBestBrowserVoice(voices)
      if (bestVoice) utterance.voice = bestVoice

      utterance.onstart = () => {
        setStatus('speaking')
        if (itemId) updateTranscriptAudioStatus(itemId, 'playing')
      }
      utterance.onend = () => {
        if (itemId) updateTranscriptAudioStatus(itemId, 'done')
        if (isRecordingRef.current) setStatus('listening')
        else setStatus('idle')
      }
      utterance.onerror = () => {
        if (itemId) updateTranscriptAudioStatus(itemId, 'failed')
        setStatus('idle')
      }

      try {
        if (itemId) updateTranscriptAudioStatus(itemId, 'loading')
        window.speechSynthesis.speak(utterance)
      } catch (e) {
        console.warn('Speech synthesis failed:', e)
        if (itemId) updateTranscriptAudioStatus(itemId, 'failed')
        setStatus('idle')
      }
    })()
  }, [availableVoices, hasOpenAiTts, hasUserInteracted, handleVoiceOutputChange, pickBestBrowserVoice, stopSpeaking, updateTranscriptAudioStatus, voiceOutput])

  // Pre-load voices (some browsers load them async)
  useEffect(() => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return

    const update = () => {
      try {
        setAvailableVoices(window.speechSynthesis.getVoices())
      } catch {
        // ignore
      }
    }

    update()
    window.speechSynthesis.addEventListener('voiceschanged', update)
    return () => window.speechSynthesis.removeEventListener('voiceschanged', update)
  }, [])

  useEffect(() => {
    return () => {
      stopSpeaking()
    }
  }, [stopSpeaking])

  const stopRecognition = useCallback((options?: { maintainStatus?: boolean }) => {
    if (speechRecognitionRef.current) {
      try {
        speechRecognitionRef.current.stop()
      } catch (err) {
        console.warn('Failed to stop speech recognition:', err)
      }
    }
    isRecordingRef.current = false
    setIsRecording(false)
    if (!options?.maintainStatus) {
      setStatus('idle')
    }
  }, [])

  const noSpeechRetryCountRef = useRef(0)
  const maxNoSpeechRetries = 3

  const initializeSpeechRecognition = useCallback(() => {
    if (typeof window === 'undefined') return
    const supportError = getSpeechSupportError()
    if (supportError) {
      setIsSpeechSupported(false)
      speechRecognitionRef.current = null
      setError((prev) => prev ?? supportError)
      return
    }

    const recognitionConstructor = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition

    setIsSpeechSupported(true)
    const recognition = new recognitionConstructor()
    recognition.lang = 'en-US'
    recognition.continuous = true  // Keep listening until explicitly stopped
    recognition.interimResults = true

    recognition.onresult = (event: any) => {
      // Reset retry count on successful speech detection
      noSpeechRetryCountRef.current = 0
      console.log('[VoiceCompanion] Speech result received, processing...')

      let interim = ''
      let finalText = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcriptPiece = event.results[i][0].transcript
        if (event.results[i].isFinal) {
          finalText += transcriptPiece + ' '
          console.log('[VoiceCompanion] Final transcript:', transcriptPiece)
        } else {
          interim += transcriptPiece
        }
      }
      setPartialTranscript(interim)
      if (finalText.trim()) {
        console.log('[VoiceCompanion] Processing final text:', finalText.trim())
        processTranscriptRef.current(finalText.trim())
      }
    }

    recognition.onerror = (event: any) => {
      if (event.error === 'aborted') return

      const errorMessages: Record<string, string> = {
        'not-allowed': 'Microphone access denied. Please allow microphone permissions or use text input.',
        'no-speech': 'No speech detected yet. Keep speaking or type your message below.',
        'network': 'Speech service unavailable. Please check your connection or use the text input below.',
        'audio-capture': 'No microphone found. Please connect a microphone or use text input.',
      }

      console.warn('Speech recognition error:', event.error)

      // For 'no-speech', auto-restart up to a limit
      if (event.error === 'no-speech') {
        noSpeechRetryCountRef.current++
        if (noSpeechRetryCountRef.current < maxNoSpeechRetries && isRecordingRef.current) {
          // Don't show error, just silently restart
          console.log(`No speech detected, restarting... (attempt ${noSpeechRetryCountRef.current}/${maxNoSpeechRetries})`)
          try {
            recognition.start()
          } catch {
            // May already be running
          }
          return
        }
        // After max retries, show a gentler message
        setError('No speech detected. Click the microphone button to try again, or type your message below.')
        stopRecognition()
        return
      }

      const msg = errorMessages[event.error] || `Speech error: ${event.error}`
      setError(prev => prev === errorMessages['network'] ? prev : msg)

      // If the browser reports a "network" error, SpeechRecognition is effectively unavailable
      if (event.error === 'network') {
        setIsSpeechSupported(false)
        speechRecognitionRef.current = null
      }

      stopRecognition()
    }

    recognition.onend = () => {
      // If we're still supposed to be recording, restart (browser may stop due to silence)
      if (isRecordingRef.current && speechRecognitionRef.current) {
        try {
          console.log('Recognition ended, restarting...')
          recognition.start()
        } catch (e) {
          console.warn('Could not restart recognition:', e)
          isRecordingRef.current = false
          setIsRecording(false)
          setStatus('idle')
        }
      } else {
        isRecordingRef.current = false
        setIsRecording(false)
        setStatus('idle')
      }
    }

    speechRecognitionRef.current = recognition
  }, [getSpeechSupportError, stopRecognition])

  const startRecognition = useCallback(async () => {
    if (isRecordingRef.current) return

    // Request microphone permission first
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      // Stop the stream immediately - we just needed to trigger permission
      stream.getTracks().forEach(track => track.stop())
    } catch (permErr: any) {
      console.error('Microphone permission error:', permErr)
      if (permErr.name === 'NotAllowedError' || permErr.name === 'PermissionDeniedError') {
        setError('Microphone access denied. Please allow microphone permissions in your browser settings, or use the text input below.')
      } else if (permErr.name === 'NotFoundError') {
        setError('No microphone found. Please connect a microphone or use the text input below.')
      } else {
        setError(`Microphone error: ${permErr.message || permErr.name}. Please use the text input below.`)
      }
      return
    }

    if (!speechRecognitionRef.current) {
      initializeSpeechRecognition()
    }

    if (!speechRecognitionRef.current) {
      const supportError = getSpeechSupportError()
      setError(supportError || 'Voice recognition is not available right now. Please use text input.')
      return
    }

    try {
      setHasUserInteracted(true)
      setError(null)
      setStatus('listening')
      setPartialTranscript('')
      setIsRecording(true)
      isRecordingRef.current = true
      noSpeechRetryCountRef.current = 0  // Reset retry count
      console.log('[VoiceCompanion] Starting browser speech recognition...')
      speechRecognitionRef.current.start()
      console.log('[VoiceCompanion] Browser speech recognition started successfully')
    } catch (err: any) {
      console.error('Failed to start speech recognition:', err)
      isRecordingRef.current = false
      setIsRecording(false)
      setStatus('idle')

      if (err.message?.includes('already started')) {
        // Already running, try stopping and restarting
        try {
          speechRecognitionRef.current.stop()
          setTimeout(() => startRecognition(), 300)
        } catch {
          setError('Voice recognition busy. Please wait a moment and try again.')
        }
      } else {
        setError('Microphone initialization failed. Please try again or use text input below.')
        // Force re-init
        initializeSpeechRecognition()
      }
    }
  }, [getSpeechSupportError, initializeSpeechRecognition])

  useEffect(() => {
    initializeSpeechRecognition()
    return () => {
      if (speechRecognitionRef.current) {
        try {
          // Nullify handlers to prevent state updates after unmount
          speechRecognitionRef.current.onresult = null
          speechRecognitionRef.current.onerror = null
          speechRecognitionRef.current.onend = null
          speechRecognitionRef.current.stop()
        } catch (err) {
          console.warn('Voice companion cleanup error:', err)
        }
      }
    }
  }, [initializeSpeechRecognition])

  useEffect(() => {
    if (isOpen && transcriptItems.length === 0) {
      // Show different greeting based on whether API keys are configured
      const hasAnyApiKey = hasOpenAiTts || sttStatus?.hasKey
      let greeting: string

      if (!hasAnyApiKey && !hasShownNoApiKeyWelcomeRef.current) {
        greeting = "Hi! I'm your media stack assistant. I'm running in offline mode with browser voice, which works great for setup help. Ask me about Plex, Sonarr, or any service you want to configure!"
        hasShownNoApiKeyWelcomeRef.current = true
      } else if (templateMode === 'newbie') {
        greeting = "Hi! I'm your voice guide. Tell me about your media setup goals."
      } else {
        greeting = "Voice assistant ready. How can I help with your media stack?"
      }

      const itemId = addTranscriptItem('system', greeting, 'loading')
      speak(greeting, itemId)
    }
  }, [addTranscriptItem, isOpen, templateMode, transcriptItems.length, speak, hasOpenAiTts, sttStatus?.hasKey])

  const stopRecording = useCallback(() => {
    if (voiceInput === 'realtime') {
      realtimeVoice.disconnect()
      isRecordingRef.current = false
      setIsRecording(false)
      setPartialTranscript('')
      setPartialAssistantResponse('')
      setStatus('idle')
      return
    }
    if (voiceInput === 'server' && sttStatus?.hasKey) {
      stopServerRecording()
    } else {
      stopRecognition()
    }
  }, [realtimeVoice, setPartialTranscript, stopRecognition, stopServerRecording, sttStatus?.hasKey, voiceInput])

  const startRecordingUnified = useCallback(async () => {
    setHasUserInteracted(true)
    setError(null)

    // Realtime mode - connect via WebRTC (lowest latency)
    if (voiceInput === 'realtime' && realtimeVoice.isAvailable) {
      if (!realtimeVoice.isConnected) {
        setStatus('connecting')
        setIsRecording(true)
        isRecordingRef.current = true
        const connected = await realtimeVoice.connect()
        if (connected) {
          return
        }
        isRecordingRef.current = false
        setIsRecording(false)
        console.warn('Realtime voice connection failed, falling back to other input modes')
        // Fall through to other methods
      } else {
        setIsRecording(true)
        isRecordingRef.current = true
        return
      }
    }

    // Server STT mode - OpenAI Whisper (high accuracy)
    if (voiceInput === 'server' && sttStatus?.hasKey) {
      try {
        await startServerRecording()
        return
      } catch (err) {
        console.warn('Server recording failed, falling back to browser:', err)
        // Fall through to browser speech
      }
    }

    // Browser speech recognition (fallback, works in Chrome)
    // Initialize if not already done
    if (!speechRecognitionRef.current) {
      initializeSpeechRecognition()
    }

    // Try browser speech recognition
    try {
      await startRecognition()
    } catch (err) {
      console.error('All voice input methods failed:', err)
      setError('Voice input unavailable. Please type your message below.')
    }
  }, [voiceInput, sttStatus?.hasKey, startServerRecording, startRecognition, realtimeVoice, initializeSpeechRecognition])

  const sendTranscriptToServer = useCallback(async (content: string, updatedHistory: { role: 'user' | 'assistant'; content: string }[]) => {
    try {
      console.log('[VoiceCompanion] Sending transcript to server:', content)
      setStatus('thinking')
      const url = buildControlServerUrl('/api/voice-agent')
      console.log('[VoiceCompanion] API URL:', url)
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...controlServerAuthHeaders() },
        body: JSON.stringify({
          transcript: content,
          history: updatedHistory,
        }),
      })
      console.log('[VoiceCompanion] Server response status:', response.status)

      if (!response.ok) {
        throw new Error('Voice agent failed to respond')
      }

      const data = await response.json()

      // Surface why the assistant may feel "dumber" than expected.
      // The control server returns a fallback response when OpenAI isn't configured
      // or is erroring; show a one-time, non-blocking notice in the transcript.
      const meta = data?.meta as { usedFallback?: boolean; reason?: string; openaiStatus?: number } | undefined
      if (meta?.usedFallback && !hasShownAiFallbackNoticeRef.current) {
        const reason = meta.reason || 'unknown'
        const statusSuffix = typeof meta.openaiStatus === 'number' ? ` (HTTP ${meta.openaiStatus})` : ''

        if (reason === 'missing_api_key') {
          addTranscriptItem('system', 'Heads up: OpenAI isn’t configured on the control server, so I’m using fallback responses. Open Settings → OpenAI Key to enable full AI + high-accuracy STT/TTS.', 'skipped')
          hasShownAiFallbackNoticeRef.current = true
        } else if (reason === 'invalid_api_key') {
          addTranscriptItem('system', `Heads up: the OpenAI key on the control server appears invalid${statusSuffix}. Update it in Settings → OpenAI Key.`, 'skipped')
          hasShownAiFallbackNoticeRef.current = true
        } else if (reason === 'rate_limited') {
          addTranscriptItem('system', `Heads up: OpenAI is rate limiting requests${statusSuffix}. Wait a moment or switch to browser voice.`, 'skipped')
          hasShownAiFallbackNoticeRef.current = true
        }
      }

      if (data.agentResponse) {
        // Add assistant message with loading audio status
        const itemId = addTranscriptItem('assistant', data.agentResponse, voiceOutput === 'off' ? 'skipped' : 'loading')
        // Start speaking and pass the item ID for status updates
        speak(data.agentResponse, itemId)
        const withAssistant = [...updatedHistory, { role: 'assistant', content: data.agentResponse } as const]
        historyRef.current = withAssistant
      } else {
        // No response, just go idle
        setStatus('idle')
      }

      if (data.plan) {
        setPlan(data.plan)
        setStatus('idle')
        stopRecognition()
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unexpected error')
      setStatus('idle')
    }
  }, [addTranscriptItem, speak, stopRecognition, voiceOutput])

  useEffect(() => {
    processTranscriptRef.current = (userContent: string) => {
      stopRecognition({ maintainStatus: true })
      // Add user message to transcript
      addTranscriptItem('user', userContent)
      const updatedHistory = [...historyRef.current, { role: 'user', content: userContent } as const]
      historyRef.current = updatedHistory
      sendTranscriptToServer(userContent, updatedHistory)
    }
  }, [addTranscriptItem, sendTranscriptToServer, stopRecognition])

  const handleApplyPlan = () => {
    if (plan) {
      onApplyPlan(plan)
      onClose()
    }
  }

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!manualInput.trim()) return
    const text = manualInput.trim()
    setManualInput('')
    setHasUserInteracted(true)
    setError(null)
    processTranscriptRef.current(text)
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            className="relative w-full max-w-4xl h-[85vh] bg-card border border-border rounded-3xl shadow-2xl overflow-hidden flex flex-col"
          >
            {/* Close button */}
            <button
              type="button"
              onClick={onClose}
              className="absolute top-4 right-4 z-20 p-2 rounded-full bg-muted/60 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Close voice companion"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex flex-col md:flex-row flex-1 min-h-0 overflow-hidden">
              {/* Left Panel - Status & Controls */}
              <div className="md:w-[45%] p-5 md:p-6 bg-gradient-to-br from-emerald-500/5 via-cyan-500/5 to-lime-500/5 border-b md:border-b-0 md:border-r border-border flex flex-col min-h-0 max-h-[45vh] md:max-h-full overflow-y-auto shrink-0 md:shrink">
                {/* Header */}
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-r from-emerald-500 via-cyan-500 to-lime-400 flex items-center justify-center shadow-lg shadow-emerald-500/20">
                    <Mic className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-foreground">Voice Setup Guide</h3>
                    <p className="text-xs text-muted-foreground">
                      Speak or type to configure your media stack
                    </p>
                  </div>
                </div>

                {/* Status Card - Primary Focus */}
                <div className="p-4 rounded-xl bg-card/50 border border-border mb-4">
                  <div className="flex items-center gap-4">
                    {/* Animated status indicator */}
                    {status === 'idle' && (
                      <div className="w-12 h-12 rounded-full bg-muted/40 flex items-center justify-center border-2 border-muted">
                        <Mic className="w-6 h-6 text-muted-foreground" />
                      </div>
                    )}
                    {status === 'connecting' && (
                      <motion.div
                        animate={{ opacity: [0.6, 1, 0.6] }}
                        transition={{ duration: 1.2, repeat: Infinity }}
                        className="w-12 h-12 rounded-full bg-purple-500/20 flex items-center justify-center border-2 border-purple-500/30"
                      >
                        <Loader2 className="w-6 h-6 text-purple-400 animate-spin" />
                      </motion.div>
                    )}
                    {status === 'listening' && (
                      <motion.div
                        animate={{ scale: [1, 1.1, 1], boxShadow: ['0 0 0 0 rgba(16, 185, 129, 0)', '0 0 0 8px rgba(16, 185, 129, 0.2)', '0 0 0 0 rgba(16, 185, 129, 0)'] }}
                        transition={{ duration: 1.5, repeat: Infinity }}
                        className="w-12 h-12 rounded-full bg-emerald-500 flex items-center justify-center"
                      >
                        <Mic className="w-6 h-6 text-white" />
                      </motion.div>
                    )}
                    {status === 'thinking' && (
                      <div className="w-12 h-12 rounded-full bg-cyan-500/20 flex items-center justify-center border-2 border-cyan-500/30">
                        <Loader2 className="w-6 h-6 text-cyan-400 animate-spin" />
                      </div>
                    )}
                    {status === 'loading_audio' && (
                      <motion.div
                        animate={{ opacity: [0.6, 1, 0.6] }}
                        transition={{ duration: 1.2, repeat: Infinity }}
                        className="w-12 h-12 rounded-full bg-purple-500/20 flex items-center justify-center border-2 border-purple-500/30"
                      >
                        <Volume2 className="w-6 h-6 text-purple-400" />
                      </motion.div>
                    )}
                    {status === 'speaking' && (
                      <motion.div
                        animate={{ scale: [1, 1.05, 1] }}
                        transition={{ duration: 0.4, repeat: Infinity }}
                        className="w-12 h-12 rounded-full bg-emerald-500 flex items-center justify-center"
                      >
                        <Volume2 className="w-6 h-6 text-white" />
                      </motion.div>
                    )}
                    <div className="flex-1">
                      <p className={`text-lg font-semibold ${
                        status === 'connecting' ? 'text-purple-400' :
                        status === 'listening' ? 'text-emerald-400' :
                        status === 'thinking' ? 'text-cyan-400' :
                        status === 'loading_audio' ? 'text-purple-400' :
                        status === 'speaking' ? 'text-emerald-400' :
                        'text-foreground'
                      }`}>
                        {statusMessages[status]}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {status === 'connecting' ? 'Establishing a voice session...' :
                         status === 'listening' ? 'Your words appear in the chat' :
                         status === 'thinking' ? 'Processing your request...' :
                         status === 'loading_audio' ? 'Preparing audio response...' :
                         status === 'speaking' ? 'Playing response...' :
                         'Click Start Speaking or type below'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Error display */}
                {error && (
                  <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/30">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <p className="text-sm text-red-400">{error}</p>
                        <button
                          type="button"
                          onClick={() => {
                            setError(null)
                            initializeSpeechRecognition()
                          }}
                          className="mt-2 text-xs text-red-300 hover:text-red-200 underline"
                        >
                          Try again
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex gap-2 mb-4">
                  {!isAnyVoiceInputAvailable() && (
                    <p className="text-xs text-yellow-400 mb-2 flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" />
                      Voice unavailable - use Chrome or type below
                    </p>
                  )}
                  <TooltipProvider>
                    {!isRecording ? (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="gradient"
                            size="lg"
                            onClick={startRecordingUnified}
                            disabled={!isAnyVoiceInputAvailable() || status === 'connecting'}
                            className="flex-1 rounded-xl h-12"
                          >
                            <Mic className="w-5 h-5" />
                            Start Speaking
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>
                            {voiceInput === 'realtime' ? 'Realtime voice (WebRTC)' :
                             voiceInput === 'server' ? 'OpenAI Whisper transcription' :
                             'Browser speech recognition'}
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    ) : (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="destructive"
                            size="lg"
                            onClick={stopRecording}
                            className="flex-1 rounded-xl h-12"
                          >
                            <StopCircle className="w-5 h-5" />
                            Stop
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Stop recording</p>
                        </TooltipContent>
                      </Tooltip>
                    )}
                  </TooltipProvider>
                </div>

                {/* Voice Settings - Compact */}
                <details className="group rounded-xl bg-muted/20 border border-border overflow-hidden">
                  <summary className="flex items-center gap-2 p-3 cursor-pointer hover:bg-muted/30 transition-colors list-none">
                    <Settings2 className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm font-medium text-foreground">Voice Settings</span>
                    <span className="ml-auto text-xs text-muted-foreground group-open:rotate-180 transition-transform">▼</span>
                  </summary>
                  <div className="p-3 pt-0 space-y-3 border-t border-border/50">
                    {/* Input selector */}
                    <div className="flex items-center justify-between">
                      <label className="text-xs text-muted-foreground flex items-center gap-1.5">
                        <Mic className="w-3.5 h-3.5" /> Input
                      </label>
                      <select
                        value={voiceInput}
                        onChange={(e) => handleVoiceInputChange(e.target.value as 'server' | 'browser' | 'realtime')}
                        className="text-xs bg-background border border-border rounded-lg px-2 py-1.5 text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
                        aria-label="Voice input mode"
                      >
                        <option value="browser">Browser</option>
                        <option value="server" disabled={!sttStatus?.hasKey}>OpenAI</option>
                        <option value="realtime" disabled={!realtimeVoice.isAvailable}>Realtime</option>
                      </select>
                    </div>

                    {/* Output selector */}
                    <div className="flex items-center justify-between">
                      <label className="text-xs text-muted-foreground flex items-center gap-1.5">
                        <Headphones className="w-3.5 h-3.5" /> Output
                      </label>
                      <select
                        value={voiceOutput}
                        onChange={(e) => handleVoiceOutputChange(e.target.value as 'openai' | 'browser' | 'off')}
                        className="text-xs bg-background border border-border rounded-lg px-2 py-1.5 text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
                        aria-label="Voice output mode"
                        disabled={voiceInput === 'realtime'}
                      >
                        <option value="off">Off</option>
                        <option value="browser">Browser</option>
                        <option value="openai" disabled={!hasOpenAiTts}>OpenAI</option>
                      </select>
                    </div>

                    {/* Status indicators */}
                    {voiceInput === 'realtime' && realtimeVoice.isAvailable && (
                      <div className="flex items-center gap-2 p-2 rounded-lg bg-purple-500/10 text-purple-400">
                        <Radio className="w-3.5 h-3.5" />
                        <span className="text-xs">
                          {realtimeVoice.status === 'connecting'
                            ? 'Connecting...'
                            : realtimeVoice.isConnected
                              ? 'Connected'
                              : 'Ready'}
                        </span>
                        {realtimeVoice.status === 'connecting' && <Loader2 className="w-3 h-3 ml-auto animate-spin" />}
                        {realtimeVoice.isConnected && realtimeVoice.status !== 'connecting' && <Zap className="w-3 h-3 ml-auto" />}
                      </div>
                    )}
                    {voiceInput === 'server' && sttStatus?.hasKey && (
                      <div className="flex items-center gap-2 p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span className="text-xs">High accuracy mode</span>
                      </div>
                    )}
                  </div>
                </details>

                {/* Quick tips - only on desktop */}
                <div className="hidden md:block mt-auto pt-4">
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    <strong>Tips:</strong> Mention services like Plex, Sonarr, or Radarr. Tell me your hosting preference (NAS, VPS, etc).
                  </p>
                </div>
              </div>

              {/* Right Panel - Transcript & Input */}
              <div className="md:w-[55%] flex flex-col bg-card min-h-0 flex-1 overflow-hidden">
                {/* Transcript Area - scrollable */}
                <div className="flex-1 min-h-0 p-4 md:p-5 space-y-3 overflow-y-auto overflow-x-hidden">
                  <p className="text-xs uppercase tracking-widest text-muted-foreground sticky top-0 bg-card pb-2 z-10">Conversation</p>
                  <div className="space-y-3 text-sm">
                    {transcriptItems.map((item) => (
                      <motion.div
                        key={item.id}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.2 }}
                        className={`p-3 rounded-xl ${
                          item.type === 'assistant' || item.type === 'system'
                            ? 'bg-gradient-to-br from-emerald-500/10 to-cyan-500/10 border border-emerald-500/20 mr-6'
                            : 'bg-muted/50 border border-border ml-6'
                        }`}
                      >
                        <div className="flex items-start gap-2.5">
                          {/* Avatar */}
                          <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
                            item.type === 'user'
                              ? 'bg-muted text-muted-foreground'
                              : 'bg-emerald-500/20 text-emerald-400'
                          }`}>
                            {item.type === 'user' ? (
                              <Mic className="w-3.5 h-3.5" />
                            ) : (
                              <Sparkles className="w-3.5 h-3.5" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-foreground leading-relaxed">{item.content}</p>
                            {/* Audio status - compact inline display */}
                            {(item.type === 'assistant' || item.type === 'system') && item.audioStatus && item.audioStatus !== 'done' && item.audioStatus !== 'skipped' && (
                              <div className="mt-1.5 flex items-center gap-1.5">
                                {item.audioStatus === 'loading' && (
                                  <>
                                    <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />
                                    <span className="text-[11px] text-muted-foreground">Loading audio...</span>
                                  </>
                                )}
                                {item.audioStatus === 'playing' && (
                                  <>
                                    <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ duration: 0.6, repeat: Infinity }}>
                                      <Volume2 className="w-3.5 h-3.5 text-emerald-400" />
                                    </motion.div>
                                    <span className="text-[11px] text-emerald-400">Playing...</span>
                                  </>
                                )}
                                {item.audioStatus === 'failed' && (
                                  <>
                                    <VolumeX className="w-3 h-3 text-amber-400" />
                                    <span className="text-[11px] text-amber-400">Audio unavailable</span>
                                  </>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </motion.div>
                    ))}

                    {/* Live assistant response (Realtime mode) */}
                    {partialAssistantResponse && (
                      <motion.div
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="p-3 rounded-xl bg-gradient-to-br from-emerald-500/10 to-cyan-500/10 border border-emerald-500/20 mr-6"
                      >
                        <div className="flex items-start gap-2.5">
                          <motion.div
                            animate={{ opacity: [0.6, 1, 0.6] }}
                            transition={{ duration: 0.9, repeat: Infinity }}
                            className="w-7 h-7 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0"
                          >
                            <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                          </motion.div>
                          <div className="flex-1 min-w-0">
                            <p className="text-foreground leading-relaxed">
                              {partialAssistantResponse}
                              <motion.span
                                animate={{ opacity: [1, 0] }}
                                transition={{ duration: 0.5, repeat: Infinity }}
                                className="text-cyan-400 ml-0.5"
                              >
                                |
                              </motion.span>
                            </p>
                            <p className="text-[11px] text-cyan-400/70 mt-1">Responding...</p>
                          </div>
                        </div>
                      </motion.div>
                    )}

                    {/* Live transcription indicator - what user is saying */}
                    {partialTranscript && (
                      <motion.div
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="p-3 rounded-xl bg-emerald-500/5 border border-dashed border-emerald-500/40 ml-6"
                      >
                        <div className="flex items-start gap-2.5">
                          <motion.div
                            animate={{ scale: [1, 1.15, 1] }}
                            transition={{ duration: 0.8, repeat: Infinity }}
                            className="w-7 h-7 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0"
                          >
                            <Mic className="w-3.5 h-3.5 text-emerald-400" />
                          </motion.div>
                          <div className="flex-1 min-w-0">
                            <p className="text-foreground leading-relaxed">
                              {partialTranscript}
                              <motion.span
                                animate={{ opacity: [1, 0] }}
                                transition={{ duration: 0.5, repeat: Infinity }}
                                className="text-emerald-400 ml-0.5"
                              >
                                |
                              </motion.span>
                            </p>
                            <p className="text-[11px] text-emerald-400/70 mt-1">Listening...</p>
                          </div>
                        </div>
                      </motion.div>
                    )}

                    {/* Auto-scroll anchor */}
                    <div ref={transcriptEndRef} />
                  </div>
                </div>

                {/* Input Area - fixed at bottom */}
                <div className="p-3 border-t border-border bg-muted/20 flex-shrink-0">
                  <form onSubmit={handleManualSubmit} className="flex gap-2">
                    <input
                      type="text"
                      value={manualInput}
                      onChange={(e) => setManualInput(e.target.value)}
                      placeholder={
                        isRecording ? "Listening..." :
                        status === 'connecting' ? "Connecting..." :
                        status === 'thinking' ? "Processing..." :
                        status === 'loading_audio' || status === 'speaking' ? "Playing..." :
                        "Type a message..."
                      }
                      disabled={isRecording || status === 'connecting' || status === 'thinking' || status === 'speaking' || status === 'loading_audio'}
                      className="flex-1 bg-background border border-border rounded-lg px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 transition disabled:opacity-50"
                    />
                    <button
                      type="submit"
                      disabled={!manualInput.trim() || status === 'connecting' || status === 'thinking' || status === 'loading_audio'}
                      aria-label="Send message"
                      title="Send message"
                      className="bg-primary hover:bg-primary/90 text-primary-foreground p-2.5 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
                    >
                      <Send className="w-4 h-4" />
                    </button>
                  </form>
                </div>

                {/* Plan Area - shows when plan is ready */}
                {plan ? (
                  <div className="p-3 border-t border-emerald-500/30 bg-gradient-to-r from-emerald-500/10 to-cyan-500/10 flex-shrink-0">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                        <div>
                          <p className="text-sm font-medium text-emerald-400">Plan Ready</p>
                          <p className="text-[11px] text-muted-foreground">{plan.services.length} services selected</p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setPlan(null)}
                          className="rounded-lg text-xs"
                        >
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          onClick={handleApplyPlan}
                          className="rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-xs"
                        >
                          Apply Plan
                        </Button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="py-2 px-3 border-t border-border/50 flex-shrink-0">
                    <p className="text-[11px] text-muted-foreground text-center flex items-center justify-center gap-1.5">
                      <Sparkles className="w-3 h-3" />
                      Tell me what services you need, and I'll create a setup plan
                    </p>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
