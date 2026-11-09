import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { CheckIcon } from '../components/icons'
import { NoteCard } from '../components/NoteCard'
import { NoteEditor } from '../components/NoteEditor'
import { RecallCard } from '../components/RecallCard'
import { ErrorNote, Loading, PageHeading, Swatch } from '../components/ui'
import { api, type Block, type Session, type TimerAction, type Today, type TrackWithUnits } from '../lib/api'
import { addDays, formatClock, formatDay, formatMinutes, formatTime, parseDate, partOfDay, useNow } from '../lib/date'
import { useWakeLock } from '../lib/wakeLock'
import { FOCUS_MS, askToNotify, chime, notify, plannedRounds, timerState, type Phase } from '../lib/pomodoro'

const NEW_UNIT = 'new'

function useInvalidateDay() {
  const queryClient = useQueryClient()
  return () => {
    for (const key of ['today', 'tracks', 'day', 'progress']) void queryClient.invalidateQueries({ queryKey: [key] })
  }
}

function WeekStrip({ data, today }: { data: Today; today: string }) {
  return (
    <ol
      aria-label="This week"
      className="grid min-w-[min(100%,420px)] grid-cols-7 gap-2 text-center text-xs font-semibold text-muted"
    >
      {Array.from({ length: 7 }, (_, i) => {
        const date = addDays(data.weekStart, i)
        const studied = data.weekStudied.includes(date)
        const isToday = date === today
        return (
          <li key={date} className="flex flex-col items-center gap-1.5">
            {formatDay(date, { weekday: 'short' })}
            <span
              className={`grid size-9 place-items-center rounded-[10px] text-[13px] ${
                isToday
                  ? 'border-2 border-accent text-accent'
                  : studied
                    ? 'bg-accent text-white'
                    : i >= 5
                      ? 'border border-dashed border-line-strong bg-surface'
                      : 'border border-line bg-surface'
              }`}
            >
              {parseDate(date).getDate()}
              <span className="sr-only">{studied ? ' (studied)' : ''}</span>
            </span>
          </li>
        )
      })}
    </ol>
  )
}

// Logging form for the running session: which unit, what clicked, what you made. One field per row.
function LogForm({ session, track }: { session: Session; track: TrackWithUnits }) {
  const open = track.units.filter((u) => u.status !== 'done')
  const suggested = session.unitId ?? open.find((u) => u.status === 'in_progress')?.id ?? open[0]?.id
  const [unit, setUnit] = useState(suggested ? String(suggested) : NEW_UNIT)
  const [newUnit, setNewUnit] = useState('')
  const [learned, setLearned] = useState(session.learned)
  const [produced, setProduced] = useState(session.produced)
  const invalidate = useInvalidateDay()

  const finish = useMutation({
    mutationFn: async () => {
      let unitId = unit === NEW_UNIT ? null : Number(unit)
      if (unit === NEW_UNIT && newUnit.trim()) unitId = (await api.addUnit(track.id, newUnit.trim())).id
      return api.updateSession(session.id, { action: 'stop', unitId, learned, produced })
    },
    onSuccess: invalidate,
  })
  const discard = useMutation({ mutationFn: () => api.deleteSession(session.id), onSuccess: invalidate })

  const submit = (event: FormEvent) => {
    event.preventDefault()
    finish.mutate()
  }

  const field = 'w-full rounded-xl border border-white/15 bg-white/5 px-3.5 py-3 text-[15px] text-white placeholder:text-white/50'

  return (
    <form onSubmit={submit} className="flex w-full flex-col gap-4 border-t border-white/10 pt-5">
      <div className="flex flex-col gap-2">
        <label htmlFor="log-unit" className="text-sm font-semibold text-[#c6ccd6]">
          {track.unitLabel[0]!.toUpperCase() + track.unitLabel.slice(1)}
        </label>
        <select id="log-unit" value={unit} onChange={(e) => setUnit(e.target.value)} className={field}>
          {open.map((u) => (
            <option key={u.id} value={u.id} className="text-ink">
              {u.title}
            </option>
          ))}
          <option value={NEW_UNIT} className="text-ink">
            New {track.unitLabel}…
          </option>
        </select>
      </div>
      {unit === NEW_UNIT && (
        <div className="flex flex-col gap-2">
          <label htmlFor="log-new-unit" className="text-sm font-semibold text-[#c6ccd6]">
            New {track.unitLabel} title
          </label>
          <input
            id="log-new-unit"
            value={newUnit}
            onChange={(e) => setNewUnit(e.target.value)}
            placeholder={track.slug === 'devops' ? 'Linux · services and systemctl' : `Name this ${track.unitLabel}`}
            className={field}
          />
        </div>
      )}
      <div className="flex flex-col gap-2">
        <label htmlFor="log-learned" className="text-sm font-semibold text-[#c6ccd6]">
          What clicked
        </label>
        <textarea
          id="log-learned"
          rows={3}
          value={learned}
          onChange={(e) => setLearned(e.target.value)}
          placeholder="Explain it in your own words"
          className={field}
        />
      </div>
      <div className="flex flex-col gap-2">
        <label htmlFor="log-produced" className="text-sm font-semibold text-[#c6ccd6]">
          What you produced
        </label>
        <input
          id="log-produced"
          value={produced}
          onChange={(e) => setProduced(e.target.value)}
          placeholder="A diagram, commands you ran, a solved problem…"
          className={field}
        />
      </div>
      <div className="flex flex-wrap gap-2.5">
        <button type="submit" disabled={finish.isPending} className="btn bg-white text-ink hover:bg-[#e8eaee]">
          Finish &amp; log
        </button>
        <button
          type="button"
          disabled={discard.isPending}
          onClick={() => discard.mutate()}
          className="btn border border-white/25 text-white hover:border-white/60"
        >
          Discard session
        </button>
      </div>
      <ErrorNote error={finish.error ?? discard.error} />
    </form>
  )
}

