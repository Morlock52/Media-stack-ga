/**
 * useAudioMutex - Prevents concurrent audio playback
 *
 * Uses async-mutex to ensure only one audio stream plays at a time.
 * This prevents overlapping TTS output when multiple speak() calls
 * happen in quick succession.
 *
 * Features:
 * - FIFO queue for speak requests
 * - Force-stop current playback when new high-priority request arrives
 * - Automatic cleanup on component unmount
 * - Status callbacks for UI feedback
 */

import { Mutex, MutexInterface } from 'async-mutex'
import { useCallback, useRef, useEffect } from 'react'

export interface AudioMutexOptions {
  /** Called when mutex is acquired (audio about to start) */
  onAcquire?: () => void
  /** Called when mutex is released (audio finished or stopped) */
  onRelease?: () => void
  /** Called when waiting for mutex (audio queued) */
  onWaiting?: () => void
  /** Called when current playback is force-stopped */
  onForceStop?: () => void
}

export interface AudioMutexReturn {
  /** Acquire the mutex lock. Returns a release function. */
  acquire: () => Promise<MutexInterface.Releaser>
  /** Force release the mutex (stops current playback) */
  forceRelease: () => void
  /** Check if mutex is currently locked */
  isLocked: () => boolean
  /** Cancel any waiting acquisitions */
  cancelWaiting: () => void
}

/**
 * Hook for managing exclusive audio playback access
 */
export function useAudioMutex(options: AudioMutexOptions = {}): AudioMutexReturn {
  const mutexRef = useRef(new Mutex())
  const releaseRef = useRef<MutexInterface.Releaser | null>(null)
  const optionsRef = useRef(options)
  const abortControllerRef = useRef<AbortController | null>(null)

  // Keep options ref updated
  optionsRef.current = options

  const acquire = useCallback(async (): Promise<MutexInterface.Releaser> => {
    // Create abort controller for this acquisition
    abortControllerRef.current = new AbortController()

    // Notify if we're going to wait
    if (mutexRef.current.isLocked()) {
      optionsRef.current.onWaiting?.()
    }

    // Acquire the mutex (waits if locked)
    const release = await mutexRef.current.acquire()
    releaseRef.current = release
    optionsRef.current.onAcquire?.()

    // Return wrapped release function
    return () => {
      if (releaseRef.current === release) {
        releaseRef.current = null
        optionsRef.current.onRelease?.()
        release()
      }
    }
  }, [])

  const forceRelease = useCallback(() => {
    // Abort any pending operations
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      abortControllerRef.current = null
    }

    // Release the mutex
    if (releaseRef.current) {
      optionsRef.current.onForceStop?.()
      const release = releaseRef.current
      releaseRef.current = null
      optionsRef.current.onRelease?.()
      release()
    }
  }, [])

  const cancelWaiting = useCallback(() => {
    // Cancel the abort controller to reject pending acquisitions
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      abortControllerRef.current = null
    }
  }, [])

  const isLocked = useCallback(() => {
    return mutexRef.current.isLocked()
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      forceRelease()
    }
  }, [forceRelease])

  return {
    acquire,
    forceRelease,
    isLocked,
    cancelWaiting,
  }
}

/**
 * Singleton audio mutex for global audio coordination
 *
 * Use this when you need to coordinate audio across multiple components
 * that don't share a common parent with useAudioMutex.
 */
class GlobalAudioMutex {
  private mutex = new Mutex()
  private currentRelease: MutexInterface.Releaser | null = null
  private stopCallbacks: Set<() => void> = new Set()

  /**
   * Acquire exclusive audio access
   * @param onStop - Callback to invoke if playback is force-stopped
   */
  async acquire(onStop?: () => void): Promise<() => void> {
    // If something is playing, stop it first
    if (this.currentRelease && onStop) {
      this.stopCurrent()
    }

    const release = await this.mutex.acquire()
    this.currentRelease = release

    if (onStop) {
      this.stopCallbacks.add(onStop)
    }

    return () => {
      if (onStop) {
        this.stopCallbacks.delete(onStop)
      }
      if (this.currentRelease === release) {
        this.currentRelease = null
        release()
      }
    }
  }

  /**
   * Stop current playback and release the mutex
   */
  stopCurrent(): void {
    // Call all stop callbacks
    this.stopCallbacks.forEach(cb => {
      try {
        cb()
      } catch (err) {
        console.warn('Stop callback error:', err)
      }
    })
    this.stopCallbacks.clear()

    // Release mutex
    if (this.currentRelease) {
      const release = this.currentRelease
      this.currentRelease = null
      release()
    }
  }

  /**
   * Check if audio is currently playing
   */
  isPlaying(): boolean {
    return this.mutex.isLocked()
  }
}

// Export singleton instance
export const globalAudioMutex = new GlobalAudioMutex()
