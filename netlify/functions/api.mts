import type { Config } from '@netlify/functions'
import { app } from '../../apps/api/src/app.ts'

// Every /api/* request runs the same Hono app the Node server uses locally.
export default (request: Request) => app.fetch(request)

export const config: Config = { path: '/api/*' }
