import type { ReactNode } from 'react'

export function Swatch({ color, className = 'size-2.5' }: { color: string; className?: string }) {
  return <span aria-hidden="true" className={`inline-block shrink-0 rounded-[3px] ${className}`} style={{ background: color }} />
}

export function PageHeading({ eyebrow, title, aside }: { eyebrow: string; title: string; aside?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
      <div className="flex flex-col gap-1.5">
        <p className="text-sm font-semibold text-muted">{eyebrow}</p>
        <h1 className="font-display text-[34px] leading-tight font-bold tracking-tight sm:text-[40px]">{title}</h1>
      </div>
      {aside}
    </div>
  )
}

export function ErrorNote({ error }: { error: unknown }) {
  if (!error) return null
  return (
    <p role="alert" className="rounded-xl bg-warn-soft px-4 py-3 text-sm font-medium text-warn">
      {error instanceof Error ? error.message : 'Something went wrong'}
    </p>
  )
}

export function Loading() {
  return <p className="text-muted">Loading…</p>
}
