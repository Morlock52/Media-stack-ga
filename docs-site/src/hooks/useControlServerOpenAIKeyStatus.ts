import { useCallback, useEffect, useState } from 'react'
import { buildControlServerUrl, controlServerAuthHeaders } from '../utils/controlServer'

export type ControlServerOpenAIKeyStatus = {
  serverOnline: boolean | null
  hasKey: boolean | null
  lastCheckedAt: string | null
  model?: string
  ttsModel?: string
  ttsVoice?: string
}

export function useControlServerOpenAIKeyStatus() {
  const [status, setStatus] = useState<ControlServerOpenAIKeyStatus>({
    serverOnline: null,
    hasKey: null,
    lastCheckedAt: null,
  })

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(buildControlServerUrl('/api/settings/openai-key'), {
        headers: { ...controlServerAuthHeaders() },
      })
      if (!res.ok) throw new Error('Control server unreachable')
      const data = await res.json()
      setStatus({
        serverOnline: true,
        hasKey: Boolean(data?.hasKey),
        lastCheckedAt: new Date().toISOString(),
        model: typeof data?.model === 'string' ? data.model : undefined,
        ttsModel: typeof data?.ttsModel === 'string' ? data.ttsModel : undefined,
        ttsVoice: typeof data?.ttsVoice === 'string' ? data.ttsVoice : undefined,
      })
    } catch {
      setStatus((prev) => ({
        ...prev,
        serverOnline: false,
        hasKey: null,
        lastCheckedAt: new Date().toISOString(),
      }))
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  return { ...status, refresh }
}
