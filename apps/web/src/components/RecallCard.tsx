import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { api, type ReviewItem } from '../lib/api'
import { ErrorNote, Swatch } from './ui'

// One spaced-repetition prompt: say the answer out loud, reveal the note, then grade yourself.
export function RecallCard({ item, today, position }: { item: ReviewItem; today: string; position?: string }) {
  const [revealed, setRevealed] = useState(false)
  const queryClient = useQueryClient()
  const grade = useMutation({
    mutationFn: (result: 'again' | 'good') => api.gradeReview(item.id, result, today),
    onSuccess: () => {
      setRevealed(false)
      void queryClient.invalidateQueries({ queryKey: ['reviews'] })
      void queryClient.invalidateQueries({ queryKey: ['today'] })
    },
  })
  const overdue = item.dueOn < today

  return (
    <section aria-label="Recall card" className="card flex flex-col gap-3.5 p-6">
      <div className="flex justify-between gap-3 text-[13px] font-semibold text-muted">
        <span>{position ?? 'Recall'}</span>
        <span className="flex items-center gap-1.5">
          <Swatch color={item.track.color} className="size-2" />
          {item.track.name}
          {overdue && ' · overdue'}
        </span>
      </div>
      <p className="font-display text-[22px] leading-snug font-bold">{item.prompt}</p>
      {revealed ? (
        <p className="rounded-xl bg-field px-4 py-3 text-[15px] leading-relaxed whitespace-pre-line text-soft">
          {item.answer || 'No note saved. Grade it on how well you explained it.'}
        </p>
      ) : (
        <>
          <p className="text-sm text-muted">Say it out loud first, then reveal your note.</p>
          <button type="button" className="btn btn-ghost" onClick={() => setRevealed(true)}>
            Reveal note
          </button>
        </>
      )}
      <div className="grid grid-cols-2 gap-2.5">
        <button
          type="button"
          disabled={grade.isPending}
          onClick={() => grade.mutate('again')}
          className="btn border border-[#f3d5b5] bg-surface text-sm text-warn hover:bg-warn-soft"
        >
          Shaky · again
        </button>
        <button
          type="button"
          disabled={grade.isPending}
          onClick={() => grade.mutate('good')}
          className="btn border border-[#bfe6d4] bg-surface text-sm text-ok hover:bg-ok-soft"
        >
          Got it
        </button>
      </div>
      <ErrorNote error={grade.error} />
    </section>
  )
}
