import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { NavLink, Navigate, Route, Routes } from 'react-router'
import { BookIcon } from './components/icons'
import { api } from './lib/api'
import { useToday } from './lib/date'
import { Login } from './pages/Login'
import { Posts } from './pages/Posts'
import { ProgressPage } from './pages/Progress'
import { Review } from './pages/Review'
import { TodayPage } from './pages/Today'
import { WrapUp } from './pages/WrapUp'

const links = [
  { to: '/', label: 'Today', end: true },
  { to: '/wrap-up', label: 'Wrap-up' },
  { to: '/progress', label: 'Progress' },
  { to: '/review', label: 'Review' },
  { to: '/posts', label: 'Posts' },
]

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
    <header className="border-b border-line bg-surface">
      <div className="mx-auto flex min-h-16 max-w-310 flex-wrap items-center gap-x-7 gap-y-2 px-4 py-2 sm:px-6">
        <NavLink to="/" className="flex items-center gap-2.5 font-display text-[19px] font-bold text-ink hover:text-ink">
          <span className="grid size-7 place-items-center rounded-lg bg-accent">
            <BookIcon className="size-4 text-white" />
          </span>
          Study Log
        </NavLink>
        <nav aria-label="Main" className="order-last -mx-1 flex w-full gap-1 overflow-x-auto sm:order-none sm:w-auto">
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.end}
              className={({ isActive }) =>
                `shrink-0 rounded-lg px-3.5 py-2.5 text-[15px] font-semibold ${
                  isActive ? 'bg-accent-soft text-accent' : 'text-soft hover:bg-bg hover:text-ink'
                }`
              }
            >
              {link.label}
              {link.to === '/review' && data?.reviewDue ? (
                <span className="ml-1.5 rounded-full bg-accent px-1.5 py-0.5 text-xs text-white">{data.reviewDue}</span>
              ) : null}
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
      <main className="mx-auto flex max-w-310 flex-col gap-6 px-4 pt-8 pb-16 sm:px-6">
        <Routes>
          <Route path="/" element={<TodayPage today={today} />} />
          <Route path="/wrap-up" element={<WrapUp today={today} />} />
          <Route path="/wrap-up/:date" element={<WrapUp today={today} />} />
          <Route path="/progress" element={<ProgressPage today={today} />} />
          <Route path="/review" element={<Review today={today} />} />
          <Route path="/posts" element={<Posts />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </>
  )
}
