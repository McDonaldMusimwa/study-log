import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'

// Dates are YYYY-MM-DD text in the user's own calendar; instants are stored as epoch milliseconds.
const instant = (name: string) => integer(name, { mode: 'timestamp_ms' })
const createdAt = () =>
  instant('created_at')
    .notNull()
    .$defaultFn(() => new Date())

// A learning track: the DDIA book, the Udemy DevOps course, SystemsExpert, DSA, React.
export const tracks = sqliteTable('tracks', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  slug: text('slug').notNull().unique(),
  name: text('name').notNull(),
  color: text('color').notNull(),
  unitLabel: text('unit_label').notNull(),
  totalUnits: integer('total_units'),
  position: integer('position').notNull().default(0),
})

// One chapter, course section, lesson or problem inside a track.
export const units = sqliteTable('units', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  trackId: integer('track_id')
    .notNull()
    .references(() => tracks.id),
  title: text('title').notNull(),
  position: integer('position').notNull().default(0),
  status: text('status', { enum: ['todo', 'in_progress', 'done'] })
    .notNull()
    .default('todo'),
  completedAt: instant('completed_at'),
  createdAt: createdAt(),
})

// The weekly routine: which track is studied when, and for how long.
export const scheduleBlocks = sqliteTable('schedule_blocks', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  // ISO weekday: 1 = Monday ... 7 = Sunday.
  weekday: integer('weekday').notNull(),
  startTime: text('start_time').notNull(),
  minutes: integer('minutes').notNull(),
  trackId: integer('track_id')
    .notNull()
    .references(() => tracks.id),
})

// A timed study session and what came out of it.
export const sessions = sqliteTable('sessions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  date: text('date').notNull(),
  trackId: integer('track_id')
    .notNull()
    .references(() => tracks.id),
  unitId: integer('unit_id').references(() => units.id),
  blockId: integer('block_id').references(() => scheduleBlocks.id),
  startedAt: instant('started_at')
    .notNull()
    .$defaultFn(() => new Date()),
  endedAt: instant('ended_at'),
  // Pauses and Pomodoro breaks don't count as study time. `pausedMs` holds finished pauses;
  // a pause in progress is `pausedAt` until it is resumed.
  pausedAt: instant('paused_at'),
  pauseKind: text('pause_kind', { enum: ['pause', 'break'] }),
  pausedMs: integer('paused_ms').notNull().default(0),
  pomodoro: integer('pomodoro', { mode: 'boolean' }).notNull().default(true),
  pomodoros: integer('pomodoros').notNull().default(0),
  minutes: integer('minutes').notNull().default(0),
  learned: text('learned').notNull().default(''),
  produced: text('produced').notNull().default(''),
})

// Spaced-repetition prompts: concepts to explain again from memory.
export const reviewItems = sqliteTable('review_items', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  trackId: integer('track_id')
    .notNull()
    .references(() => tracks.id),
  prompt: text('prompt').notNull(),
  answer: text('answer').notNull().default(''),
  step: integer('step').notNull().default(0),
  dueOn: text('due_on').notNull(),
  lastResult: text('last_result', { enum: ['again', 'good'] }),
  retiredAt: instant('retired_at'),
  createdAt: createdAt(),
})

export type Commit = { sha: string; message: string; url: string }

// The end-of-day wrap-up and the LinkedIn post drafted from it.
export const days = sqliteTable('days', {
  date: text('date').primaryKey(),
  learned: text('learned').notNull().default(''),
  applied: text('applied').notNull().default(''),
  next: text('next').notNull().default(''),
  commits: text('commits', { mode: 'json' }).$type<Commit[]>().notNull().default([]),
  areas: text('areas', { mode: 'json' }).$type<string[]>().notNull().default([]),
  postDraft: text('post_draft').notNull().default(''),
  postedAt: instant('posted_at'),
  updatedAt: instant('updated_at')
    .notNull()
    .$defaultFn(() => new Date()),
})

// What was grasped during one Pomodoro round: rich text (TipTap JSON plus a plain-text copy for search and
// post drafts) and an optional whiteboard (an Excalidraw scene plus an SVG snapshot for display).
export const notes = sqliteTable('notes', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  sessionId: integer('session_id').references(() => sessions.id),
  date: text('date').notNull(),
  trackId: integer('track_id')
    .notNull()
    .references(() => tracks.id),
  unitId: integer('unit_id').references(() => units.id),
  // 1-based Pomodoro round; null for notes taken outside a Pomodoro.
  round: integer('round'),
  body: text('body', { mode: 'json' }).$type<unknown>(),
  text: text('text').notNull().default(''),
  drawing: text('drawing'),
  drawingSvg: text('drawing_svg'),
  createdAt: createdAt(),
  updatedAt: instant('updated_at')
    .notNull()
    .$defaultFn(() => new Date()),
})
