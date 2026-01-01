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

        case 'conversation.item.input_audio_transcription.completed':
          // User's speech transcribed
          configRef.current.onTranscript?.(message.transcript || '', true)
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
  const connect = useCallback(async () => {
    if (peerConnectionRef.current) {
      console.warn('Already connected')
      return
    }

    setError(null)
    updateStatus('connecting')

    try {
      // 1. Get ephemeral key
      const keyData = await getEphemeralKey()
      if (!keyData) {
        updateStatus('error')
        return
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
        iceServers: [], // OpenAI handles ICE
      })
      peerConnectionRef.current = pc

      // 4. Add microphone track
      stream.getTracks().forEach(track => {
        pc.addTrack(track, stream)
      })

      // 5. Handle remote audio
      pc.ontrack = (event) => {
        if (!remoteAudioRef.current) {
          remoteAudioRef.current = new Audio()
          remoteAudioRef.current.autoplay = true
        }
        remoteAudioRef.current.srcObject = event.streams[0]
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

      // 8. Send offer to OpenAI and get answer
      const sdpResponse = await fetch(keyData.sdpUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${keyData.ephemeralKey}`,
          'Content-Type': 'application/sdp',
        },
        body: offer.sdp,
      })

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

    } catch (err) {
      console.error('WebRTC connection error:', err)
      const message = err instanceof Error ? err.message : 'Connection failed'
      setError(message)
      configRef.current.onError?.(message)
      updateStatus('error')
      disconnect()
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
