# Study Log

**Live: <https://study-logs.netlify.app/>**

A daily log for learning system design and DevOps in public. It tracks the study routine (the DDIA book, the Udemy "Decoding DevOps" course, AlgoExpert SystemsExpert, AlgoExpert DSA and React interview questions). At the end of each day it drafts a LinkedIn post that ties what you learned to the work on [AI Trainer](https://github.com/McDonaldMusimwa/Aitrainer).

## What it does

- **Today:** the day's plan in order, with no fixed clock times: in the morning DDIA then DevOps; after work SystemsExpert, then React on Mon/Wed/Fri or DSA on Tue/Thu. Start any block whenever you sit down; the app records when you actually started and finished.
  - A **Pomodoro timer**: 25-minute focus rounds, then a 5-minute break that starts on its own, with a 15-minute break after every fourth round.
  - Pause and resume. Only focus time counts toward your hours.
  - When a session ends you log the chapter, section, lesson or problem, what clicked, and what you produced.
- **Wrap-up:** three questions: what clicked, where it showed up in AI Trainer (with that day's AI Trainer commits from GitHub to tick), and what's next. Claude then drafts the LinkedIn post.
  - You can switch between Story, Technical and Short tones and edit the draft.
  - Copy stays disabled while the draft has `[placeholders]` for facts only you know, so a post never goes out with made-up numbers.
- **Progress:** hours this week against the 14-hour target, a streak (weekends don't break it), a 12-week heatmap, weekly hours, and per-track progress with chapter, section and lesson status.
- **Review:** spaced-repetition recall cards. You explain a concept out loud, reveal your note, and mark it "Shaky" or "Got it". Cards come back after 1, 3, 7, 14 and 30 days.
- **Posts:** every drafted and posted LinkedIn post.
- **Optional login:** set `APP_PASSWORD` and the app shows a sign-in screen. Leave it unset and the app is open.

## Stack

| Part | Tech |
|---|---|
| `apps/web` | React, TypeScript, Vite, Tailwind CSS, TanStack Query, React Router |
| `apps/api` | Hono, Drizzle ORM, SQLite through libSQL, Anthropic SDK (Claude Opus 5.5) |
| `netlify/functions/api.mts` | Runs the API on Netlify as a single function at `/api/*` |
| Database | A SQLite file locally and in Docker; [Turso](https://turso.tech) (hosted SQLite) on Netlify |

The same Hono app (`apps/api/src/app.ts`) runs everywhere: as a Node server locally and in Docker, and as a Netlify Function in production.

## Deploy to Netlify

Netlify Functions don't keep files between requests, so a SQLite file there would be lost. Production uses Turso, which hosts SQLite and is reached over HTTPS. Its free tier is plenty for this app.

1. **Create the database.** Install the [Turso CLI](https://docs.turso.tech/cli/installation), then run:

   ```sh
   turso auth signup
   turso db create study-log
   turso db show study-log --url      # → DATABASE_URL (libsql://...)
   turso db tokens create study-log   # → DATABASE_AUTH_TOKEN
   ```

2. **Create the site.** In Netlify, choose **Add new site → Import an existing project**, pick this GitHub repo, and keep the build settings from `netlify.toml`.
3. **Set the environment variables** under **Site configuration → Environment variables**:

   | Variable | Value |
   |---|---|
   | `DATABASE_URL` | the `libsql://...` URL |
   | `DATABASE_AUTH_TOKEN` | the Turso token |
   | `APP_PASSWORD` | *(optional)* turns on a login screen |
   | `ANTHROPIC_API_KEY` | for Claude drafts |
   | `GITHUB_TOKEN` | optional |

4. **Deploy.** Each deploy runs the database migrations against Turso first, then builds the web app. On the first deploy, the migration creates the tables and seeds the tracks, DDIA's chapters and the weekly routine.

## Run it with Docker

```sh
cp .env.example .env        # optional: ANTHROPIC_API_KEY, APP_PASSWORD
docker compose up -d --build
```

Open <http://localhost:8090>. The SQLite database lives in the `study-log_data` volume, so it survives restarts and rebuilds. Only `docker compose down -v` deletes it.

## Develop

Node 22 or later.

```sh
npm install
cp .env.example .env
npm run db:migrate     # creates apps/api/study-log.db and seeds it
npm run dev:api        # http://localhost:3001
npm run dev:web        # http://localhost:5173 (proxies /api to the API)
```

Checks: `npm run typecheck`, `npm run lint`, `npm run build`.

### Changing the database

Edit `apps/api/src/db/schema.ts`, then generate a migration and commit it:

```sh
npm run db:generate -w @study-log/api -- --name describe_the_change
```

Migrations in `apps/api/drizzle/` apply when the API container starts, and on every Netlify deploy.

## Settings

| Variable | What it does |
|---|---|
| `DATABASE_URL` | `file:...` for a local SQLite file, or a Turso `libsql://` URL |
| `DATABASE_AUTH_TOKEN` | Turso token (not needed for a local file) |
| `APP_PASSWORD` | Optional. Turns on the login screen. |
| `ANTHROPIC_API_KEY` | Lets Claude draft the posts. Without it, the wrap-up fills in a template instead. |
| `GITHUB_TOKEN` | Optional for a public repo. A read-only fine-grained token avoids GitHub's rate limit of 60 requests an hour. |
| `GITHUB_REPO` | The repo whose commits appear on the wrap-up screen (default `McDonaldMusimwa/Aitrainer`). |
