/**
 * useRealtimeVoice - WebRTC-based voice interaction with OpenAI Realtime API
 *
 * This hook provides low-latency (~200ms) voice-to-voice interaction using WebRTC.
 * OpenAI recommends WebRTC over WebSocket for browser applications.
 *
 * Flow:
 * 1. Get ephemeral key from control server
 * 2. Create RTCPeerConnection with microphone track
 * 3. Exchange SDP with OpenAI to establish connection
 * 4. Stream audio bidirectionally for real-time conversation
 */

import { useCallback, useRef, useState, useEffect } from 'react'
import { buildControlServerUrl, controlServerAuthHeaders } from '../utils/controlServer'

export interface RealtimeVoiceConfig {
  voice?: string
  onTranscript?: (text: string, isFinal: boolean) => void
  onResponse?: (text: string) => void
  onAudioStart?: () => void
  onAudioEnd?: () => void
  onError?: (error: string) => void
  onStatusChange?: (status: RealtimeVoiceStatus) => void
}

export type RealtimeVoiceStatus =
  | 'idle'
  | 'connecting'
  | 'connected'
  | 'listening'
  | 'processing'
  | 'speaking'
  | 'error'
  | 'disconnected'

interface EphemeralKeyResponse {
  ephemeralKey: string
  expiresAt: number
  sessionId: string
  model: string
  voice: string
  sdpUrl: string
  apiVersion?: string
}

