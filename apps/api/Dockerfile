# Build context is the repository root (npm workspaces share one lockfile).
FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN npm ci -w @study-log/api
COPY apps/api apps/api
RUN npm run build -w @study-log/api

FROM node:24-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN npm ci -w @study-log/api --omit=dev && mkdir -p apps/api/node_modules

FROM node:24-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY --from=deps /app/node_modules node_modules
COPY --from=deps /app/apps/api/node_modules apps/api/node_modules
COPY --from=build /app/apps/api/package.json apps/api/
COPY --from=build /app/apps/api/dist apps/api/dist
COPY apps/api/drizzle apps/api/drizzle
WORKDIR /app/apps/api
# The SQLite database lives here; compose mounts a volume over it.
RUN mkdir -p /data && chown node:node /data
USER node
EXPOSE 3001
HEALTHCHECK --interval=15s --timeout=3s CMD wget -qO- http://127.0.0.1:3001/api/health || exit 1
# Migrations (and the first-run seed) apply before the server starts taking requests.
CMD ["sh", "-c", "node dist/db/migrate.js && node dist/index.js"]
