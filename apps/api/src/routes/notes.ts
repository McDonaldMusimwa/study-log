import { and, desc, eq, type SQL } from 'drizzle-orm'
import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { z } from 'zod'
import { db } from '../db/client.js'
import { notes, sessions, tracks, units } from '../db/schema.js'
import { isDate } from '../lib/dates.js'
import { body, idParam } from '../lib/http.js'

export const noteRoutes = new Hono()

// Drawings are stored as an Excalidraw scene plus an SVG snapshot; 2 MB each is far beyond a typical sketch.
const MAX_DRAWING = 2_000_000

const content = {
  body: z.unknown(),
  text: z.string().max(50_000),
  drawing: z.string().max(MAX_DRAWING).nullable().optional(),
  drawingSvg: z.string().max(MAX_DRAWING).nullable().optional(),
}

const withContext = {
  note: notes,
  track: { name: tracks.name, color: tracks.color },
  unitTitle: units.title,
}

// Notes for a day, a session or a track, newest first.
noteRoutes.get('/notes', async (c) => {
  const { date, sessionId, trackId } = c.req.query()
  const filters: SQL[] = []
  if (date) {
    if (!isDate(date)) throw new HTTPException(400, { message: 'Expected a date as YYYY-MM-DD' })
    filters.push(eq(notes.date, date))
  }
  if (sessionId) filters.push(eq(notes.sessionId, Number(sessionId)))
  if (trackId) filters.push(eq(notes.trackId, Number(trackId)))

  const rows = await db
    .select(withContext)
    .from(notes)
    .innerJoin(tracks, eq(tracks.id, notes.trackId))
    .leftJoin(units, eq(units.id, notes.unitId))
    .where(filters.length ? and(...filters) : undefined)
    .orderBy(desc(notes.date), desc(notes.createdAt))
    .limit(200)
  return c.json(rows.map(({ note, track, unitTitle }) => ({ ...note, track, unitTitle })))
})

// A note is filed under its session's date, track and unit, so it shows up wherever that session does.
noteRoutes.post('/notes', async (c) => {
  const input = await body(
    c,
    z.object({
      sessionId: z.number().int(),
      round: z.number().int().min(1).nullable().optional(),
      ...content,
    }),
  )
  const [session] = await db.select().from(sessions).where(eq(sessions.id, input.sessionId))
  if (!session) throw new HTTPException(404, { message: 'Session not found' })

  const [note] = await db
    .insert(notes)
    .values({
      ...input,
      round: input.round ?? null,
      date: session.date,
      trackId: session.trackId,
      unitId: session.unitId,
    })
    .returning()
  return c.json(note, 201)
})

noteRoutes.patch('/notes/:id', async (c) => {
  const id = idParam(c.req.param('id'))
  const input = await body(c, z.object(content).partial())
  const [note] = await db
    .update(notes)
    .set({ ...input, updatedAt: new Date() })
    .where(eq(notes.id, id))
    .returning()
  if (!note) throw new HTTPException(404, { message: 'Note not found' })
  return c.json(note)
})

noteRoutes.delete('/notes/:id', async (c) => {
  await db.delete(notes).where(eq(notes.id, idParam(c.req.param('id'))))
  return c.body(null, 204)
})