export function useRealtimeVoice(config: RealtimeVoiceConfig = {}) {
  const [status, setStatus] = useState<RealtimeVoiceStatus>('idle')
  const [isAvailable, setIsAvailable] = useState<boolean | null>(null)
  const [error, setError] = useState<string | null>(null)

  const peerConnectionRef = useRef<RTCPeerConnection | null>(null)
  const dataChannelRef = useRef<RTCDataChannel | null>(null)
  const localStreamRef = useRef<MediaStream | null>(null)
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null)

  const configRef = useRef(config)
  configRef.current = config

  // Update status and notify
  const updateStatus = useCallback((newStatus: RealtimeVoiceStatus) => {
    setStatus(newStatus)
    configRef.current.onStatusChange?.(newStatus)
  }, [])

  // Check if Realtime API is available
  useEffect(() => {
    const checkAvailability = async () => {
      try {
        const response = await fetch(buildControlServerUrl('/api/ai/realtime/status'), {
          headers: controlServerAuthHeaders(),
        })
        if (response.ok) {
          const data = await response.json()
          setIsAvailable(data.available && data.configured)
        } else {
          setIsAvailable(false)
        }
      } catch {
        setIsAvailable(false)
      }
    }
    checkAvailability()
  }, [])

  // Get ephemeral key from server
  const getEphemeralKey = useCallback(async (): Promise<EphemeralKeyResponse | null> => {
    try {
      const response = await fetch(buildControlServerUrl('/api/ai/realtime/ephemeral-key'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...controlServerAuthHeaders(),
        },
        body: JSON.stringify({
          voice: config.voice || 'cedar',
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || 'Failed to get ephemeral key')
      }

      return await response.json()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to get ephemeral key'
      setError(message)
      configRef.current.onError?.(message)
      return null
    }
  }, [config.voice])

  // Handle incoming data channel messages
  const handleDataChannelMessage = useCallback((event: MessageEvent) => {
    try {
      const message = JSON.parse(event.data)

      switch (message.type) {
        case 'response.audio_transcript.delta':
        case 'response.text.delta':
          // Streaming transcript from assistant
          configRef.current.onResponse?.(message.delta || '')
          break

        case 'input_audio_buffer.speech_started':
          updateStatus('listening')
          break

        case 'input_audio_buffer.speech_stopped':
          updateStatus('processing')
          break

        case 'response.audio.delta':
          // Audio is being played
          if (status !== 'speaking') {
            updateStatus('speaking')
            configRef.current.onAudioStart?.()
          }
          break

        case 'response.done':
          updateStatus('connected')
          configRef.current.onAudioEnd?.()
          break

        case 'conversation.item.input_audio_transcription.delta': {
          const delta = typeof message.delta === 'string' ? message.delta : ''
          if (delta) configRef.current.onTranscript?.(delta, false)
          break
        }

        case 'conversation.item.input_audio_transcription.completed':
          // User's speech transcribed
          configRef.current.onTranscript?.(
            typeof message.transcript === 'string'
              ? message.transcript
              : typeof message.text === 'string'
                ? message.text
                : typeof message.transcription?.text === 'string'
                  ? message.transcription.text
                  : '',
            true
          )
          break

        case 'error': {
          const errorMsg = message.error?.message || 'Realtime API error'
          setError(errorMsg)
          configRef.current.onError?.(errorMsg)
          break
        }
      }
    } catch (err) {
      console.warn('Failed to parse data channel message:', err)
    }
  }, [status, updateStatus])

  // Connect to Realtime API via WebRTC
  const connect = useCallback(async (): Promise<boolean> => {
    if (peerConnectionRef.current) {
      console.warn('Already connected')
      return true
    }

    setError(null)
    updateStatus('connecting')

    try {
      // 1. Get ephemeral key
      const keyData = await getEphemeralKey()
      if (!keyData) {
        updateStatus('error')
        return false
      }

      // 2. Get microphone access
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 24000, // OpenAI Realtime requires 24kHz
          channelCount: 1,
        },
      })
      localStreamRef.current = stream

      // 3. Create peer connection
      const pc = new RTCPeerConnection({
        // Use a small STUN set for better connectivity across NATs.
        // OpenAI can still negotiate fine when these are present, and it improves
        // real-world connection rates (especially on mobile/hotel networks).
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun.cloudflare.com:3478' },
        ],
      })
      peerConnectionRef.current = pc

      // 4. Add microphone track
      stream.getTracks().forEach(track => {
        pc.addTrack(track, stream)
      })

      // 5. Handle remote audio
      pc.ontrack = (event) => {
        const audio = remoteAudioRef.current || new Audio()
        remoteAudioRef.current = audio
        audio.autoplay = true
        audio.srcObject = event.streams[0]

        // Some browsers still require an explicit play() call, even with autoplay,
        // and will reject it if the user hasn't interacted.
        const playPromise = audio.play()
        if (playPromise) {
          playPromise.catch((err) => {
            console.warn('Realtime audio playback blocked:', err)
            configRef.current.onError?.('Audio playback was blocked by the browser. Click Start Speaking again to enable audio.')
          })
        }
      }

      // 6. Create data channel for events
      const dataChannel = pc.createDataChannel('oai-events')
      dataChannelRef.current = dataChannel

      dataChannel.onopen = () => {
        console.log('Data channel opened')
        // Configure session for transcription
        dataChannel.send(JSON.stringify({
          type: 'session.update',
          session: {
            modalities: ['text', 'audio'],
            input_audio_transcription: {
              model: 'whisper-1', // For transcribing user input
            },
            turn_detection: {
              type: 'semantic_vad',
              eagerness: 'medium',
              create_response: true,
            },
          },
        }))
      }

      dataChannel.onmessage = handleDataChannelMessage

      dataChannel.onerror = (err) => {
        console.error('Data channel error:', err)
        setError('Connection error')
        configRef.current.onError?.('Connection error')
      }

      // 7. Create and set local description (SDP offer)
      const offer = await pc.createOffer()
      await pc.setLocalDescription(offer)

      // Ensure ICE candidates are included in the SDP before sending to OpenAI.
      // Without this, some browsers/network combos will never connect.
      await new Promise<void>((resolve, reject) => {
        if (pc.iceGatheringState === 'complete') return resolve()

        const timeout = window.setTimeout(() => {
          pc.removeEventListener('icegatheringstatechange', onStateChange)
          reject(new Error('ICE gathering timed out'))
        }, 8000)

        const onStateChange = () => {
          if (pc.iceGatheringState === 'complete') {
            window.clearTimeout(timeout)
            pc.removeEventListener('icegatheringstatechange', onStateChange)
            resolve()
          }
        }

        pc.addEventListener('icegatheringstatechange', onStateChange)
      })

      // 8. Send offer to OpenAI and get answer
      const abortController = new AbortController()
      const abortTimeout = window.setTimeout(() => abortController.abort(), 20000)

      const sdpResponse = await fetch(keyData.sdpUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${keyData.ephemeralKey}`,
          'Content-Type': 'application/sdp',
          ...(keyData.apiVersion ? { 'OpenAI-Beta': `realtime=${keyData.apiVersion}` } : {}),
        },
        body: pc.localDescription?.sdp || offer.sdp,
        signal: abortController.signal,
      })
      window.clearTimeout(abortTimeout)

      if (!sdpResponse.ok) {
        throw new Error('Failed to exchange SDP with OpenAI')
      }

      const answerSdp = await sdpResponse.text()

      // 9. Set remote description
      await pc.setRemoteDescription({
        type: 'answer',
        sdp: answerSdp,
      })

      // 10. Wait for connection
      pc.onconnectionstatechange = () => {
        switch (pc.connectionState) {
          case 'connected':
            updateStatus('connected')
            break
          case 'disconnected':
          case 'failed':
            updateStatus('disconnected')
            disconnect()
            break
        }
      }

      // Best-effort: treat "connected" as success; otherwise allow fallbacks.
      const connected = await new Promise<boolean>((resolve) => {
        if (pc.connectionState === 'connected') return resolve(true)

        const timeout = window.setTimeout(() => {
          pc.removeEventListener('connectionstatechange', onStateChange)
          resolve(false)
        }, 8000)

        const onStateChange = () => {
          if (pc.connectionState === 'connected') {
            window.clearTimeout(timeout)
            pc.removeEventListener('connectionstatechange', onStateChange)
            resolve(true)
          }
          if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
            window.clearTimeout(timeout)
            pc.removeEventListener('connectionstatechange', onStateChange)
            resolve(false)
          }
        }

        pc.addEventListener('connectionstatechange', onStateChange)
      })

      if (!connected) {
        throw new Error('Realtime voice connection timed out')
      }

      return true
    } catch (err) {
      console.error('WebRTC connection error:', err)
      const message = err instanceof Error ? err.message : 'Connection failed'
      setError(message)
      configRef.current.onError?.(message)
      updateStatus('error')
      disconnect()
      return false
    }
  }, [getEphemeralKey, handleDataChannelMessage, updateStatus])

  // Disconnect from Realtime API
  const disconnect = useCallback(() => {
    // Close data channel
    if (dataChannelRef.current) {
      dataChannelRef.current.close()
      dataChannelRef.current = null
    }

    // Close peer connection
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close()
      peerConnectionRef.current = null
    }

    // Stop local stream
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop())
      localStreamRef.current = null
    }

    // Stop remote audio
    if (remoteAudioRef.current) {
      remoteAudioRef.current.srcObject = null
      remoteAudioRef.current = null
    }

    updateStatus('idle')
  }, [updateStatus])

  // Send text message (for hybrid mode)
  const sendText = useCallback((text: string) => {
    if (!dataChannelRef.current || dataChannelRef.current.readyState !== 'open') {
      console.warn('Data channel not open')
      return
    }

    dataChannelRef.current.send(JSON.stringify({
      type: 'conversation.item.create',
      item: {
        type: 'message',
        role: 'user',
        content: [{ type: 'input_text', text }],
      },
    }))

    // Request response
    dataChannelRef.current.send(JSON.stringify({
      type: 'response.create',
    }))
  }, [])

  // Interrupt current response
  const interrupt = useCallback(() => {
    if (!dataChannelRef.current || dataChannelRef.current.readyState !== 'open') {
      return
    }

    dataChannelRef.current.send(JSON.stringify({
      type: 'response.cancel',
    }))
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnect()
    }
  }, [disconnect])

  return {
    status,
    isAvailable,
    error,
    connect,
    disconnect,
    sendText,
    interrupt,
    isConnected: status === 'connected' || status === 'listening' || status === 'processing' || status === 'speaking',
  }
}
