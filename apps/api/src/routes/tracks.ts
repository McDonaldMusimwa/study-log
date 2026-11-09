import { and, asc, eq, max } from 'drizzle-orm'
import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { z } from 'zod'
import { db } from '../db/client.js'
import { tracks, units } from '../db/schema.js'
import { body, idParam } from '../lib/http.js'

export const trackRoutes = new Hono()

// Tracks with their units, for pickers and the progress page.
trackRoutes.get('/tracks', async (c) => {
  const [trackRows, unitRows] = await Promise.all([
    db.select().from(tracks).orderBy(asc(tracks.position)),
    db.select().from(units).orderBy(asc(units.position), asc(units.id)),
  ])
  return c.json(trackRows.map((t) => ({ ...t, units: unitRows.filter((u) => u.trackId === t.id) })))
})

trackRoutes.post('/units', async (c) => {
  const input = await body(c, z.object({ trackId: z.number().int(), title: z.string().trim().min(1).max(200) }))
  const [existing] = await db
    .select({ id: units.id })
    .from(units)
    .where(and(eq(units.trackId, input.trackId), eq(units.title, input.title)))
  if (existing) return c.json(existing)

  const [last] = await db.select({ position: max(units.position) }).from(units).where(eq(units.trackId, input.trackId))
  const [unit] = await db
    .insert(units)
    .values({ ...input, position: (last?.position ?? 0) + 1 })
    .returning()
  return c.json(unit, 201)
})

trackRoutes.patch('/units/:id', async (c) => {
  const id = idParam(c.req.param('id'))
  const input = await body(c, z.object({ status: z.enum(['todo', 'in_progress', 'done']) }))
  const [unit] = await db
    .update(units)
    .set({ status: input.status, completedAt: input.status === 'done' ? new Date() : null })
    .where(eq(units.id, id))
    .returning()
  if (!unit) throw new HTTPException(404, { message: 'Unit not found' })
  return c.json(unit)
})
