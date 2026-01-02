/**
 * Generic hook for fetching control server API status
 * Reduces duplication across API key status hooks
 */

import { useCallback, useEffect, useState } from 'react'
import { buildControlServerUrl, controlServerAuthHeaders } from '../utils/controlServer'

export interface BaseControlServerStatus {
  serverOnline: boolean | null
  lastCheckedAt: string | null
}

interface UseControlServerStatusOptions<T extends BaseControlServerStatus> {
  endpoint: string
  transform: (data: unknown) => Omit<T, 'serverOnline' | 'lastCheckedAt'>
  initialState?: Partial<T>
}

/**
 * Generic hook for fetching and managing control server status endpoints
 * @param options Configuration options including endpoint and transform function
 * @returns Status object with refresh function
 */
export function useControlServerStatus<T extends BaseControlServerStatus>(
  options: UseControlServerStatusOptions<T>
): T & { refresh: () => Promise<void> } {
  const { endpoint, transform, initialState = {} } = options

  const [status, setStatus] = useState<T>({
    serverOnline: null,
    lastCheckedAt: null,
    ...initialState,
  } as T)

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(buildControlServerUrl(endpoint), {
        headers: { ...controlServerAuthHeaders() },
      })
      if (!res.ok) throw new Error('Control server unreachable')
      const data = await res.json()
      const transformed = transform(data)
      setStatus({
        ...transformed,
        serverOnline: true,
        lastCheckedAt: new Date().toISOString(),
      } as T)
    } catch {
      setStatus((prev) => ({
        ...prev,
        serverOnline: false,
        lastCheckedAt: new Date().toISOString(),
      }))
    }
  }, [endpoint, transform])

  useEffect(() => {
    refresh()
  }, [refresh])

  return { ...status, refresh }
}
