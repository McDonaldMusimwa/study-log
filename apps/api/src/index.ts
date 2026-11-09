import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { logger } from 'hono/logger'
import { sql } from './db/client.js'
import { env } from './env.js'
import { dayRoutes } from './routes/days.js'
import { progressRoutes } from './routes/progress.js'
import { reviewRoutes } from './routes/reviews.js'
import { sessionRoutes } from './routes/sessions.js'
import { todayRoutes } from './routes/today.js'
import { trackRoutes } from './routes/tracks.js'

const app = new Hono().basePath('/api')
app.use(logger())

app.get('/health', async (c) => {
  await sql`select 1`
  return c.json({ ok: true })
})

app.route('/', todayRoutes)
app.route('/', trackRoutes)
app.route('/', sessionRoutes)
app.route('/', dayRoutes)
app.route('/', reviewRoutes)
app.route('/', progressRoutes)

app.onError((error, c) => {
  if (error instanceof HTTPException) return c.json({ error: error.message }, error.status)
  console.error(error)
  return c.json({ error: 'Something went wrong' }, 500)
})

serve({ fetch: app.fetch, port: env.port, hostname: '0.0.0.0' }, (info) => console.log(`api listening on :${info.port}`))
