import type { Session } from './api'

// The classic cycle: 25 minutes of focus, a 5-minute break, and a longer break after every fourth round.
export const FOCUS_MS = 25 * 60_000
export const SHORT_BREAK_MS = 5 * 60_000
export const LONG_BREAK_MS = 15 * 60_000
export const LONG_BREAK_EVERY = 4

export type Phase = 'focus' | 'break' | 'paused'

export function timerState(session: Session, now: number) {
  const pausedAt = session.pausedAt ? Date.parse(session.pausedAt) : null
  const pausedMs = session.pausedMs + (pausedAt ? now - pausedAt : 0)
  const focusedMs = Math.max(0, now - Date.parse(session.startedAt) - pausedMs)
  const phase: Phase = pausedAt ? (session.pauseKind === 'break' ? 'break' : 'paused') : 'focus'

  // A break is long when it follows every fourth Pomodoro (the count already includes the one just finished).
  const longBreak = session.pomodoros > 0 && session.pomodoros % LONG_BREAK_EVERY === 0
  const breakMs = longBreak ? LONG_BREAK_MS : SHORT_BREAK_MS

  return {
    phase,
    focusedMs,
    longBreak,
    breakMs,
    // Focus time into the current round, and what's left of it.
    roundMs: focusedMs - session.pomodoros * FOCUS_MS,
    focusLeftMs: FOCUS_MS - (focusedMs - session.pomodoros * FOCUS_MS),
    breakLeftMs: phase === 'break' && pausedAt ? breakMs - (now - pausedAt) : 0,
  }
}

// How many Pomodoros fit a planned block: one per 30 minutes (25 of focus plus a 5-minute break).
export function plannedRounds(minutes: number) {
  return Math.max(1, Math.round(minutes / 30))
}

// A soft two-note chime, so phase changes are noticed without looking at the tab.
export function chime() {
  try {
    const ctx = new AudioContext()
    ;[660, 880].forEach((freq, i) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.frequency.value = freq
      osc.type = 'sine'
      const start = ctx.currentTime + i * 0.22
      gain.gain.setValueAtTime(0.0001, start)
      gain.gain.exponentialRampToValueAtTime(0.25, start + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.5)
      osc.connect(gain).connect(ctx.destination)
      osc.start(start)
      osc.stop(start + 0.55)
    })
    window.setTimeout(() => void ctx.close(), 1200)
  } catch {
    // No audio available: the on-screen change and notification still happen.
  }
}

// Asked from a click, since browsers only allow the permission prompt after a user gesture.
export function askToNotify() {
  if ('Notification' in window && Notification.permission === 'default') void Notification.requestPermission()
}

export function notify(title: string, body: string) {
  if ('Notification' in window && Notification.permission === 'granted' && document.visibilityState === 'hidden') {
    new Notification(title, { body, icon: '/favicon.svg' })
  }
}
