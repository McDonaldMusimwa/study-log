import { boolean, date, integer, jsonb, pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core'

// A learning track: the DDIA book, the Udemy DevOps course, SystemsExpert, DSA, React.
export const tracks = pgTable('tracks', {
  id: serial('id').primaryKey(),
  slug: text('slug').notNull().unique(),
  name: text('name').notNull(),
  color: text('color').notNull(),
  unitLabel: text('unit_label').notNull(),
  totalUnits: integer('total_units'),
  position: integer('position').notNull().default(0),
})

// One chapter, course section, lesson or problem inside a track.
export const units = pgTable('units', {
  id: serial('id').primaryKey(),
  trackId: integer('track_id')
    .notNull()
    .references(() => tracks.id),
  title: text('title').notNull(),
  position: integer('position').notNull().default(0),
  status: text('status', { enum: ['todo', 'in_progress', 'done'] })
    .notNull()
    .default('todo'),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

// The weekly routine: which track is studied when, and for how long.
export const scheduleBlocks = pgTable('schedule_blocks', {
  id: serial('id').primaryKey(),
  // ISO weekday: 1 = Monday ... 7 = Sunday.
  weekday: integer('weekday').notNull(),
  startTime: text('start_time').notNull(),
  minutes: integer('minutes').notNull(),
  trackId: integer('track_id')
    .notNull()
    .references(() => tracks.id),
})

// A timed study session and what came out of it.
export const sessions = pgTable('sessions', {
  id: serial('id').primaryKey(),
  date: date('date', { mode: 'string' }).notNull(),
  trackId: integer('track_id')
    .notNull()
    .references(() => tracks.id),
  unitId: integer('unit_id').references(() => units.id),
  blockId: integer('block_id').references(() => scheduleBlocks.id),
  startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
  endedAt: timestamp('ended_at', { withTimezone: true }),
  // Pauses and Pomodoro breaks don't count as study time. `pausedMs` holds finished pauses;
  // a pause in progress is `pausedAt` until it is resumed.
  pausedAt: timestamp('paused_at', { withTimezone: true }),
  pauseKind: text('pause_kind', { enum: ['pause', 'break'] }),
  pausedMs: integer('paused_ms').notNull().default(0),
  pomodoro: boolean('pomodoro').notNull().default(true),
  pomodoros: integer('pomodoros').notNull().default(0),
  minutes: integer('minutes').notNull().default(0),
  learned: text('learned').notNull().default(''),
  produced: text('produced').notNull().default(''),
})

// Spaced-repetition prompts: concepts to explain again from memory.
export const reviewItems = pgTable('review_items', {
  id: serial('id').primaryKey(),
  trackId: integer('track_id')
    .notNull()
    .references(() => tracks.id),
  prompt: text('prompt').notNull(),
  answer: text('answer').notNull().default(''),
  step: integer('step').notNull().default(0),
  dueOn: date('due_on', { mode: 'string' }).notNull(),
  lastResult: text('last_result', { enum: ['again', 'good'] }),
  retiredAt: timestamp('retired_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export type Commit = { sha: string; message: string; url: string }

// The end-of-day wrap-up and the LinkedIn post drafted from it.
export const days = pgTable('days', {
  date: date('date', { mode: 'string' }).primaryKey(),
  learned: text('learned').notNull().default(''),
  applied: text('applied').notNull().default(''),
  next: text('next').notNull().default(''),
  commits: jsonb('commits').$type<Commit[]>().notNull().default([]),
  areas: jsonb('areas').$type<string[]>().notNull().default([]),
  postDraft: text('post_draft').notNull().default(''),
  postedAt: timestamp('posted_at', { withTimezone: true }),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})
