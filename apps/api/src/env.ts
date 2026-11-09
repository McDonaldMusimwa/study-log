export const env = {
  port: Number(process.env.PORT ?? 3001),
  databaseUrl: process.env.DATABASE_URL || 'file:study-log.db',
  databaseAuthToken: process.env.DATABASE_AUTH_TOKEN ?? '',
  // The one password that unlocks the app. Required on Netlify (see lib/auth.ts).
  appPassword: process.env.APP_PASSWORD ?? '',
  onNetlify: Boolean(process.env.NETLIFY || process.env.NETLIFY_DEV),
  anthropicApiKey: process.env.ANTHROPIC_API_KEY ?? '',
  githubToken: process.env.GITHUB_TOKEN ?? '',
  githubRepo: process.env.GITHUB_REPO || 'McDonaldMusimwa/Aitrainer',
}
