import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { logger } from 'hono/logger'
import { z } from 'zod'
import { client } from './db/client.js'
import { authEnabled, checkPassword, isSignedIn, requireAuth, signIn, signOut } from './lib/auth.js'
import { body } from './lib/http.js'
import { dayRoutes } from './routes/days.js'
import { progressRoutes } from './routes/progress.js'
import { reviewRoutes } from './routes/reviews.js'
import { sessionRoutes } from './routes/sessions.js'
import { todayRoutes } from './routes/today.js'
import { trackRoutes } from './routes/tracks.js'

// The whole API as one Hono app: served by Node locally and in Docker, and by a Netlify Function in production.
export const app = new Hono().basePath('/api')
app.use(logger())
app.use(requireAuth)

app.get('/health', async (c) => {
  await client.execute('select 1')
  return c.json({ ok: true })
})

app.get('/session', (c) => c.json({ signedIn: isSignedIn(c), authEnabled: authEnabled() }))

app.post('/login', async (c) => {
  const { password } = await body(c, z.object({ password: z.string().max(200) }))
  if (!checkPassword(password)) {
    // A short delay makes guessing slow.
    await new Promise((resolve) => setTimeout(resolve, 600))
    throw new HTTPException(401, { message: 'Wrong password' })
  }
  signIn(c)
  return c.json({ signedIn: true })
})

app.post('/logout', (c) => {
  signOut(c)
  return c.json({ signedIn: false })
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
