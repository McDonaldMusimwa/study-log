// Dates travel as YYYY-MM-DD strings in the user's own calendar; the browser decides what "today" is.
const DAY_MS = 86_400_000

const toUtc = (date: string) => new Date(`${date}T00:00:00Z`)

export function addDays(date: string, days: number) {
  return new Date(toUtc(date).getTime() + days * DAY_MS).toISOString().slice(0, 10)
}

// ISO weekday: 1 = Monday ... 7 = Sunday.
export function isoWeekday(date: string) {
  return toUtc(date).getUTCDay() || 7
}

export function weekStart(date: string) {
  return addDays(date, 1 - isoWeekday(date))
}

export function isDate(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(toUtc(value).getTime())
}

// Consecutive study days ending at `date`. Weekends and a not-yet-started today don't break it.
export function streak(studied: Set<string>, date: string) {
  let count = 0
  for (let day = date, i = 0; i < 400; day = addDays(day, -1), i++) {
    if (studied.has(day)) count++
    else if (day === date || isoWeekday(day) >= 6) continue
    else break
  }
  return count
}
