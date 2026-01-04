import { useMemo } from 'react'
import { useControlServerStatus, BaseControlServerStatus } from './useControlServerStatus'

export interface ControlServerTtsStatus extends BaseControlServerStatus {
  openai?: { hasKey: boolean; ttsModel?: string; ttsVoice?: string }
}

export function useControlServerTtsStatus() {
  const transform = useMemo(
    () => (data: unknown) => {
      const d = data as Record<string, unknown>
      // New simplified format: { provider: 'openai', hasKey, ttsModel, ttsVoice }
      return {
        openai: {
          hasKey: Boolean(d?.hasKey),
          ttsModel: typeof d?.ttsModel === 'string' ? d.ttsModel : undefined,
          ttsVoice: typeof d?.ttsVoice === 'string' ? d.ttsVoice : undefined,
        },
      }
    },
    []
  )

  return useControlServerStatus<ControlServerTtsStatus>({
    endpoint: '/api/settings/tts',
    transform,
  })
}
