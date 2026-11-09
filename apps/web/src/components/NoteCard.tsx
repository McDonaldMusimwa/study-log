import { useState } from 'react'
import type { Note } from '../lib/api'
import { formatTime } from '../lib/date'
import { NoteEditor } from './NoteEditor'
import { RichTextView } from './RichText'
import { Swatch } from './ui'

export const noteLabel = (note: Note) =>
  [note.round ? `Round ${note.round}` : 'Note', note.track?.name, note.unitTitle].filter(Boolean).join(' · ')

// A saved note: its text, its drawing as an image, and an Edit button that reopens the editor.
export function NoteCard({ note }: { note: Note }) {
  const [editing, setEditing] = useState(false)

  return (
    <article className="flex flex-col gap-3 rounded-xl border border-line bg-surface p-4 text-ink">
      <div className="flex items-start justify-between gap-3">
        <span className="flex items-center gap-2 text-[13px] font-semibold text-muted">
          {note.track && <Swatch color={note.track.color} className="size-2" />}
          {noteLabel(note)} · {formatTime(note.createdAt)}
        </span>
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="-my-2 -mr-2 min-h-11 shrink-0 cursor-pointer rounded-lg px-3 text-sm font-semibold text-accent hover:bg-accent-soft"
        >
          Edit
        </button>
      </div>
      {note.text.trim() && <RichTextView content={note.body} />}
      {note.drawingSvg && (
        // As an <img>, the stored SVG can't run scripts.
        <img
          src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(note.drawingSvg)}`}
          alt={`Drawing for ${noteLabel(note)}`}
          className="max-h-96 w-full rounded-lg border border-line bg-white object-contain"
        />
      )}
      {editing && <NoteEditor title={`Edit ${noteLabel(note).toLowerCase()}`} note={note} onClose={() => setEditing(false)} />}
    </article>
  )
}
