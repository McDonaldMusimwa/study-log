import { and, asc, eq, gt, isNull, lte } from 'drizzle-orm'
import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { z } from 'zod'
import { db } from '../db/client.js'
import { reviewItems, tracks } from '../db/schema.js'
import { addDays, isDate } from '../lib/dates.js'
import { body, dateParam, idParam } from '../lib/http.js'
import { nextReview } from '../lib/review.js'

export const reviewRoutes = new Hono()

const withTrack = { item: reviewItems, track: { name: tracks.name, color: tracks.color } }

reviewRoutes.get('/reviews', async (c) => {
  const date = dateParam(c.req.query('date'))
  const active = isNull(reviewItems.retiredAt)
  const [due, upcoming] = await Promise.all([
    db
      .select(withTrack)
      .from(reviewItems)
      .innerJoin(tracks, eq(tracks.id, reviewItems.trackId))
      .where(and(active, lte(reviewItems.dueOn, date)))
      .orderBy(asc(reviewItems.dueOn), asc(reviewItems.id)),
    db
      .select(withTrack)
      .from(reviewItems)
      .innerJoin(tracks, eq(tracks.id, reviewItems.trackId))
      .where(and(active, gt(reviewItems.dueOn, date)))
      .orderBy(asc(reviewItems.dueOn), asc(reviewItems.id)),
  ])
  const flatten = (rows: typeof due) => rows.map(({ item, track }) => ({ ...item, track }))
  return c.json({ due: flatten(due), upcoming: flatten(upcoming) })
})

// New items come back tomorrow: the first spaced repetition.
reviewRoutes.post('/reviews', async (c) => {
  const input = await body(
    c,
    z.object({
      date: z.string().refine(isDate),
      trackId: z.number().int(),
      prompt: z.string().trim().min(1).max(500),
      answer: z.string().max(20_000).default(''),
      answerBody: z.unknown().optional(),
    }),
  )
  const { date, ...fields } = input
  const [item] = await db
    .insert(reviewItems)
    .values({ ...fields, dueOn: addDays(date, 1) })
    .returning()
  return c.json(item, 201)
})

reviewRoutes.post('/reviews/:id/grade', async (c) => {
  const id = idParam(c.req.param('id'))
  const input = await body(c, z.object({ result: z.enum(['again', 'good']), date: z.string().refine(isDate) }))
  const [item] = await db.select().from(reviewItems).where(eq(reviewItems.id, id))
  if (!item) throw new HTTPException(404, { message: 'Review item not found' })

  const next = nextReview(item.step, input.result, input.date)
  const [updated] = await db
    .update(reviewItems)
    .set({ step: next.step, dueOn: next.dueOn, lastResult: input.result, retiredAt: next.retired ? new Date() : null })
    .where(eq(reviewItems.id, id))
    .returning()
  return c.json(updated)
})

reviewRoutes.delete('/reviews/:id', async (c) => {
  await db.delete(reviewItems).where(eq(reviewItems.id, idParam(c.req.param('id'))))
  return c.body(null, 204)
})
