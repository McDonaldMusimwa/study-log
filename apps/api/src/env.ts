export const env = {
  port: Number(process.env.PORT ?? 3001),
  databaseUrl: process.env.DATABASE_URL || 'file:study-log.db',
  databaseAuthToken: process.env.DATABASE_AUTH_TOKEN ?? '',
  // Optional password that turns on the login screen (see lib/auth.ts).
  appPassword: process.env.APP_PASSWORD ?? '',
  onNetlify: Boolean(process.env.NETLIFY || process.env.NETLIFY_DEV),
  // AI for drafting and polishing posts: Groq's free tier first, Claude if only its key is set.
  groqApiKey: process.env.GROQ_API_KEY ?? '',
  groqModel: process.env.GROQ_MODEL || 'openai/gpt-oss-120b',
  groqBaseUrl: process.env.GROQ_BASE_URL || 'https://api.groq.com/openai/v1',
  anthropicApiKey: process.env.ANTHROPIC_API_KEY ?? '',
  githubToken: process.env.GITHUB_TOKEN ?? '',
  githubRepo: process.env.GITHUB_REPO || 'McDonaldMusimwa/Aitrainer',
}
