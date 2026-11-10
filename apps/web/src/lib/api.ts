import type { JSONContent } from '@tiptap/react'

// Typed calls to the API. Shapes mirror the JSON the routes in apps/api return.

export type UnitStatus = 'todo' | 'in_progress' | 'done'

export type Unit = { id: number; trackId: number; title: string; position: number; status: UnitStatus }

export type Track = {
  id: number
  slug: string
  name: string
  color: string
  unitLabel: string
  totalUnits: number | null
}

export type TrackWithUnits = Track & { units: Unit[] }

export type Session = {
  id: number
  date: string
  trackId: number
  unitId: number | null
  blockId: number | null
  startedAt: string
  endedAt: string | null
  pausedAt: string | null
  pauseKind: 'pause' | 'break' | null
  pausedMs: number
  pomodoro: boolean
  pomodoros: number
  minutes: number
  learned: string
  learnedBody: JSONContent | null
  produced: string
  unitTitle?: string | null
}

export type TimerAction = 'pause' | 'break' | 'resume' | 'stop'

export type Block = { id: number; weekday: number; startTime: string; minutes: number; track: Track; sessions: Session[] }

export type Today = {
  date: string
  dayNumber: number
  streak: number
  blocks: Block[]
  unplanned: Session[]
  running: Session | null
  plannedMinutes: number
  dayMinutes: number
  weekMinutes: number
  weekTargetMinutes: number
  weekStart: string
  weekStudied: string[]
  reviewDue: number
}

export type Commit = { sha: string; message: string; url: string }

export type Day = {
  date: string
  learned: string
  applied: string
  next: string
  commits: Commit[]
  areas: string[]
  postDraft: string
  postedAt: string | null
}

export type DaySession = {
  id: number
  minutes: number
  learned: string
  produced: string
  track: string
  color: string
  unit: string | null
}

export type DayDetail = { day: Day; sessions: DaySession[]; dayNumber: number }

export type Tone = 'story' | 'technical' | 'short'

// The model that drafts and polishes posts: Groq's free tier, or Claude.
export type AiProvider = { name: 'groq' | 'claude'; model: string; label: string }

export type Drafted = { text: string; source: 'ai' | 'template'; provider: AiProvider | null }

export type ReviewItem = {
  id: number
  trackId: number
  prompt: string
  answer: string
  answerBody: JSONContent | null
  step: number
  dueOn: string
  track: { name: string; color: string }
}

export type TrackStats = Track & { unitsDone: number; unitsInProgress: number; unitsTotal: number; minutes: number }

export type Progress = {
  tracks: TrackStats[]
  heatmap: { date: string; minutes: number }[]
  weeks: { start: string; minutes: number }[]
  weekTargetMinutes: number
  totalMinutes: number
  studyDays: number
  streak: number
  postsDrafted: number
  postsPosted: number
}

export type Post = { date: string; postDraft: string; postedAt: string | null }

export type AuthState = { signedIn: boolean; authEnabled: boolean }

// A note from a Pomodoro round. `body` is TipTap JSON; `drawing` an Excalidraw scene; `drawingSvg` its snapshot.
export type Note = {
  id: number
  sessionId: number | null
  date: string
  trackId: number
  unitId: number | null
  round: number | null
  body: JSONContent | null
  text: string
  drawing: string | null
  drawingSvg: string | null
  createdAt: string
  updatedAt: string
  track?: { name: string; color: string }
  unitTitle?: string | null
}

export type NoteContent = Pick<Note, 'body' | 'text' | 'drawing' | 'drawingSvg'>

export class ApiError extends Error {}

// The session cookie is missing or expired; the app swaps to the login screen.
export class SignedOutError extends ApiError {}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`/api${path}`, {
    method,
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  if (res.status === 204) return undefined as T
  const data = await res.json().catch(() => ({}))
  const message = (data as { error?: string }).error ?? `Request failed (${res.status})`
  if (res.status === 401 && path !== '/login') throw new SignedOutError(message)
  if (!res.ok) throw new ApiError(message)
  return data as T
}

export const api = {
  session: () => request<AuthState>('GET', '/session'),
  login: (password: string) => request<AuthState>('POST', '/login', { password }),
  logout: () => request<AuthState>('POST', '/logout'),

  today: (date: string) => request<Today>('GET', `/today?date=${date}`),
  tracks: () => request<TrackWithUnits[]>('GET', '/tracks'),
  addUnit: (trackId: number, title: string) => request<Unit>('POST', '/units', { trackId, title }),
  setUnitStatus: (id: number, status: UnitStatus) => request<Unit>('PATCH', `/units/${id}`, { status }),

  startSession: (input: { date: string; trackId: number; blockId?: number | null; unitId?: number | null }) =>
    request<Session>('POST', '/sessions', input),
  updateSession: (
    id: number,
    input: {
      action?: TimerAction
      pomodoro?: boolean
      unitId?: number | null
      learned?: string
      learnedBody?: JSONContent | null
      produced?: string
      minutes?: number
    },
  ) => request<Session>('PATCH', `/sessions/${id}`, input),
  deleteSession: (id: number) => request<void>('DELETE', `/sessions/${id}`),

  day: (date: string) => request<DayDetail>('GET', `/days/${date}`),
  saveDay: (date: string, day: Omit<Day, 'date' | 'postedAt'>) => request<Day>('PUT', `/days/${date}`, day),
  draftPost: (date: string, tone: Tone) =>
    request<Drafted>('POST', `/days/${date}/draft`, { tone }),
  polishPost: (date: string, text: string, tone: Tone) =>
    request<Drafted>('POST', `/days/${date}/polish`, { text, tone }),
  ai: () => request<{ provider: AiProvider | null }>('GET', '/ai'),
  setPosted: (date: string, posted: boolean) =>
    request<{ postedAt: string | null }>('POST', `/days/${date}/posted`, { posted }),
  posts: () => request<Post[]>('GET', '/posts'),
  commits: (since: string, until: string) =>
    request<{ commits: Commit[]; error?: string }>(
      'GET',
      `/github/commits?since=${encodeURIComponent(since)}&until=${encodeURIComponent(until)}`,
    ),

  reviews: (date: string) => request<{ due: ReviewItem[]; upcoming: ReviewItem[] }>('GET', `/reviews?date=${date}`),
  addReview: (input: { date: string; trackId: number; prompt: string; answer: string; answerBody: JSONContent | null }) =>
    request<ReviewItem>('POST', '/reviews', input),
  gradeReview: (id: number, result: 'again' | 'good', date: string) =>
    request<ReviewItem>('POST', `/reviews/${id}/grade`, { result, date }),
  deleteReview: (id: number) => request<void>('DELETE', `/reviews/${id}`),

  progress: (date: string) => request<Progress>('GET', `/progress?date=${date}`),

  notes: (filter: { date?: string; sessionId?: number; trackId?: number }) => {
    const params = new URLSearchParams(
      Object.entries(filter).flatMap(([key, value]) => (value === undefined ? [] : [[key, String(value)]])),
    )
    return request<Note[]>('GET', `/notes?${params}`)
  },
  addNote: (input: NoteContent & { sessionId: number; round: number | null }) => request<Note>('POST', '/notes', input),
  updateNote: (id: number, input: NoteContent) => request<Note>('PATCH', `/notes/${id}`, input),
  deleteNote: (id: number) => request<void>('DELETE', `/notes/${id}`),
}
