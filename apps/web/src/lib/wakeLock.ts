import { useEffect } from 'react'

// Keeps a phone's screen on while `active`, so the timer stays visible and chimes on time.
// Browsers drop the lock when the tab is hidden, so it's requested again when the tab comes back.
export function useWakeLock(active: boolean) {
  useEffect(() => {
    if (!active || !('wakeLock' in navigator)) return
    let lock: WakeLockSentinel | null = null
    let cancelled = false

    const request = async () => {
      if (document.visibilityState !== 'visible') return
      try {
        lock = await navigator.wakeLock.request('screen')
        if (cancelled) void lock.release()
      } catch {
        // Denied (battery saver, unsupported context): the timer still works, the screen may just sleep.
      }
    }
    const onVisible = () => void request()

    void request()
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', onVisible)
      void lock?.release()
    }
  }, [active])
}
