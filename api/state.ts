import { HttpError, isAuthed, json, requireAuth, route, sessionCookie, store } from './_lib.js'

/**
 * Cały stan aplikacji jako jeden dokument JSON (osoby, projekty, sloty, nieobecności, historia, zadania…).
 * rev rośnie przy każdym zapisie — chroni przed nadpisaniem nowszych danych starszą kartą.
 */
const KEY = 'gm:state'
const TABLES = ['designers', 'absences', 'projects', 'demands', 'mercenaries', 'history', 'settings', 'todos'] as const
type Data = Record<(typeof TABLES)[number], unknown[]>
interface Doc { rev: number; savedAt: string | null; data: Data | null }

async function load(): Promise<Doc> {
  const raw = await store.get(KEY)
  return raw ? (JSON.parse(raw) as Doc) : { rev: 0, savedAt: null, data: null }
}

/** Podgląd publiczny: bez typu i notatek nieobecności (L4 to dane o zdrowiu). */
function forPreview(data: Data | null): Data | null {
  if (!data) return null
  const absences = (data.absences as { id: string; designerId: string; from: string; to: string }[]).map(a => ({
    id: a.id, designerId: a.designerId, from: a.from, to: a.to, type: 'OTHER',
  }))
  return { ...data, absences }
}

/** GET (zalogowany) → pełne dane; GET ?view=preview (każdy) → dane do publicznego podglądu. */
export const GET = route(async req => {
  const doc = await load()
  // podgląd jest publiczny i zawsze dostaje wersję okrojoną — także gdy przeglądarka ma sesję edycji
  if (new URL(req.url).searchParams.get('view') === 'preview') return json({ ...doc, data: forPreview(doc.data) })
  if (isAuthed(req)) return json(doc, 200, { 'set-cookie': sessionCookie() })
  throw new HttpError(401, 'Brak dostępu')
})

/** PUT { rev, data } (tylko zalogowany) → zapis, gdy rev zgadza się z serwerem. */
export const PUT = route(async req => {
  requireAuth(req)
  const body = (await req.json().catch(() => null)) as { rev?: unknown; data?: unknown } | null
  const data = body?.data as Data | undefined
  if (!body || typeof body.rev !== 'number' || !data || typeof data !== 'object' || !TABLES.every(t => Array.isArray(data[t] ?? []))) {
    throw new HttpError(400, 'Nieprawidłowe dane')
  }
  const cur = await load()
  if (cur.rev !== body.rev) return json({ error: 'Dane na serwerze są nowsze', rev: cur.rev }, 409)
  const clean = Object.fromEntries(TABLES.map(t => [t, data[t] ?? []])) as Data
  const doc: Doc = { rev: cur.rev + 1, savedAt: new Date().toISOString(), data: clean }
  await store.set(KEY, JSON.stringify(doc))
  return json({ rev: doc.rev, savedAt: doc.savedAt }, 200, { 'set-cookie': sessionCookie() })
})
