import { and, eq, isNull } from 'drizzle-orm'
import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { z } from 'zod'
import { db } from '../db/client.js'
import { notes, sessions, units } from '../db/schema.js'
import { isDate } from '../lib/dates.js'
import { body, idParam } from '../lib/http.js'

export const sessionRoutes = new Hono()

type SessionRow = typeof sessions.$inferSelect

// Time spent paused so far, including a pause that is still running.
function pausedTotal(session: SessionRow, now: number) {
  return session.pausedMs + (session.pausedAt ? now - session.pausedAt.getTime() : 0)
}

// Only focused time counts: pauses and Pomodoro breaks are left out.
function focusedMinutes(session: SessionRow, now = Date.now()) {
  const focusedMs = now - session.startedAt.getTime() - pausedTotal(session, now)
  return Math.max(1, Math.round(focusedMs / 60_000))
}

function stopFields(session: SessionRow) {
  const now = Date.now()
  return {
    endedAt: new Date(now),
    minutes: focusedMinutes(session, now),
    pausedMs: pausedTotal(session, now),
    pausedAt: null,
    pauseKind: null,
  }
}

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
      pomodoro: z.boolean().optional(),
      minutes: z.number().int().min(1).max(600).optional(),
      learned: z.string().max(20_000).optional(),
      learnedBody: z.unknown().optional(),
      produced: z.string().max(2000).optional(),
    }),
  )

  const session = await db.transaction(async (tx) => {
    for (const open of await tx.select().from(sessions).where(isNull(sessions.endedAt))) {
      await tx.update(sessions).set(stopFields(open)).where(eq(sessions.id, open.id))
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
      // pause: open-ended interruption. break: a Pomodoro break, which also completes a Pomodoro.
      action: z.enum(['pause', 'break', 'resume', 'stop']).optional(),
      pomodoro: z.boolean().optional(),
      unitId: z.number().int().nullish(),
      minutes: z.number().int().min(0).max(600).optional(),
      learned: z.string().max(20_000).optional(),
      learnedBody: z.unknown().optional(),
      produced: z.string().max(2000).optional(),
    }),
  )
  const [current] = await db.select().from(sessions).where(eq(sessions.id, id))
  if (!current) throw new HTTPException(404, { message: 'Session not found' })

  const { action, ...fields } = input
  const open = !current.endedAt
  let timer: Partial<SessionRow> = {}
  if (open && (action === 'pause' || action === 'break') && !current.pausedAt) {
    timer = {
      pausedAt: new Date(),
      pauseKind: action,
      ...(action === 'break' && { pomodoros: current.pomodoros + 1 }),
    }
  } else if (open && action === 'resume' && current.pausedAt) {
    timer = { pausedMs: pausedTotal(current, Date.now()), pausedAt: null, pauseKind: null }
  } else if (open && action === 'stop') {
    timer = stopFields(current)
    if (fields.minutes !== undefined) timer.minutes = fields.minutes
  }

  // A repeated click (pause while paused, resume after stop) changes nothing; answer with the session as it is.
  const changes = { ...fields, ...timer }
  if (Object.keys(changes).length === 0) return c.json(current)

  const [session] = await db.update(sessions).set(changes).where(eq(sessions.id, id)).returning()
  await markStarted(input.unitId)
  return c.json(session)
})

sessionRoutes.delete('/sessions/:id', async (c) => {
  // A discarded session takes its round notes with it.
  const id = idParam(c.req.param('id'))
  await db.delete(notes).where(eq(notes.sessionId, id))
  await db.delete(sessions).where(eq(sessions.id, id))
  return c.body(null, 204)
})
