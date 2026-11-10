import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Link, useParams } from 'react-router'
import { NoteCard } from '../components/NoteCard'
import { ErrorNote, Loading, PageHeading, Swatch } from '../components/ui'
import { WeekStrip, wrapUpPath } from '../components/WeekStrip'
import { api, type Commit, type DayDetail, type Note, type Tone } from '../lib/api'
import { addDays, dayBounds, formatDay, formatMinutes, isDateString, localDate } from '../lib/date'

const AREAS = ['backend', 'agent', 'postgres', 'docker / ci', 'web', 'mobile']
const TONES: { value: Tone; label: string }[] = [
  { value: 'story', label: 'Story' },
  { value: 'technical', label: 'Technical' },
  { value: 'short', label: 'Short' },
]
// "[build time before]": facts only you know. The draft can't be copied until they're filled in.
const PLACEHOLDER = /\[[^\]\n]+\]/g

function Commits({ date, selected, onToggle }: { date: string; selected: Commit[]; onToggle: (c: Commit) => void }) {
  const { since, until } = dayBounds(date)
  const { data, isLoading } = useQuery({ queryKey: ['commits', date], queryFn: () => api.commits(since, until) })
  // Commits saved earlier stay listed even if GitHub no longer returns them.
  const commits = [...selected.filter((s) => !data?.commits.some((c) => c.sha === s.sha)), ...(data?.commits ?? [])]

  if (isLoading) return <p className="text-sm text-muted">Loading AI Trainer commits…</p>
  return (
    <div className="flex flex-col gap-2.5">
      {data?.error && <p className="text-sm text-warn">{data.error}</p>}
      {commits.length === 0 && !data?.error && <p className="text-sm text-muted">No AI Trainer commits on this day.</p>}
      {commits.map((commit) => {
        const checked = selected.some((s) => s.sha === commit.sha)
        return (
          <label
            key={commit.sha}
            className={`flex cursor-pointer items-start gap-3 rounded-xl border bg-field px-3.5 py-3 text-sm ${
              checked ? 'border-accent' : 'border-line'
            }`}
          >
            <input
              type="checkbox"
              checked={checked}
              onChange={() => onToggle(commit)}
              className="mt-0.5 size-4.5 accent-accent"
            />
            <span>
              <strong>{commit.message}</strong>
              <br />
              <a href={commit.url} target="_blank" rel="noreferrer" className="font-mono text-xs">
                {commit.sha}
              </a>
            </span>
          </label>
        )
      })}
    </div>
  )
}

