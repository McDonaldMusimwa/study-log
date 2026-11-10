import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { JSONContent } from '@tiptap/react'
import { useState } from 'react'
import { Link, Navigate, useParams } from 'react-router'
import { NoteCard } from '../components/NoteCard'
import { RichTextEditor, RichTextView } from '../components/RichText'
import { ErrorNote, Loading, PageHeading, Swatch } from '../components/ui'
import { WeekStrip } from '../components/WeekStrip'
import { api, type Session, type Track } from '../lib/api'
import { addDays, formatDay, formatMinutes, formatTime, isDateString } from '../lib/date'

// One logged session from that day, with its "What clicked" editable after the fact.
function SessionReview({ session, track }: { session: Session; track?: Track }) {
  const [editing, setEditing] = useState(false)
  const [learned, setLearned] = useState(session.learned)
  const [learnedBody, setLearnedBody] = useState<JSONContent | null>(session.learnedBody)
  const queryClient = useQueryClient()
  const save = useMutation({
    mutationFn: () => api.updateSession(session.id, { learned, learnedBody }),
    onSuccess: () => {
      setEditing(false)
      for (const key of ['today', 'day', 'progress']) void queryClient.invalidateQueries({ queryKey: [key] })
    },
  })
  const when = session.endedAt
    ? `${formatTime(session.startedAt)}–${formatTime(session.endedAt)}`
    : `started ${formatTime(session.startedAt)}`

  return (
    <article className="card flex flex-col gap-3 p-5 sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <h3 className="font-semibold">
            {track && <Swatch color={track.color} className="mr-2 size-2.5 align-middle" />}
            {track?.name ?? 'Session'}
            {session.unitTitle && <span className="font-normal text-muted"> · {session.unitTitle}</span>}
          </h3>
          <p className="text-sm text-muted">
            {when} · {formatMinutes(session.minutes)} focused
            {session.pomodoros > 0 && ` · ${session.pomodoros} Pomodoro${session.pomodoros === 1 ? '' : 's'}`}
          </p>
        </div>
        {!editing && (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="-my-2 -mr-2 min-h-11 shrink-0 cursor-pointer rounded-lg px-3 text-sm font-semibold text-accent hover:bg-accent-soft"
          >
            Edit
          </button>
        )}
      </div>

      {editing ? (
        <div className="flex flex-col gap-3">
          <p className="text-sm font-semibold text-soft">What clicked</p>
          <RichTextEditor
            initial={session.learnedBody ?? (session.learned ? { type: 'doc', content: session.learned.split('\n').map((line) => ({ type: 'paragraph', content: line ? [{ type: 'text', text: line }] : [] })) } : null)}
            placeholder="What clicked this session?"
            minHeight="min-h-28"
            autoFocus
            onChange={(body, text) => {
              setLearnedBody(body)
              setLearned(text)
            }}
          />
          <div className="flex gap-2.5">
            <button type="button" disabled={save.isPending} onClick={() => save.mutate()} className="btn btn-primary">
              Save
            </button>
            <button type="button" onClick={() => setEditing(false)} className="btn btn-ghost">
              Cancel
            </button>
          </div>
          <ErrorNote error={save.error} />
        </div>
      ) : session.learnedBody ? (
        <RichTextView content={session.learnedBody} />
      ) : session.learned ? (
        <p className="text-[15px] leading-relaxed whitespace-pre-line">{session.learned}</p>
      ) : (
        <p className="text-sm text-muted">Nothing written for this session.</p>
      )}
      {session.produced && (
        <p className="text-sm text-soft">
          <span className="font-semibold">Produced:</span> {session.produced}
        </p>
      )}
    </article>
  )
}

// Looking back at one day: what was studied, the round notes, and that day's LinkedIn post.
export function DayPage({ today }: { today: string }) {
  const date = useParams().date ?? ''
  const valid = isDateString(date) && date < today
  const dayQuery = useQuery({ queryKey: ['today', date], queryFn: () => api.today(date), enabled: valid })
  const detail = useQuery({ queryKey: ['day', date], queryFn: () => api.day(date), enabled: valid })
  const notes = useQuery({ queryKey: ['notes', { date }], queryFn: () => api.notes({ date }), enabled: valid })
  const tracks = useQuery({ queryKey: ['tracks'], queryFn: api.tracks })
  const [copied, setCopied] = useState(false)

  // Today has its own page; the future has nothing to review.
  if (!valid) return <Navigate to="/" replace />

  const data = dayQuery.data
  const error = dayQuery.error ?? detail.error ?? notes.error
  const sessions = data ? [...data.blocks.flatMap((b) => b.sessions), ...data.unplanned] : []
  sessions.sort((a, b) => a.startedAt.localeCompare(b.startedAt))
  const post = detail.data?.day.postDraft ?? ''
  const posted = Boolean(detail.data?.day.postedAt)
  const yesterday = date === addDays(today, -1)

  const copy = async () => {
    await navigator.clipboard.writeText(post)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 2000)
  }

  return (
    <>
      <PageHeading
        eyebrow={`${formatDay(date)}${data ? ` · Day ${data.dayNumber} · ${formatMinutes(data.dayMinutes)} studied` : ''}`}
        title={yesterday ? 'Yesterday' : formatDay(date, { weekday: 'long' })}
        aside={
          data && <WeekStrip weekStart={data.weekStart} weekStudied={data.weekStudied} today={today} selected={date} />
        }
      />
      <ErrorNote error={error} />
      {!data || !detail.data || !notes.data ? (
        !error && <Loading />
      ) : (
        <div className="flex flex-wrap items-start gap-6">
          <div className="flex min-w-0 flex-[999_1_560px] flex-col gap-4">
            <h2 className="font-display text-xl font-bold">Sessions</h2>
            {sessions.length === 0 ? (
              <p className="card p-6 text-muted">No study logged on this day.</p>
            ) : (
              sessions.map((session) => (
                <SessionReview key={session.id} session={session} track={tracks.data?.find((t) => t.id === session.trackId)} />
              ))
            )}
            {notes.data.length > 0 && (
              <>
                <h2 className="mt-2 font-display text-xl font-bold">Round notes</h2>
                {notes.data.map((note) => (
                  <NoteCard key={note.id} note={note} />
                ))}
              </>
            )}
          </div>

          <aside className="flex min-w-0 flex-[1_1_340px] flex-col gap-4">
            <section className="card flex flex-col gap-4 p-6">
              <div className="flex items-center justify-between gap-3">
                <h2 className="font-display text-xl font-bold">LinkedIn post</h2>
                <span
                  className={`rounded-full px-2.5 py-1 text-[13px] font-semibold ${
                    posted ? 'bg-ok-soft text-ok' : post ? 'bg-bg text-muted' : 'bg-warn-soft text-warn'
                  }`}
                >
                  {posted ? 'Posted' : post ? 'Draft' : 'Not written'}
                </span>
              </div>
              {post ? (
                <p className="max-h-96 overflow-y-auto text-[15px] leading-relaxed whitespace-pre-line">{post}</p>
              ) : (
                <p className="text-[15px] text-muted">No post for this day yet. Wrap the day up to draft one.</p>
              )}
              <div className="flex flex-wrap gap-2.5">
                <Link to={`/wrap-up/${date}`} className="btn btn-primary hover:text-white">
                  {post ? 'Edit post' : 'Wrap up this day'}
                </Link>
                {post && (
                  <button type="button" onClick={() => void copy()} className="btn btn-ghost">
                    {copied ? 'Copied' : 'Copy'}
                  </button>
                )}
              </div>
            </section>
          </aside>
        </div>
      )}
    </>
  )
}
