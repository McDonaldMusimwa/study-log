import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Link } from 'react-router'
import { ErrorNote, Loading, PageHeading } from '../components/ui'
import { api, type Post } from '../lib/api'
import { formatDay } from '../lib/date'

function PostCard({ post }: { post: Post }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    await navigator.clipboard.writeText(post.postDraft)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 2000)
  }

  return (
    <article className="card flex flex-col gap-4 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-lg font-bold">{formatDay(post.date)}</h2>
        <span
          className={`rounded-full px-2.5 py-1 text-[13px] font-semibold ${
            post.postedAt ? 'bg-ok-soft text-ok' : 'bg-bg text-muted'
          }`}
        >
          {post.postedAt ? 'Posted' : 'Draft'}
        </span>
      </div>
      <p className="text-[15px] leading-relaxed whitespace-pre-line">{post.postDraft}</p>
      <div className="flex flex-wrap gap-2.5">
        <button type="button" onClick={() => void copy()} className="btn btn-ghost">
          {copied ? 'Copied' : 'Copy'}
        </button>
        <Link to={`/wrap-up/${post.date}`} className="btn btn-ghost">
          Open wrap-up
        </Link>
      </div>
    </article>
  )
}

export function Posts() {
  const { data, error } = useQuery({ queryKey: ['posts'], queryFn: api.posts })

  return (
    <>
      <PageHeading eyebrow="Learning in public" title="Posts" />
      <ErrorNote error={error} />
      {!data ? (
        !error && <Loading />
      ) : data.length ? (
        <div className="grid gap-5 lg:grid-cols-2">
          {data.map((post) => (
            <PostCard key={post.date} post={post} />
          ))}
        </div>
      ) : (
        <p className="text-muted">
          No posts yet. Finish a day on the <Link to="/wrap-up">wrap-up</Link> screen to draft your first one.
        </p>
      )}
    </>
  )
}
