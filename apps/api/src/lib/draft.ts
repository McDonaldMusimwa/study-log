import type { Commit } from '../db/schema.js'
import { complete, llmProvider, type Provider } from './llm.js'

export type Tone = 'story' | 'technical' | 'short'

export type DraftInput = {
  dayNumber: number
  sessions: { track: string; unit: string | null; minutes: number; learned: string; produced: string }[]
  // Notes taken during Pomodoro rounds, in the order they were written.
  notes: { track: string; round: number | null; text: string; hasDrawing: boolean }[]
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
  const notes = input.notes
    .filter((n) => n.text.trim() || n.hasDrawing)
    .map((n) => {
      const label = `${n.track}${n.round ? `, round ${n.round}` : ''}`
      const drawing = n.hasDrawing ? ' (he also sketched a diagram)' : ''
      return `- ${label}${drawing}: ${n.text.trim().replace(/\s+/g, ' ') || '(drawing only)'}`
    })
    .join('\n')

  return `Day ${input.dayNumber} of learning in public.

Study sessions:
${sessions || '- (none logged)'}
${notes ? `\nNotes taken during the Pomodoro rounds:\n${notes}\n` : ''}
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

export type Drafted = { text: string; source: 'ai' | 'template'; provider: Provider | null }

export async function draftPost(input: DraftInput): Promise<Drafted> {
  if (!llmProvider()) return { text: template(input), source: 'template', provider: null }
  const { text, provider } = await complete({ system: SYSTEM, prompt: describeDay(input) })
  return { text, source: 'ai', provider }
}

const POLISH_SYSTEM = `You edit LinkedIn posts for McDonald Musimwa, a software developer moving into DevOps who is learning in public and connects each day's study to AI Trainer, the product he works on.

Polish the post he gives you: a stronger opening line, smoother flow, tighter sentences, correct grammar and spelling, and a short question for readers near the end if it lacks one. Keep his first-person voice: plain, specific and curious, without hype or buzzwords.

Keep every fact exactly as he wrote it. Never add facts, numbers, results, tools or claims that aren't in his text. Keep anything in square brackets, such as [build time before], exactly as written. Keep his hashtags, or add up to 3 relevant ones at the end if there are none. Plain text only: no markdown, no bold, no emoji. Reply with the polished post and nothing else.`

const POLISH_TONES: Record<Tone, string> = {
  story: 'Keep about the same length.',
  technical: 'Keep about the same length and make the technical points crisp and precise.',
  short: 'Tighten it to under 600 characters, keeping the main idea and the link to AI Trainer.',
}

export async function polishPost(text: string, tone: Tone): Promise<Drafted> {
  const result = await complete({ system: POLISH_SYSTEM, prompt: `${POLISH_TONES[tone]}\n\nPost to polish:\n\n${text}` })
  return { text: result.text, source: 'ai', provider: result.provider }
}
