import { and, asc, count, gte, isNotNull, lte, ne } from 'drizzle-orm'
import { Hono } from 'hono'
import { db } from '../db/client.js'
import { days, sessions, tracks, units } from '../db/schema.js'
import { minutesSum, studiedDates } from '../lib/activity.js'
import { addDays, streak, weekStart } from '../lib/dates.js'
import { dateParam } from '../lib/http.js'
import { WEEK_TARGET_MINUTES } from './today.js'

const HEATMAP_WEEKS = 12

export const progressRoutes = new Hono()

progressRoutes.get('/progress', async (c) => {
  const date = dateParam(c.req.query('date'))
  const from = addDays(weekStart(date), -7 * (HEATMAP_WEEKS - 1))

  const [trackRows, unitCounts, trackMinutes, daily, studied, [drafted], [posted]] = await Promise.all([
    db.select().from(tracks).orderBy(asc(tracks.position)),
    db
      .select({ trackId: units.trackId, status: units.status, n: count() })
      .from(units)
      .groupBy(units.trackId, units.status),
    db.select({ trackId: sessions.trackId, minutes: minutesSum }).from(sessions).groupBy(sessions.trackId),
    db
      .select({ date: sessions.date, minutes: minutesSum })
      .from(sessions)
      .where(and(gte(sessions.date, from), lte(sessions.date, addDays(date, 6))))
      .groupBy(sessions.date),
    studiedDates(),
    db.select({ n: count() }).from(days).where(ne(days.postDraft, '')),
    db.select({ n: count() }).from(days).where(isNotNull(days.postedAt)),
  ])

  const minutesOn = new Map(daily.map((d) => [d.date, d.minutes]))
  const heatmap = Array.from({ length: HEATMAP_WEEKS * 7 }, (_, i) => {
    const day = addDays(from, i)
    return { date: day, minutes: minutesOn.get(day) ?? 0 }
  })
  const weeks = Array.from({ length: HEATMAP_WEEKS }, (_, w) => ({
    start: heatmap[w * 7]!.date,
    minutes: heatmap.slice(w * 7, w * 7 + 7).reduce((sum, d) => sum + d.minutes, 0),
  }))

  const trackStats = trackRows.map((t) => {
    const statuses = unitCounts.filter((u) => u.trackId === t.id)
    const n = (status: string) => statuses.find((u) => u.status === status)?.n ?? 0
    return {
      ...t,
      unitsDone: n('done'),
      unitsInProgress: n('in_progress'),
      unitsTotal: t.totalUnits ?? statuses.reduce((sum, u) => sum + u.n, 0),
      minutes: trackMinutes.find((m) => m.trackId === t.id)?.minutes ?? 0,
    }
  })

  return c.json({
    tracks: trackStats,
    heatmap,
    weeks,
    weekTargetMinutes: WEEK_TARGET_MINUTES,
    totalMinutes: trackStats.reduce((sum, t) => sum + t.minutes, 0),
    studyDays: studied.size,
    streak: streak(studied, date),
    postsDrafted: drafted?.n ?? 0,
    postsPosted: posted?.n ?? 0,
  })
})
