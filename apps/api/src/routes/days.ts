import { asc, desc, eq, ne } from 'drizzle-orm'
import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { z } from 'zod'
import { db } from '../db/client.js'
import { days, notes, sessions, tracks, units } from '../db/schema.js'
import { dayNumber, studiedDates } from '../lib/activity.js'
import { draftPost, polishPost } from '../lib/draft.js'
import { commitsBetween } from '../lib/github.js'
import { body, dateParam } from '../lib/http.js'
import { LlmError, llmProvider } from '../lib/llm.js'

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
      learned: z.string().max(20_000),
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

  const draft = await withAi(() =>
    draftPost({
      ...day,
      dayNumber: n,
      tone,
      sessions: daySessions,
      notes: dayNotes.map((note) => ({ ...note, hasDrawing: Boolean(note.hasDrawing) })),
    }),
  )
  await savePost(date, draft.text)
  return c.json(draft)
})

// Rewrites the post as it stands now (with the user's own edits) for flow and grammar, keeping its facts.
dayRoutes.post('/days/:date/polish', async (c) => {
  const date = dateParam(c.req.param('date'))
  const { text, tone } = await body(
    c,
    z.object({
      text: z.string().trim().min(1, 'Write or draft a post first').max(5000),
      tone: z.enum(['story', 'technical', 'short']).default('story'),
    }),
  )
  if (!llmProvider()) throw new HTTPException(503, { message: 'Add a free GROQ_API_KEY to your settings to polish posts.' })
  const polished = await withAi(() => polishPost(text, tone))
  await savePost(date, polished.text)
  return c.json(polished)
})

// Which AI drafts and polishes posts, so the page can say so (or explain how to turn it on).
dayRoutes.get('/ai', (c) => c.json({ provider: llmProvider() }))

async function withAi<T>(run: () => Promise<T>) {
  try {
    return await run()
  } catch (error) {
    // A rejected key is the server's problem, not the visitor's: 401 would sign the page out.
    if (error instanceof LlmError) throw new HTTPException(error.status === 401 ? 502 : error.status, { message: error.message })
    throw error
  }
}

async function savePost(date: string, postDraft: string) {
  await db
    .insert(days)
    .values({ date, postDraft, updatedAt: new Date() })
    .onConflictDoUpdate({ target: days.date, set: { postDraft, updatedAt: new Date() } })
}

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
