import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Link } from 'react-router'
import { NoteCard } from '../components/NoteCard'
import { ErrorNote, Loading, PageHeading } from '../components/ui'
import { api, type Note } from '../lib/api'
import { formatDay } from '../lib/date'

// Every round note, newest day first, optionally for one track: a notebook to revise from.
export function Notes() {
  const [trackId, setTrackId] = useState('')
  const { data: tracks } = useQuery({ queryKey: ['tracks'], queryFn: api.tracks })
  const filter = trackId ? { trackId: Number(trackId) } : {}
  const { data: notes, error } = useQuery({ queryKey: ['notes', filter], queryFn: () => api.notes(filter) })

  const byDay = new Map<string, Note[]>()
  for (const note of notes ?? []) byDay.set(note.date, [...(byDay.get(note.date) ?? []), note])

  return (
    <>
      <PageHeading
        eyebrow="Everything you grasped, round by round"
        title="Notes"
        aside={
          <div className="flex w-full flex-col gap-2 sm:w-64">
            <label htmlFor="notes-track" className="text-sm font-semibold text-soft">
              Track
            </label>
            <select id="notes-track" value={trackId} onChange={(e) => setTrackId(e.target.value)} className="field">
              <option value="">All tracks</option>
              {tracks?.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
        }
      />
      <ErrorNote error={error} />
      {!notes ? (
        !error && <Loading />
      ) : notes.length === 0 ? (
        <p className="text-muted">
          No notes yet. Start a session on <Link to="/">Today</Link> and add a note during a round, or when a break begins.
        </p>
      ) : (
        [...byDay].map(([date, dayNotes]) => (
          <section key={date} className="flex flex-col gap-3">
            <h2 className="font-display text-xl font-bold">{formatDay(date)}</h2>
            <div className="grid gap-3 lg:grid-cols-2">
              {dayNotes.map((note) => (
                <NoteCard key={note.id} note={note} />
              ))}
            </div>
          </section>
        ))
      )}
    </>
  )
}
