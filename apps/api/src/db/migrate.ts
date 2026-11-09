import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import { db, sql } from './client.js'
import { seed } from './seed.js'

// Works from src/db (tsx) and dist/db (built): both sit two levels below the drizzle folder.
const migrationsFolder = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../drizzle')

await migrate(db, { migrationsFolder })
console.log('migrations applied')
if (await seed()) console.log('seeded tracks, DDIA chapters and the weekly routine')
await sql.end()
