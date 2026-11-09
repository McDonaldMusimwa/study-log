import { env } from '../env.js'
import type { Commit } from '../db/schema.js'

type GitHubCommit = { sha: string; html_url: string; commit: { message: string } }

// AI Trainer commits between two instants, newest first. A GitHub error comes back as a message, not a throw.
export async function commitsBetween(since: string, until: string): Promise<{ commits: Commit[]; error?: string }> {
  const url = new URL(`https://api.github.com/repos/${env.githubRepo}/commits`)
  url.searchParams.set('since', since)
  url.searchParams.set('until', until)
  url.searchParams.set('per_page', '50')

  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'study-log',
  }
  if (env.githubToken) headers.Authorization = `Bearer ${env.githubToken}`

  try {
    const res = await fetch(url, { headers, signal: AbortSignal.timeout(8000) })
    if (!res.ok) {
      const hint = res.status === 404 ? ' (private repo? set GITHUB_TOKEN)' : ''
      return { commits: [], error: `GitHub returned ${res.status}${hint}` }
    }
    const data = (await res.json()) as GitHubCommit[]
    return {
      commits: data.map((c) => ({
        sha: c.sha.slice(0, 7),
        message: c.commit.message.split('\n')[0] ?? '',
        url: c.html_url,
      })),
    }
  } catch {
    return { commits: [], error: 'Could not reach GitHub' }
  }
}
