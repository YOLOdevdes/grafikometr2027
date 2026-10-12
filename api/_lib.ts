/**
 * Wspólne klocki API (pliki z „_” na początku Vercel nie wystawia jako endpointy).
 *
 * Zmienne środowiskowe:
 *   ADMIN_PASSWORD   hasło do trybu edycji
 *   SESSION_SECRET   klucz do podpisywania ciasteczka sesji (losowy, długi)
 *   KV_REST_API_URL / KV_REST_API_TOKEN  (albo UPSTASH_REDIS_REST_URL / _TOKEN) — baza Upstash Redis
 *   GM_DEV_STORE     tylko lokalnie: plik JSON zamiast Redisa
 */
import { createHmac, timingSafeEqual } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'

export const SESSION_TTL_S = 60 * 60 // sesja wygasa po godzinie bez kontaktu z serwerem
const COOKIE = 'gm_session'

function need(name: string): string {
  const v = process.env[name]
  if (!v) throw new HttpError(500, `Brak zmiennej środowiskowej ${name}`)
  return v
}

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message)
  }
}

export function json(data: unknown, status = 200, headers: HeadersInit = {}) {
  const h = new Headers(headers)
  h.set('content-type', 'application/json; charset=utf-8')
  h.set('cache-control', 'no-store')
  return new Response(JSON.stringify(data), { status, headers: h })
}

/** Owija handler: błędy → JSON z kodem. */
export function route(fn: (req: Request) => Promise<Response>) {
  return async (req: Request) => {
    try {
      return await fn(req)
    } catch (e) {
      if (e instanceof HttpError) return json({ error: e.message }, e.status)
      console.error(e)
      return json({ error: 'Błąd serwera' }, 500)
    }
  }
}

// ---------- porównania i podpisy ----------

const hmac = (v: string) => createHmac('sha256', need('SESSION_SECRET')).update(v).digest('base64url')

/** Porównanie w stałym czasie (niezależnie od długości). */
export function safeEqual(a: string, b: string) {
  const ha = createHmac('sha256', 'cmp').update(a).digest()
  const hb = createHmac('sha256', 'cmp').update(b).digest()
  return timingSafeEqual(ha, hb)
}

export const checkPassword = (pw: string) => safeEqual(pw, need('ADMIN_PASSWORD'))

// ---------- sesja w ciasteczku: <wygaśnięcie>.<podpis> ----------

export function sessionCookie() {
  const exp = String(Math.floor(Date.now() / 1000) + SESSION_TTL_S)
  return `${COOKIE}=${exp}.${hmac(exp)}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${SESSION_TTL_S}`
}
export const clearCookie = () => `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`

export function isAuthed(req: Request) {
  const raw = req.headers.get('cookie') ?? ''
  const m = raw.match(new RegExp(`(?:^|;\\s*)${COOKIE}=([^;]+)`))
  if (!m) return false
  const [exp, sig] = m[1].split('.')
  if (!exp || !sig || !safeEqual(sig, hmac(exp))) return false
  return Number(exp) > Date.now() / 1000
}

export function requireAuth(req: Request) {
  if (!isAuthed(req)) throw new HttpError(401, 'Sesja wygasła — zaloguj się ponownie')
}

// ---------- magazyn: Upstash Redis (REST) albo plik lokalny ----------

const redisUrl = () => process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL
const redisToken = () => process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN

async function redis(...cmd: (string | number)[]): Promise<unknown> {
  const res = await fetch(redisUrl()!, {
    method: 'POST',
    headers: { authorization: `Bearer ${redisToken()}`, 'content-type': 'application/json' },
    body: JSON.stringify(cmd),
  })
  const body = (await res.json()) as { result?: unknown; error?: string }
  if (!res.ok || body.error) throw new Error(`Redis: ${body.error ?? res.status}`)
  return body.result
}

type FileDb = Record<string, { v: string; exp?: number }>
function fileDb(): { path: string; data: FileDb } | null {
  const path = process.env.GM_DEV_STORE
  if (!path) return null
  const data: FileDb = existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : {}
  for (const [k, e] of Object.entries(data)) if (e.exp && e.exp < Date.now()) delete data[k]
  return { path, data }
}
function saveFileDb(db: { path: string; data: FileDb }) {
  mkdirSync(dirname(db.path), { recursive: true })
  writeFileSync(db.path, JSON.stringify(db.data))
}
function noStore(): never {
  throw new HttpError(500, 'Brak bazy danych — podłącz Upstash Redis w Vercel (Storage)')
}

export const store = {
  async get(key: string): Promise<string | null> {
    if (redisUrl()) return (await redis('GET', key)) as string | null
    const db = fileDb() ?? noStore()
    return db.data[key]?.v ?? null
  },
  async set(key: string, value: string) {
    if (redisUrl()) return void (await redis('SET', key, value))
    const db = fileDb() ?? noStore()
    db.data[key] = { v: value }
    saveFileDb(db)
  },
  async del(key: string) {
    if (redisUrl()) return void (await redis('DEL', key))
    const db = fileDb() ?? noStore()
    delete db.data[key]
    saveFileDb(db)
  },
  /** Licznik z czasem życia (do blokady zgadywania hasła). */
  async hit(key: string, ttlS: number): Promise<number> {
    if (redisUrl()) {
      const n = (await redis('INCR', key)) as number
      if (n === 1) await redis('EXPIRE', key, ttlS)
      return n
    }
    const db = fileDb() ?? noStore()
    const cur = db.data[key]
    const n = (cur ? Number(cur.v) : 0) + 1
    db.data[key] = { v: String(n), exp: cur?.exp ?? Date.now() + ttlS * 1000 }
    saveFileDb(db)
    return n
  },
}

export const clientIp = (req: Request) => (req.headers.get('x-forwarded-for') ?? 'local').split(',')[0].trim()
