import { useCallback, useEffect, useState } from 'react'
import { buildControlServerUrl, controlServerAuthHeaders } from '../utils/controlServer'

export type ControlServerTtsStatus = {
  serverOnline: boolean | null
  lastCheckedAt: string | null
  defaultProvider?: string
  openai?: { hasKey: boolean; ttsModel?: string; ttsVoice?: string }
  elevenlabs?: { hasKey: boolean; ttsModel?: string; voiceId?: string }
}

export function useControlServerTtsStatus() {
  const [status, setStatus] = useState<ControlServerTtsStatus>({
    serverOnline: null,
    lastCheckedAt: null,
  })

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(buildControlServerUrl('/api/settings/tts'), {
        headers: { ...controlServerAuthHeaders() },
      })
      if (!res.ok) throw new Error('Control server unreachable')
      const data = await res.json()
      setStatus({
        serverOnline: true,
        lastCheckedAt: new Date().toISOString(),
        defaultProvider: typeof data?.defaultProvider === 'string' ? data.defaultProvider : undefined,
        openai: data?.openai
          ? {
              hasKey: Boolean(data.openai.hasKey),
              ttsModel: typeof data.openai.ttsModel === 'string' ? data.openai.ttsModel : undefined,
              ttsVoice: typeof data.openai.ttsVoice === 'string' ? data.openai.ttsVoice : undefined,
            }
          : undefined,
        elevenlabs: data?.elevenlabs
          ? {
              hasKey: Boolean(data.elevenlabs.hasKey),
              ttsModel: typeof data.elevenlabs.ttsModel === 'string' ? data.elevenlabs.ttsModel : undefined,
              voiceId: typeof data.elevenlabs.voiceId === 'string' ? data.elevenlabs.voiceId : undefined,
            }
          : undefined,
      })
    } catch {
      setStatus((prev) => ({
        ...prev,
        serverOnline: false,
        lastCheckedAt: new Date().toISOString(),
      }))
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  return { ...status, refresh }
}

