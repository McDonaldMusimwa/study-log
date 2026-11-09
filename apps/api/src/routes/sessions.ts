import { and, eq, isNull } from 'drizzle-orm'
import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { z } from 'zod'
import { db } from '../db/client.js'
import { sessions, units } from '../db/schema.js'
import { isDate } from '../lib/dates.js'
import { body, idParam } from '../lib/http.js'

export const sessionRoutes = new Hono()

const elapsedMinutes = (startedAt: Date) => Math.max(1, Math.round((Date.now() - startedAt.getTime()) / 60_000))

// Starting work on a unit moves it out of "todo".
async function markStarted(unitId: number | null | undefined) {
  if (unitId) await db.update(units).set({ status: 'in_progress' }).where(and(eq(units.id, unitId), eq(units.status, 'todo')))
}

// Starts a timer, or logs a finished session when `minutes` is given. Only one timer runs at a time.
sessionRoutes.post('/sessions', async (c) => {
  const input = await body(
    c,
    z.object({
      date: z.string().refine(isDate),
      trackId: z.number().int(),
      blockId: z.number().int().nullish(),
      unitId: z.number().int().nullish(),
      minutes: z.number().int().min(1).max(600).optional(),
      learned: z.string().max(4000).optional(),
      produced: z.string().max(2000).optional(),
    }),
  )

  const session = await db.transaction(async (tx) => {
    for (const open of await tx.select().from(sessions).where(isNull(sessions.endedAt))) {
      await tx
        .update(sessions)
        .set({ endedAt: new Date(), minutes: elapsedMinutes(open.startedAt) })
        .where(eq(sessions.id, open.id))
    }
    const [created] = await tx
      .insert(sessions)
      .values({ ...input, endedAt: input.minutes ? new Date() : null, minutes: input.minutes ?? 0 })
      .returning()
    return created
  })
  await markStarted(input.unitId)
  return c.json(session, 201)
})

sessionRoutes.patch('/sessions/:id', async (c) => {
  const id = idParam(c.req.param('id'))
  const input = await body(
    c,
    z.object({
      stop: z.boolean().optional(),
      unitId: z.number().int().nullish(),
      minutes: z.number().int().min(0).max(600).optional(),
      learned: z.string().max(4000).optional(),
      produced: z.string().max(2000).optional(),
    }),
  )
  const [current] = await db.select().from(sessions).where(eq(sessions.id, id))
  if (!current) throw new HTTPException(404, { message: 'Session not found' })

  const { stop, ...fields } = input
  const stopping = stop && !current.endedAt
  const [session] = await db
    .update(sessions)
    .set({
      ...fields,
      ...(stopping && { endedAt: new Date(), minutes: fields.minutes ?? elapsedMinutes(current.startedAt) }),
    })
    .where(eq(sessions.id, id))
    .returning()
  await markStarted(input.unitId)
  return c.json(session)
})

sessionRoutes.delete('/sessions/:id', async (c) => {
  await db.delete(sessions).where(eq(sessions.id, idParam(c.req.param('id'))))
  return c.body(null, 204)
})
