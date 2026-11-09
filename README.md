# Study Log

A daily log for learning system design and DevOps in public. It tracks the study routine (the DDIA book, the Udemy "Decoding DevOps" course, AlgoExpert SystemsExpert, AlgoExpert DSA and React interview questions). At the end of each day it drafts a LinkedIn post that ties what you learned to the work on [AI Trainer](https://github.com/McDonaldMusimwa/Aitrainer).

## What it does

- **Today:** the day's plan as time blocks (mornings DDIA then DevOps; evenings SystemsExpert, then React on Mon/Wed/Fri or DSA on Tue/Thu). You start a timer on a block, and when you finish you log the chapter, section, lesson or problem, what clicked, and what you produced.
- **Wrap-up:** three questions: what clicked, where it showed up in AI Trainer (with that day's AI Trainer commits from GitHub to tick), and what's next. Claude then drafts the LinkedIn post. You can switch between Story, Technical and Short tones and edit the draft. Copy stays disabled while the draft has `[placeholders]` for facts only you know, so a post never goes out with made-up numbers.
- **Progress:** hours this week against the 14-hour target, a streak (weekends don't break it), a 12-week heatmap, weekly hours, and per-track progress with chapter, section and lesson status.
- **Review:** spaced-repetition recall cards. You explain a concept out loud, reveal your note, and mark it "Shaky" or "Got it". Cards come back after 1, 3, 7, 14 and 30 days.
- **Posts:** every drafted and posted LinkedIn post.

Everything is saved in PostgreSQL.

## Stack

| Part | Tech |
|---|---|
| `apps/web` | React, TypeScript, Vite, Tailwind CSS, TanStack Query, React Router |
| `apps/api` | Node, Hono, Drizzle ORM, PostgreSQL, Anthropic SDK (Claude Opus 5.5) |
| `compose.yaml` | PostgreSQL 17 with a persistent volume, the API (runs migrations on start), and nginx serving the web app and proxying `/api` |

## Run it with Docker

```sh
cp .env.example .env        # add ANTHROPIC_API_KEY for Claude drafts
docker compose up -d --build
```

Open <http://localhost:8090>. On first start, the API creates the tables and seeds the five tracks, DDIA's 12 chapters and the weekly routine.

Your data lives in the `study-log_db-data` Docker volume. It survives `docker compose down` and rebuilds. Only `docker compose down -v` deletes it.

## Develop

Node 22 or later.

```sh
npm install
cp .env.example .env
npm run db:up          # just PostgreSQL, on localhost:5433
npm run db:migrate     # create tables and seed
npm run dev:api        # http://localhost:3001
npm run dev:web        # http://localhost:5173 (proxies /api to the API)
```

Checks: `npm run typecheck`, `npm run lint`, `npm run build`.

### Changing the database

Edit `apps/api/src/db/schema.ts`, then generate a migration and commit it:

```sh
npm run db:generate -w @study-log/api -- --name describe_the_change
```

Migrations in `apps/api/drizzle/` apply automatically when the API container starts.

## Settings (`.env`)

| Variable | What it does |
|---|---|
| `ANTHROPIC_API_KEY` | Lets Claude draft the posts. Without it, the wrap-up fills in a template instead. |
| `GITHUB_TOKEN` | Optional for a public repo. A read-only fine-grained token avoids GitHub's rate limit of 60 requests an hour. |
| `GITHUB_REPO` | The repo whose commits appear on the wrap-up screen (default `McDonaldMusimwa/Aitrainer`). |
| `POSTGRES_*`, `DATABASE_URL` | Database credentials. The defaults work out of the box. |
