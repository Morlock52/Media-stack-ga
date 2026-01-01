/**
 * useStreamingTts - WebSocket-based streaming TTS with ElevenLabs
 *
 * Provides ultra-low latency (~75ms TTFB) text-to-speech using ElevenLabs Flash v2.5
 * Audio starts playing as soon as the first chunk arrives, before the full response.
 *
 * Uses MediaSource API for seamless streaming playback.
 */

import { useCallback, useRef, useState, useEffect } from 'react'
import { buildControlServerUrl, controlServerAuthHeaders } from '../utils/controlServer'

export interface StreamingTtsConfig {
  onStart?: () => void
  onChunk?: (chunkIndex: number) => void
  onEnd?: () => void
  onError?: (error: string) => void
}

export type StreamingTtsStatus = 'idle' | 'connecting' | 'streaming' | 'playing' | 'error'

interface StreamingTtsConfigResponse {
  available: boolean
  websocketUrl: string
  model: string
  voiceId: string
  chunkLengthSchedule: number[]
  authHeader: string
  recommendations: {
    model: string
    latency: string
    format: string
    flush: string
  }
}

export function useStreamingTts(config: StreamingTtsConfig = {}) {
  const [status, setStatus] = useState<StreamingTtsStatus>('idle')
  const [isAvailable, setIsAvailable] = useState<boolean | null>(null)
  const [error, setError] = useState<string | null>(null)

  const wsRef = useRef<WebSocket | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const audioQueueRef = useRef<AudioBuffer[]>([])
  const isPlayingRef = useRef(false)
  const configRef = useRef(config)
  const ttsConfigRef = useRef<StreamingTtsConfigResponse | null>(null)

  configRef.current = config

  // Check if streaming TTS is available
  useEffect(() => {
    const checkAvailability = async () => {
      try {
        const response = await fetch(buildControlServerUrl('/api/tts/streaming/config'), {
          headers: controlServerAuthHeaders(),
        })
        if (response.ok) {
          const data = await response.json()
          ttsConfigRef.current = data
          setIsAvailable(data.available)
        } else {
          setIsAvailable(false)
        }
      } catch {
        setIsAvailable(false)
      }
    }
    checkAvailability()
  }, [])

  // Initialize AudioContext
  const getAudioContext = useCallback(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContext({ sampleRate: 44100 })
    }
    return audioContextRef.current
  }, [])

  // Play queued audio buffers sequentially
  const playNextChunk = useCallback(async () => {
    if (isPlayingRef.current || audioQueueRef.current.length === 0) {
      return
    }

    isPlayingRef.current = true
    const audioContext = getAudioContext()

    while (audioQueueRef.current.length > 0) {
      const buffer = audioQueueRef.current.shift()!
      const source = audioContext.createBufferSource()
      source.buffer = buffer
      source.connect(audioContext.destination)

      await new Promise<void>((resolve) => {
        source.onended = () => resolve()
        source.start()
      })
    }

    isPlayingRef.current = false

    // Check if more chunks arrived while playing
    if (audioQueueRef.current.length > 0) {
      playNextChunk()
    } else if (status === 'playing') {
      setStatus('idle')
      configRef.current.onEnd?.()
    }
  }, [getAudioContext, status])

  // Decode base64 MP3 to AudioBuffer
  const decodeAudioChunk = useCallback(async (base64Audio: string): Promise<AudioBuffer | null> => {
    try {
      const audioContext = getAudioContext()
      const binaryString = atob(base64Audio)
      const bytes = new Uint8Array(binaryString.length)
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i)
      }
      return await audioContext.decodeAudioData(bytes.buffer)
    } catch (err) {
      console.warn('Failed to decode audio chunk:', err)
      return null
    }
  }, [getAudioContext])

  // Speak text with streaming
  const speak = useCallback(async (text: string) => {
    if (!ttsConfigRef.current) {
      setError('Streaming TTS not configured')
      configRef.current.onError?.('Streaming TTS not configured')
      return
    }

    // Clean up any existing connection
    if (wsRef.current) {
      wsRef.current.close()
    }

    setError(null)
    setStatus('connecting')
    audioQueueRef.current = []
    let chunkIndex = 0

    try {
      // Resume AudioContext if suspended (browser autoplay policy)
      const audioContext = getAudioContext()
      if (audioContext.state === 'suspended') {
        await audioContext.resume()
      }

      // Connect to ElevenLabs WebSocket
      const wsUrl = `${ttsConfigRef.current.websocketUrl}?model_id=${ttsConfigRef.current.model}`
      const ws = new WebSocket(wsUrl)
      wsRef.current = ws

      ws.onopen = () => {
        setStatus('streaming')
        configRef.current.onStart?.()

        // Send initial configuration
        ws.send(JSON.stringify({
          text: ' ', // Initial space to start connection
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
            use_speaker_boost: true,
          },
          generation_config: {
            chunk_length_schedule: ttsConfigRef.current!.chunkLengthSchedule,
          },
          xi_api_key: ttsConfigRef.current!.authHeader.replace('xi-api-key: ', ''),
        }))

        // Send the actual text
        ws.send(JSON.stringify({
          text: text,
          flush: true, // Force generation after this text
        }))

        // Send empty string to close the text stream
        ws.send(JSON.stringify({
          text: '',
        }))
      }

      ws.onmessage = async (event) => {
        try {
          const data = JSON.parse(event.data)

          if (data.audio) {
            // Decode and queue audio chunk
            const buffer = await decodeAudioChunk(data.audio)
            if (buffer) {
              audioQueueRef.current.push(buffer)
              configRef.current.onChunk?.(chunkIndex++)

              // Start playing as soon as first chunk arrives
              if (!isPlayingRef.current) {
                setStatus('playing')
                playNextChunk()
              }
            }
          }

          if (data.isFinal) {
            ws.close()
          }
        } catch (err) {
          console.warn('Failed to process WebSocket message:', err)
        }
      }

      ws.onerror = (err) => {
        console.error('WebSocket error:', err)
        setError('Streaming connection error')
        configRef.current.onError?.('Streaming connection error')
        setStatus('error')
      }

      ws.onclose = () => {
        wsRef.current = null
        // Status will be updated by playNextChunk when audio ends
      }

    } catch (err) {
      console.error('Streaming TTS error:', err)
      const message = err instanceof Error ? err.message : 'Streaming failed'
      setError(message)
      configRef.current.onError?.(message)
      setStatus('error')
    }
  }, [decodeAudioChunk, getAudioContext, playNextChunk])

  // Stop current playback
  const stop = useCallback(() => {
    // Close WebSocket
    if (wsRef.current) {
      wsRef.current.close()
      wsRef.current = null
    }

    // Clear audio queue
    audioQueueRef.current = []
    isPlayingRef.current = false

    setStatus('idle')
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stop()
      if (audioContextRef.current) {
        audioContextRef.current.close()
        audioContextRef.current = null
      }
    }
  }, [stop])

  return {
    status,
    isAvailable,
    error,
    speak,
    stop,
    isSpeaking: status === 'streaming' || status === 'playing',
  }
}

