import Anthropic from '@anthropic-ai/sdk'
import { asc, desc, eq, ne } from 'drizzle-orm'
import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { z } from 'zod'
import { db } from '../db/client.js'
import { days, notes, sessions, tracks, units } from '../db/schema.js'
import { dayNumber, studiedDates } from '../lib/activity.js'
import { DraftRefusedError, draftPost } from '../lib/draft.js'
import { commitsBetween } from '../lib/github.js'
import { body, dateParam } from '../lib/http.js'

export const dayRoutes = new Hono()

const emptyDay = (date: string) => ({
  date,
  learned: '',
  applied: '',
  next: '',
  commits: [],
  areas: [],
  postDraft: '',
  postedAt: null,
  updatedAt: null,
})

async function loadDay(date: string) {
  const [[day], daySessions, studied] = await Promise.all([
    db.select().from(days).where(eq(days.date, date)),
    db
      .select({
        id: sessions.id,
        minutes: sessions.minutes,
        learned: sessions.learned,
        produced: sessions.produced,
        track: tracks.name,
        color: tracks.color,
        unit: units.title,
      })
      .from(sessions)
      .innerJoin(tracks, eq(tracks.id, sessions.trackId))
      .leftJoin(units, eq(units.id, sessions.unitId))
      .where(eq(sessions.date, date))
      .orderBy(asc(sessions.startedAt)),
    studiedDates(),
  ])
  return { day: day ?? emptyDay(date), sessions: daySessions, dayNumber: dayNumber(studied, date) }
}

dayRoutes.get('/days/:date', async (c) => c.json(await loadDay(dateParam(c.req.param('date')))))

const commitSchema = z.object({ sha: z.string(), message: z.string(), url: z.string() })

dayRoutes.put('/days/:date', async (c) => {
  const date = dateParam(c.req.param('date'))
  const input = await body(
    c,
    z.object({
      learned: z.string().max(4000),
      applied: z.string().max(4000),
      next: z.string().max(1000),
      commits: z.array(commitSchema).max(50),
      areas: z.array(z.string().max(40)).max(12),
      postDraft: z.string().max(5000),
    }),
  )
  const values = { ...input, updatedAt: new Date() }
  const [day] = await db
    .insert(days)
    .values({ date, ...values })
    .onConflictDoUpdate({ target: days.date, set: values })
    .returning()
  return c.json(day)
})

// Drafts the LinkedIn post from what is saved for the day and stores it as the day's draft.
dayRoutes.post('/days/:date/draft', async (c) => {
  const date = dateParam(c.req.param('date'))
  const { tone } = await body(c, z.object({ tone: z.enum(['story', 'technical', 'short']).default('story') }))
  const [{ day, sessions: daySessions, dayNumber: n }, dayNotes] = await Promise.all([
    loadDay(date),
    db
      .select({ track: tracks.name, round: notes.round, text: notes.text, hasDrawing: notes.drawingSvg })
      .from(notes)
      .innerJoin(tracks, eq(tracks.id, notes.trackId))
      .where(eq(notes.date, date))
      .orderBy(asc(notes.createdAt)),
  ])

  let draft
  try {
    draft = await draftPost({
      ...day,
      dayNumber: n,
      tone,
      sessions: daySessions,
      notes: dayNotes.map((note) => ({ ...note, hasDrawing: Boolean(note.hasDrawing) })),
    })
  } catch (error) {
    if (error instanceof DraftRefusedError) throw new HTTPException(422, { message: error.message })
    if (error instanceof Anthropic.AuthenticationError) throw new HTTPException(502, { message: 'ANTHROPIC_API_KEY was rejected' })
    if (error instanceof Anthropic.RateLimitError) throw new HTTPException(429, { message: 'Claude is rate limited; try again shortly' })
    if (error instanceof Anthropic.APIError) throw new HTTPException(502, { message: `Claude API error ${error.status}` })
    throw error
  }

  await db
    .insert(days)
    .values({ date, postDraft: draft.text, updatedAt: new Date() })
    .onConflictDoUpdate({ target: days.date, set: { postDraft: draft.text, updatedAt: new Date() } })
  return c.json(draft)
})

dayRoutes.post('/days/:date/posted', async (c) => {
  const date = dateParam(c.req.param('date'))
  const { posted } = await body(c, z.object({ posted: z.boolean() }))
  const postedAt = posted ? new Date() : null
  await db
    .insert(days)
    .values({ date, postedAt })
    .onConflictDoUpdate({ target: days.date, set: { postedAt } })
  return c.json({ postedAt })
})

dayRoutes.get('/posts', async (c) => {
  const rows = await db
    .select({ date: days.date, postDraft: days.postDraft, postedAt: days.postedAt })
    .from(days)
    .where(ne(days.postDraft, ''))
    .orderBy(desc(days.date))
  return c.json(rows)
})

// The browser sends the bounds of its own day, so "today" matches the user's time zone.
dayRoutes.get('/github/commits', async (c) => {
  const since = c.req.query('since')
  const until = c.req.query('until')
  if (!since || !until || Number.isNaN(Date.parse(since)) || Number.isNaN(Date.parse(until))) {
    throw new HTTPException(400, { message: 'Expected since and until as ISO timestamps' })
  }
  return c.json(await commitsBetween(since, until))
})
