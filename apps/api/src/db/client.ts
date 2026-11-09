import { createClient } from '@libsql/client'
import { drizzle } from 'drizzle-orm/libsql'
import { env } from '../env.js'
import * as schema from './schema.js'

// A local file (`file:...`) in dev and Docker; a hosted Turso database (`libsql://...`) on Netlify.
export const client = createClient({ url: env.databaseUrl, authToken: env.databaseAuthToken || undefined })
export const db = drizzle(client, { schema })
