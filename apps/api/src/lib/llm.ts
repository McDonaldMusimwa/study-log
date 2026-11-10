import Anthropic from '@anthropic-ai/sdk'
import { env } from '../env.js'

// One way to ask a model for text. Groq (free tier, OpenAI-compatible API) is used when GROQ_API_KEY is set;
// otherwise Claude when ANTHROPIC_API_KEY is set. Callers check llmProvider() and fall back to a template.

export type Provider = { name: 'groq' | 'claude'; model: string; label: string }

export class LlmError extends Error {
  constructor(
    message: string,
    readonly status: 401 | 422 | 429 | 502 | 504,
  ) {
    super(message)
  }
}

export function llmProvider(): Provider | null {
  if (env.groqApiKey) return { name: 'groq', model: env.groqModel, label: `${env.groqModel} on Groq (free tier)` }
  if (env.anthropicApiKey) return { name: 'claude', model: 'claude-opus-5-5', label: 'Claude Opus 5.5' }
  return null
}

type Request = { system: string; prompt: string }

type ChatResponse = { choices?: { message?: { content?: string }; finish_reason?: string }[] }

async function groq({ system, prompt }: Request) {
  let res: Response
  try {
    res = await fetch(`${env.groqBaseUrl}/chat/completions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.groqApiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: env.groqModel,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: prompt },
        ],
        temperature: 0.7,
        // Reasoning models (gpt-oss) spend tokens thinking before they write, so leave room for both,
        // and keep the thinking light: a LinkedIn post doesn't need much and it keeps replies fast.
        max_completion_tokens: 4000,
        ...(env.groqModel.startsWith('openai/gpt-oss') && { reasoning_effort: 'low' }),
      }),
      // Stays inside Netlify's 60-second function limit.
      signal: AbortSignal.timeout(45_000),
    })
  } catch {
    throw new LlmError('Could not reach Groq. Try again in a moment.', 504)
  }

  if (res.status === 401) throw new LlmError('GROQ_API_KEY was rejected. Check the key in your settings.', 401)
  if (res.status === 429) throw new LlmError("Groq's free limit is used up for now. Try again in a minute.", 429)
  if (!res.ok) {
    // Groq explains itself, e.g. "The model `x` does not exist" when a model has been retired.
    const detail = ((await res.json().catch(() => ({}))) as { error?: { message?: string; code?: string } }).error
    const hint = detail?.code === 'model_not_found' ? ` Set GROQ_MODEL to a model your Groq account lists.` : ''
    throw new LlmError(`Groq error ${res.status}: ${detail?.message ?? 'no details'}${hint}`, 502)
  }

  const data = (await res.json()) as ChatResponse
  const text = data.choices?.[0]?.message?.content?.trim()
  if (!text) throw new LlmError('Groq returned an empty reply. Try again.', 502)
  return text
}

const anthropic = env.anthropicApiKey ? new Anthropic({ apiKey: env.anthropicApiKey }) : null

async function claude({ system, prompt }: Request) {
  try {
    const response = await anthropic!.beta.messages.create({
      model: 'claude-opus-5-5',
      max_tokens: 16000,
      // On a policy decline, the API retries the request on a fallback model inside the same call.
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: 'medium' },
      system,
      messages: [{ role: 'user', content: prompt }],
    })
    if (response.stop_reason === 'refusal') throw new LlmError('Claude declined to write this post.', 422)
    return response.content
      .flatMap((block) => (block.type === 'text' ? [block.text] : []))
      .join('')
      .trim()
  } catch (error) {
    if (error instanceof LlmError) throw error
    if (error instanceof Anthropic.AuthenticationError) throw new LlmError('ANTHROPIC_API_KEY was rejected.', 401)
    if (error instanceof Anthropic.RateLimitError) throw new LlmError('Claude is rate limited; try again shortly.', 429)
    if (error instanceof Anthropic.APIError) throw new LlmError(`Claude API error ${error.status}.`, 502)
    throw error
  }
}

// Smaller models sometimes wrap the post in a preamble, quotes, code fences or markdown bold. LinkedIn wants plain text.
export function cleanPost(text: string) {
  let out = text.trim()
  out = out.replace(/^```[a-z]*\n?|\n?```$/g, '').trim()
  out = out.replace(/^(here(?:'|’)?s|here is|sure|certainly|below is)[^\n]*:\s*\n+/i, '')
  if (/^["“].*["”]$/s.test(out)) out = out.slice(1, -1)
  // LinkedIn shows markdown literally, so drop bold and inline-code markers.
  out = out.replace(/\*\*(.+?)\*\*/g, '$1').replace(/__(.+?)__/g, '$1').replace(/`([^`\n]+)`/g, '$1')
  return out.trim()
}

export async function complete(request: Request) {
  const provider = llmProvider()
  if (!provider) throw new LlmError('No AI provider is set up. Add GROQ_API_KEY (free) to your settings.', 502)
  const raw = provider.name === 'groq' ? await groq(request) : await claude(request)
  return { text: cleanPost(raw), provider }
}
