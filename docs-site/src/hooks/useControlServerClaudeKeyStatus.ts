import { useMemo } from 'react'
import { useControlServerStatus, BaseControlServerStatus } from './useControlServerStatus'

export interface ControlServerClaudeKeyStatus extends BaseControlServerStatus {
  hasKey: boolean | null
  model?: string
}

export function useControlServerClaudeKeyStatus() {
  const transform = useMemo(
    () => (data: unknown) => {
      const d = data as Record<string, unknown>
      return {
        hasKey: Boolean(d?.hasKey),
        model: typeof d?.model === 'string' ? d.model : undefined,
      }
    },
    []
  )

  return useControlServerStatus<ControlServerClaudeKeyStatus>({
    endpoint: '/api/settings/claude-key',
    transform,
    initialState: { hasKey: null },
  })
}
