import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { NavLink, Navigate, Route, Routes } from 'react-router'
import { BookIcon, CardsIcon, ChartIcon, NoteIcon, PenIcon, PostIcon, SunIcon } from './components/icons'
import { api } from './lib/api'
import { useToday } from './lib/date'
import { Login } from './pages/Login'
import { Notes } from './pages/Notes'
import { Posts } from './pages/Posts'
import { ProgressPage } from './pages/Progress'
import { Review } from './pages/Review'
import { TodayPage } from './pages/Today'
import { WrapUp } from './pages/WrapUp'

const links = [
  { to: '/', label: 'Today', end: true, Icon: SunIcon },
  { to: '/notes', label: 'Notes', Icon: NoteIcon },
  { to: '/wrap-up', label: 'Wrap-up', Icon: PenIcon },
  { to: '/progress', label: 'Progress', Icon: ChartIcon },
  { to: '/review', label: 'Review', Icon: CardsIcon },
  { to: '/posts', label: 'Posts', Icon: PostIcon },
]

function DueBadge({ count, className = '' }: { count?: number; className?: string }) {
  if (!count) return null
  return (
    <span className={`rounded-full bg-accent px-1.5 py-0.5 text-xs leading-none text-white ${className}`}>
      {count}
      <span className="sr-only"> due</span>
    </span>
  )
}

// Phones get a thumb-friendly tab bar at the bottom; wider screens use the header links.
function TabBar({ today }: { today: string }) {
  const { data } = useQuery({ queryKey: ['today', today], queryFn: () => api.today(today) })

  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur sm:hidden"
    >
      <div className="grid grid-cols-6">
        {links.map(({ to, label, end, Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `relative flex min-h-15 flex-col items-center justify-center gap-1 text-[11px] font-semibold ${
                isActive ? 'text-accent' : 'text-muted hover:text-ink'
              }`
            }
          >
            <Icon className="size-5.5" />
            {label}
            {to === '/review' && <DueBadge count={data?.reviewDue} className="absolute top-1.5 left-1/2 ml-2" />}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}

function Header({ today }: { today: string }) {
  const { data } = useQuery({ queryKey: ['today', today], queryFn: () => api.today(today) })
  const authEnabled = useQuery({ queryKey: ['session'], queryFn: api.session, staleTime: Infinity }).data?.authEnabled
  const queryClient = useQueryClient()
  const logout = useMutation({
    mutationFn: api.logout,
    onSuccess: (state) => {
      queryClient.clear()
      queryClient.setQueryData(['session'], state)
    },
  })

  return (
    <header className="sticky top-0 z-20 border-b border-line bg-surface/95 pt-[env(safe-area-inset-top)] backdrop-blur">
      <div className="mx-auto flex min-h-14 max-w-310 items-center gap-x-7 px-4 sm:min-h-16 sm:px-6">
        <NavLink to="/" className="flex items-center gap-2.5 font-display text-[19px] font-bold text-ink hover:text-ink">
          <span className="grid size-7 place-items-center rounded-lg bg-accent">
            <BookIcon className="size-4 text-white" />
          </span>
          Study Log
        </NavLink>
        <nav aria-label="Main" className="hidden gap-1 sm:flex">
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.end}
              className={({ isActive }) =>
                `flex shrink-0 items-center gap-1.5 rounded-lg px-3.5 py-2.5 text-[15px] font-semibold ${
                  isActive ? 'bg-accent-soft text-accent' : 'text-soft hover:bg-bg hover:text-ink'
                }`
              }
            >
              {link.label}
              {link.to === '/review' && <DueBadge count={data?.reviewDue} />}
            </NavLink>
          ))}
        </nav>
        <span className="ml-auto text-sm text-muted">
          <strong className="text-ink">{data?.streak ?? 0}</strong>-day streak
        </span>
        {authEnabled && (
          <button
            type="button"
            onClick={() => logout.mutate()}
            className="min-h-11 cursor-pointer rounded-lg px-3 text-sm font-semibold text-soft hover:bg-bg hover:text-ink"
          >
            Sign out
          </button>
        )}
      </div>
    </header>
  )
}

export default function App() {
  const today = useToday()
  const session = useQuery({ queryKey: ['session'], queryFn: api.session, staleTime: Infinity })

  if (session.isPending) return null
  if (session.data && !session.data.signedIn) return <Login />

  return (
    <>
      <Header today={today} />
      {/* Bottom padding keeps the last card clear of the phone tab bar. */}
      <main className="mx-auto flex max-w-310 flex-col gap-6 px-4 pt-6 pb-[calc(6rem+env(safe-area-inset-bottom))] sm:px-6 sm:pt-8 sm:pb-16">
        <Routes>
          <Route path="/" element={<TodayPage today={today} />} />
          <Route path="/wrap-up" element={<WrapUp today={today} />} />
          <Route path="/wrap-up/:date" element={<WrapUp today={today} />} />
          <Route path="/progress" element={<ProgressPage today={today} />} />
          <Route path="/review" element={<Review today={today} />} />
          <Route path="/notes" element={<Notes />} />
          <Route path="/posts" element={<Posts />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      <TabBar today={today} />
    </>
  )
}
