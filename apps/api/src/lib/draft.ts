import Anthropic from '@anthropic-ai/sdk'
import { env } from '../env.js'
import type { Commit } from '../db/schema.js'

export type Tone = 'story' | 'technical' | 'short'

export type DraftInput = {
  dayNumber: number
  sessions: { track: string; unit: string | null; minutes: number; learned: string; produced: string }[]
  learned: string
  applied: string
  commits: Commit[]
  areas: string[]
  next: string
  tone: Tone
}

const SYSTEM = `You draft LinkedIn posts for McDonald Musimwa, a software developer moving into DevOps who is learning in public. Each post covers one day of study and connects it to AI Trainer, the product he works on: an AI fitness and nutrition coach with a React Native app and a React web app that share a FastAPI and PostgreSQL backend plus a Python agent service, run with Docker Compose and GitHub Actions CI.

Write in first person, in his voice: plain, specific and curious, without hype. Use only facts from the day's log. Never invent numbers, results or details; where a concrete figure would make the point, leave a placeholder in square brackets, such as [build time before], for him to fill in. Plain text only, with no markdown and no emoji. Open with a line that makes a reader want to keep going, close with a short question for readers, then 3 relevant hashtags. Reply with the post and nothing else.`

const TONES: Record<Tone, string> = {
  story: 'Tell it as a short story of the day, around 900 to 1,300 characters.',
  technical: 'Go deeper on the concepts and the engineering trade-offs, around 1,000 to 1,400 characters.',
  short: 'Keep it under 600 characters: one idea, one link to AI Trainer.',
}

function describeDay(input: DraftInput) {
  const sessions = input.sessions
    .map((s) =>
      [
        `- ${s.track}${s.unit ? `: ${s.unit}` : ''} (${s.minutes} min)`,
        s.learned && `  learned: ${s.learned}`,
        s.produced && `  produced: ${s.produced}`,
      ]
        .filter(Boolean)
        .join('\n'),
    )
    .join('\n')
  const commits = input.commits.map((c) => `- ${c.sha} ${c.message}`).join('\n')

  return `Day ${input.dayNumber} of learning in public.

Study sessions:
${sessions || '- (none logged)'}

What clicked today:
${input.learned || '(not written)'}

Where it showed up in AI Trainer:
${input.applied || '(not written)'}
${input.areas.length ? `Areas: ${input.areas.join(', ')}` : ''}
${commits ? `Related commits:\n${commits}` : ''}

Next: ${input.next || '(not written)'}

${TONES[input.tone]}`
}

// Used when no API key is configured, so the wrap-up still produces something to edit.
function template(input: DraftInput) {
  const tracks = [...new Set(input.sessions.map((s) => s.track))].join(', ')
  return `Day ${input.dayNumber} of learning system design and DevOps in public.

${input.learned || `Today: ${tracks || '[what you studied]'}.`}

Where it showed up at work on AI Trainer: ${input.applied || '[how today applied to AI Trainer]'}

Next: ${input.next || '[what comes next]'}

[A question for readers?]

#SystemDesign #DevOps #LearningInPublic`
}

export class DraftRefusedError extends Error {}

const client = env.anthropicApiKey ? new Anthropic({ apiKey: env.anthropicApiKey }) : null

export async function draftPost(input: DraftInput): Promise<{ text: string; source: 'claude' | 'template' }> {
  if (!client) return { text: template(input), source: 'template' }

  const response = await client.beta.messages.create({
    model: 'claude-opus-5-5',
    max_tokens: 16000,
    // On a policy decline, the API retries the request on a fallback model inside the same call.
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    output_config: { effort: 'medium' },
    system: SYSTEM,
    messages: [{ role: 'user', content: describeDay(input) }],
  })

  if (response.stop_reason === 'refusal') throw new DraftRefusedError('Claude declined to draft this post')
  const text = response.content
    .flatMap((block) => (block.type === 'text' ? [block.text] : []))
    .join('')
    .trim()
  return { text, source: 'claude' }
}
