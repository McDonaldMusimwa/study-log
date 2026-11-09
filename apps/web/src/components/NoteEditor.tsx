import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { JSONContent } from '@tiptap/react'
import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { api, type Note } from '../lib/api'
import { RichTextEditor } from './RichText'
import { ErrorNote } from './ui'
import type { WhiteboardHandle } from './Whiteboard'

const Whiteboard = lazy(() => import('./Whiteboard'))

type Props = {
  title: string
  // Either an existing note to edit, or the session and round a new note belongs to.
  note?: Note
  target?: { sessionId: number; round: number | null }
  onClose: () => void
}

// A full-screen sheet on phones and a centred panel on larger screens. Not a <dialog>: the whiteboard's menus
// render outside it, and they'd sit underneath a modal dialog's top layer.
export function NoteEditor({ title, note, target, onClose }: Props) {
  const [body, setBody] = useState<JSONContent | null>(note?.body ?? null)
  const [text, setText] = useState(note?.text ?? '')
  const [drawingOpen, setDrawingOpen] = useState(Boolean(note?.drawing))
  const board = useRef<WhiteboardHandle>(null)
  const queryClient = useQueryClient()

  const done = () => {
    void queryClient.invalidateQueries({ queryKey: ['notes'] })
    onClose()
  }
  const save = useMutation({
    mutationFn: async () => {
      const drawing = drawingOpen ? await board.current?.exportDrawing() : null
      if (!text.trim() && !drawing) throw new Error('Write something or draw before saving.')
      const content = { body, text, drawing: drawing?.json ?? null, drawingSvg: drawing?.svg ?? null }
      if (note) return api.updateNote(note.id, content)
      return api.addNote({ ...content, sessionId: target!.sessionId, round: target!.round })
    },
    onSuccess: done,
  })
  const remove = useMutation({ mutationFn: () => api.deleteNote(note!.id), onSuccess: done })

  // Escape closes; the page behind doesn't scroll while the sheet is open.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !e.defaultPrevented && onClose()
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = overflow
      window.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  return (
    <div className="fixed inset-0 z-40 flex items-stretch justify-center bg-night/50 sm:items-center sm:p-6">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="note-editor-title"
        className="flex h-dvh w-full flex-col overflow-y-auto bg-bg pt-[env(safe-area-inset-top)] text-ink sm:h-auto sm:max-h-[92dvh] sm:max-w-4xl sm:rounded-[18px]"
      >
        <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-line bg-surface px-4 py-2 sm:px-6">
          <h2 id="note-editor-title" className="font-display text-lg font-bold">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close without saving"
            className="grid size-11 cursor-pointer place-items-center rounded-lg text-2xl text-muted hover:bg-bg"
          >
            ×
          </button>
        </div>

        <div className="flex flex-col gap-4 p-4 sm:p-6">
          <RichTextEditor
            initial={note?.body ?? null}
            placeholder="What did you grasp this round? Explain it in your own words…"
            autoFocus
            onChange={(json, plain) => {
              setBody(json)
              setText(plain)
            }}
          />

          {drawingOpen ? (
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-soft">Whiteboard</span>
                <button
                  type="button"
                  onClick={() => setDrawingOpen(false)}
                  className="min-h-11 cursor-pointer rounded-lg px-3 text-sm font-semibold text-warn hover:bg-warn-soft"
                >
                  Remove drawing
                </button>
              </div>
              <Suspense
                fallback={
                  <p className="grid h-80 place-items-center rounded-xl border border-line-strong text-muted">
                    Loading whiteboard…
                  </p>
                }
              >
                <Whiteboard ref={board} initial={note?.drawing ?? null} />
              </Suspense>
            </div>
          ) : (
            <button type="button" onClick={() => setDrawingOpen(true)} className="btn btn-ghost self-start">
              + Add a drawing
            </button>
          )}
          <ErrorNote error={save.error ?? remove.error} />
        </div>

        <div className="sticky bottom-0 mt-auto flex flex-wrap gap-2.5 border-t border-line bg-surface px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] sm:px-6">
          <button type="button" disabled={save.isPending} onClick={() => save.mutate()} className="btn btn-primary">
            {save.isPending ? 'Saving…' : 'Save note'}
          </button>
          <button type="button" onClick={onClose} className="btn btn-ghost">
            Cancel
          </button>
          {note && (
            <button
              type="button"
              disabled={remove.isPending}
              onClick={() => remove.mutate()}
              className="btn ml-auto text-warn hover:bg-warn-soft"
            >
              Delete
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
