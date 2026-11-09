import { serve } from '@hono/node-server'
import { app } from './app.js'
import { env } from './env.js'

// Node server for local development and Docker. On Netlify the same app runs as a function instead.
serve({ fetch: app.fetch, port: env.port, hostname: '0.0.0.0' }, (info) => console.log(`api listening on :${info.port}`))
