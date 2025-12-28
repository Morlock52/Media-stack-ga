import { useCallback, useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Mic, StopCircle, Loader2, Sparkles, CheckCircle2, AlertTriangle, Send, Volume2, VolumeX, Settings2, Headphones } from 'lucide-react'
import { buildControlServerUrl, controlServerAuthHeaders } from '../utils/controlServer'
import { useControlServerTtsStatus } from '../hooks/useControlServerTtsStatus'
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
  const [status, setStatus] = useState<'idle' | 'listening' | 'thinking' | 'loading_audio' | 'speaking'>('idle')
  const [plan, setPlan] = useState<VoicePlanSummary | null>(null)
  const [error, setError] = useState<string | null>(null)
  const speechRecognitionRef = useRef<any>(null)
  const [partialTranscript, setPartialTranscript] = useState('')
  const historyRef = useRef<{ role: 'user' | 'assistant'; content: string }[]>([])
  const [isSpeechSupported, setIsSpeechSupported] = useState(false)
  const isRecordingRef = useRef(false)
  const processTranscriptRef = useRef<(text: string) => void>(() => { })
  const [manualInput, setManualInput] = useState('')
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const audioUrlRef = useRef<string | null>(null)
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([])
  const { openai, elevenlabs, defaultProvider } = useControlServerTtsStatus()
  const hasOpenAiTts = Boolean(openai?.hasKey)
  const hasElevenLabsTts = Boolean(elevenlabs?.hasKey)
  const [voiceOutput, setVoiceOutput] = useState<'openai' | 'elevenlabs' | 'browser' | 'off'>(() => 'browser')
  const [hasUserInteracted, setHasUserInteracted] = useState(false)
  const hasUserSetVoiceOutputRef = useRef(false)
  const transcriptIdRef = useRef(0)
  const currentAudioItemIdRef = useRef<number | null>(null)
  const transcriptEndRef = useRef<HTMLDivElement>(null)

  // Server-side STT
  const [sttStatus, setSttStatus] = useState<SttStatus | null>(null)
  const [voiceInput, setVoiceInput] = useState<'server' | 'browser'>('browser')
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const hasUserSetVoiceInputRef = useRef(false)

  // Fetch STT status on mount
  useEffect(() => {
    const fetchSttStatus = async () => {
      try {
        const response = await fetch(buildControlServerUrl('/api/settings/stt'), {
          headers: controlServerAuthHeaders(),
        })
        if (response.ok) {
          const data = await response.json()
          setSttStatus(data)
          // Auto-select server STT if available and user hasn't chosen
          if (data.hasKey && !hasUserSetVoiceInputRef.current) {
            setVoiceInput('server')
          }
        }
      } catch {
        // Server STT not available
      }
    }
    fetchSttStatus()
  }, [])

  useEffect(() => {
    if (!hasOpenAiTts && voiceOutput === 'openai') setVoiceOutput('browser')
    if (!hasElevenLabsTts && voiceOutput === 'elevenlabs') setVoiceOutput('browser')

    if (!hasUserSetVoiceOutputRef.current && voiceOutput === 'browser') {
      if (defaultProvider === 'elevenlabs' && hasElevenLabsTts) setVoiceOutput('elevenlabs')
      else if (hasOpenAiTts) setVoiceOutput('openai')
    }
  }, [defaultProvider, hasElevenLabsTts, hasOpenAiTts, voiceOutput])

  const handleVoiceOutputChange = useCallback((value: 'openai' | 'elevenlabs' | 'browser' | 'off') => {
    hasUserSetVoiceOutputRef.current = true
    setVoiceOutput(value)
  }, [])

  const handleVoiceInputChange = useCallback((value: 'server' | 'browser') => {
    hasUserSetVoiceInputRef.current = true
    setVoiceInput(value)
  }, [])

  // Server-side transcription function
  const transcribeWithServer = useCallback(async (audioBlob: Blob): Promise<string | null> => {
    try {
      const formData = new FormData()
      formData.append('file', audioBlob, 'audio.webm')

      const response = await fetch(buildControlServerUrl('/api/transcribe'), {
        method: 'POST',
        headers: controlServerAuthHeaders(),
        body: formData,
      })

      if (!response.ok) {
        console.warn('Server transcription failed:', response.status)
        return null
      }

      const data = await response.json()
      return data.text || null
    } catch (err) {
      console.error('Server transcription error:', err)
      return null
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

        const transcription = await transcribeWithServer(audioBlob)
        setPartialTranscript('')

        if (transcription) {
          processTranscriptRef.current(transcription)
        } else {
          setError('Transcription failed. Try again or switch to browser voice input.')
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

  const statusMessages: Record<typeof status, string> = {
    idle: 'Ready to help',
    listening: 'Listening... speak now',
    thinking: 'Thinking...',
    loading_audio: 'Preparing voice response...',
    speaking: 'Speaking...',
  }

  // Helper to add a transcript item
  const addTranscriptItem = useCallback((type: TranscriptItem['type'], content: string, audioStatus?: TranscriptItem['audioStatus']) => {
    const id = ++transcriptIdRef.current
    setTranscriptItems(prev => [...prev, { id, type, content, audioStatus }])
    // Auto-scroll to bottom
    setTimeout(() => transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
    return id
  }, [])

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

      const useRemoteTts =
        (voiceOutput === 'openai' && hasOpenAiTts) || (voiceOutput === 'elevenlabs' && hasElevenLabsTts)

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
              provider: voiceOutput === 'elevenlabs' ? 'elevenlabs' : 'openai',
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
              setError(`${voiceOutput === 'elevenlabs' ? 'ElevenLabs' : 'OpenAI'} key invalid; using browser voice.`)
              handleVoiceOutputChange('browser')
              if (itemId) updateTranscriptAudioStatus(itemId, 'failed')
              throw new Error('invalid_api_key')
            }

            if (response.status === 429 || reason === 'rate_limited') {
              setError(`${voiceOutput === 'elevenlabs' ? 'ElevenLabs' : 'OpenAI'} rate limited; using browser voice.`)
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
  }, [availableVoices, hasElevenLabsTts, hasOpenAiTts, hasUserInteracted, handleVoiceOutputChange, pickBestBrowserVoice, stopSpeaking, updateTranscriptAudioStatus, voiceOutput])

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

      let interim = ''
      let finalText = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcriptPiece = event.results[i][0].transcript
        if (event.results[i].isFinal) {
          finalText += transcriptPiece + ' '
        } else {
          interim += transcriptPiece
        }
      }
      setPartialTranscript(interim)
      if (finalText.trim()) {
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
      speechRecognitionRef.current.start()
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
    if (isOpen && templateMode === 'newbie' && transcriptItems.length === 0) {
      const greeting = "Hi! I'm your voice guide. Tell me about your media setup goals."
      const itemId = addTranscriptItem('system', greeting, 'loading')
      speak(greeting, itemId)
    }
  }, [addTranscriptItem, isOpen, templateMode, transcriptItems.length, speak])

  const stopRecording = useCallback(() => {
    if (voiceInput === 'server' && sttStatus?.hasKey) {
      stopServerRecording()
    } else {
      stopRecognition()
    }
  }, [voiceInput, sttStatus?.hasKey, stopServerRecording, stopRecognition])

  const startRecordingUnified = useCallback(async () => {
    if (voiceInput === 'server' && sttStatus?.hasKey) {
      await startServerRecording()
    } else {
      await startRecognition()
    }
  }, [voiceInput, sttStatus?.hasKey, startServerRecording, startRecognition])

  const sendTranscriptToServer = useCallback(async (content: string, updatedHistory: { role: 'user' | 'assistant'; content: string }[]) => {
    try {
      setStatus('thinking')
      const response = await fetch(buildControlServerUrl('/api/voice-agent'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...controlServerAuthHeaders() },
        body: JSON.stringify({
          transcript: content,
          history: updatedHistory,
        }),
      })

      if (!response.ok) {
        throw new Error('Voice agent failed to respond')
      }

      const data = await response.json()
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
            className="relative w-full max-w-4xl max-h-[85vh] bg-card border border-border rounded-3xl shadow-2xl overflow-hidden flex flex-col"
          >
            <div className="flex flex-col md:flex-row h-full min-h-0 overflow-hidden">
              {/* Left Panel - Status & Controls */}
              <div className="md:w-1/2 p-6 md:p-8 bg-gradient-to-br from-emerald-500/10 via-cyan-500/10 to-lime-500/10 border-b md:border-b-0 md:border-r border-border flex flex-col min-h-0 max-h-[35vh] md:max-h-full overflow-y-auto flex-shrink-0 md:flex-shrink">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-12 h-12 rounded-2xl bg-muted/60 flex items-center justify-center">
                    <Mic className="w-6 h-6 text-foreground" />
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-widest text-muted-foreground">Voice Companion</p>
                    <h3 className="text-2xl font-bold text-foreground">Newbie Onboarding</h3>
                  </div>
                </div>

                <div className="space-y-2 text-sm text-muted-foreground flex-1 min-h-0">
                  <p>
                    I'll ask a few questions about your goals and build a tailored setup plan. You can pause any time, and I'll provide a summary before applying changes.
                  </p>
                  <ul className="space-y-1 text-muted-foreground text-xs mt-4">
                    <li>• Mention any services you need (Plex, Sonarr, Overseerr, etc.).</li>
                    <li>• Tell me where you plan to host (NAS, VPS, Raspberry Pi…)</li>
                    <li>• You can speak or type your answers below.</li>
                  </ul>
                </div>

                <div className="mt-4 p-3 rounded-2xl bg-muted/30 border border-border flex-shrink-0 space-y-3">
                  <div className="flex items-center gap-2 mb-2">
                    <Settings2 className="w-4 h-4 text-muted-foreground" />
                    <p className="text-xs font-medium text-muted-foreground">Voice Settings</p>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <Mic className="w-3 h-3 text-muted-foreground" />
                      <p className="text-xs text-muted-foreground">Input</p>
                    </div>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <select
                            value={voiceInput}
                            onChange={(e) => handleVoiceInputChange(e.target.value as 'server' | 'browser')}
                            className="text-xs bg-background/60 border border-border rounded-lg px-2 py-1 text-foreground focus:outline-none focus:border-primary/50 cursor-pointer"
                            aria-label="Voice input mode"
                          >
                            <option value="browser">Browser</option>
                            <option value="server" disabled={!sttStatus?.hasKey}>OpenAI gpt-4o-transcribe</option>
                          </select>
                        </TooltipTrigger>
                        <TooltipContent side="left">
                          <p className="text-xs max-w-48">
                            {voiceInput === 'server'
                              ? 'Using OpenAI gpt-4o-transcribe - lowest word error rate, best accuracy'
                              : 'Browser speech recognition - works offline but less accurate'}
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <Headphones className="w-3 h-3 text-muted-foreground" />
                      <p className="text-xs text-muted-foreground">Output</p>
                    </div>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <select
                            value={voiceOutput}
                            onChange={(e) => handleVoiceOutputChange(e.target.value as 'openai' | 'elevenlabs' | 'browser' | 'off')}
                            className="text-xs bg-background/60 border border-border rounded-lg px-2 py-1 text-foreground focus:outline-none focus:border-primary/50 cursor-pointer"
                            aria-label="Voice output mode"
                          >
                            <option value="off">Off</option>
                            <option value="browser">Browser</option>
                            <option value="openai" disabled={!hasOpenAiTts}>OpenAI gpt-4o-mini-tts</option>
                            <option value="elevenlabs" disabled={!hasElevenLabsTts}>ElevenLabs</option>
                          </select>
                        </TooltipTrigger>
                        <TooltipContent side="left">
                          <p className="text-xs max-w-48">
                            {voiceOutput === 'openai' ? 'Premium OpenAI voices with natural speech' :
                             voiceOutput === 'elevenlabs' ? 'Ultra-realistic ElevenLabs voices' :
                             voiceOutput === 'browser' ? 'Built-in browser text-to-speech' :
                             'Voice output disabled'}
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                  {voiceInput === 'server' && sttStatus?.hasKey && (
                    <div className="flex items-center gap-2 p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30">
                      <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                      <p className="text-[11px] text-emerald-400">
                        Using highest accuracy transcription model
                      </p>
                    </div>
                  )}
                  {!hasOpenAiTts && !hasElevenLabsTts && !sttStatus?.hasKey && (
                    <p className="mt-2 text-[11px] text-muted-foreground">
                      Add an OpenAI key in Settings to enable higher quality voice input/output.
                    </p>
                  )}
                </div>

                <div className="mt-6 p-4 rounded-2xl bg-muted/40 border border-border flex-shrink-0">
                  <p className="text-xs text-muted-foreground mb-2">Status</p>
                  <div className="flex items-center gap-3">
                    {/* Animated status indicator */}
                    {status === 'idle' && (
                      <div className="w-10 h-10 rounded-full bg-muted/60 flex items-center justify-center">
                        <Mic className="w-5 h-5 text-muted-foreground" />
                      </div>
                    )}
                    {status === 'listening' && (
                      <motion.div
                        animate={{ scale: [1, 1.15, 1], boxShadow: ['0 0 0 0 rgba(16, 185, 129, 0)', '0 0 0 10px rgba(16, 185, 129, 0.3)', '0 0 0 0 rgba(16, 185, 129, 0)'] }}
                        transition={{ duration: 1.5, repeat: Infinity }}
                        className="w-10 h-10 rounded-full bg-emerald-500 flex items-center justify-center"
                      >
                        <Mic className="w-5 h-5 text-white" />
                      </motion.div>
                    )}
                    {status === 'thinking' && (
                      <div className="w-10 h-10 rounded-full bg-cyan-500/20 flex items-center justify-center">
                        <Loader2 className="w-5 h-5 text-cyan-400 animate-spin" />
                      </div>
                    )}
                    {status === 'loading_audio' && (
                      <motion.div
                        animate={{ opacity: [0.5, 1, 0.5] }}
                        transition={{ duration: 1, repeat: Infinity }}
                        className="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center"
                      >
                        <Volume2 className="w-5 h-5 text-purple-400" />
                      </motion.div>
                    )}
                    {status === 'speaking' && (
                      <motion.div
                        animate={{ scale: [1, 1.1, 1] }}
                        transition={{ duration: 0.3, repeat: Infinity }}
                        className="w-10 h-10 rounded-full bg-emerald-500 flex items-center justify-center"
                      >
                        <Volume2 className="w-5 h-5 text-white" />
                      </motion.div>
                    )}
                    <div>
                      <p className={`text-base font-semibold ${
                        status === 'listening' ? 'text-emerald-400' :
                        status === 'thinking' ? 'text-cyan-400' :
                        status === 'loading_audio' ? 'text-purple-400' :
                        status === 'speaking' ? 'text-emerald-400' :
                        'text-foreground'
                      }`}>
                        {statusMessages[status]}
                      </p>
                      {status === 'listening' && (
                        <p className="text-xs text-muted-foreground">Your words appear in the chat as you speak</p>
                      )}
                      {status === 'loading_audio' && (
                        <p className="text-xs text-muted-foreground">Generating voice response...</p>
                      )}
                    </div>
                  </div>
                  {error && (
                    <div className="mt-3 p-2 rounded-lg bg-red-500/10 border border-red-500/30">
                      <p className="text-xs text-red-400 flex items-start gap-2">
                        <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                        <span>{error}</span>
                      </p>
                      <button
                        onClick={() => {
                          setError(null)
                          initializeSpeechRecognition()
                        }}
                        className="mt-2 text-xs text-red-300 hover:text-red-200 underline"
                      >
                        Retry voice setup
                      </button>
                    </div>
                  )}
                </div>

                <div className="mt-6 flex flex-col gap-3 flex-shrink-0">
                  {!isSpeechSupported && voiceInput === 'browser' && (
                    <p className="text-sm text-yellow-200 flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4" /> Voice recognition is not supported in this browser. {sttStatus?.hasKey ? 'Switch to OpenAI input or type below.' : 'Please use Chrome desktop or type below.'}
                    </p>
                  )}
                  <div className="flex gap-3">
                    <TooltipProvider>
                      {!isRecording ? (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="gradient"
                              size="lg"
                              onClick={startRecordingUnified}
                              disabled={voiceInput === 'browser' ? !isSpeechSupported : !sttStatus?.hasKey}
                              className="flex-1 rounded-2xl py-6"
                            >
                              <Mic className="w-5 h-5" />
                              Start Speaking
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent side="top">
                            <p>{voiceInput === 'server' ? 'Using OpenAI gpt-4o-transcribe (highest accuracy)' : 'Using browser speech recognition'}</p>
                          </TooltipContent>
                        </Tooltip>
                      ) : (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="destructive"
                              size="lg"
                              onClick={stopRecording}
                              className="flex-1 rounded-2xl py-6 shadow-lg shadow-red-500/40"
                            >
                              <StopCircle className="w-5 h-5" />
                              Stop Recording
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent side="top">
                            <p>Click to stop recording and transcribe</p>
                          </TooltipContent>
                        </Tooltip>
                      )}

                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="outline"
                            size="lg"
                            onClick={onClose}
                            className="rounded-2xl py-6"
                          >
                            Cancel
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent side="top">
                          <p>Close voice companion</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                </div>
              </div>

              {/* Right Panel - Transcript & Input */}
              <div className="md:w-1/2 flex flex-col bg-card min-h-0 flex-1 overflow-hidden">
                {/* Transcript Area - scrollable */}
                <div className="flex-1 min-h-0 p-6 space-y-4 overflow-y-auto overflow-x-hidden">
                  <p className="text-xs uppercase tracking-widest text-muted-foreground sticky top-0 bg-card pb-2 z-10">Conversation</p>
                  <div className="space-y-3 text-sm">
                    {transcriptItems.map((item) => (
                      <motion.div
                        key={item.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={`p-3 rounded-2xl border ${
                          item.type === 'assistant' || item.type === 'system'
                            ? 'bg-primary/10 border-primary/30 mr-8'
                            : 'bg-muted/60 border-border ml-8'
                        }`}
                      >
                        <div className="flex items-start gap-2">
                          {/* Type indicator */}
                          <span className="text-xs mt-0.5">
                            {item.type === 'user' ? '🗣️' : item.type === 'assistant' ? '🤖' : '👋'}
                          </span>
                          <div className="flex-1 text-foreground">
                            {item.content}
                          </div>
                          {/* Audio status indicator for assistant/system messages */}
                          {(item.type === 'assistant' || item.type === 'system') && item.audioStatus && (
                            <div className="flex-shrink-0 ml-2">
                              {item.audioStatus === 'loading' && (
                                <motion.div
                                  animate={{ opacity: [0.5, 1, 0.5] }}
                                  transition={{ duration: 1.5, repeat: Infinity }}
                                  className="flex items-center gap-1 text-xs text-muted-foreground"
                                >
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                  <span>Loading audio...</span>
                                </motion.div>
                              )}
                              {item.audioStatus === 'playing' && (
                                <motion.div
                                  animate={{ scale: [1, 1.1, 1] }}
                                  transition={{ duration: 0.5, repeat: Infinity }}
                                  className="flex items-center gap-1 text-xs text-emerald-400"
                                >
                                  <Volume2 className="w-4 h-4" />
                                </motion.div>
                              )}
                              {item.audioStatus === 'done' && (
                                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                              )}
                              {item.audioStatus === 'failed' && (
                                <div className="flex items-center gap-1 text-xs text-red-400">
                                  <VolumeX className="w-4 h-4" />
                                  <span>Audio failed</span>
                                </div>
                              )}
                              {item.audioStatus === 'skipped' && voiceOutput === 'off' && (
                                <VolumeX className="w-3 h-3 text-muted-foreground" />
                              )}
                            </div>
                          )}
                        </div>
                      </motion.div>
                    ))}

                    {/* Live transcription indicator - what user is saying */}
                    {partialTranscript && (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="p-3 rounded-2xl bg-emerald-500/10 border-2 border-dashed border-emerald-500/50 ml-8"
                      >
                        <div className="flex items-start gap-2">
                          <motion.span
                            animate={{ scale: [1, 1.2, 1] }}
                            transition={{ duration: 0.5, repeat: Infinity }}
                            className="text-xs mt-0.5"
                          >
                            🎙️
                          </motion.span>
                          <span className="text-foreground">{partialTranscript}</span>
                          <motion.span
                            animate={{ opacity: [1, 0] }}
                            transition={{ duration: 0.5, repeat: Infinity }}
                          >
                            |
                          </motion.span>
                        </div>
                      </motion.div>
                    )}

                    {/* Auto-scroll anchor */}
                    <div ref={transcriptEndRef} />
                  </div>
                </div>

                {/* Input Area - fixed at bottom */}
                <div className="p-4 border-t border-border bg-muted/30 flex-shrink-0">
                  <form onSubmit={handleManualSubmit} className="relative flex gap-2">
                    <input
                      type="text"
                      value={manualInput}
                      onChange={(e) => setManualInput(e.target.value)}
                      placeholder={
                        isRecording ? "Listening... speak now" :
                        status === 'thinking' ? "Waiting for response..." :
                        status === 'loading_audio' ? "Preparing audio..." :
                        status === 'speaking' ? "Playing response..." :
                        "Type your message here..."
                      }
                      disabled={isRecording || status === 'thinking' || status === 'speaking' || status === 'loading_audio'}
                      className="w-full bg-background/60 border border-border rounded-xl px-4 py-3 text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 transition"
                    />
                    <button
                      type="submit"
                      disabled={!manualInput.trim() || status === 'thinking' || status === 'loading_audio'}
                      aria-label="Send message"
                      title="Send message"
                      className="bg-muted/60 hover:bg-muted/80 text-foreground p-3 rounded-xl transition disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
                    >
                      <Send className="w-5 h-5" />
                    </button>
                  </form>
                </div>

                {/* Plan Area - fixed height, scrollable if needed */}
                <div className="border-t border-border flex-shrink-0 max-h-[150px] overflow-y-auto">
                  {plan ? (
                    <div className="p-4 space-y-3 bg-green-500/5">
                      <div className="flex items-center gap-2 text-green-400">
                        <CheckCircle2 className="w-5 h-5" />
                        <p className="text-sm font-semibold">Plan ready!</p>
                      </div>
                      <div className="space-y-3 text-sm text-muted-foreground">
                        {/* Plan details rendering */}
                        <p className="text-xs text-muted-foreground">Services: {plan.services.join(', ')}</p>
                        <p className="text-xs text-muted-foreground">Domain: {plan.domain}</p>
                      </div>
                      <div className="flex gap-3">
                        <Button
                          onClick={handleApplyPlan}
                          className="flex-1 rounded-2xl bg-green-500 hover:bg-green-600 shadow-lg shadow-green-500/40"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          Apply Plan
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => setPlan(null)}
                          className="rounded-2xl"
                        >
                          Ask More
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="p-4 text-xs text-muted-foreground flex items-center justify-center gap-2">
                      <Sparkles className="w-3 h-3" /> AI will verify requirements before finalizing.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
