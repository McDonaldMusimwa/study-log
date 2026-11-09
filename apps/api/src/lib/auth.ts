import { createHash, createHmac, timingSafeEqual } from 'node:crypto'
import type { Context, MiddlewareHandler } from 'hono'
import { deleteCookie, getCookie, setCookie } from 'hono/cookie'
import { HTTPException } from 'hono/http-exception'
import { env } from '../env.js'

// Single-user login: APP_PASSWORD unlocks the app, and a signed cookie keeps you signed in.
// Optional: without APP_PASSWORD the app is open, with no login screen.

const COOKIE = 'study_log_session'
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30

// The signing key comes from the password, so changing APP_PASSWORD signs everyone out.
const key = () => createHash('sha256').update(`study-log:${env.appPassword}`).digest()
const sign = (value: string) => createHmac('sha256', key()).update(value).digest('base64url')

function safeEqual(a: string, b: string) {
  const left = createHash('sha256').update(a).digest()
  const right = createHash('sha256').update(b).digest()
  return timingSafeEqual(left, right)
}

function validToken(token: string | undefined) {
  if (!token) return false
  const [expires, signature] = token.split('.')
  if (!expires || !signature || Number(expires) < Date.now()) return false
  return safeEqual(signature, sign(expires))
}

export const authEnabled = () => Boolean(env.appPassword)

export function isSignedIn(c: Context) {
  return !authEnabled() || validToken(getCookie(c, COOKIE))
}

export function checkPassword(password: string) {
  return authEnabled() && safeEqual(password, env.appPassword)
}

export function signIn(c: Context) {
  const expires = String(Date.now() + MAX_AGE_SECONDS * 1000)
  setCookie(c, COOKIE, `${expires}.${sign(expires)}`, {
    httpOnly: true,
    secure: new URL(c.req.url).protocol === 'https:',
    sameSite: 'Lax',
    path: '/',
    maxAge: MAX_AGE_SECONDS,
  })
}

export function signOut(c: Context) {
  deleteCookie(c, COOKIE, { path: '/' })
}

const PUBLIC_PATHS = new Set(['/api/health', '/api/session', '/api/login', '/api/logout'])

export const requireAuth: MiddlewareHandler = async (c, next) => {
  if (PUBLIC_PATHS.has(c.req.path) || isSignedIn(c)) return next()
  throw new HTTPException(401, { message: 'Sign in to continue' })
}