/**
 * useMediaSourceTts - Alternative streaming TTS using MediaSource API
 *
 * For browsers that don't support Web Audio API well, this uses
 * MediaSource Extensions for streaming audio playback.
 */
export function useMediaSourceTts(config: StreamingTtsConfig = {}) {
  const [status, setStatus] = useState<StreamingTtsStatus>('idle')
  const [isAvailable, setIsAvailable] = useState<boolean | null>(null)
  const [error, setError] = useState<string | null>(null)

  const audioRef = useRef<HTMLAudioElement | null>(null)
  const mediaSourceRef = useRef<MediaSource | null>(null)
  const sourceBufferRef = useRef<SourceBuffer | null>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const ttsConfigRef = useRef<StreamingTtsConfigResponse | null>(null)
  const configRef = useRef(config)

  configRef.current = config

  // Check availability (same as streaming hook)
  useEffect(() => {
    const checkAvailability = async () => {
      try {
        // Check MediaSource support
        if (!window.MediaSource) {
          setIsAvailable(false)
          return
        }

        const response = await fetch(buildControlServerUrl('/api/tts/streaming/config'), {
          headers: controlServerAuthHeaders(),
        })
        if (response.ok) {
          const data = await response.json()
          ttsConfigRef.current = data
          setIsAvailable(data.available)
        } else {
          setIsAvailable(false)
        }
      } catch {
        setIsAvailable(false)
      }
    }
    checkAvailability()
  }, [])

  // Speak with MediaSource streaming
  const speak = useCallback(async (text: string) => {
    if (!ttsConfigRef.current) {
      setError('Streaming TTS not configured')
      configRef.current.onError?.('Streaming TTS not configured')
      return
    }

    stop()
    setError(null)
    setStatus('connecting')

    try {
      // Create MediaSource
      const mediaSource = new MediaSource()
      mediaSourceRef.current = mediaSource

      // Create audio element
      const audio = new Audio()
      audio.src = URL.createObjectURL(mediaSource)
      audioRef.current = audio

      await new Promise<void>((resolve, reject) => {
        mediaSource.addEventListener('sourceopen', () => resolve(), { once: true })
        mediaSource.addEventListener('error', () => reject(new Error('MediaSource error')), { once: true })
      })

      // Create source buffer for MP3
      // Note: Browser support for MP3 in MediaSource varies
      const mimeType = 'audio/mpeg'
      if (!MediaSource.isTypeSupported(mimeType)) {
        throw new Error('MP3 streaming not supported in this browser')
      }

      const sourceBuffer = mediaSource.addSourceBuffer(mimeType)
      sourceBufferRef.current = sourceBuffer

      // Connect to ElevenLabs
      const wsUrl = `${ttsConfigRef.current.websocketUrl}?model_id=${ttsConfigRef.current.model}`
      const ws = new WebSocket(wsUrl)
      wsRef.current = ws

      let chunkIndex = 0
      const pendingChunks: ArrayBuffer[] = []
      let isAppending = false

      const appendNextChunk = () => {
        if (isAppending || pendingChunks.length === 0 || sourceBuffer.updating) {
          return
        }

        isAppending = true
        const chunk = pendingChunks.shift()!
        sourceBuffer.appendBuffer(chunk)
      }

      sourceBuffer.addEventListener('updateend', () => {
        isAppending = false
        appendNextChunk()
      })

      ws.onopen = () => {
        setStatus('streaming')
        configRef.current.onStart?.()

        ws.send(JSON.stringify({
          text: ' ',
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
          },
          xi_api_key: ttsConfigRef.current!.authHeader.replace('xi-api-key: ', ''),
        }))

        ws.send(JSON.stringify({ text, flush: true }))
        ws.send(JSON.stringify({ text: '' }))
      }

      ws.onmessage = async (event) => {
        try {
          const data = JSON.parse(event.data)

          if (data.audio) {
            const binaryString = atob(data.audio)
            const bytes = new Uint8Array(binaryString.length)
            for (let i = 0; i < binaryString.length; i++) {
              bytes[i] = binaryString.charCodeAt(i)
            }

            pendingChunks.push(bytes.buffer)
            configRef.current.onChunk?.(chunkIndex++)
            appendNextChunk()

            // Start playing once we have first chunk
            if (audio.paused && pendingChunks.length === 0) {
              setStatus('playing')
              audio.play().catch(console.warn)
            }
          }

          if (data.isFinal) {
            ws.close()
          }
        } catch (err) {
          console.warn('Failed to process chunk:', err)
        }
      }

      ws.onerror = () => {
        setError('Connection error')
        configRef.current.onError?.('Connection error')
        setStatus('error')
      }

      ws.onclose = () => {
        wsRef.current = null
        // End the stream
        if (mediaSource.readyState === 'open' && !sourceBuffer.updating) {
          mediaSource.endOfStream()
        }
      }

      audio.onended = () => {
        setStatus('idle')
        configRef.current.onEnd?.()
      }

    } catch (err) {
      console.error('MediaSource TTS error:', err)
      const message = err instanceof Error ? err.message : 'Streaming failed'
      setError(message)
      configRef.current.onError?.(message)
      setStatus('error')
    }
  }, [])

  // Stop playback
  const stop = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close()
      wsRef.current = null
    }

    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.src = ''
      audioRef.current = null
    }

    if (mediaSourceRef.current) {
      if (mediaSourceRef.current.readyState === 'open') {
        try {
          mediaSourceRef.current.endOfStream()
        } catch {
          // Ignore
        }
      }
      mediaSourceRef.current = null
    }

    sourceBufferRef.current = null
    setStatus('idle')
  }, [])

  useEffect(() => {
    return () => stop()
  }, [stop])

  return {
    status,
    isAvailable,
    error,
    speak,
    stop,
    isSpeaking: status === 'streaming' || status === 'playing',
  }
}