function WrapUpForm({ date, detail, notes }: { date: string; detail: DayDetail; notes: Note[] }) {
  const { day, sessions } = detail
  const queryClient = useQueryClient()
  // Start from the day's round notes and session summaries, oldest first, if nothing is written yet.
  const [learned, setLearned] = useState(
    () =>
      day.learned ||
      [...notes.slice().reverse().map((n) => n.text.trim()), ...sessions.map((s) => s.learned)]
        .filter(Boolean)
        .join('\n'),
  )
  const [applied, setApplied] = useState(day.applied)
  const [next, setNext] = useState(day.next)
  const [commits, setCommits] = useState(day.commits)
  const [areas, setAreas] = useState(day.areas)
  const [draft, setDraft] = useState(day.postDraft)
  // Who wrote the current draft text, shown under the author line.
  const [madeBy, setMadeBy] = useState<string | null>(null)
  // The draft as it was before the last polish, so the polish can be undone.
  const [beforePolish, setBeforePolish] = useState<string | null>(null)
  const ai = useQuery({ queryKey: ['ai'], queryFn: api.ai, staleTime: Infinity })
  const [tone, setTone] = useState<Tone>('story')
  const [copied, setCopied] = useState(false)

  const values = () => ({ learned, applied, next, commits, areas, postDraft: draft })
  const refresh = () => {
    for (const key of ['day', 'posts', 'progress']) void queryClient.invalidateQueries({ queryKey: [key] })
  }

  const save = useMutation({ mutationFn: () => api.saveDay(date, values()), onSuccess: refresh })
  const generate = useMutation({
    mutationFn: async (t: Tone) => {
      await api.saveDay(date, values())
      return api.draftPost(date, t)
    },
    onSuccess: (result) => {
      setDraft(result.text)
      setBeforePolish(null)
      setMadeBy(result.provider ? `drafted by ${result.provider.label}` : 'template · add a free GROQ_API_KEY for AI drafts')
      refresh()
    },
  })
  const polish = useMutation({
    mutationFn: () => api.polishPost(date, draft, tone),
    onSuccess: (result) => {
      setBeforePolish(draft)
      setDraft(result.text)
      setMadeBy(`polished by ${result.provider?.label ?? 'AI'}`)
      refresh()
    },
  })
  const undoPolish = useMutation({
    mutationFn: (text: string) => api.saveDay(date, { ...values(), postDraft: text }),
    onSuccess: (_, text) => {
      setDraft(text)
      setBeforePolish(null)
      setMadeBy(null)
      refresh()
    },
  })
  const posted = useMutation({
    mutationFn: (value: boolean) => api.setPosted(date, value),
    onSuccess: refresh,
  })
  const isPosted = posted.data ? Boolean(posted.data.postedAt) : Boolean(day.postedAt)

  const placeholders = draft.match(PLACEHOLDER) ?? []
  const copy = async () => {
    await navigator.clipboard.writeText(draft)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 2000)
  }

  const toggleCommit = (commit: Commit) =>
    setCommits((current) =>
      current.some((c) => c.sha === commit.sha) ? current.filter((c) => c.sha !== commit.sha) : [...current, commit],
    )
  const toggleArea = (area: string) =>
    setAreas((current) => (current.includes(area) ? current.filter((a) => a !== area) : [...current, area]))

  const draftWith = (t: Tone) => {
    setTone(t)
    generate.mutate(t)
  }

  return (
    <div className="flex flex-wrap items-start gap-6">
      <form
        onSubmit={(e) => {
          e.preventDefault()
          draftWith(tone)
        }}
        className="card flex min-w-0 flex-[1_1_520px] flex-col gap-6 p-6 sm:p-7"
      >
        <div className="flex flex-col gap-2">
          <label htmlFor="wrap-learned" className="font-display text-[19px] font-bold">
            1. What clicked {date === localDate() ? 'today' : 'that day'}?
          </label>
          <textarea
            id="wrap-learned"
            rows={4}
            value={learned}
            onChange={(e) => setLearned(e.target.value)}
            placeholder="The idea you could now explain to someone else"
            className="field resize-y"
          />
          {sessions.length > 0 && (
            <ul aria-label="Sessions today" className="flex flex-wrap gap-2 text-[13px] font-semibold">
              {sessions.map((s) => (
                <li key={s.id} className="flex items-center gap-1.5 rounded-full bg-bg px-3 py-1.5">
                  <Swatch color={s.color} className="size-2" />
                  {s.track} {formatMinutes(s.minutes)}
                </li>
              ))}
            </ul>
          )}
          {notes.length > 0 && (
            <details className="mt-1 rounded-xl bg-bg p-3" open={notes.length <= 3}>
              <summary className="min-h-8 cursor-pointer text-sm font-semibold text-soft">
                Today's round notes ({notes.length})
              </summary>
              <div className="mt-3 flex flex-col gap-2.5">
                {notes.map((note) => (
                  <NoteCard key={note.id} note={note} />
                ))}
              </div>
            </details>
          )}
        </div>

        <fieldset className="flex flex-col gap-2.5">
          <legend className="mb-2.5 font-display text-[19px] font-bold">2. Where did it show up in AI Trainer?</legend>
          <Commits date={date} selected={commits} onToggle={toggleCommit} />
          <div role="group" aria-label="AI Trainer areas" className="flex flex-wrap gap-2 pt-1">
            {AREAS.map((area) => (
              <button
                key={area}
                type="button"
                aria-pressed={areas.includes(area)}
                onClick={() => toggleArea(area)}
                className={`min-h-11 cursor-pointer rounded-full px-3.5 text-[13px] font-semibold ${
                  areas.includes(area) ? 'bg-accent text-white' : 'border border-line-strong text-soft hover:border-accent'
                }`}
              >
                {area}
              </button>
            ))}
          </div>
          <label htmlFor="wrap-applied" className="mt-1 text-sm font-semibold text-soft">
            In your words
          </label>
          <textarea
            id="wrap-applied"
            rows={3}
            value={applied}
            onChange={(e) => setApplied(e.target.value)}
            placeholder="How today's idea showed up in the AI Trainer code, infra or design"
            className="field resize-y"
          />
        </fieldset>

        <div className="flex flex-col gap-2">
          <label htmlFor="wrap-next" className="font-display text-[19px] font-bold">
            3. What's next?
          </label>
          <input
            id="wrap-next"
            value={next}
            onChange={(e) => setNext(e.target.value)}
            placeholder="Tomorrow's lesson or problem"
            className="field"
          />
        </div>

        <div className="flex flex-wrap gap-2.5">
          <button type="submit" disabled={generate.isPending} className="btn btn-primary">
            {generate.isPending ? 'Drafting…' : draft ? 'Redraft my post' : 'Draft my post'}
          </button>
          <button type="button" disabled={save.isPending} onClick={() => save.mutate()} className="btn btn-ghost">
            {save.isSuccess && !save.isPending ? 'Saved' : 'Save'}
          </button>
        </div>
        <ErrorNote error={generate.error ?? save.error} />
      </form>

      <section aria-label="LinkedIn draft" className="flex min-w-0 flex-[1_1_420px] flex-col gap-3.5">
        <div className="card overflow-hidden">
          <div className="flex items-center gap-3 px-5.5 pt-5">
            <span className="grid size-11 place-items-center rounded-full bg-night font-bold text-white">MM</span>
            <div className="flex flex-col">
              <span className="font-bold">McDonald Musimwa</span>
              <span className="text-[13px] text-muted">
                Draft for LinkedIn · {draft.length.toLocaleString()} characters
                {madeBy && ` · ${madeBy}`}
              </span>
            </div>
          </div>
          <div role="group" aria-label="Tone" className="flex flex-wrap gap-2 px-5.5 pt-4">
            {TONES.map((t) => (
              <button
                key={t.value}
                type="button"
                aria-pressed={tone === t.value}
                disabled={generate.isPending}
                onClick={() => draftWith(t.value)}
                className={`min-h-11 cursor-pointer rounded-lg px-3 text-[13px] font-semibold ${
                  tone === t.value ? 'bg-accent-soft text-accent' : 'text-soft hover:bg-bg'
                }`}
              >
                {t.label}
              </button>
            ))}
            <button
              type="button"
              disabled={!draft.trim() || polish.isPending || generate.isPending || !ai.data?.provider}
              onClick={() => polish.mutate()}
              title={
                ai.data?.provider
                  ? `Improve flow and grammar with ${ai.data.provider.label}, keeping your facts`
                  : 'Add a free GROQ_API_KEY to turn on polishing'
              }
              className="btn ml-auto min-h-11 bg-accent-soft px-3.5 text-[13px] text-accent hover:bg-[#e2e5ff]"
            >
              {polish.isPending ? 'Polishing…' : 'Polish with AI'}
            </button>
          </div>
          {beforePolish !== null && (
            <div className="mx-5.5 mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-bg px-3 py-2 text-[13px] text-soft">
              Polished. Your facts and [placeholders] are kept; check the wording sounds like you.
              <button
                type="button"
                disabled={undoPolish.isPending}
                onClick={() => undoPolish.mutate(beforePolish)}
                className="min-h-9 cursor-pointer rounded-md px-2 font-semibold text-accent hover:bg-accent-soft"
              >
                Undo polish
              </button>
            </div>
          )}
          {ai.data && !ai.data.provider && (
            <p className="mx-5.5 mt-3 text-[13px] text-muted">
              AI drafting and polishing are off. Add a free Groq key (GROQ_API_KEY) to turn them on.
            </p>
          )}
          <label htmlFor="wrap-draft" className="sr-only">
            Post draft
          </label>
          <textarea
            id="wrap-draft"
            rows={16}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Fill in the day, then draft your post. You can edit it here before copying."
            className="block w-full resize-y border-0 bg-transparent px-5.5 py-4 text-[15px] leading-relaxed text-ink placeholder:text-muted"
          />
          <div className="flex flex-wrap gap-2.5 border-t border-[#eef0f3] px-5.5 py-4">
            <button
              type="button"
              disabled={!draft || placeholders.length > 0}
              onClick={() => void copy()}
              className="btn btn-primary"
            >
              {copied ? 'Copied' : 'Copy'}
            </button>
            <button type="button" disabled={save.isPending || !draft} onClick={() => save.mutate()} className="btn btn-ghost">
              Save edits
            </button>
            <a href="https://www.linkedin.com/feed/" target="_blank" rel="noreferrer" className="btn btn-ghost">
              Open LinkedIn ↗
            </a>
            <button
              type="button"
              disabled={!draft || posted.isPending}
              onClick={() => posted.mutate(!isPosted)}
              aria-pressed={isPosted}
              className={`btn ml-auto ${isPosted ? 'bg-ok text-white' : 'bg-ok-soft text-ok hover:bg-[#d3eee1]'}`}
            >
              {isPosted ? 'Posted ✓' : 'I posted it'}
            </button>
          </div>
        </div>
        {placeholders.length > 0 && (
          <p className="text-[13px] text-warn">
            Fill in {placeholders.join(', ')} before copying. Those are facts only you know.
          </p>
        )}
        <ErrorNote error={posted.error ?? polish.error ?? undoPolish.error} />
      </section>
    </div>
  )
}

