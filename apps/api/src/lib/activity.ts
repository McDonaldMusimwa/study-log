import { gt, sql } from 'drizzle-orm'
import { db } from '../db/client.js'
import { sessions } from '../db/schema.js'

// Every date with logged study time.
export async function studiedDates() {
  const rows = await db
    .selectDistinct({ date: sessions.date })
    .from(sessions)
    .where(gt(sessions.minutes, 0))
  return new Set(rows.map((r) => r.date))
}

// "Day N": how many study days up to and including `date`, counting `date` itself even before any session.
export function dayNumber(studied: Set<string>, date: string) {
  let n = 0
  for (const d of studied) if (d <= date) n++
  return studied.has(date) ? n : n + 1
}

export const minutesSum = sql<number>`coalesce(sum(${sessions.minutes}), 0)`.mapWith(Number)
