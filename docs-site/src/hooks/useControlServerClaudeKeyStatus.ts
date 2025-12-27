import { useCallback, useEffect, useState } from 'react'
import { buildControlServerUrl, controlServerAuthHeaders } from '../utils/controlServer'

export type ControlServerClaudeKeyStatus = {
  serverOnline: boolean | null
  hasKey: boolean | null
  lastCheckedAt: string | null
  model?: string
}

export function useControlServerClaudeKeyStatus() {
  const [status, setStatus] = useState<ControlServerClaudeKeyStatus>({
    serverOnline: null,
    hasKey: null,
    lastCheckedAt: null,
  })

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(buildControlServerUrl('/api/settings/claude-key'), {
        headers: { ...controlServerAuthHeaders() },
      })
      if (!res.ok) throw new Error('Control server unreachable')
      const data = await res.json()
      setStatus({
        serverOnline: true,
        hasKey: Boolean(data?.hasKey),
        lastCheckedAt: new Date().toISOString(),
        model: typeof data?.model === 'string' ? data.model : undefined,
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