const PHASE_COPY: Record<Phase, string> = {
  focus: 'Focus',
  break: 'Break',
  paused: 'Paused',
}

// Notes for each Pomodoro round of the running session. A break is the natural moment to write one,
// so the button gets louder then and files the note under the round that just finished.
function RoundNotes({ session, phase, trackName }: { session: Session; phase: Phase; trackName: string }) {
  const [open, setOpen] = useState(false)
  const { data: notes = [] } = useQuery({
    queryKey: ['notes', { sessionId: session.id }],
    queryFn: () => api.notes({ sessionId: session.id }),
  })
  const round = !session.pomodoro ? null : phase === 'break' ? session.pomodoros : session.pomodoros + 1
  const onBreak = phase === 'break' && round !== null && !notes.some((n) => n.round === round)
  const title = round ? `Round ${round} notes · ${trackName}` : `Notes · ${trackName}`

  return (
    <div className="flex flex-col gap-3 border-t border-white/10 pt-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col">
          <h3 className="font-display text-lg font-bold">Round notes</h3>
          <p className="text-sm text-[#c6ccd6]">
            {onBreak ? `What did you grasp in round ${round}?` : 'Capture ideas as they click, with a sketch if it helps.'}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={`btn ${onBreak ? 'bg-white text-ink hover:bg-[#e8eaee]' : 'border border-white/25 text-white hover:border-white/60'}`}
        >
          {onBreak ? `Capture round ${round}` : '+ Add note'}
        </button>
      </div>
      {notes.length > 0 && (
        <div className="flex flex-col gap-2.5">
          {notes.map((note) => (
            <NoteCard key={note.id} note={note} />
          ))}
        </div>
      )}
      {open && <NoteEditor title={title} target={{ sessionId: session.id, round }} onClose={() => setOpen(false)} />}
    </div>
  )
}

