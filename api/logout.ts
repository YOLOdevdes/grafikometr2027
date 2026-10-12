import { clearCookie, json, route } from './_lib.js'

/** POST → usuwa ciasteczko sesji. */
export const POST = route(async () => json({ ok: true }, 200, { 'set-cookie': clearCookie() }))
