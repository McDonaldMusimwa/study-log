import { and, asc, count, eq, gte, isNull, lte } from 'drizzle-orm'
import { Hono } from 'hono'
import { db } from '../db/client.js'
import { reviewItems, scheduleBlocks, sessions, tracks, units } from '../db/schema.js'
import { dayNumber, minutesSum, studiedDates } from '../lib/activity.js'
import { addDays, isoWeekday, streak, weekStart } from '../lib/dates.js'
import { dateParam } from '../lib/http.js'

// 14 hours a week: the lower end of the 14-15 hour routine.
export const WEEK_TARGET_MINUTES = 14 * 60

export const todayRoutes = new Hono()

todayRoutes.get('/today', async (c) => {
  const date = dateParam(c.req.query('date'))
  const monday = weekStart(date)

  const [blocks, daySessions, [week], [due], studied, running] = await Promise.all([
    db
      .select({ block: scheduleBlocks, track: tracks })
      .from(scheduleBlocks)
      .innerJoin(tracks, eq(tracks.id, scheduleBlocks.trackId))
      .where(eq(scheduleBlocks.weekday, isoWeekday(date)))
      .orderBy(asc(scheduleBlocks.startTime)),
    db
      .select({ session: sessions, unitTitle: units.title })
      .from(sessions)
      .leftJoin(units, eq(units.id, sessions.unitId))
      .where(eq(sessions.date, date))
      .orderBy(asc(sessions.startedAt)),
    db
      .select({ minutes: minutesSum })
      .from(sessions)
      .where(and(gte(sessions.date, monday), lte(sessions.date, addDays(monday, 6)))),
    db
      .select({ n: count() })
      .from(reviewItems)
      .where(and(lte(reviewItems.dueOn, date), isNull(reviewItems.retiredAt))),
    studiedDates(),
    db.select().from(sessions).where(isNull(sessions.endedAt)).limit(1),
  ])

  const withUnit = daySessions.map(({ session, unitTitle }) => ({ ...session, unitTitle }))
  const planned = blocks.map(({ block, track }) => ({
    ...block,
    track,
    sessions: withUnit.filter((s) => s.blockId === block.id),
  }))
  const unplanned = withUnit.filter((s) => !blocks.some(({ block }) => block.id === s.blockId))

  return c.json({
    date,
    dayNumber: dayNumber(studied, date),
    streak: streak(studied, date),
    blocks: planned,
    unplanned,
    running: running[0] ?? null,
    plannedMinutes: blocks.reduce((sum, { block }) => sum + block.minutes, 0),
    dayMinutes: withUnit.reduce((sum, s) => sum + s.minutes, 0),
    weekMinutes: week?.minutes ?? 0,
    weekTargetMinutes: WEEK_TARGET_MINUTES,
    weekStart: monday,
    weekStudied: Array.from({ length: 7 }, (_, i) => addDays(monday, i)).filter((d) => studied.has(d)),
    reviewDue: due?.n ?? 0,
  })
})