// The running session: Pomodoro rounds with automatic breaks, or a plain stopwatch, plus pause and resume.
function RunningCard({ session, track, block }: { session: Session; track?: TrackWithUnits; block?: Block }) {
  const now = useNow(true)
  const invalidate = useInvalidateDay()
  const timer = useMutation({
    mutationFn: (input: { action?: TimerAction; pomodoro?: boolean }) => api.updateSession(session.id, input),
    onSuccess: invalidate,
  })
  const state = timerState(session, now)
  useWakeLock(state.phase !== 'paused')
  const rounds = Math.max(plannedRounds(block?.minutes ?? 30), session.pomodoros + (state.phase === 'focus' ? 1 : 0))

  // Switch between focus and break when a phase runs out. The key stops a slow request from firing twice.
  const handled = useRef('')
  const due =
    !session.pomodoro || timer.isPending
      ? null
      : state.phase === 'focus' && state.focusLeftMs <= 0
        ? 'break'
        : state.phase === 'break' && state.breakLeftMs <= 0
          ? 'resume'
          : null
  useEffect(() => {
    const key = `${session.id}:${session.pomodoros}:${session.pausedAt}`
    if (!due || handled.current === key) return
    handled.current = key
    chime()
    if (due === 'break') notify('Break time', 'Jot down what you grasped this round, then stand up and stretch.')
    else notify('Back to focus', `${track?.name ?? 'Your session'}: next round starts now.`)
    timer.mutate({ action: due })
  }, [due, session.id, session.pomodoros, session.pausedAt, state.longBreak, timer, track?.name])

  const clock =
    state.phase === 'break'
      ? state.breakLeftMs
      : session.pomodoro && state.phase === 'focus'
        ? state.focusLeftMs
        : state.focusedMs
  const phaseTotal = state.phase === 'break' ? state.breakMs : FOCUS_MS
  const phaseDone = state.phase === 'break' ? state.breakMs - state.breakLeftMs : state.roundMs
  const label =
    state.phase === 'break'
      ? state.longBreak
        ? 'Long break · get some air'
        : 'Short break · stand up, stretch, water'
      : state.phase === 'paused'
        ? 'Paused · study time is on hold'
        : session.pomodoro
          ? `Focus · round ${Math.min(session.pomodoros + 1, rounds)} of ${rounds}`
          : 'Focus · stopwatch'

  // Keep the countdown in the tab title, so it's visible from other tabs.
  useEffect(() => {
    document.title = `${formatClock(Math.max(0, Math.ceil(clock / 1000)))} · ${PHASE_COPY[state.phase]} · Study Log`
  }, [clock, state.phase])
  useEffect(() => () => void (document.title = 'Study Log'), [])

  return (
    <section
      aria-label="Current session"
      className={`flex flex-col gap-5 rounded-[18px] p-6 text-white transition-colors sm:p-7 ${
        state.phase === 'break' ? 'bg-[#123b2f]' : 'bg-night'
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-x-8 gap-y-3">
        <div className="flex min-w-0 flex-col gap-1.5">
          <span className="text-[13px] font-semibold tracking-wide text-[#a8b0bf] uppercase">
            Now · {track?.name ?? 'Session'} · started {formatTime(session.startedAt)}
          </span>
          <h2 className="font-display text-[26px] leading-tight font-bold">
            {session.unitTitle ?? track?.units.find((u) => u.id === session.unitId)?.title ?? 'In session'}
          </h2>
        </div>
        <div className="flex flex-col items-start gap-1 sm:items-end">
          <span
            role="timer"
            className={`font-display text-[56px] leading-none font-bold tracking-tight tabular-nums ${
              state.phase === 'paused' ? 'opacity-60' : ''
            }`}
          >
            {formatClock(Math.max(0, Math.ceil(clock / 1000)))}
          </span>
          <span className="text-sm text-[#c6ccd6]">{label}</span>
        </div>
      </div>

      {session.pomodoro && (
        <div className="flex flex-col gap-2.5">
          <div className="h-1.5 overflow-hidden rounded-full bg-white/10" aria-hidden="true">
            <span
              className={`block h-full transition-[width] duration-1000 ${state.phase === 'break' ? 'bg-[#6ee7b7]' : 'bg-white'}`}
              style={{ width: `${Math.min(100, (Math.max(0, phaseDone) / phaseTotal) * 100)}%` }}
            />
          </div>
          <div className="flex items-center gap-2 text-[13px] text-[#c6ccd6]">
            <span className="flex gap-1.5" aria-label={`${session.pomodoros} of ${rounds} Pomodoros done`}>
              {Array.from({ length: rounds }, (_, i) => (
                <span
                  key={i}
                  className={`size-2.5 rounded-full ${i < session.pomodoros ? 'bg-white' : 'border border-white/40'}`}
                />
              ))}
            </span>
            <span>focused {formatMinutes(Math.floor(state.focusedMs / 60_000))}</span>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2.5">
        {state.phase === 'focus' ? (
          <button
            type="button"
            disabled={timer.isPending}
            onClick={() => timer.mutate({ action: 'pause' })}
            className="btn border border-white/25 text-white hover:border-white/60"
          >
            Pause
          </button>
        ) : (
          <button
            type="button"
            disabled={timer.isPending}
            onClick={() => timer.mutate({ action: 'resume' })}
            className="btn bg-white text-ink hover:bg-[#e8eaee]"
          >
            {state.phase === 'break' ? 'Skip break' : 'Resume'}
          </button>
        )}
        <label className="ml-auto flex min-h-11 cursor-pointer items-center gap-2.5 text-sm text-[#c6ccd6]">
          <input
            type="checkbox"
            checked={session.pomodoro}
            disabled={timer.isPending}
            onChange={(e) => timer.mutate({ pomodoro: e.target.checked })}
            className="size-4.5 accent-white"
          />
          Pomodoro timer
        </label>
      </div>
      <ErrorNote error={timer.error} />

      <RoundNotes session={session} phase={state.phase} trackName={track?.name ?? 'Session'} />

      {track && <LogForm key={session.id} session={session} track={track} />}
    </section>
  )
}

function NowCard({ data, tracks, today }: { data: Today; tracks: TrackWithUnits[]; today: string }) {
  const running = data.running
  const invalidate = useInvalidateDay()
  const start = useMutation({ mutationFn: api.startSession, onMutate: askToNotify, onSuccess: invalidate })

  if (running) {
    return (
      <RunningCard
        session={running}
        track={tracks.find((t) => t.id === running.trackId)}
        block={data.blocks.find((b) => b.id === running.blockId)}
      />
    )
  }

  const next = data.blocks.find((b) => b.sessions.length === 0)
  return (
    <section aria-label="Next session" className="flex flex-wrap items-center gap-x-8 gap-y-4 rounded-[18px] bg-night p-6 text-white sm:p-7">
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <span className="text-[13px] font-semibold tracking-wide text-[#a8b0bf] uppercase">
          {next ? `Up next · ${partOfDay(next.startTime).toLowerCase()}` : data.blocks.length ? 'Plan complete' : 'Rest day'}
        </span>
        <h2 className="font-display text-[26px] leading-tight font-bold">
          {next ? `${next.track.name} · ${next.minutes} min` : data.blocks.length ? 'Nice work. Time to wrap up.' : 'No sessions planned today.'}
        </h2>
      </div>
      {next ? (
        <button
          type="button"
          disabled={start.isPending}
          onClick={() => start.mutate({ date: today, trackId: next.track.id, blockId: next.id })}
          className="btn w-full bg-white text-ink hover:bg-[#e8eaee] sm:w-auto"
        >
          Start {next.track.name}
        </button>
      ) : (
        data.blocks.length > 0 && (
          <Link to="/wrap-up" className="btn bg-white text-ink hover:bg-[#e8eaee] hover:text-ink">
            Start wrap-up
          </Link>
        )
      )}
      <ErrorNote error={start.error} />
    </section>
  )
}

// When you actually studied (recorded when you pressed Start and Finish), plus what came of it.
function SessionSummary({ session }: { session: Session }) {
  const when = session.endedAt
    ? `${formatTime(session.startedAt)}–${formatTime(session.endedAt)}`
    : `started ${formatTime(session.startedAt)}`
  const details = [when, session.unitTitle, session.learned || session.produced].filter(Boolean).join(' · ')
  return <span className="text-sm text-muted">{details}</span>
}

function PlanRow({ block, today, running }: { block: Block; today: string; running: Session | null }) {
  const invalidate = useInvalidateDay()
  const start = useMutation({ mutationFn: api.startSession, onMutate: askToNotify, onSuccess: invalidate })
  const isRunning = block.sessions.some((s) => s.id === running?.id)
  const done = block.sessions.filter((s) => s.endedAt)
  const minutes = done.reduce((sum, s) => sum + s.minutes, 0)

  return (
    <li className={`flex items-start gap-4 border-b border-[#eef0f3] px-6 py-4 last:border-b-0 ${isRunning ? 'bg-[#fafbff]' : ''}`}>
      <Swatch color={block.track.color} className="mt-1.5 size-2.5" />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="font-semibold">
          {block.track.name} <span className="font-normal text-muted">· {block.minutes} min</span>
        </span>
        {block.sessions.map((s) => (
          <SessionSummary key={s.id} session={s} />
        ))}
      </div>
      {isRunning ? (
        <span className="rounded-full bg-accent-soft px-2.5 py-1 text-[13px] font-semibold text-accent">Now</span>
      ) : done.length ? (
        <span className="flex items-center gap-1 rounded-full bg-ok-soft px-2.5 py-1 text-[13px] font-semibold text-ok">
          <CheckIcon className="size-3.5" /> {formatMinutes(minutes)}
        </span>
      ) : (
        <button
          type="button"
          disabled={start.isPending}
          onClick={() => start.mutate({ date: today, trackId: block.track.id, blockId: block.id })}
          className="btn min-h-11 border border-line-strong px-3.5 py-1.5 text-[13px] text-soft hover:border-accent hover:text-accent"
        >
          Start
        </button>
      )}
    </li>
  )
}

function ExtraSession({ tracks, today }: { tracks: TrackWithUnits[]; today: string }) {
  const [trackId, setTrackId] = useState(String(tracks[0]?.id ?? ''))
  const invalidate = useInvalidateDay()
  const start = useMutation({ mutationFn: api.startSession, onMutate: askToNotify, onSuccess: invalidate })

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        start.mutate({ date: today, trackId: Number(trackId) })
      }}
      className="flex flex-col gap-2 border-t border-line px-6 py-4"
    >
      <label htmlFor="extra-track" className="text-sm font-semibold text-soft">
        Unplanned session
      </label>
      <select id="extra-track" value={trackId} onChange={(e) => setTrackId(e.target.value)} className="field">
        {tracks.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
          </option>
        ))}
      </select>
      <button type="submit" disabled={start.isPending} className="btn btn-ghost self-start">
        Start timer
      </button>
    </form>
  )
}

