import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { JSONContent } from '@tiptap/react'
import { useState } from 'react'
import { TrashIcon } from '../components/icons'
import { RecallCard } from '../components/RecallCard'
import { RichTextEditor } from '../components/RichText'
import { ErrorNote, Loading, PageHeading, Swatch } from '../components/ui'
import { api } from '../lib/api'
import { formatDay } from '../lib/date'

function AddForm({ today }: { today: string }) {
  const { data: tracks } = useQuery({ queryKey: ['tracks'], queryFn: api.tracks })
  const [trackId, setTrackId] = useState('')
  const [prompt, setPrompt] = useState('')
  const [answer, setAnswer] = useState('')
  const [answerBody, setAnswerBody] = useState<JSONContent | null>(null)
  // Bumped after adding a card, so the editor starts empty for the next one.
  const [editorKey, setEditorKey] = useState(0)
  const queryClient = useQueryClient()
  const add = useMutation({
    mutationFn: () =>
      api.addReview({ date: today, trackId: Number(trackId || tracks?.[0]?.id), prompt, answer, answerBody }),
    onSuccess: () => {
      setPrompt('')
      setAnswer('')
      setAnswerBody(null)
      setEditorKey((k) => k + 1)
      void queryClient.invalidateQueries({ queryKey: ['reviews'] })
      void queryClient.invalidateQueries({ queryKey: ['today'] })
    },
  })

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        add.mutate()
      }}
      className="card flex flex-col gap-4 p-6"
    >
      <h2 className="font-display text-xl font-bold">Add a recall card</h2>
      <div className="flex flex-col gap-2">
        <label htmlFor="review-track" className="text-sm font-semibold text-soft">
          Track
        </label>
        <select id="review-track" value={trackId} onChange={(e) => setTrackId(e.target.value)} className="field">
          {tracks?.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-2">
        <label htmlFor="review-prompt" className="text-sm font-semibold text-soft">
          Question
        </label>
        <input
          id="review-prompt"
          required
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="What's the difference between a fault and a failure?"
          className="field"
        />
      </div>
      <div className="flex flex-col gap-2">
        <p className="text-sm font-semibold text-soft">Your note</p>
        <RichTextEditor
          key={editorKey}
          initial={null}
          placeholder="The answer in your own words. You'll compare against it later."
          minHeight="min-h-36"
          onChange={(body, text) => {
            setAnswerBody(body)
            setAnswer(text)
          }}
        />
      </div>
      <button type="submit" disabled={add.isPending || !prompt.trim() || !tracks} className="btn btn-primary self-start">
        Add card
      </button>
      <p className="text-[13px] text-muted">It comes back tomorrow, then after 3, 7, 14 and 30 days while you keep getting it.</p>
      <ErrorNote error={add.error} />
    </form>
  )
}

export function Review({ today }: { today: string }) {
  const { data, error } = useQuery({ queryKey: ['reviews', today], queryFn: () => api.reviews(today) })
  const queryClient = useQueryClient()
  const remove = useMutation({
    mutationFn: api.deleteReview,
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['reviews'] }),
  })

  return (
    <>
      <PageHeading eyebrow="Spaced repetition" title="Review" />
      <ErrorNote error={error} />
      <div className="flex flex-wrap items-start gap-6">
        <div className="flex min-w-0 flex-[999_1_520px] flex-col gap-5">
          {!data ? (
            <Loading />
          ) : data.due.length ? (
            data.due.map((item, i) => (
              <RecallCard key={item.id} item={item} today={today} position={`Due · ${i + 1} of ${data.due.length}`} />
            ))
          ) : (
            <section className="card p-6">
              <h2 className="font-display text-xl font-bold">All caught up</h2>
              <p className="mt-1 text-[15px] text-muted">Nothing is due today.</p>
            </section>
          )}
          {data && data.upcoming.length > 0 && (
            <section className="card">
              <h2 className="px-6 pt-5 pb-2 font-display text-xl font-bold">Coming up</h2>
              <ul>
                {data.upcoming.map((item) => (
                  <li key={item.id} className="flex items-center gap-3 border-t border-[#eef0f3] px-6 py-3">
                    <Swatch color={item.track.color} />
                    <span className="min-w-0 flex-1 text-[15px]">{item.prompt}</span>
                    <span className="text-[13px] text-muted">{formatDay(item.dueOn, { day: 'numeric', month: 'short' })}</span>
                    <button
                      type="button"
                      aria-label={`Delete "${item.prompt}"`}
                      onClick={() => remove.mutate(item.id)}
                      className="grid size-11 cursor-pointer place-items-center rounded-lg text-muted hover:bg-warn-soft hover:text-warn"
                    >
                      <TrashIcon className="size-4" />
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
        <div className="min-w-0 flex-[1_1_340px]">
          <AddForm today={today} />
        </div>
      </div>
    </>
  )
}
