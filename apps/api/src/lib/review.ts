import { addDays } from './dates.js'

// Days until the next review after each successful recall. Past the last step the item retires.
export const INTERVALS = [1, 3, 7, 14, 30]

export function nextReview(step: number, result: 'again' | 'good', today: string) {
  if (result === 'again') return { step: 0, dueOn: addDays(today, 1), retired: false }
  const next = step + 1
  if (next >= INTERVALS.length) return { step: next, dueOn: today, retired: true }
  return { step: next, dueOn: addDays(today, INTERVALS[next]!), retired: false }
}
