import { useEffect, useState } from 'react'

const pad = (n: number) => String(n).padStart(2, '0')

// The browser's own calendar date, which is what "today" means everywhere in the app.
export function localDate(d = new Date()) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function parseDate(date: string) {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(y!, m! - 1, d!)
}

export function addDays(date: string, days: number) {
  const d = parseDate(date)
  d.setDate(d.getDate() + days)
  return localDate(d)
}

// Start and end of a local calendar day as ISO instants, for the GitHub commit window.
export function dayBounds(date: string) {
  return { since: parseDate(date).toISOString(), until: parseDate(addDays(date, 1)).toISOString() }
}

export function formatDay(date: string, options: Intl.DateTimeFormatOptions = { weekday: 'long', day: 'numeric', month: 'long' }) {
  return parseDate(date).toLocaleDateString(undefined, options)
}

// The local clock time of an instant, e.g. "7:12 AM" or "19:05" depending on the browser's locale.
export function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

// The routine has no fixed times, only an order: morning sessions first, then the after-work ones.
export function partOfDay(startTime: string) {
  return startTime < '12:00' ? 'Morning' : 'After work'
}

export function formatMinutes(minutes: number) {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (!h) return `${m}m`
  return m ? `${h}h ${m}m` : `${h}h`
}

export function formatClock(seconds: number) {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor(seconds / 60) % 60
  const s = seconds % 60
  return h ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`
}

// Re-renders every second while `active`, for running timers.
export function useNow(active: boolean) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!active) return
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [active])
  return now
}

// Today's date, rolling over at midnight if the tab stays open.
export function useToday() {
  const [today, setToday] = useState(localDate)
  useEffect(() => {
    const timer = window.setInterval(() => setToday(localDate()), 60_000)
    return () => window.clearInterval(timer)
  }, [])
  return today
}
