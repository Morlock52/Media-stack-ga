import { useMemo } from 'react'
import { useControlServerStatus, BaseControlServerStatus } from './useControlServerStatus'

export interface ControlServerTtsStatus extends BaseControlServerStatus {
  defaultProvider?: string
  openai?: { hasKey: boolean; ttsModel?: string; ttsVoice?: string }
  elevenlabs?: { hasKey: boolean; ttsModel?: string; voiceId?: string }
}

export function useControlServerTtsStatus() {
  const transform = useMemo(
    () => (data: unknown) => {
      const d = data as Record<string, unknown>
      return {
        defaultProvider: typeof d?.defaultProvider === 'string' ? d.defaultProvider : undefined,
        openai: d?.openai
          ? {
              hasKey: Boolean((d.openai as Record<string, unknown>)?.hasKey),
              ttsModel:
                typeof (d.openai as Record<string, unknown>)?.ttsModel === 'string'
                  ? ((d.openai as Record<string, unknown>).ttsModel as string)
                  : undefined,
              ttsVoice:
                typeof (d.openai as Record<string, unknown>)?.ttsVoice === 'string'
                  ? ((d.openai as Record<string, unknown>).ttsVoice as string)
                  : undefined,
            }
          : undefined,
        elevenlabs: d?.elevenlabs
          ? {
              hasKey: Boolean((d.elevenlabs as Record<string, unknown>)?.hasKey),
              ttsModel:
                typeof (d.elevenlabs as Record<string, unknown>)?.ttsModel === 'string'
                  ? ((d.elevenlabs as Record<string, unknown>).ttsModel as string)
                  : undefined,
              voiceId:
                typeof (d.elevenlabs as Record<string, unknown>)?.voiceId === 'string'
                  ? ((d.elevenlabs as Record<string, unknown>).voiceId as string)
                  : undefined,
            }
          : undefined,
      }
    },
    []
  )

  return useControlServerStatus<ControlServerTtsStatus>({
    endpoint: '/api/settings/tts',
    transform,
  })
}