export function WrapUp({ today }: { today: string }) {
  const param = useParams().date
  // A bad or future date in the address falls back to today.
  const date = param && isDateString(param) && param <= today ? param : today
  const yesterday = addDays(today, -1)
  const { data, error } = useQuery({ queryKey: ['day', date], queryFn: () => api.day(date) })
  const notes = useQuery({ queryKey: ['notes', { date }], queryFn: () => api.notes({ date }) })
  const week = useQuery({ queryKey: ['today', date], queryFn: () => api.today(date) })
  // On today's wrap-up, point out a yesterday that was studied but never got a post.
  const prev = useQuery({ queryKey: ['day', yesterday], queryFn: () => api.day(yesterday), enabled: date === today })
  const yesterdayPending =
    date === today && prev.data && prev.data.sessions.length > 0 && !prev.data.day.postDraft && !prev.data.day.postedAt

  return (
    <>
      <PageHeading
        eyebrow={`${formatDay(date)}${data ? ` · Day ${data.dayNumber}` : ''}${
          data ? ` · ${formatMinutes(data.sessions.reduce((sum, s) => sum + s.minutes, 0))} studied` : ''
        }`}
        title={
          date === today
            ? 'Close the day'
            : date === yesterday
              ? 'Wrap up yesterday'
              : `Wrap up ${formatDay(date, { weekday: 'long', day: 'numeric', month: 'short' })}`
        }
        aside={
          week.data && (
            <WeekStrip
              weekStart={week.data.weekStart}
              weekStudied={week.data.weekStudied}
              today={today}
              selected={date}
              pathFor={wrapUpPath}
            />
          )
        }
      />
      {yesterdayPending && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-[18px] bg-accent-soft px-5 py-4">
          <p className="text-[15px] text-soft">
            <strong className="text-ink">Yesterday</strong> ({formatDay(yesterday, { weekday: 'short', day: 'numeric', month: 'short' })})
            has {prev.data.sessions.length} {prev.data.sessions.length === 1 ? 'session' : 'sessions'} logged and no
            LinkedIn post yet.
          </p>
          <Link to={wrapUpPath(yesterday, today)} className="btn btn-primary hover:text-white">
            Wrap up yesterday
          </Link>
        </div>
      )}
      {date < today && (
        <p className="-mt-2 text-sm text-muted">
          Wrapping up a past day. <Link to={`/day/${date}`}>See that day's review</Link> or pick another date above.
        </p>
      )}
      <ErrorNote error={error} />
      {data && notes.data ? (
        <WrapUpForm key={date} date={date} detail={data} notes={notes.data} />
      ) : (
        !error && <Loading />
      )}
    </>
  )
}
