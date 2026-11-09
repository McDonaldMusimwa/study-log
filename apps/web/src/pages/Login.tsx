import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { BookIcon } from '../components/icons'
import { ErrorNote } from '../components/ui'
import { api } from '../lib/api'

export function Login() {
  const [password, setPassword] = useState('')
  const queryClient = useQueryClient()
  const login = useMutation({
    mutationFn: () => api.login(password),
    onSuccess: (state) => {
      queryClient.setQueryData(['session'], state)
      void queryClient.invalidateQueries()
    },
  })

  return (
    <main className="grid min-h-dvh place-items-center px-4 py-10">
      <form
        onSubmit={(e) => {
          e.preventDefault()
          login.mutate()
        }}
        className="card flex w-full max-w-sm flex-col gap-5 p-7"
      >
        <div className="flex items-center gap-2.5 font-display text-[22px] font-bold">
          <span className="grid size-8 place-items-center rounded-lg bg-accent">
            <BookIcon className="size-4.5 text-white" />
          </span>
          Study Log
        </div>
        <div className="flex flex-col gap-2">
          <label htmlFor="password" className="text-sm font-semibold text-soft">
            Password
          </label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            required
            autoFocus
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="field"
          />
        </div>
        <button type="submit" disabled={login.isPending || !password} className="btn btn-primary">
          {login.isPending ? 'Signing in…' : 'Sign in'}
        </button>
        <ErrorNote error={login.error} />
      </form>
    </main>
  )
}
