import type { Context } from 'hono'
import { HTTPException } from 'hono/http-exception'
import type { z } from 'zod'
import { isDate } from './dates.js'

// Parses a JSON body against a schema; a mismatch becomes a 400 that names the field, e.g. "text: Too small".
export async function body<T extends z.ZodType>(c: Context, schema: T): Promise<z.infer<T>> {
  const parsed = schema.safeParse(await c.req.json().catch(() => undefined))
  if (!parsed.success) {
    const message = parsed.error.issues.map((issue) => [issue.path.join('.'), issue.message].filter(Boolean).join(': ')).join('; ')
    throw new HTTPException(400, { message })
  }
  return parsed.data
}

export function dateParam(value: string | undefined) {
  if (!isDate(value)) throw new HTTPException(400, { message: 'Expected a date as YYYY-MM-DD' })
  return value
}

export function idParam(value: string | undefined) {
  const id = Number(value)
  if (!Number.isInteger(id) || id <= 0) throw new HTTPException(400, { message: 'Expected a numeric id' })
  return id
}
