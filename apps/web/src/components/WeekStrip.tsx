import { Link } from 'react-router'
import { addDays, formatDay, parseDate } from '../lib/date'

// The day-review page for a date; today's lives on the Today page itself.
export const dayPath = (date: string, today: string) => (date === today ? '/' : `/day/${date}`)

type Props = {
  weekStart: string
  weekStudied: string[]
  today: string
  // The day being viewed (today on the Today page).
  selected: string
}

// A week of days to jump between: past days open their review, future days aren't reachable yet.
export function WeekStrip({ weekStart, weekStudied, today, selected }: Props) {
  const nextWeek = addDays(selected, 7)

  return (
    <nav aria-label="Days" className="flex w-full items-center gap-1 sm:w-auto">
      <Link
        to={dayPath(addDays(selected, -7), today)}
        aria-label="Previous week"
        className="grid size-11 shrink-0 place-items-center rounded-lg text-xl text-soft hover:bg-surface hover:text-ink"
      >
        ‹
      </Link>
      <ol className="grid flex-1 grid-cols-7 gap-1.5 text-center text-xs font-semibold text-muted sm:min-w-[420px] sm:gap-2">
        {Array.from({ length: 7 }, (_, i) => {
          const date = addDays(weekStart, i)
          const studied = weekStudied.includes(date)
          const isSelected = date === selected
          const future = date > today
          const box = `grid size-10 place-items-center rounded-[10px] text-[13px] sm:size-9 ${
            isSelected
              ? 'border-2 border-accent text-accent'
              : studied
                ? 'bg-accent text-white'
                : i >= 5
                  ? 'border border-dashed border-line-strong bg-surface'
                  : 'border border-line bg-surface'
          }`
          const label = `${formatDay(date)}${date === today ? ' (today)' : ''}${studied ? ', studied' : ''}`
          return (
            <li key={date} className="flex flex-col items-center gap-1.5">
              <span aria-hidden="true">{formatDay(date, { weekday: 'short' })}</span>
              {future ? (
                <span className={`${box} opacity-40`} aria-label={`${label}, not yet`}>
                  {parseDate(date).getDate()}
                </span>
              ) : (
                <Link
                  to={dayPath(date, today)}
                  aria-label={label}
                  aria-current={isSelected ? 'date' : undefined}
                  className={`${box} transition hover:-translate-y-0.5 hover:shadow-sm ${
                    studied && !isSelected ? 'hover:text-white' : 'hover:text-accent'
                  }`}
                >
                  {parseDate(date).getDate()}
                </Link>
              )}
            </li>
          )
        })}
      </ol>
      {addDays(weekStart, 7) <= today ? (
        <Link
          to={dayPath(nextWeek > today ? today : nextWeek, today)}
          aria-label="Next week"
          className="grid size-11 shrink-0 place-items-center rounded-lg text-xl text-soft hover:bg-surface hover:text-ink"
        >
          ›
        </Link>
      ) : (
        <span aria-hidden="true" className="size-11 shrink-0" />
      )}
    </nav>
  )
}