function headline(data: Today) {
  if (data.running?.pauseKind === 'break') return 'On a break. Step away for a bit.'
  if (data.running?.pausedAt) return 'Paused. Pick it back up when ready.'
  if (data.running) return 'In session. Keep going.'
  if (data.blocks.length && data.blocks.every((b) => b.sessions.length)) return 'Plan done. Time to wrap up.'
  if (data.dayMinutes) return `${formatMinutes(data.dayMinutes)} in. Keep going.`
  return 'Ready when you are.'
}

export function TodayPage({ today }: { today: string }) {
  const todayQuery = useQuery({ queryKey: ['today', today], queryFn: () => api.today(today) })
  const tracksQuery = useQuery({ queryKey: ['tracks'], queryFn: api.tracks })
  const reviewsQuery = useQuery({ queryKey: ['reviews', today], queryFn: () => api.reviews(today) })

  const data = todayQuery.data
  const tracks = tracksQuery.data
  if (todayQuery.error || tracksQuery.error) return <ErrorNote error={todayQuery.error ?? tracksQuery.error} />
  if (!data || !tracks) return <Loading />

  const nextReview = reviewsQuery.data?.due[0]
  const weekPercent = Math.min(100, Math.round((data.weekMinutes / data.weekTargetMinutes) * 100))

  return (
    <>
      <PageHeading
        eyebrow={`${formatDay(today)} · Day ${data.dayNumber}`}
        title={headline(data)}
        aside={<WeekStrip data={data} today={today} />}
      />
      <div className="flex flex-wrap items-start gap-6">
        <div className="flex min-w-0 flex-[999_1_600px] flex-col gap-5">
          <NowCard data={data} tracks={tracks} today={today} />
          <section className="card">
            <h2 className="px-6 pt-5 pb-2 font-display text-xl font-bold">Today's plan</h2>
            {data.blocks.length ? (
              (['Morning', 'After work'] as const).map((part) => {
                const blocks = data.blocks.filter((b) => partOfDay(b.startTime) === part)
                if (!blocks.length) return null
                return (
                  <div key={part}>
                    <h3 className="px-6 pt-3 pb-1 text-xs font-semibold tracking-wider text-muted uppercase">{part}</h3>
                    <ol>
                      {blocks.map((block) => (
                        <PlanRow key={block.id} block={block} today={today} running={data.running} />
                      ))}
                    </ol>
                  </div>
                )
              })
            ) : (
              <p className="px-6 pb-4 text-muted">Weekends are for rest and light review.</p>
            )}
            {data.unplanned.length > 0 && (
              <ul className="border-t border-line px-6 py-3">
                {data.unplanned.map((s) => {
                  const track = tracks.find((t) => t.id === s.trackId)
                  return (
                    <li key={s.id} className="flex items-start gap-4 py-2">
                      <Swatch color={track?.color ?? '#999'} className="mt-1.5 size-2.5" />
                      <div className="flex min-w-0 flex-1 flex-col">
                        <span className="font-semibold">
                          {track?.name} <span className="font-normal text-muted">· extra</span>
                        </span>
                        <SessionSummary session={s} />
                      </div>
                      <span className="text-[13px] font-semibold text-muted">
                        {s.endedAt ? formatMinutes(s.minutes) : 'Now'}
                      </span>
                    </li>
                  )
                })}
              </ul>
            )}
            <ExtraSession tracks={tracks} today={today} />
          </section>
        </div>

        <aside className="flex min-w-0 flex-[1_1_320px] flex-col gap-5">
          {nextReview ? (
            <RecallCard key={nextReview.id} item={nextReview} today={today} position={`Recall · 1 of ${data.reviewDue} due`} />
          ) : (
            <section className="card flex flex-col gap-2 p-6">
              <h2 className="font-display text-xl font-bold">Nothing to recall</h2>
              <p className="text-[15px] text-muted">
                Add concepts you want to explain from memory later. <Link to="/review">Add a recall card</Link>
              </p>
            </section>
          )}
          <section className="flex flex-col gap-3 rounded-[18px] bg-accent-soft p-6">
            <h2 className="font-display text-xl font-bold">Tonight's wrap-up</h2>
            <p className="text-[15px] text-soft">
              Two lines on what you learned and how it shows up in AI Trainer. Claude drafts the LinkedIn post.
            </p>
            <Link to="/wrap-up" className="btn btn-primary hover:text-white">
              Start wrap-up
            </Link>
          </section>
          <section className="card flex flex-col gap-3 p-6">
            <h2 className="text-[15px] font-bold">Week so far</h2>
            <div
              className="h-2.5 overflow-hidden rounded-full bg-[#eef0f3]"
              role="progressbar"
              aria-valuenow={weekPercent}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Weekly study target"
            >
              <span className="block h-full bg-accent" style={{ width: `${weekPercent}%` }} />
            </div>
            <p className="text-sm text-muted">
              <strong className="text-ink">{formatMinutes(data.weekMinutes)}</strong> of{' '}
              {formatMinutes(data.weekTargetMinutes)} · today {formatMinutes(data.dayMinutes)} of{' '}
              {formatMinutes(data.plannedMinutes)} planned
            </p>
          </section>
        </aside>
      </div>
    </>
  )
}
