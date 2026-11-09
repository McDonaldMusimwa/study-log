import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { ErrorNote, Loading, PageHeading, Swatch } from '../components/ui'
import { api, type Progress, type TrackStats, type TrackWithUnits, type UnitStatus } from '../lib/api'
import { formatDay, formatMinutes } from '../lib/date'

const STATUS_LABEL: Record<UnitStatus, string> = { todo: 'To do', in_progress: 'In progress', done: 'Done' }

// Five shades of the accent: none, under 1h, under 2h, under 3h, 3h or more.
const SHADES = ['#eef0f3', '#d9dcfb', '#a9aff3', '#6e75e0', '#4338ca']
const shade = (minutes: number) => SHADES[minutes === 0 ? 0 : Math.min(4, Math.floor(minutes / 60) + 1)]!

function Stat({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="card flex flex-col gap-1 px-5 py-4">
      <span className="text-[13px] font-semibold text-muted">{label}</span>
      <span className="font-display text-[28px] leading-tight font-bold">{value}</span>
      <span className="text-[13px] text-muted">{note}</span>
    </div>
  )
}

function Heatmap({ data, today }: { data: Progress; today: string }) {
  const weeks = Array.from({ length: data.heatmap.length / 7 }, (_, w) => data.heatmap.slice(w * 7, w * 7 + 7))
  return (
    <section className="card flex flex-col gap-4 p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-display text-xl font-bold">Last 12 weeks</h2>
        <span className="text-[13px] text-muted">{data.studyDays} study days in total</span>
      </div>
      <div className="overflow-x-auto">
        <div className="flex gap-1.5" role="img" aria-label="Study minutes per day for the last 12 weeks">
          {weeks.map((week) => (
            <div key={week[0]!.date} className="flex flex-col gap-1.5">
              {week.map((day) => (
                <span
                  key={day.date}
                  title={`${formatDay(day.date, { weekday: 'short', day: 'numeric', month: 'short' })}: ${formatMinutes(day.minutes)}`}
                  className={`size-5 rounded-[5px] ${day.date === today ? 'ring-2 ring-ink ring-offset-1' : ''} ${
                    day.date > today ? 'opacity-30' : ''
                  }`}
                  style={{ background: shade(day.minutes) }}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
      <div className="flex items-center gap-1.5 text-xs text-muted" aria-hidden="true">
        Less
        {SHADES.map((color) => (
          <span key={color} className="size-3.5 rounded-[4px]" style={{ background: color }} />
        ))}
        More
      </div>
    </section>
  )
}

function WeeklyBars({ data }: { data: Progress }) {
  const max = Math.max(data.weekTargetMinutes, ...data.weeks.map((w) => w.minutes))
  const target = (data.weekTargetMinutes / max) * 100
  return (
    <section className="card flex flex-col gap-4 p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-display text-xl font-bold">Hours per week</h2>
        <span className="text-[13px] text-muted">target {formatMinutes(data.weekTargetMinutes)}</span>
      </div>
      <div className="relative flex h-40 items-end gap-2">
        <span
          aria-hidden="true"
          className="absolute inset-x-0 border-t border-dashed border-muted/60"
          style={{ bottom: `${target}%` }}
        />
        {data.weeks.map((week) => (
          <div key={week.start} className="flex h-full flex-1 flex-col justify-end">
            <span
              title={`Week of ${formatDay(week.start, { day: 'numeric', month: 'short' })}: ${formatMinutes(week.minutes)}`}
              className={`block rounded-t-md ${week.minutes >= data.weekTargetMinutes ? 'bg-accent' : 'bg-[#a9aff3]'}`}
              style={{ height: `${(week.minutes / max) * 100}%`, minHeight: week.minutes ? 4 : 0 }}
            />
          </div>
        ))}
      </div>
      <p className="sr-only">
        {data.weeks.map((w) => `Week of ${w.start}: ${formatMinutes(w.minutes)}`).join('. ')}
      </p>
    </section>
  )
}

function TrackCard({ stats, track }: { stats: TrackStats; track?: TrackWithUnits }) {
  const [title, setTitle] = useState('')
  const queryClient = useQueryClient()
  const refresh = () => {
    for (const key of ['tracks', 'progress', 'today']) void queryClient.invalidateQueries({ queryKey: [key] })
  }
  const setStatus = useMutation({
    mutationFn: ({ id, status }: { id: number; status: UnitStatus }) => api.setUnitStatus(id, status),
    onSuccess: refresh,
  })
  const add = useMutation({
    mutationFn: () => api.addUnit(stats.id, title.trim()),
    onSuccess: () => {
      setTitle('')
      refresh()
    },
  })
  const percent = stats.unitsTotal ? Math.round((stats.unitsDone / stats.unitsTotal) * 100) : 0

  return (
    <section className="card flex flex-col gap-3 p-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 font-display text-lg font-bold">
          <Swatch color={stats.color} />
          {stats.name}
        </h2>
        <span className="text-[13px] font-semibold text-muted">{formatMinutes(stats.minutes)}</span>
      </div>
      <div
        className="h-2 overflow-hidden rounded-full bg-[#eef0f3]"
        role="progressbar"
        aria-label={`${stats.name} progress`}
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <span className="block h-full" style={{ width: `${percent}%`, background: stats.color }} />
      </div>
      <p className="text-sm text-muted">
        <strong className="text-ink">{stats.unitsDone}</strong>
        {stats.unitsTotal ? ` of ${stats.unitsTotal}` : ''} {stats.unitLabel}s done
        {stats.unitsInProgress ? ` · ${stats.unitsInProgress} in progress` : ''}
      </p>
      <details className="group">
        <summary className="cursor-pointer text-sm font-semibold text-accent">
          {track?.units.length ? `Show ${track.units.length} ${stats.unitLabel}s` : `Add ${stats.unitLabel}s`}
        </summary>
        <ul className="mt-3 flex flex-col gap-1.5">
          {track?.units.map((unit) => (
            <li key={unit.id} className="flex items-center gap-3 text-sm">
              <span className={`min-w-0 flex-1 ${unit.status === 'done' ? 'text-muted line-through' : ''}`}>
                {unit.title}
              </span>
              <label className="sr-only" htmlFor={`unit-${unit.id}`}>
                Status of {unit.title}
              </label>
              <select
                id={`unit-${unit.id}`}
                value={unit.status}
                onChange={(e) => setStatus.mutate({ id: unit.id, status: e.target.value as UnitStatus })}
                className="min-h-11 rounded-lg border border-line-strong bg-field px-2.5 text-[13px]"
              >
                {Object.entries(STATUS_LABEL).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </li>
          ))}
        </ul>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            if (title.trim()) add.mutate()
          }}
          className="mt-3 flex flex-col gap-2"
        >
          <label htmlFor={`add-unit-${stats.id}`} className="text-sm font-semibold text-soft">
            New {stats.unitLabel}
          </label>
          <input id={`add-unit-${stats.id}`} value={title} onChange={(e) => setTitle(e.target.value)} className="field" />
          <button type="submit" disabled={add.isPending || !title.trim()} className="btn btn-ghost self-start">
            Add {stats.unitLabel}
          </button>
        </form>
        <ErrorNote error={setStatus.error ?? add.error} />
      </details>
    </section>
  )
}

export function ProgressPage({ today }: { today: string }) {
  const progress = useQuery({ queryKey: ['progress', today], queryFn: () => api.progress(today) })
  const tracks = useQuery({ queryKey: ['tracks'], queryFn: api.tracks })
  const data = progress.data

  if (progress.error) return <ErrorNote error={progress.error} />
  if (!data) return <Loading />

  const thisWeek = data.weeks.at(-1)?.minutes ?? 0

  return (
    <>
      <PageHeading eyebrow="Everything you've logged" title="Progress" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="This week" value={formatMinutes(thisWeek)} note={`target ${formatMinutes(data.weekTargetMinutes)}`} />
        <Stat label="Streak" value={`${data.streak} days`} note="weekends don't break it" />
        <Stat label="Total studied" value={formatMinutes(data.totalMinutes)} note={`${data.studyDays} study days`} />
        <Stat label="LinkedIn posts" value={String(data.postsPosted)} note={`${data.postsDrafted} drafted`} />
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        <Heatmap data={data} today={today} />
        <WeeklyBars data={data} />
      </div>
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {data.tracks.map((stats) => (
          <TrackCard key={stats.id} stats={stats} track={tracks.data?.find((t) => t.id === stats.id)} />
        ))}
      </div>
    </>
  )
}
