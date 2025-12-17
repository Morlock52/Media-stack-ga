import { useCallback, useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Mic, StopCircle, Loader2, Sparkles, CheckCircle2, AlertTriangle, Send } from 'lucide-react'
import { buildControlServerUrl } from '../utils/controlServer'

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
  const [transcript, setTranscript] = useState<string[]>([])
  const [status, setStatus] = useState<'idle' | 'listening' | 'thinking' | 'speaking'>('idle')
  const [plan, setPlan] = useState<VoicePlanSummary | null>(null)
  const [error, setError] = useState<string | null>(null)
  const speechRecognitionRef = useRef<any>(null)
  const [partialTranscript, setPartialTranscript] = useState('')
  const historyRef = useRef<{ role: 'user' | 'assistant'; content: string }[]>([])
  const [isSpeechSupported, setIsSpeechSupported] = useState(false)
  const isRecordingRef = useRef(false)
  const processTranscriptRef = useRef<(text: string) => void>(() => { })
  const [manualInput, setManualInput] = useState('')

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
    idle: 'Waiting to start',
    listening: 'Listening... (speak clearly)',
    thinking: 'Analyzing preferences...',
    speaking: 'Responding with guidance',
  }

  const speak = useCallback((text: string) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return

    // Cancel any ongoing speech
    window.speechSynthesis.cancel()

    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = 'en-US'
    utterance.rate = 1.0
    utterance.pitch = 1.0

    // Try to find a good voice
    const voices = window.speechSynthesis.getVoices()
    const preferredVoice = voices.find(v => v.name.includes('Google US English') || v.name.includes('Samantha'))
    if (preferredVoice) utterance.voice = preferredVoice

    utterance.onstart = () => setStatus('speaking')
    utterance.onend = () => {
      if (isRecordingRef.current) {
        setStatus('listening')
      } else {
        setStatus('idle')
      }
    }

    // Handle speech synthesis errors/interruptions
    utterance.onerror = () => {
      setStatus('idle')
    }

    try {
      window.speechSynthesis.speak(utterance)
    } catch (e) {
      console.warn('Speech synthesis failed:', e)
      setStatus('idle')
    }
  }, [])

  // Pre-load voices
  useEffect(() => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.getVoices()
    }
  }, [])

  const addTranscriptLine = useCallback((line: string) => {
    setTranscript((prev) => [...prev, line])
  }, [])

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
    recognition.continuous = false
    recognition.interimResults = true

    recognition.onresult = (event: any) => {
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
        'no-speech': 'No speech detected. Try speaking louder or closer to the microphone.',
        'network': 'Speech service unavailable. Please check your connection or use the text input below.',
        'audio-capture': 'No microphone found. Please connect a microphone or use text input.',
      }

      const msg = errorMessages[event.error] || `Speech error: ${event.error}`
      console.warn('Speech recognition error:', event.error)

      // Don't override a previous network error if we are just re-initializing
      setError(prev => prev === errorMessages['network'] ? prev : msg)

      // If the browser reports a "network" error, SpeechRecognition is effectively unavailable in this context.
      // Disable the voice button so the user isn't stuck retrying a broken flow.
      if (event.error === 'network') {
        setIsSpeechSupported(false)
        speechRecognitionRef.current = null
      }

      stopRecognition()

      // Auto-recovery for transient network connectivity issues shouldn't loop infinitely
      // Instead, we stop and let the user decide to retry or type.
    }

    recognition.onend = () => {
      if (isRecordingRef.current) {
        // Did we mean to stop?
        isRecordingRef.current = false
        setIsRecording(false)
        setStatus('idle')
      }
    }

    speechRecognitionRef.current = recognition
  }, [getSpeechSupportError, stopRecognition])

  const startRecognition = useCallback(() => {
    if (isRecordingRef.current) return
    if (!speechRecognitionRef.current) {
      initializeSpeechRecognition()
    }

    if (!speechRecognitionRef.current) {
      const supportError = getSpeechSupportError()
      setError(supportError || 'Voice recognition is not available right now. Please use text input.')
      return
    }

    try {
      setError(null)
      setStatus('listening')
      setPartialTranscript('')
      setIsRecording(true)
      isRecordingRef.current = true
      speechRecognitionRef.current.start()
    } catch (err) {
      console.error('Failed to start speech recognition:', err)
      isRecordingRef.current = false
      setIsRecording(false)
      setStatus('idle') // Reset status so user can try again
      setError('Microphone initialization failed. Please try again or use text input.')

      // Force re-init
      initializeSpeechRecognition()
    }
  }, [initializeSpeechRecognition])

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
    if (isOpen && templateMode === 'newbie' && transcript.length === 0) {
      const greeting = '👋 Hi! I\'m your voice guide. Tell me about your media setup goals.'
      addTranscriptLine(greeting)
      speak(greeting)
    }
  }, [addTranscriptLine, isOpen, templateMode, transcript.length, speak])

  const stopRecording = () => {
    stopRecognition()
  }

  const sendTranscriptToServer = useCallback(async (content: string, updatedHistory: { role: 'user' | 'assistant'; content: string }[]) => {
    try {
      setStatus('thinking')
      const response = await fetch(buildControlServerUrl('/api/voice-agent'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
        addTranscriptLine(`🤖 ${data.agentResponse}`)
        speak(data.agentResponse)
        const withAssistant = [...updatedHistory, { role: 'assistant', content: data.agentResponse } as const]
        historyRef.current = withAssistant
      }

      if (data.plan) {
        setPlan(data.plan)
        setStatus('idle')
        stopRecognition()
      } else {
        // Auto-restart recognition only if we are still in voice mode?
        // Actually for chat flow, better to stop and let user reply manually or by clicking mic again
        // to avoid "listening to itself" or awkward loops.
        // But the original design had 'startRecognition()' here.
        // Let's rely on user action or 'always listening' mode. 
        // Best practice: Stop and wait for user to speak again (click mic) or type. 
        // However, to keep conversational flow, we can restart IF it was voice-initiated.
        // But since we now support text, let's keep it manual-ish.
        // Or re-enable if manual input wasn't used?
        setStatus('idle')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unexpected error')
      setStatus('idle')
    }
  }, [addTranscriptLine, speak, stopRecognition]) // startRecognition removed from dep array to avoid auto-loop

  useEffect(() => {
    processTranscriptRef.current = (userContent: string) => {
      stopRecognition({ maintainStatus: true })
      addTranscriptLine(`🗣️ ${userContent}`)
      const updatedHistory = [...historyRef.current, { role: 'user', content: userContent } as const]
      historyRef.current = updatedHistory
      sendTranscriptToServer(userContent, updatedHistory)
    }
  }, [addTranscriptLine, sendTranscriptToServer, stopRecognition])

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
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            className="relative w-full max-w-4xl max-h-[calc(100dvh-2rem)] bg-slate-900/95 border border-white/10 rounded-3xl shadow-2xl overflow-hidden flex flex-col"
          >
            <div className="flex flex-col md:flex-row h-full">
              {/* Left Panel - Status & Controls */}
              <div className="md:w-1/2 p-8 bg-gradient-to-br from-purple-600/20 to-pink-600/10 border-b md:border-b-0 md:border-r border-white/10 flex flex-col">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center">
                    <Mic className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-widest text-white/60">Voice Companion</p>
                    <h3 className="text-2xl font-bold text-white">Newbie Onboarding</h3>
                  </div>
                </div>

                <div className="space-y-2 text-sm text-white/80 flex-1">
                  <p>
                    I\'ll ask a few questions about your goals and build a tailored setup plan. You can pause any time, and I\'ll provide a summary before applying changes.
                  </p>
                  <ul className="space-y-1 text-white/70 text-xs mt-4">
                    <li>• Mention any services you need (Plex, Sonarr, Overseerr, etc.).</li>
                    <li>• Tell me where you plan to host (NAS, VPS, Raspberry Pi…)</li>
                    <li>• You can speak or type your answers below.</li>
                  </ul>
                </div>

                <div className="mt-6 p-4 rounded-2xl bg-black/30 border border-white/10">
                  <p className="text-xs text-white/60 mb-1">Status</p>
                  <p className="text-lg font-semibold text-white flex items-center gap-2">
                    <Loader2 className={`w-4 h-4 ${status === 'idle' ? 'text-white/40' : 'animate-spin text-white'}`} />
                    {statusMessages[status]}
                  </p>
                  {error && (
                    <p className="mt-2 text-xs text-red-400 flex items-center gap-1">
                      <AlertTriangle className="w-4 h-4" /> {error}
                    </p>
                  )}
                </div>

                <div className="mt-6 flex flex-col gap-3">
                  {!isSpeechSupported && (
                    <p className="text-sm text-yellow-200 flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4" /> Voice recognition is not supported in this browser. Please use Chrome desktop or type below.
                    </p>
                  )}
                  <div className="flex gap-3">
                    {!isRecording ? (
                      <button
                        onClick={startRecognition}
                        disabled={!isSpeechSupported}
                        className="flex-1 px-4 py-3 rounded-2xl bg-gradient-to-r from-purple-500 to-pink-500 text-white font-semibold shadow-lg shadow-purple-500/40 hover:scale-105 transition disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <span className="flex items-center justify-center gap-2">
                          <Mic className="w-4 h-4" /> Start Speaking
                        </span>
                      </button>
                    ) : (
                      <button
                        onClick={stopRecording}
                        className="flex-1 px-4 py-3 rounded-2xl bg-red-500 text-white font-semibold shadow-lg shadow-red-500/40"
                      >
                        <span className="flex items-center justify-center gap-2">
                          <StopCircle className="w-4 h-4" /> Stop
                        </span>
                      </button>
                    )}

                    <button
                      onClick={onClose}
                      className="px-4 py-3 rounded-2xl border border-white/15 text-white/80 hover:text-white"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>

              {/* Right Panel - Transcript & Input */}
              <div className="md:w-1/2 flex flex-col bg-slate-900/50">
                <div className="flex-1 min-h-0 p-6 space-y-4 overflow-y-auto">
                  <p className="text-xs uppercase tracking-widest text-white/60">Transcript</p>
                  <div className="space-y-3 text-sm text-white/80">
                    {transcript.map((line, index) => (
                      <div key={index} className={`p-3 rounded-2xl border ${line.startsWith('🤖') ? 'bg-purple-500/10 border-purple-500/20 mr-8' : 'bg-white/5 border-white/5 ml-8'}`}>
                        {line}
                      </div>
                    ))}
                    {partialTranscript && (
                      <div className="p-3 rounded-2xl bg-white/5 border border-dashed border-white/10 text-white/60 animate-pulse">
                        {partialTranscript}...
                      </div>
                    )}
                  </div>
                </div>

                <div className="p-4 border-t border-white/10 bg-black/20">
                  <form onSubmit={handleManualSubmit} className="relative flex gap-2">
                    <input
                      type="text"
                      value={manualInput}
                      onChange={(e) => setManualInput(e.target.value)}
                      placeholder={isRecording ? "Listening..." : "Type your answer here..."}
                      disabled={isRecording || status === 'thinking' || status === 'speaking'}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-white/30 focus:outline-none focus:border-purple-500/50 transition"
                    />
                    <button
                      type="submit"
                      disabled={!manualInput.trim() || status === 'thinking'}
                      aria-label="Send message"
                      title="Send message"
                      className="bg-white/10 hover:bg-white/20 text-white p-3 rounded-xl transition disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Send className="w-5 h-5" />
                    </button>
                  </form>
                </div>

                <div className="border-t border-white/10">
                  {plan ? (
                    <div className="p-6 space-y-4 bg-green-500/5">
                      <div className="flex items-center gap-2 text-green-400">
                        <CheckCircle2 className="w-5 h-5" />
                        <p className="text-sm font-semibold">Plan ready!</p>
                      </div>
                      <div className="space-y-3 text-sm text-white/80">
                        {/* Plan details rendering */}
                        <p className="text-xs text-white/60">Services: {plan.services.join(', ')}</p>
                        <p className="text-xs text-white/60">Domain: {plan.domain}</p>
                      </div>
                      <div className="flex gap-3">
                        <button
                          onClick={handleApplyPlan}
                          className="flex-1 px-4 py-3 rounded-2xl bg-green-500 text-white font-semibold shadow-lg shadow-green-500/40"
                        >
                          Apply Plan
                        </button>
                        <button
                          onClick={() => setPlan(null)}
                          className="px-4 py-3 rounded-2xl border border-white/15 text-white/80"
                        >
                          Ask More
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="p-4 text-xs text-white/40 flex items-center justify-center gap-2">
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
