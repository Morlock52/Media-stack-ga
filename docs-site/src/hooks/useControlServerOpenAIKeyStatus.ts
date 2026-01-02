import { useMemo } from 'react'
import { useControlServerStatus, BaseControlServerStatus } from './useControlServerStatus'

export interface ControlServerOpenAIKeyStatus extends BaseControlServerStatus {
  hasKey: boolean | null
  model?: string
  ttsModel?: string
  ttsVoice?: string
}

export function useControlServerOpenAIKeyStatus() {
  const transform = useMemo(
    () => (data: unknown) => {
      const d = data as Record<string, unknown>
      return {
        hasKey: Boolean(d?.hasKey),
        model: typeof d?.model === 'string' ? d.model : undefined,
        ttsModel: typeof d?.ttsModel === 'string' ? d.ttsModel : undefined,
        ttsVoice: typeof d?.ttsVoice === 'string' ? d.ttsVoice : undefined,
      }
    },
    []
  )

  return useControlServerStatus<ControlServerOpenAIKeyStatus>({
    endpoint: '/api/settings/openai-key',
    transform,
    initialState: { hasKey: null },
  })
}
