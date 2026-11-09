import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { migrate } from 'drizzle-orm/libsql/migrator'
import { env } from '../env.js'
import { client, db } from './client.js'
import { seed } from './seed.js'

// On Netlify a local file would be thrown away after the build, so fail the deploy instead of "succeeding".
if (env.onNetlify && env.databaseUrl.startsWith('file:')) {
  console.error('DATABASE_URL is not set to a Turso database. Add DATABASE_URL and DATABASE_AUTH_TOKEN in Netlify.')
  process.exit(1)
}

// Works from src/db (tsx) and dist/db (built): both sit two levels below the drizzle folder.
const migrationsFolder = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../drizzle')

await migrate(db, { migrationsFolder })
console.log('migrations applied')
if (await seed()) console.log('seeded tracks, DDIA chapters and the weekly routine')
client.close()
